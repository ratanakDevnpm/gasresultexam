import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateStudentByIdOnly,
  authenticateUserCredentials,
  autoGradeExamSubmission,
  calculateCompetitionRanking,
  canManageQuestion,
  canStudentAccessExam,
  canTeacherManageExamAndGrading,
  computeAttemptGradingProgress,
  computeClassRosterSummary,
  computeDashboardStatistics,
  computeRankingSummaryStats,
  createOrUpdateTeacherAccount,
  DEFAULT_STUDENT_INITIAL_PASSWORD,
  formatRankingDisplayName,
  getNotificationsForRole,
  getRegisteredTeachersWithAssignments,
  getRoleAuthorizedMenus,
  getStudentClassScopedResults,
  getStudentExaminationPortalCatalog,
  getTeacherAuthorizedSubjectsAndClasses,
  getGoogleAppsScriptFormImporterCode,
  hashPasswordSha256,
  isStudentRole,
  mapGoogleFormToExamSchema,
  NOTIFICATION_CONDITIONS_CATALOG,
  parseGoogleFormImportPayload,
  provisionAllStudentAccounts,
  provisionSingleStudentAccount,
  resetStudentPasswordToDefault,
  safeAutoGradeAttemptPreservingManualScores,
  saveTeacherSubjectClassAssignments,
  setTeacherAccountStatus,
  splitRankingRowsTwoColumns,
  validateAndSaveSharedExam,
  validateStudentExamAccess,
  validateSubjectScoreInput,
  getUserEffectiveRoles,
  saveHomeroomTeacherAssignment,
  saveTeacherSpecializationsAndRoles,
  isScoreEntryPeriodLocked,
  setScoreEntryPeriodLock,
  canManageStudentScore,
  upsertStudentSubjectScoreAndRecalculate,
  getHomeroomTeacherDashboardData,
  SUBJECT_MANAGEMENT_SUBMENUS,
  SCORE_MANAGEMENT_SUBMENUS,
  getRoleSidebarModules,
  canAccessSubjectManagement,
  saveSubjectAcademicConfiguration,
  saveGradeRangeConfiguration,
  getScoreSubmissionRecord,
  canAccessScoreManagementOperation,
  transitionScoreSubmissionWorkflow,
  getScoreManagementAuthorizedScope,
  getClassStudentSubjectScoreMatrix,
  computeSynchronizedDashboardData,
  SIDEBAR_9_GROUPS_CATALOG,
  getAuthorizedSidebar9Groups,
  REPORT_CATEGORIES_CATALOG,
  generateCategorizedReportData,
} from './domainRules';
import { createInitialDatabaseState, DEFAULT_DEMO_PASSWORD } from './seedData';
import { DATABASE_SHEETS_SCHEMA, OFFICIAL_36_COLUMN_MASTER_ROSTER_HEADERS } from './schemaDefinitions';
import { GAS_BACKEND_MODULES } from './gasBackendModules';
import { formatKhmerReportTitle, handleGlobalPrint } from '../utils/printHelper';
import {
  getSample36ColumnTemplateRows,
  mapRawRowsToStudentImportRows,
  parsePastedSpreadsheetText,
} from '../utils/studentExcelImportHelper';

test('Database Foundation has exactly 19 sheets and 36-column master roster headers', () => {
  assert.equal(DATABASE_SHEETS_SCHEMA.length, 19);
  assert.equal(OFFICIAL_36_COLUMN_MASTER_ROSTER_HEADERS.length, 36);

  const db = createInitialDatabaseState();
  assert.equal(db.Classes.length, 17); // 7A-7C, 8A-8C, 9A-9B, 10A-10C, 11A-11C, 12A-12C
  const class12C = db.Classes.find((c) => c.ClassName === '12C');
  assert.ok(class12C);
  assert.equal(class12C.HomeroomTeacherID, 'USR-TCH-12C'); // ជួន លីរតនៈ

  // Verify required Teok Chor High School student codes exist in seed data
  assert.ok(db.Students.some((s) => s.StudentCode === '6463' && s.FullNameKh === 'គុណ គិមឡាង'));
  assert.ok(db.Students.some((s) => s.StudentCode === '6386' && s.FullNameKh === 'គួយ ឡៅកាន'));
  assert.ok(db.Students.some((s) => s.StudentCode === '5187' && s.FullNameKh === 'រឺ យូរៀន'));
  assert.ok(db.Students.some((s) => s.StudentCode === '6435' && s.FullNameKh === 'ភឿន លីសៀន'));
  assert.ok(db.Students.some((s) => s.StudentCode === '6448' && s.FullNameKh === 'សម្បត្តិ លីស្សា'));
  assert.ok(db.Students.some((s) => s.StudentCode === '6426' && s.FullNameKh === 'មេឃ សីហាក់'));
  assert.ok(db.Students.some((s) => s.StudentCode === '6648' && s.FullNameKh === 'កឹង កន្និកា'));
});

test('Phase 2 Authentication verifies SHA-256(password + PasswordSalt) for Staff and StudentCode (6463, 6648)', () => {
  const db = createInitialDatabaseState();

  // 1. Homeroom teacher login via Username
  const teacherAuth = authenticateUserCredentials(
    'chuon.lyratanak',
    DEFAULT_DEMO_PASSWORD,
    db.Users,
    db.Roles,
    db.Students
  );
  assert.equal(teacherAuth.ok, true);
  assert.equal(teacherAuth.portalRoute, 'TEACHER_PORTAL');
  assert.equal(teacherAuth.user?.FullNameKh, 'ជួន លីរតនៈ');

  // 2. Student login via StudentCode 6463 (12C)
  const student12CAuth = authenticateUserCredentials(
    '6463',
    DEFAULT_DEMO_PASSWORD,
    db.Users,
    db.Roles,
    db.Students
  );
  assert.equal(student12CAuth.ok, true);
  assert.equal(student12CAuth.portalRoute, 'STUDENT_PORTAL');
  assert.equal(student12CAuth.user?.FullNameKh, 'គុណ គិមឡាង');

  // 3. Student login via StudentCode 6648 (7A)
  const student7AAuth = authenticateUserCredentials(
    '6648',
    DEFAULT_DEMO_PASSWORD,
    db.Users,
    db.Roles,
    db.Students
  );
  assert.equal(student7AAuth.ok, true);
  assert.equal(student7AAuth.portalRoute, 'STUDENT_PORTAL');
  assert.equal(student7AAuth.user?.FullNameKh, 'កឹង កន្និកា');

  // 4. Reject invalid password
  const badAuth = authenticateUserCredentials(
    'chuon.lyratanak',
    'WrongPassword!',
    db.Users,
    db.Roles,
    db.Students
  );
  assert.equal(badAuth.ok, false);

  // 5. Verify no plaintext passwords in Users table
  for (const user of db.Users) {
    assert.notEqual(user.PasswordHash, DEFAULT_DEMO_PASSWORD);
    assert.equal(user.PasswordHash.length, 64);
    assert.equal(user.PasswordHash, hashPasswordSha256(DEFAULT_DEMO_PASSWORD, user.PasswordSalt));
  }
});

test('Backend architecture contains all required .gs modules including StudentAccountService.gs', () => {
  assert.ok(GAS_BACKEND_MODULES.length >= 17);
  const filenames = GAS_BACKEND_MODULES.map((m) => m.filename);
  assert.ok(filenames.includes('Code.gs'));
  assert.ok(filenames.includes('Authorization.gs'));
  assert.ok(filenames.includes('QuestionService.gs'));
  assert.ok(filenames.includes('ScoreService.gs'));
  assert.ok(filenames.includes('ReportService.gs'));
  assert.ok(filenames.includes('StudentAccountService.gs'));
});

test('canManageQuestion enforces strict SubjectID + CreatedByUserID ownership for TEACHER', () => {
  const db = createInitialDatabaseState();
  const ctx = {
    users: db.Users,
    roles: db.Roles,
    assignments: db.TeacherSubjectAssignments,
    questions: db.Questions,
    classes: db.Classes,
  };

  // 1. Teacher ជួន លីរតនៈ (USR-TCH-12C) can EDIT his own ICT question (QST-ICT-001)
  const ownIctCheck = canManageQuestion('USR-TCH-12C', 'QST-ICT-001', 'EDIT', ctx);
  assert.equal(ownIctCheck.allowed, true);

  // 2. Teacher ជួន លីរតនៈ CANNOT edit Math Teacher's question (QST-MATH-001)
  const otherTeacherCheck = canManageQuestion('USR-TCH-12C', 'QST-MATH-001', 'EDIT', ctx);
  assert.equal(otherTeacherCheck.allowed, false);

  // 3. Teacher ជួន លីរតនៈ CANNOT create a question in an unassigned subject (SUB-ENG)
  const unassignedCreateCheck = canManageQuestion('USR-TCH-12C', null, 'CREATE', ctx, 'SUB-ENG');
  assert.equal(unassignedCreateCheck.allowed, false);

  // 4. SUPER_ADMIN can manage any teacher's question
  const superAdminCheck = canManageQuestion('USR-SUP-01', 'QST-MATH-001', 'DELETE', ctx);
  assert.equal(superAdminCheck.allowed, true);

  // 5. STUDENT is strictly denied
  const studentCheck = canManageQuestion('USR-STD-6463', 'QST-ICT-001', 'VIEW', ctx);
  assert.equal(studentCheck.allowed, false);
});

