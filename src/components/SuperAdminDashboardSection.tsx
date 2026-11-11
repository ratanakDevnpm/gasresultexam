import React, { useMemo } from 'react';
import {
  BookOpen,
  ClipboardList,
  Clock,
  FileCheck,
  GraduationCap,
  School,
  UserCheck,
  Users,
} from 'lucide-react';
import { DatabaseState } from '../types/database';
import { GasAdapterConfig } from '../lib/gasPersistenceAdapter';
import {
  computeSuperAdminDashboardMetrics,
  SuperAdminSummaryCardItem,
} from '../lib/superAdminDashboardMetrics';

interface SuperAdminDashboardSectionProps {
  db: DatabaseState;
  activeUserId?: string;
  selectedClassId: string;
  onSelectClassId: (classId: string) => void;
  adapterConfig?: GasAdapterConfig;
  onNavigateSection: (section: string) => void;
}

const CARD_CONFIG: Record<
  SuperAdminSummaryCardItem['id'],
  {
    icon: React.FC<{ className?: string }>;
    iconClass: string;
    badgeText: string;
    badgeClass: string;
    labelKh: string;
  }
> = {
  TOTAL_STUDENTS: {
    icon: Users,
    iconClass: 'text-blue-600',
    badgeText: 'Students',
    badgeClass: 'bg-blue-50 text-blue-600 border-blue-200/80',
    labelKh: 'ចំនួនសិស្សសរុប',
  },
  TOTAL_TEACHERS: {
    icon: GraduationCap,
    iconClass: 'text-emerald-600',
    badgeText: 'Teachers',
    badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
    labelKh: 'ចំនួនគ្រូបង្រៀន',
  },
  TOTAL_SUBJECTS: {
    icon: BookOpen,
    iconClass: 'text-purple-600',
    badgeText: 'Subjects',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/80',
    labelKh: 'ចំនួនមុខវិជ្ជា',
  },
  TOTAL_CLASSES: {
    icon: School,
    iconClass: 'text-amber-600',
    badgeText: 'Classes',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/80',
    labelKh: 'ចំនួនថ្នាក់សិក្សា',
  },
  TOTAL_EXAMS: {
    icon: ClipboardList,
    iconClass: 'text-blue-600',
    badgeText: 'Exams',
    badgeClass: 'bg-blue-50 text-blue-600 border-blue-200/80',
    labelKh: 'ការប្រឡងសរុប',
  },
  TOTAL_RESULTS: {
    icon: FileCheck,
    iconClass: 'text-emerald-600',
    badgeText: 'Results',
    badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
    labelKh: 'លទ្ធផលបានបញ្ចូល',
  },
  ACTIVE_USERS: {
    icon: UserCheck,
    iconClass: 'text-emerald-600',
    badgeText: 'Active',
    badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
    labelKh: 'គណនីកំពុងប្រើប្រាស់',
  },
  PENDING_TASKS: {
    icon: Clock,
    iconClass: 'text-amber-600',
    badgeText: 'Pending',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
    labelKh: 'ការងាររង់ចាំដំណើរការ',
  },
};

