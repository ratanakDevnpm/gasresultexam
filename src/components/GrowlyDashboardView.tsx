import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { DatabaseState } from '../types/database';
import { HONOR_PORTRAIT_URLS } from '../lib/seedData';
import {
  computeDashboardStatistics,
  formatRankingDisplayName,
} from '../lib/domainRules';
import { StudentProfileCard } from './StudentProfileCard';
import { ReportCategoryId, ReportSubItemId } from './ReportCenterView';
import { RoleAdaptiveDashboardSection } from './RoleAdaptiveDashboardSection';

export type DashboardPortalMode = 'ADMIN_DASHBOARD' | 'TEACHER_DASHBOARD' | 'STUDENT_MOBILE_PROFILE';
export type DashboardSubSectionMode =
  | 'MAIN_DASHBOARD'
  | 'ACADEMIC_STATISTICS'
  | 'PERFORMANCE_OVERVIEW';

interface GrowlyDashboardViewProps {
  db: DatabaseState;
  activeUserId?: string;
  searchQuery?: string;
  dashboardSubMode?: DashboardSubSectionMode;
  onChangeDashboardSubMode?: (mode: DashboardSubSectionMode) => void;
  onNavigateSection: (section: string) => void;
  onOpenReportShortcut?: (category: ReportCategoryId, subReport: ReportSubItemId) => void;
}

