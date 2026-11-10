import React, { useEffect, useMemo, useState } from 'react';
import { DatabaseState } from '../types/database';
import { buildClassSubjectGradesAndRankingsSheet } from '../lib/subjectGradeRanges';
import { formatKhmerReportTitle, handleGlobalPrint } from '../utils/printHelper';
import {
  Award,
  Printer,
  Search,
  SlidersHorizontal,
  Table2,
} from 'lucide-react';

interface SubjectGradesAndRankingsSheetProps {
  db: DatabaseState;
  defaultClassId?: string;
  defaultMonth?: string;
  defaultAcademicYear?: string;
  defaultPeriodMode?: 'MONTHLY' | 'SEMESTER_1' | 'SEMESTER_2' | 'ANNUAL';
  hideToolbar?: boolean;
  onOpenGradeConfig?: () => void;
}

const KHMER_MONTHS = [
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

const GRADE_LETTERS: ('A' | 'B' | 'C' | 'D' | 'E' | 'F')[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
];

export const SubjectGradesAndRankingsSheet: React.FC<
  SubjectGradesAndRankingsSheetProps
> = ({
  db,
  defaultClassId = 'CLS-12C',
  defaultMonth = 'វិច្ឆិកា',
  defaultAcademicYear = '២០២៥-២០២៦',
  defaultPeriodMode = 'MONTHLY',
  hideToolbar = false,
  onOpenGradeConfig,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(defaultClassId);
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [selectedAcademicYear, setSelectedAcademicYear] =
    useState<string>(defaultAcademicYear);
  const [selectedPeriodMode, setSelectedPeriodMode] = useState<
    'MONTHLY' | 'SEMESTER_1' | 'SEMESTER_2' | 'ANNUAL'
  >(defaultPeriodMode);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showBlankRowsTo70, setShowBlankRowsTo70] = useState<boolean>(false);
  const [showGenderBreakdownInSummary, setShowGenderBreakdownInSummary] =
    useState<boolean>(true);

  useEffect(() => {
    setSelectedClassId(defaultClassId);
  }, [defaultClassId]);

  useEffect(() => {
    setSelectedMonth(defaultMonth);
  }, [defaultMonth]);

  useEffect(() => {
    setSelectedAcademicYear(defaultAcademicYear);
  }, [defaultAcademicYear]);

  useEffect(() => {
    setSelectedPeriodMode(defaultPeriodMode);
  }, [defaultPeriodMode]);

  const sheetData = useMemo(
    () =>
      buildClassSubjectGradesAndRankingsSheet(db, {
        classId: selectedClassId,
        academicYearName: selectedAcademicYear,
        monthName: selectedMonth,
        periodMode: selectedPeriodMode,
      }),
    [
      db,
      selectedClassId,
      selectedAcademicYear,
      selectedMonth,
      selectedPeriodMode,
    ]
  );

  const filteredStudentRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sheetData.studentRows;
    return sheetData.studentRows.filter(
      (r) =>
        r.fullNameKh.toLowerCase().includes(q) ||
        r.lastNameKh.toLowerCase().includes(q) ||
        r.firstNameKh.toLowerCase().includes(q) ||
        r.studentCode.toLowerCase().includes(q)
    );
  }, [sheetData.studentRows, searchQuery]);

  const blankRowNumbers = useMemo(() => {
    if (!showBlankRowsTo70 || searchQuery.trim()) return [];
    const startNo = sheetData.studentRows.length + 1;
    const endNo = Math.max(70, startNo);
    const nums: number[] = [];
    for (let n = startNo; n <= endNo; n++) {
      nums.push(n);
    }
    return nums;
  }, [showBlankRowsTo70, searchQuery, sheetData.studentRows.length]);

  const handlePrintSheet = () => {
    const docTitle = formatKhmerReportTitle({
      reportNameKh: 'និទ្ទេស និងចំណាត់ថ្នាក់តាមមុខវិជ្ជា',
      className: sheetData.className,
      academicYear: sheetData.academicYearName,
      extraContext: `ខែ${sheetData.monthName}`,
    });
    handleGlobalPrint(docTitle, 'landscape');
  };

  return (
    <div
      className="space-y-4"
      data-testid="subject-grades-rankings-sheet"
    >
      {/* Top Interactive Controls Toolbar (Hidden on Print) */}
      {!hideToolbar && (
        <div className="no-print bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#990000] text-white flex items-center justify-center font-bold shadow-2xs shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-moul">
                  និទ្ទេស និងចំណាត់ថ្នាក់តាមមុខវិជ្ជា & សរុបនិទ្ទេស A–F តាមមុខវិជ្ជា
                </h3>
                <p className="text-xs text-slate-500 font-khmer-body">
                  បង្ហាញនិទ្ទេស (និ) និងចំណាត់ថ្នាក់ (ចំ) គ្រប់មុខវិជ្ជាទាំង ១៨ ប្រអប់ រួមជាមួយតារាងសរុបនិទ្ទេស A, B, C, D, E, F (សរុប / ស្រី / ប្រុស)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onOpenGradeConfig && (
                <button
                  type="button"
                  onClick={onOpenGradeConfig}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold font-khmer-body cursor-pointer transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>កំណត់ពិន្ទុនិទ្ទេសតាមមុខវិជ្ជា</span>
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  setShowGenderBreakdownInSummary((prev) => !prev)
                }
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold font-khmer-body cursor-pointer transition-colors ${
                  showGenderBreakdownInSummary
                    ? 'border-blue-200 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>
                  {showGenderBreakdownInSummary
                    ? 'តារាងសរុប៖ បង្ហាញ ស្រី/ប្រុស ជាក់ស្ដែង'
                    : 'តារាងសរុប៖ បង្ហាញ 0 ដូចគំរូដើម'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowBlankRowsTo70((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold font-khmer-body cursor-pointer transition-colors ${
                  showBlankRowsTo70
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>
                  {showBlankRowsTo70
                    ? 'លាក់ជួរទទេ (57–70)'
                    : 'បង្ហាញជួរទទេដល់លេខ 70'}
                </span>
              </button>

              <button
                type="button"
                onClick={handlePrintSheet}
                data-testid="print-subject-grades-rankings-btn"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#002060] hover:bg-slate-900 text-white text-xs font-bold font-khmer-body cursor-pointer shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>បោះពុម្ព A4 ផ្តេក (Print)</span>
              </button>
            </div>
          </div>

          {/* Filter Row */}
          <div className="pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs font-khmer-body">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                ១. ឆ្នាំសិក្សា
              </label>
              <select
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                aria-label="ឆ្នាំសិក្សា"
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900"
              >
                <option value="២០២៥-២០២៦">២០២៥-២០២៦</option>
                <option value="២០២៦-២០២៧">២០២៦-២០២៧</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                ២. ថ្នាក់រៀន
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                aria-label="ថ្នាក់រៀន"
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900"
              >
                {db.Classes.map((c) => (
                  <option key={c.ClassID} value={c.ClassID}>
                    ថ្នាក់ទី {c.ClassName} ({c.ClassID})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                ៣. ប្រភេទលទ្ធផល
              </label>
              <select
                value={selectedPeriodMode}
                onChange={(e) =>
                  setSelectedPeriodMode(
                    e.target.value as
                      | 'MONTHLY'
                      | 'SEMESTER_1'
                      | 'SEMESTER_2'
                      | 'ANNUAL'
                  )
                }
                aria-label="ប្រភេទលទ្ធផល"
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900"
              >
                <option value="MONTHLY">ប្រចាំខែ</option>
                <option value="SEMESTER_1">ប្រចាំឆមាសទី ១</option>
                <option value="SEMESTER_2">ប្រចាំឆមាសទី ២</option>
                <option value="ANNUAL">ប្រចាំឆ្នាំ</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                ៤. ខែប្រឡង
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="ខែប្រឡង"
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900"
              >
                {KHMER_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    ខែ {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                ៥. ស្វែងរកសិស្សក្នុងតារាង
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ស្វែងរកឈ្មោះ ឬអត្តលេខ..."
                  aria-label="ស្វែងរកសិស្សក្នុងតារាង"
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-khmer-body"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          OFFICIAL MoEYS SUBJECT GRADES & RANKINGS PRINTABLE SHEET
          ===================================================================== */}
      <div className="bg-white rounded-xl border-2 border-slate-300 shadow-xs p-3 sm:p-4 overflow-x-auto print:border-0 print:shadow-none print:p-0">
        <div className="w-full min-w-[940px] space-y-4">
          {/* 1. Official Cambodian Kingdom & School Header */}
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-4">
              {/* Left: Province, District, School in Khmer Moul */}
              <div className="font-khmer-moul text-slate-950 text-xs sm:text-[13px] leading-relaxed space-y-0.5">
                <div>{sheetData.provinceHeaderKh}</div>
                <div>{sheetData.districtHeaderKh}</div>
                <div>{sheetData.schoolNameKh}</div>
              </div>

              {/* Right: Kingdom & Motto in Khmer Moul */}
              <div className="font-khmer-moul text-slate-950 text-xs sm:text-[13px] text-center leading-relaxed space-y-0.5 pr-2 shrink-0">
                <div>ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              </div>
            </div>

            {/* Center Blue Report Title */}
            <div className="text-center pt-1 pb-1">
              <h1
                className="font-khmer-moul text-sm sm:text-base text-[#002060] tracking-wide"
                data-testid="subject-grades-rankings-title"
              >
                {selectedPeriodMode === 'ANNUAL'
                  ? `និទ្ទេស និងចំណាត់ថ្នាក់តាមមុខវិជ្ជា ប្រចាំឆ្នាំ / ថ្នាក់ទី ${sheetData.className} / ឆ្នាំសិក្សា៖ ${sheetData.academicYearName}`
                  : `និទ្ទេស និងចំណាត់ថ្នាក់តាមមុខវិជ្ជា ប្រចាំ ខែ ${sheetData.monthName} / ថ្នាក់ទី ${sheetData.className} / ឆ្នាំសិក្សា៖ ${sheetData.academicYearName}`}
              </h1>
            </div>
          </div>

          {/* 2. Main 18-Subject Grades (និ) & Rankings (ចំ) Table */}
          <table
            className="w-full border-collapse border-[1.5px] border-[#002060] text-[10.5px] font-khmer-body select-text"
            data-testid="subject-grades-rankings-main-table"
          >
            <thead>
              {/* Header Row 1: Left student columns + 18 Vertical Subject Headers + Right overall columns */}
              <tr>
                <th
                  rowSpan={2}
                  className="border border-[#002060] bg-[#002060] text-white font-khmer-moul text-[10px] px-1 py-1.5 text-center w-[26px]"
                >
                  ល.រ
                </th>
                <th
                  rowSpan={2}
                  className="border border-[#002060] bg-[#002060] text-white font-khmer-moul text-[10px] px-1 py-1.5 text-center w-[38px]"
                >
                  អត្តលេខ
                </th>
                <th
                  colSpan={2}
                  rowSpan={2}
                  className="border border-[#002060] bg-[#002060] text-white font-khmer-moul text-[10px] px-1.5 py-1.5 text-center min-w-[112px]"
                >
                  គោត្តនាម និងនាម
                </th>
                <th
                  rowSpan={2}
                  className="border border-[#002060] bg-[#002060] text-white font-khmer-moul text-[10px] px-1 py-1.5 text-center w-[30px]"
                >
                  ភេទ
                </th>

                {/* 18 Subject Columns (each colSpan=2 for និ & ចំ) */}
                {sheetData.subjectSlots.map((slot, idx) => (
                  <th
                    key={slot.SlotID}
                    colSpan={2}
                    className="border border-[#002060] bg-[#990000] text-white font-khmer-moul text-[9.5px] px-0.5 py-1 text-center align-middle h-[88px] w-[32px]"
                    title={
                      slot.SubjectNameKh || `មុខវិជ្ជាបន្ថែមទី ${idx + 1}`
                    }
                  >
                    <div className="h-[78px] flex items-center justify-center mx-auto">
                      <span className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap tracking-wide leading-none">
                        {slot.SubjectNameKh || ''}
                      </span>
                    </div>
                  </th>
                ))}

                {/* Rightmost 3 Overall Summary Columns */}
                <th
                  rowSpan={2}
                  className="border border-[#002060] bg-[#990000] text-white font-khmer-moul text-[9.5px] px-0.5 py-1 text-center w-[28px]"
                >
                  <div className="h-[88px] flex items-center justify-center mx-auto">
                    <span className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap leading-tight">
                      ចំ.ថ្នាក់រួម
                    </span>
                  </div>
                </th>
                <th
                  rowSpan={2}
                  className="border border-[#002060] bg-[#990000] text-white font-khmer-moul text-[9.5px] px-0.5 py-1 text-center w-[30px]"
                >
                  <div className="h-[88px] flex items-center justify-center mx-auto">
                    <span className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap leading-tight">
                      និទ្ទេសរួម
                    </span>
                  </div>
                </th>
                <th
                  rowSpan={2}
                  className="border border-[#002060] bg-[#990000] text-white font-khmer-moul text-[9.5px] px-1 py-1 text-center w-[36px]"
                >
                  <div className="leading-tight">
                    <div>លទ្ធ</div>
                    <div>ផល</div>
                  </div>
                </th>
              </tr>

              {/* Header Row 2: 18 pairs of និ (Grade) & ចំ (Rank) */}
              <tr>
                {sheetData.subjectSlots.map((slot) => (
                  <React.Fragment key={`${slot.SlotID}-sub`}>
                    <th className="border border-[#002060] bg-[#990000] text-[#ffff00] font-extrabold text-[9.5px] py-0.5 px-0 text-center w-[16px]">
                      និ
                    </th>
                    <th className="border border-[#002060] bg-[#990000] text-[#ffff00] font-extrabold text-[9.5px] py-0.5 px-0 text-center w-[16px]">
                      ចំ
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredStudentRows.map((row) => (
                <tr
                  key={row.studentId}
                  className="hover:bg-blue-50/40 transition-colors h-[24px]"
                >
                  {/* ល.រ */}
                  <td className="border border-[#002060] text-center font-mono-tabular font-bold text-[#002060] px-1 py-0.5">
                    {row.rowNo}
                  </td>

                  {/* អត្តលេខ (Red bold) */}
                  <td className="border border-[#002060] text-center font-mono-tabular font-extrabold text-[#dc2626] px-1 py-0.5">
                    {row.studentCode}
                  </td>

                  {/* គោត្តនាម (Last Name) */}
                  <td className="border-y border-l border-r-0 border-[#002060] text-left font-bold text-slate-950 pl-1.5 pr-1 py-0.5 whitespace-nowrap">
                    {row.lastNameKh}
                  </td>

                  {/* នាម (First Name) */}
                  <td className="border-y border-r border-l-0 border-[#002060] text-left font-bold text-slate-950 pl-1 pr-1.5 py-0.5 whitespace-nowrap">
                    {row.firstNameKh}
                  </td>

                  {/* ភេទ */}
                  <td className="border border-[#002060] text-center font-semibold text-slate-900 px-1 py-0.5">
                    {row.gender}
                  </td>

                  {/* 18 Subject Pairs: [និ | ចំ] */}
                  {row.subjectCells.map((cell) => (
                    <React.Fragment key={`${row.studentId}-${cell.slotId}`}>
                      <td className="border border-[#002060] text-center font-mono-tabular font-extrabold text-slate-950 px-0.5 py-0.5">
                        {cell.grade}
                      </td>
                      <td className="border border-[#002060] text-center font-mono-tabular font-extrabold text-[#dc2626] px-0.5 py-0.5">
                        {cell.rank !== null ? cell.rank : ''}
                      </td>
                    </React.Fragment>
                  ))}

                  {/* ចំ.ថ្នាក់រួម (Overall Rank in Red) */}
                  <td className="border border-[#002060] text-center font-mono-tabular font-extrabold text-[#dc2626] px-1 py-0.5">
                    {row.overallRank}
                  </td>

                  {/* និទ្ទេសរួម (Overall Grade in Dark Blue) */}
                  <td className="border border-[#002060] text-center font-extrabold text-[#002060] px-0.5 py-0.5 whitespace-nowrap text-[10px]">
                    {row.overallGrade === 'មិនចាត់ថ្នាក់'
                      ? 'មិនចាត់ថ្នាក់'
                      : row.overallGrade}
                  </td>

                  {/* លទ្ធផល (ជាប់ / ធ្លាក់) */}
                  <td
                    className={`border border-[#002060] text-center font-bold px-1 py-0.5 whitespace-nowrap ${
                      row.resultStatusKh === 'ជាប់'
                        ? 'text-slate-950'
                        : 'text-slate-900'
                    }`}
                  >
                    {row.resultStatusKh}
                  </td>
                </tr>
              ))}

              {/* Optional Empty Rows 57..70 matching Page 3 of the PDF */}
              {blankRowNumbers.map((num) => (
                <tr key={`blank-${num}`} className="h-[22px]">
                  <td className="border border-[#002060] text-center font-mono-tabular font-bold text-[#002060] px-1 py-0.5">
                    {num}
                  </td>
                  <td className="border border-[#002060]" />
                  <td className="border-y border-l border-r-0 border-[#002060]" />
                  <td className="border-y border-r border-l-0 border-[#002060]" />
                  <td className="border border-[#002060]" />
                  {sheetData.subjectSlots.map((slot) => (
                    <React.Fragment key={`blank-${num}-${slot.SlotID}`}>
                      <td className="border border-[#002060]" />
                      <td className="border border-[#002060]" />
                    </React.Fragment>
                  ))}
                  <td className="border border-[#002060]" />
                  <td className="border border-[#002060]" />
                  <td className="border border-[#002060]" />
                </tr>
              ))}
            </tbody>
          </table>

          {/* 3. Stop Roster Line ("បញ្ឈប់បញ្ជីឈ្មោះសិស្សត្រឹមចំនួន 56") */}
          <div
            className="flex flex-wrap items-center gap-4 text-xs font-khmer-body font-bold text-[#002060] pl-1 pt-0.5"
            data-testid="subject-grades-stop-roster-line"
          >
            <span>បញ្ឈប់បញ្ជីឈ្មោះសិស្សត្រឹមចំនួន</span>
            <span className="font-mono-tabular font-extrabold text-slate-950">
              {sheetData.totalStudents}
            </span>
            <span className="text-slate-700">
              នាក់ (ស្រី៖{' '}
              <strong className="font-mono-tabular text-[#002060]">
                {sheetData.femaleStudents}
              </strong>{' '}
              នាក់ • ប្រុស៖{' '}
              <strong className="font-mono-tabular text-[#008000]">
                {sheetData.maleStudents}
              </strong>{' '}
              នាក់)
            </span>
          </div>

          {/* 4. Bottom 18-Row Per-Subject A–F Grade Distribution Summary Table (`និទ្ទេស => A | B | C | D | E | F`) */}
          <div className="max-w-[1120px]">
            <table
              className="w-full border-collapse border-[1.5px] border-slate-900 text-xs font-khmer-body"
              data-testid="subject-grades-distribution-summary-table"
            >
              <thead>
                {/* Summary Header Row 1: និទ្ទេស => | A | B | C | D | E | F */}
                <tr className="bg-white">
                  <th className="border border-slate-800 px-3 py-1.5 text-center font-khmer-moul text-slate-950 w-[135px]">
                    និទ្ទេស =&gt;
                  </th>
                  {GRADE_LETTERS.map((g) => (
                    <th
                      key={`sum-hdr-${g}`}
                      colSpan={3}
                      className="border border-slate-800 px-2 py-1.5 text-center font-mono-tabular font-extrabold text-sm text-slate-950"
                    >
                      {g}
                    </th>
                  ))}
                </tr>

                {/* Summary Header Row 2: មុខវិជ្ជា | សរុប | ស្រី | ប្រុស (x6) */}
                <tr className="bg-[#ffffcc]">
                  <th className="border border-slate-800 px-3 py-1.5 text-center font-khmer-moul text-slate-950">
                    មុខវិជ្ជា
                  </th>
                  {GRADE_LETTERS.map((g) => (
                    <React.Fragment key={`sum-subhdr-${g}`}>
                      <th className="border border-slate-800 px-1.5 py-1 text-center font-bold text-slate-900 w-[48px]">
                        សរុប
                      </th>
                      <th className="border border-slate-800 px-1.5 py-1 text-center font-bold text-slate-900 w-[48px]">
                        ស្រី
                      </th>
                      <th className="border border-slate-800 px-1.5 py-1 text-center font-bold text-slate-900 w-[48px]">
                        ប្រុស
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>

              <tbody>
                {sheetData.summaryRows.map((sRow) => (
                  <tr
                    key={`sum-row-${sRow.slotId}`}
                    className="hover:bg-amber-50/30 h-[26px]"
                  >
                    <td className="border border-slate-800 px-2.5 py-1 text-center font-bold text-slate-950">
                      {sRow.subjectNameKh || ''}
                    </td>
                    {GRADE_LETTERS.map((g) => {
                      const counts = sRow.countsByGrade[g];
                      const femaleVal = showGenderBreakdownInSummary
                        ? counts.female
                        : 0;
                      const maleVal = showGenderBreakdownInSummary
                        ? counts.male
                        : 0;
                      return (
                        <React.Fragment key={`sum-cell-${sRow.slotId}-${g}`}>
                          {/* សរុប (Red bold) */}
                          <td className="border border-slate-800 px-1 py-1 text-center font-mono-tabular font-extrabold text-[#dc2626]">
                            {counts.total}
                          </td>
                          {/* ស្រី (Blue bold) */}
                          <td className="border border-slate-800 px-1 py-1 text-center font-mono-tabular font-bold text-[#002060]">
                            {femaleVal}
                          </td>
                          {/* ប្រុស (Green bold) */}
                          <td className="border border-slate-800 px-1 py-1 text-center font-mono-tabular font-bold text-[#008000]">
                            {maleVal}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 5. Official MoEYS Signature Footer (Page 4 Layout) */}
          <div className="pt-4 pb-8 grid grid-cols-2 gap-8 max-w-[1050px] text-xs font-khmer-body text-slate-950">
            {/* Left: School Principal */}
            <div className="pl-12 pt-4 text-center max-w-[260px] space-y-1.5">
              <div className="font-khmer-moul text-xs text-slate-950">
                បានឃើញ និងឯកភាព
              </div>
              <div className="font-khmer-moul text-xs text-slate-950">
                នាយកសាលា
              </div>
            </div>

            {/* Right: Lunar Date, Solar Date, Homeroom Teacher */}
            <div className="text-center ml-auto pr-8 space-y-1">
              <div className="text-slate-900 font-semibold">
                {sheetData.lunarDateText}
              </div>
              <div className="text-slate-900 font-semibold">
                {sheetData.solarDateText}
              </div>
              <div className="font-khmer-moul text-xs text-[#002060] pt-1">
                គ្រូទទួលបន្ទុកថ្នាក់
              </div>
              <div className="pt-10 font-bold text-slate-950">
                {sheetData.homeroomTeacherNameKh}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