export const SuperAdminDashboardSection: React.FC<SuperAdminDashboardSectionProps> = ({
  db,
  selectedClassId,
  adapterConfig,
  onNavigateSection,
}) => {
  const metrics = useMemo(
    () =>
      computeSuperAdminDashboardMetrics(
        db,
        {
          academicYearId: 'ALL',
          semesterId: 'ALL',
          dateFilter: 'ALL',
          classId: selectedClassId || 'ALL',
        },
        adapterConfig
      ),
    [db, selectedClassId, adapterConfig]
  );

  // Bar Chart calculations (Grades 7 to 12)
  const gradeRows = metrics.analytics.studentsByGradeLevel;
  const maxGradeCount = Math.max(
    1,
    ...gradeRows.map((g) => g.totalStudents)
  );
  // Compute clean round Y-axis maximum (4 steps: 0, 25%, 50%, 75%, 100%)
  const stepUnit = Math.max(50, Math.ceil(maxGradeCount / 4 / 50) * 50);
  const yAxisMax = stepUnit * 4;
  const yAxisTicks = [yAxisMax, stepUnit * 3, stepUnit * 2, stepUnit, 0];

  // Donut Chart calculations (ជាប់, ធ្លាក់, មិនទាន់បញ្ចប់)
  const passedCount = metrics.analytics.passFailRate.passedCount;
  const failedCount = metrics.analytics.passFailRate.failedCount;
  const incompleteCount = Math.max(
    metrics.analytics.passFailRate.unrankedCount,
    metrics.summaryCards.find((c) => c.id === 'PENDING_TASKS')?.primaryValue || 0
  );
  const totalResultStatus = Math.max(1, passedCount + failedCount + incompleteCount);

  const donutRadius = 86;
  const donutCircumference = 2 * Math.PI * donutRadius;

  const passedFraction = passedCount / totalResultStatus;
  const failedFraction = failedCount / totalResultStatus;
  const incompleteFraction = incompleteCount / totalResultStatus;

  const passedArc = passedFraction * donutCircumference;
  const failedArc = failedFraction * donutCircumference;
  const incompleteArc = incompleteFraction * donutCircumference;

  return (
    <section
      aria-label="Super Admin Dashboard"
      data-testid="super-admin-dashboard-section"
      className="space-y-6"
    >
      {/* 1. 8 SUMMARY CARDS (2x4 Grid matching reference Image 1) */}
      <div
        data-testid="super-admin-summary-cards-grid"
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {metrics.summaryCards.map((card) => {
          const cfg = CARD_CONFIG[card.id];
          const IconComponent = cfg.icon;
          return (
            <button
              key={card.id}
              type="button"
              data-testid={`super-admin-card-${card.id}`}
              onClick={() => onNavigateSection(card.targetSection)}
              className="group bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 p-5 sm:p-6 text-left transition-all shadow-2xs hover:shadow-md cursor-pointer flex flex-col justify-between min-h-[148px]"
            >
              <div className="flex items-center justify-between gap-3 w-full">
                <IconComponent className={`w-6 h-6 shrink-0 ${cfg.iconClass}`} />
                <span
                  className={`px-3.5 py-1 rounded-full text-xs font-bold border tracking-wide ${cfg.badgeClass}`}
                >
                  {cfg.badgeText}
                </span>
              </div>

              <div className="mt-4">
                <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-mono-tabular tracking-tight">
                  {card.primaryValue.toLocaleString('en-US')}
                </div>
                <div className="mt-1.5 text-sm sm:text-base font-bold text-slate-700 font-khmer-body">
                  {cfg.labelKh}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. CHARTS SECTION (Bar Chart Grades 7-12 & Donut Chart Pass/Fail/Incomplete) */}
      <div
        data-testid="super-admin-analytics-section"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Chart 1: Students by Grade Bar Chart (ថ្នាក់ទី 7 - ថ្នាក់ទី 12) */}
        <div
          data-testid="analytics-students-by-grade-card"
          className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 flex flex-col justify-between"
        >
          <h3 className="text-base sm:text-lg font-bold text-slate-800 font-khmer-body mb-6">
            ស្ថិតិសិស្សតាមកម្រិតថ្នាក់ (ថ្នាក់ទី 7 ដល់ ថ្នាក់ទី 12)
          </h3>

          <div className="relative pt-2 pb-1">
            {/* Y-Axis Grid Lines & Labels + Bars Container */}
            <div className="relative h-64 flex flex-col justify-between">
              {yAxisTicks.map((tickValue) => (
                <div
                  key={tickValue}
                  className="flex items-center gap-3 w-full"
                >
                  <span className="w-9 text-right text-xs font-semibold text-slate-400 font-mono-tabular shrink-0">
                    {tickValue}
                  </span>
                  <div className="flex-1 border-b border-dashed border-slate-200" />
                </div>
              ))}

              {/* Bars Overlay */}
              <div className="absolute inset-y-2 left-12 right-0 flex items-end justify-around gap-2 sm:gap-4 px-2">
                {gradeRows.map((row) => {
                  const heightPct = Math.max(
                    8,
                    Math.min(100, Math.round((row.totalStudents / yAxisMax) * 100))
                  );
                  return (
                    <div
                      key={row.gradeLevel}
                      className="flex-1 h-full flex flex-col items-center justify-end group"
                    >
                      <div
                        title={`ថ្នាក់ទី ${row.gradeLevel}: ${row.totalStudents} នាក់`}
                        style={{ height: `${heightPct}%` }}
                        className="w-full max-w-[68px] rounded-xl bg-[#285094] group-hover:bg-[#2563EB] transition-all relative flex items-start justify-center pt-1.5 shadow-2xs"
                      >
                        <span className="text-[11px] font-bold text-white/90 font-mono-tabular">
                          {row.totalStudents}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-Axis Labels (ថ្នាក់ទី 7 .. ថ្នាក់ទី 12) */}
            <div className="pl-12 pr-2 mt-3 flex items-center justify-around gap-2 sm:gap-4">
              {gradeRows.map((row) => (
                <div
                  key={row.gradeLevel}
                  className="flex-1 text-center text-xs sm:text-sm font-bold text-slate-800 font-khmer-body truncate"
                >
                  ថ្នាក់ទី {row.gradeLevel}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 2: Result Status Donut Chart (ជាប់ • ធ្លាក់ • មិនទាន់បញ្ចប់) */}
        <div
          data-testid="analytics-pass-fail-card"
          className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 flex flex-col justify-between"
        >
          <h3 className="text-base sm:text-lg font-bold text-slate-800 font-khmer-body mb-4">
            ស្ថិតិតាមស្ថានភាពលទ្ធផល
          </h3>

          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
              <svg
                viewBox="0 0 220 220"
                className="w-full h-full -rotate-90 transform"
                aria-label="ក្រាហ្វស្ថិតិតាមស្ថានភាពលទ្ធផល"
              >
                {/* Background Ring */}
                <circle
                  cx="110"
                  cy="110"
                  r={donutRadius}
                  fill="transparent"
                  stroke="#F1F5F9"
                  strokeWidth="44"
                />

                {/* Segment 1: ជាប់ (Blue #285094) */}
                {passedArc > 0 && (
                  <circle
                    cx="110"
                    cy="110"
                    r={donutRadius}
                    fill="transparent"
                    stroke="#285094"
                    strokeWidth="44"
                    strokeDasharray={`${passedArc} ${donutCircumference}`}
                    strokeDashoffset={0}
                  />
                )}

                {/* Segment 2: ធ្លាក់ (Green #4A8B4B) */}
                {failedArc > 0 && (
                  <circle
                    cx="110"
                    cy="110"
                    r={donutRadius}
                    fill="transparent"
                    stroke="#4A8B4B"
                    strokeWidth="44"
                    strokeDasharray={`${failedArc} ${donutCircumference}`}
                    strokeDashoffset={-passedArc}
                  />
                )}

                {/* Segment 3: មិនទាន់បញ្ចប់ (Orange/Brown #A85528) */}
                {incompleteArc > 0 && (
                  <circle
                    cx="110"
                    cy="110"
                    r={donutRadius}
                    fill="transparent"
                    stroke="#A85528"
                    strokeWidth="44"
                    strokeDasharray={`${incompleteArc} ${donutCircumference}`}
                    strokeDashoffset={-(passedArc + failedArc)}
                  />
                )}
              </svg>
            </div>

            {/* Bottom Legend: ជាប់ • ធ្លាក់ • មិនទាន់បញ្ចប់ */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-8">
              <div className="inline-flex items-center gap-2 text-sm sm:text-base font-bold text-slate-800 font-khmer-body">
                <span className="w-3.5 h-3.5 rounded-full bg-[#285094] shrink-0" />
                <span>ជាប់ ({passedCount})</span>
              </div>

              <div className="inline-flex items-center gap-2 text-sm sm:text-base font-bold text-slate-800 font-khmer-body">
                <span className="w-3.5 h-3.5 rounded-full bg-[#4A8B4B] shrink-0" />
                <span>ធ្លាក់ ({failedCount})</span>
              </div>

              <div className="inline-flex items-center gap-2 text-sm sm:text-base font-bold text-slate-800 font-khmer-body">
                <span className="w-3.5 h-3.5 rounded-full bg-[#A85528] shrink-0" />
                <span>មិនទាន់បញ្ចប់ ({incompleteCount})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
