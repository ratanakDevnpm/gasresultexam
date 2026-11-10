import {
  ClassRecord,
  DatabaseState,
  SubjectRecord,
  UserRecord,
} from '../types/database';
import {
  canAccessScoreManagementOperation,
  getUserEffectiveRoles,
} from './domainRules';

export interface TeacherRolePermissionItem {
  id: string;
  order: number;
  labelKh: string;
  category:
    | 'STUDENT_ROSTER'
    | 'SCORE_MONITORING'
    | 'RANKING_AND_RESULTS'
    | 'CLASS_REPORT'
    | 'SCORE_ENTRY'
    | 'QUESTION_AND_EXAM'
    | 'SUBJECT_REPORT';
}

export const HOMEROOM_TEACHER_ROLE_TITLE_KH = '1. គ្រូបន្ទុកថ្នាក់ (Homeroom Teacher)';
export const SUBJECT_TEACHER_ROLE_TITLE_KH = '2. គ្រូមុខវិជ្ជា (Subject Teacher)';

export const DUAL_ROLE_POLICY_STATEMENT_KH =
  'គោលការណ៍កំណត់សិទ្ធិ៖ គ្រូម្នាក់អាចមានតួនាទីទាំងពីរក្នុងគណនីតែមួយ។ គ្រូបន្ទុកថ្នាក់មានសិទ្ធិគ្រប់គ្រងសិស្សតាមថ្នាក់របស់ខ្លួន និងមានសិទ្ធិគ្រប់គ្រងមុខវិជ្ជាដែលខ្លួនបង្រៀនផ្ទាល់។';

export const HOMEROOM_TEACHER_PERMISSIONS_KH: readonly TeacherRolePermissionItem[] = [
  {
    id: 'HR-PERM-01',
    order: 1,
    labelKh: 'គ្រប់គ្រងបញ្ជីសិស្សក្នុងថ្នាក់របស់ខ្លួន។',
    category: 'STUDENT_ROSTER',
  },
  {
    id: 'HR-PERM-02',
    order: 2,
    labelKh: 'មើល និងតាមដានពិន្ទុគ្រប់មុខវិជ្ជា។',
    category: 'SCORE_MONITORING',
  },
  {
    id: 'HR-PERM-03',
    order: 3,
    labelKh: 'តាមដានលទ្ធផលសិក្សា និងចំណាត់ថ្នាក់សិស្ស។',
    category: 'RANKING_AND_RESULTS',
  },
  {
    id: 'HR-PERM-04',
    order: 4,
    labelKh: 'បង្កើត និងបោះពុម្ពរបាយការណ៍ថ្នាក់។',
    category: 'CLASS_REPORT',
  },
  {
    id: 'HR-PERM-05',
    order: 5,
    labelKh: 'បញ្ចូល និងកែប្រែពិន្ទុតាមមុខវិជ្ជាដែលខ្លួនបង្រៀន។',
    category: 'SCORE_ENTRY',
  },
  {
    id: 'HR-PERM-06',
    order: 6,
    labelKh: 'បង្កើតសំណួរ និងគ្រប់គ្រងការប្រឡងសម្រាប់មុខវិជ្ជាដែលខ្លួនបង្រៀន។',
    category: 'QUESTION_AND_EXAM',
  },
] as const;

export const SUBJECT_TEACHER_PERMISSIONS_KH: readonly TeacherRolePermissionItem[] = [
  {
    id: 'SUB-PERM-01',
    order: 1,
    labelKh: 'មើលថ្នាក់ និងបញ្ជីសិស្សដែលខ្លួនបង្រៀន។',
    category: 'STUDENT_ROSTER',
  },
  {
    id: 'SUB-PERM-02',
    order: 2,
    labelKh: 'បញ្ចូល និងកែប្រែពិន្ទុតាមមុខវិជ្ជាដែលខ្លួនទទួលបន្ទុក។',
    category: 'SCORE_ENTRY',
  },
  {
    id: 'SUB-PERM-03',
    order: 3,
    labelKh: 'បង្កើត កែប្រែ និងគ្រប់គ្រងសំណួរប្រឡង។',
    category: 'QUESTION_AND_EXAM',
  },
  {
    id: 'SUB-PERM-04',
    order: 4,
    labelKh: 'រៀបចំវិញ្ញាសា និងការប្រឡងអនឡាញ។',
    category: 'QUESTION_AND_EXAM',
  },
  {
    id: 'SUB-PERM-05',
    order: 5,
    labelKh: 'មើលលទ្ធផល និងស្ថិតិពិន្ទុតាមមុខវិជ្ជា។',
    category: 'SCORE_MONITORING',
  },
  {
    id: 'SUB-PERM-06',
    order: 6,
    labelKh: 'បង្កើត និងបោះពុម្ពរបាយការណ៍មុខវិជ្ជា។',
    category: 'SUBJECT_REPORT',
  },
] as const;