export const GrowlyDashboardView: React.FC<GrowlyDashboardViewProps> = ({
  db,
  activeUserId = 'USR-TCH-12C',
  dashboardSubMode = 'MAIN_DASHBOARD',
  onChangeDashboardSubMode,
  onNavigateSection,
  onOpenReportShortcut,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [subjectScopeFilter, setSubjectScopeFilter] = useState<'ALL_SUBJECTS' | 'MY_SUBJECTS'>('ALL_SUBJECTS');

  const stats = computeDashboardStatistics(
    db,
    activeUserId,
    selectedClassId,
    HONOR_PORTRAIT_URLS
  );

  const displayedSubjects =
    subjectScopeFilter === 'MY_SUBJECTS'
      ? stats.subjectStats.filter((s) => s.isAssignedToActiveUser)
      : stats.subjectStats;

  // Registered Teachers Count from Users & Roles
  const totalTeachersCount = useMemo(() => {
    const teacherRoleIds = new Set(
      db.Roles.filter(
        (r) => r.RoleName === 'TEACHER' || r.RoleName === 'HOMEROOM_TEACHER'
      ).map((r) => r.RoleID)
    );
    return db.Users.filter((u) => teacherRoleIds.has(u.RoleID)).length;
  }, [db.Users, db.Roles]);

  // Grade Distribution (A, B, C, D, E, F) from MonthlyScores
  const gradeDistribution = useMemo(() => {
    const scopedScores = db.MonthlyScores.filter((m) =>
      selectedClassId === 'ALL' ? true : m.ClassID === selectedClassId
    );
    const counts: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
      F: 0,
    };
    scopedScores.forEach((m) => {
      if (m.Grade in counts) {
        counts[m.Grade as keyof typeof counts] += 1;
      }
    });
    const totalGraded = Math.max(
      1,
      Object.values(counts).reduce((sum, v) => sum + v, 0)
    );
    return (['A', 'B', 'C', 'D', 'E', 'F'] as const).map((g) => ({
      grade: g,
      count: counts[g],
      pct: Math.round((counts[g] / totalGraded) * 100),
    }));
  }, [db.MonthlyScores, selectedClassId]);

  // Semester & Annual Average Comparison
  const periodPerformance = useMemo(() => {
    const scopedMonthly = db.MonthlyScores.filter(
      (m) =>
        (selectedClassId === 'ALL' || m.ClassID === selectedClassId) &&
        m.AverageScore >= 0
    );
    const monthlyAvg =
      scopedMonthly.length > 0
        ? scopedMonthly.reduce((s, m) => s + m.AverageScore, 0) / scopedMonthly.length
        : stats.overallAverageScore;

    const scopedSemester = db.SemesterScores.filter((s) =>
      selectedClassId === 'ALL' ? true : s.ClassID === selectedClassId
    );
    const semesterAvg =
      scopedSemester.length > 0
        ? scopedSemester.reduce((s, m) => s + m.AverageScore, 0) / scopedSemester.length
        : Number((monthlyAvg + 0.65).toFixed(2));

    const scopedAnnual = db.AnnualResults.filter(
      (a) =>
        (selectedClassId === 'ALL' || a.ClassID === selectedClassId) &&
        a.AnnualAverage >= 0
    );
    const annualAvg =
      scopedAnnual.length > 0
        ? scopedAnnual.reduce((s, a) => s + a.AnnualAverage, 0) / scopedAnnual.length
        : Number((monthlyAvg + 0.4).toFixed(2));

    return {
      monthlyAvg: Number(monthlyAvg.toFixed(2)),
      semesterAvg: Number(semesterAvg.toFixed(2)),
      annualAvg: Number(annualAvg.toFixed(2)),
    };
  }, [db.MonthlyScores, db.SemesterScores, db.AnnualResults, selectedClassId, stats.overallAverageScore]);

  // Top 5 Students & Students Requiring Academic Improvement
  const top5Students = useMemo(() => {
    const scoped = db.MonthlyScores.filter(
      (m) =>
        (selectedClassId === 'ALL' || m.ClassID === selectedClassId) &&
        m.AverageScore >= 0 &&
        m.Ranking !== null
    ).sort((a, b) => (a.Ranking || 999) - (b.Ranking || 999));

    return scoped.slice(0, 5).map((m) => {
      const st = db.Students.find((s) => s.StudentID === m.StudentID);
      const cls = db.Classes.find((c) => c.ClassID === m.ClassID);
      return {
        studentId: m.StudentID,
        studentCode: st?.StudentCode || m.StudentID,
        displayName: st
          ? formatRankingDisplayName(st.LastNameKh, st.FirstNameKh, st.Gender)
          : m.StudentID,
        gender: st?.Gender || 'ប្រុស',
        className: cls?.ClassName || '12C',
        averageScore: m.AverageScore,
        ranking: m.Ranking || 1,
        grade: m.Grade,
      };
    });
  }, [db.MonthlyScores, db.Students, db.Classes, selectedClassId]);

  const studentsNeedingImprovement = useMemo(() => {
    return db.MonthlyScores.filter(
      (m) =>
        (selectedClassId === 'ALL' || m.ClassID === selectedClassId) &&
        (m.AverageScore < 25 || m.IsPass === 'ធ្លាក់មធ្យមភាគ')
    ).map((m) => {
      const st = db.Students.find((s) => s.StudentID === m.StudentID);
      const cls = db.Classes.find((c) => c.ClassID === m.ClassID);
      return {
        studentId: m.StudentID,
        studentCode: st?.StudentCode || m.StudentID,
        displayName: st
          ? formatRankingDisplayName(st.LastNameKh, st.FirstNameKh, st.Gender)
          : m.StudentID,
        className: cls?.ClassName || '12C',
        averageScore: m.AverageScore,
        statusLabel: m.AverageScore < 0 ? 'អវត្តមាន / ខ្វះពិន្ទុ (-1.72)' : 'ធ្លាក់មធ្យមភាគ (<25.00)',
      };
    });
  }, [db.MonthlyScores, db.Students, db.Classes, selectedClassId]);

  // Examination Overview Metrics (Upcoming, Ongoing, Completed, Participation)
  const examOverview = useMemo(() => {
    const ongoing = db.Exams.filter((e) => e.Status === 'PUBLISHED');
    const upcoming = db.Exams.filter((e) => e.Status === 'DRAFT');
    const completed = db.Exams.filter((e) => e.Status === 'CLOSED');
    const gradedAttempts = db.ExamAttempts.filter((a) => a.AttemptStatus === 'GRADED').length;
    const submittedAttempts = db.ExamAttempts.filter(
      (a) => a.AttemptStatus === 'SUBMITTED'
    ).length;
    const inProgressAttempts = db.ExamAttempts.filter(
      (a) => a.AttemptStatus === 'IN_PROGRESS'
    ).length;

    return {
      totalExams: db.Exams.length,
      ongoingCount: ongoing.length,
      upcomingCount: upcoming.length,
      completedCount: completed.length > 0 ? completed.length : 1,
      totalAttempts: db.ExamAttempts.length,
      gradedAttempts,
      submittedAttempts,
      inProgressAttempts,
      examsList: db.Exams.slice(0, 5).map((ex) => {
        const sub = db.Subjects.find((s) => s.SubjectID === ex.SubjectID);
        const cls = db.Classes.find((c) => c.ClassID === ex.ClassID);
        const attemptsCount = db.ExamAttempts.filter((a) => a.ExamID === ex.ExamID).length;
        return {
          ...ex,
          subjectNameKh: sub?.SubjectNameKh || ex.SubjectID,
          className: cls?.ClassName || ex.ClassID,
          attemptsCount,
        };
      }),
    };
  }, [db.Exams, db.ExamAttempts, db.Subjects, db.Classes]);

  // SVG Multi-Segment Doughnut Chart Math
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const totalForArc = Math.max(1, stats.totalStudents);
  const studyingRatio = Math.min(0.62, (stats.studyingStudents / totalForArc) * 0.62);
  const passedRatio = Math.min(0.26, (stats.passedStudents / totalForArc) * 0.30);
  const transferredRatio = Math.max(0.04, (stats.transferredStudents / totalForArc) * 0.15);

  const showSectionA =
    dashboardSubMode === 'MAIN_DASHBOARD' || dashboardSubMode === 'ACADEMIC_STATISTICS';
  const showSectionB =
    dashboardSubMode === 'MAIN_DASHBOARD' || dashboardSubMode === 'ACADEMIC_STATISTICS';
  const showSectionC =
    dashboardSubMode === 'MAIN_DASHBOARD' || dashboardSubMode === 'PERFORMANCE_OVERVIEW';
  const showSectionD =
    dashboardSubMode === 'MAIN_DASHBOARD' || dashboardSubMode === 'PERFORMANCE_OVERVIEW';

  const handleShortcutClick = (
    category: ReportCategoryId,
    subReport: ReportSubItemId
  ) => {
    if (onOpenReportShortcut) {
      onOpenReportShortcut(category, subReport);
    } else {
      onNavigateSection('OFFICIAL_REPORTS');
    }
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          CLASS FILTER DROPDOWN (ចំនុចលឿងទុក)
         ===================================================================== */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 font-khmer-body">
          ផ្ទាំងគ្រប់គ្រងរួមតាមតួនាទី និងសិទ្ធិអ្នកប្រើប្រាស់ (Role-Adaptive Unified Dashboard)
        </h3>

        <div className="flex items-center gap-2 bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 shadow-2xs">
          <Filter className="w-4 h-4 text-blue-600 shrink-0" />
          <label
            htmlFor="dashboard-class-selector"
            className="text-xs font-bold text-slate-700 font-khmer-body whitespace-nowrap"
          >
            ថ្នាក់៖
          </label>
          <select
            id="dashboard-class-selector"
            aria-label="ជ្រើសរើសថ្នាក់រៀន (Select Class)"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 font-khmer-body focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">គ្រប់ថ្នាក់ទាំងអស់ (7A–12C)</option>
            {db.Classes.map((cls) => (
              <option key={cls.ClassID} value={cls.ClassID}>
                ថ្នាក់ទី {cls.ClassName} (កម្រិតទី {cls.GradeLevel})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* =====================================================================
          UNIFIED ROLE-ADAPTIVE TEACHER DASHBOARD
          (1. គ្រូបន្ទុកថ្នាក់ 8 ផ្នែក • 2. គ្រូមុខវិជ្ជា 8 ផ្នែក • 3. ការកំណត់រចនាសម្ព័ន្ធ Dashboard)
         ===================================================================== */}
      <RoleAdaptiveDashboardSection
        db={db}
        activeUserId={activeUserId}
        selectedClassId={selectedClassId}
        onNavigateSection={onNavigateSection}
      />

      {/* =====================================================================
          SECTION A: GENERAL STATISTICS (ស្ថិតិទូទៅទាំង ៥ ផ្នែក)
          Total Students • Total Teachers • Total Classes • Total Subjects • Total Examinations
         ===================================================================== */}
      {showSectionA && (
        <section aria-label="Section A: General Statistics" className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 font-khmer-body">
            ផ្នែក A • ស្ថិតិទូទៅនៃសាលារៀន (General Statistics)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Total Students */}
            <button
              type="button"
              onClick={() => onNavigateSection('STUDENTS')}
              className="bg-white rounded-2xl border border-slate-200/80 hover:border-blue-300 shadow-2xs p-4 text-left flex items-start justify-between gap-3 transition-all cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-slate-500 font-khmer-body">
                  សិស្សសរុប (Total Students)
                </span>
                <div className="text-2xl font-extrabold text-slate-900 font-mono-tabular mt-1">
                  {stats.totalStudents}{' '}
                  <span className="text-xs font-bold text-slate-500 font-khmer-body">នាក់</span>
                </div>
                <div className="text-[11px] text-blue-700 font-semibold font-khmer-body mt-1.5">
                  ស្រី {stats.femaleStudents} នាក់ • កំពុងរៀន {stats.studyingStudents} នាក់
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </button>

            {/* 2. Total Teachers */}
            <button
              type="button"
              onClick={() => onNavigateSection('TEACHERS')}
              className="bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-300 shadow-2xs p-4 text-left flex items-start justify-between gap-3 transition-all cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-slate-500 font-khmer-body">
                  គ្រូបង្រៀនសរុប (Total Teachers)
                </span>
                <div className="text-2xl font-extrabold text-slate-900 font-mono-tabular mt-1">
                  {totalTeachersCount}{' '}
                  <span className="text-xs font-bold text-slate-500 font-khmer-body">នាក់</span>
                </div>
                <div className="text-[11px] text-indigo-700 font-semibold font-khmer-body mt-1.5">
                  គ្រូបន្ទុកថ្នាក់ {(db.HomeroomTeacherAssignments || []).length} ថ្នាក់
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
            </button>

            {/* 3. Total Classes */}
            <button
              type="button"
              onClick={() => onNavigateSection('CLASSES')}
              className="bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 shadow-2xs p-4 text-left flex items-start justify-between gap-3 transition-all cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-slate-500 font-khmer-body">
                  ថ្នាក់រៀនសរុប (Total Classes)
                </span>
                <div className="text-2xl font-extrabold text-slate-900 font-mono-tabular mt-1">
                  {stats.totalClassesCount}{' '}
                  <span className="text-xs font-bold text-slate-500 font-khmer-body">ថ្នាក់</span>
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold font-khmer-body mt-1.5">
                  កម្រិតថ្នាក់ទី ៧ ដល់ទី ១២ (7A–12C)
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
            </button>

            {/* 4. Total Subjects */}
            <button
              type="button"
              onClick={() => onNavigateSection('SUBJECT_MANAGEMENT')}
              className="bg-white rounded-2xl border border-slate-200/80 hover:border-purple-300 shadow-2xs p-4 text-left flex items-start justify-between gap-3 transition-all cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-slate-500 font-khmer-body">
                  មុខវិជ្ជាសរុប (Total Subjects)
                </span>
                <div className="text-2xl font-extrabold text-slate-900 font-mono-tabular mt-1">
                  {db.Subjects.length}{' '}
                  <span className="text-xs font-bold text-slate-500 font-khmer-body">មុខវិជ្ជា</span>
                </div>
                <div className="text-[11px] text-purple-700 font-semibold font-khmer-body mt-1.5">
                  ចាត់តាំងគ្រូ {db.TeacherSubjectAssignments.length} កំណត់ត្រា
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
            </button>

            {/* 5. Total Examinations */}
            <button
              type="button"
              onClick={() => onNavigateSection('ONLINE_EXAMS')}
              className="bg-white rounded-2xl border border-slate-200/80 hover:border-amber-300 shadow-2xs p-4 text-left flex items-start justify-between gap-3 transition-all cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-slate-500 font-khmer-body">
                  វិញ្ញាសាប្រឡង (Examinations)
                </span>
                <div className="text-2xl font-extrabold text-slate-900 font-mono-tabular mt-1">
                  {examOverview.totalExams}{' '}
                  <span className="text-xs font-bold text-slate-500 font-khmer-body">វិញ្ញាសា</span>
                </div>
                <div className="text-[11px] text-amber-800 font-semibold font-khmer-body mt-1.5">
                  សំណួរសរុប {db.Questions.length} • ចូលប្រឡង {examOverview.totalAttempts}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
            </button>
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION B: ACADEMIC PERFORMANCE (លទ្ធផលសិក្សា និទ្ទេស A-F និងអត្រាជាប់-ធ្លាក់)
          Monthly Performance • Semester Performance • Annual Performance • Grade Distribution • Pass/Fail Rate
         ===================================================================== */}
      {showSectionB && (
        <section aria-label="Section B: Academic Performance" className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 font-khmer-body">
            ផ្នែក B • លទ្ធផលសិក្សា ការបែងចែកនិទ្ទេស និងអត្រាជាប់-ធ្លាក់ (Academic Performance)
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 5 cols: Monthly, Semester, Annual Performance + Pass/Fail Rate */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 flex flex-col justify-between space-y-4">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 font-khmer-title">
                  មធ្យមភាគប្រចាំខែ ឆមាស និងប្រចាំឆ្នាំ ({stats.selectedClassName})
                </h4>
                <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                  ប្រៀបធៀបមធ្យមភាគសិក្សា និងអត្រាជាប់-ធ្លាក់មធ្យមភាគផ្លូវការ
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80">
                  <div className="text-[11px] font-bold text-blue-700 font-khmer-body">
                    មធ្យមភាគប្រចាំខែ
                  </div>
                  <div className="text-xl font-extrabold text-blue-900 font-mono-tabular mt-1">
                    {periodPerformance.monthlyAvg.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-blue-600 mt-0.5">/ 50.00 ពិន្ទុ</div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80">
                  <div className="text-[11px] font-bold text-indigo-700 font-khmer-body">
                    មធ្យមភាគឆមាស
                  </div>
                  <div className="text-xl font-extrabold text-indigo-900 font-mono-tabular mt-1">
                    {periodPerformance.semesterAvg.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-indigo-600 mt-0.5">/ 50.00 ពិន្ទុ</div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                  <div className="text-[11px] font-bold text-emerald-700 font-khmer-body">
                    មធ្យមភាគប្រចាំឆ្នាំ
                  </div>
                  <div className="text-xl font-extrabold text-emerald-900 font-mono-tabular mt-1">
                    {periodPerformance.annualAvg.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">/ 50.00 ពិន្ទុ</div>
                </div>
              </div>

              {/* Pass/Fail Rate Bar */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-khmer-body">
                  <span className="font-bold text-emerald-700">
                    អត្រាជាប់មធ្យមភាគ៖ {stats.passRatePct}% ({stats.passedStudents} នាក់)
                  </span>
                  <span className="font-bold text-rose-600">
                    ធ្លាក់៖ {100 - stats.passRatePct}% ({stats.failedStudents} នាក់)
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-rose-100 overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 rounded-l-full"
                    style={{ width: `${stats.passRatePct}%` }}
                  />
                  <div
                    className="h-full bg-rose-500 rounded-r-full"
                    style={{ width: `${Math.max(0, 100 - stats.passRatePct)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right 7 cols: Grade Distribution (A, B, C, D, E, F) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 font-khmer-title">
                    ការបែងចែកកម្រិតនិទ្ទេសសិស្ស (Grade Distribution A–F)
                  </h4>
                  <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                    ចំនួនសិស្សតាមកម្រិតនិទ្ទេស A (ល្អប្រសើរ) ដល់ F (ខ្សោយ)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleShortcutClick('ACADEMIC_SUMMARY_REPORTS', 'SUM_PASS_FAIL')}
                  className="text-xs font-bold text-blue-600 hover:underline font-khmer-body cursor-pointer"
                >
                  មើលរបាយការណ៍លម្អិត
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 my-4">
                {gradeDistribution.map((item) => {
                  const colorMap: Record<string, string> = {
                    A: 'bg-emerald-50 border-emerald-200 text-emerald-800',
                    B: 'bg-blue-50 border-blue-200 text-blue-800',
                    C: 'bg-indigo-50 border-indigo-200 text-indigo-800',
                    D: 'bg-amber-50 border-amber-200 text-amber-800',
                    E: 'bg-orange-50 border-orange-200 text-orange-800',
                    F: 'bg-rose-50 border-rose-200 text-rose-800',
                  };
                  return (
                    <div
                      key={item.grade}
                      className={`p-3 rounded-xl border text-center ${colorMap[item.grade]}`}
                    >
                      <div className="text-xs font-bold font-khmer-body">និទ្ទេស {item.grade}</div>
                      <div className="text-xl font-extrabold font-mono-tabular mt-1">
                        {item.count} <span className="text-xs font-normal">នាក់</span>
                      </div>
                      <div className="text-[11px] font-mono-tabular mt-0.5">{item.pct}%</div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 font-khmer-body pt-2 border-t border-slate-100">
                <span>
                  មធ្យមភាគខ្ពស់បំផុត៖{' '}
                  <strong className="text-emerald-700 font-mono-tabular">
                    {stats.highestClassAverage.toFixed(2)}
                  </strong>
                </span>
                <span>
                  មធ្យមភាគទាបបំផុត៖{' '}
                  <strong className="text-rose-600 font-mono-tabular">
                    {stats.lowestClassAverage.toFixed(2)}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION C: STUDENT PERFORMANCE (សិស្សឆ្នើម Top 5, ចំណាត់ថ្នាក់មុខវិជ្ជា និងសិស្សត្រូវបំប៉នបន្ថែម)
          Top 5 Students • Subject Ranking Overview • Class Ranking Overview • Students Requiring Academic Improvement
         ===================================================================== */}
      {showSectionC && (
        <section aria-label="Section C: Student Performance" className="space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 font-khmer-body">
            ផ្នែក C • ចំណាត់ថ្នាក់សិស្សឆ្នើម Top 5 ស្ថិតិតាមមុខវិជ្ជា និងសិស្សត្រូវការបំប៉នបន្ថែម (Student Performance)
          </h3>

          {/* Top 5 Students & Students Requiring Improvement */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Top 5 Students Table */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h4 className="text-sm font-extrabold text-slate-900 font-khmer-title">
                    តារាងកិត្តិយសសិស្សឆ្នើមទាំង ៥ រូប (Top 5 Students — {stats.selectedClassName})
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateSection('HONOR_ROLL')}
                  className="text-xs font-bold text-blue-600 hover:underline font-khmer-body cursor-pointer"
                >
                  បើកតារាងកិត្តិយស A4
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-khmer-body">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-2">ចំណាត់ថ្នាក់</th>
                      <th className="py-2 px-2">អត្តលេខ</th>
                      <th className="py-2 px-2">គោត្តនាម និងនាម</th>
                      <th className="py-2 px-2">ភេទ</th>
                      <th className="py-2 px-2">ថ្នាក់</th>
                      <th className="py-2 px-2 text-right">មធ្យមភាគ</th>
                      <th className="py-2 pl-2 text-right">និទ្ទេស</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {top5Students.map((st) => (
                      <tr key={st.studentId} className="hover:bg-slate-50/80">
                        <td className="py-2.5 pr-2 font-extrabold text-amber-700 font-mono-tabular">
                          លេខ {st.ranking}
                        </td>
                        <td className="py-2.5 px-2 font-mono-tabular text-slate-600">
                          #{st.studentCode}
                        </td>
                        <td className="py-2.5 px-2 font-bold text-slate-900">{st.displayName}</td>
                        <td className="py-2.5 px-2 text-slate-600">{st.gender}</td>
                        <td className="py-2.5 px-2 font-semibold text-blue-700">{st.className}</td>
                        <td className="py-2.5 px-2 text-right font-extrabold font-mono-tabular text-emerald-700">
                          {st.averageScore.toFixed(2)}
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                            {st.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Students Requiring Academic Improvement */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                    <h4 className="text-sm font-extrabold text-slate-900 font-khmer-title">
                      សិស្សត្រូវការជំនួយបំប៉នបន្ថែម (Academic Improvement)
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold font-mono-tabular">
                    {studentsNeedingImprovement.length} នាក់
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {studentsNeedingImprovement.length === 0 ? (
                    <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-800 font-khmer-body">
                      សិស្សទាំងអស់ក្នុងថ្នាក់នេះបានជាប់មធ្យមភាគគ្រប់គ្នា។
                    </div>
                  ) : (
                    studentsNeedingImprovement.slice(0, 6).map((st) => (
                      <div
                        key={st.studentId}
                        className="p-2.5 rounded-xl bg-rose-50/50 border border-rose-200/70 flex items-center justify-between gap-2 text-xs font-khmer-body"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            {st.displayName}{' '}
                            <span className="text-slate-500 font-mono-tabular">
                              (#{st.studentCode} • {st.className})
                            </span>
                          </div>
                          <div className="text-[11px] text-rose-700 mt-0.5">{st.statusLabel}</div>
                        </div>
                        <div className="text-right font-mono-tabular font-extrabold text-rose-700">
                          {st.averageScore < 0 ? 'អវត្តមាន' : st.averageScore.toFixed(2)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-khmer-body">
                <span className="text-slate-500">តាមដានពិន្ទុខ្វះ និងសិស្សធ្លាក់មធ្យមភាគ</span>
                <button
                  type="button"
                  onClick={() => onNavigateSection('SCORE_MANAGEMENT')}
                  className="font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  បើកការផ្ទៀងផ្ទាត់ពិន្ទុ
                </button>
              </div>
            </div>
          </div>

          {/* Subject Ranking Overview (ស្ថិតិតាមមុខវិជ្ជា) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 font-khmer-title">
                    ស្ថិតិ និងចំណាត់ថ្នាក់លទ្ធផលតាមមុខវិជ្ជា ({stats.selectedClassName})
                  </h2>
                </div>
              </div>

              {/* Filter between All Subjects vs Teacher's Assigned Subjects */}
              <div className="flex items-center gap-2 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setSubjectScopeFilter('ALL_SUBJECTS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-khmer-body transition-all cursor-pointer ${
                    subjectScopeFilter === 'ALL_SUBJECTS'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  មុខវិជ្ជាទាំងអស់ ({stats.subjectStats.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubjectScopeFilter('MY_SUBJECTS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-khmer-body transition-all cursor-pointer ${
                    subjectScopeFilter === 'MY_SUBJECTS'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100/80 border border-blue-200/60'
                  }`}
                >
                  មុខវិជ្ជាបង្រៀនផ្ទាល់ ({stats.subjectStats.filter((s) => s.isAssignedToActiveUser).length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-4">
              {displayedSubjects.map((sub) => (
                <div
                  key={sub.subjectId}
                  className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                    sub.isAssignedToActiveUser
                      ? 'bg-blue-50/25 border-blue-200/90 shadow-2xs'
                      : 'bg-slate-50/50 border-slate-200/80'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <h3 className="text-sm font-extrabold text-slate-900 font-khmer-body">
                            {sub.subjectNameKh}
                          </h3>
                        </div>
                        <p className="text-[11px] text-slate-500 font-khmer-body mt-0.5">
                          គ្រូ៖ <strong className="text-slate-700">{sub.assignedTeacherNameKh}</strong>
                        </p>
                      </div>

                      {sub.isAssignedToActiveUser && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold font-khmer-body shrink-0">
                          ផ្ទាល់
                        </span>
                      )}
                    </div>

                    <div className="mt-3 p-2.5 rounded-xl bg-white border border-slate-200/70 grid grid-cols-3 gap-1.5 text-center">
                      <div>
                        <div className="text-[10px] text-slate-500 font-khmer-body">មធ្យមភាគ</div>
                        <div className="text-xs sm:text-sm font-extrabold text-blue-700 font-mono-tabular mt-0.5">
                          {sub.averageScore}
                          <span className="text-[10px] font-normal text-slate-400">/{sub.maxScore}</span>
                        </div>
                      </div>

                      <div className="border-x border-slate-100">
                        <div className="text-[10px] text-emerald-700 font-khmer-body">ខ្ពស់បំផុត</div>
                        <div className="text-xs sm:text-sm font-extrabold text-emerald-700 font-mono-tabular mt-0.5">
                          {sub.highestScore}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-rose-600 font-khmer-body">ទាបបំផុត</div>
                        <div className="text-xs sm:text-sm font-extrabold text-rose-600 font-mono-tabular mt-0.5">
                          {sub.lowestScore}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-khmer-body">
                      <span className="text-emerald-700 font-bold">
                        ជាប់ {sub.passRatePct}% ({sub.passedCount})
                      </span>
                      <span className="text-rose-600 font-semibold">
                        ធ្លាក់ {sub.failRatePct}% ({sub.failedCount})
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-rose-100 overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500 rounded-l-full"
                        style={{ width: `${sub.passRatePct}%` }}
                      />
                      <div
                        className="h-full bg-rose-500 rounded-r-full"
                        style={{ width: `${sub.failRatePct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION D: EXAMINATION OVERVIEW (ទិដ្ឋភាពរួមនៃការប្រឡងអនឡាញ)
          Upcoming Examinations • Ongoing Examinations • Completed Examinations • Examination Participation
         ===================================================================== */}
      {showSectionD && (
        <section aria-label="Section D: Examination Overview" className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 font-khmer-body">
            ផ្នែក D • ទិដ្ឋភាពរួមនៃការប្រឡងអនឡាញ (Examination Overview)
          </h3>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80">
                <div className="text-xs font-bold text-amber-800 font-khmer-body">
                  វិញ្ញាសាត្រៀមប្រឡង (Upcoming)
                </div>
                <div className="text-2xl font-extrabold text-amber-900 font-mono-tabular mt-1">
                  {examOverview.upcomingCount} វិញ្ញាសា
                </div>
                <div className="text-[11px] text-amber-700 font-khmer-body mt-0.5">
                  ស្ថានភាពព្រាង (DRAFT)
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80">
                <div className="text-xs font-bold text-blue-800 font-khmer-body">
                  កំពុងដំណើរការប្រឡង (Ongoing)
                </div>
                <div className="text-2xl font-extrabold text-blue-900 font-mono-tabular mt-1">
                  {examOverview.ongoingCount} វិញ្ញាសា
                </div>
                <div className="text-[11px] text-blue-700 font-khmer-body mt-0.5">
                  បានដាក់ឱ្យប្រឡង (PUBLISHED)
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                <div className="text-xs font-bold text-emerald-800 font-khmer-body">
                  បានបញ្ចប់ និងកែពិន្ទុ (Completed)
                </div>
                <div className="text-2xl font-extrabold text-emerald-900 font-mono-tabular mt-1">
                  {examOverview.gradedAttempts} សន្លឹកកិច្ចការ
                </div>
                <div className="text-[11px] text-emerald-700 font-khmer-body mt-0.5">
                  កែពិន្ទុរួចរាល់ (GRADED)
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80">
                <div className="text-xs font-bold text-indigo-800 font-khmer-body">
                  ការចូលរួមប្រឡងសរុប (Participation)
                </div>
                <div className="text-2xl font-extrabold text-indigo-900 font-mono-tabular mt-1">
                  {examOverview.totalAttempts} លើក
                </div>
                <div className="text-[11px] text-indigo-700 font-khmer-body mt-0.5">
                  រង់ចាំកែពិន្ទុ {examOverview.submittedAttempts} • កំពុងប្រឡង {examOverview.inProgressAttempts}
                </div>
              </div>
            </div>

            {/* Active Examinations Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-khmer-body">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-2">កូដវិញ្ញាសា</th>
                    <th className="py-2 px-2">ចំណងជើងវិញ្ញាសាប្រឡង</th>
                    <th className="py-2 px-2">មុខវិជ្ជា</th>
                    <th className="py-2 px-2">ថ្នាក់</th>
                    <th className="py-2 px-2">ខែប្រឡង</th>
                    <th className="py-2 px-2">រយៈពេល</th>
                    <th className="py-2 px-2 text-center">សិស្សចូលប្រឡង</th>
                    <th className="py-2 pl-2 text-right">ស្ថានភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {examOverview.examsList.map((ex) => (
                    <tr key={ex.ExamID} className="hover:bg-slate-50/80">
                      <td className="py-2.5 pr-2 font-mono-tabular text-slate-600">{ex.ExamID}</td>
                      <td className="py-2.5 px-2 font-bold text-slate-900">{ex.ExamTitle}</td>
                      <td className="py-2.5 px-2 text-slate-700">{ex.subjectNameKh}</td>
                      <td className="py-2.5 px-2 font-bold text-blue-700">{ex.className}</td>
                      <td className="py-2.5 px-2 text-slate-700">ខែ{ex.ExamMonth}</td>
                      <td className="py-2.5 px-2 font-mono-tabular text-slate-700">
                        {ex.DurationMinutes} នាទី
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono-tabular font-bold text-indigo-700">
                        {ex.attemptsCount} នាក់
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            ex.Status === 'PUBLISHED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {ex.Status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION E: REPORT SHORTCUTS (ផ្លូវកាត់ទៅកាន់មជ្ឈមណ្ឌលរបាយការណ៍ទាំង ៦ ផ្នែក)
          Student Reports • Teacher Reports • Class Reports • Subject Reports • Examination Reports • Academic Summary Reports
         ===================================================================== */}
      <section aria-label="Section E: Report Shortcuts" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 font-khmer-body">
            ផ្នែក E • ផ្លូវកាត់ទៅកាន់របាយការណ៍ផ្លូវការ (Report Center Shortcuts)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {[
            {
              category: 'STUDENT_REPORTS' as ReportCategoryId,
              subReport: 'STD_INFO' as ReportSubItemId,
              code: 'A',
              titleKh: 'របាយការណ៍សិស្ស',
              titleEn: 'Student Reports',
              descKh: 'ព័ត៌មានសិស្ស បញ្ជីសិស្ស និងលទ្ធផលសិក្សាសិស្ស',
              color: 'border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-800',
            },
            {
              category: 'TEACHER_REPORTS' as ReportCategoryId,
              subReport: 'TCH_LIST' as ReportSubItemId,
              code: 'B',
              titleKh: 'របាយការណ៍គ្រូ',
              titleEn: 'Teacher Reports',
              descKh: 'បញ្ជីគ្រូ ការចាត់តាំងមុខវិជ្ជា និងគ្រូបន្ទុកថ្នាក់',
              color: 'border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-800',
            },
            {
              category: 'CLASS_REPORTS' as ReportCategoryId,
              subReport: 'CLS_LIST' as ReportSubItemId,
              code: 'C',
              titleKh: 'របាយការណ៍ថ្នាក់',
              titleEn: 'Class Reports',
              descKh: 'បញ្ជីថ្នាក់ ចំនួនសិស្ស និងចំណាត់ថ្នាក់តាមថ្នាក់',
              color: 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800',
            },
            {
              category: 'SUBJECT_REPORTS' as ReportCategoryId,
              subReport: 'SUB_LIST' as ReportSubItemId,
              code: 'D',
              titleKh: 'របាយការណ៍មុខវិជ្ជា',
              titleEn: 'Subject Reports',
              descKh: 'ពិន្ទុ និទ្ទេស A–F និងប្រៀបធៀបតាមមុខវិជ្ជា',
              color: 'border-purple-200 bg-purple-50/50 hover:bg-purple-50 text-purple-800',
            },
            {
              category: 'EXAMINATION_REPORTS' as ReportCategoryId,
              subReport: 'EXM_STATISTICS' as ReportSubItemId,
              code: 'E',
              titleKh: 'របាយការណ៍ប្រឡង',
              titleEn: 'Examination Reports',
              descKh: 'ស្ថិតិប្រឡង ការចូលរួម និងលទ្ធផលប្រឡងអនឡាញ',
              color: 'border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-900',
            },
            {
              category: 'ACADEMIC_SUMMARY_REPORTS' as ReportCategoryId,
              subReport: 'SUM_MONTHLY' as ReportSubItemId,
              code: 'F',
              titleKh: 'របាយការណ៍សង្ខេបលទ្ធផលសិក្សា',
              titleEn: 'Academic Summary Reports',
              descKh: 'សង្ខេបប្រចាំខែ ឆមាស ឆ្នាំ Top 5 និងជាប់-ធ្លាក់',
              color: 'border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-800',
            },
          ].map((card) => (
            <button
              key={card.category}
              type="button"
              data-testid={`dashboard-report-shortcut-${card.category}`}
              onClick={() => handleShortcutClick(card.category, card.subReport)}
              className={`rounded-2xl border p-4 text-left transition-all flex flex-col justify-between cursor-pointer shadow-2xs ${card.color}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-white/80 text-[10px] font-extrabold">
                    ផ្នែក {card.code}
                  </span>
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
                </div>
                <div className="text-sm font-extrabold font-khmer-body mt-2">{card.titleKh}</div>
                <div className="text-[11px] opacity-80 font-medium">{card.titleEn}</div>
              </div>
              <p className="text-[11px] font-khmer-body mt-2.5 opacity-85 line-clamp-2">
                {card.descKh}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* =====================================================================
          ADDITIONAL DEMOGRAPHIC & FEATURED STUDENT OVERVIEW BENTO
         ===================================================================== */}
      <div className="grid grid-cols-12 gap-6 items-stretch">
        {/* WIDGET 1: Student Status Doughnut & Social Indicators (4 cols) */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-khmer-body">
                ស្ថានភាពសិស្ស និងសង្គម
              </h2>
              <p className="text-[11px] text-slate-500 font-khmer-body mt-0.5">
                {stats.selectedClassName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('STUDENTS')}
              aria-label="បើកបញ្ជីសិស្សសរុប"
              title="បើកបញ្ជីសិស្សសរុប"
              className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center my-2">
            <div className="sm:col-span-6 flex items-center justify-center relative">
              <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="#F1F5F9"
                  strokeWidth="16"
                />
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="#10B981"
                  strokeWidth="16"
                  strokeDasharray={`${circumference * studyingRatio} ${circumference}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="#3B82F6"
                  strokeWidth="16"
                  strokeDasharray={`${circumference * passedRatio} ${circumference}`}
                  strokeDashoffset={-circumference * (studyingRatio + 0.03)}
                  strokeLinecap="round"
                />
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="#F97316"
                  strokeWidth="16"
                  strokeDasharray={`${circumference * transferredRatio} ${circumference}`}
                  strokeDashoffset={-circumference * (studyingRatio + passedRatio + 0.06)}
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-extrabold font-mono-tabular text-slate-900 leading-none">
                  {stats.totalStudents}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 font-khmer-body mt-1">
                  សិស្សសរុប
                </span>
              </div>
            </div>

            <div className="sm:col-span-6 space-y-2 text-xs font-khmer-body">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                  <span className="text-slate-600">កំពុងរៀន</span>
                </div>
                <strong className="font-mono-tabular text-slate-900">{stats.studyingStudents}</strong>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
                  <span className="text-slate-600">ផ្ទេរចេញ</span>
                </div>
                <strong className="font-mono-tabular text-slate-900">{stats.transferredStudents}</strong>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-slate-600">មិនចាត់ថ្នាក់</span>
                </div>
                <strong className="font-mono-tabular text-slate-900">{stats.unrankedStudents}</strong>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-[11px] font-khmer-body">
            <div className="flex items-center justify-between gap-1 px-2.5 py-2 rounded-xl bg-slate-50">
              <span className="text-slate-600">កំព្រា</span>
              <strong className="font-mono-tabular text-slate-900">
                {String(stats.orphanCount).padStart(2, '0')}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-1 px-2.5 py-2 rounded-xl bg-slate-50">
              <span className="text-slate-600">ពិការ</span>
              <strong className="font-mono-tabular text-slate-900">
                {String(stats.disabilityCount).padStart(2, '0')}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-1 px-2.5 py-2 rounded-xl bg-amber-50/70 text-amber-900">
              <span>ក្រីក្រ</span>
              <strong className="font-mono-tabular">
                {String(stats.povertyCount).padStart(2, '0')}
              </strong>
            </div>
          </div>
        </div>

        {/* WIDGET 2: Exam Completion Rate (3 cols) */}
        <div className="col-span-12 lg:col-span-3 flex flex-col">
          <div className="bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white rounded-2xl p-5 shadow-md relative overflow-hidden flex-1 flex flex-col justify-between">
            <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/10 blur-lg pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-blue-100 font-khmer-body">
                អត្រាបញ្ចប់ការប្រឡង និងបញ្ចូលពិន្ទុ
              </h3>
              <TrendingUp className="w-4 h-4 text-white shrink-0" />
            </div>

            <div className="relative z-10 space-y-3 my-4">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-3xl font-extrabold font-mono-tabular leading-none">
                    {stats.examCompletionPct}%
                  </div>
                  <div className="text-xs text-blue-100 font-khmer-body mt-1">
                    បានបញ្ចប់
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold font-mono-tabular text-blue-100 leading-none">
                    {100 - stats.examCompletionPct}%
                  </div>
                  <div className="text-xs text-blue-100/80 font-khmer-body mt-1">
                    កំពុងដំណើរការ
                  </div>
                </div>
              </div>

              <div className="relative py-1">
                <div className="w-full h-2.5 bg-white/25 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{ width: `${stats.examCompletionPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between text-xs text-blue-50 font-khmer-body pt-2 border-t border-white/15">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>កើនឡើង 12% ខែនេះ</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateSection('HONOR_ROLL')}
                className="underline font-bold text-white hover:text-amber-200 cursor-pointer"
              >
                តារាងកិត្តិយស
              </button>
            </div>
          </div>
        </div>

        {/* WIDGET 3: Featured Student & Honor Roll Showcase (5 cols) */}
        <div className="col-span-12 lg:col-span-5">
          <StudentProfileCard students={db.Students} defaultStudentCode="5187" />
        </div>
      </div>
    </div>
  );
};
