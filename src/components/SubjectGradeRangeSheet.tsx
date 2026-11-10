import React, { useEffect, useMemo, useState } from 'react';
import {
  DatabaseState,
  GradingScaleRecord,
  SubjectGradeRangeRecord,
} from '../types/database';
import {
  computeSubjectThresholdsFromMaxScore,
  createDefaultSubjectGradeRanges,
  getSubjectGradeRangesFromDb,
  saveSubjectGradeRangesConfiguration,
} from '../lib/subjectGradeRanges';
import { DataService } from '../lib/centralizedDataService';
import { handleGlobalPrint } from '../utils/printHelper';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';

interface SubjectGradeRangeSheetProps {
  db: DatabaseState;
  setDb: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  showOverallScaleSection?: boolean;
  onSaveOverallGradingScales?: (scales: GradingScaleRecord[]) => void;
}

const GRADE_KEYS: Array<{
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  field:
    | 'GradeAThreshold'
    | 'GradeBThreshold'
    | 'GradeCThreshold'
    | 'GradeDThreshold'
    | 'GradeEThreshold'
    | 'GradeFThreshold';
  operator: '>=' | '<=';
  isFail?: boolean;
}> = [
  { grade: 'A', field: 'GradeAThreshold', operator: '>=' },
  { grade: 'B', field: 'GradeBThreshold', operator: '>=' },
  { grade: 'C', field: 'GradeCThreshold', operator: '>=' },
  { grade: 'D', field: 'GradeDThreshold', operator: '>=' },
  { grade: 'E', field: 'GradeEThreshold', operator: '>=' },
  { grade: 'F', field: 'GradeFThreshold', operator: '<=', isFail: true },
];

