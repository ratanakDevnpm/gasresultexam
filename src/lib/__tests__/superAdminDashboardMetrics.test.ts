import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDatabaseState } from '../seedData';
import { computeSuperAdminDashboardMetrics } from '../superAdminDashboardMetrics';

test('Super Admin Dashboard computes all 8 Summary Cards from real database data and maps navigation targets', () => {
  const db = createInitialDatabaseState();
  const metrics = computeSuperAdminDashboardMetrics(db, {
    academicYearId: 'ALL',
    semesterId: 'ALL',
    dateFilter: 'ALL',
    classId: 'ALL',
  });

  assert.equal(metrics.summaryCards.length, 8);

  const ids = metrics.summaryCards.map((c) => c.id);
  assert.deepEqual(ids, [
    'TOTAL_STUDENTS',
    'TOTAL_TEACHERS',
    'TOTAL_SUBJECTS',
    'TOTAL_CLASSES',
    'TOTAL_EXAMS',
    'TOTAL_RESULTS',
    'ACTIVE_USERS',
    'PENDING_TASKS',
  ]);

  const studentsCard = metrics.summaryCards.find((c) => c.id === 'TOTAL_STUDENTS')!;
  assert.equal(studentsCard.primaryValue, db.Students.length);
  assert.equal(studentsCard.targetSection, 'STUDENTS');

  const teachersCard = metrics.summaryCards.find((c) => c.id === 'TOTAL_TEACHERS')!;
  assert.ok(teachersCard.primaryValue > 0);
  assert.equal(teachersCard.targetSection, 'TEACHERS');

  const subjectsCard = metrics.summaryCards.find((c) => c.id === 'TOTAL_SUBJECTS')!;
  assert.equal(subjectsCard.primaryValue, db.Subjects.length);
  assert.equal(subjectsCard.targetSection, 'SUBJECT_MANAGEMENT');

  const classesCard = metrics.summaryCards.find((c) => c.id === 'TOTAL_CLASSES')!;
  assert.equal(classesCard.primaryValue, db.Classes.length);
  assert.equal(classesCard.targetSection, 'CLASSES');

  const examsCard = metrics.summaryCards.find((c) => c.id === 'TOTAL_EXAMS')!;
  assert.equal(examsCard.primaryValue, db.Exams.length);
  assert.equal(examsCard.targetSection, 'ONLINE_EXAMS');

  const resultsCard = metrics.summaryCards.find((c) => c.id === 'TOTAL_RESULTS')!;
  assert.equal(
    resultsCard.primaryValue,
    db.MonthlyScores.length + db.SemesterScores.length + db.AnnualResults.length
  );
  assert.equal(resultsCard.targetSection, 'SCORES_RANKING');

  const activeUsersCard = metrics.summaryCards.find((c) => c.id === 'ACTIVE_USERS')!;
  assert.equal(
    activeUsersCard.primaryValue,
    db.Users.filter((u) => u.Status === 'ACTIVE').length
  );
  assert.equal(activeUsersCard.targetSection, 'USER_ACCESS');

  const pendingTasksCard = metrics.summaryCards.find((c) => c.id === 'PENDING_TASKS')!;
  assert.ok(pendingTasksCard.primaryValue >= 0);
  assert.equal(pendingTasksCard.targetSection, 'SCORE_MANAGEMENT');
});

test('Super Admin Dashboard dynamically updates when filtering by Class, Academic Year, Semester, and Date', () => {
  const db = createInitialDatabaseState();

  const class12CMetrics = computeSuperAdminDashboardMetrics(db, {
    academicYearId: 'AY-2025-2026',
    semesterId: 'SEM-2526-1',
    dateFilter: 'ALL',
    classId: 'CLS-12C',
  });

  const students12C = class12CMetrics.summaryCards.find(
    (c) => c.id === 'TOTAL_STUDENTS'
  )!;
  assert.equal(students12C.primaryValue, 56);

  const classes12C = class12CMetrics.summaryCards.find(
    (c) => c.id === 'TOTAL_CLASSES'
  )!;
  assert.equal(classes12C.primaryValue, 1);

  const class7AMetrics = computeSuperAdminDashboardMetrics(db, {
    academicYearId: 'AY-2025-2026',
    semesterId: 'SEM-2526-1',
    dateFilter: 'ALL',
    classId: 'CLS-7A',
  });
  const students7A = class7AMetrics.summaryCards.find(
    (c) => c.id === 'TOTAL_STUDENTS'
  )!;
  assert.equal(students7A.primaryValue, 6);

  // Date filter '2026-10' scopes Exams to October exams
  const octMetrics = computeSuperAdminDashboardMetrics(db, {
    academicYearId: 'AY-2025-2026',
    semesterId: 'SEM-2526-1',
    dateFilter: '2026-10',
    classId: 'ALL',
  });
  assert.equal(octMetrics.examinationOverview.totalCount, 1);
  assert.equal(octMetrics.examinationOverview.exams[0].examId, 'EXM-2526-ICT-OCT');
});

test('Super Admin Dashboard Analytics, Examination Overview, Recent Activities, and System Overview contain complete real data', () => {
  const db = createInitialDatabaseState();
  const metrics = computeSuperAdminDashboardMetrics(db, {
    academicYearId: 'ALL',
    semesterId: 'ALL',
    dateFilter: 'ALL',
    classId: 'ALL',
  });

  // Analytics: Grades 7..12 and Academic Grades A..F
  assert.equal(metrics.analytics.studentsByGradeLevel.length, 6);
  assert.equal(metrics.analytics.studentsByAcademicGrade.length, 6);
  assert.equal(
    metrics.analytics.examinationStatistics.questionBankTotal,
    db.Questions.length
  );
  assert.ok(metrics.analytics.passFailRate.passRatePct > 0);

  // Examination Overview
  assert.equal(metrics.examinationOverview.totalCount, db.Exams.length);

  // Recent Activities (User Actions, Score Updates, Exam Creation, Login History)
  assert.ok(metrics.recentActivities.totalCount > 0);
  assert.ok(metrics.recentActivities.userActionsCount > 0);
  assert.ok(metrics.recentActivities.scoreUpdatesCount > 0);
  assert.ok(metrics.recentActivities.examCreationCount > 0);
  assert.ok(metrics.recentActivities.loginHistoryCount > 0);

  // System Overview (25 tables, 488 records, 18 backend modules)
  assert.equal(metrics.systemOverview.databaseStatus.totalTables, 25);
  assert.equal(metrics.systemOverview.databaseStatus.totalRecords, 488);
  assert.equal(metrics.systemOverview.databaseStatus.duplicateIdErrors, 0);
  assert.ok(metrics.systemOverview.serverStatus.backendModulesCount >= 17);
  assert.equal(metrics.systemOverview.onlineUsers.totalUsers, db.Users.length);
  assert.equal(
    metrics.systemOverview.auditLogsSummary.totalAuditLogs,
    db.AuditLogs.length
  );
});