test('Phase 6 & 7: Class 12C (56 students, 26 females) verifies exact competition tie-ranking (Rank 6->8, Rank 13->15, Rank 42->44), ក. female prefix, and -1.72 unranked at Rank 51', () => {
  const db = createInitialDatabaseState();
  const class12CScores = db.MonthlyScores.filter((m) => m.ClassID === 'CLS-12C');
  assert.equal(class12CScores.length, 56);

  const rawInputs = class12CScores.map((m) => {
    const st = db.Students.find((s) => s.StudentID === m.StudentID)!;
    return {
      studentId: st.StudentID,
      studentCode: st.StudentCode,
      lastNameKh: st.LastNameKh,
      firstNameKh: st.FirstNameKh,
      gender: st.Gender,
      averageScore: m.AverageScore,
    };
  });

  const ranked = calculateCompetitionRanking(rawInputs, 50);
  const stats = computeRankingSummaryStats(ranked);

  // 1. Total 56 students, 26 females in Class 12C
  assert.equal(stats.totalStudents.total, 56);
  assert.equal(stats.totalStudents.female, 26);

  // 2. Female prefix rule & Top 5 Honor Roll names: ក. រឺ យូរៀន, មេឃ សីហាក់, ក. ភឿន លីសៀន, លឿន វិសាល, ក. ភើយ ឡាពីន
  assert.equal(formatRankingDisplayName('រឺ', 'យូរៀន', 'ស្រី'), 'ក. រឺ យូរៀន');
  assert.equal(formatRankingDisplayName('ភឿន', 'លីសៀន', 'ស្រី'), 'ក. ភឿន លីសៀន');
  assert.equal(formatRankingDisplayName('សម្បត្តិ', 'លីស្សា', 'ស្រី'), 'ក. សម្បត្តិ លីស្សា');
  assert.equal(ranked[0].displayNameRanking, 'ក. រឺ យូរៀន');
  assert.equal(ranked[1].displayNameRanking, 'មេឃ សីហាក់');
  assert.equal(ranked[2].displayNameRanking, 'ក. ភឿន លីសៀន');
  assert.equal(ranked[3].displayNameRanking, 'លឿន វិសាល');
  assert.equal(ranked[4].displayNameRanking, 'ក. ភើយ ឡាពីន');
  assert.equal(ranked[7].displayNameRanking, 'ក. សម្បត្តិ លីស្សា');

  // 3. Competition Tie-Ranking:
  // Rank 6 for 34.76 (2 students: indices 5 & 6) -> next is Rank 8 (index 7)
  assert.equal(ranked[5].averageScore, 34.76);
  assert.equal(ranked[6].averageScore, 34.76);
  assert.equal(ranked[5].ranking, 6);
  assert.equal(ranked[6].ranking, 6);
  assert.equal(ranked[7].ranking, 8);

  // Rank 13 for 31.31 (2 students: indices 12 & 13) -> next is Rank 15 (index 14)
  assert.equal(ranked[12].averageScore, 31.31);
  assert.equal(ranked[13].averageScore, 31.31);
  assert.equal(ranked[12].ranking, 13);
  assert.equal(ranked[13].ranking, 13);
  assert.equal(ranked[14].ranking, 15);

  // Rank 42 for 24.69 (2 students: indices 41 & 42) -> next is Rank 44 (index 43)
  assert.equal(ranked[41].averageScore, 24.69);
  assert.equal(ranked[42].averageScore, 24.69);
  assert.equal(ranked[41].ranking, 42);
  assert.equal(ranked[42].ranking, 42);
  assert.equal(ranked[43].ranking, 44);

  // 4. Unranked (-1.72) handling: 6 students (indices 50..55) have Grade = "មិនចាត់ថ្នាក់" and bottomGroupRank = 51
  assert.equal(stats.unranked.total, 6);
  assert.equal(ranked[50].isUnranked, true);
  assert.equal(ranked[50].averageScore, -1.72);
  assert.equal(ranked[50].grade, 'មិនចាត់ថ្នាក់');
  assert.equal(ranked[50].bottomGroupRank, 51);

  // 5. Top 5 Honor Roll Flag (IsHonorRoll)
  const honorRollCount = ranked.filter((r) => r.isHonorRoll).length;
  assert.equal(honorRollCount, 5);
});

test('Phase 5 & 6: autoGradeExamSubmission and validateSubjectScoreInput enforce grading and score limits', () => {
  const db = createInitialDatabaseState();
  const ictQuestions = db.Questions.filter(
    (q) => q.SubjectID === 'SUB-ICT' && (q.ExamMonth ?? 'វិច្ឆិកា') === 'វិច្ឆិកា'
  );
  assert.equal(ictQuestions.length, 5);

  // Verify Monthly Question Bank has questions across តុលា, វិច្ឆិកា, ធ្នូ, and ឆមាសទី១
  const monthsPresent = new Set(db.Questions.map((q) => q.ExamMonth));
  assert.ok(monthsPresent.has('តុលា'));
  assert.ok(monthsPresent.has('វិច្ឆិកា'));
  assert.ok(monthsPresent.has('ធ្នូ'));
  assert.ok(monthsPresent.has('ឆមាសទី១'));

  // Auto-grade MCQ + TRUE_FALSE and queue SHORT_ANSWER + ESSAY
  const summary = autoGradeExamSubmission(ictQuestions, {
    'QST-ICT-001': { questionId: 'QST-ICT-001', selectedIndex: 0 }, // Correct (10 pts)
    'QST-ICT-002': { questionId: 'QST-ICT-002', selectedIndex: 1 }, // Correct (10 pts)
    'QST-ICT-003': { questionId: 'QST-ICT-003', booleanAnswer: true }, // Correct (10 pts)
    'QST-ICT-004': { questionId: 'QST-ICT-004', textAnswer: 'SHA-256' }, // Manual queue (10 pts)
    'QST-ICT-005': { questionId: 'QST-ICT-005', textAnswer: 'Normalized 19 sheets' }, // Manual queue (10 pts)
  });

  assert.equal(summary.autoGradedPoints, 30);
  assert.equal(summary.pendingManualPoints, 20);
  assert.equal(summary.hasPendingManualQuestions, true);
  assert.equal(summary.attemptStatus, 'SUBMITTED');

  // Score validation against Subject.MaximumScore
  assert.equal(validateSubjectScoreInput(48, 50).valid, true);
  assert.equal(validateSubjectScoreInput(55, 50).valid, false); // Exceeds MaximumScore 50
  assert.equal(validateSubjectScoreInput(-1.72, 50, true).valid, true); // Sentinel -1.72 allowed

  // 2-column split verification
  const class12CStudents = db.Students.filter((s) =>
    db.Enrollments.some((e) => e.StudentID === s.StudentID && e.ClassID === 'CLS-12C')
  );
  const rosterSummary = computeClassRosterSummary(class12CStudents, 2026);
  assert.equal(rosterSummary.totalStudents.total, 56);
  assert.equal(rosterSummary.totalStudents.female, 26);

  const split = splitRankingRowsTwoColumns(
    calculateCompetitionRanking(
      class12CStudents.map((s) => ({
        studentId: s.StudentID,
        studentCode: s.StudentCode,
        lastNameKh: s.LastNameKh,
        firstNameKh: s.FirstNameKh,
        gender: s.Gender,
        averageScore: 30,
      })),
      50
    )
  );
  assert.equal(split.leftColumn.length, 35);
  assert.equal(split.rightColumn.length, 35);
});

test('Automated Student Account Setup provisions 49 active Class 12C accounts with StudentCode as Username, SHA-256 + Salt hash, and supports password reset & student 6463 login', () => {
  const db = createInitialDatabaseState();

  // 1. Provision single student account for Student 6386 (គួយ ឡៅកាន)
  const singleRes = provisionSingleStudentAccount('STD-6386', db.Students, db.Users, {
    defaultPassword: DEFAULT_STUDENT_INITIAL_PASSWORD,
    overwriteExisting: true,
  });
  assert.equal(singleRes.status, 'CREATED');
  assert.equal(singleRes.user?.Username, '6386');
  assert.equal(singleRes.user?.RoleID, 'ROL-04');
  assert.equal(singleRes.user?.Status, 'ACTIVE');
  assert.notEqual(singleRes.user?.PasswordHash, DEFAULT_STUDENT_INITIAL_PASSWORD);
  assert.equal(
    singleRes.user?.PasswordHash,
    hashPasswordSha256(DEFAULT_STUDENT_INITIAL_PASSWORD, singleRes.user!.PasswordSalt)
  );

  // 2. Bulk provision all remaining unprovisioned students in Class 12C (49 newly created + 7 already existing = 56 total)
  const bulk12C = provisionAllStudentAccounts(
    'AY-2025-2026',
    'CLS-12C',
    db.Students,
    db.Enrollments,
    db.Users,
    {
      defaultPassword: DEFAULT_STUDENT_INITIAL_PASSWORD,
      overwriteExisting: false,
      actorUserId: 'USR-SUP-01',
      onlyActiveStudents: true,
    }
  );
  assert.equal(bulk12C.totalProcessed, 56);
  assert.equal(bulk12C.successfullyCreated, 49);
  assert.equal(bulk12C.skippedAlreadyExists, 7);
  assert.equal(bulk12C.errors, 0);

  // Verify no plaintext passwords in updatedUsers
  for (const u of bulk12C.updatedUsers) {
    assert.notEqual(u.PasswordHash, DEFAULT_STUDENT_INITIAL_PASSWORD);
    assert.equal(u.PasswordHash.length, 64);
  }

  // 3. Verify Student 6463 can log into Student Portal using StudentCode '6463' and default password
  const login6463 = authenticateUserCredentials(
    '6463',
    DEFAULT_STUDENT_INITIAL_PASSWORD,
    bulk12C.updatedUsers,
    db.Roles,
    db.Students
  );
  assert.equal(login6463.ok, true);
  assert.equal(login6463.portalRoute, 'STUDENT_PORTAL');
  assert.equal(login6463.user?.Username, '6463');
  assert.equal(login6463.user?.FullNameKh, 'គុណ គិមឡាង');

  // 4. Verify resetStudentPasswordToDefault by Admin and deny by Teacher
  const teacherDeniedReset = resetStudentPasswordToDefault(
    '6463',
    'USR-TCH-12C',
    bulk12C.updatedUsers,
    db.Roles,
    db.Students
  );
  assert.equal(teacherDeniedReset.ok, false);

  const adminReset = resetStudentPasswordToDefault(
    '6463',
    'USR-SUP-01',
    bulk12C.updatedUsers,
    db.Roles,
    db.Students,
    'TeokChor@2027'
  );
  assert.equal(adminReset.ok, true);
  assert.ok(adminReset.auditLogRecord);
  const loginAfterReset = authenticateUserCredentials(
    '6463',
    'TeokChor@2027',
    adminReset.updatedUsers,
    db.Roles,
    db.Students
  );
  assert.equal(loginAfterReset.ok, true);
});

test('Global Print Helper (printHelper.ts) formats standardized Khmer report name, class, and academic year titles', () => {
  const masterTitle = formatKhmerReportTitle({
    reportNameKh: 'បញ្ជីសិស្សសរុប',
    className: '12C',
    academicYear: '២០២៥-២០២៦',
  });
  assert.equal(
    masterTitle,
    'បញ្ជីសិស្សសរុប_ថ្នាក់ទី_12C_ឆ្នាំសិក្សា_២០២៥-២០២៦_វិទ្យាល័យទឹកជោរ'
  );

  const rankingTitle = formatKhmerReportTitle({
    reportNameKh: 'តារាងចំណាត់ថ្នាក់ប្រចាំខែ',
    className: '12C',
    academicYear: '២០២៦-២០២៧',
    extraContext: 'វិច្ឆិកា',
  });
  assert.equal(
    rankingTitle,
    'តារាងចំណាត់ថ្នាក់ប្រចាំខែ_វិច្ឆិកា_ថ្នាក់ទី_12C_ឆ្នាំសិក្សា_២០២៦-២០២៧_វិទ្យាល័យទឹកជោរ'
  );

  const transcriptTitle = formatKhmerReportTitle({
    reportNameKh: 'ព្រឹត្តិបត្រពិន្ទុសិស្ស',
    className: '12C',
    academicYear: '២០២៥-២០២៦',
    extraContext: 'រឺ យូរៀន',
  });
  assert.equal(
    transcriptTitle,
    'ព្រឹត្តិបត្រពិន្ទុសិស្ស_រឺ_យូរៀន_ថ្នាក់ទី_12C_ឆ្នាំសិក្សា_២០២៥-២០២៦_វិទ្យាល័យទឹកជោរ'
  );

  assert.equal(typeof handleGlobalPrint, 'function');
});

