import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DatabaseState } from '../types/database';
import {
  REPORT_CATEGORIES_CATALOG,
  PaperOrientation,
  ReportCategoryId,
  ReportCategoryMeta,
  ReportFilterState,
  ReportSubItemId,
  ReportSubItemMeta,
  formatRankingDisplayName,
  generateReportCenterOutput,
  normalizeReportCategoryAndSubId,
  resolveAuthorizedReportFilters,
} from '../lib/reportCenterEngine';
import { OfficialReportsView } from './OfficialReportsView';
import {
  downloadPrintableA4Document,
  exportReportToExcelCsv,
  formatKhmerReportTitle,
  handleGlobalPrint,
} from '../utils/printHelper';
import {
  ArrowLeft,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Layout,
  Printer,
  Search,
  ShieldAlert,
  Sparkles,
  Table,
  UserCheck,
  Users,
} from 'lucide-react';

export { REPORT_CATEGORIES_CATALOG };
export type {
  ReportCategoryId,
  ReportCategoryMeta,
  ReportSubItemId,
  ReportSubItemMeta,
};

const ACADEMIC_MONTHS = [
  'តុលា',
  'វិច្ឆិកា',
  'ធ្នូ',
  'មករា',
  'កុម្ភៈ',
  'មីនា',
  'មេសា',
  'ឧសភា',
  'មិថុនា',
  'កក្កដា',
];

interface ReportCenterViewProps {
  db: DatabaseState;
  setDb?: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  activeCategory: ReportCategoryId;
  activeSubReport: ReportSubItemId;
  onSelectCategoryAndSubReport: (
    category: ReportCategoryId,
    subReport: ReportSubItemId
  ) => void;
  onUpdateStudentScore: (params: {
    studentId: string;
    classId: string;
    periodType: 'MONTHLY' | 'ANNUAL';
    newAverageScore: number;
  }) => void;
}

