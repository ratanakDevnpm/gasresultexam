import React, { useMemo, useState } from 'react';
import {
  DatabaseState,
  GradingScaleRecord,
  SubjectManagementSubMenuId,
  SubjectRecord,
} from '../types/database';
import {
  canAccessSubjectManagement,
  getUserEffectiveRoles,
  saveGradeRangeConfiguration,
  saveSubjectAcademicConfiguration,
  SUBJECT_MANAGEMENT_SUBMENUS,
} from '../lib/domainRules';
import { DataService } from '../lib/centralizedDataService';
import { TeacherManagementView } from './TeacherManagementView';
import { SubjectGradeRangeSheet } from './SubjectGradeRangeSheet';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Edit3,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sliders,
  UserCheck,
} from 'lucide-react';

interface SubjectManagementViewProps {
  db: DatabaseState;
  setDb: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  activeSubMenu: SubjectManagementSubMenuId;
  onSubMenuChange: (sub: SubjectManagementSubMenuId) => void;
  onSelectUser?: (userId: string) => void;
  onNavigateSection?: (section: string) => void;
}

export const SubjectManagementView: React.FC<SubjectManagementViewProps> = ({
  db,
  setDb,
  activeUserId,
  activeSubMenu,
  onSubMenuChange,
  onSelectUser,
  onNavigateSection,
}) => {
  const accessDecision = useMemo(
    () => canAccessSubjectManagement(db, activeUserId, activeSubMenu),
    [db, activeUserId, activeSubMenu]
  );
  const roleSummary = useMemo(
    () => getUserEffectiveRoles(db, activeUserId),
    [db, activeUserId]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'SUCCESS' | 'ERROR';
    messageKh: string;
  } | null>(null);

  // Add / Edit Subject Modal or Form State (for SUBJECT_LIST)
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formNameKh, setFormNameKh] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formGradeLevel, setFormGradeLevel] = useState('7-12');
  const [formMaxScore, setFormMaxScore] = useState<number>(100);
  const [formPassingScore, setFormPassingScore] = useState<number>(50);
  const [formCoefficient, setFormCoefficient] = useState<number>(2);
  const [formAcademicYearId, setFormAcademicYearId] = useState('AY-2025-2026');
  const [formSemesterIds, setFormSemesterIds] = useState<string[]>(['SEM-2526-1', 'SEM-2526-2']);
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Inline states for Academic Config, Max Score Config, Coefficient Config, Grade Range Config
  const [academicDrafts, setAcademicDrafts] = useState<
    Record<string, { academicYearId: string; gradeLevel: string; semesterIds: string[]; status: 'ACTIVE' | 'INACTIVE' }>
  >({});
  const [maxScoreDrafts, setMaxScoreDrafts] = useState<
    Record<string, { maxScore: number; passingScore: number }>
  >({});
  const [coeffDrafts, setCoeffDrafts] = useState<Record<string, number>>({});
  const [gradingScalesDraft, setGradingScalesDraft] = useState<GradingScaleRecord[]>(
    () => db.GradingScales.map((g) => ({ ...g }))
  );

  const filteredSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return db.Subjects.filter((s) => {
      if (statusFilter !== 'ALL' && s.Status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.SubjectCode.toLowerCase().includes(q) ||
        s.SubjectNameKh.toLowerCase().includes(q) ||
        s.SubjectNameEn.toLowerCase().includes(q) ||
        s.SubjectID.toLowerCase().includes(q)
      );
    });
  }, [db.Subjects, searchQuery, statusFilter]);

  const handleLoadSubjectIntoForm = (sub: SubjectRecord) => {
    setEditingSubjectId(sub.SubjectID);
    setFormCode(sub.SubjectCode);
    setFormNameKh(sub.SubjectNameKh);
    setFormNameEn(sub.SubjectNameEn);
    setFormGradeLevel(sub.GradeLevel || '7-12');
    setFormMaxScore(sub.MaximumScore);
    setFormPassingScore(sub.PassingScore ?? Number((sub.MaximumScore / 2).toFixed(1)));
    setFormCoefficient(sub.Coefficient);
    setFormAcademicYearId(sub.AcademicYearID || 'AY-2025-2026');
    setFormSemesterIds(sub.SemesterIDs || ['SEM-2526-1', 'SEM-2526-2']);
    setFormStatus(sub.Status);
    setFeedbackBanner(null);
  };

  const handleResetSubjectForm = () => {
    setEditingSubjectId(null);
    setFormCode('');
    setFormNameKh('');
    setFormNameEn('');
    setFormGradeLevel('7-12');
    setFormMaxScore(100);
    setFormPassingScore(50);
    setFormCoefficient(2);
    setFormAcademicYearId('AY-2025-2026');
    setFormSemesterIds(['SEM-2526-1', 'SEM-2526-2']);
    setFormStatus('ACTIVE');
  };

  const handleSubmitSubjectForm = (e: React.FormEvent) => {
    e.preventDefault();
    const res = saveSubjectAcademicConfiguration(
      db,
      {
        subjectId: editingSubjectId || undefined,
        subjectCode: formCode,
        subjectNameKh: formNameKh,
        subjectNameEn: formNameEn || formNameKh,
        gradeLevel: formGradeLevel,
        maximumScore: Number(formMaxScore),
        passingScore: Number(formPassingScore),
        coefficient: Number(formCoefficient),
        academicYearId: formAcademicYearId,
        semesterIds: formSemesterIds,
        status: formStatus,
      },
      activeUserId
    );

    if (!res.ok) {
      setFeedbackBanner({ type: 'ERROR', messageKh: res.messageKh });
      return;
    }

    DataService.commitState(setDb, res.updatedDb);
    setFeedbackBanner({ type: 'SUCCESS', messageKh: res.messageKh });
    if (!editingSubjectId) {
      handleResetSubjectForm();
    }
  };

  const handleQuickSaveSubjectRow = (sub: SubjectRecord, overrides: Partial<{
    gradeLevel: string;
    academicYearId: string;
    semesterIds: string[];
    maximumScore: number;
    passingScore: number;
    coefficient: number;
    status: 'ACTIVE' | 'INACTIVE';
  }>) => {
    const res = saveSubjectAcademicConfiguration(
      db,
      {
        subjectId: sub.SubjectID,
        subjectCode: sub.SubjectCode,
        subjectNameKh: sub.SubjectNameKh,
        subjectNameEn: sub.SubjectNameEn,
        gradeLevel: overrides.gradeLevel ?? sub.GradeLevel,
        maximumScore: overrides.maximumScore ?? sub.MaximumScore,
        passingScore:
          overrides.passingScore ??
          sub.PassingScore ??
          Number(((overrides.maximumScore ?? sub.MaximumScore) / 2).toFixed(1)),
        coefficient: overrides.coefficient ?? sub.Coefficient,
        academicYearId: overrides.academicYearId ?? sub.AcademicYearID ?? 'AY-2025-2026',
        semesterIds: overrides.semesterIds ?? sub.SemesterIDs ?? ['SEM-2526-1', 'SEM-2526-2'],
        status: overrides.status ?? sub.Status,
      },
      activeUserId
    );

    if (!res.ok) {
      setFeedbackBanner({ type: 'ERROR', messageKh: res.messageKh });
      return;
    }
    DataService.commitState(setDb, res.updatedDb);
    setFeedbackBanner({ type: 'SUCCESS', messageKh: res.messageKh });
  };

  const handleSaveAllGradingScales = () => {
    const res = saveGradeRangeConfiguration(db, gradingScalesDraft, activeUserId);
    if (!res.ok) {
      setFeedbackBanner({ type: 'ERROR', messageKh: res.messageKh });
      return;
    }
    DataService.commitState(setDb, res.updatedDb);
    setFeedbackBanner({ type: 'SUCCESS', messageKh: res.messageKh });
  };

  // Backend Access Guard for non-administrators (except GRADE_RANGE_CONFIG which teachers & homeroom teachers can also access)
  if (!accessDecision.allowed && activeSubMenu !== 'GRADE_RANGE_CONFIG') {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 shadow-xs max-w-3xl mx-auto my-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold font-khmer-body border border-rose-200">
              ការការពារសុវត្ថិភាពប្រព័ន្ធ (Backend Authorization Enforced)
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 font-khmer-moul">
              បដិសេធសិទ្ធិចូលប្រើ៖ គ្រប់គ្រងមុខវិជ្ជា (Subject Management)
            </h2>
            <p className="text-sm text-slate-600 font-khmer-body leading-relaxed">
              {accessDecision.reasonKh}
            </p>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-khmer-body space-y-1">
              <div>
                គណនីបច្ចុប្បន្ន៖ <span className="font-bold text-slate-900">{roleSummary.userId}</span> ({roleSummary.effectiveRoles.join(' + ')})
              </div>
              <div>
                សិទ្ធិដែលអនុញ្ញាតសម្រាប់ម៉ូឌុលនេះ៖ <span className="font-bold text-indigo-700">Administrator (SUPER_ADMIN / ADMIN) ប៉ុណ្ណោះ</span>
              </div>
            </div>
            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              {onSelectUser && (
                <button
                  type="button"
                  onClick={() => onSelectUser('USR-SUP-01')}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-khmer-body transition-colors cursor-pointer"
                >
                  ប្តូរទៅគណនី គណៈគ្រប់គ្រងសាលា (USR-SUP-01)
                </button>
              )}
              {onNavigateSection && (
                <button
                  type="button"
                  onClick={() => onNavigateSection('SCORE_MANAGEMENT')}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
                >
                  ទៅកាន់ គ្រប់គ្រងពិន្ទុ (Score Management)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Module Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80 text-xs font-bold font-khmer-body">
                <BookOpen className="w-3.5 h-3.5" />
                ម៉ូឌុលឯករាជ្យទី ១ • SUBJECT MANAGEMENT
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-bold font-khmer-body">
                <ShieldCheck className="w-3.5 h-3.5" />
                ប្រភពទិន្នន័យកណ្តាលតែមួយ (Single Source of Truth)
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 font-khmer-moul mt-1">
              គ្រប់គ្រងមុខវិជ្ជា (Subject Management)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-khmer-body">
              កំណត់បញ្ជីមុខវិជ្ជា ឆ្នាំសិក្សា ពិន្ទុអតិបរមា ចន្លោះនិទ្ទេស មេគុណមុខវិជ្ជា និងការចាត់តាំងគ្រូ-មុខវិជ្ជា-ថ្នាក់ ដែលភ្ជាប់ដោយស្វ័យប្រវត្តិទៅកាន់ម៉ូឌុលគ្រប់គ្រងពិន្ទុ។
            </p>
          </div>

          {/* Summary KPI Badges */}
          <div className="grid grid-cols-3 gap-2.5 shrink-0">
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
              <div className="text-[11px] text-slate-500 font-khmer-body">មុខវិជ្ជាសរុប</div>
              <div className="text-base font-extrabold text-slate-900 font-mono-tabular">
                {db.Subjects.length}
              </div>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-blue-50/70 border border-blue-200/70 text-center">
              <div className="text-[11px] text-blue-700 font-khmer-body">ពិន្ទុអតិបរមាសរុប</div>
              <div className="text-base font-extrabold text-blue-900 font-mono-tabular">
                {db.Subjects.filter((s) => s.Status === 'ACTIVE').reduce((sum, s) => sum + s.MaximumScore, 0)}
              </div>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-center">
              <div className="text-[11px] text-emerald-700 font-khmer-body">មេគុណសរុប</div>
              <div className="text-base font-extrabold text-emerald-900 font-mono-tabular">
                {db.Subjects.filter((s) => s.Status === 'ACTIVE')
                  .reduce((sum, s) => sum + s.Coefficient, 0)
                  .toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        {/* 6 Submenu Navigation Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1">
          {SUBJECT_MANAGEMENT_SUBMENUS.map((sub, idx) => {
            const isActive = activeSubMenu === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => {
                  onSubMenuChange(sub.id);
                  setFeedbackBanner(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold font-khmer-body whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-md text-[10px] font-mono-tabular flex items-center justify-center ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {idx + 1}
                </span>
                <span>{sub.labelKh}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            feedbackBanner.type === 'SUCCESS'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold font-khmer-body">
            {feedbackBanner.type === 'SUCCESS' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackBanner.messageKh}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-semibold underline cursor-pointer shrink-0"
          >
            បិទ
          </button>
        </div>
      )}

      {/* SUBMENU 1: SUBJECT_LIST (បញ្ជីមុខវិជ្ជា) */}
      {activeSubMenu === 'SUBJECT_LIST' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left 8 Columns: Subject Directory Table */}
          <div className="xl:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>១. បញ្ជីមុខវិជ្ជាផ្លូវការ (Subject List)</span>
                </h3>
                <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                  រាល់មុខវិជ្ជាទាំងអស់នៅក្នុងតារាងនេះត្រូវបានប្រើប្រាស់ដោយផ្ទាល់នៅក្នុងម៉ូឌុលគ្រប់គ្រងពិន្ទុ និងការប្រឡងអនឡាញ។
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ស្វែងរកកូដ ឬឈ្មោះមុខវិជ្ជា..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-khmer-body focus:outline-none focus:border-blue-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                  aria-label="Filter subject status"
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold font-khmer-body bg-white"
                >
                  <option value="ALL">គ្រប់ស្ថានភាព</option>
                  <option value="ACTIVE">ដំណើរការ (ACTIVE)</option>
                  <option value="INACTIVE">ផ្អាក (INACTIVE)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-khmer-body">
                    <th className="py-2.5 px-3">កូដ</th>
                    <th className="py-2.5 px-3">ឈ្មោះមុខវិជ្ជា (ខ្មែរ / អង់គ្លេស)</th>
                    <th className="py-2.5 px-3 text-center">កម្រិតថ្នាក់</th>
                    <th className="py-2.5 px-3 text-center">ពិន្ទុអតិបរមា</th>
                    <th className="py-2.5 px-3 text-center">មេគុណ</th>
                    <th className="py-2.5 px-3 text-center">គ្រូបង្រៀន</th>
                    <th className="py-2.5 px-3 text-center">ស្ថានភាព</th>
                    <th className="py-2.5 px-3 text-right">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                  {filteredSubjects.map((sub) => {
                    const teacherCount = new Set(
                      db.TeacherSubjectAssignments.filter(
                        (a) => a.SubjectID === sub.SubjectID && a.Status === 'ACTIVE'
                      ).map((a) => a.TeacherID)
                    ).size;
                    return (
                      <tr key={sub.SubjectID} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-mono-tabular font-bold text-blue-700">
                          {sub.SubjectCode}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{sub.SubjectNameKh}</div>
                          <div className="text-[11px] text-slate-500">{sub.SubjectNameEn}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono-tabular">
                          ទី {sub.GradeLevel}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono-tabular font-bold text-slate-900">
                          {sub.MaximumScore} ពិន្ទុ
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono-tabular font-bold text-indigo-700">
                          ×{sub.Coefficient}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono-tabular font-semibold">
                            {teacherCount} នាក់
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              sub.Status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {sub.Status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleLoadSubjectIntoForm(sub)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>កែប្រែ</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right 4 Columns: Create / Update Subject Form */}
          <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                {editingSubjectId ? (
                  <>
                    <Edit3 className="w-4 h-4 text-amber-600" />
                    <span>កែប្រែមុខវិជ្ជា ({editingSubjectId})</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span>បន្ថែមមុខវិជ្ជាថ្មី (Add Subject)</span>
                  </>
                )}
              </h3>
              {editingSubjectId && (
                <button
                  type="button"
                  onClick={handleResetSubjectForm}
                  className="text-xs text-slate-500 hover:text-slate-800 font-khmer-body underline cursor-pointer"
                >
                  បង្កើតថ្មីវិញ
                </button>
              )}
            </div>

            <form onSubmit={handleSubmitSubjectForm} className="space-y-3.5 text-xs font-khmer-body">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    កូដមុខវិជ្ជា (Code) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="ឧ. CHM, BIO,ICT"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono-tabular uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    កម្រិតថ្នាក់ (Grade Level)
                  </label>
                  <select
                    value={formGradeLevel}
                    onChange={(e) => setFormGradeLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                  >
                    <option value="7-12">ថ្នាក់ទី 7-12 (គ្រប់កម្រិត)</option>
                    <option value="10-12">ថ្នាក់ទី 10-12 (ទុតិយភូមិ)</option>
                    <option value="7-9">ថ្នាក់ទី 7-9 (បឋមភូមិ)</option>
                    <option value="12">ថ្នាក់ទី 12</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ឈ្មោះមុខវិជ្ជាជាភាសាខ្មែរ *
                </label>
                <input
                  type="text"
                  required
                  value={formNameKh}
                  onChange={(e) => setFormNameKh(e.target.value)}
                  placeholder="ឧ. គីមីវិទ្យា"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ឈ្មោះមុខវិជ្ជាជាភាសាអង់គ្លេស
                </label>
                <input
                  type="text"
                  value={formNameEn}
                  onChange={(e) => setFormNameEn(e.target.value)}
                  placeholder="e.g. Chemistry"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ពិន្ទុអតិបរមា *
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    required
                    value={formMaxScore}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormMaxScore(val);
                      setFormPassingScore(Number((val / 2).toFixed(1)));
                    }}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 font-mono-tabular font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ពិន្ទុជាប់ (Pass)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={formMaxScore}
                    step="0.5"
                    value={formPassingScore}
                    onChange={(e) => setFormPassingScore(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    មេគុណ (Coeff) *
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    max={10}
                    step="0.5"
                    required
                    value={formCoefficient}
                    onChange={(e) => setFormCoefficient(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 font-mono-tabular font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ឆ្នាំសិក្សា
                  </label>
                  <select
                    value={formAcademicYearId}
                    onChange={(e) => setFormAcademicYearId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    {db.AcademicYears.map((ay) => (
                      <option key={ay.AcademicYearID} value={ay.AcademicYearID}>
                        {ay.AcademicYearName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ស្ថានភាព
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                  >
                    <option value="ACTIVE">ដំណើរការ (ACTIVE)</option>
                    <option value="INACTIVE">ផ្អាក (INACTIVE)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Save className="w-4 h-4" />
                <span>
                  {editingSubjectId
                    ? 'រក្សាទុកការកែប្រែមុខវិជ្ជា (Save Changes)'
                    : 'បន្ថែមមុខវិជ្ជាទៅក្នុងប្រព័ន្ធ (Create Subject)'}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUBMENU 2: SUBJECT_ACADEMIC_CONFIG (ការកំណត់មុខវិជ្ជាតាមឆ្នាំសិក្សា) */}
      {activeSubMenu === 'SUBJECT_ACADEMIC_CONFIG' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>២. ការកំណត់មុខវិជ្ជាតាមឆ្នាំសិក្សា ឆមាស និងកម្រិតថ្នាក់ (Subject Academic Configuration)</span>
              </h3>
              <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                កំណត់ឆ្នាំសិក្សា ឆមាសទី១/ទី២ និងកម្រិតថ្នាក់ (៧-១២) សម្រាប់មុខវិជ្ជានីមួយៗ។
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-khmer-body">
                  <th className="py-2.5 px-3">មុខវិជ្ជា</th>
                  <th className="py-2.5 px-3">ឆ្នាំសិក្សា (Academic Year)</th>
                  <th className="py-2.5 px-3">កម្រិតថ្នាក់ (Grade Levels)</th>
                  <th className="py-2.5 px-3">ឆមាសអនុវត្ត (Semesters)</th>
                  <th className="py-2.5 px-3 text-center">ស្ថានភាព</th>
                  <th className="py-2.5 px-3 text-right">រក្សាទុក</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                {db.Subjects.map((sub) => {
                  const draft = academicDrafts[sub.SubjectID] || {
                    academicYearId: sub.AcademicYearID || 'AY-2025-2026',
                    gradeLevel: sub.GradeLevel || '7-12',
                    semesterIds: sub.SemesterIDs || ['SEM-2526-1', 'SEM-2526-2'],
                    status: sub.Status,
                  };
                  return (
                    <tr key={sub.SubjectID} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">
                          {sub.SubjectNameKh}{' '}
                          <span className="font-mono-tabular text-blue-600">({sub.SubjectCode})</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{sub.SubjectNameEn}</div>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={draft.academicYearId}
                          onChange={(e) =>
                            setAcademicDrafts((prev) => ({
                              ...prev,
                              [sub.SubjectID]: { ...draft, academicYearId: e.target.value },
                            }))
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                        >
                          {db.AcademicYears.map((ay) => (
                            <option key={ay.AcademicYearID} value={ay.AcademicYearID}>
                              {ay.AcademicYearName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={draft.gradeLevel}
                          onChange={(e) =>
                            setAcademicDrafts((prev) => ({
                              ...prev,
                              [sub.SubjectID]: { ...draft, gradeLevel: e.target.value },
                            }))
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                        >
                          <option value="7-12">ថ្នាក់ទី 7-12</option>
                          <option value="10-12">ថ្នាក់ទី 10-12</option>
                          <option value="7-9">ថ្នាក់ទី 7-9</option>
                          <option value="12">ថ្នាក់ទី 12</option>
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          {db.Semesters.map((sem) => {
                            const checked = draft.semesterIds.includes(sem.SemesterID);
                            return (
                              <label
                                key={sem.SemesterID}
                                className="inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const nextSems = e.target.checked
                                      ? [...draft.semesterIds, sem.SemesterID]
                                      : draft.semesterIds.filter((id) => id !== sem.SemesterID);
                                    setAcademicDrafts((prev) => ({
                                      ...prev,
                                      [sub.SubjectID]: {
                                        ...draft,
                                        semesterIds: nextSems.length > 0 ? nextSems : [sem.SemesterID],
                                      },
                                    }));
                                  }}
                                  className="rounded text-blue-600"
                                />
                                <span>{sem.SemesterName}</span>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <select
                          value={draft.status}
                          onChange={(e) =>
                            setAcademicDrafts((prev) => ({
                              ...prev,
                              [sub.SubjectID]: {
                                ...draft,
                                status: e.target.value as 'ACTIVE' | 'INACTIVE',
                              },
                            }))
                          }
                          className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="INACTIVE">INACTIVE</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleQuickSaveSubjectRow(sub, draft)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>រក្សាទុក</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBMENU 3: MAX_SCORE_CONFIG (កំណត់ពិន្ទុអតិបរមា) */}
      {activeSubMenu === 'MAX_SCORE_CONFIG' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>៣. កំណត់ពិន្ទុអតិបរមា និងពិន្ទុជាប់មធ្យមភាគតាមមុខវិជ្ជា (Maximum Score Configuration)</span>
            </h3>
            <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
              ការកែប្រែពិន្ទុអតិបរមានៅទីនេះ នឹងធ្វើបច្ចុប្បន្នភាពភ្លាមៗទៅកាន់ការពិនិត្យដែនកំណត់ពិន្ទុ (Validation) ក្នុងម៉ូឌុលគ្រប់គ្រងពិន្ទុ។
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-khmer-body">
                  <th className="py-2.5 px-3">កូដ</th>
                  <th className="py-2.5 px-3">ឈ្មោះមុខវិជ្ជា</th>
                  <th className="py-2.5 px-3 text-center">ពិន្ទុអតិបរមាបច្ចុប្បន្ន</th>
                  <th className="py-2.5 px-3 text-center">កំណត់ពិន្ទុអតិបរមាថ្មី (Max Score)</th>
                  <th className="py-2.5 px-3 text-center">ពិន្ទុជាប់មធ្យមភាគ (Passing Score)</th>
                  <th className="py-2.5 px-3 text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                {db.Subjects.map((sub) => {
                  const draft = maxScoreDrafts[sub.SubjectID] || {
                    maxScore: sub.MaximumScore,
                    passingScore: sub.PassingScore ?? Number((sub.MaximumScore / 2).toFixed(1)),
                  };
                  return (
                    <tr key={sub.SubjectID} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-mono-tabular font-bold text-blue-700">
                        {sub.SubjectCode}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {sub.SubjectNameKh}{' '}
                        <span className="text-slate-400 font-normal">({sub.SubjectNameEn})</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono-tabular font-bold text-slate-700">
                        {sub.MaximumScore} ពិន្ទុ
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min={10}
                          max={500}
                          aria-label={`Maximum score for ${sub.SubjectCode}`}
                          value={draft.maxScore}
                          onChange={(e) => {
                            const nextMax = Number(e.target.value);
                            setMaxScoreDrafts((prev) => ({
                              ...prev,
                              [sub.SubjectID]: {
                                maxScore: nextMax,
                                passingScore: Number((nextMax / 2).toFixed(1)),
                              },
                            }));
                          }}
                          className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-300 text-center font-mono-tabular font-bold"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min={1}
                          max={draft.maxScore}
                          step="0.5"
                          aria-label={`Passing score for ${sub.SubjectCode}`}
                          value={draft.passingScore}
                          onChange={(e) =>
                            setMaxScoreDrafts((prev) => ({
                              ...prev,
                              [sub.SubjectID]: {
                                ...draft,
                                passingScore: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 text-center font-mono-tabular"
                        />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleQuickSaveSubjectRow(sub, {
                              maximumScore: draft.maxScore,
                              passingScore: draft.passingScore,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>រក្សាទុក</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBMENU 4: GRADE_RANGE_CONFIG (កំណត់ពិន្ទុនិទ្ទេសសម្រាប់មុខវិជ្ជានីមួយៗ) */}
      {activeSubMenu === 'GRADE_RANGE_CONFIG' && (
        <SubjectGradeRangeSheet
          db={db}
          setDb={setDb}
          activeUserId={activeUserId}
          showOverallScaleSection={true}
          onSaveOverallGradingScales={(updatedScales) => {
            setGradingScalesDraft(updatedScales);
            DataService.commitState(setDb, (prev) =>
              DataService.saveGradingScalesRecords(prev, updatedScales, activeUserId)
            );
          }}
        />
      )}

      {/* SUBMENU 5: COEFFICIENT_CONFIG (កំណត់មេគុណមុខវិជ្ជា) */}
      {activeSubMenu === 'COEFFICIENT_CONFIG' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>៥. កំណត់មេគុណមុខវិជ្ជា (Subject Coefficient Configuration)</span>
              </h3>
              <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                មេគុណមុខវិជ្ជាកំណត់ទម្ងន់ពិន្ទុក្នុងការគណនាមធ្យមភាគប្រចាំខែ ឆមាស និងប្រចាំឆ្នាំរបស់សិស្ស។
              </p>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-800 font-khmer-body">
              មេគុណសរុបបច្ចុប្បន្ន៖{' '}
              <span className="font-mono-tabular">
                {db.Subjects.filter((s) => s.Status === 'ACTIVE')
                  .reduce((sum, s) => sum + s.Coefficient, 0)
                  .toFixed(2)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-khmer-body">
                  <th className="py-2.5 px-3">កូដ</th>
                  <th className="py-2.5 px-3">មុខវិជ្ជា</th>
                  <th className="py-2.5 px-3 text-center">ពិន្ទុអតិបរមា</th>
                  <th className="py-2.5 px-3 text-center">មេគុណបច្ចុប្បន្ន</th>
                  <th className="py-2.5 px-3 text-center">កំណត់មេគុណថ្មី (Coefficient)</th>
                  <th className="py-2.5 px-3 text-right">រក្សាទុក</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                {db.Subjects.map((sub) => {
                  const draftCoeff = coeffDrafts[sub.SubjectID] ?? sub.Coefficient;
                  return (
                    <tr key={sub.SubjectID} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-mono-tabular font-bold text-blue-700">
                        {sub.SubjectCode}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {sub.SubjectNameKh}{' '}
                        <span className="text-slate-400 font-normal">({sub.SubjectNameEn})</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono-tabular">
                        {sub.MaximumScore} ពិន្ទុ
                      </td>
                      <td className="py-3 px-3 text-center font-mono-tabular font-bold text-indigo-700">
                        ×{sub.Coefficient}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min={0.5}
                          max={10}
                          step="0.5"
                          aria-label={`Coefficient for ${sub.SubjectCode}`}
                          value={draftCoeff}
                          onChange={(e) =>
                            setCoeffDrafts((prev) => ({
                              ...prev,
                              [sub.SubjectID]: Number(e.target.value),
                            }))
                          }
                          className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-300 text-center font-mono-tabular font-bold"
                        />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleQuickSaveSubjectRow(sub, { coefficient: draftCoeff })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>រក្សាទុក</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBMENU 6: TEACHER_SUBJECT_CLASS_ASSIGNMENTS (ការចាត់តាំងគ្រូ មុខវិជ្ជា និងថ្នាក់) */}
      {activeSubMenu === 'TEACHER_SUBJECT_CLASS_ASSIGNMENTS' && (
        <div className="space-y-4">
          <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="text-xs font-khmer-body text-blue-950">
                <span className="font-bold">៦. ការចាត់តាំងគ្រូ មុខវិជ្ជា និងថ្នាក់ (Teacher–Subject–Class Assignments)៖</span>{' '}
                ការចាត់តាំងនៅទីនេះកំណត់សិទ្ធិគ្រូបង្រៀនមុខវិជ្ជា និងគ្រូបន្ទុកថ្នាក់នៅក្នុងម៉ូឌុលគ្រប់គ្រងពិន្ទុដោយស្វ័យប្រវត្តិ។
              </div>
            </div>
          </div>

          <TeacherManagementView
            db={db}
            setDb={setDb}
            activeUserId={activeUserId}
            onSelectUser={onSelectUser}
            onNavigateSection={onNavigateSection}
          />
        </div>
      )}
    </div>
  );
};
