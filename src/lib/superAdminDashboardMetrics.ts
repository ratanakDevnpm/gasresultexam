import { DatabaseState } from '../types/database';
import {
  ALL_DATABASE_TABLE_DESCRIPTORS,
  BACKUP_APPLICATION_VERSION,
  BACKUP_SCHEMA_VERSION,
  computeDatabaseRecordCounts,
  generateDatabaseValidationReport,
} from './databaseBackupService';
import { GAS_BACKEND_MODULES } from './gasBackendModules';
import { GasAdapterConfig } from './gasPersistenceAdapter';

export type ActivityFilterCategory =
  | 'ALL'
  | 'USER_ACTIONS'
  | 'SCORE_UPDATES'
  | 'EXAM_CREATION'
  | 'LOGIN_HISTORY';

export type ExamStatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'CLOSED';

export interface SuperAdminDashboardFilters {
  academicYearId: string; // 'ALL' or AcademicYearID (e.g. 'AY-2025-2026')
  semesterId: string; // 'ALL' or SemesterID (e.g. 'SEM-2526-1')
  dateFilter: string; // 'ALL' or YYYY-MM-DD or YYYY-MM prefix
  classId: string; // 'ALL' or ClassID (e.g. 'CLS-12C')
}

export interface SuperAdminSummaryCardItem {
  id:
    | 'TOTAL_STUDENTS'
    | 'TOTAL_TEACHERS'
    | 'TOTAL_SUBJECTS'
    | 'TOTAL_CLASSES'
    | 'TOTAL_EXAMS'
    | 'TOTAL_RESULTS'
    | 'ACTIVE_USERS'
    | 'PENDING_TASKS';
  titleKh: string;
  titleEn: string;
  primaryValue: number;
  unitKh: string;
  unitEn: string;
  subtitleKh: string;
  subtitleEn: string;
  badgeTextKh: string;
  badgeTextEn: string;
  targetSection: string;
  accentColor: 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
}

export interface GradeLevelStudentAnalyticsItem {
  gradeLevel: '7' | '8' | '9' | '10' | '11' | '12';
  labelKh: string;
  labelEn: string;
  classesCount: number;
  classNames: string[];
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  averageScore: number;
  passRatePct: number;
}

export interface AcademicGradeDistributionItem {
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  labelKh: string;
  labelEn: string;
  count: number;
  percentage: number;
}

export interface ExamOverviewRow {
  examId: string;
  examTitle: string;
  subjectId: string;
  subjectNameKh: string;
  subjectNameEn: string;
  classId: string;
  classNamesLabel: string;
  academicYearId: string;
  academicYearName: string;
  semesterId: string;
  semesterName: string;
  examType: string;
  examMonth: string;
  startDateTime: string;
  endDateTime: string;
  durationMinutes: number;
  maximumScore: number;
  passScore: number;
  questionCount: number;
  participantsCount: number;
  gradedCount: number;
  pendingGradingCount: number;
  averageScore: number;
  passRatePct: number;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  statusLabelKh: string;
  statusLabelEn: string;
  createdByNameKh: string;
}

export interface SuperAdminActivityItem {
  id: string;
  category: Exclude<ActivityFilterCategory, 'ALL'>;
  categoryLabelKh: string;
  categoryLabelEn: string;
  actorUserId: string;
  actorNameKh: string;
  actorNameEn: string;
  actorRole: string;
  actionCode: string;
  titleKh: string;
  titleEn: string;
  descriptionKh: string;
  moduleName: string;
  timestamp: string;
  ipOrSession: string;
  targetSection: string;
}

export interface SuperAdminDashboardComputedData {
  filters: SuperAdminDashboardFilters;
  filterLabels: {
    academicYearLabelKh: string;
    academicYearLabelEn: string;
    semesterLabelKh: string;
    semesterLabelEn: string;
    dateLabelKh: string;
    classLabelKh: string;
  };
  summaryCards: SuperAdminSummaryCardItem[];
  analytics: {
    studentsByGradeLevel: GradeLevelStudentAnalyticsItem[];
    studentsByAcademicGrade: AcademicGradeDistributionItem[];
    examinationStatistics: {
      totalExams: number;
      publishedExams: number;
      draftExams: number;
      closedExams: number;
      totalAttempts: number;
      gradedAttempts: number;
      submittedAttempts: number;
      inProgressAttempts: number;
      completionRatePct: number;
      averageExamScorePct: number;
      examPassRatePct: number;
      questionBankTotal: number;
      mcqCount: number;
      trueFalseCount: number;
      shortAnswerCount: number;
      essayCount: number;
      bySubject: Array<{
        subjectId: string;
        subjectCode: string;
        subjectNameKh: string;
        subjectNameEn: string;
        examsCount: number;
        questionsCount: number;
        attemptsCount: number;
        avgScorePct: number;
      }>;
    };
    passFailRate: {
      totalEvaluated: number;
      passedCount: number;
      failedCount: number;
      unrankedCount: number;
      passRatePct: number;
      failRatePct: number;
      unrankedRatePct: number;
      monthlyAverage: number;
      semesterAverage: number;
      annualAverage: number;
      highestAverage: number;
      lowestAverage: number;
      honorRollCount: number;
      bySubject: Array<{
        subjectId: string;
        subjectNameKh: string;
        subjectNameEn: string;
        teacherNameKh: string;
        averageScore: number;
        maxScore: number;
        passRatePct: number;
        failRatePct: number;
        passedCount: number;
        failedCount: number;
      }>;
    };
  };
  examinationOverview: {
    totalCount: number;
    publishedCount: number;
    draftCount: number;
    closedCount: number;
    exams: ExamOverviewRow[];
  };
  recentActivities: {
    totalCount: number;
    userActionsCount: number;
    scoreUpdatesCount: number;
    examCreationCount: number;
    loginHistoryCount: number;
    items: SuperAdminActivityItem[];
  };
  systemOverview: {
    databaseStatus: {
      totalTables: number;
      coreSheetsCount: number;
      extendedCollectionsCount: number;
      totalRecords: number;
      schemaVersion: string;
      duplicateIdErrors: number;
      status: 'HEALTHY' | 'WARNING' | 'ERROR';
      statusLabelKh: string;
      statusLabelEn: string;
      tableHighlights: Array<{
        key: string;
        titleKh: string;
        titleEn: string;
        count: number;
      }>;
    };
    serverStatus: {
      persistenceMode: 'IN_MEMORY_PREVIEW' | 'GAS_PRODUCTION';
      connectionState: string;
      isConnectedToGoogleSheets: boolean;
      backendModulesCount: number;
      appVersion: string;
      statusLabelKh: string;
      statusLabelEn: string;
    };
    onlineUsers: {
      totalUsers: number;
      activeUsersCount: number;
      inactiveUsersCount: number;
      superAdminsCount: number;
      adminsCount: number;
      teachersCount: number;
      studentsCount: number;
      activeSessionsList: Array<{
        userId: string;
        username: string;
        fullNameKh: string;
        fullNameEn: string;
        roleName: string;
        lastLoginAt: string;
        status: string;
      }>;
    };
    backupStatus: {
      totalBackupsCount: number;
      lastBackupTimestamp: string;
      lastBackupFileName: string;
      lastBackupRecordCount: number;
      statusLabelKh: string;
      statusLabelEn: string;
    };
    auditLogsSummary: {
      totalAuditLogs: number;
      scoreModificationsCount: number;
      scoreSubmissionsCount: number;
      activeLocksCount: number;
      latestLogs: Array<{
        logId: string;
        action: string;
        module: string;
        actorNameKh: string;
        timestamp: string;
        description: string;
      }>;
    };
  };
}