test('Student Excel Template & Bulk Import Parser maps 36-column rows and GAS StudentService supports bulkImportStudentsToGoogleSheets', () => {
  const db = createInitialDatabaseState();
  const sampleRows = getSample36ColumnTemplateRows('12C');
  assert.equal(sampleRows.length, 3);
  assert.equal(sampleRows[0].length, 36);

  const headers = OFFICIAL_36_COLUMN_MASTER_ROSTER_HEADERS.map((h) => h.khmerHeader);
  const existingCodes = new Set(db.Students.map((s) => s.StudentCode));
  const parsed = mapRawRowsToStudentImportRows(
    [headers, ...sampleRows],
    'CLS-12C',
    existingCodes,
    db.Classes
  );

  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].isValid, true);
  assert.equal(parsed[0].studentCode, '6801');
  assert.equal(parsed[0].lastNameKh, 'សំរិទ្ធ');
  assert.equal(parsed[0].firstNameKh, 'ចាន់ណារ៉ា');
  assert.equal(parsed[0].gender, 'ស្រី');
  assert.equal(parsed[0].classId, 'CLS-12C');
  assert.equal(parsed[0].povertyLevel, 'ក២');

  const pasted = parsePastedSpreadsheetText(
    '6899\tសុខ\tចាន់ធីតា\tស្រី\t2009-05-14\t12C\t012 345 678',
    'CLS-12C',
    existingCodes,
    db.Classes
  );
  assert.equal(pasted.length, 1);
  assert.equal(pasted[0].studentCode, '6899');
  assert.equal(pasted[0].gender, 'ស្រី');

  const studentServiceMod = GAS_BACKEND_MODULES.find((m) => m.filename === 'StudentService.gs');
  assert.ok(studentServiceMod);
  assert.ok(studentServiceMod.exportedFunctions.includes('bulkImportStudentsToGoogleSheets'));

  const codeMod = GAS_BACKEND_MODULES.find((m) => m.filename === 'Code.gs');
  assert.ok(codeMod);
  assert.ok(codeMod.exportedFunctions.includes('doPost'));
});

test('Student ID-Only Login (authenticateStudentByIdOnly) verifies active Student IDs and rejects empty or unknown IDs', () => {
  const db = createInitialDatabaseState();

  // 1. Valid active Student ID 6463 (ក. គុណ គិមឡាង)
  const valid6463 = authenticateStudentByIdOnly('6463', db.Students, db.Users, db.Roles);
  assert.equal(valid6463.ok, true);
  assert.equal(valid6463.portalRoute, 'STUDENT_PORTAL');
  assert.equal(valid6463.role?.RoleName, 'STUDENT');
  assert.equal(valid6463.studentProfile?.FullNameKh, 'គុណ គិមឡាង');

  // 2. Valid active Student ID 5187 (ក. រឺ យូរៀន)
  const valid5187 = authenticateStudentByIdOnly('5187', db.Students, db.Users, db.Roles);
  assert.equal(valid5187.ok, true);
  assert.equal(valid5187.studentProfile?.FullNameKh, 'រឺ យូរៀន');

  // 3. Empty Student ID validation
  const emptyCheck = authenticateStudentByIdOnly('   ', db.Students, db.Users, db.Roles);
  assert.equal(emptyCheck.ok, false);

  // 4. Reject unknown/arbitrary Student ID
  const unknownCheck = authenticateStudentByIdOnly('999999', db.Students, db.Users, db.Roles);
  assert.equal(unknownCheck.ok, false);
});

test('Role-Based Menu filtering (isStudentRole & getRoleAuthorizedMenus) returns ONLY "ការចូលប្រឡង" and "មើលលទ្ធផលប្រឡង" for student role', () => {
  assert.equal(isStudentRole('student'), true);
  assert.equal(isStudentRole('STUDENT'), true);
  assert.equal(isStudentRole('TEACHER'), false);
  assert.equal(isStudentRole('ADMIN'), false);

  const studentMenus = getRoleAuthorizedMenus('student');
  assert.equal(studentMenus.length, 2);
  assert.deepEqual(
    studentMenus.map((m) => m.labelKh),
    ['ការចូលប្រឡង', 'មើលលទ្ធផលប្រឡង']
  );
  assert.deepEqual(
    studentMenus.map((m) => m.id),
    ['STUDENT_TAKE_EXAM', 'STUDENT_VIEW_RESULTS']
  );

  // Teacher/Admin menus must not include student-only menu IDs and must include staff menus
  const teacherMenus = getRoleAuthorizedMenus('TEACHER');
  assert.ok(teacherMenus.some((m) => m.id === 'DASHBOARD'));
  assert.ok(teacherMenus.some((m) => m.id === 'STUDENTS'));
  assert.ok(!teacherMenus.some((m) => m.id === 'STUDENT_TAKE_EXAM'));
});

test('Online Examination Notification Conditions & Triggers (NOTIFICATION_CONDITIONS_CATALOG & getNotificationsForRole) cover Student, Teacher/Proctor, and Admin triggers', () => {
  assert.equal(NOTIFICATION_CONDITIONS_CATALOG.length, 10);

  // Student notifications cover Pre-Exam, During-Exam, and Post-Exam
  const studentNotifs = getNotificationsForRole('STUDENT');
  assert.equal(studentNotifs.length, 6);
  assert.ok(studentNotifs.some((n) => n.stage === 'PRE_EXAM'));
  assert.ok(studentNotifs.some((n) => n.stage === 'DURING_EXAM'));
  assert.ok(studentNotifs.some((n) => n.stage === 'POST_EXAM'));
  assert.ok(studentNotifs.every((n) => n.roleCategory === 'STUDENT'));

  // Teacher notifications cover Proctoring (suspicious activity) and Grading (paper submitted)
  const teacherNotifs = getNotificationsForRole('TEACHER');
  assert.equal(teacherNotifs.length, 2);
  assert.ok(teacherNotifs.some((n) => n.code === 'TCH_PROC_01_SUSPICIOUS_ACTIVITY'));
  assert.ok(teacherNotifs.some((n) => n.code === 'TCH_GRAD_02_PAPER_SUBMITTED'));

  // Admin notifications include System Admin triggers + Teacher triggers
  const adminNotifs = getNotificationsForRole('ADMIN');
  assert.equal(adminNotifs.length, 4);
  assert.ok(adminNotifs.some((n) => n.code === 'ADM_SYS_01_TECHNICAL_ALERT'));
  assert.ok(adminNotifs.some((n) => n.code === 'ADM_SYS_02_SCHEDULE_CREATED'));
});

test('getStudentClassScopedResults enforces strict role-based class data filtering and computes exact total class student counts', () => {
  const db = createInitialDatabaseState();
  const scoped = getStudentClassScopedResults(db, 'USR-STD-6463');

  assert.equal(scoped.student.StudentCode, '6463');
  assert.equal(scoped.studentClass.ClassID, 'CLS-12C');
  assert.equal(scoped.studentClass.ClassName, '12C');
  assert.equal(scoped.totalClassStudents, 56);
  assert.equal(scoped.femaleClassStudents, 26);
  assert.equal(scoped.passedClassStudents, 37);

  // Verify no scores or exams from other classes leak into the student's class-scoped view
  assert.ok(
    scoped.classMonthlyScores.every((ms) => ms.ClassID === 'CLS-12C')
  );
  assert.ok(
    scoped.classExams.every(
      (ex) =>
        ex.ClassID === 'CLS-12C' ||
        Boolean(ex.ClassIDs && ex.ClassIDs.includes('CLS-12C'))
    )
  );
  assert.equal(scoped.top5HonorStudents.length, 5);
});

test('computeDashboardStatistics supports Super Admin global view (ALL 17 classes), Class-Based filtering (12C, 12A), and Subject-by-Subject Breakdown', () => {
  const db = createInitialDatabaseState();

  // 1. Super Admin Master View across ALL 17 classes
  const globalStats = computeDashboardStatistics(db, 'USR-SUP-01', 'ALL');
  assert.equal(globalStats.isSuperAdminOrAdmin, true);
  assert.equal(globalStats.selectedClassId, 'ALL');
  assert.equal(globalStats.totalClassesCount, 17);
  assert.equal(globalStats.totalStudents, 920);
  assert.equal(globalStats.passedStudents, 764);
  assert.equal(globalStats.subjectStats.length, db.Subjects.length);
  assert.equal(globalStats.subjectStats.length, 5);

  // 2. Teacher Class-Based View for Class 12C
  const class12CStats = computeDashboardStatistics(db, 'USR-TCH-12C', 'CLS-12C');
  assert.equal(class12CStats.isTeacher, true);
  assert.equal(class12CStats.selectedClassId, 'CLS-12C');
  assert.equal(class12CStats.totalStudents, 56);
  assert.equal(class12CStats.femaleStudents, 26);
  assert.equal(class12CStats.passedStudents, 37);
  assert.equal(class12CStats.homeroomTeacherNameKh, 'ជួន លីរតនៈ');

  // Verify Teacher assigned subject flag on ICT
  const ictStat = class12CStats.subjectStats.find((s) => s.subjectId === 'SUB-ICT');
  assert.ok(ictStat);
  assert.equal(ictStat.isAssignedToActiveUser, true);
  assert.ok(ictStat.highestScore >= ictStat.lowestScore);
  assert.equal(ictStat.passRatePct + ictStat.failRatePct, 100);

  // 3. Class-Based View for Class 12A
  const class12AStats = computeDashboardStatistics(db, 'USR-SUP-01', 'CLS-12A');
  assert.equal(class12AStats.selectedClassId, 'CLS-12A');
  assert.equal(class12AStats.totalStudents, 52);
  assert.equal(class12AStats.passedStudents, 41);
});

