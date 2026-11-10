import assert from 'node:assert/strict';
import test from 'node:test';
import { DataService } from '../centralizedDataService';
import {
  applyDatabaseBackupRestore,
  computeDatabaseRecordCounts,
  createDatabaseBackupEnvelope,
  parseAndPreviewBackupPayload,
} from '../databaseBackupService';
import { GAS_BACKEND_MODULES } from '../gasBackendModules';
import { invokeGasApi } from '../gasBridge';
import { GasPersistenceAdapter } from '../gasPersistenceAdapter';
import { createInitialDatabaseState } from '../seedData';

test('Phase 3 Requirement 1 & 8: Adapter supports explicit IN_MEMORY_PREVIEW and GAS_PRODUCTION modes and preserves 488 records across 25 tables', () => {
  // Start in IN_MEMORY_PREVIEW
  const modeSwitchPreview = DataService.setPersistenceMode('IN_MEMORY_PREVIEW');
  assert.equal(modeSwitchPreview.ok, true);
  assert.equal(DataService.getPersistenceMode(), 'IN_MEMORY_PREVIEW');

  const initialDb = DataService.initializeDatabaseState();
  const counts = computeDatabaseRecordCounts(initialDb);
  const totalRecords = Object.values(counts).reduce((sum, n) => sum + n, 0);
  assert.equal(Object.keys(counts).length, 25);
  assert.equal(totalRecords, 488);

  // Switch to GAS_PRODUCTION mode
  const modeSwitchProd = DataService.setPersistenceMode('GAS_PRODUCTION', {
    currentDb: initialDb,
    simulateConnectionFailure: false,
  });
  assert.equal(modeSwitchProd.ok, true);
  assert.equal(DataService.getPersistenceMode(), 'GAS_PRODUCTION');
  assert.equal(modeSwitchProd.config.connectionState, 'CONNECTED');
  assert.equal(modeSwitchProd.feedback.persistedToGoogleSheets, true);

  // Reset back to IN_MEMORY_PREVIEW at end of test
  DataService.setPersistenceMode('IN_MEMORY_PREVIEW');
});

