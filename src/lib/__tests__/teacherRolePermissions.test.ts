import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDatabaseState } from '../seedData';
import {
  DUAL_ROLE_POLICY_STATEMENT_KH,
  HOMEROOM_TEACHER_PERMISSIONS_KH,
  SUBJECT_TEACHER_PERMISSIONS_KH,
  evaluateTeacherAccountPermissions,
} from '../teacherRolePermissions';

test('Homeroom Teacher and Subject Teacher permission lists contain exact 6 Khmer policy items each', () => {
  assert.equal(HOMEROOM_TEACHER_PERMISSIONS_KH.length, 6);
  assert.equal(SUBJECT_TEACHER_PERMISSIONS_KH.length, 6);
  assert.equal(
    HOMEROOM_TEACHER_PERMISSIONS_KH[0].labelKh,
    'គ្រប់គ្រងបញ្ជីសិស្សក្នុងថ្នាក់របស់ខ្លួន។'
  );
  assert.equal(
    HOMEROOM_TEACHER_PERMISSIONS_KH[4].labelKh,
    'បញ្ចូល និងកែប្រែពិន្ទុតាមមុខវិជ្ជាដែលខ្លួនបង្រៀន។'
  );
  assert.equal(
    SUBJECT_TEACHER_PERMISSIONS_KH[0].labelKh,
    'មើលថ្នាក់ និងបញ្ជីសិស្សដែលខ្លួនបង្រៀន។'
  );
  assert.equal(
    SUBJECT_TEACHER_PERMISSIONS_KH[5].labelKh,
    'បង្កើត និងបោះពុម្ពរបាយការណ៍មុខវិជ្ជា។'
  );
  assert.ok(
    DUAL_ROLE_POLICY_STATEMENT_KH.includes('គ្រូម្នាក់អាចមានតួនាទីទាំងពីរក្នុងគណនីតែមួយ')
  );
});

test('Single teacher account USR-TCH-12C holds both Homeroom Teacher and Subject Teacher roles simultaneously', () => {
  const db = createInitialDatabaseState();
  const eval12C = evaluateTeacherAccountPermissions(
    db,
    'USR-TCH-12C',
    'AY-2025-2026'
  );

  assert.equal(eval12C.isHomeroomTeacher, true);
  assert.equal(eval12C.isSubjectTeacher, true);
  assert.equal(eval12C.hasBothRolesInSingleAccount, true);
  assert.ok(eval12C.homeroomClassIds.includes('CLS-12C'));
  assert.ok(eval12C.taughtSubjectIds.includes('SUB-ICT'));

  // Homeroom teacher permissions on own class 12C
  assert.equal(eval12C.canManageStudentRosterInClass('CLS-12C'), true);
  assert.equal(eval12C.canViewAllSubjectScoresInClass('CLS-12C'), true);
  assert.equal(eval12C.canTrackClassResultAndRanking('CLS-12C'), true);
  assert.equal(eval12C.canPrintClassReport('CLS-12C'), true);

  // Cannot manage student roster or print class report of an unassigned homeroom class (e.g. CLS-7A)
  assert.equal(eval12C.canManageStudentRosterInClass('CLS-7A'), false);
  assert.equal(eval12C.canPrintClassReport('CLS-7A'), false);

  // Subject teacher permissions on taught subject (SUB-ICT)
  assert.equal(eval12C.canEditSubjectScoreInClass('SUB-ICT', 'CLS-12C'), true);
  assert.equal(eval12C.canManageQuestionsAndExamsForSubject('SUB-ICT', 'CLS-12C'), true);
  assert.equal(eval12C.canViewAndPrintSubjectReport('SUB-ICT', 'CLS-12C'), true);

  // Cannot manage exam questions for a subject not taught by this teacher (e.g. SUB-KHMER)
  assert.equal(eval12C.canManageQuestionsAndExamsForSubject('SUB-KHMER', 'CLS-12C'), false);
});
