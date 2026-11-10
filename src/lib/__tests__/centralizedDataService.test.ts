import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDatabaseState } from '../seedData';
import { generateDatabaseValidationReport } from '../databaseBackupService';
import {
  DataService,
  TABLE_PRIMARY_KEY_MAP,
  validateForeignKeyRelationships,
  validatePrimaryIdNotDuplicate,
  validateTeacherSubjectAssignmentCombination,
} from '../centralizedDataService';

test('Centralized Data Service covers all 25 tables and preserves all 488 existing seed records & 11 warnings', () => {
  const db = createInitialDatabaseState();
  const descriptors = DataService.getTableDescriptors();

  assert.equal(descriptors.length, 25);
  assert.equal(Object.keys(TABLE_PRIMARY_KEY_MAP).length, 25);

  let totalRecords = 0;
  for (const desc of descriptors) {
    const rows = DataService.readTable(db, desc.key);
    totalRecords += rows.length;
  }
  assert.equal(totalRecords, 488);

  const validation = generateDatabaseValidationReport(db);
  assert.equal(validation.totalTablesExpected, 25);
  assert.equal(validation.totalRecords, 488);
  assert.equal(validation.duplicateIds.length, 0);
  assert.equal(validation.invalidReferences.length, 11);
});

test('READ operations: readTable, findById, and findWhere work across core and extended tables', () => {
  const db = createInitialDatabaseState();
  const firstStudent = db.Students[0];

  const student = DataService.findById(db, 'Students', firstStudent.StudentID);
  assert.ok(student);
  assert.equal(student.StudentCode, firstStudent.StudentCode);

  const firstTeacher = db.Users[0];
  const teacher = DataService.findById(db, 'Users', firstTeacher.UserID);
  assert.ok(teacher);
  assert.equal(teacher.Username, firstTeacher.Username);

  const class12CEnrollments = DataService.findWhere(
    db,
    'Enrollments',
    (e) => e.ClassID === 'CLS-12C'
  );
  assert.ok(class12CEnrollments.length > 0);
});

test('CREATE duplicate Primary ID validation rejects existing Primary IDs across tables', () => {
  const db = createInitialDatabaseState();
  const existingStudent = db.Students[0];

  const dupCheck = validatePrimaryIdNotDuplicate(
    db,
    'Students',
    existingStudent as unknown as Record<string, unknown>
  );
  assert.equal(dupCheck.valid, false);
  assert.equal(dupCheck.errorCode, 'DUPLICATE_PRIMARY_ID');

  const createAttempt = DataService.createRecord(
    db,
    'Students',
    existingStudent
  );
  assert.equal(createAttempt.ok, false);
  assert.equal(createAttempt.errorCode, 'DUPLICATE_PRIMARY_ID');
  assert.equal(createAttempt.db.Students.length, db.Students.length);
});

test('CREATE and UPDATE foreign-key relationship validation rejects invalid references', () => {
  const db = createInitialDatabaseState();

  // Attempt to create a Class with a non-existent AcademicYearID
  const invalidClass = {
    ...db.Classes[0],
    ClassID: 'CLS-99Z',
    AcademicYearID: 'AY-NON-EXISTENT',
  };
  const fkCheck = validateForeignKeyRelationships(
    db,
    'Classes',
    invalidClass as unknown as Record<string, unknown>
  );
  assert.equal(fkCheck.valid, false);
  assert.equal(fkCheck.failedField, 'AcademicYearID');

  const createRes = DataService.createRecord(db, 'Classes', invalidClass);
  assert.equal(createRes.ok, false);
  assert.equal(createRes.errorCode, 'INVALID_FOREIGN_KEY');

  // Attempt to update an existing Enrollment to point to a non-existent ClassID
  const updateRes = DataService.updateRecord(
    db,
    'Enrollments',
    db.Enrollments[0].EnrollmentID,
    { ClassID: 'CLS-INVALID-999' }
  );
  assert.equal(updateRes.ok, false);
  assert.equal(updateRes.errorCode, 'INVALID_FOREIGN_KEY');
});