export interface TeacherDualRolePermissionEvaluation {
  userId: string;
  user: UserRecord | undefined;
  academicYearId: string;
  isHomeroomTeacher: boolean;
  isSubjectTeacher: boolean;
  hasBothRolesInSingleAccount: boolean;
  roleSummaryLabelKh: string;
  homeroomClassIds: string[];
  homeroomClasses: ClassRecord[];
  taughtSubjectIds: string[];
  taughtSubjects: SubjectRecord[];
  taughtClassIds: string[];
  taughtClasses: ClassRecord[];
  classesBySubjectId: Record<string, ClassRecord[]>;
  homeroomPermissions: readonly TeacherRolePermissionItem[];
  subjectTeacherPermissions: readonly TeacherRolePermissionItem[];
  policyStatementKh: string;
  // Granular check helpers bound to this teacher's single account
  canManageStudentRosterInClass: (classId: string) => boolean;
  canViewStudentListInClass: (classId: string) => boolean;
  canViewAllSubjectScoresInClass: (classId: string) => boolean;
  canTrackClassResultAndRanking: (classId: string) => boolean;
  canPrintClassReport: (classId: string) => boolean;
  canEditSubjectScoreInClass: (subjectId: string, classId: string) => boolean;
  canManageQuestionsAndExamsForSubject: (subjectId: string, classId?: string) => boolean;
  canViewAndPrintSubjectReport: (subjectId: string, classId?: string) => boolean;
}

/**
 * Evaluates a teacher account's dual-role permissions (`គ្រូបន្ទុកថ្នាក់` + `គ្រូមុខវិជ្ជា`)
 * within a single user account (`គណនីតែមួយ`), enforcing the rule:
 * - A teacher can hold both Homeroom Teacher and Subject Teacher roles in one account.
 * - As Homeroom Teacher: manages students in their own homeroom class, monitors all subjects' scores,
 *   tracks rankings/results, prints class reports, and enters/edits scores & exams for subjects they personally teach.
 * - As Subject Teacher: views classes/students they teach, enters/edits scores for their assigned subjects,
 *   creates/manages exam questions & online exams, views subject statistics, and prints subject reports.
 */