test('Google Form Import Parser & Schema Mapper extracts Quiz Title, Subject, Duration, Questions (Short Answer & MCQ ប្រុស/ស្រី), Answer Keys, and 50 Total Points', () => {
  // 1. Parse Google Form URL for June ICT Quiz (ប្រឡងប្រចាំខែមិថុនា • ICT • ២០នាទី • 50 pts)
  const parsedJune = parseGoogleFormImportPayload(
    'https://docs.google.com/forms/d/1TeukChhouk_ICT_June_Form_2026/viewform',
    'SUB-ICT'
  );
  assert.equal(parsedJune.ok, true);
  assert.equal(parsedJune.formId, '1TeukChhouk_ICT_June_Form_2026');
  assert.equal(parsedJune.quizTitle, 'ប្រឡងប្រចាំខែមិថុនា');
  assert.equal(parsedJune.subjectCode, 'ICT');
  assert.equal(parsedJune.subjectId, 'SUB-ICT');
  assert.equal(parsedJune.durationTextKh, 'រយៈពេល ២០នាទី');
  assert.equal(parsedJune.durationMinutes, 20);
  assert.equal(parsedJune.totalPoints, 50);

  // Verify Short Answer (គោត្តនាម និងនាម) and MCQ ("ប្រុស" / "ស្រី") + Academic MCQ questions
  const genderQ = parsedJune.questions.find((q) => q.questionText.includes('ភេទ'));
  assert.ok(genderQ);
  assert.equal(genderQ.questionType, 'MCQ');
  assert.deepEqual(genderQ.options, ['ប្រុស', 'ស្រី']);

  // 2. Map parsed Google Form into ExamRecord and QuestionRecord[]
  const mapped = mapGoogleFormToExamSchema(parsedJune, {
    targetSubjectId: 'SUB-ICT',
    targetClassId: 'CLS-12C',
    actorUserId: 'USR-TCH-12C',
    includeDemographicFields: true,
    existingQuestionCount: 50,
  });
  assert.equal(mapped.examRecord.ExamTitle, 'ប្រឡងប្រចាំខែមិថុនា');
  assert.equal(mapped.examRecord.DurationMinutes, 20);
  assert.equal(mapped.examRecord.MaximumScore, 50);
  assert.equal(mapped.questionRecords.length, parsedJune.questions.length);

  // 3. Parse custom JSON payload and verify Apps Script code generator
  const jsonPayload = JSON.stringify({
    title: 'ប្រឡងប្រចាំខែមិថុនា',
    subject: 'ICT',
    duration: '២០នាទី',
    questions: [
      { questionText: 'ភេទ', questionType: 'MCQ', options: ['ប្រុស', 'ស្រី'], points: 0 },
      { questionText: 'តើ USB ប្រើសម្រាប់អ្វី?', questionType: 'MCQ', options: ['កណ្តុរ/ក្តារចុច', 'អេក្រង់'], correctAnswerIndex: 0, points: 50 },
    ],
  });
  const parsedJson = parseGoogleFormImportPayload(jsonPayload);
  assert.equal(parsedJson.totalPoints, 50);
  assert.equal(parsedJson.durationMinutes, 20);

  const gasCode = getGoogleAppsScriptFormImporterCode();
  assert.ok(gasCode.includes('function importQuizFromGoogleForm'));
  assert.ok(gasCode.includes('FormApp.openByUrl'));
});

test('autoGradeExamSubmission supports Google Forms CHECKBOXES (multiple correct answers) alongside MCQ, TRUE_FALSE, SHORT_ANSWER, and ESSAY', () => {
  const db = createInitialDatabaseState();
  const baseQ = db.Questions[0];
  const questions = [
    {
      ...baseQ,
      QuestionID: 'Q-GF-1',
      QuestionType: 'MCQ' as const,
      QuestionText: 'Multiple Choice question',
      OptionsJSON: JSON.stringify(['A', 'B', 'C']),
      CorrectAnswerJSON: JSON.stringify({
        googleFormSubType: 'MULTIPLE_CHOICE',
        answerIndex: 1,
      }),
      Points: 10,
    },
    {
      ...baseQ,
      QuestionID: 'Q-GF-2',
      QuestionType: 'MCQ' as const,
      QuestionText: 'Checkboxes question with multiple correct answers',
      OptionsJSON: JSON.stringify(['USB', 'HDMI', 'PS/2', 'VGA']),
      CorrectAnswerJSON: JSON.stringify({
        googleFormSubType: 'CHECKBOXES',
        answerIndex: 0,
        correctIndices: [0, 2],
      }),
      Points: 15,
    },
    {
      ...baseQ,
      QuestionID: 'Q-GF-3',
      QuestionType: 'SHORT_ANSWER' as const,
      QuestionText: 'Date question',
      OptionsJSON: '[]',
      CorrectAnswerJSON: JSON.stringify({
        googleFormSubType: 'DATE',
        sampleKeyword: '2026-06-15',
      }),
      Points: 10,
    },
  ];

  // Exact match on both MCQ (10 pts) and Checkboxes ([0, 2] -> 15 pts), plus Date queued for manual/keyword check (10 pts)
  const fullScoreResult = autoGradeExamSubmission(questions, {
    'Q-GF-1': { questionId: 'Q-GF-1', selectedIndex: 1 },
    'Q-GF-2': { questionId: 'Q-GF-2', selectedIndices: [0, 2] },
    'Q-GF-3': { questionId: 'Q-GF-3', textAnswer: '2026-06-15' },
  });
  assert.equal(fullScoreResult.autoGradedPoints, 25);
  assert.equal(fullScoreResult.pendingManualPoints, 10);
  assert.equal(fullScoreResult.maxPossiblePoints, 35);

  // Partial/incomplete Checkboxes selection ([0] instead of [0, 2]) should score 0 on Q-GF-2
  const partialCheckboxesResult = autoGradeExamSubmission(questions, {
    'Q-GF-1': { questionId: 'Q-GF-1', selectedIndex: 1 },
    'Q-GF-2': { questionId: 'Q-GF-2', selectedIndices: [0] },
    'Q-GF-3': { questionId: 'Q-GF-3', textAnswer: '2026-06-15' },
  });
  assert.equal(partialCheckboxesResult.autoGradedPoints, 10);
});

test('Student Online Examination Portal enforces class isolation, start/end time windows, duplicate submission prevention, and result publication privacy', () => {
  const db = createInitialDatabaseState();
  const refNow = '2026-11-08T09:00:00Z';

  // 1. Valid access to available class-assigned exam (EXM-2526-ICT-JUL)
  const validAccess = validateStudentExamAccess(
    db,
    'STD-6463',
    'EXM-2526-ICT-JUL',
    refNow
  );
  assert.equal(validAccess.allowed, true);
  assert.equal(validAccess.status, 'AVAILABLE');
  assert.equal(validAccess.enforcedRule, 'BACKEND_EXAM_ACCESS_GRANTED');

  // 2. Deny access to another class's exam (EXM-2526-ENG-NOV is assigned to 11A/11B, not 12C)
  const crossClassDenied = validateStudentExamAccess(
    db,
    'STD-6463',
    'EXM-2526-ENG-NOV',
    refNow
  );
  assert.equal(crossClassDenied.allowed, false);
  assert.equal(crossClassDenied.enforcedRule, 'BACKEND_STRICT_CLASS_ISOLATION');

  // 3. Deny starting an UPCOMING exam before its StartDateTime (EXM-2526-PHY-SEM1 starts 2026-12-15)
  const upcomingDenied = validateStudentExamAccess(
    db,
    'STD-6463',
    'EXM-2526-PHY-SEM1',
    refNow
  );
  assert.equal(upcomingDenied.allowed, false);
  assert.equal(upcomingDenied.status, 'UPCOMING');
  assert.equal(upcomingDenied.enforcedRule, 'BACKEND_START_TIME_RESTRICTION');

  // 4. Deny starting an EXPIRED exam after its EndDateTime (EXM-2526-ICT-OCT ended 2026-10-15)
  const expiredDenied = validateStudentExamAccess(
    db,
    'STD-6463',
    'EXM-2526-ICT-OCT',
    refNow
  );
  assert.equal(expiredDenied.allowed, false);
  assert.equal(expiredDenied.status, 'EXPIRED');
  assert.equal(expiredDenied.enforcedRule, 'BACKEND_EXPIRATION_RESTRICTION');

  // 5. Deny duplicate submission when AttemptLimit (1) is reached (STD-6463 already completed EXM-2526-ICT-NOV)
  const duplicateDenied = validateStudentExamAccess(
    db,
    'STD-6463',
    'EXM-2526-ICT-NOV',
    refNow
  );
  assert.equal(duplicateDenied.allowed, false);
  assert.equal(duplicateDenied.status, 'COMPLETED');
  assert.equal(
    duplicateDenied.enforcedRule,
    'BACKEND_PREVENT_DUPLICATE_SUBMISSION'
  );

  // 6. Verify Subject & Exam Catalog and Result Publication Privacy
  const catalog6463 = getStudentExaminationPortalCatalog(
    db,
    'USR-STD-01', // STD-6463
    refNow
  );
  assert.equal(catalog6463.student.StudentID, 'STD-6463');
  assert.equal(catalog6463.studentClass.ClassName, '12C');
  assert.equal(catalog6463.subjectCards.length, 5);
  // Ensure Grade 11 exam EXM-2526-ENG-NOV is NOT included in Class 12C student's catalog
  assert.equal(
    catalog6463.examCards.some((c) => c.exam.ExamID === 'EXM-2526-ENG-NOV'),
    false
  );
  // STD-6463 has a GRADED (published) attempt for EXM-2526-ICT-NOV -> score 48 is visible
  assert.equal(catalog6463.examHistory.length, 1);
  assert.equal(catalog6463.examHistory[0].isResultPublished, true);
  assert.equal(catalog6463.examHistory[0].publishedScore?.scoreObtained, 48);

  // STD-5187 has a SUBMITTED (unpublished) attempt for EXM-2526-ICT-NOV -> score must be hidden (undefined)
  const catalog5187 = getStudentExaminationPortalCatalog(
    db,
    'STD-5187',
    refNow
  );
  assert.equal(catalog5187.examHistory.length, 1);
  assert.equal(catalog5187.examHistory[0].isResultPublished, false);
  assert.equal(catalog5187.examHistory[0].publishedScore, undefined);
});

