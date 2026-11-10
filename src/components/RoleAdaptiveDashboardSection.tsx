import React, { useMemo, useState } from 'react';
import { DatabaseState } from '../types/database';
import {
  HOMEROOM_DASHBOARD_SPEC_ITEMS_KH,
  SUBJECT_TEACHER_DASHBOARD_SPEC_ITEMS_KH,
  computeUnifiedRoleAdaptiveDashboardData,
} from '../lib/roleDashboardMetrics';
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  FileCheck,
  GraduationCap,
  HelpCircle,
  Layers,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';

interface RoleAdaptiveDashboardSectionProps {
  db: DatabaseState;
  activeUserId: string;
  selectedClassId?: string;
  onNavigateSection: (section: string) => void;
}

export type RoleDashboardViewFilter =
  | 'UNIFIED_SINGLE_DASHBOARD'
  | 'HOMEROOM_TEACHER_VIEW'
  | 'SUBJECT_TEACHER_VIEW'
  | 'STRUCTURE_MATRIX_VIEW';

export const RoleAdaptiveDashboardSection: React.FC<
  RoleAdaptiveDashboardSectionProps
> = ({ db, activeUserId, selectedClassId = 'ALL', onNavigateSection }) => {
  const [homeroomClassOverrideId, setHomeroomClassOverrideId] =
    useState<string>('');
  const [viewFilter, setViewFilter] = useState<RoleDashboardViewFilter>(
    'UNIFIED_SINGLE_DASHBOARD'
  );

  const effectiveClassPreference =
    homeroomClassOverrideId ||
    (selectedClassId !== 'ALL' ? selectedClassId : undefined);

  const unifiedData = useMemo(
    () =>
      computeUnifiedRoleAdaptiveDashboardData(
        db,
        activeUserId,
        effectiveClassPreference
      ),
    [db, activeUserId, effectiveClassPreference]
  );

  const { homeroomDashboard, subjectTeacherDashboard } = unifiedData;

  const showHomeroomBlock =
    (viewFilter === 'UNIFIED_SINGLE_DASHBOARD' &&
      unifiedData.isHomeroomTeacher) ||
    viewFilter === 'HOMEROOM_TEACHER_VIEW';

  const showSubjectTeacherBlock =
    (viewFilter === 'UNIFIED_SINGLE_DASHBOARD' &&
      unifiedData.isSubjectTeacher) ||
    viewFilter === 'SUBJECT_TEACHER_VIEW';

  const showStructureMatrixBlock =
    viewFilter === 'UNIFIED_SINGLE_DASHBOARD' ||
    viewFilter === 'STRUCTURE_MATRIX_VIEW';

  return (
    <section
      aria-label="Unified Role-Adaptive Teacher Dashboard"
      data-testid="unified-role-adaptive-dashboard"
      className="space-y-6"
    >
      {/* =====================================================================
          TOP UNIFIED SINGLE-DASHBOARD HEADER & ROLE FILTER BAR
         ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="bg-gradient-to-r from-[#14171F] via-[#1E293B] to-[#1E3A8A] px-5 py-4 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-300/30 text-amber-200 text-xs font-bold font-khmer-body">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>Dashboard រួមតែមួយតាមតួនាទី និងសិទ្ធិអ្នកប្រើប្រាស់</span>
                </span>
                {unifiedData.isHomeroomTeacher && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/25 border border-amber-400/40 text-amber-100 text-xs font-bold font-khmer-body">
                    <Award className="w-3.5 h-3.5 text-amber-300" />
                    <span>១. គ្រូបន្ទុកថ្នាក់ ({homeroomDashboard.classInfo.className})</span>
                  </span>
                )}
                {unifiedData.isSubjectTeacher && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/25 border border-emerald-400/40 text-emerald-100 text-xs font-bold font-khmer-body">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-300" />
                    <span>
                      ២. គ្រូមុខវិជ្ជា (
                      {subjectTeacherDashboard.taughtSubjectsAndClasses
                        .map((s) => s.subjectNameKh)
                        .join(', ')}
                      )
                    </span>
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-white font-khmer-title mt-1">
                ផ្ទាំងគ្រប់គ្រងរួមតាមសិទ្ធិ៖ គ្រូបន្ទុកថ្នាក់ និងគ្រូមុខវិជ្ជា ({unifiedData.userFullNameKh})
              </h2>
            </div>

            {/* Homeroom Class Selector when teacher has multiple homeroom classes */}
            {unifiedData.availableHomeroomClasses.length > 0 && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="unified-homeroom-class-select"
                  className="text-xs font-bold text-slate-200 font-khmer-body whitespace-nowrap"
                >
                  ថ្នាក់បន្ទុក៖
                </label>
                <select
                  id="unified-homeroom-class-select"
                  data-testid="unified-homeroom-class-select"
                  value={homeroomDashboard.classInfo.classId}
                  onChange={(e) => setHomeroomClassOverrideId(e.target.value)}
                  className="bg-white/15 border border-white/25 text-white rounded-xl px-3 py-1.5 text-xs font-bold font-khmer-body cursor-pointer focus:outline-none"
                >
                  {unifiedData.availableHomeroomClasses.map((cls) => (
                    <option
                      key={cls.classId}
                      value={cls.classId}
                      className="text-slate-900"
                    >
                      ថ្នាក់ទី {cls.className}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Recommendation Banner (អនុសាសន៍) */}
          <div
            data-testid="unified-dashboard-recommendation-banner"
            className="mt-3 p-3 rounded-xl bg-white/10 border border-white/15 text-xs sm:text-sm text-amber-100 font-bold font-khmer-body leading-relaxed"
          >
            {unifiedData.recommendationKh}
          </div>
        </div>

        {/* Role View Switcher Tabs */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              {
                id: 'UNIFIED_SINGLE_DASHBOARD' as RoleDashboardViewFilter,
                labelKh: 'Dashboard រួមតែមួយ (គ្រូបន្ទុកថ្នាក់ + គ្រូមុខវិជ្ជា)',
              },
              {
                id: 'HOMEROOM_TEACHER_VIEW' as RoleDashboardViewFilter,
                labelKh: '1. Dashboard សម្រាប់គ្រូបន្ទុកថ្នាក់ (៨ ផ្នែក)',
              },
              {
                id: 'SUBJECT_TEACHER_VIEW' as RoleDashboardViewFilter,
                labelKh: '2. Dashboard សម្រាប់គ្រូមុខវិជ្ជា (៨ ផ្នែក)',
              },
              {
                id: 'STRUCTURE_MATRIX_VIEW' as RoleDashboardViewFilter,
                labelKh: '3. ការកំណត់រចនាសម្ព័ន្ធ Dashboard',
              },
            ].map((tab) => {
              const active = viewFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`role-dashboard-tab-${tab.id}`}
                  onClick={() => setViewFilter(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold font-khmer-body transition-all cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {tab.labelKh}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          1. DASHBOARD សម្រាប់គ្រូបន្ទុកថ្នាក់ (8 REQUIRED SECTIONS)
         ===================================================================== */}
      {showHomeroomBlock && (
        <div
          data-testid="homeroom-teacher-8-sections"
          className="bg-white rounded-2xl border border-amber-200/90 shadow-2xs p-5 space-y-5"
        >
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-amber-200/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-khmer-title">
                  1. Dashboard សម្រាប់គ្រូបន្ទុកថ្នាក់ — ថ្នាក់ទី{' '}
                  {homeroomDashboard.classInfo.className}
                </h3>
                <p className="text-xs text-slate-600 font-khmer-body">
                  បង្ហាញព័ត៌មានគ្រប់គ្រងថ្នាក់បន្ទុកទាំង ៨ ផ្នែក សម្រាប់គ្រូបន្ទុកថ្នាក់
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateSection('SCORES_RANKING')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold font-khmer-body transition-colors cursor-pointer self-start sm:self-auto"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>គ្រប់គ្រងពិន្ទុថ្នាក់ទី {homeroomDashboard.classInfo.className}</span>
            </button>
          </div>

          {/* Top 3 Summary Cards: (1) ព័ត៌មានថ្នាក់, (2) ចំនួនសិស្សសរុប, (3) ស្ថិតិលទ្ធផលសិក្សា */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. ព័ត៌មានថ្នាក់ – ឆ្នាំសិក្សា កម្រិតថ្នាក់ និងបន្ទប់ */}
            <div
              data-testid="hr-sec-1-class-info"
              className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-amber-900 font-khmer-body">
                  1. ព័ត៌មានថ្នាក់ – ឆ្នាំសិក្សា កម្រិតថ្នាក់ និងបន្ទប់
                </span>
                <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
              </div>
              <div className="text-lg font-extrabold text-slate-900 font-khmer-body">
                ថ្នាក់ទី {homeroomDashboard.classInfo.className} • កម្រិតថ្នាក់ទី{' '}
                {homeroomDashboard.classInfo.gradeLevel}
              </div>
              <div className="text-xs text-slate-700 font-khmer-body space-y-1 pt-1 border-t border-amber-200/60">
                <div>
                  ឆ្នាំសិក្សា៖{' '}
                  <strong className="text-slate-900">
                    {homeroomDashboard.classInfo.academicYearName}
                  </strong>
                </div>
                <div>
                  បន្ទប់រៀន៖{' '}
                  <strong className="text-slate-900">
                    {homeroomDashboard.classInfo.roomNumber}
                  </strong>
                </div>
              </div>
            </div>

            {/* 2. ចំនួនសិស្សសរុប – ប្រុស ស្រី និងសិស្សសរុប */}
            <div
              data-testid="hr-sec-2-student-counts"
              className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-blue-900 font-khmer-body">
                  2. ចំនួនសិស្សសរុប – ប្រុស ស្រី និងសិស្សសរុប
                </span>
                <Users className="w-4 h-4 text-blue-600 shrink-0" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono-tabular">
                {homeroomDashboard.studentCounts.totalStudents}{' '}
                <span className="text-xs font-bold text-slate-600 font-khmer-body">
                  នាក់ (សិស្សសរុប)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-200/60 text-xs font-khmer-body">
                <div className="bg-white/90 px-2.5 py-1.5 rounded-lg border border-blue-100">
                  ប្រុស៖{' '}
                  <strong className="font-mono-tabular text-blue-800">
                    {homeroomDashboard.studentCounts.maleStudents}
                  </strong>{' '}
                  នាក់
                </div>
                <div className="bg-white/90 px-2.5 py-1.5 rounded-lg border border-blue-100">
                  ស្រី៖{' '}
                  <strong className="font-mono-tabular text-pink-700">
                    {homeroomDashboard.studentCounts.femaleStudents}
                  </strong>{' '}
                  នាក់
                </div>
              </div>
            </div>

            {/* 3. ស្ថិតិលទ្ធផលសិក្សា – មធ្យមភាគពិន្ទុ និងអត្រាជាប់ */}
            <div
              data-testid="hr-sec-3-academic-stats"
              className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-900 font-khmer-body">
                  3. ស្ថិតិលទ្ធផលសិក្សា – មធ្យមភាគពិន្ទុ និងអត្រាជាប់
                </span>
                <BarChart3 className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <span className="text-[11px] text-slate-500 font-khmer-body block">
                    មធ្យមភាគពិន្ទុថ្នាក់
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-800 font-mono-tabular">
                    {homeroomDashboard.academicStats.averageScore.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-500 font-mono-tabular">
                    {' '}
                    / 50
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 font-khmer-body block">
                    អត្រាជាប់មធ្យមភាគ
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-700 font-mono-tabular">
                    {homeroomDashboard.academicStats.passRatePct}%
                  </span>
                </div>
              </div>
              <div className="pt-1 border-t border-emerald-200/60 flex items-center justify-between text-xs font-khmer-body text-slate-700">
                <span>
                  ជាប់៖ <strong>{homeroomDashboard.academicStats.passedCount}</strong> នាក់
                </span>
                <span>
                  ធ្លាក់៖ <strong>{homeroomDashboard.academicStats.failedCount}</strong> នាក់
                </span>
              </div>
            </div>
          </div>

          {/* Row 2: (4) ចំណាត់ថ្នាក់សិស្ស – Top 5 សិស្សពូកែ & (5) ស្ថិតិពិន្ទុតាមមុខវិជ្ជា – បង្ហាញជាក្រាហ្វ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 4. ចំណាត់ថ្នាក់សិស្ស – Top 5 សិស្សពូកែ */}
            <div
              data-testid="hr-sec-4-top5-students"
              className="lg:col-span-5 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>4. ចំណាត់ថ្នាក់សិស្ស – Top 5 សិស្សពូកែ</span>
                </h4>
                <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md font-khmer-body">
                  ថ្នាក់ទី {homeroomDashboard.classInfo.className}
                </span>
              </div>

              <div className="space-y-2">
                {homeroomDashboard.top5Students.map((st) => (
                  <div
                    key={st.studentId}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/80 text-xs font-khmer-body"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-mono-tabular font-extrabold flex items-center justify-center shrink-0">
                        #{st.ranking}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {st.fullNameKh}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          អត្តលេខ {st.studentCode} • {st.gender}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono-tabular font-extrabold text-emerald-700">
                        {st.averageScore.toFixed(2)}
                      </div>
                      <span className="inline-block px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono-tabular font-bold">
                        និទ្ទេស {st.grade}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. ស្ថិតិពិន្ទុតាមមុខវិជ្ជា – បង្ហាញជាក្រាហ្វ */}
            <div
              data-testid="hr-sec-5-subject-score-graph"
              className="lg:col-span-7 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>5. ស្ថិតិពិន្ទុតាមមុខវិជ្ជា – បង្ហាញជាក្រាហ្វ</span>
                </h4>
                <span className="text-[11px] text-slate-500 font-khmer-body">
                  មធ្យមភាគពិន្ទុ (/50) និងអត្រាជាប់តាមមុខវិជ្ជា
                </span>
              </div>

              <div className="space-y-2.5">
                {homeroomDashboard.subjectScoreGraph.map((sub) => {
                  const widthPct = Math.min(
                    100,
                    Math.round((sub.averageScore / 50) * 100)
                  );
                  return (
                    <div
                      key={sub.subjectId}
                      className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs font-khmer-body">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {sub.subjectNameKh}
                          </span>
                          {sub.isTaughtByCurrentTeacher && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              មុខវិជ្ជាបង្រៀនផ្ទាល់
                            </span>
                          )}
                        </div>
                        <div className="font-mono-tabular text-xs">
                          មធ្យមភាគ៖{' '}
                          <strong className="text-indigo-700">
                            {sub.averageScore.toFixed(2)}/50
                          </strong>{' '}
                          • ជាប់៖{' '}
                          <strong className="text-emerald-700">
                            {sub.passRatePct}%
                          </strong>
                        </div>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            sub.isTaughtByCurrentTeacher
                              ? 'bg-emerald-500'
                              : 'bg-indigo-500'
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 3: (6) ស្ថានភាពបញ្ចូលពិន្ទុ, (7) លទ្ធផលប្រឡង, (8) សកម្មភាពថ្មីៗ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 6. ស្ថានភាពបញ្ចូលពិន្ទុ – មុខវិជ្ជាណាបញ្ចូលរួច និងមិនទាន់បញ្ចូល */}
            <div
              data-testid="hr-sec-6-score-entry-status"
              className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3"
            >
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  6. ស្ថានភាពបញ្ចូលពិន្ទុ – មុខវិជ្ជាណាបញ្ចូលរួច និងមិនទាន់បញ្ចូល
                </span>
              </h4>
              <div className="space-y-2">
                {homeroomDashboard.scoreEntryStatuses.map((item) => (
                  <div
                    key={item.subjectId}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/80 text-xs font-khmer-body"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">
                        {item.subjectNameKh}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        គ្រូ៖ {item.teacherNameKh} ({item.enteredStudentsCount}/
                        {item.totalStudentsCount} នាក់)
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                        item.isEntered
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {item.statusLabelKh}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 7. លទ្ធផលប្រឡង – សង្ខេបលទ្ធផលប្រឡងថ្មីៗ */}
            <div
              data-testid="hr-sec-7-exam-results"
              className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3"
            >
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>7. លទ្ធផលប្រឡង – សង្ខេបលទ្ធផលប្រឡងថ្មីៗ</span>
              </h4>
              <div className="space-y-2">
                {homeroomDashboard.recentExamResultsSummary.map((ex) => (
                  <div
                    key={ex.examId}
                    className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs font-khmer-body space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 truncate">
                        {ex.examTitle}
                      </span>
                      <span className="font-mono-tabular font-bold text-emerald-700 shrink-0">
                        ជាប់ {ex.passRatePct}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{ex.subjectNameKh}</span>
                      <span>
                        មធ្យមភាគ៖ {ex.averageExamScore} • បេក្ខជន {ex.participantsCount} នាក់
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 8. សកម្មភាពថ្មីៗ – ប្រវត្តិការកែប្រែពិន្ទុ និងទិន្នន័យ */}
            <div
              data-testid="hr-sec-8-recent-activities"
              className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3"
            >
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-600 shrink-0" />
                <span>8. សកម្មភាពថ្មីៗ – ប្រវត្តិការកែប្រែពិន្ទុ និងទិន្នន័យ</span>
              </h4>
              <div className="space-y-2">
                {homeroomDashboard.recentActivities.map((act) => (
                  <div
                    key={act.logId}
                    className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs font-khmer-body space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-bold text-slate-800">
                        {act.actorNameKh}
                      </span>
                      <span className="font-mono-tabular">{act.action}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      {act.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. DASHBOARD សម្រាប់គ្រូមុខវិជ្ជា (8 REQUIRED SECTIONS)
         ===================================================================== */}
      {showSubjectTeacherBlock && (
        <div
          data-testid="subject-teacher-8-sections"
          className="bg-white rounded-2xl border border-emerald-200/90 shadow-2xs p-5 space-y-5"
        >
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-emerald-200/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-khmer-title">
                  2. Dashboard សម្រាប់គ្រូមុខវិជ្ជា — មុខវិជ្ជាទទួលបន្ទុក (
                  {subjectTeacherDashboard.taughtSubjectsAndClasses
                    .map((s) => s.subjectNameKh)
                    .join(', ')}
                  )
                </h3>
                <p className="text-xs text-slate-600 font-khmer-body">
                  បង្ហាញព័ត៌មានគ្រប់គ្រងមុខវិជ្ជា ពិន្ទុ វិញ្ញាសាប្រឡង និងបណ្ណាល័យសំណួរទាំង ៨ ផ្នែក
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateSection('SUBJECTS_QUESTIONS')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-khmer-body transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>បណ្ណាល័យសំណួរ និងវិញ្ញាសា</span>
              </button>
            </div>
          </div>

          {/* Row 1: (1) មុខវិជ្ជាដែលបង្រៀន, (2) ចំនួនសិស្សសរុបតាមថ្នាក់ដែលខ្លួនបង្រៀន, (3) ស្ថិតិពិន្ទុ, (4) អត្រាជាប់ និងធ្លាក់ */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. មុខវិជ្ជាដែលបង្រៀន – បញ្ជីមុខវិជ្ជា និងថ្នាក់ */}
            <div
              data-testid="sub-sec-1-taught-subjects"
              className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-900 font-khmer-body">
                  1. មុខវិជ្ជាដែលបង្រៀន – បញ្ជីមុខវិជ្ជា និងថ្នាក់
                </span>
                <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
              <div className="space-y-1.5 pt-1">
                {subjectTeacherDashboard.taughtSubjectsAndClasses.map((sub) => (
                  <div
                    key={sub.subjectId}
                    className="p-2 rounded-xl bg-white border border-emerald-200/70 text-xs font-khmer-body"
                  >
                    <div className="font-extrabold text-slate-900">
                      {sub.subjectNameKh}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                      ថ្នាក់បង្រៀន៖{' '}
                      {sub.classes.map((c) => c.className).join(', ')} (
                      {sub.classes.length} ថ្នាក់)
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. ចំនួនសិស្សសរុប – តាមថ្នាក់ដែលខ្លួនបង្រៀន */}
            <div
              data-testid="sub-sec-2-taught-students"
              className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-blue-900 font-khmer-body">
                  2. ចំនួនសិស្សសរុប – តាមថ្នាក់ដែលខ្លួនបង្រៀន
                </span>
                <Users className="w-4 h-4 text-blue-600 shrink-0" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono-tabular">
                {
                  subjectTeacherDashboard.taughtClassStudentCounts
                    .totalStudentsAcrossTaughtClasses
                }{' '}
                <span className="text-xs font-bold text-slate-600 font-khmer-body">
                  នាក់ ({subjectTeacherDashboard.taughtClassStudentCounts.totalTaughtClasses}{' '}
                  ថ្នាក់)
                </span>
              </div>
              <div className="text-xs text-slate-700 font-khmer-body">
                ប្រុស{' '}
                <strong>
                  {subjectTeacherDashboard.taughtClassStudentCounts.maleStudents}
                </strong>{' '}
                នាក់ • ស្រី{' '}
                <strong>
                  {subjectTeacherDashboard.taughtClassStudentCounts.femaleStudents}
                </strong>{' '}
                នាក់
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {subjectTeacherDashboard.taughtClassStudentCounts.perClassBreakdown.map(
                  (c) => (
                    <span
                      key={c.classId}
                      className="px-2 py-0.5 rounded-md bg-white border border-blue-200 text-[11px] font-khmer-body text-blue-900"
                    >
                      {c.className}: <strong>{c.totalStudents}</strong> នាក់
                    </span>
                  )
                )}
              </div>
            </div>

            {/* 3. ស្ថិតិពិន្ទុ – មធ្យមភាគពិន្ទុ និងពិន្ទុខ្ពស់បំផុត */}
            <div
              data-testid="sub-sec-3-score-stats"
              className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-indigo-900 font-khmer-body">
                  3. ស្ថិតិពិន្ទុ – មធ្យមភាគពិន្ទុ និងពិន្ទុខ្ពស់បំផុត
                </span>
                <BarChart3 className="w-4 h-4 text-indigo-600 shrink-0" />
              </div>
              <div className="space-y-1.5 pt-1">
                {subjectTeacherDashboard.subjectScoreAndPassFailStats.map(
                  (st) => (
                    <div
                      key={st.subjectId}
                      className="p-2 rounded-xl bg-white border border-indigo-200/70 text-xs font-khmer-body"
                    >
                      <div className="font-bold text-slate-900">
                        {st.subjectNameKh}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span>
                          មធ្យមភាគ៖{' '}
                          <strong className="font-mono-tabular text-indigo-700">
                            {st.averageScore.toFixed(2)}
                          </strong>
                        </span>
                        <span>
                          ខ្ពស់បំផុត៖{' '}
                          <strong className="font-mono-tabular text-emerald-700">
                            {st.highestScore.toFixed(2)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* 4. អត្រាជាប់ និងធ្លាក់ – តាមមុខវិជ្ជា */}
            <div
              data-testid="sub-sec-4-pass-fail-rate"
              className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-amber-900 font-khmer-body">
                  4. អត្រាជាប់ និងធ្លាក់ – តាមមុខវិជ្ជា
                </span>
                <GraduationCap className="w-4 h-4 text-amber-600 shrink-0" />
              </div>
              <div className="space-y-2 pt-1">
                {subjectTeacherDashboard.subjectScoreAndPassFailStats.map(
                  (st) => (
                    <div
                      key={st.subjectId}
                      className="p-2 rounded-xl bg-white border border-amber-200/70 text-xs font-khmer-body space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {st.subjectNameKh}
                        </span>
                        <span className="font-mono-tabular font-bold text-emerald-700">
                          ជាប់ {st.passRatePct}% • ធ្លាក់ {st.failRatePct}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-rose-100 overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${st.passRatePct}%` }}
                        />
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${st.failRatePct}%` }}
                        />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Row 2: (5) ស្ថានភាពបញ្ចូលពិន្ទុ, (6) ការគ្រប់គ្រងការប្រឡង, (7) បណ្ណាល័យសំណួរ, (8) សកម្មភាពថ្មីៗ */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 5. ស្ថានភាពបញ្ចូលពិន្ទុ – បញ្ចូលរួច និងមិនទាន់បញ្ចូល */}
            <div
              data-testid="sub-sec-5-score-entry-status"
              className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2.5"
            >
              <h4 className="text-xs font-extrabold text-slate-900 font-khmer-body flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>5. ស្ថានភាពបញ្ចូលពិន្ទុ – បញ្ចូលរួច និងមិនទាន់បញ្ចូល</span>
              </h4>
              <div className="space-y-1.5">
                {subjectTeacherDashboard.scoreEntryStatusByTaughtClass.map(
                  (item) => (
                    <div
                      key={item.assignmentKey}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-white border border-slate-200/80 text-xs font-khmer-body"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          ថ្នាក់ទី {item.className} • {item.subjectNameKh}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          បានបញ្ចូល {item.enteredCount}/{item.totalStudents} នាក់
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                          item.isEntered
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {item.statusLabelKh}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* 6. ការគ្រប់គ្រងការប្រឡង – ចំនួនប្រឡង និងស្ថានភាពប្រឡង */}
            <div
              data-testid="sub-sec-6-exam-management"
              className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2.5"
            >
              <h4 className="text-xs font-extrabold text-slate-900 font-khmer-body flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>6. ការគ្រប់គ្រងការប្រឡង – ចំនួនប្រឡង និងស្ថានភាពប្រឡង</span>
              </h4>
              <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-khmer-body">
                <div className="p-2 rounded-xl bg-white border border-slate-200">
                  <div className="font-mono-tabular font-extrabold text-blue-700 text-base">
                    {
                      subjectTeacherDashboard.examManagementSummary
                        .totalExamsForMySubjects
                    }
                  </div>
                  <div className="text-[10px] text-slate-500">វិញ្ញាសាសរុប</div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-slate-200">
                  <div className="font-mono-tabular font-extrabold text-emerald-700 text-base">
                    {subjectTeacherDashboard.examManagementSummary.publishedCount}
                  </div>
                  <div className="text-[10px] text-slate-500">កំពុងបើក</div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-slate-200">
                  <div className="font-mono-tabular font-extrabold text-amber-700 text-base">
                    {subjectTeacherDashboard.examManagementSummary.draftCount}
                  </div>
                  <div className="text-[10px] text-slate-500">សេចក្តីព្រាង</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {subjectTeacherDashboard.examManagementSummary.exams
                  .slice(0, 3)
                  .map((ex) => (
                    <div
                      key={ex.examId}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2 text-xs font-khmer-body"
                    >
                      <span className="font-bold text-slate-800 truncate">
                        {ex.examTitle}
                      </span>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded shrink-0">
                        {ex.statusLabelKh}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* 7. បណ្ណាល័យសំណួរ – ចំនួនសំណួរដែលបានបង្កើត */}
            <div
              data-testid="sub-sec-7-question-bank"
              className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2.5"
            >
              <h4 className="text-xs font-extrabold text-slate-900 font-khmer-body flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-purple-600 shrink-0" />
                <span>7. បណ្ណាល័យសំណួរ – ចំនួនសំណួរដែលបានបង្កើត</span>
              </h4>
              <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 font-khmer-body">
                  សំណួរដែលបានបង្កើតសរុប
                </span>
                <span className="text-xl font-extrabold text-purple-700 font-mono-tabular">
                  {
                    subjectTeacherDashboard.questionBankSummary
                      .totalCreatedQuestions
                  }{' '}
                  សំណួរ
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-khmer-body">
                <div className="p-2 rounded-xl bg-white border border-slate-200">
                  <div className="font-mono-tabular font-bold text-slate-900">
                    {subjectTeacherDashboard.questionBankSummary.mcqCount}
                  </div>
                  <div className="text-[10px] text-slate-500">ពហុជ្រើសរើស</div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-slate-200">
                  <div className="font-mono-tabular font-bold text-slate-900">
                    {subjectTeacherDashboard.questionBankSummary.trueFalseCount}
                  </div>
                  <div className="text-[10px] text-slate-500">ពិត / មិនពិត</div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-slate-200">
                  <div className="font-mono-tabular font-bold text-slate-900">
                    {
                      subjectTeacherDashboard.questionBankSummary
                        .shortAnswerAndEssayCount
                    }
                  </div>
                  <div className="text-[10px] text-slate-500">សរសេរ/ផ្គូផ្គង</div>
                </div>
              </div>
            </div>

            {/* 8. សកម្មភាពថ្មីៗ – ប្រវត្តិបញ្ចូល និងកែប្រែពិន្ទុ */}
            <div
              data-testid="sub-sec-8-recent-activities"
              className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2.5"
            >
              <h4 className="text-xs font-extrabold text-slate-900 font-khmer-body flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>8. សកម្មភាពថ្មីៗ – ប្រវត្តិបញ្ចូល និងកែប្រែពិន្ទុ</span>
              </h4>
              <div className="space-y-1.5">
                {subjectTeacherDashboard.recentActivities.map((act) => (
                  <div
                    key={act.logId}
                    className="p-2 rounded-xl bg-white border border-slate-200/80 text-xs font-khmer-body"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="font-bold text-slate-800">
                        {act.actorNameKh}
                      </span>
                      <span className="font-mono-tabular">{act.module}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                      {act.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. ការកំណត់រចនាសម្ព័ន្ធ Dashboard (STRUCTURE MATRIX & 8+8 SPEC REFERENCE)
         ===================================================================== */}
      {showStructureMatrixBlock && (
        <div
          data-testid="dashboard-structure-matrix-card"
          className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-200/80">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 font-khmer-title flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <span>3. ការកំណត់រចនាសម្ព័ន្ធ Dashboard តាមសិទ្ធិអ្នកប្រើប្រាស់</span>
              </h3>
              <p className="text-xs text-slate-600 font-khmer-body mt-0.5">
                ប្រៀបធៀបធាតុផ្សំ Dashboard រវាងគ្រូបន្ទុកថ្នាក់ និងគ្រូមុខវិជ្ជា ក្នុងប្រព័ន្ធរួមតែមួយ
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left 6 cols: 8+8 Specification Checklists */}
            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200 space-y-2.5">
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-khmer-body">
                  1. Dashboard សម្រាប់គ្រូបន្ទុកថ្នាក់
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-800 font-khmer-body">
                  {HOMEROOM_DASHBOARD_SPEC_ITEMS_KH.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-amber-200/60"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200 space-y-2.5">
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-khmer-body">
                  2. Dashboard សម្រាប់គ្រូមុខវិជ្ជា
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-800 font-khmer-body">
                  {SUBJECT_TEACHER_DASHBOARD_SPEC_ITEMS_KH.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200/60"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right 6 cols: 3. ការកំណត់រចនាសម្ព័ន្ធ Dashboard Table + អនុសាសន៍ */}
            <div className="lg:col-span-6 space-y-3">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table
                  data-testid="dashboard-structure-comparison-table"
                  className="w-full text-xs font-khmer-body border-collapse"
                >
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-200">
                      <th className="py-2.5 px-3.5 text-left font-extrabold">
                        ផ្នែក
                      </th>
                      <th className="py-2.5 px-3.5 text-center font-extrabold text-amber-900">
                        គ្រូបន្ទុកថ្នាក់
                      </th>
                      <th className="py-2.5 px-3.5 text-center font-extrabold text-emerald-900">
                        គ្រូមុខវិជ្ជា
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 bg-white">
                    {unifiedData.structureMatrixRows.map((row) => (
                      <tr key={row.sectionName} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3.5 font-bold text-slate-900">
                          <div>{row.sectionName}</div>
                          <div className="text-[11px] font-normal text-slate-500">
                            {row.sectionLabelKh}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-extrabold text-amber-700">
                          {row.homeroomTeacherScope}
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-extrabold text-emerald-700">
                          {row.subjectTeacherScope}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs sm:text-sm font-bold text-indigo-950 font-khmer-body leading-relaxed">
                {unifiedData.recommendationKh}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