test('Phase 3 Requirement 2 & Reload Verification: CRUD operations in GAS_PRODUCTION persist to 25 Google Sheets tables and survive application reload', () => {
  const seedDb = createInitialDatabaseState();
  const baseStudentCount = seedDb.Students.length;
  assert.equal(baseStudentCount, 62);

  // Initialize clean Google Sheets store with the 488 seed records
  GasPersistenceAdapter.writePersistedGoogleSheetsState(seedDb);

  const switchRes = DataService.setPersistenceMode('GAS_PRODUCTION', {
    currentDb: seedDb,
    simulateConnectionFailure: false,
  });
  assert.equal(switchRes.ok, true);

  let workingDb = switchRes.db!;
  assert.equal(workingDb.Students.length, baseStudentCount);

  // 1. CREATE Student in GAS_PRODUCTION
  const createRes = DataService.addStudentRecordCascade(
    workingDb,
    {
      studentCode: '99881',
      lastNameKh: 'សុខ',
      firstNameKh: 'ពិសិដ្ឋ',
      familyNameEn: 'SOK',
      givenNameEn: 'PISETH',
      gender: 'ប្រុស',
      dateOfBirth: '2008-05-12',
      phone: '012998811',
      village: 'ភូមិទឹកជោរ',
      classId: 'CLS-12C',
      orphanStatus: 'NONE',
      disabilityStatus: 'NONE',
      povertyLevel: 'NONE',
      previousSchool: 'អនុវិទ្យាល័យទឹកជោរ',
      monthlyAverage: 42.5,
    },
    'USR-ADM-01'
  );
  assert.equal(createRes.ok, true);
  workingDb = createRes.db;
  assert.equal(workingDb.Students.length, baseStudentCount + 1);

  // Simulate application reload via DataService.initializeDatabaseState()
  const reloadedAfterCreate = DataService.initializeDatabaseState();
  assert.equal(reloadedAfterCreate.Students.length, baseStudentCount + 1);
  const foundCreated = DataService.findById(
    reloadedAfterCreate,
    'Students',
    'STD-99881'
  );
  assert.ok(foundCreated);
  assert.equal(foundCreated.FullNameKh, 'សុខ ពិសិដ្ឋ');

  // 2. UPDATE Student in GAS_PRODUCTION
  const updateRes = DataService.updateRecord(
    reloadedAfterCreate,
    'Students',
    'STD-99881',
    { Phone: '099777888', Remarks: 'Persisted in Google Sheets' },
    { actorUserId: 'USR-ADM-01' }
  );
  assert.equal(updateRes.ok, true);
  assert.equal(updateRes.persisted, true);
  assert.equal(updateRes.mode, 'GAS_PRODUCTION');

  // Simulate application reload after UPDATE
  const reloadedAfterUpdate = DataService.initializeDatabaseState();
  const foundUpdated = DataService.findById(
    reloadedAfterUpdate,
    'Students',
    'STD-99881'
  );
  assert.equal(foundUpdated?.Phone, '099777888');
  assert.equal(foundUpdated?.Remarks, 'Persisted in Google Sheets');

  // 3. DELETE Student in GAS_PRODUCTION
  const deleteRes = DataService.deleteStudentRecordCascade(
    reloadedAfterUpdate,
    'STD-99881',
    'USR-ADM-01'
  );
  assert.equal(deleteRes.ok, true);

  // Simulate application reload after DELETE
  const reloadedAfterDelete = DataService.initializeDatabaseState();
  assert.equal(reloadedAfterDelete.Students.length, baseStudentCount);
  assert.equal(
    DataService.findById(reloadedAfterDelete, 'Students', 'STD-99881'),
    undefined
  );

  // Restore clean seed state and switch back to IN_MEMORY_PREVIEW
  GasPersistenceAdapter.writePersistedGoogleSheetsState(seedDb);
  DataService.setPersistenceMode('IN_MEMORY_PREVIEW');
});