export function evaluateTeacherAccountPermissions(
  db: DatabaseState,
  userId: string,
  academicYearId: string = 'ALL'
): TeacherDualRolePermissionEvaluation {
  const effective = getUserEffectiveRoles(db, userId, academicYearId);
  const user = db.Users.find((u) => u.UserID === userId);
  const isHomeroomTeacher = effective.isHomeroomTeacher;
  const isSubjectTeacher = effective.isSubjectTeacher;
  const hasBothRolesInSingleAccount = isHomeroomTeacher && isSubjectTeacher;

  const activeSubjectAssignments = (db.TeacherSubjectAssignments || []).filter(
    (a) =>
      a.TeacherID === userId &&
      a.Status === 'ACTIVE' &&
      (academicYearId === 'ALL' || !academicYearId || a.AcademicYearID === academicYearId)
  );

  const taughtClassIds = Array.from(
    new Set(activeSubjectAssignments.map((a) => a.ClassID))
  );
  const taughtClasses = db.Classes.filter((c) => taughtClassIds.includes(c.ClassID));

  const classesBySubjectId: Record<string, ClassRecord[]> = {};
  effective.assignedSubjectIds.forEach((subId) => {
    const clsIdsForSub = Array.from(
      new Set(
        activeSubjectAssignments
          .filter((a) => a.SubjectID === subId)
          .map((a) => a.ClassID)
      )
    );
    classesBySubjectId[subId] = db.Classes.filter((c) => clsIdsForSub.includes(c.ClassID));
  });

  const isAdminOrSuperAdmin =
    effective.primaryRole === 'SUPER_ADMIN' || effective.primaryRole === 'ADMIN';

  let roleSummaryLabelKh = 'គ្រូបង្រៀនទូទៅ';
  if (hasBothRolesInSingleAccount) {
    roleSummaryLabelKh = 'គ្រូបន្ទុកថ្នាក់ និងគ្រូមុខវិជ្ជា (តួនាទីទាំងពីរក្នុងគណនីតែមួយ)';
  } else if (isHomeroomTeacher) {
    roleSummaryLabelKh = 'គ្រូបន្ទុកថ្នាក់ (Homeroom Teacher)';
  } else if (isSubjectTeacher) {
    roleSummaryLabelKh = 'គ្រូមុខវិជ្ជា (Subject Teacher)';
  }

  const canManageStudentRosterInClass = (classId: string): boolean => {
    if (!user || user.Status !== 'ACTIVE') return false;
    if (isAdminOrSuperAdmin) return true;
    return effective.activeHomeroomClassIds.includes(classId);
  };

  const canViewStudentListInClass = (classId: string): boolean => {
    if (!user || user.Status !== 'ACTIVE') return false;
    if (isAdminOrSuperAdmin) return true;
    return (
      effective.activeHomeroomClassIds.includes(classId) ||
      taughtClassIds.includes(classId)
    );
  };

  const canViewAllSubjectScoresInClass = (classId: string): boolean => {
    if (!user || user.Status !== 'ACTIVE') return false;
    if (isAdminOrSuperAdmin) return true;
    return effective.activeHomeroomClassIds.includes(classId);
  };

  const canTrackClassResultAndRanking = (classId: string): boolean => {
    if (!user || user.Status !== 'ACTIVE') return false;
    if (isAdminOrSuperAdmin || effective.primaryRole === 'VIEWER') return true;
    return effective.activeHomeroomClassIds.includes(classId);
  };

  const canPrintClassReport = (classId: string): boolean => {
    if (!user || user.Status !== 'ACTIVE') return false;
    if (isAdminOrSuperAdmin) return true;
    return effective.activeHomeroomClassIds.includes(classId);
  };

  const canEditSubjectScoreInClass = (subjectId: string, classId: string): boolean => {
    if (!user || user.Status !== 'ACTIVE') return false;
    if (isAdminOrSuperAdmin) return true;
    // Strict enforcement of the policy:
    // Homeroom Teacher & Subject Teacher can enter/edit scores for subjects they personally teach in that class
    // (`បញ្ចូល និងកែប្រែពិន្ទុតាមមុខវិជ្ជាដែលខ្លួនបង្រៀន / ទទួលបន្ទុក`)
    const teachesSubjectInClass = activeSubjectAssignments.some(
      (a) => a.SubjectID === subjectId && a.ClassID === classId
    );
    if (teachesSubjectInClass) return true;
    const access = canAccessScoreManagementOperation(db, userId, {
      subjectId,
      classId,
      academicYearId: academicYearId === 'ALL' ? undefined : academicYearId,
      operation: 'ENTER_OR_EDIT',
    });
    return access.allowed && effective.assignedSubjectIds.includes(subjectId);
  };

  const canManageQuestionsAndExamsForSubject = (
    subjectId: string,
    classId?: string
  ): boolean => {
    if (!user || user.Status !== 'ACTIVE') return false;
    if (isAdminOrSuperAdmin) return true;
    if (!effective.assignedSubjectIds.includes(subjectId)) return false;
    if (classId) {
      return activeSubjectAssignments.some(
        (a) => a.SubjectID === subjectId && a.ClassID === classId
      );
    }
    return true;
  };

  const canViewAndPrintSubjectReport = (
    subjectId: string,
    classId?: string
  ): boolean => {
    if (!user || user.Status !== 'ACTIVE') return false;
    if (isAdminOrSuperAdmin) return true;
    if (classId && effective.activeHomeroomClassIds.includes(classId)) {
      return true;
    }
    if (!effective.assignedSubjectIds.includes(subjectId)) return false;
    if (classId) {
      return activeSubjectAssignments.some(
        (a) => a.SubjectID === subjectId && a.ClassID === classId
      );
    }
    return true;
  };

  return {
    userId,
    user,
    academicYearId,
    isHomeroomTeacher,
    isSubjectTeacher,
    hasBothRolesInSingleAccount,
    roleSummaryLabelKh,
    homeroomClassIds: effective.activeHomeroomClassIds,
    homeroomClasses: effective.activeHomeroomClasses,
    taughtSubjectIds: effective.assignedSubjectIds,
    taughtSubjects: effective.assignedSubjects,
    taughtClassIds,
    taughtClasses,
    classesBySubjectId,
    homeroomPermissions: isHomeroomTeacher ? HOMEROOM_TEACHER_PERMISSIONS_KH : [],
    subjectTeacherPermissions: isSubjectTeacher ? SUBJECT_TEACHER_PERMISSIONS_KH : [],
    policyStatementKh: DUAL_ROLE_POLICY_STATEMENT_KH,
    canManageStudentRosterInClass,
    canViewStudentListInClass,
    canViewAllSubjectScoresInClass,
    canTrackClassResultAndRanking,
    canPrintClassReport,
    canEditSubjectScoreInClass,
    canManageQuestionsAndExamsForSubject,
    canViewAndPrintSubjectReport,
  };
}