export const ReportCenterView: React.FC<ReportCenterViewProps> = ({
  db,
  setDb,
  activeUserId,
  activeCategory,
  activeSubReport,
  onSelectCategoryAndSubReport,
  onUpdateStudentScore,
}) => {
  // Normalize incoming category & sub-report IDs so legacy shortcuts map cleanly to A–E
  const normalizedSelection = useMemo(
    () => normalizeReportCategoryAndSubId(activeCategory, activeSubReport),
    [activeCategory, activeSubReport]
  );

  // Filter state
  const [selectedAcademicYearId, setSelectedAcademicYearId] =
    useState<string>('AY-2025-2026');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('SEM-1');
  const [selectedMonth, setSelectedMonth] = useState<string>('វិច្ឆិកា');
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('CLS-12C');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [selectedExamId, setSelectedExamId] = useState<string>('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('ALL');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');

  // Preview & Print layout state
  const [isPrintPreviewMode, setIsPrintPreviewMode] = useState<boolean>(false);
  const [showOfficialMoEYSTemplate, setShowOfficialMoEYSTemplate] =
    useState<boolean>(false);
  const [paperOrientation, setPaperOrientation] =
    useState<PaperOrientation>('portrait');

  const printSheetRef = useRef<HTMLDivElement>(null);

  const filterState: ReportFilterState = useMemo(
    () => ({
      academicYearId: selectedAcademicYearId,
      semesterId: selectedSemesterId,
      month: selectedMonth,
      gradeLevel: selectedGradeLevel,
      classId: selectedClassId,
      subjectId: selectedSubjectId,
      examId: selectedExamId,
      studentId: selectedStudentId,
      studentSearchQuery,
    }),
    [
      selectedAcademicYearId,
      selectedSemesterId,
      selectedMonth,
      selectedGradeLevel,
      selectedClassId,
      selectedSubjectId,
      selectedExamId,
      selectedStudentId,
      studentSearchQuery,
    ]
  );

  // Role-authorized scope & dependent dropdown options
  const scope = useMemo(
    () => resolveAuthorizedReportFilters(db, activeUserId, filterState),
    [db, activeUserId, filterState]
  );

  const currentCategoryMeta = useMemo(
    () =>
      scope.permittedCategories.find(
        (c) => c.id === normalizedSelection.categoryId
      ) ||
      scope.permittedCategories[0] ||
      REPORT_CATEGORIES_CATALOG[0],
    [scope.permittedCategories, normalizedSelection.categoryId]
  );

  const currentSubReportMeta = useMemo(
    () =>
      currentCategoryMeta.subReports.find(
        (s) => s.id === normalizedSelection.subReportId
      ) || currentCategoryMeta.subReports[0],
    [currentCategoryMeta, normalizedSelection.subReportId]
  );

  // Sync default paper orientation whenever sub-report changes
  useEffect(() => {
    setPaperOrientation(currentSubReportMeta.defaultOrientation);
    setShowOfficialMoEYSTemplate(false);
  }, [currentSubReportMeta.id, currentSubReportMeta.defaultOrientation]);

  // Dependent dropdown consistency: if Grade Level changes and current Class is not in that Grade, update Class
  useEffect(() => {
    if (
      selectedGradeLevel !== 'ALL' &&
      selectedClassId !== 'ALL' &&
      !scope.availableClasses.some((c) => c.ClassID === selectedClassId)
    ) {
      setSelectedClassId(scope.availableClasses[0]?.ClassID || 'ALL');
    }
  }, [selectedGradeLevel, selectedClassId, scope.availableClasses]);

  // Dependent dropdown consistency: if Class changes and current Student is not in availableStudents, reset Student to ALL (or first student for individual reports)
  useEffect(() => {
    if (scope.roleSummary.isStudent && scope.linkedStudentRecord) {
      setSelectedStudentId(scope.linkedStudentRecord.StudentID);
      return;
    }
    if (
      selectedStudentId !== 'ALL' &&
      !scope.availableStudents.some((s) => s.StudentID === selectedStudentId)
    ) {
      setSelectedStudentId('ALL');
    }
  }, [
    selectedClassId,
    selectedStudentId,
    scope.availableStudents,
    scope.roleSummary.isStudent,
    scope.linkedStudentRecord,
  ]);

  // Generate live report output from database
  const reportOutput = useMemo(
    () =>
      generateReportCenterOutput(
        db,
        activeUserId,
        currentCategoryMeta.id,
        currentSubReportMeta.id,
        filterState
      ),
    [
      db,
      activeUserId,
      currentCategoryMeta.id,
      currentSubReportMeta.id,
      filterState,
    ]
  );

  // Standardized Khmer document title for Print / PDF / Excel
  const standardizedDocTitle = useMemo(() => {
    const clsName =
      selectedClassId === 'ALL'
        ? 'គ្រប់ថ្នាក់'
        : db.Classes.find((c) => c.ClassID === selectedClassId)?.ClassName ||
          '12C';
    return formatKhmerReportTitle({
      reportNameKh: currentSubReportMeta.titleKh,
      className: clsName,
      academicYear: reportOutput.metadataSummary.academicYearLabel,
      extraContext: currentSubReportMeta.filters.includes('MONTH')
        ? `ខែ${selectedMonth}`
        : undefined,
    });
  }, [
    currentSubReportMeta,
    selectedClassId,
    selectedMonth,
    db.Classes,
    reportOutput.metadataSummary.academicYearLabel,
  ]);

  // Trigger native browser print with dynamic A4 Portrait / Landscape @page rule
  const handlePrintReport = () => {
    handleGlobalPrint(standardizedDocTitle, paperOrientation);
  };

  // Trigger standalone A4 PDF/HTML download with embedded Khmer fonts
  const handleExportPdf = () => {
    if (printSheetRef.current) {
      downloadPrintableA4Document(
        standardizedDocTitle,
        printSheetRef.current.innerHTML,
        paperOrientation
      );
    } else {
      handleGlobalPrint(standardizedDocTitle, paperOrientation);
    }
  };

  // Trigger UTF-8 BOM Excel CSV export
  const handleExportExcel = () => {
    exportReportToExcelCsv({
      filename: standardizedDocTitle,
      reportTitleKh: `${currentSubReportMeta.titleKh} (${currentSubReportMeta.titleEn})`,
      schoolNameKh: 'វិទ្យាល័យទឹកជោរ (Teuk Chor High School)',
      metadataLineKh: `ឆ្នាំសិក្សា៖ ${reportOutput.metadataSummary.academicYearLabel} | ${reportOutput.metadataSummary.classLabel} | កាលបរិច្ឆេទ៖ ${reportOutput.metadataSummary.generatedDateKh}`,
      headers: reportOutput.headers,
      rows: reportOutput.rows,
    });
  };

  return (
    <div
      className="space-y-5"
      data-testid="report-center-view"
      data-print-orientation={paperOrientation}
    >
      {/* =====================================================================
          1. TOP HEADER & 5-CATEGORY TABS (A–E) — Hidden when printing
         ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 font-khmer-title">
                  មជ្ឈមណ្ឌលរបាយការណ៍ និងការបោះពុម្ពផ្លូវការ (Report Center & Print Management)
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold font-khmer-body">
                  វិទ្យាល័យទឹកជោរ
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold font-khmer-body">
                  សិទ្ធិ៖ {scope.roleSummary.effectiveRoles.join(' + ')}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-khmer-body mt-1">
                ជ្រើសរើសប្រភេទរបាយការណ៍ កំណត់តម្រងទិន្នន័យ មើលគម្រូបោះពុម្ព A4 (បញ្ឈរ/ផ្តេក) បោះពុម្ព ឬទាញយកជា PDF និង Excel
              </p>
            </div>
          </div>

          {/* Primary Action Toolbar: Preview, Orientation, Print, Export PDF, Export Excel, Back */}
          <div className="flex flex-wrap items-center gap-2">
            {isPrintPreviewMode ? (
              <button
                type="button"
                onClick={() => setIsPrintPreviewMode(false)}
                data-testid="report-back-to-reports-btn"
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4 text-slate-600" />
                <span>ត្រឡប់ទៅបញ្ជីរបាយការណ៍ (Back to Reports)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowOfficialMoEYSTemplate(false);
                  setIsPrintPreviewMode(true);
                }}
                data-testid="report-preview-mode-btn"
                className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>មើលគម្រូបោះពុម្ព A4 (Preview)</span>
              </button>
            )}

            {/* Paper Orientation Selector: A4 Portrait vs A4 Landscape */}
            <div
              className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5"
              role="group"
              aria-label="Paper Orientation"
            >
              <button
                type="button"
                onClick={() => setPaperOrientation('portrait')}
                data-testid="report-orientation-portrait-btn"
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold font-khmer-body inline-flex items-center gap-1 transition-all cursor-pointer ${
                  paperOrientation === 'portrait'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layout className="w-3.5 h-3.5" />
                <span>A4 បញ្ឈរ (Portrait)</span>
              </button>
              <button
                type="button"
                onClick={() => setPaperOrientation('landscape')}
                data-testid="report-orientation-landscape-btn"
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold font-khmer-body inline-flex items-center gap-1 transition-all cursor-pointer ${
                  paperOrientation === 'landscape'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>A4 ផ្តេក (Landscape)</span>
              </button>
            </div>

            {currentSubReportMeta.officialTemplate && (
              <button
                type="button"
                onClick={() =>
                  setShowOfficialMoEYSTemplate(!showOfficialMoEYSTemplate)
                }
                className={`px-3 py-2 rounded-xl border text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  showOfficialMoEYSTemplate
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {showOfficialMoEYSTemplate
                    ? 'បង្ហាញតារាងរបាយការណ៍ស្តង់ដារ'
                    : 'ទម្រង់ផ្លូវការក្រសួង (MoEYS)'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              data-testid="report-export-excel-btn"
              className="px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              data-testid="report-export-pdf-btn"
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4 text-rose-600" />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrintReport}
              data-testid="report-print-btn"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>បោះពុម្ព (Print)</span>
            </button>
          </div>
        </div>

        {/* Category Selector Tabs (A–E) — Hidden in full Print Preview mode for focus */}
        {!isPrintPreviewMode && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100">
              {scope.permittedCategories.map((cat) => {
                const isSelected = cat.id === currentCategoryMeta.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    data-testid={`report-category-tab-${cat.id}`}
                    onClick={() => {
                      setShowOfficialMoEYSTemplate(false);
                      onSelectCategoryAndSubReport(cat.id, cat.subReports[0].id);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50/70 hover:bg-slate-100/80 text-slate-800 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        ផ្នែក {cat.code}
                      </span>
                      <span
                        className={`text-[10px] font-mono-tabular ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {cat.subReports.length} របាយការណ៍
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-extrabold font-khmer-body line-clamp-1">
                        {cat.titleKh}
                      </div>
                      <div
                        className={`text-[10px] font-medium line-clamp-1 ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {cat.titleEn}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Sub-Reports Pill Bar for Current Category */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500 font-khmer-body mr-1">
                របាយការណ៍រង ({currentCategoryMeta.code})៖
              </span>
              {currentCategoryMeta.subReports.map((sub) => {
                const isSubActive = sub.id === currentSubReportMeta.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    data-testid={`report-subitem-btn-${sub.id}`}
                    onClick={() => {
                      setShowOfficialMoEYSTemplate(false);
                      onSelectCategoryAndSubReport(
                        currentCategoryMeta.id,
                        sub.id
                      );
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-khmer-body transition-all cursor-pointer ${
                      isSubActive
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span>{sub.titleKh}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Contextual & Dependent Filters Bar (Section 3) */}
        <div
          className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3"
          data-testid="report-filters-bar"
        >
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 font-khmer-body">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>តម្រងទិន្នន័យ (Filters)៖</span>
          </div>

          {/* 1. Academic Year Filter */}
          {currentSubReportMeta.filters.includes('ACADEMIC_YEAR') && (
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="filter-academic-year"
                className="text-[11px] font-bold text-slate-500 font-khmer-body"
              >
                ឆ្នាំសិក្សា៖
              </label>
              <select
                id="filter-academic-year"
                value={selectedAcademicYearId}
                onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                aria-label="ជ្រើសរើសឆ្នាំសិក្សា"
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 font-khmer-body"
              >
                {db.AcademicYears.map((ay) => (
                  <option key={ay.AcademicYearID} value={ay.AcademicYearID}>
                    {ay.AcademicYearName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 2. Semester Filter */}
          {currentSubReportMeta.filters.includes('SEMESTER') && (
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="filter-semester"
                className="text-[11px] font-bold text-slate-500 font-khmer-body"
              >
                ឆមាស៖
              </label>
              <select
                id="filter-semester"
                value={selectedSemesterId}
                onChange={(e) => setSelectedSemesterId(e.target.value)}
                aria-label="ជ្រើសរើសឆមាស"
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 font-khmer-body"
              >
                {db.Semesters.map((sem) => (
                  <option key={sem.SemesterID} value={sem.SemesterID}>
                    {sem.SemesterName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 3. Month Filter */}
          {currentSubReportMeta.filters.includes('MONTH') && (
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="filter-month"
                className="text-[11px] font-bold text-slate-500 font-khmer-body"
              >
                ខែប្រឡង៖
              </label>
              <select
                id="filter-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="ជ្រើសរើសខែប្រឡង"
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 font-khmer-body"
              >
                {ACADEMIC_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    ខែ{m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 4. Grade Level Filter (Cascades to Class dropdown) */}
          {currentSubReportMeta.filters.includes('GRADE_LEVEL') && (
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="filter-grade-level"
                className="text-[11px] font-bold text-slate-500 font-khmer-body"
              >
                កម្រិតថ្នាក់៖
              </label>
              <select
                id="filter-grade-level"
                value={selectedGradeLevel}
                onChange={(e) => setSelectedGradeLevel(e.target.value)}
                aria-label="ជ្រើសរើសកម្រិតថ្នាក់"
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 font-khmer-body"
              >
                <option value="ALL">គ្រប់កម្រិតថ្នាក់ (៧–១២)</option>
                {scope.availableGradeLevels.map((gl) => (
                  <option key={gl} value={gl}>
                    ថ្នាក់ទី {gl}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 5. Dependent Class Filter */}
          {currentSubReportMeta.filters.includes('CLASS') && (
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="filter-class"
                className="text-[11px] font-bold text-slate-500 font-khmer-body"
              >
                ថ្នាក់រៀន៖
              </label>
              <select
                id="filter-class"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                aria-label="ជ្រើសរើសថ្នាក់រៀន"
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 font-khmer-body"
              >
                {currentSubReportMeta.id !== 'SCR_CLASS_SHEET' && (
                  <option value="ALL">
                    គ្រប់ថ្នាក់រៀន ({scope.availableClasses.length} ថ្នាក់)
                  </option>
                )}
                {scope.availableClasses.map((cls) => (
                  <option key={cls.ClassID} value={cls.ClassID}>
                    ថ្នាក់ទី {cls.ClassName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 6. Subject Filter */}
          {currentSubReportMeta.filters.includes('SUBJECT') && (
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="filter-subject"
                className="text-[11px] font-bold text-slate-500 font-khmer-body"
              >
                មុខវិជ្ជា៖
              </label>
              <select
                id="filter-subject"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                aria-label="ជ្រើសរើសមុខវិជ្ជា"
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 font-khmer-body"
              >
                {currentSubReportMeta.id !== 'SCR_SUBJECT_SHEET' && (
                  <option value="ALL">
                    គ្រប់មុខវិជ្ជា ({scope.availableSubjects.length})
                  </option>
                )}
                {scope.availableSubjects.map((sub) => (
                  <option key={sub.SubjectID} value={sub.SubjectID}>
                    {sub.SubjectNameKh} ({sub.MaximumScore} ពិន្ទុ)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 7. Dependent Examination Filter */}
          {currentSubReportMeta.filters.includes('EXAMINATION') && (
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="filter-examination"
                className="text-[11px] font-bold text-slate-500 font-khmer-body"
              >
                វិញ្ញាសាប្រឡង៖
              </label>
              <select
                id="filter-examination"
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                aria-label="ជ្រើសរើសវិញ្ញាសាប្រឡង"
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 font-khmer-body max-w-[220px]"
              >
                <option value="ALL">
                  គ្រប់វិញ្ញាសា ({scope.availableExams.length})
                </option>
                {scope.availableExams.map((ex) => (
                  <option key={ex.ExamID} value={ex.ExamID}>
                    {ex.ExamTitle}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 8. Dependent Student ID / Name Dropdown */}
          {currentSubReportMeta.filters.includes('STUDENT') && (
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="filter-student"
                className="text-[11px] font-bold text-slate-500 font-khmer-body"
              >
                អត្តលេខ / ឈ្មោះសិស្ស៖
              </label>
              <select
                id="filter-student"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                aria-label="ជ្រើសរើសសិស្ស"
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 font-khmer-body max-w-[220px]"
              >
                {!scope.roleSummary.isStudent && (
                  <option value="ALL">
                    សិស្សទាំងអស់ ({scope.availableStudents.length} នាក់)
                  </option>
                )}
                {scope.availableStudents.map((st) => (
                  <option key={st.StudentID} value={st.StudentID}>
                    #{st.StudentCode} •{' '}
                    {formatRankingDisplayName(
                      st.LastNameKh,
                      st.FirstNameKh,
                      st.Gender
                    )}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Live Search by Student ID / Name / Keyword */}
          <div className="relative flex-1 min-w-[200px] ml-auto">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={studentSearchQuery}
              onChange={(e) => setStudentSearchQuery(e.target.value)}
              placeholder="ស្វែងរកតាមអត្តលេខសិស្ស ឈ្មោះសិស្ស ឬពាក្យគន្លឹះ..."
              aria-label="ស្វែងរកក្នុងរបាយការណ៍នេះ"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-khmer-body focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. ACCESS DENIED STATE (When role permissions restrict a report)
         ===================================================================== */}
      {!reportOutput.allowed ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-2">
          <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
          <h3 className="text-base font-extrabold text-rose-900 font-khmer-title">
            {reportOutput.reportTitleKh}
          </h3>
          <p className="text-xs text-rose-700 font-khmer-body">
            {reportOutput.deniedReasonKh}
          </p>
        </div>
      ) : showOfficialMoEYSTemplate && currentSubReportMeta.officialTemplate ? (
        /* =====================================================================
           3. OFFICIAL MoEYS A4 TEMPLATE VIEW (Optional Split-Column / Honor Roll)
          ===================================================================== */
        <OfficialReportsView
          db={db}
          setDb={setDb}
          activeUserId={activeUserId}
          defaultTemplate={currentSubReportMeta.officialTemplate}
          onUpdateStudentScore={onUpdateStudentScore}
        />
      ) : (
        /* =====================================================================
           4. PROFESSIONAL REPORT PREVIEW & PRINTABLE A4 DOCUMENT SHEET
          ===================================================================== */
        <div
          className={
            isPrintPreviewMode
              ? 'bg-slate-200/80 p-4 sm:p-8 rounded-2xl border border-slate-300 overflow-x-auto'
              : ''
          }
        >
          {/* Print Preview Mode Banner (No-Print) */}
          {isPrintPreviewMode && (
            <div className="max-w-[297mm] mx-auto mb-4 bg-slate-900 text-white px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2.5 text-xs font-khmer-body">
                <span className="px-2 py-0.5 rounded bg-blue-600 font-bold">
                  មុខងារមើលគម្រូបោះពុម្ព (Print Preview)
                </span>
                <span>
                  ទម្រង់ក្រដាស៖{' '}
                  <strong>
                    {paperOrientation === 'landscape'
                      ? 'A4 ផ្តេក (Landscape 297mm × 210mm)'
                      : 'A4 បញ្ឈរ (Portrait 210mm × 297mm)'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>បោះពុម្ពឥឡូវនេះ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewMode(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>ត្រឡប់ទៅបញ្ជីរបាយការណ៍</span>
                </button>
              </div>
            </div>
          )}

          {/* THE ACTUAL PRINTABLE A4 SHEET */}
          <div
            ref={printSheetRef}
            data-testid="report-printable-sheet"
            className={`print-sheet bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-5 mx-auto ${
              isPrintPreviewMode
                ? paperOrientation === 'landscape'
                  ? 'max-w-[297mm] min-h-[210mm] shadow-xl'
                  : 'max-w-[210mm] min-h-[297mm] shadow-xl'
                : 'w-full'
            }`}
          >
            {/* 4.1 OFFICIAL CAMBODIAN KINGDOM & SCHOOL HEADER (Section 4) */}
            <div className="border-b-2 border-slate-900 pb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                {/* Left: Ministry & High School Identity + School Logo Emblem */}
                <div className="sm:col-span-5 flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-xl border-2 border-slate-900 bg-slate-50 flex flex-col items-center justify-center shrink-0 text-slate-900"
                    aria-label="រូបសញ្ញាវិទ្យាល័យទឹកជោរ"
                  >
                    <GraduationCap className="w-6 h-6" />
                    <span className="text-[8px] font-extrabold tracking-tighter">
                      វ.ទ.ជ
                    </span>
                  </div>
                  <div className="text-xs font-khmer-body text-slate-900 space-y-0.5 leading-snug">
                    <div className="font-bold">
                      មន្ទីរអប់រំ យុវជន និងកីឡា ខេត្តបន្ទាយមានជ័យ
                    </div>
                    <div className="font-semibold">
                      ការិយាល័យអប់រំ យុវជន និងកីឡា ស្រុកព្រះនេត្រព្រះ
                    </div>
                    <div className="font-extrabold text-sm text-blue-950 font-khmer-moul pt-0.5">
                      វិទ្យាល័យទឹកជោរ
                    </div>
                  </div>
                </div>

                {/* Right: Kingdom Motto */}
                <div className="sm:col-span-7 text-center sm:text-right font-khmer-moul text-slate-900 space-y-0.5">
                  <div className="text-sm">ព្រះរាជាណាចក្រកម្ពុជា</div>
                  <div className="text-xs">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
                  <div className="text-[10px] tracking-[0.25em] text-slate-500 font-sans">
                    ✦ ✦ ✦
                  </div>
                </div>
              </div>

              {/* Center Report Title & Metadata Bar */}
              <div className="text-center pt-1 space-y-1">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 font-khmer-moul">
                  {currentSubReportMeta.titleKh}
                </h1>
                <div className="text-xs font-semibold text-slate-600">
                  {currentSubReportMeta.titleEn}
                </div>
              </div>

              {/* Metadata Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 text-[11px] font-khmer-body bg-slate-50/90 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500">សាលារៀន៖ </span>
                  <strong className="text-slate-900">
                    {reportOutput.metadataSummary.schoolNameKh}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">ឆ្នាំសិក្សា៖ </span>
                  <strong className="text-slate-900">
                    {reportOutput.metadataSummary.academicYearLabel}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">ឆមាស / ខែ៖ </span>
                  <strong className="text-slate-900">
                    {currentSubReportMeta.filters.includes('MONTH')
                      ? `ខែ${reportOutput.metadataSummary.monthLabel}`
                      : reportOutput.metadataSummary.semesterLabel}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">កម្រិត / ថ្នាក់៖ </span>
                  <strong className="text-slate-900">
                    {reportOutput.metadataSummary.classLabel}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">មុខវិជ្ជា៖ </span>
                  <strong className="text-slate-900">
                    {reportOutput.metadataSummary.subjectLabel}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">កាលបរិច្ឆេទបោះពុម្ព៖ </span>
                  <strong className="text-slate-900 font-mono-tabular">
                    {reportOutput.metadataSummary.generatedDateKh}
                  </strong>
                </div>
              </div>

              {/* Summary KPI Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  {reportOutput.summaryMetrics.map((m, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-300 text-xs font-khmer-body"
                    >
                      <span className="text-slate-600">{m.labelKh}៖ </span>
                      <strong className="text-slate-950 font-mono-tabular">
                        {m.value}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="text-xs font-bold text-slate-700 font-khmer-body">
                  ចំនួនកំណត់ត្រាសរុប (Total Records)៖{' '}
                  <strong className="font-mono-tabular text-blue-800">
                    {reportOutput.metadataSummary.totalRecords}
                  </strong>
                </div>
              </div>
            </div>

            {/* ===============================================================
                4.2 INDIVIDUAL STUDENT PRINTABLE ACADEMIC REPORT CARD (Section 8)
                Displayed when viewing SCR_INDIVIDUAL_STUDENT or STD_INDIVIDUAL_INFO
               =============================================================== */}
            {reportOutput.individualTranscript &&
              (currentSubReportMeta.id === 'SCR_INDIVIDUAL_STUDENT' ||
                currentSubReportMeta.id === 'STD_INDIVIDUAL_INFO') && (
                <div
                  className="rounded-xl border-2 border-slate-900 p-4 space-y-4 bg-white print-avoid-break"
                  data-testid="individual-student-transcript-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-3">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 font-khmer-moul">
                        ព្រឹត្តិបត្រពិន្ទុ និងព័ត៌មានសិស្សម្នាក់ៗ (Individual Student Academic Report)
                      </h3>
                      <p className="text-xs text-slate-600 font-khmer-body">
                        វិទ្យាល័យទឹកជោរ • ឆ្នាំសិក្សា{' '}
                        {reportOutput.individualTranscript.academicYearName} •{' '}
                        {reportOutput.individualTranscript.semesterName} (ខែ
                        {reportOutput.individualTranscript.monthName})
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-extrabold font-khmer-body">
                        អត្តលេខសិស្ស៖ #{reportOutput.individualTranscript.studentCode}
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-extrabold font-khmer-body">
                        ចំណាត់ថ្នាក់៖ លេខ {reportOutput.individualTranscript.classRanking} /{' '}
                        {reportOutput.individualTranscript.totalStudentsInClass}
                      </span>
                    </div>
                  </div>

                  {/* Student Identity Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-khmer-body bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-500 block text-[11px]">
                        គោត្តនាម និងនាមសិស្ស
                      </span>
                      <strong className="text-slate-950 text-sm">
                        {reportOutput.individualTranscript.fullNameKh}
                      </strong>
                      <span className="block text-[10px] text-slate-500">
                        {reportOutput.individualTranscript.fullNameEn}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">
                        ភេទ / ថ្ងៃខែឆ្នាំកំណើត
                      </span>
                      <strong className="text-slate-900">
                        {reportOutput.individualTranscript.gender} •{' '}
                        {reportOutput.individualTranscript.dateOfBirth}
                      </strong>
                      <span className="block text-[10px] text-slate-500">
                        ទូរស័ព្ទ៖ {reportOutput.individualTranscript.phone}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">
                        កម្រិតថ្នាក់ / ថ្នាក់រៀន
                      </span>
                      <strong className="text-slate-900">
                        ថ្នាក់ទី {reportOutput.individualTranscript.className} (កម្រិតទី{' '}
                        {reportOutput.individualTranscript.gradeLevel})
                      </strong>
                      <span className="block text-[10px] text-slate-500">
                        គ្រូបន្ទុកថ្នាក់៖{' '}
                        {reportOutput.individualTranscript.homeroomTeacherNameKh}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">
                        មាតាបិតា / អាសយដ្ឋាន
                      </span>
                      <strong className="text-slate-900">
                        {reportOutput.individualTranscript.fatherNameKh} /{' '}
                        {reportOutput.individualTranscript.motherNameKh}
                      </strong>
                      <span className="block text-[10px] text-slate-500">
                        {reportOutput.individualTranscript.currentAddressKh}
                      </span>
                    </div>
                  </div>

                  {/* Summary Totals Bar for Individual Student */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center text-xs font-khmer-body">
                    <div className="p-2.5 rounded-lg border border-slate-300 bg-white">
                      <div className="text-[11px] text-slate-500">ពិន្ទុសរុប (Total Score)</div>
                      <div className="text-sm font-extrabold text-slate-900 font-mono-tabular mt-0.5">
                        {reportOutput.individualTranscript.totalObtainedScore} /{' '}
                        {reportOutput.individualTranscript.totalMaxScore}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-300 bg-white">
                      <div className="text-[11px] text-slate-500">មធ្យមភាគ (Average /50)</div>
                      <div className="text-sm font-extrabold text-blue-900 font-mono-tabular mt-0.5">
                        {reportOutput.individualTranscript.averageScore < 0
                          ? 'មិនចាត់ថ្នាក់'
                          : reportOutput.individualTranscript.averageScore.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-300 bg-white">
                      <div className="text-[11px] text-slate-500">និទ្ទេសរួម (Grade)</div>
                      <div className="text-sm font-extrabold text-indigo-900 font-mono-tabular mt-0.5">
                        {reportOutput.individualTranscript.overallGrade}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-300 bg-white">
                      <div className="text-[11px] text-slate-500">ចំណាត់ថ្នាក់ (Ranking)</div>
                      <div className="text-sm font-extrabold text-emerald-800 font-mono-tabular mt-0.5">
                        លេខ {reportOutput.individualTranscript.classRanking}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-300 bg-white col-span-2 sm:col-span-1">
                      <div className="text-[11px] text-slate-500">លទ្ធផលសិក្សា (Result)</div>
                      <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                        {reportOutput.individualTranscript.academicResultKh}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* ===============================================================
                4.3 REPORT DATA TABLE (Supports Multi-Page Printing & Repeating Headers)
               =============================================================== */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse print-table text-xs font-khmer-body">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-y border-slate-900">
                    {reportOutput.headers.map((h, i) => (
                      <th
                        key={i}
                        className="py-2.5 px-2.5 font-extrabold border border-slate-800 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {reportOutput.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(1, reportOutput.headers.length)}
                        className="py-10 text-center text-slate-500 font-khmer-body"
                      >
                        មិនមានទិន្នន័យត្រូវនឹងលក្ខខណ្ឌតម្រងដែលបានជ្រើសរើសនោះទេ។
                      </td>
                    </tr>
                  ) : (
                    reportOutput.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-blue-50/40 transition-colors break-inside-avoid"
                      >
                        {row.map((cell, cIdx) => {
                          const strVal = String(cell ?? '');
                          const isPassBadge =
                            strVal === 'ជាប់' ||
                            strVal === 'ជាប់មធ្យមភាគ' ||
                            strVal === 'កំពុងរៀន' ||
                            strVal === 'ACTIVE' ||
                            strVal === 'PUBLISHED' ||
                            strVal === 'GRADED';
                          const isFailBadge =
                            strVal === 'ធ្លាក់' ||
                            strVal === 'ធ្លាក់មធ្យមភាគ' ||
                            strVal === 'ផ្ទេរចេញ' ||
                            strVal === 'INACTIVE';

                          return (
                            <td
                              key={cIdx}
                              className={`py-2 px-2.5 border border-slate-400 ${
                                cIdx === 0 || cIdx === 1
                                  ? 'font-mono-tabular font-semibold text-slate-800'
                                  : cIdx === 2
                                    ? 'font-bold text-slate-950'
                                    : 'text-slate-800'
                              }`}
                            >
                              {isPassBadge ? (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold">
                                  {strVal}
                                </span>
                              ) : isFailBadge ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-300 text-[11px] font-bold">
                                  {strVal}
                                </span>
                              ) : (
                                strVal
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ===============================================================
                4.4 CONTEXTUAL OFFICIAL SIGNATURE SECTION (Section 6)
                Displays ONLY the relevant signature blocks for the selected report
               =============================================================== */}
            <div
              className={`pt-6 grid grid-cols-1 gap-6 text-center text-xs font-khmer-body print-signature-section ${
                reportOutput.signatures.length === 3
                  ? 'sm:grid-cols-3'
                  : 'sm:grid-cols-2'
              }`}
              data-testid="report-signature-section"
            >
              {reportOutput.signatures.map((sig, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center justify-between space-y-1"
                >
                  {sig.showDateLine ? (
                    <div className="text-[11px] text-slate-700">
                      ធ្វើនៅទឹកជោរ ថ្ងៃទី........ ខែ........... ឆ្នាំ២០២...
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-600">
                      {sig.subNoteKh || 'ថ្ងៃទី........ ខែ........... ឆ្នាំ២០២...'}
                    </div>
                  )}

                  <div className="font-bold text-slate-950 whitespace-pre-line leading-relaxed">
                    {sig.roleTitleKh}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    ({sig.roleTitleEn})
                  </div>

                  {/* Generous vertical space for handwritten signature and official stamp */}
                  <div className="h-20 w-full flex items-center justify-center">
                    {sig.showStampHint && (
                      <span className="text-[10px] text-slate-300 border border-dashed border-slate-300 rounded-full px-3 py-2 no-print">
                        កន្លែងបោះត្រា និងហត្ថលេខា
                      </span>
                    )}
                  </div>

                  <div className="font-bold text-slate-900 border-t border-dotted border-slate-500 pt-1 min-w-[170px]">
                    {sig.signerNameKh || '................................................'}
                  </div>
                </div>
              ))}
            </div>

            {/* 4.5 PRINT FOOTER: School Name, Print Date & Page Number */}
            <div className="pt-4 border-t border-slate-300 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 font-khmer-body">
              <div>
                វិទ្យាល័យទឹកជោរ (Teuk Chor High School) • ប្រព័ន្ធគ្រប់គ្រងការប្រឡង និងលទ្ធផលសិក្សាសិស្ស
              </div>
              <div className="font-mono-tabular">
                កាលបរិច្ឆេទបោះពុម្ព៖ {reportOutput.metadataSummary.generatedDateKh} • ទំព័រទី ១ (A4{' '}
                {paperOrientation === 'landscape' ? 'ផ្តេក Landscape' : 'បញ្ឈរ Portrait'})
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