test('Advanced Responses & Grading distinguishes Pending, Partially Graded, and Fully Graded, and prevents auto-grading from overwriting manual teacher adjustments', () => {
  const db = createInitialDatabaseState();
  const ictQuestions = db.Questions.filter(
    (q) => q.SubjectID === 'SUB-ICT' && (q.ExamMonth ?? 'វិច្ឆិកា') === 'វិច្ឆិកា'
  );
  assert.equal(ictQuestions.length, 5);

  // 1. ATT-2526-001 (STD-6463) has all 5 questions graded (3 SYSTEM + 2 USR-TCH-12C) -> FULLY_GRADED
  const att001 = db.ExamAttempts.find((a) => a.AttemptID === 'ATT-2526-001')!;
  const progress001 = computeAttemptGradingProgress(
    att001,
    ictQuestions,
    db.ExamAnswers
  );
  assert.equal(progress001.status, 'FULLY_GRADED');
  assert.equal(progress001.gradedQuestionsCount, 5);
  assert.equal(progress001.pendingManualCount, 0);
  assert.equal(progress001.currentTotalScore, 48);

  // 2. ATT-2526-002 (STD-5187) has 3 objective questions graded by SYSTEM and 2 subjective questions pending -> PARTIALLY_GRADED
  const att002 = db.ExamAttempts.find((a) => a.AttemptID === 'ATT-2526-002')!;
  const progress002 = computeAttemptGradingProgress(
    att002,
    ictQuestions,
    db.ExamAnswers
  );
  assert.equal(progress002.status, 'PARTIALLY_GRADED');
  assert.equal(progress002.gradedQuestionsCount, 3);
  assert.equal(progress002.pendingManualCount, 2);
  assert.equal(progress002.currentTotalScore, 30);

  // 3. When a teacher manually adjusts a score (e.g. ANS-001-5 = 9 pts by USR-TCH-12C, or manual override = 10 pts),
  // running safeAutoGradeAttemptPreservingManualScores MUST NOT overwrite those manual scores!
  const safeAuto001 = safeAutoGradeAttemptPreservingManualScores(
    att001,
    ictQuestions,
    db.ExamAnswers,
    { 'ANS-2526-001E': '9' }
  );
  assert.equal(safeAuto001.preservedManualCount, 2); // QST-ICT-004 (10) & QST-ICT-005 (9)
  assert.equal(safeAuto001.totalScore, 49);
  assert.equal(safeAuto001.gradingStatus, 'FULLY_GRADED');

  // 4. Verify teacher subject permission enforcement (canTeacherManageExamAndGrading)
  const ctx = {
    users: db.Users,
    roles: db.Roles,
    assignments: db.TeacherSubjectAssignments,
  };
  assert.equal(
    canTeacherManageExamAndGrading('USR-TCH-12C', 'SUB-ICT', ctx).allowed,
    true
  );
  assert.equal(
    canTeacherManageExamAndGrading('USR-TCH-12C', 'SUB-ENG', ctx).allowed,
    false
  );
  assert.equal(
    canTeacherManageExamAndGrading('USR-SUP-01', 'SUB-ENG', ctx).allowed,
    true
  );
});

test('Teacher Management, Multi-Subject/Multi-Class Assignments, Single Shared Exam, and Cross-Module Synchronization', () => {
  let db = createInitialDatabaseState();

  // 1. Add a new teacher and verify the teacher appears in assignment selection lists
  const initialTeachers = getRegisteredTeachersWithAssignments(db, 'AY-2025-2026');
  assert.equal(initialTeachers.length, 3);

  const addRes = createOrUpdateTeacherAccount(
    db,
    {
      fullNameKh: 'ហ៊ុន សុខុម',
      fullNameEn: 'HUN SOKHOM',
      username: 'hun.sokhom',
      email: 'sokhom.sci@teokchor.edu.kh',
      gender: 'ប្រុស',
      phone: '012 909 101',
    },
    'USR-SUP-01'
  );
  assert.equal(addRes.ok, true);
  assert.equal(addRes.isNew, true);
  assert.ok(addRes.teacher?.UserID);
  db = addRes.updatedDb;

  const newTeacherId = addRes.teacher!.UserID;
  const afterAddTeachers = getRegisteredTeachersWithAssignments(db, 'AY-2025-2026');
  assert.equal(afterAddTeachers.length, 4);
  assert.ok(afterAddTeachers.some((t) => t.teacherId === newTeacherId && t.user.FullNameKh === 'ហ៊ុន សុខុម'));

  // Prevent duplicate username
  const dupRes = createOrUpdateTeacherAccount(
    db,
    {
      fullNameKh: 'ហ៊ុន សុខុម ២',
      username: 'hun.sokhom',
      gender: 'ប្រុស',
      phone: '012 000 111',
    },
    'USR-SUP-01'
  );
  assert.equal(dupRes.ok, false);

  // 2. Assign one teacher multiple subjects and multiple classes
  const assignRes = saveTeacherSubjectClassAssignments(
    db,
    {
      academicYearId: 'AY-2025-2026',
      teacherId: newTeacherId,
      subjectClassMap: {
        'SUB-ICT': ['CLS-12C', 'CLS-11A'],
        'SUB-PHY': ['CLS-12C', 'CLS-12B', 'CLS-10A'],
      },
    },
    'USR-SUP-01'
  );
  assert.equal(assignRes.ok, true);
  assert.equal(assignRes.activeAssignmentsCount, 5);
  db = assignRes.updatedDb;

  // 3. Verify that the teacher sees only authorized subjects and classes
  const scope = getTeacherAuthorizedSubjectsAndClasses(db, newTeacherId, 'AY-2025-2026');
  assert.equal(scope.isActiveUser, true);
  assert.equal(scope.isGlobalAdmin, false);
  assert.deepEqual(
    scope.authorizedSubjects.map((s) => s.SubjectID).sort(),
    ['SUB-ICT', 'SUB-PHY'].sort()
  );
  assert.deepEqual(
    scope.authorizedClassesBySubject['SUB-ICT'].map((c) => c.ClassID).sort(),
    ['CLS-11A', 'CLS-12C'].sort()
  );
  assert.deepEqual(
    scope.authorizedClassesBySubject['SUB-PHY'].map((c) => c.ClassID).sort(),
    ['CLS-10A', 'CLS-12B', 'CLS-12C'].sort()
  );

  // 4. Update a student and verify that the updated information appears across relevant modules
  db = {
    ...db,
    Students: db.Students.map((s) =>
      s.StudentCode === '6463'
        ? { ...s, FirstNameKh: 'គិមឡាង (កែប្រែ)', FullNameKh: 'គុណ គិមឡាង (កែប្រែ)' }
        : s
    ),
  };
  const updatedCatalog6463 = getStudentExaminationPortalCatalog(db, 'STD-6463');
  assert.equal(updatedCatalog6463.student.FullNameKh, 'គុណ គិមឡាង (កែប្រែ)');

  // 5. Update an assignment and verify that related teacher access is synchronized immediately
  const updateAssignRes = saveTeacherSubjectClassAssignments(
    db,
    {
      academicYearId: 'AY-2025-2026',
      teacherId: newTeacherId,
      subjectClassMap: {
        'SUB-PHY': ['CLS-12C', 'CLS-7A'],
      },
      replaceForYear: true,
    },
    'USR-SUP-01'
  );
  assert.equal(updateAssignRes.ok, true);
  assert.equal(updateAssignRes.activeAssignmentsCount, 2);
  db = updateAssignRes.updatedDb;

  const updatedScope = getTeacherAuthorizedSubjectsAndClasses(db, newTeacherId, 'AY-2025-2026');
  assert.deepEqual(
    updatedScope.authorizedSubjects.map((s) => s.SubjectID),
    ['SUB-PHY']
  );
  assert.deepEqual(
    updatedScope.authorizedClassesBySubject['SUB-PHY'].map((c) => c.ClassID).sort(),
    ['CLS-12C', 'CLS-7A'].sort()
  );

  // 6. Create one examination for multiple classes and verify that it remains a single examination
  const examCountBefore = db.Exams.length;
  // Unauthorized class ('CLS-10A') must be rejected for this teacher
  const unauthorizedExamRes = validateAndSaveSharedExam(
    db,
    {
      examTitle: 'ប្រឡងរូបវិទ្យាប្រចាំខែធ្នូ',
      subjectId: 'SUB-PHY',
      classId: 'CLS-12C',
      classIds: ['CLS-12C', 'CLS-10A'],
      academicYearId: 'AY-2025-2026',
      examMonth: 'ធ្នូ',
      startDateTime: '2026-11-01T08:00:00Z',
      endDateTime: '2026-11-30T17:00:00Z',
      durationMinutes: 60,
      maximumScore: 75,
      passScore: 37.5,
    },
    newTeacherId
  );
  assert.equal(unauthorizedExamRes.ok, false);

  // Authorized classes (['CLS-12C', 'CLS-7A']) succeed and create ONE shared exam
  const sharedExamRes = validateAndSaveSharedExam(
    db,
    {
      examTitle: 'ប្រឡងរូបវិទ្យាប្រចាំខែធ្នូ (12C & 7A)',
      subjectId: 'SUB-PHY',
      classId: 'CLS-12C',
      classIds: ['CLS-12C', 'CLS-7A'],
      academicYearId: 'AY-2025-2026',
      examMonth: 'ធ្នូ',
      startDateTime: '2026-11-01T08:00:00Z',
      endDateTime: '2026-11-30T17:00:00Z',
      durationMinutes: 60,
      maximumScore: 75,
      passScore: 37.5,
      status: 'PUBLISHED',
    },
    newTeacherId
  );
  assert.equal(sharedExamRes.ok, true);
  db = sharedExamRes.updatedDb;
  assert.equal(db.Exams.length, examCountBefore + 1); // Strictly ONE shared exam, not 2 duplicate exams!
  const createdExamId = sharedExamRes.exam!.ExamID;

  // 7. Verify that students from assigned classes (STD-6463 in 12C & STD-6648 in 7A) can access the examination
  assert.equal(canStudentAccessExam(db, 'STD-6463', createdExamId).allowed, true);
  assert.equal(canStudentAccessExam(db, 'STD-6648', createdExamId).allowed, true);

  // 8. Verify that students from unassigned classes cannot access an examination not assigned to their class
  // EXM-2526-ICT-NOV is assigned to ['CLS-12A', 'CLS-12B', 'CLS-12C'] (NOT CLS-7A)
  assert.equal(canStudentAccessExam(db, 'STD-6648', 'EXM-2526-ICT-NOV').allowed, false);

  // 9. Verify that existing examination responses, scores, and historical results remain unchanged when a teacher is deactivated
  const attemptsCountBefore = db.ExamAttempts.length;
  const answersCountBefore = db.ExamAnswers.length;
  const monthlyScoresBefore = db.MonthlyScores.length;

  const deactivateRes = setTeacherAccountStatus(db, 'USR-TCH-12C', 'INACTIVE', 'USR-SUP-01');
  assert.equal(deactivateRes.ok, true);
  db = deactivateRes.updatedDb;

  assert.equal(db.ExamAttempts.length, attemptsCountBefore);
  assert.equal(db.ExamAnswers.length, answersCountBefore);
  assert.equal(db.MonthlyScores.length, monthlyScoresBefore);
  const inactiveScope = getTeacherAuthorizedSubjectsAndClasses(db, 'USR-TCH-12C', 'AY-2025-2026');
  assert.equal(inactiveScope.isActiveUser, false);
  assert.equal(inactiveScope.authorizedSubjects.length, 0);
});