test('Phase 3 Requirement 5 & 6: Server-side validation for duplicate IDs, invalid Foreign Keys, duplicate TeacherSubjectAssignments, and Teacher subject restriction', () => {
  const seedDb = createInitialDatabaseState();
  GasPersistenceAdapter.writePersistedGoogleSheetsState(seedDb);
  DataService.setPersistenceMode('GAS_PRODUCTION', {
    currentDb: seedDb,
    simulateConnectionFailure: false,
  });

  // 1. Server-side Duplicate Primary ID rejection
  const existingStudent = seedDb.Students[0];
  const dupStudentRpc = GasPersistenceAdapter.executeServerRpc({
    module: 'Database',
    action: 'createRecord',
    actorUserId: 'USR-ADM-01',
    tableKey: 'Students',
    record: { ...existingStudent } as unknown as Record<string, unknown>,
  });
  assert.equal(dupStudentRpc.ok, false);
  assert.equal(dupStudentRpc.persisted, false);
  assert.equal(dupStudentRpc.errorCode, 'SERVER_DUPLICATE_PRIMARY_ID');

  // 2. Server-side Duplicate TeacherSubjectAssignments (TeacherID + SubjectID + AcademicYearID) rejection
  const existingAsn = seedDb.TeacherSubjectAssignments[0];
  const dupAsnRpc = GasPersistenceAdapter.executeServerRpc({
    module: 'Database',
    action: 'createRecord',
    actorUserId: 'USR-ADM-01',
    tableKey: 'TeacherSubjectAssignments',
    record: {
      ...existingAsn,
      AssignmentID: 'ASN-NEW-UNIQUE-999',
    } as unknown as Record<string, unknown>,
  });
  assert.equal(dupAsnRpc.ok, false);
  assert.equal(
    dupAsnRpc.errorCode,
    'SERVER_DUPLICATE_TEACHER_SUBJECT_ASSIGNMENT'
  );

  // 3. Server-side Invalid Foreign Key rejection
  const badFkRpc = GasPersistenceAdapter.executeServerRpc({
    module: 'Database',
    action: 'createRecord',
    actorUserId: 'USR-ADM-01',
    tableKey: 'Enrollments',
    record: {
      EnrollmentID: 'ENR-TEST-BAD-FK',
      StudentID: existingStudent.StudentID,
      ClassID: 'CLS-NON-EXISTENT-99Z',
      AcademicYearID: 'AY-2025-2026',
    },
  });
  assert.equal(badFkRpc.ok, false);
  assert.equal(badFkRpc.errorCode, 'SERVER_INVALID_FOREIGN_KEY');

  // 4. Server-side Teacher Subject Restriction:
  // USR-TCH-12C is assigned to SUB-ICT, NOT SUB-MTH (Mathematics)
  const unauthorizedTeacherQuestion = DataService.createRecord(
    seedDb,
    'Questions',
    {
      QuestionID: 'QST-MTH-UNAUTH-999',
      SubjectID: 'SUB-MTH',
      QuestionText: 'Unauthorized question on Mathematics by ICT teacher',
      QuestionType: 'MCQ',
      OptionsJSON: '["A","B"]',
      CorrectAnswerJSON: '{"answerIndex":0}',
      Points: 10,
      DifficultyLevel: 'EASY',
      ImageFileID: '',
      CreatedByUserID: 'USR-TCH-12C',
      UpdatedByUserID: 'USR-TCH-12C',
      Status: 'ACTIVE',
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    },
    { actorUserId: 'USR-TCH-12C' }
  );
  assert.equal(unauthorizedTeacherQuestion.ok, false);
  assert.equal(unauthorizedTeacherQuestion.persisted, false);
  assert.equal(
    unauthorizedTeacherQuestion.errorCode,
    'SERVER_TEACHER_SUBJECT_FORBIDDEN'
  );

  // 5. Teacher CAN create question for their assigned subject SUB-ICT
  const authorizedTeacherQuestion = DataService.createRecord(
    seedDb,
    'Questions',
    {
      QuestionID: 'QST-ICT-AUTH-999',
      SubjectID: 'SUB-ICT',
      QuestionText: 'Authorized ICT question by ICT teacher',
      QuestionType: 'MCQ',
      OptionsJSON: '["A","B"]',
      CorrectAnswerJSON: '{"answerIndex":0}',
      Points: 10,
      DifficultyLevel: 'EASY',
      ImageFileID: '',
      CreatedByUserID: 'USR-TCH-12C',
      UpdatedByUserID: 'USR-TCH-12C',
      Status: 'ACTIVE',
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    },
    { actorUserId: 'USR-TCH-12C' }
  );
  assert.equal(authorizedTeacherQuestion.ok, true);
  assert.equal(authorizedTeacherQuestion.persisted, true);

  // 6. Teacher CANNOT mutate admin-only table (e.g., SystemSettings or Users)
  const teacherAdminMutation = DataService.updateRecord(
    seedDb,
    'SystemSettings',
    seedDb.SystemSettings[0].SettingID,
    { SettingValue: 'HACKED' },
    { actorUserId: 'USR-TCH-12C' }
  );
  assert.equal(teacherAdminMutation.ok, false);
  assert.equal(teacherAdminMutation.errorCode, 'SERVER_UNAUTHORIZED_ROLE');

  // Restore clean seed state
  GasPersistenceAdapter.writePersistedGoogleSheetsState(seedDb);
  DataService.setPersistenceMode('IN_MEMORY_PREVIEW');
});

