/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ClassRecord,
  DatabaseState,
  DisabilityStatusCode,
  ExamAttemptRecord,
  ExamRecord,
  GenderKh,
  GradingScaleRecord,
  OrphanStatusCode,
  PovertyLevelCode,
  QuestionAction,
  QuestionType,
  ScoreManagementSubMenuId,
  SheetName,
  StudentStatusKh,
  SubjectManagementSubMenuId,
  SystemSettingRecord,
} from './types/database';
import { createInitialDatabaseState, HONOR_PORTRAIT_URLS } from './lib/seedData';
import {
  calculateCompetitionRanking,
  canManageQuestion,
  getRoleAuthorizedMenus,
  getRoleSidebarModules,
  isStudentRole,
  NOTIFICATION_CONDITIONS_CATALOG,
  NotificationRoleCategory,
} from './lib/domainRules';
import { DataService } from './lib/centralizedDataService';
import {
  DatabaseOperationFeedback,
  GasAdapterConfig,
  GasPersistenceAdapter,
} from './lib/gasPersistenceAdapter';
import { DatabaseExplorerView } from './components/DatabaseExplorerView';
import { SecuritySimulatorView } from './components/SecuritySimulatorView';
import { OfficialReportsView, ReportTemplateTab } from './components/OfficialReportsView';
import {
  DashboardSubSectionMode,
  GrowlyDashboardView,
} from './components/GrowlyDashboardView';
import { GoogleFormsTab, OnlineExamsPortalView } from './components/OnlineExamsPortalView';
import { SettingsPage, SettingsTabId } from './components/SettingsPage';
import { StudentPortal, StudentPortalTabId } from './components/StudentPortal';
import {
  buildStudentPersonalProfileSummary,
  resolveStudentProfilePhotoUrl,
} from './lib/studentProfileRules';
import { TeacherManagementView } from './components/TeacherManagementView';
import { evaluateTeacherAccountPermissions } from './lib/teacherRolePermissions';
import { SubjectManagementView } from './components/SubjectManagementView';
import { ScoreManagementView } from './components/ScoreManagementView';
import {
  REPORT_CATEGORIES_CATALOG,
  ReportCategoryId,
  ReportCenterView,
  ReportSubItemId,
} from './components/ReportCenterView';
import { SystemLoginModal, SystemLogoutModal } from './components/SystemLoginModal';
import { AuthProvider } from './context/AuthContext';
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Edit3,
  FileCheck,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HelpCircle,
  Home,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Plus,
  Printer,
  School,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Sun,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

export type SidebarNavId =
  | 'DASHBOARD'
  | 'STUDENTS'
  | 'TEACHERS'
  | 'CLASSES'
  | 'SUBJECT_MANAGEMENT'
  | 'SCORE_MANAGEMENT'
  | 'SUBJECTS_QUESTIONS'
  | 'ONLINE_EXAMS'
  | 'SCORES_RANKING'
  | 'HONOR_ROLL'
  | 'OFFICIAL_REPORTS'
  | 'REPORT_CENTER'
  | 'STUDENT_PORTAL'
  | 'STUDENT_TAKE_EXAM'
  | 'STUDENT_VIEW_RESULTS'
  | 'SYSTEM_SETTINGS';

export type FunctionalSidebarGroupId =
  | 'GROUP_1_DASHBOARD'
  | 'GROUP_2_BASIC_DATA'
  | 'GROUP_3_SUBJECT_MANAGEMENT'
  | 'GROUP_4_ONLINE_EXAMINATION'
  | 'GROUP_5_SCORE_MANAGEMENT'
  | 'GROUP_6_RESULTS_RANKINGS'
  | 'GROUP_7_REPORTS'
  | 'GROUP_8_USER_ACCESS'
  | 'GROUP_9_SYSTEM_SETTINGS';

interface SidebarNavItem {
  id: SidebarNavId;
  groupKh: string;
  labelKh: string;
  labelEn: string;
  tooltipKh: string;
  icon: React.FC<{ className?: string }>;
}

const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  {
    id: 'DASHBOARD',
    groupKh: 'គ្រប់គ្រងទូទៅ',
    labelKh: 'ទំព័រដើម',
    labelEn: 'Dashboard',
    tooltipKh: 'ទំព័រដើម',
    icon: Home,
  },
  {
    id: 'STUDENTS',
    groupKh: 'គ្រប់គ្រងទូទៅ',
    labelKh: 'បញ្ជីសិស្ស',
    labelEn: 'Students',
    tooltipKh: 'បញ្ជីសិស្សសរុប ៣៦ ជួរឈរ',
    icon: Users,
  },
  {
    id: 'TEACHERS',
    groupKh: 'គ្រប់គ្រងទូទៅ',
    labelKh: 'បញ្ជីគ្រូ',
    labelEn: 'Teachers & Assignments',
    tooltipKh: 'បញ្ជីគ្រូបង្រៀន និងការចាត់តាំងមុខវិជ្ជា-ថ្នាក់',
    icon: UserCheck,
  },
  {
    id: 'CLASSES',
    groupKh: 'គ្រប់គ្រងទូទៅ',
    labelKh: 'ថ្នាក់រៀន',
    labelEn: 'Classes',
    tooltipKh: 'ថ្នាក់រៀន',
    icon: GraduationCap,
  },
  {
    id: 'SUBJECTS_QUESTIONS',
    groupKh: 'ការប្រឡង និងរបាយការណ៍',
    labelKh: 'ឃ្លាំងសំណួរ',
    labelEn: 'Question Bank',
    tooltipKh: 'ឃ្លាំងសំណួរ និងសិទ្ធិគ្រូ',
    icon: Layers,
  },
  {
    id: 'ONLINE_EXAMS',
    groupKh: 'ការប្រឡង និងរបាយការណ៍',
    labelKh: 'ការប្រឡងអនឡាញ',
    labelEn: 'Online Exams',
    tooltipKh: 'ការប្រឡងអនឡាញ',
    icon: FileCheck,
  },
  {
    id: 'SCORES_RANKING',
    groupKh: 'ការប្រឡង និងរបាយការណ៍',
    labelKh: 'តារាងចំណាត់ថ្នាក់ផ្លូវការ',
    labelEn: 'Scores & Ranking',
    tooltipKh: 'តារាងពិន្ទុ និងចំណាត់ថ្នាក់ផ្លូវការ',
    icon: BarChart3,
  },
  {
    id: 'HONOR_ROLL',
    groupKh: 'ការប្រឡង និងរបាយការណ៍',
    labelKh: 'តារាងកិត្តិយស',
    labelEn: 'Honor Roll',
    tooltipKh: 'តារាងកិត្តិយស Top 5',
    icon: Award,
  },
  {
    id: 'OFFICIAL_REPORTS',
    groupKh: 'ការប្រឡង និងរបាយការណ៍',
    labelKh: 'របាយការណ៍ផ្លូវការ',
    labelEn: 'Official Reports',
    tooltipKh: 'របាយការណ៍ផ្លូវការ',
    icon: Printer,
  },
  {
    id: 'STUDENT_PORTAL',
    groupKh: 'ប្រព័ន្ធសិស្ស',
    labelKh: 'ផតថលសិស្ស',
    labelEn: 'Student Portal',
    tooltipKh: 'ផតថលសិស្ស (Student Portal)',
    icon: UserCheck,
  },
  {
    id: 'STUDENT_TAKE_EXAM',
    groupKh: 'ប្រព័ន្ធសិស្ស',
    labelKh: 'ការចូលប្រឡង',
    labelEn: 'Take Exam',
    tooltipKh: 'ការចូលប្រឡង',
    icon: FileCheck,
  },
  {
    id: 'STUDENT_VIEW_RESULTS',
    groupKh: 'ប្រព័ន្ធសិស្ស',
    labelKh: 'មើលលទ្ធផលប្រឡង',
    labelEn: 'View Exam Results',
    tooltipKh: 'មើលលទ្ធផលប្រឡង',
    icon: Trophy,
  },
];