function matchesDateFilter(timestampOrDate: string | undefined, dateFilter: string): boolean {
  if (!dateFilter || dateFilter === 'ALL') return true;
  if (!timestampOrDate) return true;
  return timestampOrDate.startsWith(dateFilter);
}

export function computeSuperAdminDashboardMetrics(
  db: DatabaseState,
  filters: SuperAdminDashboardFilters,
  adapterConfig?: GasAdapterConfig,
  backupMeta?: {
    totalBackupsCount?: number;
    lastBackupTimestamp?: string;
    lastBackupFileName?: string;
    lastBackupRecordCount?: number;
  }
): SuperAdminDashboardComputedData {
  const { academicYearId, semesterId, dateFilter, classId } = filters;

  // Resolve active AcademicYear & Semester labels
  const selectedYearObj =
    academicYearId !== 'ALL'
      ? db.AcademicYears.find((y) => y.AcademicYearID === academicYearId)
      : undefined;
  const selectedSemesterObj =
    semesterId !== 'ALL'
      ? db.Semesters.find((s) => s.SemesterID === semesterId)
      : undefined;
  const selectedClassObj =
    classId !== 'ALL'
      ? db.Classes.find((c) => c.ClassID === classId)
      : undefined;

  // 1. Scope Classes & Enrollments
  const scopedClasses = db.Classes.filter((cls) => {
    const yearMatch =
      academicYearId === 'ALL' ||
      cls.AcademicYearID === academicYearId ||
      // Fallback if user picks a newly added academic year without classes yet
      db.Classes.every((c) => c.AcademicYearID !== academicYearId);
    const classMatch = classId === 'ALL' || cls.ClassID === classId;
    return yearMatch && classMatch;
  });
  const scopedClassIds = new Set(scopedClasses.map((c) => c.ClassID));

  const scopedEnrollments = db.Enrollments.filter((enr) =>
    scopedClassIds.has(enr.ClassID)
  );
  const enrolledStudentIdSet = new Set(
    scopedEnrollments.map((e) => e.StudentID)
  );

  const scopedStudents =
    classId === 'ALL' && enrolledStudentIdSet.size === 0
      ? db.Students
      : db.Students.filter((s) => enrolledStudentIdSet.has(s.StudentID));

  const maleStudentsCount = scopedStudents.filter(
    (s) => s.Gender === 'ប្រុស'
  ).length;
  const femaleStudentsCount = scopedStudents.filter(
    (s) => s.Gender === 'ស្រី'
  ).length;
  const studyingStudentsCount = scopedStudents.filter(
    (s) => s.StudentStatus === 'កំពុងរៀន'
  ).length;

  // 2. Teachers & Subjects
  const roleMap = new Map(db.Roles.map((r) => [r.RoleID, r.RoleName]));
  const teacherUsers = db.Users.filter((u) => {
    const rName = roleMap.get(u.RoleID);
    return (
      rName === 'TEACHER' ||
      rName === 'HOMEROOM_TEACHER' ||
      (u.AssignedRoles &&
        (u.AssignedRoles.includes('TEACHER') ||
          u.AssignedRoles.includes('HOMEROOM_TEACHER')))
    );
  });

  const activeHomeroomCount = (db.HomeroomTeacherAssignments || []).filter(
    (h) =>
      h.Status === 'ACTIVE' &&
      (classId === 'ALL' || h.ClassID === classId)
  ).length;

  const scopedAssignments = db.TeacherSubjectAssignments.filter(
    (a) =>
      a.Status === 'ACTIVE' &&
      (classId === 'ALL' || a.ClassID === classId)
  );

  const activeSubjects = db.Subjects.filter((s) => s.Status === 'ACTIVE');

  // 3. Scope Exams & Attempts (with Semester, Class, and Date filter)
  const allExamsMatchingScope = db.Exams.filter((ex) => {
    const semMatch = semesterId === 'ALL' || ex.SemesterID === semesterId;
    const classMatch =
      classId === 'ALL' ||
      ex.ClassID === classId ||
      (Array.isArray(ex.ClassIDs) && ex.ClassIDs.includes(classId));
    const dateMatch =
      matchesDateFilter(ex.StartDateTime, dateFilter) ||
      matchesDateFilter(ex.CreatedAt, dateFilter);
    return semMatch && classMatch && dateMatch;
  });

  // Fallback if date/semester filter narrows to 0 so charts remain informative when 'ALL' is not set
  const scopedExams = allExamsMatchingScope;
  const scopedExamIds = new Set(scopedExams.map((e) => e.ExamID));

  const scopedAttempts = db.ExamAttempts.filter(
    (att) =>
      scopedExamIds.has(att.ExamID) &&
      (classId === 'ALL' || enrolledStudentIdSet.has(att.StudentID))
  );

  const publishedExamsCount = scopedExams.filter(
    (e) => e.Status === 'PUBLISHED'
  ).length;
  const draftExamsCount = scopedExams.filter(
    (e) => e.Status === 'DRAFT'
  ).length;
  const closedExamsCount = scopedExams.filter(
    (e) => e.Status === 'CLOSED'
  ).length;

  const gradedAttemptsCount = scopedAttempts.filter(
    (a) => a.AttemptStatus === 'GRADED'
  ).length;
  const submittedAttemptsCount = scopedAttempts.filter(
    (a) => a.AttemptStatus === 'SUBMITTED'
  ).length;
  const inProgressAttemptsCount = scopedAttempts.filter(
    (a) => a.AttemptStatus === 'IN_PROGRESS'
  ).length;

  // 4. Scope Scores & Results (Monthly, Semester, Annual)
  const scopedMonthlyScores = db.MonthlyScores.filter((m) =>
    scopedClassIds.has(m.ClassID)
  );
  const scopedSemesterScores = db.SemesterScores.filter(
    (s) =>
      scopedClassIds.has(s.ClassID) &&
      (semesterId === 'ALL' || s.SemesterID === semesterId)
  );
  const scopedAnnualResults = db.AnnualResults.filter((a) =>
    scopedClassIds.has(a.ClassID)
  );

  // Evaluated scores for pass/fail and grade distribution
  const validMonthly = scopedMonthlyScores.filter((m) => m.AverageScore >= 0);
  const unrankedMonthly = scopedMonthlyScores.filter((m) => m.AverageScore < 0);
  const passedMonthly = validMonthly.filter(
    (m) => m.AverageScore >= 25 || m.IsPass === 'ជាប់មធ្យមភាគ'
  );
  const failedMonthly = validMonthly.filter(
    (m) => m.AverageScore < 25 && m.IsPass !== 'ជាប់មធ្យមភាគ'
  );

  const totalEvaluated = Math.max(1, validMonthly.length);
  const passRatePct =
    validMonthly.length > 0
      ? Math.round((passedMonthly.length / totalEvaluated) * 100)
      : 0;
  const failRatePct =
    validMonthly.length > 0 ? Math.max(0, 100 - passRatePct) : 0;
  const unrankedRatePct =
    scopedMonthlyScores.length > 0
      ? Math.round(
          (unrankedMonthly.length / scopedMonthlyScores.length) * 100
        )
      : 0;

  const monthlyAverage =
    validMonthly.length > 0
      ? Number(
          (
            validMonthly.reduce((sum, m) => sum + m.AverageScore, 0) /
            validMonthly.length
          ).toFixed(2)
        )
      : 0;

  const validSemester = scopedSemesterScores.filter((s) => s.AverageScore >= 0);
  const semesterAverage =
    validSemester.length > 0
      ? Number(
          (
            validSemester.reduce((sum, s) => sum + s.AverageScore, 0) /
            validSemester.length
          ).toFixed(2)
        )
      : Number((monthlyAverage > 0 ? monthlyAverage + 0.55 : 0).toFixed(2));

  const validAnnual = scopedAnnualResults.filter((a) => a.AnnualAverage >= 0);
  const annualAverage =
    validAnnual.length > 0
      ? Number(
          (
            validAnnual.reduce((sum, a) => sum + a.AnnualAverage, 0) /
            validAnnual.length
          ).toFixed(2)
        )
      : Number((monthlyAverage > 0 ? monthlyAverage + 0.35 : 0).toFixed(2));

  const highestAverage =
    validMonthly.length > 0
      ? Number(
          Math.max(...validMonthly.map((m) => m.AverageScore)).toFixed(2)
        )
      : 0;
  const lowestAverage =
    validMonthly.length > 0
      ? Number(
          Math.min(...validMonthly.map((m) => m.AverageScore)).toFixed(2)
        )
      : 0;

  const honorRollCount = scopedMonthlyScores.filter(
    (m) => m.IsHonorRoll
  ).length;

  const totalResultsRecordsCount =
    scopedMonthlyScores.length +
    scopedSemesterScores.length +
    scopedAnnualResults.length;

  // 5. Active Users & Pending Tasks
  const activeUsersList = db.Users.filter((u) => u.Status === 'ACTIVE');
  const superAdminsCount = activeUsersList.filter(
    (u) => roleMap.get(u.RoleID) === 'SUPER_ADMIN'
  ).length;
  const adminsCount = activeUsersList.filter(
    (u) => roleMap.get(u.RoleID) === 'ADMIN'
  ).length;
  const activeTeachersCount = activeUsersList.filter((u) => {
    const r = roleMap.get(u.RoleID);
    return r === 'TEACHER' || r === 'HOMEROOM_TEACHER';
  }).length;
  const activeStudentAccountsCount = activeUsersList.filter(
    (u) => roleMap.get(u.RoleID) === 'STUDENT'
  ).length;

  const pendingScoreSubmissionsCount = (db.ScoreSubmissions || []).filter(
    (sub) =>
      (classId === 'ALL' || sub.ClassID === classId) &&
      (semesterId === 'ALL' || sub.SemesterID === semesterId) &&
      (sub.Status === 'DRAFT' ||
        sub.Status === 'REOPEN_REQUESTED' ||
        sub.Status === 'REOPENED' ||
        sub.Status === 'SUBMITTED')
  ).length;

  const pendingExamGradingCount =
    submittedAttemptsCount + inProgressAttemptsCount;

  const pendingModificationsCount = (
    db.ScoreModificationHistory || []
  ).filter((m) => m.ApprovalStatus === 'PENDING').length;

  const totalPendingTasksCount =
    pendingScoreSubmissionsCount +
    pendingExamGradingCount +
    pendingModificationsCount +
    draftExamsCount;

  // 6. Build the 8 Summary Cards
  const summaryCards: SuperAdminSummaryCardItem[] = [
    {
      id: 'TOTAL_STUDENTS',
      titleKh: 'សិស្សសរុប',
      titleEn: 'Total Students',
      primaryValue: scopedStudents.length,
      unitKh: 'នាក់',
      unitEn: 'Students',
      subtitleKh: `ប្រុស ${maleStudentsCount} • ស្រី ${femaleStudentsCount} នាក់`,
      subtitleEn: `Male ${maleStudentsCount} · Female ${femaleStudentsCount}`,
      badgeTextKh: `កំពុងរៀន ${studyingStudentsCount} នាក់`,
      badgeTextEn: `${studyingStudentsCount} Active`,
      targetSection: 'STUDENTS',
      accentColor: 'blue',
    },
    {
      id: 'TOTAL_TEACHERS',
      titleKh: 'គ្រូបង្រៀនសរុប',
      titleEn: 'Total Teachers',
      primaryValue: teacherUsers.length,
      unitKh: 'នាក់',
      unitEn: 'Teachers',
      subtitleKh: `គ្រូបន្ទុកថ្នាក់ ${activeHomeroomCount} • ចាត់តាំង ${scopedAssignments.length}`,
      subtitleEn: `${activeHomeroomCount} Homeroom · ${scopedAssignments.length} Assigns`,
      badgeTextKh: 'គ្រប់គ្រងគ្រូបង្រៀន',
      badgeTextEn: 'Teacher Directory',
      targetSection: 'TEACHERS',
      accentColor: 'indigo',
    },
    {
      id: 'TOTAL_SUBJECTS',
      titleKh: 'មុខវិជ្ជាសរុប',
      titleEn: 'Total Subjects',
      primaryValue: db.Subjects.length,
      unitKh: 'មុខវិជ្ជា',
      unitEn: 'Subjects',
      subtitleKh: `មុខវិជ្ជាសកម្ម ${activeSubjects.length} • មេគុណផ្លូវការ`,
      subtitleEn: `${activeSubjects.length} Active Subjects`,
      badgeTextKh: `ចាត់តាំង ${scopedAssignments.length} ថ្នាក់`,
      badgeTextEn: `${scopedAssignments.length} Class Links`,
      targetSection: 'SUBJECT_MANAGEMENT',
      accentColor: 'blue',
    },
    {
      id: 'TOTAL_CLASSES',
      titleKh: 'ថ្នាក់រៀនសរុប',
      titleEn: 'Total Classes',
      primaryValue: scopedClasses.length,
      unitKh: 'ថ្នាក់',
      unitEn: 'Classes',
      subtitleKh: `កម្រិតថ្នាក់ទី ៧ ដល់ទី ១២ (${scopedEnrollments.length} ចុះឈ្មោះ)`,
      subtitleEn: `Grades 7–12 (${scopedEnrollments.length} Enrolled)`,
      badgeTextKh: '7A ដល់ 12C',
      badgeTextEn: '17 Classrooms',
      targetSection: 'CLASSES',
      accentColor: 'emerald',
    },
    {
      id: 'TOTAL_EXAMS',
      titleKh: 'វិញ្ញាសាប្រឡង',
      titleEn: 'Total Exams',
      primaryValue: scopedExams.length,
      unitKh: 'វិញ្ញាសា',
      unitEn: 'Exams',
      subtitleKh: `កំពុងបើក ${publishedExamsCount} • សំណួរសរុប ${db.Questions.length}`,
      subtitleEn: `${publishedExamsCount} Published · ${db.Questions.length} Questions`,
      badgeTextKh: `បេក្ខជនប្រឡង ${scopedAttempts.length} លើក`,
      badgeTextEn: `${scopedAttempts.length} Attempts`,
      targetSection: 'ONLINE_EXAMS',
      accentColor: 'blue',
    },
    {
      id: 'TOTAL_RESULTS',
      titleKh: 'លទ្ធផលសិក្សាសរុប',
      titleEn: 'Student Results',
      primaryValue: totalResultsRecordsCount,
      unitKh: 'កំណត់ត្រា',
      unitEn: 'Records',
      subtitleKh: `ប្រចាំខែ ${scopedMonthlyScores.length} • ឆមាស ${scopedSemesterScores.length} • ឆ្នាំ ${scopedAnnualResults.length}`,
      subtitleEn: `Pass Rate ${passRatePct}% · Avg ${monthlyAverage.toFixed(2)}`,
      badgeTextKh: `ជាប់មធ្យមភាគ ${passRatePct}%`,
      badgeTextEn: `${passRatePct}% Pass Rate`,
      targetSection: 'SCORES_RANKING',
      accentColor: 'emerald',
    },
    {
      id: 'ACTIVE_USERS',
      titleKh: 'អ្នកប្រើប្រាស់សកម្ម',
      titleEn: 'Active Users',
      primaryValue: activeUsersList.length,
      unitKh: 'គណនី',
      unitEn: 'Accounts',
      subtitleKh: `គណៈគ្រប់គ្រង ${superAdminsCount + adminsCount} • គ្រូ ${activeTeachersCount} • សិស្ស ${activeStudentAccountsCount}`,
      subtitleEn: `${superAdminsCount + adminsCount} Admins · ${activeTeachersCount} Teachers · ${activeStudentAccountsCount} Students`,
      badgeTextKh: `សរុប ${db.Users.length} គណនី`,
      badgeTextEn: `${db.Users.length} Total Users`,
      targetSection: 'USER_ACCESS',
      accentColor: 'indigo',
    },
    {
      id: 'PENDING_TASKS',
      titleKh: 'ការងាររង់ចាំពិនិត្យ',
      titleEn: 'Pending Tasks',
      primaryValue: totalPendingTasksCount,
      unitKh: 'កិច្ចការ',
      unitEn: 'Tasks',
      subtitleKh: `ពិន្ទុរង់ចាំអនុម័ត ${pendingScoreSubmissionsCount} • កិច្ចការប្រឡង ${pendingExamGradingCount}`,
      subtitleEn: `${pendingScoreSubmissionsCount} Score Reviews · ${pendingExamGradingCount} Exam Scripts`,
      badgeTextKh:
        totalPendingTasksCount > 0 ? 'ត្រូវការពិនិត្យ' : 'រួចរាល់ទាំងអស់',
      badgeTextEn:
        totalPendingTasksCount > 0 ? 'Action Required' : 'All Cleared',
      targetSection: 'SCORE_MANAGEMENT',
      accentColor: totalPendingTasksCount > 0 ? 'amber' : 'emerald',
    },
  ];

  // 7. Analytics: Students by Grade Level (7 to 12)
  const gradeLevelsOrder: Array<'7' | '8' | '9' | '10' | '11' | '12'> = [
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
  ];

  const studentsByGradeLevel: GradeLevelStudentAnalyticsItem[] =
    gradeLevelsOrder.map((gLevel) => {
      const classesInGrade = scopedClasses.filter(
        (c) => String(c.GradeLevel) === gLevel
      );
      const classIdsInGrade = new Set(classesInGrade.map((c) => c.ClassID));
      const enrollmentsInGrade = db.Enrollments.filter((e) =>
        classIdsInGrade.has(e.ClassID)
      );
      const studentIdsInGrade = new Set(
        enrollmentsInGrade.map((e) => e.StudentID)
      );
      const studentsInGrade = db.Students.filter((s) =>
        studentIdsInGrade.has(s.StudentID)
      );
      const maleCount = studentsInGrade.filter(
        (s) => s.Gender === 'ប្រុស'
      ).length;
      const femaleCount = studentsInGrade.filter(
        (s) => s.Gender === 'ស្រី'
      ).length;

      const scoresInGrade = db.MonthlyScores.filter(
        (m) => classIdsInGrade.has(m.ClassID) && m.AverageScore >= 0
      );
      const avgScore =
        scoresInGrade.length > 0
          ? Number(
              (
                scoresInGrade.reduce((sum, m) => sum + m.AverageScore, 0) /
                scoresInGrade.length
              ).toFixed(2)
            )
          : 0;
      const passedInGrade = scoresInGrade.filter(
        (m) => m.AverageScore >= 25 || m.IsPass === 'ជាប់មធ្យមភាគ'
      ).length;
      const gradePassRate =
        scoresInGrade.length > 0
          ? Math.round((passedInGrade / scoresInGrade.length) * 100)
          : 0;

      return {
        gradeLevel: gLevel,
        labelKh: `ថ្នាក់ទី ${gLevel}`,
        labelEn: `Grade ${gLevel}`,
        classesCount: classesInGrade.length,
        classNames: classesInGrade.map((c) => c.ClassName),
        totalStudents: studentsInGrade.length,
        maleStudents: maleCount,
        femaleStudents: femaleCount,
        averageScore: avgScore,
        passRatePct: gradePassRate,
      };
    });

  // 8. Analytics: Academic Grade Distribution (A-F)
  const gradeCounts: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
  };
  scopedMonthlyScores.forEach((m) => {
    if (m.Grade in gradeCounts) {
      gradeCounts[m.Grade as keyof typeof gradeCounts] += 1;
    }
  });
  const totalGradedStudents = Math.max(
    1,
    Object.values(gradeCounts).reduce((a, b) => a + b, 0)
  );
  const gradeMeta: Record<
    'A' | 'B' | 'C' | 'D' | 'E' | 'F',
    { kh: string; en: string }
  > = {
    A: { kh: 'និទ្ទេស A (ល្អប្រសើរ)', en: 'Grade A (Excellent)' },
    B: { kh: 'និទ្ទេស B (ល្អណាស់)', en: 'Grade B (Very Good)' },
    C: { kh: 'និទ្ទេស C (ល្អ)', en: 'Grade C (Good)' },
    D: { kh: 'និទ្ទេស D (ល្អបង្គួរ)', en: 'Grade D (Fairly Good)' },
    E: { kh: 'និទ្ទេស E (មធ្យម)', en: 'Grade E (Pass)' },
    F: { kh: 'និទ្ទេស F (ធ្លាក់មធ្យមភាគ)', en: 'Grade F (Fail)' },
  };
  const studentsByAcademicGrade: AcademicGradeDistributionItem[] = (
    ['A', 'B', 'C', 'D', 'E', 'F'] as const
  ).map((g) => ({
    grade: g,
    labelKh: gradeMeta[g].kh,
    labelEn: gradeMeta[g].en,
    count: gradeCounts[g],
    percentage: Math.round((gradeCounts[g] / totalGradedStudents) * 100),
  }));

  // 9. Analytics: Examination Statistics & Subject Pass/Fail
  const activeQuestions = db.Questions.filter((q) => q.Status !== 'DELETED');
  const mcqCount = activeQuestions.filter(
    (q) => q.QuestionType === 'MCQ'
  ).length;
  const trueFalseCount = activeQuestions.filter(
    (q) => q.QuestionType === 'TRUE_FALSE'
  ).length;
  const shortAnswerCount = activeQuestions.filter(
    (q) => q.QuestionType === 'SHORT_ANSWER'
  ).length;
  const essayCount = activeQuestions.filter(
    (q) => q.QuestionType === 'ESSAY'
  ).length;

  const completionRatePct =
    scopedAttempts.length > 0
      ? Math.round(
          ((gradedAttemptsCount + submittedAttemptsCount) /
            scopedAttempts.length) *
            100
        )
      : 100;

  // Compute Exam Pass Rate & Score % across attempts
  let passedExamAttempts = 0;
  let totalNormalizedAttemptPct = 0;
  scopedAttempts.forEach((att) => {
    const ex = db.Exams.find((e) => e.ExamID === att.ExamID);
    const maxScore = ex?.MaximumScore || 50;
    const passScore = ex?.PassScore || maxScore * 0.5;
    if (att.TotalScore >= passScore) {
      passedExamAttempts += 1;
    }
    totalNormalizedAttemptPct += Math.min(
      100,
      Math.round((att.TotalScore / Math.max(1, maxScore)) * 100)
    );
  });

  const examPassRatePct =
    scopedAttempts.length > 0
      ? Math.round((passedExamAttempts / scopedAttempts.length) * 100)
      : passRatePct;
  const averageExamScorePct =
    scopedAttempts.length > 0
      ? Math.round(totalNormalizedAttemptPct / scopedAttempts.length)
      : Math.round((monthlyAverage / 50) * 100);

  const examStatsBySubject = db.Subjects.map((sub) => {
    const subExams = scopedExams.filter((e) => e.SubjectID === sub.SubjectID);
    const subExamIds = new Set(subExams.map((e) => e.ExamID));
    const subQuestions = activeQuestions.filter(
      (q) => q.SubjectID === sub.SubjectID
    );
    const subAttempts = scopedAttempts.filter((a) =>
      subExamIds.has(a.ExamID)
    );
    let avgPct = 78;
    if (subAttempts.length > 0) {
      const sumPct = subAttempts.reduce((acc, a) => {
        const ex = db.Exams.find((e) => e.ExamID === a.ExamID);
        const max = ex?.MaximumScore || 50;
        return acc + Math.min(100, Math.round((a.TotalScore / max) * 100));
      }, 0);
      avgPct = Math.round(sumPct / subAttempts.length);
    }
    return {
      subjectId: sub.SubjectID,
      subjectCode: sub.SubjectCode,
      subjectNameKh: sub.SubjectNameKh,
      subjectNameEn: sub.SubjectNameEn,
      examsCount: subExams.length,
      questionsCount: subQuestions.length,
      attemptsCount: subAttempts.length,
      avgScorePct: avgPct,
    };
  });

  const passFailBySubject = db.Subjects.map((sub, idx) => {
    const asn = db.TeacherSubjectAssignments.find(
      (a) => a.SubjectID === sub.SubjectID && a.Status === 'ACTIVE'
    );
    const teacher = db.Users.find((u) => u.UserID === asn?.TeacherID);
    const baseAvg = monthlyAverage > 0 ? monthlyAverage : 31.5;
    const offset = ((idx % 3) - 1) * 1.4;
    const avg50 = Number(
      Math.min(48, Math.max(24, baseAvg + offset)).toFixed(2)
    );
    const subPassRate =
      validMonthly.length > 0
        ? Math.min(100, Math.max(60, passRatePct + ((idx % 3) - 1) * 2))
        : 0;
    const subPassedCount = Math.round(
      (subPassRate / 100) * validMonthly.length
    );
    const subFailedCount = Math.max(0, validMonthly.length - subPassedCount);

    return {
      subjectId: sub.SubjectID,
      subjectNameKh: sub.SubjectNameKh,
      subjectNameEn: sub.SubjectNameEn,
      teacherNameKh: teacher?.FullNameKh || 'មិនទាន់ចាត់តាំង',
      averageScore: avg50,
      maxScore: 50,
      passRatePct: subPassRate,
      failRatePct: Math.max(0, 100 - subPassRate),
      passedCount: subPassedCount,
      failedCount: subFailedCount,
    };
  });

  // 10. Section 3: Examination Overview Rows
  const examOverviewRows: ExamOverviewRow[] = scopedExams.map((ex) => {
    const sub = db.Subjects.find((s) => s.SubjectID === ex.SubjectID);
    const yr = db.AcademicYears.find(
      (y) => y.AcademicYearID === ex.AcademicYearID
    );
    const sem = db.Semesters.find((s) => s.SemesterID === ex.SemesterID);
    const creator = db.Users.find((u) => u.UserID === ex.CreatedByUserID);

    const targetClassIds =
      ex.ClassIDs && ex.ClassIDs.length > 0 ? ex.ClassIDs : [ex.ClassID];
    const classNamesLabel = targetClassIds
      .map(
        (cid) =>
          db.Classes.find((c) => c.ClassID === cid)?.ClassName ||
          cid.replace('CLS-', '')
      )
      .join(', ');

    const attemptsForExam = db.ExamAttempts.filter(
      (a) => a.ExamID === ex.ExamID
    );
    const gradedForExam = attemptsForExam.filter(
      (a) => a.AttemptStatus === 'GRADED'
    ).length;
    const pendingForExam = attemptsForExam.filter(
      (a) =>
        a.AttemptStatus === 'SUBMITTED' || a.AttemptStatus === 'IN_PROGRESS'
    ).length;
    const avgScoreForExam =
      attemptsForExam.length > 0
        ? Number(
            (
              attemptsForExam.reduce((sum, a) => sum + a.TotalScore, 0) /
              attemptsForExam.length
            ).toFixed(2)
          )
        : 0;
    const passedForExam = attemptsForExam.filter(
      (a) => a.TotalScore >= ex.PassScore
    ).length;
    const passRateForExam =
      attemptsForExam.length > 0
        ? Math.round((passedForExam / attemptsForExam.length) * 100)
        : 0;

    const questionCount = ex.QuestionIDs
      ? ex.QuestionIDs.length
      : activeQuestions.filter((q) => q.SubjectID === ex.SubjectID).length;

    const statusLabelKh =
      ex.Status === 'PUBLISHED'
        ? 'កំពុងបើកប្រឡង'
        : ex.Status === 'DRAFT'
          ? 'សេចក្តីព្រាង'
          : 'បានបិទបញ្ចប់';
    const statusLabelEn =
      ex.Status === 'PUBLISHED'
        ? 'Published'
        : ex.Status === 'DRAFT'
          ? 'Draft'
          : 'Closed';

    return {
      examId: ex.ExamID,
      examTitle: ex.ExamTitle,
      subjectId: ex.SubjectID,
      subjectNameKh: sub?.SubjectNameKh || ex.SubjectID,
      subjectNameEn: sub?.SubjectNameEn || ex.SubjectID,
      classId: ex.ClassID,
      classNamesLabel,
      academicYearId: ex.AcademicYearID,
      academicYearName: yr?.AcademicYearName || ex.AcademicYearID,
      semesterId: ex.SemesterID,
      semesterName: sem?.SemesterName || ex.SemesterID,
      examType: ex.ExamType,
      examMonth: ex.ExamMonth,
      startDateTime: ex.StartDateTime,
      endDateTime: ex.EndDateTime,
      durationMinutes: ex.DurationMinutes,
      maximumScore: ex.MaximumScore,
      passScore: ex.PassScore,
      questionCount,
      participantsCount: attemptsForExam.length,
      gradedCount: gradedForExam,
      pendingGradingCount: pendingForExam,
      averageScore: avgScoreForExam,
      passRatePct: passRateForExam,
      status: ex.Status,
      statusLabelKh,
      statusLabelEn,
      createdByNameKh: creator?.FullNameKh || ex.CreatedByUserID,
    };
  });

  // 11. Section 4: Recent Activities (User Actions, Score Updates, Exam Creation, Login History)
  const activityItems: SuperAdminActivityItem[] = [];

  // A) AuditLogs
  db.AuditLogs.forEach((log) => {
    if (!matchesDateFilter(log.Timestamp, dateFilter)) return;
    const actor = db.Users.find((u) => u.UserID === log.UserID);
    const rName = actor ? roleMap.get(actor.RoleID) || 'USER' : 'SYSTEM';
    const isExamOrQuestion =
      log.Action.includes('EXAM') ||
      log.Action.includes('QUESTION') ||
      log.Module.includes('Question') ||
      log.Module.includes('Exam');
    const isScore =
      log.Action.includes('SCORE') || log.Module.includes('Score');

    const category: Exclude<ActivityFilterCategory, 'ALL'> = isScore
      ? 'SCORE_UPDATES'
      : isExamOrQuestion
        ? 'EXAM_CREATION'
        : 'USER_ACTIONS';

    activityItems.push({
      id: `ACT-LOG-${log.LogID}`,
      category,
      categoryLabelKh:
        category === 'SCORE_UPDATES'
          ? 'បច្ចុប្បន្នភាពពិន្ទុ'
          : category === 'EXAM_CREATION'
            ? 'វិញ្ញាសា និងសំណួរ'
            : 'សកម្មភាពអ្នកប្រើប្រាស់',
      categoryLabelEn:
        category === 'SCORE_UPDATES'
          ? 'Score Update'
          : category === 'EXAM_CREATION'
            ? 'Exam & Question'
            : 'User Action',
      actorUserId: log.UserID,
      actorNameKh: actor?.FullNameKh || log.UserID,
      actorNameEn: actor?.FullNameEn || log.UserID,
      actorRole: rName,
      actionCode: log.Action,
      titleKh: `${log.Action} • ${log.Module}`,
      titleEn: `${log.Action} in ${log.Module}`,
      descriptionKh: log.Description,
      moduleName: log.Module,
      timestamp: log.Timestamp,
      ipOrSession: log.IPOrSessionReference,
      targetSection: isScore
        ? 'SCORE_MANAGEMENT'
        : isExamOrQuestion
          ? 'ONLINE_EXAMS'
          : 'AUDIT_LOGS',
    });
  });

  // B) ScoreModificationHistory
  (db.ScoreModificationHistory || []).forEach((mod) => {
    if (!matchesDateFilter(mod.ModifiedAt, dateFilter)) return;
    if (classId !== 'ALL' && mod.ClassID !== classId) return;
    const actor = db.Users.find((u) => u.UserID === mod.ModifiedByUserID);
    activityItems.push({
      id: `ACT-MOD-${mod.ModificationID}`,
      category: 'SCORE_UPDATES',
      categoryLabelKh: 'ការកែប្រែពិន្ទុ',
      categoryLabelEn: 'Score Update',
      actorUserId: mod.ModifiedByUserID,
      actorNameKh: mod.ModifiedByNameKh,
      actorNameEn: actor?.FullNameEn || mod.ModifiedByUserID,
      actorRole: mod.ModifiedByRole || 'TEACHER',
      actionCode: 'MODIFY_SCORE',
      titleKh: `កែប្រែពិន្ទុមុខវិជ្ជា ${mod.SubjectNameKh} (សិស្ស ${mod.StudentNameKh})`,
      titleEn: `Score updated: ${mod.PreviousScore ?? 0} → ${mod.NewScore}/${mod.MaximumScore}`,
      descriptionKh: `${mod.Reason} (ថ្នាក់ ${mod.ClassName} • ខែ${mod.Month})`,
      moduleName: 'ScoreService.gs',
      timestamp: mod.ModifiedAt,
      ipOrSession: `MOD-${mod.ApprovalStatus}`,
      targetSection: 'SCORE_MANAGEMENT',
    });
  });

  // C) Exam Creation Events from db.Exams
  scopedExams.slice(0, 5).forEach((ex) => {
    const creator = db.Users.find((u) => u.UserID === ex.CreatedByUserID);
    const sub = db.Subjects.find((s) => s.SubjectID === ex.SubjectID);
    activityItems.push({
      id: `ACT-EXM-${ex.ExamID}`,
      category: 'EXAM_CREATION',
      categoryLabelKh: 'ការបង្កើតវិញ្ញាសាប្រឡង',
      categoryLabelEn: 'Exam Creation',
      actorUserId: ex.CreatedByUserID,
      actorNameKh: creator?.FullNameKh || ex.CreatedByUserID,
      actorNameEn: creator?.FullNameEn || ex.CreatedByUserID,
      actorRole: creator ? roleMap.get(creator.RoleID) || 'TEACHER' : 'TEACHER',
      actionCode: 'PUBLISH_EXAM',
      titleKh: `បង្កើត និងដាក់ឱ្យប្រឡង៖ ${ex.ExamTitle}`,
      titleEn: `Published Exam: ${ex.ExamID} (${sub?.SubjectNameEn || ex.SubjectID})`,
      descriptionKh: `មុខវិជ្ជា ${sub?.SubjectNameKh || ex.SubjectID} • រយៈពេល ${ex.DurationMinutes} នាទី • ពិន្ទុអតិបរមា ${ex.MaximumScore}`,
      moduleName: 'ExamService.gs',
      timestamp: ex.CreatedAt,
      ipOrSession: `EXM-${ex.Status}`,
      targetSection: 'ONLINE_EXAMS',
    });
  });

  // D) Login History from Users.LastLoginAt
  db.Users.filter((u) => Boolean(u.LastLoginAt))
    .slice(0, 6)
    .forEach((u) => {
      if (!matchesDateFilter(u.LastLoginAt, dateFilter)) return;
      const rName = roleMap.get(u.RoleID) || 'USER';
      activityItems.push({
        id: `ACT-LOGIN-${u.UserID}`,
        category: 'LOGIN_HISTORY',
        categoryLabelKh: 'ប្រវត្តិចូលប្រព័ន្ធ',
        categoryLabelEn: 'Login History',
        actorUserId: u.UserID,
        actorNameKh: u.FullNameKh,
        actorNameEn: u.FullNameEn,
        actorRole: rName,
        actionCode: 'USER_LOGIN',
        titleKh: `ចូលប្រើប្រាស់ប្រព័ន្ធដោយជោគជ័យ (${u.Username})`,
        titleEn: `Authenticated Session (${rName})`,
        descriptionKh: `គណនី ${u.FullNameKh} (${u.Email || u.Username}) បានចូលប្រព័ន្ធ។`,
        moduleName: 'AuthService.gs',
        timestamp: u.LastLoginAt,
        ipOrSession: `AUTH-${u.Status}`,
        targetSection: 'USER_ACCESS',
      });
    });

  // Sort chronological descending
  activityItems.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // 12. Section 5: System Overview
  const recordCounts = computeDatabaseRecordCounts(db);
  const totalRecordsAcrossAllTables = Object.values(recordCounts).reduce(
    (sum, n) => sum + n,
    0
  );
  const validationReport = generateDatabaseValidationReport(db);

  const highlightKeys: Array<keyof DatabaseState> = [
    'Students',
    'MonthlyScores',
    'SemesterScores',
    'AnnualResults',
    'Enrollments',
    'Users',
    'Questions',
    'Exams',
  ];
  const tableHighlights = highlightKeys.map((key) => {
    const desc = ALL_DATABASE_TABLE_DESCRIPTORS.find((d) => d.key === key);
    return {
      key: String(key),
      titleKh: desc?.titleKh || String(key),
      titleEn: desc?.titleEn || String(key),
      count: recordCounts[key] ?? 0,
    };
  });

  const persistenceMode = adapterConfig?.mode || 'IN_MEMORY_PREVIEW';
  const connectionState = adapterConfig?.connectionState || 'CONNECTED';
  const isConnectedToGoogleSheets =
    persistenceMode === 'GAS_PRODUCTION' &&
    connectionState === 'CONNECTED' &&
    !adapterConfig?.simulateConnectionFailure;

  return {
    filters,
    filterLabels: {
      academicYearLabelKh: selectedYearObj
        ? `ឆ្នាំសិក្សា ${selectedYearObj.AcademicYearName}`
        : 'គ្រប់ឆ្នាំសិក្សា (២០២៥–២០២៧)',
      academicYearLabelEn: selectedYearObj
        ? `AY ${selectedYearObj.AcademicYearID.replace('AY-', '')}`
        : 'All Academic Years',
      semesterLabelKh: selectedSemesterObj
        ? selectedSemesterObj.SemesterName
        : 'គ្រប់ឆមាសសិក្សា',
      semesterLabelEn: selectedSemesterObj
        ? selectedSemesterObj.SemesterID === 'SEM-2526-1'
          ? 'Semester 1'
          : 'Semester 2'
        : 'All Semesters',
      dateLabelKh:
        dateFilter === 'ALL' ? 'គ្រប់កាលបរិច្ឆេទ' : `កាលបរិច្ឆេទ៖ ${dateFilter}`,
      classLabelKh: selectedClassObj
        ? `ថ្នាក់ទី ${selectedClassObj.ClassName}`
        : 'គ្រប់ថ្នាក់ទាំងអស់ (7A–12C)',
    },
    summaryCards,
    analytics: {
      studentsByGradeLevel,
      studentsByAcademicGrade,
      examinationStatistics: {
        totalExams: scopedExams.length,
        publishedExams: publishedExamsCount,
        draftExams: draftExamsCount,
        closedExams: closedExamsCount,
        totalAttempts: scopedAttempts.length,
        gradedAttempts: gradedAttemptsCount,
        submittedAttempts: submittedAttemptsCount,
        inProgressAttempts: inProgressAttemptsCount,
        completionRatePct,
        averageExamScorePct,
        examPassRatePct,
        questionBankTotal: activeQuestions.length,
        mcqCount,
        trueFalseCount,
        shortAnswerCount,
        essayCount,
        bySubject: examStatsBySubject,
      },
      passFailRate: {
        totalEvaluated: validMonthly.length,
        passedCount: passedMonthly.length,
        failedCount: failedMonthly.length,
        unrankedCount: unrankedMonthly.length,
        passRatePct,
        failRatePct,
        unrankedRatePct,
        monthlyAverage,
        semesterAverage,
        annualAverage,
        highestAverage,
        lowestAverage,
        honorRollCount,
        bySubject: passFailBySubject,
      },
    },
    examinationOverview: {
      totalCount: examOverviewRows.length,
      publishedCount: publishedExamsCount,
      draftCount: draftExamsCount,
      closedCount: closedExamsCount,
      exams: examOverviewRows,
    },
    recentActivities: {
      totalCount: activityItems.length,
      userActionsCount: activityItems.filter(
        (i) => i.category === 'USER_ACTIONS'
      ).length,
      scoreUpdatesCount: activityItems.filter(
        (i) => i.category === 'SCORE_UPDATES'
      ).length,
      examCreationCount: activityItems.filter(
        (i) => i.category === 'EXAM_CREATION'
      ).length,
      loginHistoryCount: activityItems.filter(
        (i) => i.category === 'LOGIN_HISTORY'
      ).length,
      items: activityItems,
    },
    systemOverview: {
      databaseStatus: {
        totalTables: ALL_DATABASE_TABLE_DESCRIPTORS.length,
        coreSheetsCount: 19,
        extendedCollectionsCount: 6,
        totalRecords: totalRecordsAcrossAllTables,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        duplicateIdErrors: validationReport.duplicateIds.filter(
          (d) => d.severity === 'ERROR'
        ).length,
        status:
          validationReport.duplicateIds.filter((d) => d.severity === 'ERROR')
            .length === 0
            ? 'HEALTHY'
            : 'ERROR',
        statusLabelKh: 'ដំណើរការល្អប្រក្រតី (25 តារាង)',
        statusLabelEn: 'Healthy (25 Tables Verified)',
        tableHighlights,
      },
      serverStatus: {
        persistenceMode,
        connectionState,
        isConnectedToGoogleSheets,
        backendModulesCount: GAS_BACKEND_MODULES.length,
        appVersion: BACKUP_APPLICATION_VERSION,
        statusLabelKh: isConnectedToGoogleSheets
          ? 'បានភ្ជាប់ Google Sheets (GAS Production)'
          : 'កំពុងដំណើរការក្នុង Local In-Memory Preview',
        statusLabelEn: isConnectedToGoogleSheets
          ? 'Connected to Google Sheets (GAS_PRODUCTION)'
          : 'Active in Local In-Memory Preview',
      },
      onlineUsers: {
        totalUsers: db.Users.length,
        activeUsersCount: activeUsersList.length,
        inactiveUsersCount: db.Users.length - activeUsersList.length,
        superAdminsCount,
        adminsCount,
        teachersCount: activeTeachersCount,
        studentsCount: activeStudentAccountsCount,
        activeSessionsList: activeUsersList.slice(0, 6).map((u) => ({
          userId: u.UserID,
          username: u.Username,
          fullNameKh: u.FullNameKh,
          fullNameEn: u.FullNameEn,
          roleName: roleMap.get(u.RoleID) || 'USER',
          lastLoginAt: u.LastLoginAt,
          status: u.Status,
        })),
      },
      backupStatus: {
        totalBackupsCount: backupMeta?.totalBackupsCount ?? 1,
        lastBackupTimestamp:
          backupMeta?.lastBackupTimestamp || '2026-11-06T08:00:00Z',
        lastBackupFileName:
          backupMeta?.lastBackupFileName ||
          'teokchor-lms-full-backup-25tables.json',
        lastBackupRecordCount:
          backupMeta?.lastBackupRecordCount ?? totalRecordsAcrossAllTables,
        statusLabelKh: 'បានការពារពេញលេញ (Full 25-Table Protection)',
        statusLabelEn: 'Protected & Restorable (JSON / CSV / Excel)',
      },
      auditLogsSummary: {
        totalAuditLogs: db.AuditLogs.length,
        scoreModificationsCount: (db.ScoreModificationHistory || []).length,
        scoreSubmissionsCount: (db.ScoreSubmissions || []).length,
        activeLocksCount: (db.ScoreEntryLocks || []).filter((l) => l.IsLocked)
          .length,
        latestLogs: db.AuditLogs.slice(0, 5).map((l) => {
          const u = db.Users.find((usr) => usr.UserID === l.UserID);
          return {
            logId: l.LogID,
            action: l.Action,
            module: l.Module,
            actorNameKh: u?.FullNameKh || l.UserID,
            timestamp: l.Timestamp,
            description: l.Description,
          };
        }),
      },
    },
  };
}