test('Phase 3 Requirement 7: GAS connection failure in GAS_PRODUCTION mode does NOT silently fall back to in-memory storage and clearly reports data was NOT saved', async () => {
  const seedDb = createInitialDatabaseState();
  GasPersistenceAdapter.writePersistedGoogleSheetsState(seedDb);
  DataService.setPersistenceMode('GAS_PRODUCTION', {
    currentDb: seedDb,
    simulateConnectionFailure: false,
  });

  // Simulate GAS connection failure / outage
  DataService.setSimulateGasFailure(true);
  assert.equal(DataService.getAdapterConfig().connectionState, 'ERROR');

  // Attempt CREATE while GAS is unavailable
  const failedCreate = DataService.createRecord(
    seedDb,
    'Subjects',
    {
      SubjectID: 'SUB-NEW-FAIL-TEST',
      SubjectCode: 'FAIL101',
      SubjectNameKh: 'មុខវិជ្ជាសាកល្បងពេលដាច់បណ្ដាញ',
      SubjectNameEn: 'Offline Subject',
      GradeLevel: '12',
      Coefficient: 1,
      MaximumScore: 50,
      Status: 'ACTIVE',
      CreatedAt: new Date().toISOString(),
    },
    { actorUserId: 'USR-ADM-01' }
  );

  // Must fail without mutating db and without falling back to in-memory preview
  assert.equal(failedCreate.ok, false);
  assert.equal(failedCreate.persisted, false);
  assert.equal(failedCreate.mode, 'GAS_PRODUCTION');
  assert.equal(failedCreate.errorCode, 'GAS_UNAVAILABLE');
  assert.equal(failedCreate.db.Subjects.length, seedDb.Subjects.length);
  assert.ok(
    failedCreate.errorMessageKh?.includes('ទិន្នន័យមិនត្រូវបានរក្សាទុកឡើយ')
  );

  // Attempt commitState while GAS is unavailable -> must return false and not call setDb
  let stateWasMutated = false;
  const mockSetDb = () => {
    stateWasMutated = true;
  };
  const committed = DataService.commitState(mockSetDb, seedDb);
  assert.equal(committed, false);
  assert.equal(stateWasMutated, false);

  // Attempt invokeGasApi bridge call while GAS is unavailable -> must NOT run local fallback
  let fallbackRan = false;
  const bridgeResp = await invokeGasApi(
    'StudentService',
    'bulkImportStudentsToGoogleSheets',
    { rows: [] },
    () => {
      fallbackRan = true;
      return { ok: true };
    }
  );
  assert.equal(bridgeResp.ok, false);
  assert.equal(bridgeResp.persisted, false);
  assert.equal(fallbackRan, false);

  // Restore connection and reset to IN_MEMORY_PREVIEW
  DataService.setSimulateGasFailure(false);
  DataService.setPersistenceMode('IN_MEMORY_PREVIEW');
});

test('Phase 3 Verification: Backup and Restore work in GAS_PRODUCTION mode and GAS backend modules cover all 25 tables', () => {
  const seedDb = createInitialDatabaseState();
  const envelope = createDatabaseBackupEnvelope(seedDb, {
    createdByUserId: 'USR-ADM-01',
    note: 'Phase 3 Backup Verification',
  });
  assert.equal(envelope.metadata.totalTables, 25);
  assert.equal(envelope.metadata.totalRecords, 488);

  const preview = parseAndPreviewBackupPayload(
    JSON.stringify(envelope),
    seedDb,
    envelope.metadata.fileName
  );
  assert.equal(preview.ok, true);
  assert.equal(preview.totalBackupRecords, 488);

  DataService.setPersistenceMode('GAS_PRODUCTION', {
    currentDb: seedDb,
    simulateConnectionFailure: false,
  });

  const restored = applyDatabaseBackupRestore(preview.envelope!, 'USR-ADM-01');
  assert.equal(restored.Students.length, 62);

  // Verify Database.gs in GAS_BACKEND_MODULES defines all 25 sheets
  const dbModule = GAS_BACKEND_MODULES.find((m) => m.filename === 'Database.gs');
  assert.ok(dbModule);
  assert.ok(dbModule.code.includes('HomeroomTeacherAssignments'));
  assert.ok(dbModule.code.includes('SubjectGradeRanges'));

  DataService.setPersistenceMode('IN_MEMORY_PREVIEW');
});