test('Homeroom Teacher Role, Multi-Subject Specialization, All-Subject Score Permissions in Homeroom Class, Auto-Recalculation, Score Locking, and Audit Log', () => {
  let db = createInitialDatabaseState();

  // 1. Create a pure Subject-only teacher (no homeroom classes) and verify they can manage only assigned subjects and classes
  const addPureSubjectTeacher = createOrUpdateTeacherAccount(
    db,
    {
      fullNameKh: 'លី ចាន់ណា',
      fullNameEn: 'LY CHANNA',
      username: 'ly.channa',
      gender: 'ស្រី',
      phone: '012 333 444',
      initialAcademicYearId: 'AY-2025-2026',
      initialSubjectIds: ['SUB-ENG'],
      initialClassIds: ['CLS-12C'],
    },
    'USR-SUP-01'
  );
  assert.equal(addPureSubjectTeacher.ok, true);
  db = addPureSubjectTeacher.updatedDb;
  const pureSubjectTeacherId = addPureSubjectTeacher.teacher!.UserID;

  const pureRoles = getUserEffectiveRoles(db, pureSubjectTeacherId, 'AY-2025-2026');
  assert.deepEqual(pureRoles.effectiveRoles, ['TEACHER']);
  assert.equal(pureRoles.isSubjectTeacher, true);
  assert.equal(pureRoles.isHomeroomTeacher, false);

  const engPermAssigned = canManageStudentScore(db, pureSubjectTeacherId, {
    classId: 'CLS-12C',
    subjectId: 'SUB-ENG',
    academicYearId: 'AY-2025-2026',
  });
  assert.equal(engPermAssigned.allowed, true);
  assert.equal(engPermAssigned.authorizedBy, 'SUBJECT_TEACHER');

  const engPermUnassignedSubject = canManageStudentScore(db, pureSubjectTeacherId, {
    classId: 'CLS-12C',
    subjectId: 'SUB-MATH',
    academicYearId: 'AY-2025-2026',
  });
  assert.equal(engPermUnassignedSubject.allowed, false);

  const engPermUnassignedClass = canManageStudentScore(db, pureSubjectTeacherId, {
    classId: 'CLS-7A',
    subjectId: 'SUB-ENG',
    academicYearId: 'AY-2025-2026',
  });
  assert.equal(engPermUnassignedClass.allowed, false);

  // 2. Verify that a teacher with BOTH Subject Teacher and Homeroom Teacher roles ('USR-TCH-12C', ជួន លីរតនៈ) receives combined permissions
  const tch12CRoles = getUserEffectiveRoles(db, 'USR-TCH-12C', 'AY-2025-2026');
  assert.ok(tch12CRoles.effectiveRoles.includes('TEACHER'));
  assert.ok(tch12CRoles.effectiveRoles.includes('HOMEROOM_TEACHER'));
  assert.ok(tch12CRoles.activeHomeroomClassIds.includes('CLS-12C'));

  // 3. Verify that Homeroom Teacher 'USR-TCH-12C' (whose subject specialization is ICT & Physics) can manage scores for ALL 5 subjects in Homeroom Class 12C
  for (const subject of db.Subjects) {
    const scorePerm = canManageStudentScore(db, 'USR-TCH-12C', {
      classId: 'CLS-12C',
      subjectId: subject.SubjectID,
      academicYearId: 'AY-2025-2026',
    });
    assert.equal(scorePerm.allowed, true, `Homeroom teacher must be allowed to manage ${subject.SubjectID} in 12C`);
  }
  // Specifically check Khmer Literature ('SUB-KHM') and English ('SUB-ENG') which are NOT taught by USR-TCH-12C:
  const khmIn12C = canManageStudentScore(db, 'USR-TCH-12C', {
    classId: 'CLS-12C',
    subjectId: 'SUB-KHM',
    academicYearId: 'AY-2025-2026',
  });
  assert.equal(khmIn12C.allowed, true);
  assert.equal(khmIn12C.authorizedBy, 'HOMEROOM_TEACHER');

  // 4. Verify that Homeroom Teacher CANNOT manage questions/examinations for subjects they do not teach ('SUB-ENG' in 12C)
  const qAuthContext = {
    users: db.Users,
    roles: db.Roles,
    assignments: db.TeacherSubjectAssignments,
    questions: db.Questions,
    classes: db.Classes,
  };
  assert.equal(
    canManageQuestion('USR-TCH-12C', null, 'CREATE', qAuthContext, 'SUB-ENG').allowed,
    false
  );
  assert.equal(
    canTeacherManageExamAndGrading('USR-TCH-12C', 'SUB-ENG', qAuthContext).allowed,
    false
  );
  // But since USR-TCH-12C is ALSO Subject Teacher for SUB-ICT in 12B (where USR-TCH-ENG is homeroom), they CAN manage SUB-ICT scores in 12B via Combined Role!
  const ictIn12B = canManageStudentScore(db, 'USR-TCH-12C', {
    classId: 'CLS-12B',
    subjectId: 'SUB-ICT',
    academicYearId: 'AY-2025-2026',
  });
  assert.equal(ictIn12B.allowed, true);
  assert.equal(ictIn12B.authorizedBy, 'SUBJECT_TEACHER');

  // 5. Verify that Homeroom Teacher of 12C CANNOT modify scores belonging to another class ('CLS-7A' or 'CLS-12B') for unassigned subjects ('SUB-KHM')
  const khmIn12B = canManageStudentScore(db, 'USR-TCH-12C', {
    classId: 'CLS-12B',
    subjectId: 'SUB-KHM',
    academicYearId: 'AY-2025-2026',
  });
  assert.equal(khmIn12B.allowed, false);

  // 6. Verify that a teacher can have multiple subject specializations, and multiple teachers can specialize in the same subject,
  // while specialization alone does NOT grant class teaching permissions without TeacherSubjectAssignments
  const specRes = saveTeacherSpecializationsAndRoles(
    db,
    {
      teacherId: pureSubjectTeacherId,
      assignedRoles: ['TEACHER'],
      subjectIds: ['SUB-ENG', 'SUB-KHM', 'SUB-ICT'],
    },
    'USR-SUP-01'
  );
  assert.equal(specRes.ok, true);
  db = specRes.updatedDb;
  const updatedPureTeacher = db.Users.find((u) => u.UserID === pureSubjectTeacherId)!;
  assert.deepEqual(updatedPureTeacher.SubjectSpecializations, ['SUB-ENG', 'SUB-KHM', 'SUB-ICT']);
  // Even though pureSubjectTeacherId now specializes in SUB-ICT, they still cannot manage SUB-ICT scores in 12C without a class assignment:
  assert.equal(
    canManageStudentScore(db, pureSubjectTeacherId, {
      classId: 'CLS-12C',
      subjectId: 'SUB-ICT',
      academicYearId: 'AY-2025-2026',
    }).allowed,
    false
  );

  // 7. Verify Homeroom Teacher Assignment rule: each class has only ONE active primary homeroom teacher per academic year
  const assignHomeroom7A = saveHomeroomTeacherAssignment(
    db,
    {
      teacherId: pureSubjectTeacherId,
      classId: 'CLS-7A',
      academicYearId: 'AY-2025-2026',
      status: 'ACTIVE',
    },
    'USR-SUP-01'
  );
  assert.equal(assignHomeroom7A.ok, true);
  db = assignHomeroom7A.updatedDb;
  // Now pureSubjectTeacherId is Homeroom Teacher of 7A and can manage ALL subjects in 7A (including SUB-MATH)
  assert.equal(
    canManageStudentScore(db, pureSubjectTeacherId, {
      classId: 'CLS-7A',
      subjectId: 'SUB-MATH',
      academicYearId: 'AY-2025-2026',
    }).allowed,
    true
  );
  // Reassigning 7A homeroom to USR-TCH-MATH automatically deactivates pureSubjectTeacherId's homeroom assignment for 7A
  const reassign7A = saveHomeroomTeacherAssignment(
    db,
    {
      teacherId: 'USR-TCH-MATH',
      classId: 'CLS-7A',
      academicYearId: 'AY-2025-2026',
      status: 'ACTIVE',
    },
    'USR-SUP-01'
  );
  assert.equal(reassign7A.ok, true);
  db = reassign7A.updatedDb;
  const active7AHomerooms = (db.HomeroomTeacherAssignments ?? []).filter(
    (h) => h.ClassID === 'CLS-7A' && h.AcademicYearID === 'AY-2025-2026' && h.Status === 'ACTIVE'
  );
  assert.equal(active7AHomerooms.length, 1);
  assert.equal(active7AHomerooms[0].TeacherID, 'USR-TCH-MATH');

  // 8. Verify Score Changes automatically recalculate grades, weighted averages, and competition rankings, and record AuditLog
  const auditCountBefore = db.AuditLogs.length;
  // Homeroom Teacher USR-TCH-12C updates STD-6463 (គុណ គិមឡាង) score in Khmer Literature ('SUB-KHM', max 75) in Class 12C
  const scoreUpdateRes = upsertStudentSubjectScoreAndRecalculate(
    db,
    {
      studentId: 'STD-6463',
      classId: 'CLS-12C',
      subjectId: 'SUB-KHM',
      academicYearId: 'AY-2025-2026',
      periodType: 'MONTHLY',
      periodKey: 'វិច្ឆិកា',
      newScore: 72, // out of 75 (96% -> Grade A)
      reason: 'កែតម្រូវពិន្ទុអក្សរសាស្ត្រខ្មែរដោយគ្រូបន្ទុកថ្នាក់ 12C',
    },
    'USR-TCH-12C'
  );
  assert.equal(scoreUpdateRes.ok, true);
  assert.equal(scoreUpdateRes.newScore, 72);
  assert.ok(scoreUpdateRes.newStudentAverage > 36.38); // Improved from 36.38
  assert.equal(scoreUpdateRes.newStudentRank, 4); // Improved from Rank 7 to Rank 4
  db = scoreUpdateRes.updatedDb;

  // Verify AuditLog entry was recorded with TeacherID, StudentID, SubjectID, PreviousScore, NewScore, Reason
  assert.equal(db.AuditLogs.length, auditCountBefore + 1);
  const latestAudit = db.AuditLogs[0];
  assert.equal(latestAudit.UserID, 'USR-TCH-12C');
  assert.ok(latestAudit.NewValueJSON.includes('"SubjectID":"SUB-KHM"'));
  assert.ok(latestAudit.NewValueJSON.includes('"NewScore":72'));

  // 9. Verify unauthorized API requests and locked score periods are rejected by the backend
  const unauthorizedUpdate = upsertStudentSubjectScoreAndRecalculate(
    db,
    {
      studentId: 'STD-6648', // Class 7A
      classId: 'CLS-7A',
      subjectId: 'SUB-KHM',
      academicYearId: 'AY-2025-2026',
      periodType: 'MONTHLY',
      periodKey: 'វិច្ឆិកា',
      newScore: 65,
    },
    pureSubjectTeacherId // No longer homeroom teacher of 7A, and not assigned SUB-KHM in 7A
  );
  assert.equal(unauthorizedUpdate.ok, false);

  // Lock Class 12C score entry for វិច្ឆិកា by Admin ('USR-SUP-01')
  const lockRes = setScoreEntryPeriodLock(
    db,
    {
      academicYearId: 'AY-2025-2026',
      classId: 'CLS-12C',
      periodType: 'MONTHLY',
      periodKey: 'វិច្ឆិកា',
      isLocked: true,
      reason: 'បិទបញ្ជីពិន្ទុប្រចាំខែវិច្ឆិកា',
    },
    'USR-SUP-01'
  );
  assert.equal(lockRes.ok, true);
  db = lockRes.updatedDb;
  assert.equal(
    isScoreEntryPeriodLocked(db, {
      academicYearId: 'AY-2025-2026',
      classId: 'CLS-12C',
      periodType: 'MONTHLY',
      periodKey: 'វិច្ឆិកា',
    }).isLocked,
    true
  );

  // Homeroom teacher attempt to edit while locked must be rejected
  const lockedAttempt = upsertStudentSubjectScoreAndRecalculate(
    db,
    {
      studentId: 'STD-6463',
      classId: 'CLS-12C',
      subjectId: 'SUB-ENG',
      academicYearId: 'AY-2025-2026',
      periodType: 'MONTHLY',
      periodKey: 'វិច្ឆិកា',
      newScore: 49,
    },
    'USR-TCH-12C'
  );
  assert.equal(lockedAttempt.ok, false);

  // Reopen score entry period by Admin ('USR-SUP-01')
  const unlockRes = setScoreEntryPeriodLock(
    db,
    {
      academicYearId: 'AY-2025-2026',
      classId: 'CLS-12C',
      periodType: 'MONTHLY',
      periodKey: 'វិច្ឆិកា',
      isLocked: false,
      reason: 'បើកសិទ្ធិកែប្រែពិន្ទុឡើងវិញ',
    },
    'USR-SUP-01'
  );
  assert.equal(unlockRes.ok, true);
  db = unlockRes.updatedDb;

  // 10. Verify Homeroom Teacher Dashboard data aggregation
  const homeroomDash = getHomeroomTeacherDashboardData(db, 'USR-TCH-12C', 'CLS-12C', 'AY-2025-2026', 'វិច្ឆិកា');
  assert.equal(homeroomDash.selectedHomeroomClass.ClassName, '12C');
  assert.equal(homeroomDash.totalStudents, 56);
  assert.equal(homeroomDash.femaleStudents, 26);
  assert.equal(homeroomDash.maleStudents, 30);
  assert.equal(homeroomDash.classSubjectList.length, 5);
  assert.ok(homeroomDash.classSubjectList.every((s) => s.canCurrentUserEditScore === true));
});

