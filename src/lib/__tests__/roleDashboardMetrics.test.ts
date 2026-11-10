import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDatabaseState } from '../seedData';
import {
  DASHBOARD_STRUCTURE_MATRIX_ROWS,
  HOMEROOM_DASHBOARD_SPEC_ITEMS_KH,
  SUBJECT_TEACHER_DASHBOARD_SPEC_ITEMS_KH,
  UNIFIED_DASHBOARD_RECOMMENDATION_KH,
  computeUnifiedRoleAdaptiveDashboardData,
} from '../roleDashboardMetrics';

test('Dashboard specification lists contain exact 8 items for Homeroom Teacher, 8 items for Subject Teacher, and 8 Structure Matrix rows', () => {
  assert.equal(HOMEROOM_DASHBOARD_SPEC_ITEMS_KH.length, 8);
  assert.equal(SUBJECT_TEACHER_DASHBOARD_SPEC_ITEMS_KH.length, 8);
  assert.equal(DASHBOARD_STRUCTURE_MATRIX_ROWS.length, 8);

  // Verify specific matrix scopes from user prompt
  const top5Row = DASHBOARD_STRUCTURE_MATRIX_ROWS.find(
    (r) => r.sectionName === 'Top 5 Students'
  );
  assert.equal(top5Row?.homeroomTeacherScope, '✓');
  assert.equal(top5Row?.subjectTeacherScope, 'តាមសិទ្ធិ');

  const subPerfRow = DASHBOARD_STRUCTURE_MATRIX_ROWS.find(
    (r) => r.sectionName === 'Subject Performance'
  );
  assert.equal(subPerfRow?.homeroomTeacherScope, '✓');
  assert.equal(subPerfRow?.subjectTeacherScope, 'មុខវិជ្ជាខ្លួន');

  const examStatsRow = DASHBOARD_STRUCTURE_MATRIX_ROWS.find(
    (r) => r.sectionName === 'Exam Statistics'
  );
  assert.equal(examStatsRow?.homeroomTeacherScope, '✓');
  assert.equal(examStatsRow?.subjectTeacherScope, 'មុខវិជ្ជាខ្លួន');

  assert.ok(
    UNIFIED_DASHBOARD_RECOMMENDATION_KH.includes(
      'ដោយសារគ្រូបន្ទុកថ្នាក់ក៏ជាគ្រូមុខវិជ្ជាដែរ ប្រព័ន្ធគួរប្រើ Dashboard តែមួយ'
    )
  );
});

test('computeUnifiedRoleAdaptiveDashboardData computes all 8 Homeroom sections and 8 Subject Teacher sections for dual-role teacher USR-TCH-12C', () => {
  const db = createInitialDatabaseState();
  const unified = computeUnifiedRoleAdaptiveDashboardData(
    db,
    'USR-TCH-12C',
    'CLS-12C'
  );

  assert.equal(unified.isHomeroomTeacher, true);
  assert.equal(unified.isSubjectTeacher, true);
  assert.equal(unified.hasBothRoles, true);

  // Homeroom 8 sections
  assert.equal(unified.homeroomDashboard.classInfo.className, '12C');
  assert.ok(unified.homeroomDashboard.studentCounts.totalStudents > 0);
  assert.ok(unified.homeroomDashboard.academicStats.averageScore > 0);
  assert.equal(unified.homeroomDashboard.top5Students.length, 5);
  assert.ok(unified.homeroomDashboard.subjectScoreGraph.length > 0);
  assert.ok(unified.homeroomDashboard.scoreEntryStatuses.length > 0);
  assert.ok(unified.homeroomDashboard.recentExamResultsSummary.length > 0);
  assert.ok(unified.homeroomDashboard.recentActivities.length > 0);

  // Subject Teacher 8 sections
  assert.ok(unified.subjectTeacherDashboard.taughtSubjectsAndClasses.length > 0);
  assert.ok(
    unified.subjectTeacherDashboard.taughtClassStudentCounts
      .totalStudentsAcrossTaughtClasses > 0
  );
  assert.ok(
    unified.subjectTeacherDashboard.subjectScoreAndPassFailStats.length > 0
  );
  assert.ok(
    unified.subjectTeacherDashboard.scoreEntryStatusByTaughtClass.length > 0
  );
  assert.ok(
    unified.subjectTeacherDashboard.examManagementSummary
      .totalExamsForMySubjects > 0
  );
  assert.ok(
    unified.subjectTeacherDashboard.questionBankSummary.totalCreatedQuestions >
      0
  );
  assert.ok(unified.subjectTeacherDashboard.recentActivities.length > 0);
});