export default function App() {
  const [db, setDb] = useState<DatabaseState>(() =>
    DataService.initializeDatabaseState()
  );
  const [adapterConfig, setAdapterConfig] = useState<GasAdapterConfig>(() =>
    DataService.getAdapterConfig()
  );
  const [adapterFeedback, setAdapterFeedback] =
    useState<DatabaseOperationFeedback>(() =>
      GasPersistenceAdapter.getLatestFeedback()
    );
  const [activeNav, setActiveNav] = useState<SidebarNavId>('DASHBOARD');
  const [activeUserId, setActiveUserId] = useState<string>('USR-TCH-12C'); // Default: ជួន លីរតនៈ (Homeroom 12C & ICT Teacher)

  useEffect(() => {
    DataService.setActiveActorUserId(activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    return DataService.subscribeFeedback((feedback, config) => {
      setAdapterFeedback(feedback);
      setAdapterConfig(config);
    });
  }, []);
  const [studentPortalTab, setStudentPortalTab] = useState<StudentPortalTabId>(
    'AVAILABLE_EXAMS'
  );
  const [activeSubjectSubMenu, setActiveSubjectSubMenu] =
    useState<SubjectManagementSubMenuId>('SUBJECT_LIST');
  const [activeScoreSubMenu, setActiveScoreSubMenu] =
    useState<ScoreManagementSubMenuId>('SCORE_ENTRY');
  const [dashboardSubMode, setDashboardSubMode] =
    useState<DashboardSubSectionMode>('MAIN_DASHBOARD');
  const [onlineExamInitialTab, setOnlineExamInitialTab] =
    useState<GoogleFormsTab>('QUESTIONS_BUILDER');
  const [onlineExamSelectorOpen, setOnlineExamSelectorOpen] = useState<boolean>(false);
  const [activeReportCategory, setActiveReportCategory] =
    useState<ReportCategoryId>('STUDENT_REPORTS');
  const [activeReportSubItem, setActiveReportSubItem] =
    useState<ReportSubItemId>('STD_INFO');
  const [selectedMainGroupId, setSelectedMainGroupId] =
    useState<FunctionalSidebarGroupId>('GROUP_1_DASHBOARD');
  const [isSubmenuDataOpen, setIsSubmenuDataOpen] = useState<boolean>(false);
  const [activeSubmenuKey, setActiveSubmenuKey] = useState<string>('');
  const [activeChildMenuKey, setActiveChildMenuKey] = useState<string>('');
  const [breadcrumbGroupKh, setBreadcrumbGroupKh] = useState<string>('១. ផ្ទាំងគ្រប់គ្រង');
  const [breadcrumbItemKh, setBreadcrumbItemKh] = useState<string>('សូមជ្រើសរើសមុខងាររង');

  // Expandable/Collapsible State for the 9 Functional Sidebar Groups
  const [openSidebarGroups, setOpenSidebarGroups] = useState<
    Record<FunctionalSidebarGroupId, boolean>
  >({
    GROUP_1_DASHBOARD: true,
    GROUP_2_BASIC_DATA: true,
    GROUP_3_SUBJECT_MANAGEMENT: true,
    GROUP_4_ONLINE_EXAMINATION: true,
    GROUP_5_SCORE_MANAGEMENT: true,
    GROUP_6_RESULTS_RANKINGS: true,
    GROUP_7_REPORTS: true,
    GROUP_8_USER_ACCESS: false,
    GROUP_9_SYSTEM_SETTINGS: false,
  });

  const toggleSidebarGroup = (groupId: FunctionalSidebarGroupId) => {
    setOpenSidebarGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // App Shell UI States (Default expanded on desktop for clear Khmer labels)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('២០២៦-២០២៧');
  const [isDarkHeaderAccent, setIsDarkHeaderAccent] = useState<boolean>(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [isSystemLoginOpen, setIsSystemLoginOpen] = useState<boolean>(false);
  const [isLoggedOutLock, setIsLoggedOutLock] = useState<boolean>(false);
  const [isSystemLogoutOpen, setIsSystemLogoutOpen] = useState<boolean>(false);
  const notificationDropdownRef = useRef<HTMLDivElement | null>(null);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      code: string;
      roleCategory: NotificationRoleCategory;
      message: string;
      timeAgo: string;
      dotColorClass: string;
      isRead: boolean;
      targetNav: SidebarNavId;
    }>
  >(() =>
    NOTIFICATION_CONDITIONS_CATALOG.map((cond, idx) => ({
      id: `NOTIF-${idx + 1}-${cond.code}`,
      code: cond.code,
      roleCategory: cond.roleCategory,
      message: cond.sampleMessageKh,
      timeAgo: cond.timeAgo,
      dotColorClass:
        cond.priority === 'HIGH'
          ? 'bg-rose-500'
          : cond.priority === 'MEDIUM'
            ? 'bg-blue-500'
            : 'bg-emerald-500',
      isRead: false,
      targetNav: cond.targetNav,
    }))
  );

  useEffect(() => {
    if (!isNotificationOpen) return;

    const handleMouseDownOutside = (event: MouseEvent) => {
      if (
        notificationDropdownRef.current &&
        !notificationDropdownRef.current.contains(event.target as Node)
      ) {
        setIsNotificationOpen(false);
      }
    };

    const handleKeyDownEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDownOutside);
    document.addEventListener('keydown', handleKeyDownEscape);
    return () => {
      document.removeEventListener('mousedown', handleMouseDownOutside);
      document.removeEventListener('keydown', handleKeyDownEscape);
    };
  }, [isNotificationOpen]);

  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabId>('SCHOOL_PROFILE');
  const [openCreateStudentSignal, setOpenCreateStudentSignal] = useState<number>(0);

  // Target Sheet & Report Template States when navigating from the Sidebar items
  const [dbTargetSheet, setDbTargetSheet] = useState<SheetName>('Students');
  const [dbTargetSubTab, setDbTargetSubTab] = useState<'LIVE_DATA' | 'SCHEMA_COLUMNS' | 'MASTER_36_ROSTER'>('MASTER_36_ROSTER');
  const [reportTargetTemplate, setReportTargetTemplate] = useState<ReportTemplateTab>('MONTHLY_RANKING');

  const activeUser = db.Users.find((u) => u.UserID === activeUserId) || db.Users[2];
  const activeRole = db.Roles.find((r) => r.RoleID === activeUser.RoleID);
  const activeTeacherPermissionProfile = evaluateTeacherAccountPermissions(
    db,
    activeUser.UserID,
    'AY-2025-2026'
  );

  // Role check logic: Determine if the current user has role "student" / "STUDENT"
  const isCurrentUserStudent = isStudentRole(activeRole?.RoleName);
  const isCurrentUserAdmin =
    activeRole?.RoleName === 'SUPER_ADMIN' || activeRole?.RoleName === 'ADMIN';

  const visibleNotifications = notifications.filter((n) => {
    if (isCurrentUserStudent) {
      return n.roleCategory === 'STUDENT';
    }
    if (isCurrentUserAdmin) {
      return n.roleCategory === 'ADMIN' || n.roleCategory === 'TEACHER';
    }
    return n.roleCategory === 'TEACHER';
  });
  const unreadNotificationCount = visibleNotifications.filter((n) => !n.isRead).length;

  const handleMarkAllNotificationsRead = () => {
    const visibleIds = new Set(visibleNotifications.map((v) => v.id));
    setNotifications((prev) =>
      prev.map((item) => (visibleIds.has(item.id) ? { ...item, isRead: true } : item))
    );
  };

  const handleClickNotificationItem = (notifId: string, targetNav: SidebarNavId) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === notifId ? { ...item, isRead: true } : item))
    );
    handleNavigateSidebar(targetNav);
    setIsNotificationOpen(false);
  };

  const authorizedMenuIds = new Set(
    getRoleAuthorizedMenus(activeRole?.RoleName).map((item) => item.id)
  );
  const visibleSidebarNavItems = SIDEBAR_NAV_ITEMS.filter((item) =>
    authorizedMenuIds.has(item.id)
  );
  const sidebarModules = getRoleSidebarModules(db, activeUserId);

  // Dynamic Khmer Honorific Greeting
  const formatGreetingForUser = () => {
    if (activeUser.UserID === 'USR-TCH-12C') {
      return 'អរុណសួស្តី, លោកគ្រូ ជួន លីរតនៈ 👋';
    }
    if (activeRole?.RoleName === 'TEACHER') {
      const prefix = activeUser.Gender === 'ស្រី' ? 'អ្នកគ្រូ' : 'លោកគ្រូ';
      return `អរុណសួស្តី, ${prefix} ${activeUser.FullNameKh} 👋`;
    }
    if (isCurrentUserStudent) {
      return `អរុណសួស្តី, ប្អូនសិស្ស ${activeUser.FullNameKh} 👋`;
    }
    return `អរុណសួស្តី, ${activeUser.FullNameKh} 👋`;
  };

  const handleNavigateSidebar = (navId: SidebarNavId) => {
    setActiveNav(navId);
    setIsMobileDrawerOpen(false);
    setIsSubmenuDataOpen(true);

    if (navId === 'DASHBOARD') {
      setSelectedMainGroupId('GROUP_1_DASHBOARD');
      setDashboardSubMode('MAIN_DASHBOARD');
      setActiveSubmenuKey('G1_MAIN_DASHBOARD');
      setBreadcrumbGroupKh('១. ផ្ទាំងគ្រប់គ្រង (Dashboard)');
      setBreadcrumbItemKh('ទំព័រដើមរួម (Main Dashboard)');
    } else if (navId === 'STUDENT_TAKE_EXAM') {
      setStudentPortalTab('AVAILABLE_EXAMS');
    } else if (navId === 'STUDENT_VIEW_RESULTS') {
      setStudentPortalTab('MY_RESULTS');
    } else if (navId === 'STUDENTS') {
      setSelectedMainGroupId('GROUP_2_BASIC_DATA');
      setDbTargetSheet('Students');
      setDbTargetSubTab('MASTER_36_ROSTER');
      setActiveSubmenuKey('G2_STUDENT_LIST');
      setBreadcrumbGroupKh('២. គ្រប់គ្រងទិន្នន័យមូលដ្ឋាន');
      setBreadcrumbItemKh('បញ្ជីសិស្ស (Student List)');
    } else if (navId === 'TEACHERS') {
      setSelectedMainGroupId('GROUP_2_BASIC_DATA');
      setActiveSubmenuKey('G2_TEACHER_LIST');
      setBreadcrumbGroupKh('២. គ្រប់គ្រងទិន្នន័យមូលដ្ឋាន');
      setBreadcrumbItemKh('បញ្ជីគ្រូ (Teacher List)');
    } else if (navId === 'CLASSES') {
      setSelectedMainGroupId('GROUP_2_BASIC_DATA');
      setDbTargetSheet('Classes');
      setDbTargetSubTab('LIVE_DATA');
      setActiveSubmenuKey('G2_CLASS_MANAGEMENT');
      setBreadcrumbGroupKh('២. គ្រប់គ្រងទិន្នន័យមូលដ្ឋាន');
      setBreadcrumbItemKh('គ្រប់គ្រងថ្នាក់រៀន (Class Management)');
    } else if (navId === 'SUBJECT_MANAGEMENT') {
      setSelectedMainGroupId('GROUP_3_SUBJECT_MANAGEMENT');
      setActiveSubjectSubMenu('SUBJECT_LIST');
      setActiveSubmenuKey('G3_SUBJECT_LIST');
      setBreadcrumbGroupKh('៣. គ្រប់គ្រងមុខវិជ្ជា');
      setBreadcrumbItemKh('បញ្ជីមុខវិជ្ជា (Subject List)');
    } else if (navId === 'ONLINE_EXAMS') {
      setSelectedMainGroupId('GROUP_4_ONLINE_EXAMINATION');
      setOnlineExamInitialTab('QUESTIONS_BUILDER');
      setOnlineExamSelectorOpen(true);
      setActiveSubmenuKey('G4_EXAM_MANAGEMENT');
      setBreadcrumbGroupKh('៤. គ្រប់គ្រងការប្រឡង');
      setBreadcrumbItemKh('គ្រប់គ្រងវិញ្ញាសាប្រឡង (Examination Management)');
    } else if (navId === 'SUBJECTS_QUESTIONS') {
      setSelectedMainGroupId('GROUP_4_ONLINE_EXAMINATION');
      setActiveSubmenuKey('G4_QUESTION_BANK');
      setBreadcrumbGroupKh('៤. គ្រប់គ្រងការប្រឡង');
      setBreadcrumbItemKh('ឃ្លាំងសំណួរ (Question Bank)');
    } else if (navId === 'SCORE_MANAGEMENT') {
      setSelectedMainGroupId('GROUP_5_SCORE_MANAGEMENT');
      setActiveScoreSubMenu('SCORE_ENTRY');
      setActiveSubmenuKey('G5_SCORE_ENTRY');
      setBreadcrumbGroupKh('៥. គ្រប់គ្រងពិន្ទុ');
      setBreadcrumbItemKh('ការបញ្ចូលពិន្ទុ (Score Entry)');
    } else if (navId === 'SCORES_RANKING') {
      setSelectedMainGroupId('GROUP_6_RESULTS_RANKINGS');
      setReportTargetTemplate('SCORE_ENTRY_GRID');
      setActiveSubmenuKey('G6_SUBJECT_GRADES');
      setBreadcrumbGroupKh('៦. លទ្ធផល និងចំណាត់ថ្នាក់');
      setBreadcrumbItemKh('តារាងពិន្ទុ និងចំណាត់ថ្នាក់ផ្លូវការ');
    } else if (navId === 'HONOR_ROLL') {
      setSelectedMainGroupId('GROUP_6_RESULTS_RANKINGS');
      setReportTargetTemplate('MONTHLY_HONOR_ROLL');
      setActiveSubmenuKey('G6_OVERALL_RANKINGS');
      setBreadcrumbGroupKh('៦. លទ្ធផល និងចំណាត់ថ្នាក់');
      setBreadcrumbItemKh('តារាងកិត្តិយស Top 5');
    } else if (navId === 'OFFICIAL_REPORTS') {
      setSelectedMainGroupId('GROUP_6_RESULTS_RANKINGS');
      setReportTargetTemplate('CLASS_ROSTER');
      setActiveSubmenuKey('G6_MONTHLY_RESULTS');
      setBreadcrumbGroupKh('៦. លទ្ធផល និងចំណាត់ថ្នាក់');
      setBreadcrumbItemKh('របាយការណ៍ផ្លូវការ A4');
    } else if (navId === 'REPORT_CENTER') {
      setSelectedMainGroupId('GROUP_7_REPORTS');
      setActiveSubmenuKey(`G7_${activeReportCategory}`);
      setBreadcrumbGroupKh('៧. របាយការណ៍ (Report Center)');
    } else if (navId === 'SYSTEM_SETTINGS') {
      setSelectedMainGroupId('GROUP_9_SYSTEM_SETTINGS');
      setActiveSubmenuKey('G9_SCHOOL_INFO');
      setBreadcrumbGroupKh('៩. ការកំណត់ប្រព័ន្ធ');
      setBreadcrumbItemKh('ព័ត៌មានសាលារៀន (School Information)');
    }
  };

  // Recomputes rankings for a class after score or student addition/edit/deletion
  const recomputeClassRankings = (
    nextDb: DatabaseState,
    classId: string
  ): DatabaseState => {
    const enrolledIds = new Set(
      nextDb.Enrollments.filter((e) => e.ClassID === classId).map((e) => e.StudentID)
    );
    const classStudents = nextDb.Students.filter((s) => enrolledIds.has(s.StudentID));

    const monthlyRaw = classStudents.map((st) => {
      const m = nextDb.MonthlyScores.find(
        (ms) => ms.StudentID === st.StudentID && ms.ClassID === classId
      );
      return {
        studentId: st.StudentID,
        studentCode: st.StudentCode,
        lastNameKh: st.LastNameKh,
        firstNameKh: st.FirstNameKh,
        gender: st.Gender,
        averageScore: m ? m.AverageScore : 30.0,
      };
    });
    const rankedMonthly = calculateCompetitionRanking(monthlyRaw, 50);

    const annualRaw = classStudents.map((st) => {
      const a = nextDb.AnnualResults.find(
        (an) => an.StudentID === st.StudentID && an.ClassID === classId
      );
      return {
        studentId: st.StudentID,
        studentCode: st.StudentCode,
        lastNameKh: st.LastNameKh,
        firstNameKh: st.FirstNameKh,
        gender: st.Gender,
        averageScore: a ? a.AnnualAverage : 30.0,
      };
    });
    const rankedAnnual = calculateCompetitionRanking(annualRaw, 50);

    const updatedMonthlyScores = nextDb.MonthlyScores.map((ms) => {
      if (ms.ClassID !== classId) return ms;
      const r = rankedMonthly.find((item) => item.studentId === ms.StudentID);
      if (!r) return ms;
      return {
        ...ms,
        Ranking: r.ranking,
        Grade: r.grade,
        IsPass: r.passStatus,
        IsHonorRoll: r.isHonorRoll,
      };
    });

    const updatedAnnualResults = nextDb.AnnualResults.map((an) => {
      if (an.ClassID !== classId) return an;
      const r = rankedAnnual.find((item) => item.studentId === an.StudentID);
      if (!r) return an;
      return {
        ...an,
        Ranking: r.ranking,
        Grade: r.grade,
        ResultStatus: r.passStatus,
        IsHonorRoll: r.isHonorRoll,
      };
    });

    return {
      ...nextDb,
      MonthlyScores: updatedMonthlyScores,
      AnnualResults: updatedAnnualResults,
    };
  };

  const handleAddStudentRecord = (payload: {
    studentCode: string;
    lastNameKh: string;
    firstNameKh: string;
    familyNameEn: string;
    givenNameEn: string;
    gender: GenderKh;
    dateOfBirth: string;
    phone: string;
    village: string;
    classId: string;
    orphanStatus: OrphanStatusCode;
    disabilityStatus: DisabilityStatusCode;
    povertyLevel: PovertyLevelCode;
    previousSchool: string;
    monthlyAverage: number;
  }) => {
    DataService.commitState(setDb, (prev) => {
      const res = DataService.addStudentRecordCascade(prev, payload, activeUserId);
      return res.ok ? res.db : prev;
    });
  };

  const handleEditStudentRecord = (
    studentId: string,
    payload: {
      studentCode: string;
      lastNameKh: string;
      firstNameKh: string;
      gender: GenderKh;
      dateOfBirth: string;
      phone: string;
      village: string;
      classId: string;
      orphanStatus: OrphanStatusCode;
      disabilityStatus: DisabilityStatusCode;
      povertyLevel: PovertyLevelCode;
      studentStatus: StudentStatusKh;
    }
  ) => {
    DataService.commitState(setDb, (prev) => {
      const res = DataService.editStudentRecordCascade(
        prev,
        studentId,
        payload,
        activeUserId
      );
      return res.ok ? res.db : prev;
    });
  };

  const handleDeleteStudentRecord = (studentId: string) => {
    DataService.commitState(setDb, (prev) => {
      const res = DataService.deleteStudentRecordCascade(
        prev,
        studentId,
        activeUserId
      );
      return res.ok ? res.db : prev;
    });
  };

  const handleCreateClassRecord = (payload: {
    className: string;
    gradeLevel: 7 | 8 | 9 | 10 | 11 | 12;
    homeroomTeacherId: string;
    roomNumber: string;
  }): ClassRecord => {
    const preCheck = DataService.createClassRecord(db, payload, activeUserId);
    const fallbackClass: ClassRecord = preCheck.record || {
      ClassID: `CLS-${payload.className.toUpperCase()}`,
      ClassName: payload.className.toUpperCase(),
      GradeLevel: String(payload.gradeLevel) as ClassRecord['GradeLevel'],
      AcademicYearID: 'AY-2025-2026',
      HomeroomTeacherID: payload.homeroomTeacherId,
      Status: 'ACTIVE',
      CreatedAt: new Date().toISOString(),
    };
    DataService.commitState(setDb, (prev) => {
      const res = DataService.createClassRecord(prev, payload, activeUserId);
      return res.ok ? res.db : prev;
    });
    return fallbackClass;
  };

  const handleCreateExam = (payload: {
    examTitleKh: string;
    subjectId: string;
    classId: string;
    durationMinutes: number;
    totalPoints: number;
    passingScore: number;
  }): ExamRecord => {
    const preCheck = DataService.createExamRecord(db, payload, activeUserId);
    const now = new Date().toISOString();
    const fallbackExam: ExamRecord = preCheck.record || {
      ExamID: `EXM-2526-${String(db.Exams.length + 1).padStart(3, '0')}`,
      ExamTitle: payload.examTitleKh,
      SubjectID: payload.subjectId,
      ClassID: payload.classId,
      AcademicYearID: 'AY-2025-2026',
      SemesterID: 'SEM-2526-1',
      ExamType: 'MONTHLY',
      ExamMonth: 'វិច្ឆិកា',
      StartDateTime: now,
      EndDateTime: new Date(Date.now() + 7 * 86400000).toISOString(),
      DurationMinutes: payload.durationMinutes,
      MaximumScore: payload.totalPoints,
      PassScore: payload.passingScore,
      AttemptLimit: 2,
      Instructions: 'សូមជ្រើសរើសចម្លើយដែលត្រឹមត្រូវបំផុត។',
      CreatedByUserID: activeUserId,
      Status: 'PUBLISHED',
      CreatedAt: now,
      UpdatedAt: now,
    };
    DataService.commitState(setDb, (prev) => {
      const res = DataService.createExamRecord(prev, payload, activeUserId);
      return res.ok ? res.db : prev;
    });
    return fallbackExam;
  };

  const handleSubmitExamAttempt = (payload: {
    examId: string;
    studentId: string;
    scoreObtained: number;
    percentage: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
    attemptStatus?: 'GRADED' | 'SUBMITTED';
    answersToSave?: {
      questionId: string;
      answerJson: string;
      scoreAwarded: number;
      isCorrect: boolean;
      gradedByUserId: string;
    }[];
  }): ExamAttemptRecord => {
    const preCheck = DataService.submitExamAttemptCascade(db, payload, activeUserId);
    const now = new Date().toISOString();
    const fallbackAttempt: ExamAttemptRecord = preCheck.record || {
      AttemptID: `ATT-${String(db.ExamAttempts.length + 1).padStart(4, '0')}`,
      ExamID: payload.examId,
      StudentID: payload.studentId,
      AttemptNumber: 1,
      StartedAt: now,
      SubmittedAt: now,
      ServerDeadline: new Date(Date.now() + 3600000).toISOString(),
      AttemptStatus: payload.attemptStatus || 'SUBMITTED',
      TotalScore: payload.scoreObtained,
      CreatedAt: now,
    };
    DataService.commitState(setDb, (prev) => {
      const res = DataService.submitExamAttemptCascade(prev, payload, activeUserId);
      return res.ok ? res.db : prev;
    });
    return fallbackAttempt;
  };

  const handleGradeManualAnswers = (payload: {
    attemptId: string;
    gradedScores: Record<string, number>;
  }) => {
    DataService.commitState(setDb, (prev) => {
      const res = DataService.gradeManualAnswersCascade(prev, payload, activeUserId);
      return res.ok ? res.db : prev;
    });
  };

  const handleUpdateStudentScore = (params: {
    studentId: string;
    classId: string;
    periodType: 'MONTHLY' | 'ANNUAL';
    newAverageScore: number;
  }) => {
    DataService.commitState(setDb, (prev) => {
      const res = DataService.updateStudentAverageScoreCascade(
        prev,
        params,
        activeUserId
      );
      return res.ok ? res.db : prev;
    });
  };

  const handleExecuteQuestionAction = (params: {
    userId: string;
    questionId: string | null;
    action: QuestionAction;
    subjectId?: string;
    questionText?: string;
    questionType?: QuestionType;
    points?: number;
  }) => {
    const decision = canManageQuestion(
      params.userId,
      params.questionId,
      params.action,
      {
        users: db.Users,
        roles: db.Roles,
        assignments: db.TeacherSubjectAssignments,
        questions: db.Questions,
        classes: db.Classes,
      },
      params.subjectId
    );

    DataService.commitState(
      setDb,
      (prev) => DataService.executeQuestionAction(prev, params).db
    );

    return {
      allowed: decision.allowed,
      messageKh: decision.reasonKh,
      messageEn: decision.reasonEn,
      rule: decision.enforcedRule,
    };
  };

  const handleSaveSystemSettings = (updatedSettings: SystemSettingRecord[]) => {
    DataService.commitState(setDb, (prev) =>
      DataService.saveSystemSettingsRecords(prev, updatedSettings, activeUserId)
    );
  };

  const handleSaveGradingScales = (updatedScales: GradingScaleRecord[]) => {
    DataService.commitState(setDb, (prev) =>
      DataService.saveGradingScalesRecords(prev, updatedScales, activeUserId)
    );
  };

  // Definition of the 9 Expandable/Collapsible Functional Sidebar Groups (Main Menu -> Sub Menu -> Child Menu)
  const functionalSidebarGroups = [
    {
      id: 'GROUP_1_DASHBOARD' as FunctionalSidebarGroupId,
      code: '1',
      titleKh: '១. ផ្ទាំងគ្រប់គ្រង',
      titleEn: 'GROUP 1: DASHBOARD',
      icon: Home,
      accentText: 'text-blue-400',
      visible: !isCurrentUserStudent,
      isActiveGroup:
        activeNav !== 'STUDENT_PORTAL' && selectedMainGroupId === 'GROUP_1_DASHBOARD',
      items: [
        {
          key: 'G1_MAIN_DASHBOARD',
          labelKh: 'ទំព័រដើមរួម',
          icon: LayoutDashboard,
          onClick: () => {
            setDashboardSubMode('MAIN_DASHBOARD');
            setActiveSubmenuKey('G1_MAIN_DASHBOARD');
            setBreadcrumbGroupKh('១. ផ្ទាំងគ្រប់គ្រង');
            setBreadcrumbItemKh('ទំព័រដើមរួម');
            setActiveNav('DASHBOARD');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G1_C1_SCHOOL_OVERVIEW',
              labelKh: 'ទិដ្ឋភាពរួមតាមតួនាទី និងសិទ្ធិ',
              icon: LayoutDashboard,
              onClick: () => {
                setDashboardSubMode('MAIN_DASHBOARD');
                setActiveNav('DASHBOARD');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G1_C2_TOP_HONOR_ROLL',
              labelKh: 'ផ្ទាំងគ្រប់គ្រងសម្រាប់គ្រូបន្ទុកថ្នាក់',
              icon: Award,
              onClick: () => {
                setDashboardSubMode('MAIN_DASHBOARD');
                setActiveNav('DASHBOARD');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G1_C3_HOMEROOM_ROSTER',
              labelKh: 'ផ្ទាំងគ្រប់គ្រងសម្រាប់គ្រូមុខវិជ្ជា',
              icon: BookOpen,
              onClick: () => {
                setDashboardSubMode('MAIN_DASHBOARD');
                setActiveNav('DASHBOARD');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G1_ACADEMIC_STATS',
          labelKh: 'ស្ថិតិសិក្សា',
          icon: BarChart3,
          onClick: () => {
            setDashboardSubMode('ACADEMIC_STATISTICS');
            setActiveSubmenuKey('G1_ACADEMIC_STATS');
            setBreadcrumbGroupKh('១. ផ្ទាំងគ្រប់គ្រង');
            setBreadcrumbItemKh('ស្ថិតិសិក្សា');
            setActiveNav('DASHBOARD');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G1_C4_STATS_BY_GRADE',
              labelKh: 'ស្ថិតិសិស្សតាមកម្រិតថ្នាក់',
              icon: BarChart3,
              onClick: () => {
                setDashboardSubMode('ACADEMIC_STATISTICS');
                setActiveNav('DASHBOARD');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G1_C5_GENDER_SOCIAL_STATS',
              labelKh: 'ស្ថិតិភេទ និងស្ថានភាពសិស្ស',
              icon: Users,
              onClick: () => {
                setDashboardSubMode('ACADEMIC_STATISTICS');
                setActiveNav('DASHBOARD');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G1_C6_ATTENDANCE_STATS',
              labelKh: 'ស្ថិតិវត្តមាន និងការសិក្សា',
              icon: Calendar,
              onClick: () => {
                setDashboardSubMode('ACADEMIC_STATISTICS');
                setActiveNav('DASHBOARD');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G1_PERFORMANCE_OVERVIEW',
          labelKh: 'ទិដ្ឋភាពរួមនៃលទ្ធផលសិក្សា',
          icon: TrendingUp,
          onClick: () => {
            setDashboardSubMode('PERFORMANCE_OVERVIEW');
            setActiveSubmenuKey('G1_PERFORMANCE_OVERVIEW');
            setBreadcrumbGroupKh('១. ផ្ទាំងគ្រប់គ្រង');
            setBreadcrumbItemKh('ទិដ្ឋភាពរួមនៃលទ្ធផលសិក្សា');
            setActiveNav('DASHBOARD');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G1_C7_PASS_FAIL_RATE',
              labelKh: 'អត្រាជាប់ និងធ្លាក់តាមថ្នាក់',
              icon: TrendingUp,
              onClick: () => {
                setDashboardSubMode('PERFORMANCE_OVERVIEW');
                setActiveNav('DASHBOARD');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G1_C8_GRADE_DISTRIBUTION',
              labelKh: 'ការប្រៀបធៀបនិទ្ទេសតាមកម្រិតថ្នាក់',
              icon: Award,
              onClick: () => {
                setDashboardSubMode('PERFORMANCE_OVERVIEW');
                setActiveNav('DASHBOARD');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G1_C9_SUBJECT_PERFORMANCE',
              labelKh: 'លទ្ធផលសិក្សាតាមមុខវិជ្ជា',
              icon: BookOpen,
              onClick: () => {
                setDashboardSubMode('PERFORMANCE_OVERVIEW');
                setActiveNav('DASHBOARD');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
      ],
    },
    {
      id: 'GROUP_2_BASIC_DATA' as FunctionalSidebarGroupId,
      code: '2',
      titleKh: '២. គ្រប់គ្រងទិន្នន័យមូលដ្ឋាន',
      titleEn: 'GROUP 2: BASIC DATA MANAGEMENT',
      icon: Database,
      accentText: 'text-indigo-400',
      visible: !isCurrentUserStudent,
      isActiveGroup:
        activeNav !== 'STUDENT_PORTAL' && selectedMainGroupId === 'GROUP_2_BASIC_DATA',
      items: [
        {
          key: 'G2_STUDENT_LIST',
          labelKh: 'បញ្ជីសិស្ស',
          icon: Users,
          onClick: () => {
            setDbTargetSheet('Students');
            setDbTargetSubTab('MASTER_36_ROSTER');
            setActiveSubmenuKey('G2_STUDENT_LIST');
            setBreadcrumbGroupKh('២. គ្រប់គ្រងទិន្នន័យមូលដ្ឋាន');
            setBreadcrumbItemKh('បញ្ជីសិស្ស');
            setActiveNav('STUDENTS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G2_C1_MASTER_STUDENT_ROSTER',
              labelKh: 'បញ្ជីសិស្សសរុបទាំង ១៧ ថ្នាក់',
              icon: Users,
              onClick: () => {
                setDbTargetSheet('Students');
                setDbTargetSubTab('MASTER_36_ROSTER');
                setActiveNav('STUDENTS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G2_C2_ADD_NEW_STUDENT',
              labelKh: 'បន្ថែមសិស្សថ្មី',
              icon: Plus,
              onClick: () => {
                setDbTargetSheet('Students');
                setDbTargetSubTab('MASTER_36_ROSTER');
                setActiveNav('STUDENTS');
                setOpenCreateStudentSignal((n) => n + 1);
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G2_C3_IMPORT_EXPORT_STUDENTS',
              labelKh: 'នាំចូល និងនាំចេញទិន្នន័យសិស្ស',
              icon: FileSpreadsheet,
              onClick: () => {
                setDbTargetSheet('Students');
                setDbTargetSubTab('MASTER_36_ROSTER');
                setActiveNav('STUDENTS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G2_C4_SOCIAL_STATUS_STUDENTS',
              labelKh: 'ទិន្នន័យគ្រួសារ និងស្ថានភាពសង្គម',
              icon: ShieldCheck,
              onClick: () => {
                setDbTargetSheet('Students');
                setDbTargetSubTab('MASTER_36_ROSTER');
                setActiveNav('STUDENTS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G2_TEACHER_LIST',
          labelKh: 'បញ្ជីគ្រូ',
          icon: GraduationCap,
          onClick: () => {
            setActiveSubmenuKey('G2_TEACHER_LIST');
            setBreadcrumbGroupKh('២. គ្រប់គ្រងទិន្នន័យមូលដ្ឋាន');
            setBreadcrumbItemKh('បញ្ជីគ្រូ');
            setActiveNav('TEACHERS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G2_C5_ALL_TEACHERS',
              labelKh: 'បញ្ជីគ្រូបង្រៀនទាំងអស់',
              icon: GraduationCap,
              onClick: () => {
                setActiveNav('TEACHERS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G2_C6_HOMEROOM_TEACHERS',
              labelKh: 'គ្រូបន្ទុកថ្នាក់',
              icon: UserCheck,
              onClick: () => {
                setActiveNav('TEACHERS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G2_C7_TEACHER_SUBJECT_MAP',
              labelKh: 'ការចាត់តាំងគ្រូតាមមុខវិជ្ជា',
              icon: BookOpen,
              onClick: () => {
                setActiveNav('TEACHERS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G2_CLASS_MANAGEMENT',
          labelKh: 'គ្រប់គ្រងថ្នាក់រៀន',
          icon: School,
          onClick: () => {
            setDbTargetSheet('Classes');
            setDbTargetSubTab('LIVE_DATA');
            setActiveSubmenuKey('G2_CLASS_MANAGEMENT');
            setBreadcrumbGroupKh('២. គ្រប់គ្រងទិន្នន័យមូលដ្ឋាន');
            setBreadcrumbItemKh('គ្រប់គ្រងថ្នាក់រៀន');
            setActiveNav('CLASSES');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G2_C8_ALL_CLASSES',
              labelKh: 'បញ្ជីថ្នាក់រៀនទាំង ១៧ ថ្នាក់',
              icon: School,
              onClick: () => {
                setDbTargetSheet('Classes');
                setDbTargetSubTab('LIVE_DATA');
                setActiveNav('CLASSES');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G2_C9_LOWER_SECONDARY_CLASSES',
              labelKh: 'ថ្នាក់អនុវិទ្យាល័យ',
              icon: Layers,
              onClick: () => {
                setDbTargetSheet('Classes');
                setDbTargetSubTab('LIVE_DATA');
                setActiveNav('CLASSES');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G2_C10_UPPER_SECONDARY_CLASSES',
              labelKh: 'ថ្នាក់វិទ្យាល័យ',
              icon: Building2,
              onClick: () => {
                setDbTargetSheet('Classes');
                setDbTargetSubTab('LIVE_DATA');
                setActiveNav('CLASSES');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G2_ACADEMIC_YEAR',
          labelKh: 'គ្រប់គ្រងឆ្នាំសិក្សា',
          icon: Calendar,
          onClick: () => {
            setDbTargetSheet('AcademicYears');
            setDbTargetSubTab('LIVE_DATA');
            setActiveSubmenuKey('G2_ACADEMIC_YEAR');
            setBreadcrumbGroupKh('២. គ្រប់គ្រងទិន្នន័យមូលដ្ឋាន');
            setBreadcrumbItemKh('គ្រប់គ្រងឆ្នាំសិក្សា');
            setActiveNav('STUDENTS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G2_C11_ACADEMIC_YEARS_LIST',
              labelKh: 'បញ្ជីឆ្នាំសិក្សា',
              icon: Calendar,
              onClick: () => {
                setDbTargetSheet('AcademicYears');
                setDbTargetSubTab('LIVE_DATA');
                setActiveNav('STUDENTS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G2_C12_SEMESTERS_AND_MONTHS',
              labelKh: 'ឆមាស និងខែសិក្សា',
              icon: Clock,
              onClick: () => {
                setDbTargetSheet('Semesters');
                setDbTargetSubTab('LIVE_DATA');
                setActiveNav('STUDENTS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G2_C13_ACTIVE_YEAR_CONFIG',
              labelKh: 'កំណត់ឆ្នាំសិក្សាបច្ចុប្បន្ន',
              icon: Sliders,
              onClick: () => {
                setSettingsInitialTab('ACADEMIC_YEARS');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
      ],
    },
    {
      id: 'GROUP_3_SUBJECT_MANAGEMENT' as FunctionalSidebarGroupId,
      code: '3',
      titleKh: '៣. គ្រប់គ្រងមុខវិជ្ជា',
      titleEn: 'GROUP 3: SUBJECT MANAGEMENT',
      icon: BookOpen,
      accentText: 'text-purple-400',
      visible: !isCurrentUserStudent,
      isActiveGroup:
        activeNav !== 'STUDENT_PORTAL' && selectedMainGroupId === 'GROUP_3_SUBJECT_MANAGEMENT',
      items: [
        {
          key: 'G3_SUBJECT_LIST',
          labelKh: 'បញ្ជីមុខវិជ្ជា',
          icon: BookOpen,
          onClick: () => {
            setActiveSubjectSubMenu('SUBJECT_LIST');
            setActiveSubmenuKey('G3_SUBJECT_LIST');
            setBreadcrumbGroupKh('៣. គ្រប់គ្រងមុខវិជ្ជា');
            setBreadcrumbItemKh('បញ្ជីមុខវិជ្ជា');
            setActiveNav('SUBJECT_MANAGEMENT');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G3_C1_ALL_SUBJECTS',
              labelKh: 'មុខវិជ្ជាសិក្សាទាំងអស់',
              icon: BookOpen,
              onClick: () => {
                setActiveSubjectSubMenu('SUBJECT_LIST');
                setActiveNav('SUBJECT_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G3_C2_LOWER_SEC_SUBJECTS',
              labelKh: 'មុខវិជ្ជាអនុវិទ្យាល័យ',
              icon: BookMarked,
              onClick: () => {
                setActiveSubjectSubMenu('SUBJECT_LIST');
                setActiveNav('SUBJECT_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G3_C3_UPPER_SEC_SUBJECTS',
              labelKh: 'មុខវិជ្ជាវិទ្យាល័យ',
              icon: GraduationCap,
              onClick: () => {
                setActiveSubjectSubMenu('SUBJECT_LIST');
                setActiveNav('SUBJECT_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G3_SUBJECT_ACADEMIC_CONFIG',
          labelKh: 'ការកំណត់មុខវិជ្ជាតាមឆ្នាំសិក្សា',
          icon: Sliders,
          onClick: () => {
            setActiveSubjectSubMenu('SUBJECT_ACADEMIC_CONFIG');
            setActiveSubmenuKey('G3_SUBJECT_ACADEMIC_CONFIG');
            setBreadcrumbGroupKh('៣. គ្រប់គ្រងមុខវិជ្ជា');
            setBreadcrumbItemKh('ការកំណត់មុខវិជ្ជាតាមឆ្នាំសិក្សា');
            setActiveNav('SUBJECT_MANAGEMENT');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G3_C4_SUBJECTS_BY_GRADE',
              labelKh: 'មុខវិជ្ជាតាមកម្រិតថ្នាក់',
              icon: Layers,
              onClick: () => {
                setActiveSubjectSubMenu('SUBJECT_ACADEMIC_CONFIG');
                setActiveNav('SUBJECT_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G3_C5_SUBJECT_COEFFICIENTS',
              labelKh: 'កំណត់មេគុណមុខវិជ្ជា',
              icon: Sliders,
              onClick: () => {
                setActiveSubjectSubMenu('SUBJECT_ACADEMIC_CONFIG');
                setActiveNav('SUBJECT_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G3_MAX_SCORE_CONFIG',
          labelKh: 'កំណត់ពិន្ទុអតិបរមា',
          icon: Target,
          onClick: () => {
            setActiveSubjectSubMenu('MAX_SCORE_CONFIG');
            setActiveSubmenuKey('G3_MAX_SCORE_CONFIG');
            setBreadcrumbGroupKh('៣. គ្រប់គ្រងមុខវិជ្ជា');
            setBreadcrumbItemKh('កំណត់ពិន្ទុអតិបរមា');
            setActiveNav('SUBJECT_MANAGEMENT');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G3_C6_MAX_SCORE_BY_SUBJECT',
              labelKh: 'ពិន្ទុអតិបរមាតាមមុខវិជ្ជា',
              icon: Target,
              onClick: () => {
                setActiveSubjectSubMenu('MAX_SCORE_CONFIG');
                setActiveNav('SUBJECT_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G3_C7_MAX_SCORE_BY_GRADE',
              labelKh: 'ពិន្ទុអតិបរមាតាមកម្រិតថ្នាក់',
              icon: BarChart3,
              onClick: () => {
                setActiveSubjectSubMenu('MAX_SCORE_CONFIG');
                setActiveNav('SUBJECT_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G3_GRADE_RANGE_CONFIG',
          labelKh: 'កំណត់ពិន្ទុនិទ្ទេសសម្រាប់មុខវិជ្ជានីមួយៗ',
          icon: Award,
          onClick: () => {
            setActiveSubjectSubMenu('GRADE_RANGE_CONFIG');
            setActiveSubmenuKey('G3_GRADE_RANGE_CONFIG');
            setBreadcrumbGroupKh('៣. គ្រប់គ្រងមុខវិជ្ជា');
            setBreadcrumbItemKh('កំណត់ពិន្ទុនិទ្ទេសសម្រាប់មុខវិជ្ជានីមួយៗ');
            setActiveNav('SUBJECT_MANAGEMENT');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G3_C8_GRADE_THRESHOLDS_BY_SUBJECT',
              labelKh: 'ចន្លោះពិន្ទុនិទ្ទេសតាមមុខវិជ្ជា',
              icon: Award,
              onClick: () => {
                setActiveSubjectSubMenu('GRADE_RANGE_CONFIG');
                setActiveNav('SUBJECT_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G3_C9_GRADE_SCALES_BY_MAX',
              labelKh: 'តារាងនិទ្ទេសតាមពិន្ទុអតិបរមា',
              icon: Sliders,
              onClick: () => {
                setActiveSubjectSubMenu('GRADE_RANGE_CONFIG');
                setActiveNav('SUBJECT_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G3_TEACHER_SUBJECT_ASSIGNMENT',
          labelKh: 'ការចាត់តាំងគ្រូ និងមុខវិជ្ជា',
          icon: UserCheck,
          onClick: () => {
            setActiveSubjectSubMenu('TEACHER_SUBJECT_CLASS_ASSIGNMENTS');
            setActiveSubmenuKey('G3_TEACHER_SUBJECT_ASSIGNMENT');
            setBreadcrumbGroupKh('៣. គ្រប់គ្រងមុខវិជ្ជា');
            setBreadcrumbItemKh('ការចាត់តាំងគ្រូ និងមុខវិជ្ជា');
            setActiveNav('SUBJECT_MANAGEMENT');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G3_C10_TEACHER_CLASS_ASSIGNMENTS',
              labelKh: 'បញ្ជីចាត់តាំងគ្រូបង្រៀនតាមថ្នាក់',
              icon: UserCheck,
              onClick: () => {
                setActiveSubjectSubMenu('TEACHER_SUBJECT_CLASS_ASSIGNMENTS');
                setActiveNav('SUBJECT_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G3_C11_ASSIGN_NEW_TEACHER_SUBJECT',
              labelKh: 'ចាត់តាំងគ្រូបង្រៀនមុខវិជ្ជាថ្មី',
              icon: Plus,
              onClick: () => {
                setActiveSubjectSubMenu('TEACHER_SUBJECT_CLASS_ASSIGNMENTS');
                setActiveNav('SUBJECT_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
      ],
    },
    {
      id: 'GROUP_4_ONLINE_EXAMINATION' as FunctionalSidebarGroupId,
      code: '4',
      titleKh: '៤. គ្រប់គ្រងការប្រឡង',
      titleEn: 'GROUP 4: ONLINE EXAMINATION',
      icon: FileCheck,
      accentText: 'text-amber-400',
      visible: !isCurrentUserStudent,
      isActiveGroup:
        activeNav !== 'STUDENT_PORTAL' && selectedMainGroupId === 'GROUP_4_ONLINE_EXAMINATION',
      items: [
        {
          key: 'G4_EXAM_MANAGEMENT',
          labelKh: 'គ្រប់គ្រងវិញ្ញាសាប្រឡង',
          icon: FileCheck,
          onClick: () => {
            setOnlineExamInitialTab('QUESTIONS_BUILDER');
            setOnlineExamSelectorOpen(true);
            setActiveSubmenuKey('G4_EXAM_MANAGEMENT');
            setBreadcrumbGroupKh('៤. គ្រប់គ្រងការប្រឡង');
            setBreadcrumbItemKh('គ្រប់គ្រងវិញ្ញាសាប្រឡង');
            setActiveNav('ONLINE_EXAMS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G4_C1_ALL_EXAM_PAPERS',
              labelKh: 'បញ្ជីវិញ្ញាសាប្រឡងទាំងអស់',
              icon: FileCheck,
              onClick: () => {
                setOnlineExamInitialTab('QUESTIONS_BUILDER');
                setOnlineExamSelectorOpen(true);
                setActiveNav('ONLINE_EXAMS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G4_C2_CREATE_NEW_EXAM',
              labelKh: 'បង្កើតវិញ្ញាសាប្រឡងថ្មី',
              icon: Plus,
              onClick: () => {
                setOnlineExamInitialTab('QUESTIONS_BUILDER');
                setOnlineExamSelectorOpen(false);
                setActiveNav('ONLINE_EXAMS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G4_C3_EXAM_SCHEDULE_CONFIG',
              labelKh: 'កំណត់ពេលវេលា និងថ្នាក់ប្រឡង',
              icon: Clock,
              onClick: () => {
                setOnlineExamInitialTab('QUESTIONS_BUILDER');
                setOnlineExamSelectorOpen(false);
                setActiveNav('ONLINE_EXAMS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G4_QUESTION_BANK',
          labelKh: 'ឃ្លាំងសំណួរ',
          icon: HelpCircle,
          onClick: () => {
            setActiveSubmenuKey('G4_QUESTION_BANK');
            setBreadcrumbGroupKh('៤. គ្រប់គ្រងការប្រឡង');
            setBreadcrumbItemKh('ឃ្លាំងសំណួរ');
            setActiveNav('SUBJECTS_QUESTIONS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G4_C4_QUESTIONS_BY_SUBJECT',
              labelKh: 'បញ្ជីសំណួរតាមមុខវិជ្ជា',
              icon: HelpCircle,
              onClick: () => {
                setActiveNav('SUBJECTS_QUESTIONS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G4_C5_MCQ_QUESTIONS',
              labelKh: 'សំណួរជ្រើសរើសចម្លើយ',
              icon: CheckCircle2,
              onClick: () => {
                setActiveNav('SUBJECTS_QUESTIONS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G4_C6_WRITTEN_QUESTIONS',
              labelKh: 'សំណួរសរសេរ និងផ្គូផ្គង',
              icon: Edit3,
              onClick: () => {
                setActiveNav('SUBJECTS_QUESTIONS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G4_ONLINE_EXAM',
          labelKh: 'ការប្រឡងអនឡាញ',
          icon: Monitor,
          onClick: () => {
            setOnlineExamInitialTab('STUDENT_EXAM_VIEW');
            setOnlineExamSelectorOpen(false);
            setActiveSubmenuKey('G4_ONLINE_EXAM');
            setBreadcrumbGroupKh('៤. គ្រប់គ្រងការប្រឡង');
            setBreadcrumbItemKh('ការប្រឡងអនឡាញ');
            setActiveNav('ONLINE_EXAMS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G4_C7_LIVE_EXAM_PREVIEW',
              labelKh: 'ផ្ទាំងប្រឡងសាកល្បង',
              icon: Monitor,
              onClick: () => {
                setOnlineExamInitialTab('STUDENT_EXAM_VIEW');
                setOnlineExamSelectorOpen(false);
                setActiveNav('ONLINE_EXAMS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G4_C8_ACTIVE_ONLINE_EXAMS',
              labelKh: 'វិញ្ញាសាកំពុងបើកឱ្យប្រឡង',
              icon: FileCheck,
              onClick: () => {
                setOnlineExamInitialTab('STUDENT_EXAM_VIEW');
                setOnlineExamSelectorOpen(true);
                setActiveNav('ONLINE_EXAMS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G4_EXAM_ATTEMPTS',
          labelKh: 'ការចូលប្រឡងរបស់សិស្ស',
          icon: Clock,
          onClick: () => {
            setOnlineExamInitialTab('RESPONSES_GRADING');
            setOnlineExamSelectorOpen(false);
            setActiveSubmenuKey('G4_EXAM_ATTEMPTS');
            setBreadcrumbGroupKh('៤. គ្រប់គ្រងការប្រឡង');
            setBreadcrumbItemKh('ការចូលប្រឡងរបស់សិស្ស');
            setActiveNav('ONLINE_EXAMS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G4_C9_STUDENT_ATTEMPTS_LIST',
              labelKh: 'បញ្ជីសិស្សបានចូលប្រឡង',
              icon: Users,
              onClick: () => {
                setOnlineExamInitialTab('RESPONSES_GRADING');
                setOnlineExamSelectorOpen(false);
                setActiveNav('ONLINE_EXAMS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G4_C10_ATTEMPT_STATUS_TRACKING',
              labelKh: 'ស្ថានភាពកំពុងប្រឡង និងបានបញ្ជូន',
              icon: Clock,
              onClick: () => {
                setOnlineExamInitialTab('RESPONSES_GRADING');
                setOnlineExamSelectorOpen(false);
                setActiveNav('ONLINE_EXAMS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G4_EXAM_RESULTS',
          labelKh: 'លទ្ធផលប្រឡងអនឡាញ',
          icon: CheckCircle2,
          onClick: () => {
            setOnlineExamInitialTab('RESPONSES_GRADING');
            setOnlineExamSelectorOpen(false);
            setActiveSubmenuKey('G4_EXAM_RESULTS');
            setBreadcrumbGroupKh('៤. គ្រប់គ្រងការប្រឡង');
            setBreadcrumbItemKh('លទ្ធផលប្រឡងអនឡាញ');
            setActiveNav('ONLINE_EXAMS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G4_C11_ONLINE_EXAM_SCORES',
              labelKh: 'ពិន្ទុប្រឡងអនឡាញតាមសិស្ស',
              icon: Award,
              onClick: () => {
                setOnlineExamInitialTab('RESPONSES_GRADING');
                setOnlineExamSelectorOpen(false);
                setActiveNav('ONLINE_EXAMS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G4_C12_MANUAL_WRITTEN_GRADING',
              labelKh: 'ការកែសំណួរសរសេរដោយគ្រូ',
              icon: Edit3,
              onClick: () => {
                setOnlineExamInitialTab('RESPONSES_GRADING');
                setOnlineExamSelectorOpen(false);
                setActiveNav('ONLINE_EXAMS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
      ],
    },
    {
      id: 'GROUP_5_SCORE_MANAGEMENT' as FunctionalSidebarGroupId,
      code: '5',
      titleKh: '៥. គ្រប់គ្រងពិន្ទុ',
      titleEn: 'GROUP 5: SCORE MANAGEMENT',
      icon: BarChart3,
      accentText: 'text-emerald-400',
      visible: !isCurrentUserStudent && sidebarModules.canSeeScoreManagement,
      isActiveGroup:
        activeNav !== 'STUDENT_PORTAL' && selectedMainGroupId === 'GROUP_5_SCORE_MANAGEMENT',
      items: [
        {
          key: 'G5_SCORE_ENTRY',
          labelKh: 'ការបញ្ចូលពិន្ទុ',
          icon: Edit3,
          onClick: () => {
            setActiveScoreSubMenu('SCORE_ENTRY');
            setActiveSubmenuKey('G5_SCORE_ENTRY');
            setBreadcrumbGroupKh('៥. គ្រប់គ្រងពិន្ទុ');
            setBreadcrumbItemKh('ការបញ្ចូលពិន្ទុ');
            setActiveNav('SCORE_MANAGEMENT');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G5_C1_SCORE_ENTRY_BY_CLASS',
              labelKh: 'បញ្ចូលពិន្ទុតាមមុខវិជ្ជា និងថ្នាក់',
              icon: Edit3,
              onClick: () => {
                setActiveScoreSubMenu('SCORE_ENTRY');
                setActiveNav('SCORE_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G5_C2_SCORE_IMPORT_EXCEL',
              labelKh: 'នាំចូលពិន្ទុពីឯកសារគម្រូ',
              icon: FileSpreadsheet,
              onClick: () => {
                setActiveScoreSubMenu('SCORE_ENTRY');
                setActiveNav('SCORE_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G5_MONTHLY_SCORE_MGMT',
          labelKh: 'គ្រប់គ្រងពិន្ទុប្រចាំខែ',
          icon: Calendar,
          onClick: () => {
            setActiveScoreSubMenu('SCORES_BY_CLASS');
            setActiveSubmenuKey('G5_MONTHLY_SCORE_MGMT');
            setBreadcrumbGroupKh('៥. គ្រប់គ្រងពិន្ទុ');
            setBreadcrumbItemKh('គ្រប់គ្រងពិន្ទុប្រចាំខែ');
            setActiveNav('SCORE_MANAGEMENT');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G5_C3_MONTHLY_SCORES_BY_CLASS',
              labelKh: 'តារាងពិន្ទុប្រចាំខែតាមថ្នាក់',
              icon: Calendar,
              onClick: () => {
                setActiveScoreSubMenu('SCORES_BY_CLASS');
                setActiveNav('SCORE_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G5_C4_MONTHLY_AVG_AND_RANK',
              labelKh: 'មធ្យមភាគ និងចំណាត់ថ្នាក់ប្រចាំខែ',
              icon: BarChart3,
              onClick: () => {
                setActiveScoreSubMenu('SCORES_BY_CLASS');
                setActiveNav('SCORE_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G5_SEMESTER_SCORE_MGMT',
          labelKh: 'គ្រប់គ្រងពិន្ទុប្រចាំឆមាស',
          icon: Layers,
          onClick: () => {
            setActiveScoreSubMenu('SCORES_BY_SUBJECT');
            setActiveSubmenuKey('G5_SEMESTER_SCORE_MGMT');
            setBreadcrumbGroupKh('៥. គ្រប់គ្រងពិន្ទុ');
            setBreadcrumbItemKh('គ្រប់គ្រងពិន្ទុប្រចាំឆមាស');
            setActiveNav('SCORE_MANAGEMENT');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G5_C5_SEMESTER_1_SCORES',
              labelKh: 'ពិន្ទុប្រឡងឆមាសទី ១',
              icon: BookMarked,
              onClick: () => {
                setActiveScoreSubMenu('SCORES_BY_SUBJECT');
                setActiveNav('SCORE_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G5_C6_SEMESTER_2_SCORES',
              labelKh: 'ពិន្ទុប្រឡងឆមាសទី ២',
              icon: BookMarked,
              onClick: () => {
                setActiveScoreSubMenu('SCORES_BY_SUBJECT');
                setActiveNav('SCORE_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G5_C7_SEMESTER_SCORES_BY_SUBJECT',
              labelKh: 'ពិន្ទុតាមមុខវិជ្ជាប្រចាំឆមាស',
              icon: Layers,
              onClick: () => {
                setActiveScoreSubMenu('SCORES_BY_SUBJECT');
                setActiveNav('SCORE_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G5_SCORE_VERIFICATION',
          labelKh: 'ការផ្ទៀងផ្ទាត់ពិន្ទុ',
          icon: ShieldCheck,
          onClick: () => {
            setActiveScoreSubMenu('MISSING_SCORE_MONITORING');
            setActiveSubmenuKey('G5_SCORE_VERIFICATION');
            setBreadcrumbGroupKh('៥. គ្រប់គ្រងពិន្ទុ');
            setBreadcrumbItemKh('ការផ្ទៀងផ្ទាត់ពិន្ទុ');
            setActiveNav('SCORE_MANAGEMENT');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G5_C8_MISSING_SCORES_CHECK',
              labelKh: 'ត្រួតពិនិត្យសិស្សខ្វះពិន្ទុ',
              icon: ShieldCheck,
              onClick: () => {
                setActiveScoreSubMenu('MISSING_SCORE_MONITORING');
                setActiveNav('SCORE_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G5_C9_SCORE_ACCURACY_AUDIT',
              labelKh: 'ផ្ទៀងផ្ទាត់ភាពត្រឹមត្រូវនៃពិន្ទុ',
              icon: CheckCircle2,
              onClick: () => {
                setActiveScoreSubMenu('MISSING_SCORE_MONITORING');
                setActiveNav('SCORE_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G5_SCORE_APPROVAL',
          labelKh: 'ការអនុម័តពិន្ទុ',
          icon: CheckCircle2,
          onClick: () => {
            setActiveScoreSubMenu('SCORE_SUBMISSION_STATUS');
            setActiveSubmenuKey('G5_SCORE_APPROVAL');
            setBreadcrumbGroupKh('៥. គ្រប់គ្រងពិន្ទុ');
            setBreadcrumbItemKh('ការអនុម័តពិន្ទុ');
            setActiveNav('SCORE_MANAGEMENT');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G5_C10_SUBMISSION_STATUS',
              labelKh: 'ស្ថានភាពដាក់ស្នើពិន្ទុតាមមុខវិជ្ជា',
              icon: Clock,
              onClick: () => {
                setActiveScoreSubMenu('SCORE_SUBMISSION_STATUS');
                setActiveNav('SCORE_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G5_C11_OFFICIAL_SCORE_LOCK',
              labelKh: 'ការចាក់សោ និងអនុម័តពិន្ទុផ្លូវការ',
              icon: CheckCircle2,
              onClick: () => {
                setActiveScoreSubMenu('SCORE_SUBMISSION_STATUS');
                setActiveNav('SCORE_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
      ],
    },
    {
      id: 'GROUP_6_RESULTS_RANKINGS' as FunctionalSidebarGroupId,
      code: '6',
      titleKh: '៦. លទ្ធផល និងចំណាត់ថ្នាក់',
      titleEn: 'GROUP 6: ACADEMIC RESULTS & RANKINGS',
      icon: Award,
      accentText: 'text-rose-400',
      visible: !isCurrentUserStudent,
      isActiveGroup:
        activeNav !== 'STUDENT_PORTAL' && selectedMainGroupId === 'GROUP_6_RESULTS_RANKINGS',
      items: [
        {
          key: 'G6_MONTHLY_RESULTS',
          labelKh: 'លទ្ធផលសិក្សាប្រចាំខែ',
          icon: FileSpreadsheet,
          onClick: () => {
            setReportTargetTemplate('MONTHLY_RANKING');
            setActiveSubmenuKey('G6_MONTHLY_RESULTS');
            setBreadcrumbGroupKh('៦. លទ្ធផល និងចំណាត់ថ្នាក់');
            setBreadcrumbItemKh('លទ្ធផលសិក្សាប្រចាំខែ');
            setActiveNav('OFFICIAL_REPORTS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G6_C1_MONTHLY_RANKING_TABLE',
              labelKh: 'តារាងចំណាត់ថ្នាក់ប្រចាំខែ',
              icon: FileSpreadsheet,
              onClick: () => {
                setReportTargetTemplate('MONTHLY_RANKING');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G6_C2_MONTHLY_HONOR_ROLL',
              labelKh: 'តារាងកិត្តិយសប្រចាំខែ',
              icon: Award,
              onClick: () => {
                setReportTargetTemplate('MONTHLY_HONOR_ROLL');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G6_C3_MONTHLY_CERTIFICATES',
              labelKh: 'ប័ណ្ណសរសើរសិស្សពូកែ',
              icon: Trophy,
              onClick: () => {
                setReportTargetTemplate('MONTHLY_HONOR_ROLL');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G6_SEMESTER_1_RESULTS',
          labelKh: 'លទ្ធផលប្រចាំឆមាសទី ១',
          icon: BookMarked,
          onClick: () => {
            setReportTargetTemplate('MONTHLY_RANKING');
            setActiveSubmenuKey('G6_SEMESTER_1_RESULTS');
            setBreadcrumbGroupKh('៦. លទ្ធផល និងចំណាត់ថ្នាក់');
            setBreadcrumbItemKh('លទ្ធផលប្រចាំឆមាសទី ១');
            setActiveNav('OFFICIAL_REPORTS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G6_C4_SEM1_RESULT_TABLE',
              labelKh: 'តារាងលទ្ធផលឆមាសទី ១',
              icon: BookMarked,
              onClick: () => {
                setReportTargetTemplate('MONTHLY_RANKING');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G6_C5_SEM1_HONOR_ROLL',
              labelKh: 'តារាងកិត្តិយសឆមាសទី ១',
              icon: Award,
              onClick: () => {
                setReportTargetTemplate('MONTHLY_HONOR_ROLL');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G6_SEMESTER_2_RESULTS',
          labelKh: 'លទ្ធផលប្រចាំឆមាសទី ២',
          icon: BookMarked,
          onClick: () => {
            setReportTargetTemplate('MONTHLY_RANKING');
            setActiveSubmenuKey('G6_SEMESTER_2_RESULTS');
            setBreadcrumbGroupKh('៦. លទ្ធផល និងចំណាត់ថ្នាក់');
            setBreadcrumbItemKh('លទ្ធផលប្រចាំឆមាសទី ២');
            setActiveNav('OFFICIAL_REPORTS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G6_C6_SEM2_RESULT_TABLE',
              labelKh: 'តារាងលទ្ធផលឆមាសទី ២',
              icon: BookMarked,
              onClick: () => {
                setReportTargetTemplate('MONTHLY_RANKING');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G6_C7_SEM2_HONOR_ROLL',
              labelKh: 'តារាងកិត្តិយសឆមាសទី ២',
              icon: Award,
              onClick: () => {
                setReportTargetTemplate('MONTHLY_HONOR_ROLL');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G6_ANNUAL_RESULTS',
          labelKh: 'លទ្ធផលសិក្សាប្រចាំឆ្នាំ',
          icon: GraduationCap,
          onClick: () => {
            setReportTargetTemplate('ANNUAL_RANKING');
            setActiveSubmenuKey('G6_ANNUAL_RESULTS');
            setBreadcrumbGroupKh('៦. លទ្ធផល និងចំណាត់ថ្នាក់');
            setBreadcrumbItemKh('លទ្ធផលសិក្សាប្រចាំឆ្នាំ');
            setActiveNav('OFFICIAL_REPORTS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G6_C8_ANNUAL_RANKING_TABLE',
              labelKh: 'តារាងចំណាត់ថ្នាក់ប្រចាំឆ្នាំ',
              icon: GraduationCap,
              onClick: () => {
                setReportTargetTemplate('ANNUAL_RANKING');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G6_C9_ANNUAL_HONOR_ROLL',
              labelKh: 'តារាងកិត្តិយសប្រចាំឆ្នាំ',
              icon: Trophy,
              onClick: () => {
                setReportTargetTemplate('ANNUAL_HONOR_ROLL');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G6_C10_STUDENT_REPORT_CARD',
              labelKh: 'សៀវភៅតាមដានការសិក្សា',
              icon: FileText,
              onClick: () => {
                setReportTargetTemplate('ANNUAL_RANKING');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G6_SUBJECT_GRADES',
          labelKh: 'និទ្ទេសតាមមុខវិជ្ជា',
          icon: Award,
          onClick: () => {
            setReportTargetTemplate('SUBJECT_GRADES_RANKINGS');
            setActiveSubmenuKey('G6_SUBJECT_GRADES');
            setBreadcrumbGroupKh('៦. លទ្ធផល និងចំណាត់ថ្នាក់');
            setBreadcrumbItemKh('និទ្ទេសតាមមុខវិជ្ជា');
            setActiveNav('OFFICIAL_REPORTS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G6_C11_SUBJECT_GRADES_SUMMARY',
              labelKh: 'តារាងនិទ្ទេសសរុបតាមមុខវិជ្ជា',
              icon: Award,
              onClick: () => {
                setReportTargetTemplate('SUBJECT_GRADES_RANKINGS');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G6_C12_SUBJECT_GRADE_STATS',
              labelKh: 'ស្ថិតិនិទ្ទេសតាមមុខវិជ្ជា',
              icon: BarChart3,
              onClick: () => {
                setReportTargetTemplate('SUBJECT_GRADES_RANKINGS');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G6_SUBJECT_RANKINGS',
          labelKh: 'ចំណាត់ថ្នាក់តាមមុខវិជ្ជា',
          icon: BarChart3,
          onClick: () => {
            setReportTargetTemplate('SUBJECT_GRADES_RANKINGS');
            setActiveSubmenuKey('G6_SUBJECT_RANKINGS');
            setBreadcrumbGroupKh('៦. លទ្ធផល និងចំណាត់ថ្នាក់');
            setBreadcrumbItemKh('ចំណាត់ថ្នាក់តាមមុខវិជ្ជា');
            setActiveNav('OFFICIAL_REPORTS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G6_C13_SUBJECT_RANKING_TABLE',
              labelKh: 'តារាងចំណាត់ថ្នាក់សិស្សតាមមុខវិជ្ជា',
              icon: BarChart3,
              onClick: () => {
                setReportTargetTemplate('SUBJECT_GRADES_RANKINGS');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G6_C14_TOP_STUDENTS_BY_SUBJECT',
              labelKh: 'សិស្សពូកែប្រចាំមុខវិជ្ជានីមួយៗ',
              icon: Trophy,
              onClick: () => {
                setReportTargetTemplate('SUBJECT_GRADES_RANKINGS');
                setActiveNav('OFFICIAL_REPORTS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G6_OVERALL_RANKINGS',
          labelKh: 'ចំណាត់ថ្នាក់សិស្សរួម',
          icon: Trophy,
          onClick: () => {
            setReportTargetTemplate('MONTHLY_HONOR_ROLL');
            setActiveSubmenuKey('G6_OVERALL_RANKINGS');
            setBreadcrumbGroupKh('៦. លទ្ធផល និងចំណាត់ថ្នាក់');
            setBreadcrumbItemKh('ចំណាត់ថ្នាក់សិស្សរួម');
            setActiveNav('HONOR_ROLL');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G6_C15_OVERALL_HONOR_PODIUM',
              labelKh: 'តារាងកិត្តិយសសិស្សពូកែប្រចាំខែ',
              icon: Trophy,
              onClick: () => {
                setReportTargetTemplate('MONTHLY_HONOR_ROLL');
                setActiveNav('HONOR_ROLL');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G6_C16_OVERALL_CLASS_RANKING',
              labelKh: 'ចំណាត់ថ្នាក់រួមតាមកម្រិតថ្នាក់',
              icon: Award,
              onClick: () => {
                setReportTargetTemplate('MONTHLY_RANKING');
                setActiveNav('SCORES_RANKING');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
      ],
    },
    {
      id: 'GROUP_7_REPORTS' as FunctionalSidebarGroupId,
      code: '7',
      titleKh: '៧. របាយការណ៍',
      titleEn: 'GROUP 7: REPORTS',
      icon: FileText,
      accentText: 'text-cyan-400',
      visible: !isCurrentUserStudent,
      isActiveGroup:
        activeNav !== 'STUDENT_PORTAL' && selectedMainGroupId === 'GROUP_7_REPORTS',
      items: REPORT_CATEGORIES_CATALOG.map((cat) => {
        const cleanCatTitleKh = cat.titleKh.replace(/\s*\([^)]*\)\s*$/g, '');
        const CatIcon =
          cat.code === 'A'
            ? Users
            : cat.code === 'B'
              ? GraduationCap
              : cat.code === 'C'
                ? BarChart3
                : cat.code === 'D'
                  ? FileCheck
                  : Trophy;
        return {
          key: `G7_${cat.id}`,
          labelKh: cleanCatTitleKh,
          icon: CatIcon,
          onClick: () => {
            setActiveReportCategory(cat.id);
            setActiveReportSubItem(cat.subReports[0].id);
            setActiveSubmenuKey(`G7_${cat.id}`);
            setBreadcrumbGroupKh('៧. របាយការណ៍');
            setBreadcrumbItemKh(cleanCatTitleKh);
            setActiveNav('REPORT_CENTER');
            setIsMobileDrawerOpen(false);
          },
          children: cat.subReports.map((subRep) => {
            const cleanSubTitleKh = subRep.titleKh.replace(/\s*\([^)]*\)\s*$/g, '');
            return {
              key: `G7_${cat.id}_${subRep.id}`,
              labelKh: cleanSubTitleKh,
              icon: FileText,
              onClick: () => {
                setActiveReportCategory(cat.id);
                setActiveReportSubItem(subRep.id);
                setBreadcrumbGroupKh('៧. របាយការណ៍');
                setBreadcrumbItemKh(cleanSubTitleKh);
                setActiveNav('REPORT_CENTER');
                setIsMobileDrawerOpen(false);
              },
            };
          }),
        };
      }),
    },
    {
      id: 'GROUP_8_USER_ACCESS' as FunctionalSidebarGroupId,
      code: '8',
      titleKh: '៨. គ្រប់គ្រងអ្នកប្រើប្រាស់',
      titleEn: 'GROUP 8: USER & ACCESS MANAGEMENT',
      icon: ShieldCheck,
      accentText: 'text-orange-400',
      visible: !isCurrentUserStudent,
      isActiveGroup:
        activeNav !== 'STUDENT_PORTAL' && selectedMainGroupId === 'GROUP_8_USER_ACCESS',
      items: [
        {
          key: 'G8_USER_ACCOUNTS',
          labelKh: 'គណនីអ្នកប្រើប្រាស់',
          icon: Users,
          onClick: () => {
            setSettingsInitialTab('AUTHENTICATION');
            setActiveSubmenuKey('G8_USER_ACCOUNTS');
            setBreadcrumbGroupKh('៨. គ្រប់គ្រងអ្នកប្រើប្រាស់');
            setBreadcrumbItemKh('គណនីអ្នកប្រើប្រាស់');
            setActiveNav('SYSTEM_SETTINGS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G8_C1_ALL_USER_ACCOUNTS',
              labelKh: 'បញ្ជីគណនីអ្នកប្រើប្រាស់ទាំងអស់',
              icon: Users,
              onClick: () => {
                setSettingsInitialTab('AUTHENTICATION');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G8_C2_SWITCH_USER_SESSION',
              labelKh: 'ប្តូរគណនីប្រើប្រាស់សាកល្បង',
              icon: UserCheck,
              onClick: () => {
                setSettingsInitialTab('AUTHENTICATION');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G8_TEACHER_ACCOUNTS',
          labelKh: 'គណនីគ្រូបង្រៀន',
          icon: UserCheck,
          onClick: () => {
            setActiveSubmenuKey('G8_TEACHER_ACCOUNTS');
            setBreadcrumbGroupKh('៨. គ្រប់គ្រងអ្នកប្រើប្រាស់');
            setBreadcrumbItemKh('គណនីគ្រូបង្រៀន');
            setActiveNav('TEACHERS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G8_C3_TEACHER_ACCOUNTS_LIST',
              labelKh: 'បញ្ជីគណនីគ្រូបង្រៀន',
              icon: UserCheck,
              onClick: () => {
                setActiveNav('TEACHERS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G8_C4_TEACHER_SCORE_PERMISSIONS',
              labelKh: 'សិទ្ធិបញ្ចូលពិន្ទុរបស់គ្រូ',
              icon: KeyRound,
              onClick: () => {
                setSettingsInitialTab('ROLES_RBAC');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G8_C4B_DUAL_ROLE_TEACHER_POLICY',
              labelKh: 'សិទ្ធិគ្រូបន្ទុកថ្នាក់ និងគ្រូមុខវិជ្ជា',
              icon: ShieldCheck,
              onClick: () => {
                setSettingsInitialTab('ROLES_RBAC');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G8_STUDENT_ACCOUNTS',
          labelKh: 'គណនីសិស្ស',
          icon: GraduationCap,
          onClick: () => {
            setSettingsInitialTab('AUTHENTICATION');
            setActiveSubmenuKey('G8_STUDENT_ACCOUNTS');
            setBreadcrumbGroupKh('៨. គ្រប់គ្រងអ្នកប្រើប្រាស់');
            setBreadcrumbItemKh('គណនីសិស្ស');
            setActiveNav('SYSTEM_SETTINGS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G8_C5_STUDENT_ACCOUNTS_LIST',
              labelKh: 'បញ្ជីគណនីសិស្ស',
              icon: GraduationCap,
              onClick: () => {
                setSettingsInitialTab('AUTHENTICATION');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G8_C6_RESET_STUDENT_PASSWORDS',
              labelKh: 'កំណត់ពាក្យសម្ងាត់សិស្សឡើងវិញ',
              icon: KeyRound,
              onClick: () => {
                setSettingsInitialTab('AUTHENTICATION');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G8_ROLES_PERMISSIONS',
          labelKh: 'តួនាទី និងសិទ្ធិប្រើប្រាស់',
          icon: KeyRound,
          onClick: () => {
            setSettingsInitialTab('ROLES_RBAC');
            setActiveSubmenuKey('G8_ROLES_PERMISSIONS');
            setBreadcrumbGroupKh('៨. គ្រប់គ្រងអ្នកប្រើប្រាស់');
            setBreadcrumbItemKh('តួនាទី និងសិទ្ធិប្រើប្រាស់');
            setActiveNav('SYSTEM_SETTINGS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G8_C7_RBAC_PERMISSIONS_MATRIX',
              labelKh: 'តារាងសិទ្ធិប្រើប្រាស់តាមតួនាទី',
              icon: KeyRound,
              onClick: () => {
                setSettingsInitialTab('ROLES_RBAC');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G8_C8_ROLE_SECURITY_SIMULATOR',
              labelKh: 'ក្លែងធ្វើសិទ្ធិប្រើប្រាស់តាមតួនាទី',
              icon: ShieldCheck,
              onClick: () => {
                setSettingsInitialTab('ROLES_RBAC');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G8_ACTIVITY_LOGS',
          labelKh: 'កំណត់ហេតុសកម្មភាព',
          icon: Activity,
          onClick: () => {
            setSettingsInitialTab('AUDIT_LOGS');
            setActiveSubmenuKey('G8_ACTIVITY_LOGS');
            setBreadcrumbGroupKh('៨. គ្រប់គ្រងអ្នកប្រើប្រាស់');
            setBreadcrumbItemKh('កំណត់ហេតុសកម្មភាព');
            setActiveNav('SYSTEM_SETTINGS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G8_C9_SYSTEM_AUDIT_LOGS',
              labelKh: 'កំណត់ហេតុសកម្មភាពប្រព័ន្ធ',
              icon: Activity,
              onClick: () => {
                setSettingsInitialTab('AUDIT_LOGS');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G8_C10_SCORE_DATA_CHANGE_HISTORY',
              labelKh: 'ប្រវត្តិនៃការកែប្រែពិន្ទុ និងទិន្នន័យ',
              icon: Clock,
              onClick: () => {
                setSettingsInitialTab('AUDIT_LOGS');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
      ],
    },
    {
      id: 'GROUP_9_SYSTEM_SETTINGS' as FunctionalSidebarGroupId,
      code: '9',
      titleKh: '៩. ការកំណត់ប្រព័ន្ធ',
      titleEn: 'GROUP 9: SYSTEM SETTINGS',
      icon: Settings,
      accentText: 'text-slate-300',
      visible: !isCurrentUserStudent,
      isActiveGroup:
        activeNav !== 'STUDENT_PORTAL' && selectedMainGroupId === 'GROUP_9_SYSTEM_SETTINGS',
      items: [
        {
          key: 'G9_SCHOOL_INFO',
          labelKh: 'ព័ត៌មានសាលារៀន',
          icon: Building2,
          onClick: () => {
            setSettingsInitialTab('SCHOOL_PROFILE');
            setActiveSubmenuKey('G9_SCHOOL_INFO');
            setBreadcrumbGroupKh('៩. ការកំណត់ប្រព័ន្ធ');
            setBreadcrumbItemKh('ព័ត៌មានសាលារៀន');
            setActiveNav('SYSTEM_SETTINGS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G9_C1_GENERAL_SCHOOL_PROFILE',
              labelKh: 'ព័ត៌មានទូទៅរបស់សាលារៀន',
              icon: Building2,
              onClick: () => {
                setSettingsInitialTab('SCHOOL_PROFILE');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G9_C2_SCHOOL_EMBLEM_AND_STAMP',
              labelKh: 'រូបសញ្ញា និងត្រាផ្លូវការ',
              icon: Award,
              onClick: () => {
                setSettingsInitialTab('SCHOOL_PROFILE');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G9_ACADEMIC_SETTINGS',
          labelKh: 'ការកំណត់ឆ្នាំសិក្សា',
          icon: Calendar,
          onClick: () => {
            setSettingsInitialTab('ACADEMIC_YEARS');
            setActiveSubmenuKey('G9_ACADEMIC_SETTINGS');
            setBreadcrumbGroupKh('៩. ការកំណត់ប្រព័ន្ធ');
            setBreadcrumbItemKh('ការកំណត់ឆ្នាំសិក្សា');
            setActiveNav('SYSTEM_SETTINGS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G9_C3_ACTIVE_YEAR_AND_SEMESTER',
              labelKh: 'ឆ្នាំសិក្សា និងឆមាសសកម្ម',
              icon: Calendar,
              onClick: () => {
                setSettingsInitialTab('ACADEMIC_YEARS');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G9_C4_MONTHLY_EXAM_CALENDAR',
              labelKh: 'ប្រតិទិននៃការប្រឡងប្រចាំខែ',
              icon: Clock,
              onClick: () => {
                setSettingsInitialTab('ACADEMIC_YEARS');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G9_SCORING_CONFIG',
          labelKh: 'ការកំណត់ចន្លោះពិន្ទុ',
          icon: Sliders,
          onClick: () => {
            setActiveSubjectSubMenu('GRADE_RANGE_CONFIG');
            setActiveSubmenuKey('G9_SCORING_CONFIG');
            setBreadcrumbGroupKh('៩. ការកំណត់ប្រព័ន្ធ');
            setBreadcrumbItemKh('ការកំណត់ចន្លោះពិន្ទុ');
            setActiveNav('SUBJECT_MANAGEMENT');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G9_C5_GLOBAL_GRADING_SCALES',
              labelKh: 'កំណត់និទ្ទេសរួមតាមកម្រិតថ្នាក់',
              icon: Sliders,
              onClick: () => {
                setActiveSubjectSubMenu('GRADE_RANGE_CONFIG');
                setActiveNav('SUBJECT_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G9_C6_SUBJECT_GRADING_SCALES',
              labelKh: 'កំណត់ពិន្ទុនិទ្ទេសតាមមុខវិជ្ជា',
              icon: Award,
              onClick: () => {
                setActiveSubjectSubMenu('GRADE_RANGE_CONFIG');
                setActiveNav('SUBJECT_MANAGEMENT');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G9_PRINTING_CONFIG',
          labelKh: 'ការកំណត់ការបោះពុម្ព',
          icon: Printer,
          onClick: () => {
            setSettingsInitialTab('SCHOOL_PROFILE');
            setActiveSubmenuKey('G9_PRINTING_CONFIG');
            setBreadcrumbGroupKh('៩. ការកំណត់ប្រព័ន្ធ');
            setBreadcrumbItemKh('ការកំណត់ការបោះពុម្ព');
            setActiveNav('SYSTEM_SETTINGS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G9_C7_OFFICIAL_A4_HEADER_FORMAT',
              labelKh: 'ទម្រង់ក្បាលលិខិតផ្លូវការ',
              icon: Printer,
              onClick: () => {
                setSettingsInitialTab('SCHOOL_PROFILE');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G9_C8_SIGNATURE_BLOCKS_CONFIG',
              labelKh: 'ហត្ថលេខានាយកសាលា និងគ្រូបន្ទុកថ្នាក់',
              icon: Edit3,
              onClick: () => {
                setSettingsInitialTab('SCHOOL_PROFILE');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
        {
          key: 'G9_SYSTEM_CONFIG',
          labelKh: 'ការកំណត់ប្រព័ន្ធ',
          icon: Database,
          onClick: () => {
            setSettingsInitialTab('GAS_ENDPOINT');
            setActiveSubmenuKey('G9_SYSTEM_CONFIG');
            setBreadcrumbGroupKh('៩. ការកំណត់ប្រព័ន្ធ');
            setBreadcrumbItemKh('ការកំណត់ប្រព័ន្ធ');
            setActiveNav('SYSTEM_SETTINGS');
            setIsMobileDrawerOpen(false);
          },
          children: [
            {
              key: 'G9_C9_GAS_DATABASE_CONNECTION',
              labelKh: 'ការតភ្ជាប់ប្រព័ន្ធទិន្នន័យ',
              icon: Database,
              onClick: () => {
                setSettingsInitialTab('GAS_ENDPOINT');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
            {
              key: 'G9_C10_BACKUP_AND_RESTORE',
              labelKh: 'បម្រុងទុក និងស្តារទិន្នន័យ',
              icon: ShieldCheck,
              onClick: () => {
                setSettingsInitialTab('BACKUP_RESET');
                setActiveNav('SYSTEM_SETTINGS');
                setIsMobileDrawerOpen(false);
              },
            },
          ],
        },
      ],
    },
  ];

  // Shared Sidebar Content Renderer (used in Desktop Fixed Rail & Mobile Drawer)
  const renderSidebarContent = (expanded: boolean) => (
    <div className="h-full flex flex-col justify-between py-4 px-3 select-none">
      {/* Top Brand Area: Modern Gradient Emblem ('G' / Teok Chor High School) + Collapse/Expand Chevron */}
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() =>
            handleNavigateSidebar(isCurrentUserStudent ? 'STUDENT_TAKE_EXAM' : 'DASHBOARD')
          }
          className="flex items-center gap-3 group cursor-pointer text-left"
          title="វិទ្យាល័យទឹកជោរ (Teok Chor High School)"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#3B82F6] via-[#2563EB] to-[#10B981] text-white font-extrabold text-lg flex items-center justify-center shadow-md shrink-0">
            G
          </div>
          {expanded && (
            <div className="min-w-0">
              <div className="text-xs font-bold text-white font-khmer-moul truncate">
                វិទ្យាល័យទឹកជោរ
              </div>
              <div className="text-[10px] text-slate-400 font-mono-tabular truncate">
                {isCurrentUserStudent ? 'Student Portal' : 'Teok Chor LMS'}
              </div>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsSidebarExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          className="hidden lg:flex w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          {expanded ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Role-Based Navigation Rail:
          - If role === 'STUDENT', renders ONLY "ការចូលប្រឡង" and "មើលលទ្ធផលប្រឡង" (all Teacher/Admin menus are removed from DOM).
          - Otherwise renders the 9 Expandable/Collapsible Functional Groups. */}
      <nav aria-label="Sidebar Navigation" className="my-4 flex-1 flex flex-col gap-1.5 overflow-y-auto no-scrollbar">
        {isCurrentUserStudent ? (
          <>
            {visibleSidebarNavItems.map((item) => {
              const IconComponent = item.icon;
              const isActive =
                (item.id === 'STUDENT_TAKE_EXAM' &&
                  (activeNav === 'ONLINE_EXAMS' ||
                    studentPortalTab === 'AVAILABLE_EXAMS')) ||
                (item.id === 'STUDENT_VIEW_RESULTS' &&
                  studentPortalTab === 'MY_RESULTS' &&
                  activeNav !== 'ONLINE_EXAMS');

              return (
                <div key={item.id} className="relative group">
                  {isActive && (
                    <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full bg-[#3B82F6]" />
                  )}
                  <button
                    type="button"
                    onClick={() => handleNavigateSidebar(item.id)}
                    aria-label={`${item.labelEn} (${item.tooltipKh})`}
                    title={!expanded ? item.tooltipKh : undefined}
                    className={`w-full h-10 rounded-xl flex items-center ${
                      expanded ? 'px-3 justify-start gap-3' : 'justify-center'
                    } transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white shadow-sm'
                        : 'text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 shrink-0" />
                    {expanded && (
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-bold font-khmer-body truncate">
                          {item.labelKh}
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </>
        ) : (
          functionalSidebarGroups
            .filter((g) => g.visible)
            .map((group) => {
              const GroupIcon = group.icon;
              return (
                <div
                  key={group.id}
                  data-testid={`sidebar-group-${group.id}`}
                  className="border-b border-white/5 pb-1 last:border-b-0"
                >
                  <div className="relative group">
                    {group.isActiveGroup && (
                      <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full bg-[#3B82F6]" />
                    )}
                    <button
                      type="button"
                      data-testid={`sidebar-main-menu-${group.id}`}
                      onClick={() => {
                        if (!expanded) {
                          setIsSidebarExpanded(true);
                        }
                        setOpenSidebarGroups((prev) => ({ ...prev, [group.id]: true }));
                        setSelectedMainGroupId(group.id);
                        setIsSubmenuDataOpen(false);
                        setActiveSubmenuKey('');
                        setActiveChildMenuKey('');
                        setBreadcrumbGroupKh(group.titleKh);
                        setBreadcrumbItemKh('សូមជ្រើសរើសមុខងាររង');
                        if (activeNav === 'STUDENT_PORTAL') {
                          setActiveNav('DASHBOARD');
                        }
                        setIsMobileDrawerOpen(false);
                      }}
                      aria-label={`${group.titleEn} (${group.titleKh})`}
                      title={!expanded ? group.titleKh : undefined}
                      className={`w-full h-10 rounded-xl flex items-center ${
                        expanded ? 'px-3 justify-between' : 'justify-center'
                      } transition-all cursor-pointer ${
                        group.isActiveGroup
                          ? 'bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white shadow-sm'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <GroupIcon
                          className={`w-4 h-4 shrink-0 ${
                            group.isActiveGroup ? 'text-white' : group.accentText
                          }`}
                        />
                        {expanded && (
                          <span className="text-xs font-extrabold font-khmer-body truncate">
                            {group.titleKh}
                          </span>
                        )}
                      </div>
                      {expanded && (
                        <span
                          className={`text-[10px] font-extrabold font-mono-tabular px-1.5 py-0.5 rounded-md shrink-0 ${
                            group.isActiveGroup
                              ? 'bg-white/25 text-white'
                              : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          {group.items.length}
                        </span>
                      )}
                    </button>

                    {/* Level 2 (Sub Menu) & Level 3 (Child Menu) Tree inside Sidebar when Main Menu is active */}
                    {expanded && group.isActiveGroup && (
                      <div className="mt-1 ml-3.5 pl-2.5 border-l border-white/15 space-y-1">
                        {group.items.map((sub, subIdx) => {
                          const SubIcon = sub.icon;
                          const isSubSelected = activeSubmenuKey === sub.key;
                          return (
                            <div key={sub.key}>
                              <button
                                type="button"
                                data-testid={`sidebar-tree-sub-${sub.key}`}
                                onClick={() => {
                                  setSelectedMainGroupId(group.id);
                                  setActiveSubmenuKey(sub.key);
                                  setActiveChildMenuKey('');
                                  setIsSubmenuDataOpen(false);
                                  setBreadcrumbGroupKh(group.titleKh);
                                  setBreadcrumbItemKh(sub.labelKh);
                                }}
                                className={`w-full py-1.5 px-2.5 rounded-lg flex items-center justify-between gap-2 text-left text-[11px] font-bold font-khmer-body transition-colors cursor-pointer ${
                                  isSubSelected
                                    ? 'bg-white/15 text-white'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                }`}
                              >
                                <span className="flex items-center gap-2 min-w-0 truncate">
                                  <SubIcon className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                                  <span className="truncate">
                                    {subIdx + 1}. {sub.labelKh}
                                  </span>
                                </span>
                                {sub.children && sub.children.length > 0 && (
                                  <ChevronDown
                                    className={`w-3 h-3 shrink-0 transition-transform ${
                                      isSubSelected ? 'rotate-0 text-blue-300' : '-rotate-90 text-slate-500'
                                    }`}
                                  />
                                )}
                              </button>

                              {/* Level 3: Child Menu items nested under active Sub Menu */}
                              {isSubSelected && sub.children && sub.children.length > 0 && (
                                <div className="mt-0.5 ml-3 pl-2.5 border-l border-blue-400/30 space-y-0.5">
                                  {sub.children.map((child, childIdx) => {
                                    const isChildSelected =
                                      isSubmenuDataOpen && activeChildMenuKey === child.key;
                                    return (
                                      <button
                                        key={child.key}
                                        type="button"
                                        data-testid={`sidebar-tree-child-${child.key}`}
                                        onClick={() => {
                                          setSelectedMainGroupId(group.id);
                                          setActiveSubmenuKey(sub.key);
                                          setActiveChildMenuKey(child.key);
                                          setIsSubmenuDataOpen(true);
                                          sub.onClick();
                                          child.onClick();
                                        }}
                                        className={`w-full py-1 px-2 rounded-md flex items-center gap-1.5 text-left text-[10.5px] font-semibold font-khmer-body transition-colors cursor-pointer ${
                                          isChildSelected
                                            ? 'bg-blue-500/30 text-blue-200 font-bold'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-70" />
                                        <span className="truncate">
                                          {subIdx + 1}.{childIdx + 1} {child.labelKh}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!expanded && (
                      <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-14 top-1/2 -translate-y-1/2 z-50 px-3 py-1.5 rounded-xl bg-[#14171F] text-white text-xs font-semibold font-khmer-body whitespace-nowrap border border-white/10 shadow-lg">
                        {group.titleKh}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
        )}
      </nav>

      {/* Bottom Utility Rail:
          - Teacher/Admin tools (+ Quick Create & Settings Gear) are completely removed from DOM when role === 'STUDENT'.
          - User Avatar & Logout Button ("ចាកចេញ") are always available. */}
      <div className="pt-3 border-t border-white/10 flex flex-col gap-1.5">
        {!isCurrentUserStudent && (
          <>
            {/* Quick Create + Button (Staff/Admin Only) */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => {
                  handleNavigateSidebar('STUDENTS');
                  setOpenCreateStudentSignal((n) => n + 1);
                }}
                aria-label="បន្ថែមសិស្សថ្មី (Quick Create)"
                title={!expanded ? 'បន្ថែមសិស្សថ្មី' : undefined}
                className={`w-full h-9 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center ${
                  expanded ? 'px-3 justify-start gap-3' : 'justify-center'
                } transition-colors cursor-pointer`}
              >
                <Plus className="w-4 h-4 shrink-0" />
                {expanded && (
                  <span className="text-xs font-semibold font-khmer-body truncate">
                    បន្ថែមសិស្សថ្មី
                  </span>
                )}
              </button>
              {!expanded && (
                <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-14 top-1/2 -translate-y-1/2 z-50 px-3 py-1.5 rounded-xl bg-[#14171F] text-white text-xs font-semibold font-khmer-body whitespace-nowrap border border-white/10 shadow-lg">
                  បន្ថែមសិស្សថ្មី
                </div>
              )}
            </div>
          </>
        )}

        {/* User Avatar at the very bottom (above Logout "ចាកចេញ"):
            - When logged in as a Student, clicking this button opens the Student's Personal Profile ("MY_PROFILE").
            - When logged in as Staff/Admin, clicking opens the Account Switcher modal. */}
        <div className="relative group">
          {isCurrentUserStudent &&
            studentPortalTab === 'MY_PROFILE' &&
            activeNav !== 'ONLINE_EXAMS' && (
              <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full bg-[#3B82F6]" />
            )}
          <button
            type="button"
            data-testid="sidebar-user-profile-btn"
            onClick={() => {
              if (isCurrentUserStudent) {
                setStudentPortalTab('MY_PROFILE');
                setActiveNav('STUDENT_PORTAL');
                setIsMobileDrawerOpen(false);
              } else {
                setIsSystemLoginOpen(true);
              }
            }}
            aria-label={
              isCurrentUserStudent
                ? `ព័ត៌មានផ្ទាល់ខ្លួន (${activeUser.FullNameKh})`
                : `${activeUser.FullNameKh} (${activeRole?.RoleName})`
            }
            className={`w-full mt-1 p-1.5 rounded-2xl flex items-center ${
              expanded ? 'justify-start gap-2.5' : 'justify-center'
            } transition-all cursor-pointer ${
              isCurrentUserStudent &&
              studentPortalTab === 'MY_PROFILE' &&
              activeNav !== 'ONLINE_EXAMS'
                ? 'bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white shadow-sm ring-1 ring-blue-400/50'
                : 'hover:bg-white/10'
            }`}
            title={
              isCurrentUserStudent
                ? `${activeUser.FullNameKh} (${activeRole?.RoleName}) — ចុចដើម្បីមើលព័ត៌មានផ្ទាល់ខ្លួន និងរូប Profile`
                : `${activeUser.FullNameKh} (${activeRole?.RoleName}) — ចុចដើម្បីប្តូរគណនី`
            }
          >
            <div className="relative shrink-0">
              <img
                src={
                  isCurrentUserStudent
                    ? buildStudentPersonalProfileSummary(
                        db,
                        activeUserId,
                        HONOR_PORTRAIT_URLS
                      ).profilePhotoUrl
                    : resolveStudentProfilePhotoUrl(
                        activeUser.ProfileImageID,
                        HONOR_PORTRAIT_URLS,
                        1
                      )
                }
                alt={activeUser.FullNameKh}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-white/20"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#14171F] absolute bottom-0 right-0" />
            </div>
            {expanded && (
              <div className="min-w-0 text-left">
                <div className="text-xs font-bold text-white font-khmer-body truncate">
                  {activeUser.FullNameKh}
                </div>
                <div
                  className={`text-[10px] font-mono-tabular truncate ${
                    isCurrentUserStudent &&
                    studentPortalTab === 'MY_PROFILE' &&
                    activeNav !== 'ONLINE_EXAMS'
                      ? 'text-blue-100'
                      : 'text-emerald-400'
                  }`}
                >
                  {activeTeacherPermissionProfile.hasBothRolesInSingleAccount
                    ? 'គ្រូបន្ទុកថ្នាក់ + គ្រូមុខវិជ្ជា'
                    : activeRole?.RoleName}
                </div>
              </div>
            )}
          </button>
        </div>

        {/* Sidebar Logout Button ("ចាកចេញ") */}
        <div className="relative group">
          <button
            type="button"
            onClick={() => setIsSystemLogoutOpen(true)}
            aria-label="ចាកចេញ (Logout)"
            title={!expanded ? 'ចាកចេញ' : undefined}
            className={`w-full h-9 rounded-xl flex items-center ${
              expanded ? 'px-3 justify-start gap-3' : 'justify-center'
            } text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition-colors cursor-pointer`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {expanded && (
              <span className="text-xs font-semibold font-khmer-body truncate">
                ចាកចេញ
              </span>
            )}
          </button>
          {!expanded && (
            <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-14 top-1/2 -translate-y-1/2 z-50 px-3 py-1.5 rounded-xl bg-[#14171F] text-rose-300 text-xs font-semibold font-khmer-body whitespace-nowrap border border-white/10 shadow-lg">
              ចាកចេញ
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <AuthProvider
      db={db}
      setDb={setDb}
      activeUserId={activeUserId}
      setActiveUserId={setActiveUserId}
      onLogout={() => {
        setIsSystemLogoutOpen(false);
        setIsLoggedOutLock(true);
        setIsSystemLoginOpen(true);
      }}
    >
      <div className="min-h-screen flex bg-[#F4F6F9] text-slate-900">
        {/* A. Left Compact Dark Icon Sidebar (Fixed on Desktop >=1024px) */}
        <aside
          aria-label="Desktop Compact Sidebar"
          className={`no-print hidden lg:block fixed inset-y-0 left-0 z-40 bg-[#14171F] border-r border-white/5 transition-all duration-200 ${
            isSidebarExpanded ? 'w-64' : 'w-[72px]'
          }`}
        >
          {renderSidebarContent(isSidebarExpanded)}
        </aside>

        {/* Mobile Slide-Over Drawer (<1024px) */}
        {isMobileDrawerOpen && (
          <div className="no-print fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
              onClick={() => setIsMobileDrawerOpen(false)}
            />
            <aside className="relative w-64 max-w-[80vw] bg-[#14171F] border-r border-white/10 h-full z-10">
              <button
                type="button"
                aria-label="Close mobile menu"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="absolute top-4 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
              {renderSidebarContent(true)}
            </aside>
          </div>
        )}

        {/* Right Main Content Column */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
            isSidebarExpanded ? 'lg:pl-64' : 'lg:pl-[72px]'
          }`}
        >
          {/* B. Top Header Bar (h-20, Sticky, Clean & Minimal) */}
          <header
            className={`no-print h-20 sticky top-0 z-30 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 border-b transition-colors ${
              isDarkHeaderAccent
                ? 'bg-[#14171F] text-white border-white/10'
                : 'bg-white/95 backdrop-blur-md text-slate-900 border-slate-200/80'
            }`}
          >
            {/* Left Greeting Block */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                aria-label="Open navigation drawer"
                onClick={() => setIsMobileDrawerOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="min-w-0">
                <h1
                  className={`text-sm sm:text-base font-extrabold tracking-tight font-khmer-body truncate ${
                    isDarkHeaderAccent ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {formatGreetingForUser()}
                </h1>
                <p
                  className={`text-[11px] sm:text-xs font-khmer-body truncate mt-0.5 ${
                    isDarkHeaderAccent ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  វិទ្យាល័យទឹកជោរ • ឆ្នាំសិក្សា {selectedAcademicYear}
                </p>
              </div>
            </div>

            {/* Center Global Search Pill (Staff/Admin Only) */}
            {!isCurrentUserStudent && (
              <div className="hidden md:flex items-center relative w-72 lg:w-80 shrink-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  placeholder="ស្វែងរកសិស្ស / អត្តលេខ / ថ្នាក់..."
                  aria-label="ស្វែងរកសិស្ស / អត្តលេខ / ថ្នាក់"
                  className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border transition-all font-khmer-body focus:outline-none ${
                    isDarkHeaderAccent
                      ? 'bg-white/10 border-white/15 text-white placeholder:text-slate-400 focus:bg-white/15'
                      : 'bg-slate-100 border-transparent text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
                  }`}
                />
              </div>
            )}

            {/* Right Action Controls */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Quick Account / Role Switcher Button */}
              <button
                type="button"
                onClick={() => setIsSystemLoginOpen(true)}
                aria-label="ប្តូរគណនីប្រើប្រាស់ (Switch Account)"
                title={`ប្តូរគណនីប្រើប្រាស់ (${activeUser.FullNameKh} • ${activeRole?.RoleName})`}
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold font-khmer-body transition-colors cursor-pointer ${
                  isDarkHeaderAccent
                    ? 'border-white/15 bg-white/10 text-white hover:bg-white/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="max-w-[120px] truncate">{activeUser.FullNameKh}</span>
              </button>

              {/* Notification Bell Icon & Interactive Dropdown Panel */}
              <div className="relative" ref={notificationDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsNotificationOpen((prev) => !prev)}
                  aria-label="ការជូនដំណឹង (Notifications)"
                  title="ការជូនដំណឹង (Notifications)"
                  aria-expanded={isNotificationOpen}
                  className={`p-2.5 rounded-xl border transition-colors relative shadow-2xs cursor-pointer ${
                    isDarkHeaderAccent
                      ? 'border-white/15 bg-white/10 text-white hover:bg-white/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white font-mono-tabular">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>

                {isNotificationOpen && (
                  <div
                    role="dialog"
                    aria-label="ការជូនដំណឹង (Notifications)"
                    className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-900"
                  >
                    <div className="border-b border-slate-100 px-4 py-3.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 font-khmer-body truncate">
                          ការជូនដំណឹង (Notifications)
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/70 text-[11px] font-bold font-khmer-body whitespace-nowrap shrink-0">
                          {unreadNotificationCount} ថ្មី
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleMarkAllNotificationsRead}
                        className="text-xs text-indigo-600 hover:underline font-semibold font-khmer-body cursor-pointer whitespace-nowrap shrink-0"
                      >
                        អានរួចទាំងអស់
                      </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                      {visibleNotifications.map((notif) => (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => handleClickNotificationItem(notif.id, notif.targetNav)}
                          className={`w-full text-left p-4 flex items-start gap-3 transition-colors hover:bg-slate-50/90 cursor-pointer ${
                            !notif.isRead ? 'bg-indigo-50/25' : 'bg-white'
                          }`}
                        >
                          <span
                            className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                              !notif.isRead ? notif.dotColorClass : 'bg-slate-200'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-xs leading-relaxed font-khmer-body ${
                                !notif.isRead
                                  ? 'font-bold text-slate-900'
                                  : 'font-medium text-slate-600'
                              }`}
                            >
                              {notif.message}
                            </p>
                            <span className="block text-[11px] text-slate-400 font-khmer-body mt-1">
                              {notif.timeAgo}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-slate-100 p-3 text-center bg-slate-50/50">
                      <button
                        type="button"
                        onClick={() => {
                          if (isCurrentUserStudent) {
                            handleNavigateSidebar('STUDENT_VIEW_RESULTS');
                          } else {
                            setSettingsInitialTab('AUDIT_LOGS');
                            handleNavigateSidebar('SYSTEM_SETTINGS');
                          }
                          setIsNotificationOpen(false);
                        }}
                        className="text-xs font-semibold text-slate-600 hover:text-indigo-600 font-khmer-body transition-colors cursor-pointer"
                      >
                        មើលការជូនដំណឹងទាំងអស់ (View all notifications)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Theme Toggle Icon Button (Moon / Sun) */}
              <button
                type="button"
                onClick={() => setIsDarkHeaderAccent((v) => !v)}
                aria-label="ប្តូរពណ៌ផ្ទៃ Header (Toggle theme accent)"
                title="ប្តូរពណ៌ផ្ទៃ Header"
                className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                  isDarkHeaderAccent
                    ? 'border-white/15 bg-white/10 text-amber-300 hover:bg-white/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {isDarkHeaderAccent ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </header>

          {/* Main Workspace Viewport */}
          <main id="top" className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Phase 3: Google Sheets Persistence & Connection Status Bar */}
            <section
              aria-label="Google Sheets Database Connection Status"
              data-testid="gas-persistence-status-bar"
              className="no-print mb-4 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-2xs space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800 font-khmer-body">
                    <Database className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>ស្ថានភាពតភ្ជាប់មូលដ្ឋានទិន្នន័យ (25 តារាង)៖</span>
                  </span>

                  {/* Connection Status Pill */}
                  {adapterConfig.mode === 'GAS_PRODUCTION' &&
                    adapterConfig.connectionState === 'CONNECTED' &&
                    !adapterConfig.simulateConnectionFailure && (
                      <span
                        data-testid="gas-connection-badge"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-extrabold font-khmer-body"
                      >
                        <span>🟢 បានភ្ជាប់ Google Sheets (GAS_PRODUCTION)</span>
                      </span>
                    )}

                  {adapterConfig.mode === 'GAS_PRODUCTION' &&
                    (adapterConfig.connectionState === 'ERROR' ||
                      adapterConfig.connectionState === 'DISCONNECTED' ||
                      adapterConfig.simulateConnectionFailure) && (
                      <span
                        data-testid="gas-connection-badge"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold font-khmer-body"
                      >
                        <span>
                          🔴 ដាច់ការតភ្ជាប់ Google Sheets (GAS Unavailable — ទិន្នន័យមិនរក្សាទុក)
                        </span>
                      </span>
                    )}

                  {adapterConfig.mode === 'IN_MEMORY_PREVIEW' && (
                    <span
                      data-testid="gas-connection-badge"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold font-khmer-body"
                    >
                      <span>🟡 In-Memory Preview (Local Dev — មិនទាន់ភ្ជាប់ Google Sheets)</span>
                    </span>
                  )}

                  <span
                    data-testid="gas-record-count-summary"
                    className="text-[11px] font-mono-tabular font-bold text-slate-500"
                  >
                    សិស្ស៖ {db.Students.length} • សរុប 25 តារាង
                  </span>
                </div>

                {/* Mode Switcher & Connection Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="switch-mode-in-memory-btn"
                    onClick={() => {
                      DataService.setPersistenceMode('IN_MEMORY_PREVIEW');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold font-khmer-body border transition-all cursor-pointer ${
                      adapterConfig.mode === 'IN_MEMORY_PREVIEW'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    IN_MEMORY_PREVIEW
                  </button>

                  <button
                    type="button"
                    data-testid="switch-mode-gas-production-btn"
                    onClick={() => {
                      const res = DataService.setPersistenceMode(
                        'GAS_PRODUCTION',
                        {
                          currentDb: db,
                          simulateConnectionFailure: false,
                        }
                      );
                      if (res.ok && res.db) {
                        setDb(res.db);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold font-khmer-body border transition-all cursor-pointer ${
                      adapterConfig.mode === 'GAS_PRODUCTION' &&
                      !adapterConfig.simulateConnectionFailure
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    GAS_PRODUCTION (Google Sheets)
                  </button>

                  {adapterConfig.mode === 'GAS_PRODUCTION' && (
                    <button
                      type="button"
                      data-testid="toggle-gas-connection-failure-btn"
                      onClick={() => {
                        DataService.setSimulateGasFailure(
                          !adapterConfig.simulateConnectionFailure
                        );
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold font-khmer-body border transition-all cursor-pointer ${
                        adapterConfig.simulateConnectionFailure
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                      }`}
                    >
                      {adapterConfig.simulateConnectionFailure
                        ? 'ភ្ជាប់ Google Sheets ឡើងវិញ (Reconnect)'
                        : 'សាកល្បងផ្តាច់ការតភ្ជាប់ GAS (Simulate Failure)'}
                    </button>
                  )}
                </div>
              </div>

              {/* Operation Feedback Strip (LOADING / SUCCESS / ERROR) */}
              {adapterFeedback && adapterFeedback.status !== 'IDLE' && (
                <div
                  data-testid="gas-operation-feedback-banner"
                  data-feedback-status={adapterFeedback.status}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-khmer-body flex flex-wrap items-center justify-between gap-2 ${
                    adapterFeedback.status === 'ERROR'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : adapterFeedback.status === 'LOADING'
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-extrabold">
                      {adapterFeedback.titleKh}៖
                    </span>
                    <span className="truncate">{adapterFeedback.messageKh}</span>
                  </div>
                  <span className="text-[11px] font-mono-tabular font-bold shrink-0">
                    {adapterFeedback.persistedToGoogleSheets
                      ? 'Persisted to Google Sheets (25 Tables)'
                      : 'Not Saved to Google Sheets'}
                  </span>
                </div>
              )}
            </section>

            {/* Hierarchical Menu Panel: Main Menu -> Sub Menu -> Child Menu */}
            {!isCurrentUserStudent && activeNav !== 'STUDENT_PORTAL' && !isSubmenuDataOpen && (() => {
              const activeGroup =
                functionalSidebarGroups.find(
                  (g) => g.visible && g.id === selectedMainGroupId
                ) || functionalSidebarGroups[0];
              if (!activeGroup) return null;
              const ActiveGroupIcon = activeGroup.icon;
              const selectedSubIndex = activeGroup.items.findIndex(
                (sub) => sub.key === activeSubmenuKey
              );
              const selectedSubItem =
                selectedSubIndex >= 0 ? activeGroup.items[selectedSubIndex] : null;

              // LEVEL 3 VIEW: When a Sub Menu is selected, display its Child Menu Buttons
              if (selectedSubItem && selectedSubItem.children && selectedSubItem.children.length > 0) {
                const SelectedSubIcon = selectedSubItem.icon;
                return (
                  <section
                    aria-label="Active Submenu Child Menu Buttons"
                    data-testid="active-submenu-child-buttons"
                    className="no-print mb-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          data-testid="back-to-submenu-list-btn"
                          onClick={() => {
                            setActiveSubmenuKey('');
                            setActiveChildMenuKey('');
                            setIsSubmenuDataOpen(false);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-blue-700 hover:border-blue-300 text-xs font-extrabold font-khmer-body transition-all cursor-pointer shrink-0 shadow-2xs"
                        >
                          <ChevronLeft className="w-4 h-4 text-blue-600" />
                          <span>ត្រឡប់ក្រោយ</span>
                        </button>

                        <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm font-bold font-khmer-body truncate">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSubmenuKey('');
                              setActiveChildMenuKey('');
                              setIsSubmenuDataOpen(false);
                            }}
                            className="text-slate-500 hover:text-blue-600 transition-colors cursor-pointer truncate"
                          >
                            {activeGroup.titleKh}
                          </button>
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="inline-flex items-center gap-2 text-slate-900 font-extrabold font-khmer-moul truncate">
                            <span className="w-7 h-7 rounded-lg bg-blue-600 text-white inline-flex items-center justify-center shrink-0">
                              <SelectedSubIcon className="w-4 h-4" />
                            </span>
                            <span className="truncate">
                              {selectedSubIndex + 1}. {selectedSubItem.labelKh}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {selectedSubItem.children.map((child, childIdx) => {
                        const ChildIcon = child.icon;
                        return (
                          <button
                            key={child.key}
                            type="button"
                            data-testid={`sidebar-childmenu-${child.key}`}
                            onClick={() => {
                              setSelectedMainGroupId(activeGroup.id);
                              setActiveSubmenuKey(selectedSubItem.key);
                              setActiveChildMenuKey(child.key);
                              setIsSubmenuDataOpen(true);
                              selectedSubItem.onClick();
                              child.onClick();
                            }}
                            className="flex items-center gap-3 p-4 rounded-2xl text-sm text-left font-bold font-khmer-body transition-all cursor-pointer border bg-slate-50 hover:bg-blue-50/80 text-slate-800 hover:text-blue-700 border-slate-200/90 hover:border-blue-400 shadow-2xs hover:shadow-sm"
                          >
                            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white text-blue-600 border border-slate-200/80 shadow-2xs">
                              <ChildIcon className="w-5 h-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="leading-snug">
                                {selectedSubIndex + 1}.{childIdx + 1} {child.labelKh}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              }

              // LEVEL 2 VIEW: When a Main Menu is selected, display its Sub Menu Buttons (no Back button here)
              return (
                <section
                  aria-label="Active Main Menu Submenu Buttons"
                  data-testid="active-group-submenu-buttons"
                  className="no-print mb-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6"
                >
                  <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                      <ActiveGroupIcon className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 font-khmer-moul truncate">
                      {activeGroup.titleKh}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeGroup.items.map((sub, idx) => {
                      const SubIcon = sub.icon;
                      return (
                        <button
                          key={sub.key}
                          type="button"
                          data-testid={`sidebar-submenu-${sub.key}`}
                          onClick={() => {
                            setSelectedMainGroupId(activeGroup.id);
                            setActiveSubmenuKey(sub.key);
                            setActiveChildMenuKey('');
                            if (sub.children && sub.children.length > 0) {
                              setIsSubmenuDataOpen(false);
                              setBreadcrumbGroupKh(activeGroup.titleKh);
                              setBreadcrumbItemKh(sub.labelKh);
                            } else {
                              setIsSubmenuDataOpen(true);
                              sub.onClick();
                            }
                          }}
                          className="flex items-center gap-3 p-4 rounded-2xl text-sm text-left font-bold font-khmer-body transition-all cursor-pointer border bg-slate-50 hover:bg-blue-50/80 text-slate-800 hover:text-blue-700 border-slate-200/90 hover:border-blue-400 shadow-2xs hover:shadow-sm"
                        >
                          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white text-blue-600 border border-slate-200/80 shadow-2xs">
                            <SubIcon className="w-5 h-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="leading-snug">
                              {idx + 1}. {sub.labelKh}
                            </div>
                          </div>
                          {sub.children && sub.children.length > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200/80 text-[11px] font-extrabold text-slate-500 font-mono-tabular shrink-0">
                              {sub.children.length}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })()}

            {/* Strict Student Role-Based Workspace:
                When logged in as STUDENT, allow "ការចូលប្រឡង" (Take Exam), "មើលលទ្ធផលប្រឡង" (View Exam Results), and "ព័ត៌មានផ្ទាល់ខ្លួន & រូប Profile" */}
            {isCurrentUserStudent ? (
              activeNav === 'ONLINE_EXAMS' ? (
                <OnlineExamsPortalView
                  db={db}
                  setDb={setDb}
                  activeUserId={activeUserId}
                  externalSearchQuery={globalSearchQuery}
                  onCreateExam={handleCreateExam}
                  onSubmitExamAttempt={handleSubmitExamAttempt}
                  onGradeManualAnswers={handleGradeManualAnswers}
                />
              ) : (
                <StudentPortal
                  db={db}
                  setDb={setDb}
                  activeUserId={activeUserId}
                  activeTab={studentPortalTab}
                  onTabChange={(tab) => {
                    setStudentPortalTab(tab);
                    setActiveNav(
                      tab === 'MY_RESULTS'
                        ? 'STUDENT_VIEW_RESULTS'
                        : tab === 'MY_PROFILE'
                          ? 'STUDENT_PORTAL'
                          : 'STUDENT_TAKE_EXAM'
                    );
                  }}
                  onSubmitExamAttempt={handleSubmitExamAttempt}
                  onStartExam={() => handleNavigateSidebar('ONLINE_EXAMS')}
                  onLogout={() => setIsSystemLogoutOpen(true)}
                />
              )
            ) : (isSubmenuDataOpen || activeNav === 'STUDENT_PORTAL') ? (
              <>
                {/* Top Back Button & 3-Level Hierarchy Bar (Main Menu > Sub Menu > Child Menu) */}
                {(() => {
                  const activeGroup =
                    functionalSidebarGroups.find(
                      (g) => g.visible && g.id === selectedMainGroupId
                    ) || functionalSidebarGroups[0];
                  const activeSubItem = activeGroup?.items.find(
                    (sub) => sub.key === activeSubmenuKey
                  );
                  const activeChildItem = activeSubItem?.children?.find(
                    (child) => child.key === activeChildMenuKey
                  );
                  return (
                    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-200/90 shadow-2xs">
                      <button
                        type="button"
                        data-testid="back-to-submenu-btn"
                        onClick={() => {
                          setIsSubmenuDataOpen(false);
                          if (activeSubItem?.children && activeSubItem.children.length > 0) {
                            setActiveChildMenuKey('');
                          } else {
                            setActiveSubmenuKey('');
                            setActiveChildMenuKey('');
                          }
                          if (activeNav === 'STUDENT_PORTAL') {
                            setActiveNav('DASHBOARD');
                          }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-blue-700 hover:border-blue-300 text-xs sm:text-sm font-extrabold font-khmer-body transition-all cursor-pointer shadow-2xs"
                      >
                        <ChevronLeft className="w-4 h-4 text-blue-600" />
                        <span>ត្រឡប់ក្រោយ</span>
                      </button>

                      {activeGroup && (
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0 text-xs sm:text-sm font-bold text-slate-700 font-khmer-body">
                          <button
                            type="button"
                            onClick={() => {
                              setIsSubmenuDataOpen(false);
                              setActiveSubmenuKey('');
                              setActiveChildMenuKey('');
                            }}
                            className="text-slate-500 hover:text-blue-600 transition-colors cursor-pointer truncate"
                          >
                            {activeGroup.titleKh}
                          </button>
                          {activeSubItem && (
                            <>
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              <button
                                type="button"
                                onClick={() => {
                                  setIsSubmenuDataOpen(false);
                                  setActiveChildMenuKey('');
                                }}
                                className={`transition-colors cursor-pointer truncate ${
                                  activeChildItem
                                    ? 'text-slate-600 hover:text-blue-600'
                                    : 'text-blue-700 font-extrabold'
                                }`}
                              >
                                {activeSubItem.labelKh}
                              </button>
                            </>
                          )}
                          {activeChildItem && (
                            <>
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="text-blue-700 font-extrabold truncate">
                                {activeChildItem.labelKh}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 1. DASHBOARD (Sections A, B, C, D, E + Homeroom Teacher Dashboard) */}
                {activeNav === 'DASHBOARD' && (
                  <GrowlyDashboardView
                    db={db}
                    activeUserId={activeUserId}
                    searchQuery={globalSearchQuery}
                    dashboardSubMode={dashboardSubMode}
                    onChangeDashboardSubMode={(mode) => {
                      setDashboardSubMode(mode);
                      if (mode === 'MAIN_DASHBOARD') {
                        setActiveSubmenuKey('G1_MAIN_DASHBOARD');
                        setBreadcrumbItemKh('ទំព័រដើមរួម (Main Dashboard)');
                      } else if (mode === 'ACADEMIC_STATISTICS') {
                        setActiveSubmenuKey('G1_ACADEMIC_STATS');
                        setBreadcrumbItemKh('ស្ថិតិសិក្សា (Academic Statistics)');
                      } else {
                        setActiveSubmenuKey('G1_PERFORMANCE_OVERVIEW');
                        setBreadcrumbItemKh('ទិដ្ឋភាពរួមនៃលទ្ធផលសិក្សា (Performance Overview)');
                      }
                    }}
                    onNavigateSection={(sec) => handleNavigateSidebar(sec as SidebarNavId)}
                    onOpenReportShortcut={(cat, sub) => {
                      setSelectedMainGroupId('GROUP_7_REPORTS');
                      setIsSubmenuDataOpen(true);
                      setActiveReportCategory(cat);
                      setActiveReportSubItem(sub);
                      setActiveSubmenuKey(`G7_${cat}`);
                      setBreadcrumbGroupKh('៧. របាយការណ៍ (Report Center)');
                      const foundCat = REPORT_CATEGORIES_CATALOG.find((c) => c.id === cat);
                      const foundSub = foundCat?.subReports.find((s) => s.id === sub);
                      setBreadcrumbItemKh(foundSub?.titleKh || foundCat?.titleKh || 'មជ្ឈមណ្ឌលរបាយការណ៍');
                      setActiveNav('REPORT_CENTER');
                    }}
                  />
                )}

                {/* 2. STUDENTS / ACADEMIC YEARS (36-Column Master Roster & 19-Sheet Database Explorer) */}
                {activeNav === 'STUDENTS' && (
                  <DatabaseExplorerView
                    key={`${dbTargetSheet}-${dbTargetSubTab}-${activeSubmenuKey}`}
                    db={db}
                    setDb={setDb}
                    activeUserId={activeUserId}
                    defaultSheet={dbTargetSheet}
                    defaultSubTab={dbTargetSubTab}
                    externalSearchQuery={globalSearchQuery}
                    openCreateModalSignal={openCreateStudentSignal}
                    onAddStudentRecord={handleAddStudentRecord}
                    onEditStudentRecord={handleEditStudentRecord}
                    onDeleteStudentRecord={handleDeleteStudentRecord}
                    onCreateClassRecord={handleCreateClassRecord}
                    onResetDatabase={() =>
                      DataService.resetToInitialSeedState(setDb)
                    }
                  />
                )}

                {/* 2B. TEACHERS & SUBJECT-CLASS ASSIGNMENTS */}
                {activeNav === 'TEACHERS' && (
                  <TeacherManagementView
                    db={db}
                    setDb={setDb}
                    activeUserId={activeUserId}
                    externalSearchQuery={globalSearchQuery}
                    onSelectUser={(uid) => setActiveUserId(uid)}
                    onNavigateSection={(sec) => handleNavigateSidebar(sec as SidebarNavId)}
                  />
                )}

                {/* 3. CLASSES (17 Classes: 7A-12C & Enrollments) */}
                {activeNav === 'CLASSES' && (
                  <DatabaseExplorerView
                    db={db}
                    setDb={setDb}
                    activeUserId={activeUserId}
                    defaultSheet="Classes"
                    defaultSubTab="LIVE_DATA"
                    externalSearchQuery={globalSearchQuery}
                    onAddStudentRecord={handleAddStudentRecord}
                    onEditStudentRecord={handleEditStudentRecord}
                    onDeleteStudentRecord={handleDeleteStudentRecord}
                    onCreateClassRecord={handleCreateClassRecord}
                    onResetDatabase={() =>
                      DataService.resetToInitialSeedState(setDb)
                    }
                  />
                )}

                {/* 3B. GROUP 3: SUBJECT MANAGEMENT */}
                {activeNav === 'SUBJECT_MANAGEMENT' && (
                  <SubjectManagementView
                    db={db}
                    setDb={setDb}
                    activeUserId={activeUserId}
                    activeSubMenu={activeSubjectSubMenu}
                    onSubMenuChange={(sub) => {
                      setActiveSubjectSubMenu(sub);
                      if (sub === 'SUBJECT_LIST') setActiveSubmenuKey('G3_SUBJECT_LIST');
                      else if (sub === 'SUBJECT_ACADEMIC_CONFIG')
                        setActiveSubmenuKey('G3_SUBJECT_ACADEMIC_CONFIG');
                      else if (sub === 'MAX_SCORE_CONFIG')
                        setActiveSubmenuKey('G3_MAX_SCORE_CONFIG');
                      else if (sub === 'GRADE_RANGE_CONFIG')
                        setActiveSubmenuKey('G3_GRADE_RANGE_CONFIG');
                      else if (sub === 'TEACHER_SUBJECT_CLASS_ASSIGNMENTS')
                        setActiveSubmenuKey('G3_TEACHER_SUBJECT_ASSIGNMENT');
                    }}
                    onSelectUser={(uid) => setActiveUserId(uid)}
                    onNavigateSection={(sec) => handleNavigateSidebar(sec as SidebarNavId)}
                  />
                )}

                {/* 3C. GROUP 5: SCORE MANAGEMENT */}
                {activeNav === 'SCORE_MANAGEMENT' && (
                  <ScoreManagementView
                    db={db}
                    setDb={setDb}
                    activeUserId={activeUserId}
                    activeSubMenu={activeScoreSubMenu}
                    onSubMenuChange={(sub) => {
                      setActiveScoreSubMenu(sub);
                      if (sub === 'SCORE_ENTRY') setActiveSubmenuKey('G5_SCORE_ENTRY');
                      else if (sub === 'SCORES_BY_CLASS')
                        setActiveSubmenuKey('G5_MONTHLY_SCORE_MGMT');
                      else if (sub === 'SCORES_BY_SUBJECT')
                        setActiveSubmenuKey('G5_SEMESTER_SCORE_MGMT');
                      else if (sub === 'MISSING_SCORE_MONITORING')
                        setActiveSubmenuKey('G5_SCORE_VERIFICATION');
                      else if (sub === 'SCORE_SUBMISSION_STATUS')
                        setActiveSubmenuKey('G5_SCORE_APPROVAL');
                    }}
                    onOpenOfficialReport={(tpl) => {
                      setReportTargetTemplate(tpl);
                      handleNavigateSidebar('OFFICIAL_REPORTS');
                    }}
                    onNavigateSubjectConfig={() => {
                      setSelectedMainGroupId('GROUP_3_SUBJECT_MANAGEMENT');
                      setIsSubmenuDataOpen(true);
                      setActiveSubjectSubMenu('GRADE_RANGE_CONFIG');
                      setActiveSubmenuKey('G3_GRADE_RANGE_CONFIG');
                      setBreadcrumbGroupKh('៣. គ្រប់គ្រងមុខវិជ្ជា');
                      setBreadcrumbItemKh('កំណត់ពិន្ទុនិទ្ទេសសម្រាប់មុខវិជ្ជានីមួយៗ');
                      handleNavigateSidebar('SUBJECT_MANAGEMENT');
                    }}
                  />
                )}

                {/* 4. QUESTION BANK */}
                {activeNav === 'SUBJECTS_QUESTIONS' && (
                  <SecuritySimulatorView
                    db={db}
                    setDb={setDb}
                    activeUserId={activeUserId}
                    onSelectUser={setActiveUserId}
                    onExecuteQuestionAction={handleExecuteQuestionAction}
                  />
                )}

                {/* 5. ONLINE EXAMS */}
                {activeNav === 'ONLINE_EXAMS' && (
                  <OnlineExamsPortalView
                    key={`${onlineExamInitialTab}-${onlineExamSelectorOpen}-${activeSubmenuKey}`}
                    db={db}
                    setDb={setDb}
                    activeUserId={activeUserId}
                    externalSearchQuery={globalSearchQuery}
                    initialTab={onlineExamInitialTab}
                    initialOpenExamSelector={onlineExamSelectorOpen}
                    onCreateExam={handleCreateExam}
                    onSubmitExamAttempt={handleSubmitExamAttempt}
                    onGradeManualAnswers={handleGradeManualAnswers}
                  />
                )}

                {/* 6. SCORES & RANKING */}
                {activeNav === 'SCORES_RANKING' && (
                  <OfficialReportsView
                    key={`SCORES_RANKING-${activeSubmenuKey}`}
                    db={db}
                    setDb={setDb}
                    activeUserId={activeUserId}
                    defaultTemplate="SCORE_ENTRY_GRID"
                    onUpdateStudentScore={handleUpdateStudentScore}
                  />
                )}

                {/* 7. HONOR ROLL */}
                {activeNav === 'HONOR_ROLL' && (
                  <div className="space-y-6">
                    <OfficialReportsView
                      key={`HONOR_ROLL-${activeSubmenuKey}`}
                      db={db}
                      setDb={setDb}
                      activeUserId={activeUserId}
                      defaultTemplate="MONTHLY_HONOR_ROLL"
                      onUpdateStudentScore={handleUpdateStudentScore}
                    />
                  </div>
                )}

                {/* 8. OFFICIAL REPORTS */}
                {activeNav === 'OFFICIAL_REPORTS' && (
                  <OfficialReportsView
                    key={`${reportTargetTemplate}-${activeSubmenuKey}`}
                    db={db}
                    setDb={setDb}
                    activeUserId={activeUserId}
                    defaultTemplate={reportTargetTemplate}
                    onUpdateStudentScore={handleUpdateStudentScore}
                  />
                )}

                {/* 8B. GROUP 7: REPORT CENTER (All 5 Report Categories & 26 Sub-Reports) */}
                {activeNav === 'REPORT_CENTER' && (
                  <ReportCenterView
                    db={db}
                    setDb={setDb}
                    activeUserId={activeUserId}
                    activeCategory={activeReportCategory}
                    activeSubReport={activeReportSubItem}
                    onSelectCategoryAndSubReport={(cat, sub) => {
                      setActiveReportCategory(cat);
                      setActiveReportSubItem(sub);
                      setActiveSubmenuKey(`G7_${cat}`);
                      const foundCat = REPORT_CATEGORIES_CATALOG.find((c) => c.id === cat);
                      const foundSub = foundCat?.subReports.find((s) => s.id === sub);
                      setBreadcrumbItemKh(foundSub?.titleKh || foundCat?.titleKh || 'មជ្ឈមណ្ឌលរបាយការណ៍');
                    }}
                    onUpdateStudentScore={handleUpdateStudentScore}
                  />
                )}

                {/* 9. STUDENT PORTAL */}
                {(activeNav === 'STUDENT_PORTAL' ||
                  activeNav === 'STUDENT_TAKE_EXAM' ||
                  activeNav === 'STUDENT_VIEW_RESULTS') && (
                  <StudentPortal
                    db={db}
                    setDb={setDb}
                    activeUserId={activeUserId}
                    activeTab={studentPortalTab}
                    onTabChange={(tab) => setStudentPortalTab(tab)}
                    onSubmitExamAttempt={handleSubmitExamAttempt}
                    onStartExam={() => handleNavigateSidebar('ONLINE_EXAMS')}
                    onLogout={() => setIsSystemLogoutOpen(true)}
                  />
                )}

                {/* 10. SYSTEM SETTINGS */}
                {activeNav === 'SYSTEM_SETTINGS' && (
                  <SettingsPage
                    key={`${settingsInitialTab}-${activeSubmenuKey}`}
                    db={db}
                    setDb={setDb}
                    activeUserId={activeUserId}
                    setActiveUserId={setActiveUserId}
                    initialTab={settingsInitialTab}
                    onSaveSystemSettings={handleSaveSystemSettings}
                    onSaveGradingScales={handleSaveGradingScales}
                    onResetDatabase={() =>
                      DataService.resetToInitialSeedState(setDb)
                    }
                    onLoginAsStudent={(studentUserId) => {
                      setActiveUserId(studentUserId);
                      setIsSidebarExpanded(true);
                      handleNavigateSidebar('STUDENT_TAKE_EXAM');
                    }}
                  />
                )}
              </>
            ) : null}
          </main>

          {/* Quiet Institutional Footer */}
          <footer className="no-print bg-white/80 border-t border-slate-200/80 px-6 pt-4 pb-20 lg:pb-4 text-xs text-slate-500 mt-auto">
            <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 font-khmer-body">
              <div>
                វិទ្យាល័យទឹកជោរ (Teok Chor High School) • ការិយាល័យអប់រំ យុវជន និងកីឡា ស្រុកព្រះនេត្រព្រះ • ខេត្តបន្ទាយមានជ័យ
              </div>
            </div>
          </footer>

          {/* Mobile & Tablet Fixed Bottom Navigation Bar (<1024px) */}
          <nav
            aria-label="Mobile Bottom Navigation"
            className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#14171F] border-t border-white/10 px-2 py-1.5 flex items-center justify-around shadow-2xl"
          >
            {isCurrentUserStudent ? (
              <>
                <button
                  type="button"
                  onClick={() => handleNavigateSidebar('STUDENT_TAKE_EXAM')}
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-bold font-khmer-body transition-colors cursor-pointer ${
                    activeNav === 'ONLINE_EXAMS' || studentPortalTab === 'AVAILABLE_EXAMS'
                      ? 'text-blue-400 bg-white/10'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileCheck className="w-4 h-4" />
                  <span>ការចូលប្រឡង</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigateSidebar('STUDENT_VIEW_RESULTS')}
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-bold font-khmer-body transition-colors cursor-pointer ${
                    activeNav !== 'ONLINE_EXAMS' && studentPortalTab === 'MY_RESULTS'
                      ? 'text-blue-400 bg-white/10'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                  <span>មើលលទ្ធផលប្រឡង</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStudentPortalTab('MY_PROFILE');
                    setActiveNav('STUDENT_PORTAL');
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-bold font-khmer-body transition-colors cursor-pointer ${
                    activeNav !== 'ONLINE_EXAMS' && studentPortalTab === 'MY_PROFILE'
                      ? 'text-blue-400 bg-white/10'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>ព័ត៌មានផ្ទាល់ខ្លួន</span>
                </button>
              </>
            ) : (
              [
                { id: 'DASHBOARD' as SidebarNavId, labelKh: 'ទំព័រដើម', icon: Home },
                { id: 'STUDENTS' as SidebarNavId, labelKh: 'បញ្ជីសិស្ស', icon: Users },
                { id: 'ONLINE_EXAMS' as SidebarNavId, labelKh: 'ប្រឡង', icon: FileCheck },
                { id: 'OFFICIAL_REPORTS' as SidebarNavId, labelKh: 'របាយការណ៍', icon: Printer },
                { id: 'STUDENT_PORTAL' as SidebarNavId, labelKh: 'ផតថលសិស្ស', icon: UserCheck },
              ].map((item) => {
                const IconComp = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigateSidebar(item.id)}
                    className={`flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold font-khmer-body transition-colors cursor-pointer ${
                      isActive
                        ? 'text-blue-400 bg-white/10'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                    <span>{item.labelKh}</span>
                  </button>
                );
              })
            )}
          </nav>
        </div>
      </div>

      {/* Global Enterprise System Login Modal */}
      <SystemLoginModal
        isOpen={isSystemLoginOpen}
        isLoggedOutLock={isLoggedOutLock}
        onClose={() => {
          if (!isLoggedOutLock) {
            setIsSystemLoginOpen(false);
          }
        }}
        onLoginSuccess={(roleName) => {
          setIsLoggedOutLock(false);
          setIsSystemLoginOpen(false);
          if (isStudentRole(roleName)) {
            setIsSidebarExpanded(true);
            handleNavigateSidebar('STUDENT_TAKE_EXAM');
          } else {
            handleNavigateSidebar('DASHBOARD');
          }
        }}
      />

      {/* Global Enterprise System Logout Confirmation Modal */}
      <SystemLogoutModal
        isOpen={isSystemLogoutOpen}
        onCancel={() => setIsSystemLogoutOpen(false)}
        onOpenSwitchAccount={() => {
          setIsSystemLogoutOpen(false);
          setIsSystemLoginOpen(true);
        }}
        onConfirmLogout={() => {
          DataService.commitState(setDb, (prev) =>
            DataService.appendAuditLog(prev, {
              UserID: activeUser.UserID,
              Action: 'AUTH_LOGOUT',
              Module: 'Authentication.gs',
              RecordID: activeUser.UserID,
              OldValueJSON: JSON.stringify({
                userId: activeUser.UserID,
                role: activeRole?.RoleName,
              }),
              NewValueJSON: '{}',
              IPOrSessionReference: `SES-${activeUser.UserID}-2026`,
              Description: `User ${activeUser.FullNameKh} (${activeUser.Username}) logged out via System Logout Dialog`,
            })
          );
          setIsSystemLogoutOpen(false);
          setIsLoggedOutLock(true);
          setIsSystemLoginOpen(true);
        }}
      />
    </AuthProvider>
  );
}