test('Reorganized Subject Management (6 submenus) and Score Management (7 submenus), Role Permissions, Workflow & Modification History', () => {
  let db = createInitialDatabaseState();

  // 1. Verify exact 6 submenus in SUBJECT_MANAGEMENT and 7 submenus in SCORE_MANAGEMENT
  assert.equal(SUBJECT_MANAGEMENT_SUBMENUS.length, 6);
  assert.deepEqual(
    SUBJECT_MANAGEMENT_SUBMENUS.map((s) => s.id),
    [
      'SUBJECT_LIST',
      'SUBJECT_ACADEMIC_CONFIG',
      'MAX_SCORE_CONFIG',
      'GRADE_RANGE_CONFIG',
      'COEFFICIENT_CONFIG',
      'TEACHER_SUBJECT_CLASS_ASSIGNMENTS',
    ]
  );

  assert.equal(SCORE_MANAGEMENT_SUBMENUS.length, 7);
  assert.deepEqual(
    SCORE_MANAGEMENT_SUBMENUS.map((s) => s.id),
    [
      'SCORE_ENTRY',
      'SCORE_EDITING',
      'SCORES_BY_CLASS',
      'SCORES_BY_SUBJECT',
      'MISSING_SCORE_MONITORING',
      'SCORE_SUBMISSION_STATUS',
      'SCORE_MODIFICATION_HISTORY',
    ]
  );

  // 2. Administrator (USR-SUP-01) has full access to both Subject Management and Score Management
  const adminModules = getRoleSidebarModules(db, 'USR-SUP-01');
  assert.equal(adminModules.canSeeSubjectManagement, true);
  assert.equal(adminModules.visibleSubjectSubMenus.length, 6);
  assert.equal(adminModules.canSeeScoreManagement, true);
  assert.equal(adminModules.visibleScoreSubMenus.length, 7);
  assert.equal(canAccessSubjectManagement(db, 'USR-SUP-01').allowed, true);

  // 3. Combined-Role Teacher (USR-TCH-12C: Subject Teacher + Homeroom Teacher 12C)
  const combinedModules = getRoleSidebarModules(db, 'USR-TCH-12C');
  assert.equal(combinedModules.canSeeSubjectManagement, false); // Cannot see Subject Management config menus
  assert.equal(canAccessSubjectManagement(db, 'USR-TCH-12C').allowed, false);
  assert.equal(combinedModules.canSeeScoreManagement, true);
  assert.equal(combinedModules.visibleScoreSubMenus.length, 7);

  // 4. Create a Pure Subject Teacher (only TEACHER, assigned SUB-PHY in CLS-10A)
  const createSubTch = createOrUpdateTeacherAccount(
    db,
    {
      fullNameKh: 'គ្រូមុខវិជ្ជា សុទ្ធ',
      fullNameEn: 'PURE SUBJECT TEACHER',
      username: 'teacher.subonly',
      gender: 'ប្រុស',
      phone: '012888111',
      assignedRoles: ['TEACHER'],
      initialAcademicYearId: 'AY-2025-2026',
      initialSubjectIds: ['SUB-PHY'],
      initialClassIds: ['CLS-10A'],
    },
    'USR-SUP-01'
  );
  assert.equal(createSubTch.ok, true);
  db = createSubTch.updatedDb;
  const pureSubTeacherId = createSubTch.teacher!.UserID;

  const subTchModules = getRoleSidebarModules(db, pureSubTeacherId);
  assert.equal(subTchModules.canSeeSubjectManagement, false);
  assert.equal(subTchModules.canSeeScoreManagement, true);

  // Pure Subject Teacher can enter/edit SUB-PHY in CLS-10A, but CANNOT view or edit SUB-MATH in CLS-10A or CLS-12C
  assert.equal(
    canAccessScoreManagementOperation(db, pureSubTeacherId, {
      classId: 'CLS-10A',
      subjectId: 'SUB-PHY',
      operation: 'ENTER_OR_EDIT',
    }).allowed,
    true
  );
  assert.equal(
    canAccessScoreManagementOperation(db, pureSubTeacherId, {
      classId: 'CLS-10A',
      subjectId: 'SUB-MATH',
      operation: 'VIEW',
    }).allowed,
    false
  );
  assert.equal(
    canAccessScoreManagementOperation(db, pureSubTeacherId, {
      classId: 'CLS-12C',
      subjectId: 'SUB-PHY',
      operation: 'ENTER_OR_EDIT',
    }).allowed,
    false
  );

  // 5. Create a Pure Homeroom Teacher (only HOMEROOM_TEACHER for CLS-11A, no Subject Teacher assignment)
  const createHrOnly = createOrUpdateTeacherAccount(
    db,
    {
      fullNameKh: 'គ្រូបន្ទុកថ្នាក់ សុទ្ធ',
      fullNameEn: 'PURE HOMEROOM TEACHER',
      username: 'teacher.hronly',
      gender: 'ស្រី',
      phone: '012888222',
      assignedRoles: ['HOMEROOM_TEACHER'],
      initialAcademicYearId: 'AY-2025-2026',
      initialSubjectIds: [],
      initialClassIds: [],
    },
    'USR-SUP-01'
  );
  assert.equal(createHrOnly.ok, true);
  db = createHrOnly.updatedDb;
  const pureHrTeacherId = createHrOnly.teacher!.UserID;
  const hrAssignRes = saveHomeroomTeacherAssignment(
    db,
    {
      teacherId: pureHrTeacherId,
      classId: 'CLS-11A',
      academicYearId: 'AY-2025-2026',
      status: 'ACTIVE',
    },
    'USR-SUP-01'
  );
  assert.equal(hrAssignRes.ok, true);
  db = hrAssignRes.updatedDb;

  const hrModules = getRoleSidebarModules(db, pureHrTeacherId);
  assert.equal(hrModules.canSeeSubjectManagement, false);
  assert.equal(hrModules.canSeeScoreManagement, true);
  // Pure Homeroom Teacher sees monitoring/viewing submenus (5 submenus)
  assert.equal(hrModules.visibleScoreSubMenus.length, 5);
  // Pure Homeroom Teacher can VIEW all subjects in CLS-11A, but CANNOT edit scores in ScoreManagement without Subject Teacher assignment
  assert.equal(
    canAccessScoreManagementOperation(db, pureHrTeacherId, {
      classId: 'CLS-11A',
      subjectId: 'SUB-MATH',
      operation: 'VIEW',
    }).allowed,
    true
  );
  assert.equal(
    canAccessScoreManagementOperation(db, pureHrTeacherId, {
      classId: 'CLS-11A',
      subjectId: 'SUB-MATH',
      operation: 'ENTER_OR_EDIT',
    }).allowed,
    false
  );

  // 6. Student (USR-STD-6463) cannot see or access Subject Management or Score Management
  const studentModules = getRoleSidebarModules(db, 'USR-STD-6463');
  assert.equal(studentModules.canSeeSubjectManagement, false);
  assert.equal(studentModules.canSeeScoreManagement, false);
  assert.equal(studentModules.canSeeStudentPortalOnly, true);
  assert.equal(
    canAccessScoreManagementOperation(db, 'USR-STD-6463', {
      classId: 'CLS-12C',
      subjectId: 'SUB-ICT',
      operation: 'VIEW',
    }).allowed,
    false
  );

  // 7. Single Source of Truth: Updating Subject MaximumScore & Coefficient in Subject Management immediately reflects in Score Management
  const updateIctConfig = saveSubjectAcademicConfiguration(
    db,
    {
      subjectId: 'SUB-ICT',
      subjectCode: 'ICT',
      subjectNameKh: 'ព័ត៌មានវិទ្យា (ICT)',
      subjectNameEn: 'Information & Communication Technology',
      gradeLevel: '7-12',
      maximumScore: 120,
      passingScore: 60,
      coefficient: 3.0,
      status: 'ACTIVE',
    },
    'USR-SUP-01'
  );
  assert.equal(updateIctConfig.ok, true);
  db = updateIctConfig.updatedDb;

  const matrixAfterConfig = getClassStudentSubjectScoreMatrix(db, {
    classId: 'CLS-12C',
    month: 'វិច្ឆិកា',
  });
  const ictInMatrix = matrixAfterConfig.subjects.find((s) => s.SubjectID === 'SUB-ICT')!;
  assert.equal(ictInMatrix.MaximumScore, 120);
  assert.equal(ictInMatrix.Coefficient, 3.0);

  // 8. Controlled Score Submission Workflow: DRAFT -> SUBMITTED (locked) -> REOPEN_REQUESTED -> REOPENED -> APPROVED
  const initialIctSub = getScoreSubmissionRecord(db, {
    academicYearId: 'AY-2025-2026',
    classId: 'CLS-12C',
    subjectId: 'SUB-ICT',
    month: 'វិច្ឆិកា',
  });
  assert.equal(initialIctSub.Status, 'DRAFT');

  // Teacher USR-TCH-12C submits SUB-ICT scores
  const submitRes = transitionScoreSubmissionWorkflow(
    db,
    {
      academicYearId: 'AY-2025-2026',
      classId: 'CLS-12C',
      subjectId: 'SUB-ICT',
      month: 'វិច្ឆិកា',
      action: 'SUBMIT',
    },
    'USR-TCH-12C'
  );
  assert.equal(submitRes.ok, true);
  assert.equal(submitRes.submission?.Status, 'SUBMITTED');
  db = submitRes.updatedDb;

  // Once SUBMITTED, teacher cannot edit until reopened
  assert.equal(
    canAccessScoreManagementOperation(db, 'USR-TCH-12C', {
      classId: 'CLS-12C',
      subjectId: 'SUB-ICT',
      month: 'វិច្ឆិកា',
      operation: 'ENTER_OR_EDIT',
    }).allowed,
    false
  );

  // Teacher requests reopen
  const reqReopen = transitionScoreSubmissionWorkflow(
    db,
    {
      academicYearId: 'AY-2025-2026',
      classId: 'CLS-12C',
      subjectId: 'SUB-ICT',
      month: 'វិច្ឆិកា',
      action: 'REQUEST_REOPEN',
      reasonOrNote: 'ស្នើសុំកែពិន្ទុសិស្ស ១ នាក់',
    },
    'USR-TCH-12C'
  );
  assert.equal(reqReopen.ok, true);
  assert.equal(reqReopen.submission?.Status, 'REOPEN_REQUESTED');
  db = reqReopen.updatedDb;

  // Non-admin cannot approve or reopen
  assert.equal(
    transitionScoreSubmissionWorkflow(
      db,
      {
        academicYearId: 'AY-2025-2026',
        classId: 'CLS-12C',
        subjectId: 'SUB-ICT',
        month: 'វិច្ឆិកា',
        action: 'REOPEN',
      },
      'USR-TCH-12C'
    ).ok,
    false
  );

  // Admin reopens SUB-ICT
  const adminReopen = transitionScoreSubmissionWorkflow(
    db,
    {
      academicYearId: 'AY-2025-2026',
      classId: 'CLS-12C',
      subjectId: 'SUB-ICT',
      month: 'វិច្ឆិកា',
      action: 'REOPEN',
    },
    'USR-SUP-01'
  );
  assert.equal(adminReopen.ok, true);
  assert.equal(adminReopen.submission?.Status, 'REOPENED');
  db = adminReopen.updatedDb;

  // Now teacher can edit SUB-ICT again and ScoreModificationHistory records the modification without overwriting previous records
  const modHistoryBefore = (db.ScoreModificationHistory || []).length;
  const editIctScore = upsertStudentSubjectScoreAndRecalculate(
    db,
    {
      studentId: 'STD-6463',
      classId: 'CLS-12C',
      subjectId: 'SUB-ICT',
      academicYearId: 'AY-2025-2026',
      periodType: 'MONTHLY',
      periodKey: 'វិច្ឆិកា',
      newScore: 115, // valid because MaximumScore is now 120!
      reason: 'បន្ថែមពិន្ទុអនុវត្តកុំព្យូទ័រ',
    },
    'USR-TCH-12C'
  );
  assert.equal(editIctScore.ok, true);
  db = editIctScore.updatedDb;
  assert.equal((db.ScoreModificationHistory || []).length, modHistoryBefore + 1);
  assert.equal(db.ScoreModificationHistory![0].NewScore, 115);
  assert.equal(db.ScoreModificationHistory![0].Reason, 'បន្ថែមពិន្ទុអនុវត្តកុំព្យូទ័រ');

  // Verify Grade Range Configuration update in Subject Management
  const gradeConfigRes = saveGradeRangeConfiguration(db, db.GradingScales, 'USR-SUP-01');
  assert.equal(gradeConfigRes.ok, true);
  const authorizedScope = getScoreManagementAuthorizedScope(db, 'USR-TCH-12C');
  assert.equal(authorizedScope.allowed, true);
});