export const SubjectGradeRangeSheet: React.FC<SubjectGradeRangeSheetProps> = ({
  db,
  setDb,
  activeUserId,
  showOverallScaleSection = true,
  onSaveOverallGradingScales,
}) => {
  const initialRanges = useMemo(() => getSubjectGradeRangesFromDb(db), [db]);
  const [slotsDraft, setSlotsDraft] = useState<SubjectGradeRangeRecord[]>(() =>
    initialRanges.map((r) => ({ ...r }))
  );
  const [overallScalesDraft, setOverallScalesDraft] = useState<GradingScaleRecord[]>(
    () => db.GradingScales.map((g) => ({ ...g }))
  );
  const [activeMode, setActiveMode] = useState<'SUBJECT_SHEET' | 'OVERALL_SCALE'>(
    'SUBJECT_SHEET'
  );
  const [banner, setBanner] = useState<{
    type: 'SUCCESS' | 'ERROR';
    messageKh: string;
  } | null>(null);

  useEffect(() => {
    setSlotsDraft(getSubjectGradeRangesFromDb(db).map((r) => ({ ...r })));
  }, [db.SubjectGradeRanges]);

  const pairedRows = useMemo(() => {
    const rows: Array<{
      rowIndex: number;
      left: SubjectGradeRangeRecord;
      right: SubjectGradeRangeRecord;
    }> = [];
    for (let r = 1; r <= 9; r++) {
      const left =
        slotsDraft.find((s) => s.ColumnSide === 'LEFT' && s.RowIndex === r) ||
        createDefaultSubjectGradeRanges()[r - 1];
      const right =
        slotsDraft.find((s) => s.ColumnSide === 'RIGHT' && s.RowIndex === r) ||
        createDefaultSubjectGradeRanges()[r + 8];
      rows.push({ rowIndex: r, left, right });
    }
    return rows;
  }, [slotsDraft]);

  const handleUpdateThreshold = (
    slotId: string,
    field:
      | 'GradeAThreshold'
      | 'GradeBThreshold'
      | 'GradeCThreshold'
      | 'GradeDThreshold'
      | 'GradeEThreshold'
      | 'GradeFThreshold',
    rawVal: string
  ) => {
    const parsed = rawVal.trim() === '' ? null : Number(rawVal);
    setSlotsDraft((prev) =>
      prev.map((slot) =>
        slot.SlotID === slotId
          ? {
              ...slot,
              [field]: parsed !== null && !Number.isNaN(parsed) ? parsed : null,
            }
          : slot
      )
    );
  };

  const handleUpdateSubjectName = (slotId: string, nameKh: string) => {
    setSlotsDraft((prev) =>
      prev.map((slot) =>
        slot.SlotID === slotId ? { ...slot, SubjectNameKh: nameKh } : slot
      )
    );
  };

  const handleApplyMaxScorePreset = (slotId: string, maxScore: number | null) => {
    setSlotsDraft((prev) =>
      prev.map((slot) => {
        if (slot.SlotID !== slotId) return slot;
        if (maxScore === null) {
          return {
            ...slot,
            MaximumScore: null,
            GradeAThreshold: null,
            GradeBThreshold: null,
            GradeCThreshold: null,
            GradeDThreshold: null,
            GradeEThreshold: null,
            GradeFThreshold: null,
          };
        }
        const computed = computeSubjectThresholdsFromMaxScore(maxScore);
        return {
          ...slot,
          MaximumScore: maxScore,
          ...computed,
        };
      })
    );
  };

  const handleResetDefaultSheet = () => {
    const defaults = createDefaultSubjectGradeRanges('AY-2025-2026');
    setSlotsDraft(defaults);
    setBanner({
      type: 'SUCCESS',
      messageKh:
        'បានកំណត់តារាងពិន្ទុនិទ្ទេសសម្រាប់មុខវិជ្ជានីមួយៗតាមគម្រូដើមក្រសួង (១២៥ / ៧៥ / ៥០) ឡើងវិញ។ សូមចុច "រក្សាទុក" ដើម្បីអនុវត្ត។',
    });
  };

  const handleSaveSubjectGradeRanges = () => {
    const res = saveSubjectGradeRangesConfiguration(db, slotsDraft, activeUserId);
    if (!res.ok) {
      setBanner({ type: 'ERROR', messageKh: res.messageKh });
      return;
    }
    DataService.commitState(setDb, res.updatedDb);
    setBanner({ type: 'SUCCESS', messageKh: res.messageKh });
  };

  const renderSubjectBlock = (slot: SubjectGradeRangeRecord) => {
    return (
      <div
        key={slot.SlotID}
        data-testid={`subject-grade-block-${slot.SlotID}`}
        className="border-[1.5px] border-black bg-white overflow-hidden shadow-2xs"
      >
        {/* 1. GREEN SUBJECT HEADER BAR (#00b050) */}
        <div className="bg-[#00b050] border-b-[1.5px] border-black px-2 py-1 flex items-center justify-between gap-1.5 min-h-[34px]">
          <input
            type="text"
            value={slot.SubjectNameKh}
            onChange={(e) => handleUpdateSubjectName(slot.SlotID, e.target.value)}
            placeholder="បញ្ចូលឈ្មោះមុខវិជ្ជា..."
            aria-label={`ឈ្មោះមុខវិជ្ជា ${slot.SlotID}`}
            className="w-full bg-transparent text-center font-extrabold text-white placeholder:text-white/60 text-xs sm:text-sm font-khmer-moul focus:outline-none focus:bg-black/15 rounded px-1"
          />
          {/* Quick Max Score Auto-Fill Buttons (Hidden when printing) */}
          <div className="no-print flex items-center gap-0.5 shrink-0">
            {[125, 75, 50].map((presetMax) => (
              <button
                key={presetMax}
                type="button"
                onClick={() => handleApplyMaxScorePreset(slot.SlotID, presetMax)}
                title={`កំណត់ស្វ័យប្រវត្តិតាមពិន្ទុពេញ ${presetMax}`}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono-tabular font-extrabold transition-colors cursor-pointer ${
                  slot.MaximumScore === presetMax
                    ? 'bg-yellow-300 text-black shadow-2xs'
                    : 'bg-black/20 hover:bg-black/35 text-white'
                }`}
              >
                {presetMax}
              </button>
            ))}
          </div>
        </div>

        {/* 2. GRADE LETTERS ROW (A, B, C, D, E in Yellow #ffff00; F in Red #ff0000) */}
        <div className="grid grid-cols-6 border-b-[1.5px] border-black">
          {GRADE_KEYS.map((g, gIdx) => (
            <div
              key={g.grade}
              className={`py-1 text-center font-serif font-extrabold text-xs sm:text-sm select-none ${
                gIdx < 5 ? 'border-r-[1.5px] border-black' : ''
              } ${
                g.isFail
                  ? 'bg-[#ff0000] text-white'
                  : 'bg-[#ffff00] text-black'
              }`}
            >
              {g.grade}
            </div>
          ))}
        </div>

        {/* 3. THRESHOLD VALUES + OPERATOR (>= / <=) + DIAGONAL RED SLASH ROW */}
        <div className="grid grid-cols-6 bg-white">
          {GRADE_KEYS.map((g, gIdx) => {
            const val = slot[g.field];
            return (
              <div
                key={g.grade}
                className={`grid grid-cols-12 items-stretch min-h-[30px] ${
                  gIdx < 5 ? 'border-r-[1.5px] border-black' : ''
                }`}
              >
                {/* Sub-cell 1: Editable Threshold Number (6/12 cols) */}
                <div className="col-span-6 border-r border-black flex items-center justify-center bg-white">
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={500}
                    value={val === null || val === undefined ? '' : val}
                    onChange={(e) =>
                      handleUpdateThreshold(slot.SlotID, g.field, e.target.value)
                    }
                    aria-label={`${slot.SubjectNameKh || slot.SlotID} និទ្ទេស ${g.grade}`}
                    className="w-full h-full text-center font-mono-tabular font-extrabold text-[11px] sm:text-xs text-[#002060] bg-transparent focus:bg-yellow-50 focus:outline-none px-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                {/* Sub-cell 2: Operator >= or <= (3/12 cols) */}
                <div className="col-span-3 border-r border-black flex items-center justify-center bg-white font-mono-tabular font-extrabold text-[10px] sm:text-[11px] text-[#002060] select-none">
                  {g.operator}
                </div>

                {/* Sub-cell 3: Diagonal Red Slash Cell (3/12 cols) */}
                <div
                  className="col-span-3 relative bg-white overflow-hidden select-none"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="w-full h-full block"
                  >
                    <line
                      x1="0"
                      y1="100"
                      x2="100"
                      y2="0"
                      stroke="#dc2626"
                      strokeWidth="5"
                    />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4" data-testid="subject-grade-range-sheet">
      {/* Top Control Bar (Hidden when printing) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 no-print">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-moul">
              កំណត់ពិន្ទុនិទ្ទេសសម្រាប់មុខវិជ្ជានីមួយៗ (Per-Subject Grade Configuration)
            </h3>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold font-khmer-body">
              គម្រូស្តង់ដារក្រសួងអប់រំ (A, B, C, D, E, F)
            </span>
          </div>
          <p className="text-xs text-slate-600 font-khmer-body">
            អ្នកអាចកែប្រែពិន្ទុនិទ្ទេសតាមមុខវិជ្ជានីមួយៗដោយផ្ទាល់នៅក្នុងក្រឡាខាងក្រោម ឬចុចប៊ូតុង <strong className="font-mono-tabular">125 / 75 / 50</strong> លើរបារពណ៌បៃតងដើម្បីគណនាស្វ័យប្រវត្តិ។
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {showOverallScaleSection && (
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setActiveMode('SUBJECT_SHEET')}
                data-testid="grade-mode-subject-sheet-btn"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-khmer-body transition-all cursor-pointer ${
                  activeMode === 'SUBJECT_SHEET'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                តារាងនិទ្ទេសតាមមុខវិជ្ជា (១៨ ប្រអប់)
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('OVERALL_SCALE')}
                data-testid="grade-mode-overall-scale-btn"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-khmer-body transition-all cursor-pointer ${
                  activeMode === 'OVERALL_SCALE'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                មាត្រដ្ឋានមធ្យមភាគរួម (/50)
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleResetDefaultSheet}
            data-testid="reset-subject-grade-sheet-btn"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold font-khmer-body text-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>កំណត់ដើមវិញ</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleGlobalPrint(
                'កំណត់ពិន្ទុនិទ្ទេសសម្រាប់មុខវិជ្ជានីមួយៗ_វិទ្យាល័យទឹកជោរ',
                'landscape'
              )
            }
            data-testid="print-subject-grade-sheet-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold font-khmer-body text-slate-800 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>បោះពុម្ព (Print A4)</span>
          </button>

          <button
            type="button"
            onClick={handleSaveSubjectGradeRanges}
            data-testid="save-subject-grade-sheet-btn"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00b050] hover:bg-[#009944] text-white text-xs font-bold font-khmer-body cursor-pointer shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>រក្សាទុកការកំណត់និទ្ទេស</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 no-print ${
            banner.type === 'SUCCESS'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold font-khmer-body">
            {banner.type === 'SUCCESS' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{banner.messageKh}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs font-bold underline cursor-pointer shrink-0"
          >
            បិទ
          </button>
        </div>
      )}

      {activeMode === 'SUBJECT_SHEET' ? (
        /* =====================================================================
           OFFICIAL MOEYS PER-SUBJECT GRADE SHEET (Exact Match to Attached PDF)
           ===================================================================== */
        <div className="bg-white rounded-2xl border-2 border-slate-900 p-4 sm:p-6 shadow-xs print-sheet">
          {/* Official Centered Title & Blue Note from PDF */}
          <div className="text-center space-y-1.5 mb-4">
            <h2 className="text-lg sm:text-2xl font-extrabold text-black font-khmer-moul tracking-wide">
              កំណត់ពិន្ទុនិទ្ទេសសម្រាប់មុខវិជ្ជានីមួយៗ
            </h2>
            <p className="text-xs sm:text-sm font-extrabold text-[#002060] font-khmer-body leading-relaxed max-w-5xl mx-auto">
              <span className="text-red-600 font-extrabold">*</span>
              បញ្ជាក់បើសិនជាចង់អោយនិទ្ទេសចេញតាមមុខវិជ្ជានីមួយៗក្នុងបញ្ជីនិទ្ទេស និងចំណាត់ថ្នាក់ សូមបញ្ចូលពិន្ទុក្នុងបញ្ជីបញ្ចូលពិន្ទុសិស្សជាមុនសិន បន្ទាប់មកកំណត់ពិន្ទុនិទ្ទេសនៃមុខវិជ្ជានីមួយៗ ក្នុងបញ្ជីនេះ។ សូមកំណត់ពីឆ្វេងទៅស្ដាំ(ពីធំទៅតូច)
            </p>
          </div>

          {/* 9-Row x 2-Column Grid of Subject Grade Blocks */}
          <div className="space-y-3">
            {pairedRows.map((pair) => (
              <div
                key={pair.rowIndex}
                className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-5 items-start break-inside-avoid"
              >
                {renderSubjectBlock(pair.left)}
                {renderSubjectBlock(pair.right)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* =====================================================================
           SECONDARY VIEW: OVERALL CLASS AVERAGE GRADING SCALE (/50)
           ===================================================================== */
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>មាត្រដ្ឋាននិទ្ទេសមធ្យមភាគរួមប្រចាំខែ ឆមាស និងប្រចាំឆ្នាំ (៥០ ពិន្ទុ)</span>
              </h4>
              <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                ប្រើសម្រាប់គណនានិទ្ទេសមធ្យមភាគរួមរបស់សិស្សនៅក្នុងតារាងពិន្ទុតាមថ្នាក់រៀន។
              </p>
            </div>
            {onSaveOverallGradingScales && (
              <button
                type="button"
                onClick={() => {
                  onSaveOverallGradingScales(overallScalesDraft);
                  setBanner({
                    type: 'SUCCESS',
                    messageKh:
                      'បានរក្សាទុកមាត្រដ្ឋាននិទ្ទេសមធ្យមភាគរួម (/50) ដោយជោគជ័យ!',
                  });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-khmer-body cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>រក្សាទុកមាត្រដ្ឋានរួម (/50)</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-khmer-body">
                  <th className="py-2.5 px-3 text-center">និទ្ទេស (Grade)</th>
                  <th className="py-2.5 px-3 text-center">ពិន្ទុមធ្យមភាគអប្បបរមា (Min)</th>
                  <th className="py-2.5 px-3 text-center">ពិន្ទុមធ្យមភាគអតិបរមា (Max)</th>
                  <th className="py-2.5 px-3">ការវាយតម្លៃ / និយមន័យ (Description)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                {overallScalesDraft.map((scale, index) => (
                  <tr
                    key={scale.GradingScaleID || scale.Grade}
                    className="hover:bg-slate-50/70"
                  >
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-mono-tabular font-extrabold text-sm">
                        {scale.Grade}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number"
                        step="0.01"
                        value={scale.MinimumScore}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setOverallScalesDraft((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, MinimumScore: val } : item
                            )
                          );
                        }}
                        className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 text-center font-mono-tabular font-bold"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number"
                        step="0.01"
                        value={scale.MaximumScore}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setOverallScalesDraft((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, MaximumScore: val } : item
                            )
                          );
                        }}
                        className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 text-center font-mono-tabular font-bold"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={scale.Description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOverallScalesDraft((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, Description: val } : item
                            )
                          );
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-khmer-body"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