test('Prevents duplicate TeacherSubjectAssignments using TeacherID + SubjectID + AcademicYearID combination', () => {
  const db = createInitialDatabaseState();
  const existingAsn = db.TeacherSubjectAssignments[0];

  // Same TeacherID + SubjectID + AcademicYearID, even with a brand new AssignmentID and different ClassID
  const combCheck = validateTeacherSubjectAssignmentCombination(db, {
    TeacherID: existingAsn.TeacherID,
    SubjectID: existingAsn.SubjectID,
    AcademicYearID: existingAsn.AcademicYearID,
  });
  assert.equal(combCheck.valid, false);
  assert.equal(
    combCheck.existingDuplicate?.AssignmentID,
    existingAsn.AssignmentID
  );

  const assignAttempt = DataService.assignTeacherSubjectRecord(
    db,
    {
      teacherId: existingAsn.TeacherID,
      subjectId: existingAsn.SubjectID,
      classId: 'CLS-12B',
      academicYearId: existingAsn.AcademicYearID,
    },
    'USR-ADM-01'
  );
  assert.equal(assignAttempt.ok, false);
  assert.equal(
    assignAttempt.errorCode,
    'DUPLICATE_TEACHER_SUBJECT_ASSIGNMENT'
  );
  assert.equal(
    assignAttempt.db.TeacherSubjectAssignments.length,
    db.TeacherSubjectAssignments.length
  );

  // Pick a real SubjectID from db.Subjects that existingAsn.TeacherID is not yet assigned to in existingAsn.AcademicYearID
  const unassignedSubject = db.Subjects.find(
    (s) =>
      !db.TeacherSubjectAssignments.some(
        (a) =>
          a.TeacherID === existingAsn.TeacherID &&
          a.SubjectID === s.SubjectID &&
          a.AcademicYearID === existingAsn.AcademicYearID
      )
  )!;

  // Valid new TeacherID + SubjectID + AcademicYearID combination succeeds
  const validAssign = DataService.assignTeacherSubjectRecord(
    db,
    {
      teacherId: existingAsn.TeacherID,
      subjectId: unassignedSubject.SubjectID,
      classId: 'CLS-12A',
      academicYearId: existingAsn.AcademicYearID,
    },
    'USR-ADM-01'
  );
  assert.equal(validAssign.ok, true);
  assert.equal(
    validAssign.db.TeacherSubjectAssignments.length,
    db.TeacherSubjectAssignments.length + 1
  );
});

test('CRUD lifecycle: createRecord, updateRecord, deleteRecord, and cascade helpers work cleanly', () => {
  const db = createInitialDatabaseState();

  // 1. Add student cascade
  const addRes = DataService.addStudentRecordCascade(
    db,
    {
      studentCode: '2526-9999',
      lastNameKh: 'សុខ',
      firstNameKh: 'ពិសិដ្ឋ',
      familyNameEn: 'SOK',
      givenNameEn: 'PISETH',
      gender: 'ប្រុស',
      dateOfBirth: '2008-05-12',
      phone: '012999888',
      village: 'ទឹកជោរ',
      classId: 'CLS-12A',
      orphanStatus: 'NONE',
      disabilityStatus: 'NONE',
      povertyLevel: 'NONE',
      previousSchool: 'អនុវិទ្យាល័យទឹកជោរ',
      monthlyAverage: 42.5,
    },
    'USR-ADM-01'
  );
  assert.equal(addRes.ok, true);
  assert.equal(addRes.db.Students.length, db.Students.length + 1);
  assert.equal(addRes.db.Enrollments.length, db.Enrollments.length + 1);

  // 2. Duplicate student code fails
  const dupStudentRes = DataService.addStudentRecordCascade(
    addRes.db,
    {
      studentCode: '2526-9999',
      lastNameKh: 'សុខ',
      firstNameKh: 'ពិសិដ្ឋ',
      familyNameEn: 'SOK',
      givenNameEn: 'PISETH',
      gender: 'ប្រុស',
      dateOfBirth: '2008-05-12',
      phone: '012999888',
      village: 'ទឹកជោរ',
      classId: 'CLS-12A',
      orphanStatus: 'NONE',
      disabilityStatus: 'NONE',
      povertyLevel: 'NONE',
      previousSchool: 'អនុវិទ្យាល័យទឹកជោរ',
      monthlyAverage: 42.5,
    },
    'USR-ADM-01'
  );
  assert.equal(dupStudentRes.ok, false);
  assert.equal(dupStudentRes.errorCode, 'DUPLICATE_PRIMARY_ID');

  // 3. Edit student cascade
  const editRes = DataService.editStudentRecordCascade(
    addRes.db,
    'STD-2526-9999',
    {
      studentCode: '2526-9999',
      lastNameKh: 'សុខ',
      firstNameKh: 'ពិសិដ្ឋា',
      gender: 'ប្រុស',
      dateOfBirth: '2008-05-12',
      phone: '012777666',
      village: 'ទឹកជោរ',
      classId: 'CLS-12B',
      orphanStatus: 'NONE',
      disabilityStatus: 'NONE',
      povertyLevel: 'NONE',
      studentStatus: 'កំពុងរៀន',
    },
    'USR-ADM-01'
  );
  assert.equal(editRes.ok, true);
  assert.equal(editRes.record?.FirstNameKh, 'ពិសិដ្ឋា');

  // 4. Delete student cascade
  const delRes = DataService.deleteStudentRecordCascade(
    editRes.db,
    'STD-2526-9999',
    'USR-ADM-01'
  );
  assert.equal(delRes.ok, true);
  assert.equal(delRes.db.Students.length, db.Students.length);
  assert.equal(delRes.db.Enrollments.length, db.Enrollments.length);
});