test('Synchronized Database-Driven Dashboard, 9-Group Sidebar Navigation, and 6-Category Reports Hub reflect real-time DB changes and enforce RBAC', () => {
  let db = createInitialDatabaseState();

  // 1. Administrator sees all 9 Sidebar Groups and all 17 classes (920 total students, 56 active roster rows)
  const adminSidebar = getAuthorizedSidebar9Groups(db, 'USR-SUP-01');
  assert.equal(adminSidebar.groups.length, 9);
  assert.equal(SIDEBAR_9_GROUPS_CATALOG.length, 9);

  const adminDash = computeSynchronizedDashboardData(db, 'USR-SUP-01');
  assert.equal(adminDash.allowed, true);
  assert.equal(adminDash.generalStats.totalClasses, 17);
  assert.equal(adminDash.generalStats.totalStudents, 920);
  assert.equal(adminDash.generalStats.activeRosterStudentsCount, 56);
  assert.equal(adminDash.generalStats.totalSubjects, 5);
  assert.ok(adminDash.examinationOverview.recentActivities.length > 0);

  // 2. Adding a new student to CLS-12C immediately updates both single-class and global Dashboard counts in real time!
  const newStudentId = 'STD-9999';
  db = {
    ...db,
    Students: [
      ...db.Students,
      {
        ...db.Students[0],
        StudentID: newStudentId,
        StudentCode: '9999',
        LastNameKh: 'សុខ',
        FirstNameKh: 'ពិសិដ្ឋ',
        FullNameKh: 'សុខ ពិសិដ្ឋ',
        Gender: 'ប្រុស',
      },
    ],
    Enrollments: [
      ...db.Enrollments,
      {
        ...db.Enrollments[0],
        EnrollmentID: 'ENR-9999',
        StudentID: newStudentId,
        AcademicYearID: 'AY-2025-2026',
        ClassID: 'CLS-12C',
        EnrollmentDate: '2026-10-01',
        EnrollmentStatus: 'កំពុងរៀន',
        Remarks: '',
      },
    ],
  };

  const adminDashAfterAdd = computeSynchronizedDashboardData(db, 'USR-SUP-01');
  assert.equal(adminDashAfterAdd.generalStats.totalStudents, 921);
  assert.equal(adminDashAfterAdd.generalStats.activeRosterStudentsCount, 57);

  const class12CDashAfterAdd = computeSynchronizedDashboardData(db, 'USR-TCH-12C', {
    classId: 'CLS-12C',
  });
  assert.equal(class12CDashAfterAdd.generalStats.totalStudents, 57);
  assert.equal(class12CDashAfterAdd.generalStats.activeRosterStudentsCount, 57);

  // 3. Test Dashboard filters (Grade Level = '12', Subject = 'SUB-ICT', ExamType = 'MONTHLY')
  const grade12Dash = computeSynchronizedDashboardData(db, 'USR-SUP-01', {
    gradeLevel: '12',
    subjectId: 'SUB-ICT',
    examType: 'MONTHLY',
  });
  assert.equal(grade12Dash.generalStats.totalClasses, 3); // 12A, 12B, 12C
  assert.equal(grade12Dash.academicPerformance.subjectPerformance.length, 1);
  assert.equal(
    grade12Dash.academicPerformance.subjectPerformance[0].subjectId,
    'SUB-ICT'
  );

  // 4. Student role is denied administrative dashboard and 9-group staff sidebar
  const studentSidebar = getAuthorizedSidebar9Groups(db, 'USR-STD-6463');
  assert.equal(studentSidebar.groups.length, 0);
  const studentDash = computeSynchronizedDashboardData(db, 'USR-STD-6463');
  assert.equal(studentDash.allowed, false);

  // 5. Verify 6 Report Subgroups (A through F, 29 total reports) and dynamic report generation
  assert.equal(REPORT_CATEGORIES_CATALOG.length, 6);
  const totalReportsCount = REPORT_CATEGORIES_CATALOG.reduce(
    (sum, sg) => sum + sg.reports.length,
    0
  );
  assert.equal(totalReportsCount, 29);

  const studentRep = generateCategorizedReportData(
    db,
    { reportId: 'A4_STUDENT_MONTHLY_RESULTS', classId: 'CLS-12C', month: 'វិច្ឆិកា' },
    'USR-SUP-01'
  );
  assert.equal(studentRep.rows.length, 57); // reflects the newly added student!

  const top5Rep = generateCategorizedReportData(
    db,
    { reportId: 'F5_TOP_5_STUDENTS', classId: 'CLS-12C', month: 'វិច្ឆិកា' },
    'USR-SUP-01'
  );
  assert.equal(top5Rep.rows.length, 5);
});





