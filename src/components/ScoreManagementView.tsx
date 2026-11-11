import React, { useMemo, useState } from 'react';
import {
  DatabaseState,
  ScoreManagementSubMenuId,
  ScoreSubmissionWorkflowStatus,
} from '../types/database';
import {
  calculateCompetitionRanking,
  canAccessScoreManagementOperation,
  getClassStudentSubjectScoreMatrix,
  getScoreManagementAuthorizedScope,
  getScoreSubmissionRecord,
  SCORE_MANAGEMENT_SUBMENUS,
  transitionScoreSubmissionWorkflow,
  upsertStudentSubjectScoreAndRecalculate,
} from '../lib/domainRules';
import { DataService } from '../lib/centralizedDataService';
import { ReportTemplateTab } from './OfficialReportsView';
import { evaluateSubjectGradeFromRanges } from '../lib/subjectGradeRanges';
import { SubjectGradesAndRankingsSheet } from './SubjectGradesAndRankingsSheet';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Edit3,
  FileSpreadsheet,
  Filter,
  History,
  Lock,
  Printer,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Unlock,
} from 'lucide-react';

interface ScoreManagementViewProps {
  db: DatabaseState;
  setDb: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  activeSubMenu: ScoreManagementSubMenuId;
  onSubMenuChange: (sub: ScoreManagementSubMenuId) => void;
  onOpenOfficialReport?: (template: ReportTemplateTab) => void;
  onNavigateSubjectConfig?: () => void;
}

const KHMER_MONTHS = ['តុលា', 'វិច្ឆិកា', 'ធ្នូ', 'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា'];

export const ScoreManagementView: React.FC<ScoreManagementViewProps> = ({
  db,
  setDb,
  activeUserId,
  activeSubMenu,
  onSubMenuChange,
  onOpenOfficialReport,
  onNavigateSubjectConfig,
}) => {
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('AY-2025-2026');
  const [selectedSemesterId, setSelectedSemesterId] = useState('SEM-2526-1');
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('វិច្ឆិកា');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<'MONTHLY' | 'SEMESTER' | 'ANNUAL'>('MONTHLY');
  const [studentSearch, setStudentSearch] = useState('');

  const scope = useMemo(
    () => getScoreManagementAuthorizedScope(db, activeUserId, selectedAcademicYearId),
    [db, activeUserId, selectedAcademicYearId]
  );

  const filteredClasses = useMemo(() => {
    return scope.authorizedClasses.filter(
      (c) => selectedGradeLevel === 'ALL' || String(c.GradeLevel) === selectedGradeLevel
    );
  }, [scope.authorizedClasses, selectedGradeLevel]);

  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return scope.authorizedClasses.find((c) => c.ClassID === 'CLS-12C')?.ClassID ||
      scope.authorizedClasses[0]?.ClassID ||
      'CLS-12C';
  });

  const effectiveClassId = useMemo(() => {
    if (filteredClasses.some((c) => c.ClassID === selectedClassId)) {
      return selectedClassId;
    }
    return filteredClasses[0]?.ClassID || scope.authorizedClasses[0]?.ClassID || 'CLS-12C';
  }, [filteredClasses, selectedClassId, scope.authorizedClasses]);

  const authorizedSubjects = useMemo(
    () => scope.authorizedSubjectsForClass(effectiveClassId),
    [scope, effectiveClassId]
  );
  const editableSubjects = useMemo(
    () => scope.editableSubjectsForClass(effectiveClassId),
    [scope, effectiveClassId]
  );

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    return editableSubjects[0]?.SubjectID || authorizedSubjects[0]?.SubjectID || 'SUB-ICT';
  });

  const effectiveSubjectId = useMemo(() => {
    if (authorizedSubjects.some((s) => s.SubjectID === selectedSubjectId)) {
      return selectedSubjectId;
    }
    return editableSubjects[0]?.SubjectID || authorizedSubjects[0]?.SubjectID || 'SUB-ICT';
  }, [authorizedSubjects, editableSubjects, selectedSubjectId]);

  const selectedSubject = useMemo(
    () =>
      db.Subjects.find((s) => s.SubjectID === effectiveSubjectId) ||
      authorizedSubjects[0] ||
      db.Subjects[0],
    [db.Subjects, effectiveSubjectId, authorizedSubjects]
  );

  const selectedClass = useMemo(
    () => db.Classes.find((c) => c.ClassID === effectiveClassId) || db.Classes[0],
    [db.Classes, effectiveClassId]
  );

  // Matrix of all student subject scores for the selected class & month
  const classMatrix = useMemo(
    () =>
      getClassStudentSubjectScoreMatrix(db, {
        classId: effectiveClassId,
        academicYearId: selectedAcademicYearId,
        periodType:
          selectedAssessmentType === 'ANNUAL'
            ? 'ANNUAL'
            : selectedAssessmentType === 'SEMESTER'
              ? selectedSemesterId === 'SEM-2526-2'
                ? 'SEMESTER_2'
                : 'SEMESTER_1'
              : 'MONTHLY',
        month: selectedMonth,
      }),
    [db, effectiveClassId, selectedAcademicYearId, selectedAssessmentType, selectedSemesterId, selectedMonth]
  );

  // Evaluate permissions for current (classId, subjectId, month)
  const viewPerm = useMemo(
    () =>
      canAccessScoreManagementOperation(db, activeUserId, {
        classId: effectiveClassId,
        subjectId: effectiveSubjectId,
        academicYearId: selectedAcademicYearId,
        semesterId: selectedSemesterId,
        month: selectedMonth,
        operation: 'VIEW',
      }),
    [db, activeUserId, effectiveClassId, effectiveSubjectId, selectedAcademicYearId, selectedSemesterId, selectedMonth]
  );

  const editPerm = useMemo(
    () =>
      canAccessScoreManagementOperation(db, activeUserId, {
        classId: effectiveClassId,
        subjectId: effectiveSubjectId,
        academicYearId: selectedAcademicYearId,
        semesterId: selectedSemesterId,
        month: selectedMonth,
        operation: 'ENTER_OR_EDIT',
      }),
    [db, activeUserId, effectiveClassId, effectiveSubjectId, selectedAcademicYearId, selectedSemesterId, selectedMonth]
  );

  const submissionRecord = useMemo(
    () =>
      getScoreSubmissionRecord(db, {
        academicYearId: selectedAcademicYearId,
        semesterId: selectedSemesterId,
        classId: effectiveClassId,
        subjectId: effectiveSubjectId,
        month: selectedMonth,
      }),
    [db, selectedAcademicYearId, selectedSemesterId, effectiveClassId, effectiveSubjectId, selectedMonth]
  );

  // Local draft scores and modification reason
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [editReason, setEditReason] = useState<string>('កែតម្រូវពិន្ទុប្រឡងប្រចាំខែតាមសន្លឹកកិច្ចការសិស្ស');
  const [reopenNote, setReopenNote] = useState<string>('ស្នើសុំបើកសិទ្ធិកែតម្រូវពិន្ទុសិស្សឡើងវិញ');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'SUCCESS' | 'ERROR' | 'INFO';
    messageKh: string;
  } | null>(null);

  const filteredRows = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return classMatrix.rows;
    return classMatrix.rows.filter(
      (r) =>
        r.student.FullNameKh.toLowerCase().includes(q) ||
        r.student.StudentCode.toLowerCase().includes(q) ||
        r.student.StudentID.toLowerCase().includes(q)
    );
  }, [classMatrix.rows, studentSearch]);

  // Competition Ranking across the class
  const competitionRankMap = useMemo(() => {
    const ranked = calculateCompetitionRanking(
      classMatrix.rows.map((r) => ({
        studentId: r.student.StudentID,
        studentCode: r.student.StudentCode,
        lastNameKh: r.student.LastNameKh,
        firstNameKh: r.student.FirstNameKh,
        gender: r.student.Gender,
        averageScore: r.isAbsentUnranked ? -1.72 : r.weightedAverage,
      })),
      50
    );
    return new Map(ranked.map((item) => [item.studentId, item]));
  }, [classMatrix.rows]);

  const computeGradeFromScale = (scoreOn50Scale: number): string => {
    if (scoreOn50Scale < 0) return 'មិនចាត់ថ្នាក់';
    const matched = db.GradingScales.find(
      (g) => scoreOn50Scale >= g.MinimumScore && scoreOn50Scale <= g.MaximumScore
    );
    return matched ? matched.Grade : scoreOn50Scale >= 25 ? 'E' : 'F';
  };

  const handleSaveSingleStudentScore = (studentId: string, rawVal: string) => {
    if (!editPerm.allowed) {
      setFeedbackBanner({ type: 'ERROR', messageKh: editPerm.reasonKh });
      return;
    }
    const parsedScore = Number(rawVal);
    if (Number.isNaN(parsedScore)) {
      setFeedbackBanner({
        type: 'ERROR',
        messageKh: 'សូមបញ្ចូលតម្លៃពិន្ទុជាលេខឱ្យបានត្រឹមត្រូវ។',
      });
      return;
    }

    const res = upsertStudentSubjectScoreAndRecalculate(
      db,
      {
        studentId,
        classId: effectiveClassId,
        subjectId: effectiveSubjectId,
        academicYearId: selectedAcademicYearId,
        periodType: 'MONTHLY',
        periodKey: selectedMonth,
        newScore: parsedScore,
        reason:
          activeSubMenu === 'SCORE_EDITING'
            ? editReason || 'កែប្រែពិន្ទុសិស្ស'
            : 'បញ្ចូលពិន្ទុប្រចាំខែ',
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

  const handleWorkflowTransition = (
    action: 'SUBMIT' | 'REQUEST_REOPEN' | 'APPROVE' | 'REOPEN' | 'REJECT',
    targetSubjectId: string = effectiveSubjectId,
    note?: string
  ) => {
    const res = transitionScoreSubmissionWorkflow(
      db,
      {
        academicYearId: selectedAcademicYearId,
        semesterId: selectedSemesterId,
        classId: effectiveClassId,
        subjectId: targetSubjectId,
        month: selectedMonth,
        action,
        reasonOrNote: note || reopenNote,
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

  const renderStatusBadge = (status: ScoreSubmissionWorkflowStatus) => {
    const styles: Record<ScoreSubmissionWorkflowStatus, { bg: string; labelKh: string }> = {
      DRAFT: {
        bg: 'bg-slate-100 text-slate-700 border-slate-300',
        labelKh: 'កំពុងបញ្ចូល (DRAFT)',
      },
      SUBMITTED: {
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        labelKh: 'បានបញ្ជូនរួច • ចាក់សោ (SUBMITTED)',
      },
      APPROVED: {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        labelKh: 'បានអនុម័តផ្លូវការ (APPROVED)',
      },
      REOPEN_REQUESTED: {
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        labelKh: 'កំពុងស្នើសុំបើកឡើងវិញ (REOPEN_REQUESTED)',
      },
      REOPENED: {
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        labelKh: 'បានបើកឱ្យកែប្រែឡើងវិញ (REOPENED)',
      },
      REJECTED: {
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        labelKh: 'បានបដិសេធ (REJECTED)',
      },
    };
    const st = styles[status] || styles.DRAFT;
    return (
      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border font-khmer-body ${st.bg}`}>
        {st.labelKh}
      </span>
    );
  };

  if (!scope.allowed) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 shadow-xs max-w-3xl mx-auto my-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-extrabold text-slate-900 font-khmer-moul">
              បដិសេធសិទ្ធិចូលប្រើ៖ គ្រប់គ្រងពិន្ទុ (Score Management)
            </h2>
            <p className="text-sm text-slate-600 font-khmer-body">
              គណនីរបស់អ្នកមិនមានសិទ្ធិចូលប្រើម៉ូឌុលគ្រប់គ្រងពិន្ទុទេ។ សិស្សអាចពិនិត្យលទ្ធផលសិក្សាផ្ទាល់ខ្លួនតាមរយៈផតថលសិស្ស (Student Portal) ប៉ុណ្ណោះ។
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Module Header & Role Scope Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-khmer-moul">
              {activeSubMenu === 'SCORE_EDITING'
                ? 'ការកែប្រែពិន្ទុ'
                : activeSubMenu === 'SCORES_BY_CLASS'
                  ? 'គ្រប់គ្រងពិន្ទុប្រចាំខែ'
                  : activeSubMenu === 'SCORES_BY_SUBJECT'
                    ? 'គ្រប់គ្រងពិន្ទុប្រចាំឆមាស'
                    : activeSubMenu === 'MISSING_SCORE_MONITORING'
                      ? 'ការផ្ទៀងផ្ទាត់ពិន្ទុ'
                      : activeSubMenu === 'SCORE_SUBMISSION_STATUS'
                        ? 'ការអនុម័តពិន្ទុ'
                        : activeSubMenu === 'SCORE_MODIFICATION_HISTORY'
                          ? 'ប្រវត្តិកែប្រែពិន្ទុ'
                          : 'ការបញ្ចូលពិន្ទុ'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {scope.roleSummary.isAdministrator && onNavigateSubjectConfig && (
              <button
                type="button"
                onClick={onNavigateSubjectConfig}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold font-khmer-body text-slate-700 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>កំណត់មុខវិជ្ជា & មេគុណ</span>
              </button>
            )}
            {onOpenOfficialReport && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenOfficialReport('SUBJECT_GRADES_RANKINGS')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#990000] hover:bg-rose-900 text-white text-xs font-bold font-khmer-body cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-amber-300" />
                  <span>និទ្ទេស & ចំណាត់ថ្នាក់តាមមុខវិជ្ជា</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenOfficialReport('MONTHLY_RANKING')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-khmer-body cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>បោះពុម្ពតារាងចំណាត់ថ្នាក់ផ្លូវការ</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 7 Submenu Navigation Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1">
          {SCORE_MANAGEMENT_SUBMENUS.map((sub, idx) => {
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
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
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

      {/* Unified Contextual Filter Bar (Section 5: Academic Year, Semester, Grade Level, Class, Subject, Assessment Type) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 font-khmer-body mb-3">
          <Filter className="w-3.5 h-3.5 text-indigo-600" />
          <span>តម្រងទិន្នន័យពិន្ទុ (Score Filtering & Single Source of Truth Parameters)</span>
          {selectedSubject && (
            <span className="ml-auto text-[11px] text-slate-500 font-khmer-body">
              មុខវិជ្ជា៖ <strong className="text-slate-900">{selectedSubject.SubjectNameKh}</strong> • ពិន្ទុអតិបរមា៖{' '}
              <strong className="text-blue-700 font-mono-tabular">{selectedSubject.MaximumScore}</strong> • មេគុណ៖{' '}
              <strong className="text-indigo-700 font-mono-tabular">×{selectedSubject.Coefficient}</strong>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-khmer-body">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              ១. ឆ្នាំសិក្សា (Academic Year)
            </label>
            <select
              value={selectedAcademicYearId}
              onChange={(e) => setSelectedAcademicYearId(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 font-bold"
            >
              {db.AcademicYears.map((ay) => (
                <option key={ay.AcademicYearID} value={ay.AcademicYearID}>
                  {ay.AcademicYearName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              ២. ឆមាស (Semester)
            </label>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 font-bold"
            >
              {db.Semesters.map((sem) => (
                <option key={sem.SemesterID} value={sem.SemesterID}>
                  {sem.SemesterName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              ៣. កម្រិតថ្នាក់ (Grade Level)
            </label>
            <select
              value={selectedGradeLevel}
              onChange={(e) => setSelectedGradeLevel(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 font-bold"
            >
              <option value="ALL">គ្រប់កម្រិតថ្នាក់</option>
              <option value="12">ថ្នាក់ទី 12</option>
              <option value="11">ថ្នាក់ទី 11</option>
              <option value="10">ថ្នាក់ទី 10</option>
              <option value="9">ថ្នាក់ទី 9</option>
              <option value="8">ថ្នាក់ទី 8</option>
              <option value="7">ថ្នាក់ទី 7</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              ៤. ថ្នាក់រៀន (Class)
            </label>
            <select
              value={effectiveClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              aria-label="ជ្រើសរើសថ្នាក់រៀន"
              className="w-full px-2.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50/50 text-indigo-950 font-bold"
            >
              {filteredClasses.map((cls) => (
                <option key={cls.ClassID} value={cls.ClassID}>
                  ថ្នាក់ទី {cls.ClassName} ({cls.ClassID})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              ៥. មុខវិជ្ជា (Subject)
            </label>
            <select
              value={effectiveSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              aria-label="ជ្រើសរើសមុខវិជ្ជា"
              className="w-full px-2.5 py-2 rounded-xl border border-blue-200 bg-blue-50/50 text-blue-950 font-bold"
            >
              {authorizedSubjects.map((sub) => {
                const isEditable = editableSubjects.some((e) => e.SubjectID === sub.SubjectID);
                return (
                  <option key={sub.SubjectID} value={sub.SubjectID}>
                    {sub.SubjectNameKh} ({sub.SubjectCode}) {isEditable ? '✎' : '👁'}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              ៦. ប្រភេទវាយតម្លៃ & ខែ
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={selectedAssessmentType}
                onChange={(e) =>
                  setSelectedAssessmentType(e.target.value as 'MONTHLY' | 'SEMESTER' | 'ANNUAL')
                }
                className="w-1/2 px-2 py-2 rounded-xl border border-slate-200 bg-slate-50/70 font-bold"
              >
                <option value="MONTHLY">ប្រចាំខែ</option>
                <option value="SEMESTER">ប្រចាំឆមាស</option>
                <option value="ANNUAL">ប្រចាំឆ្នាំ</option>
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-1/2 px-2 py-2 rounded-xl border border-slate-200 bg-slate-50/70 font-bold"
              >
                {KHMER_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    ខែ{m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            feedbackBanner.type === 'SUCCESS'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : feedbackBanner.type === 'ERROR'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
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

      {/* SUBMENU 1 & 2: SCORE_ENTRY (បញ្ចូលពិន្ទុ) & SCORE_EDITING (កែប្រែពិន្ទុ) */}
      {(activeSubMenu === 'SCORE_ENTRY' || activeSubMenu === 'SCORE_EDITING') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                {activeSubMenu === 'SCORE_ENTRY' ? (
                  <>
                    <Edit3 className="w-4 h-4 text-indigo-600" />
                    <span>
                      ១. បញ្ចូលពិន្ទុសិស្ស (Score Entry) — ថ្នាក់ទី {selectedClass?.ClassName} • មុខវិជ្ជា៖{' '}
                      {selectedSubject?.SubjectNameKh}
                    </span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 text-amber-600" />
                    <span>
                      ២. កែប្រែពិន្ទុសិស្ស (Score Editing & Audit Logging) — ថ្នាក់ទី {selectedClass?.ClassName} • មុខវិជ្ជា៖{' '}
                      {selectedSubject?.SubjectNameKh}
                    </span>
                  </>
                )}
              </h3>
              <p className="text-xs text-slate-500 font-khmer-body">
                ដែនកំណត់ពិន្ទុអតិបរមាពីម៉ូឌុលគ្រប់គ្រងមុខវិជ្ជា៖{' '}
                <strong className="text-blue-700 font-mono-tabular">
                  0 ដល់ {selectedSubject?.MaximumScore || 100} ពិន្ទុ
                </strong>{' '}
                (មេគុណ ×{selectedSubject?.Coefficient || 1} • ពិន្ទុជាប់មធ្យមភាគ៖{' '}
                {selectedSubject?.PassingScore ?? (selectedSubject?.MaximumScore || 100) / 2})
              </p>
            </div>

            {/* Submission Workflow Action Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="ស្វែងរកឈ្មោះ ឬអត្តលេខ..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-khmer-body"
                />
              </div>

              {editPerm.allowed && (
                <button
                  type="button"
                  onClick={() => handleWorkflowTransition('SUBMIT')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-khmer-body cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ដាក់បញ្ជូនពិន្ទុ (Submit Scores)</span>
                </button>
              )}

              {!editPerm.allowed &&
                (submissionRecord.Status === 'SUBMITTED' ||
                  submissionRecord.Status === 'APPROVED') &&
                editPerm.authorizedBy === 'SUBJECT_TEACHER' && (
                  <button
                    type="button"
                    onClick={() => handleWorkflowTransition('REQUEST_REOPEN')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold font-khmer-body cursor-pointer shadow-xs"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>ស្នើសុំបើកការកែប្រែឡើងវិញ (Request Reopen)</span>
                  </button>
                )}

              {scope.roleSummary.isAdministrator &&
                (submissionRecord.Status === 'SUBMITTED' ||
                  submissionRecord.Status === 'REOPEN_REQUESTED' ||
                  submissionRecord.Status === 'APPROVED') && (
                  <button
                    type="button"
                    onClick={() => handleWorkflowTransition('REOPEN')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>បើកសិទ្ធិឱ្យគ្រូកែប្រែ (Admin Reopen)</span>
                  </button>
                )}
            </div>
          </div>

          {/* Permission / Lock Notice Banner */}
          {!editPerm.allowed && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs font-khmer-body text-amber-950">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">ការកែប្រែពិន្ទុត្រូវបានចាក់សោ ឬកំណត់ត្រឹមសិទ្ធិមើលប៉ុណ្ណោះ៖</div>
                <div>{editPerm.reasonKh}</div>
              </div>
            </div>
          )}

          {/* Mandatory Reason Input when in SCORE_EDITING submenu */}
          {activeSubMenu === 'SCORE_EDITING' && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-xs font-bold text-slate-700 font-khmer-body shrink-0">
                មូលហេតុនៃការកែប្រែពិន្ទុ (Reason for Score Modification) *៖
              </label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="បញ្ជាក់មូលហេតុកែប្រែពិន្ទុ សម្រាប់កត់ត្រាក្នុងប្រវត្តិកែប្រែពិន្ទុ..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-khmer-body"
              />
            </div>
          )}

          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-khmer-body">
                  <th className="py-2.5 px-3 text-center">ល.រ</th>
                  <th className="py-2.5 px-3">អត្តលេខ</th>
                  <th className="py-2.5 px-3">គោត្តនាម និងនាម</th>
                  <th className="py-2.5 px-3 text-center">ភេទ</th>
                  <th className="py-2.5 px-3 text-center">
                    ពិន្ទុបច្ចុប្បន្ន (/{selectedSubject?.MaximumScore || 100})
                  </th>
                  <th className="py-2.5 px-3 text-center">និទ្ទេសមុខវិជ្ជា</th>
                  <th className="py-2.5 px-3 text-center">
                    {activeSubMenu === 'SCORE_EDITING' ? 'កែប្រែពិន្ទុថ្មី' : 'បញ្ចូលពិន្ទុ'}
                  </th>
                  <th className="py-2.5 px-3 text-right">រក្សាទុក</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                {filteredRows.slice(0, 30).map((row, idx) => {
                  const currentScore = row.subjectScores[effectiveSubjectId] ?? 0;
                  const maxSubScore = selectedSubject?.MaximumScore || 100;
                  const subGrade =
                    currentScore < 0
                      ? 'មិនចាត់ថ្នាក់'
                      : evaluateSubjectGradeFromRanges(
                          db,
                          selectedSubject?.SubjectID || selectedSubject?.SubjectNameKh || effectiveSubjectId,
                          currentScore,
                          maxSubScore
                        );
                  const draftVal =
                    scoreDrafts[`${row.student.StudentID}-${effectiveSubjectId}`] ??
                    String(currentScore < 0 ? 0 : currentScore);

                  return (
                    <tr key={row.student.StudentID} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 text-center font-mono-tabular text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono-tabular font-bold text-slate-700">
                        #{row.student.StudentCode}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {row.student.FullNameKh}
                      </td>
                      <td className="py-2.5 px-3 text-center">{row.student.Gender}</td>
                      <td className="py-2.5 px-3 text-center font-mono-tabular font-extrabold">
                        {currentScore < 0 ? (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px]">
                            មិនទាន់បញ្ចូល (-1.72)
                          </span>
                        ) : (
                          <span className="text-blue-700">
                            {currentScore} / {maxSubScore}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono-tabular font-bold">
                          {subGrade}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min={0}
                          max={maxSubScore}
                          step="0.5"
                          disabled={!editPerm.allowed}
                          aria-label={`Score input for ${row.student.FullNameKh}`}
                          value={draftVal}
                          onChange={(e) =>
                            setScoreDrafts((prev) => ({
                              ...prev,
                              [`${row.student.StudentID}-${effectiveSubjectId}`]: e.target.value,
                            }))
                          }
                          className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 text-center font-mono-tabular font-bold disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          disabled={!editPerm.allowed}
                          onClick={() => handleSaveSingleStudentScore(row.student.StudentID, draftVal)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold transition-colors cursor-pointer"
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

      {/* SUBMENU 3: SCORES_BY_CLASS (បញ្ជីពិន្ទុតាមថ្នាក់) */}
      {activeSubMenu === 'SCORES_BY_CLASS' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <span>
                  ៣. បញ្ជីពិន្ទុតាមថ្នាក់ (Scores by Class) — ថ្នាក់ទី {selectedClass?.ClassName} • ខែ{selectedMonth}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                បង្ហាញពិន្ទុគ្រប់មុខវិជ្ជា ពិន្ទុសរុប មធ្យមភាគថ្លឹងមេគុណ និទ្ទេស និងចំណាត់ថ្នាក់ប្រកួតប្រជែង (Competition Ranking 1, 1, 3)។
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="ស្វែងរកសិស្សក្នុងថ្នាក់..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-khmer-body"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-khmer-body">
                  <th className="py-2.5 px-2.5 text-center">ចំណាត់ថ្នាក់</th>
                  <th className="py-2.5 px-2.5">អត្តលេខ</th>
                  <th className="py-2.5 px-3">គោត្តនាម និងនាម</th>
                  <th className="py-2.5 px-2 text-center">ភេទ</th>
                  {classMatrix.subjects.map((sub) => (
                    <th key={sub.SubjectID} className="py-2.5 px-2.5 text-center">
                      <div>{sub.SubjectNameKh}</div>
                      <div className="text-[10px] text-slate-400 font-mono-tabular">
                        /{sub.MaximumScore} (×{sub.Coefficient})
                      </div>
                    </th>
                  ))}
                  <th className="py-2.5 px-2.5 text-center">ពិន្ទុសរុប</th>
                  <th className="py-2.5 px-2.5 text-center">មធ្យមភាគ</th>
                  <th className="py-2.5 px-2.5 text-center">និទ្ទេស</th>
                  <th className="py-2.5 px-2.5 text-center">លទ្ធផល</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                {filteredRows.map((row) => {
                  const rankedItem = competitionRankMap.get(row.student.StudentID);
                  return (
                    <tr key={row.student.StudentID} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-2.5 text-center font-mono-tabular font-extrabold">
                        {rankedItem?.ranking ? (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                            ទី {rankedItem.ranking}
                          </span>
                        ) : (
                          <span className="text-slate-400">មិនចាត់ថ្នាក់</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 font-mono-tabular text-slate-600">
                        #{row.student.StudentCode}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {row.student.FullNameKh}
                      </td>
                      <td className="py-2.5 px-2 text-center">{row.student.Gender}</td>
                      {classMatrix.subjects.map((sub) => {
                        const val = row.subjectScores[sub.SubjectID];
                        return (
                          <td
                            key={sub.SubjectID}
                            className="py-2.5 px-2.5 text-center font-mono-tabular"
                          >
                            {val < 0 ? (
                              <span className="text-rose-600 font-bold">អវត្តមាន</span>
                            ) : (
                              <span className="font-semibold text-slate-800">{val}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-2.5 text-center font-mono-tabular font-bold text-slate-900">
                        {row.totalRawScore}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-mono-tabular font-extrabold text-blue-700">
                        {row.isAbsentUnranked ? '-1.72' : row.weightedAverage.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-mono-tabular font-bold">
                        {rankedItem?.grade || row.grade}
                      </td>
                      <td className="py-2.5 px-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            row.passStatus === 'ជាប់មធ្យមភាគ'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : row.passStatus === 'ធ្លាក់មធ្យមភាគ'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {row.passStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBMENU 4: SCORES_BY_SUBJECT (បញ្ជីពិន្ទុតាមមុខវិជ្ជា) */}
      {activeSubMenu === 'SCORES_BY_SUBJECT' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-600" />
                <span>
                  ៤. បញ្ជីពិន្ទុតាមមុខវិជ្ជា (Scores by Subject) — {selectedSubject?.SubjectNameKh} (
                  {selectedSubject?.SubjectCode})
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                ពិន្ទុអតិបរមា៖ {selectedSubject?.MaximumScore} • មេគុណ៖ ×{selectedSubject?.Coefficient} • ថ្នាក់ទី{' '}
                {selectedClass?.ClassName}
              </p>
            </div>

            {(() => {
              const maxScore = selectedSubject?.MaximumScore || 100;
              const passMark = selectedSubject?.PassingScore ?? maxScore / 2;
              const validScores = classMatrix.rows
                .map((r) => r.subjectScores[effectiveSubjectId])
                .filter((v) => typeof v === 'number' && v >= 0);
              const passed = validScores.filter((v) => v >= passMark).length;
              const failed = validScores.length - passed;
              const avg =
                validScores.length > 0
                  ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
                  : '0.0';
              return (
                <div className="grid grid-cols-3 gap-2.5 text-center text-xs font-khmer-body">
                  <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-[10px] text-emerald-700">ជាប់មុខវិជ្ជានេះ</div>
                    <div className="font-extrabold text-emerald-900 font-mono-tabular">
                      {passed} នាក់
                    </div>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200">
                    <div className="text-[10px] text-rose-700">ធ្លាក់មុខវិជ្ជានេះ</div>
                    <div className="font-extrabold text-rose-900 font-mono-tabular">
                      {failed} នាក់
                    </div>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
                    <div className="text-[10px] text-blue-700">ពិន្ទុមធ្យម</div>
                    <div className="font-extrabold text-blue-900 font-mono-tabular">
                      {avg} / {maxScore}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-khmer-body">
                  <th className="py-2.5 px-3 text-center">ល.រ</th>
                  <th className="py-2.5 px-3">អត្តលេខ</th>
                  <th className="py-2.5 px-3">ឈ្មោះសិស្ស</th>
                  <th className="py-2.5 px-3 text-center">ភេទ</th>
                  <th className="py-2.5 px-3 text-center">
                    ពិន្ទុមុខវិជ្ជា (/{selectedSubject?.MaximumScore || 100})
                  </th>
                  <th className="py-2.5 px-3 text-center">ភាគរយ (%)</th>
                  <th className="py-2.5 px-3 text-center">និទ្ទេស</th>
                  <th className="py-2.5 px-3 text-center">ស្ថានភាពជាប់/ធ្លាក់</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                {filteredRows.map((row, idx) => {
                  const score = row.subjectScores[effectiveSubjectId] ?? 0;
                  const maxScore = selectedSubject?.MaximumScore || 100;
                  const passMark = selectedSubject?.PassingScore ?? maxScore / 2;
                  const pct = score < 0 ? 0 : Math.round((score / maxScore) * 100);
                  const grade =
                    score < 0
                      ? 'មិនចាត់ថ្នាក់'
                      : evaluateSubjectGradeFromRanges(
                          db,
                          selectedSubject?.SubjectID || selectedSubject?.SubjectNameKh || effectiveSubjectId,
                          score,
                          maxScore
                        );
                  const isPass = score >= passMark;
                  return (
                    <tr key={row.student.StudentID} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 text-center font-mono-tabular text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono-tabular font-bold">
                        #{row.student.StudentCode}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {row.student.FullNameKh}
                      </td>
                      <td className="py-2.5 px-3 text-center">{row.student.Gender}</td>
                      <td className="py-2.5 px-3 text-center font-mono-tabular font-extrabold text-blue-700">
                        {score < 0 ? 'អវត្តមាន (-1.72)' : `${score} / ${maxScore}`}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono-tabular">{pct}%</td>
                      <td className="py-2.5 px-3 text-center font-mono-tabular font-bold">
                        {grade}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {score < 0 ? (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold">
                            មិនទាន់បញ្ចូលពិន្ទុ
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isPass
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isPass ? 'ជាប់មធ្យមភាគ' : 'ធ្លាក់មធ្យមភាគ'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Complete MoEYS 18-Subject Grades, Rankings & A-F Distribution Sheet */}
          <div className="pt-4 border-t border-slate-200">
            <SubjectGradesAndRankingsSheet
              db={db}
              defaultClassId={effectiveClassId}
              defaultMonth={selectedMonth}
              onOpenGradeConfig={onNavigateSubjectConfig}
            />
          </div>
        </div>
      )}

      {/* SUBMENU 5: MISSING_SCORE_MONITORING (តាមដានពិន្ទុដែលមិនទាន់បញ្ចូល) */}
      {activeSubMenu === 'MISSING_SCORE_MONITORING' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>
                ៥. តាមដានពិន្ទុដែលមិនទាន់បញ្ចូល (Missing Score Monitoring) — ថ្នាក់ទី{' '}
                {selectedClass?.ClassName} • ខែ{selectedMonth}
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
              អនុញ្ញាតឱ្យគ្រូបន្ទុកថ្នាក់ គ្រូបង្រៀនមុខវិជ្ជា និងគណៈគ្រប់គ្រងសាលា តាមដានមុខវិជ្ជា និងសិស្សដែលខ្វះពិន្ទុប្រឡង។
            </p>
          </div>

          {/* Subject-by-Subject Missing Score Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {authorizedSubjects.map((sub) => {
              const totalCount = classMatrix.rows.length;
              const missingRows = classMatrix.rows.filter(
                (r) => (r.subjectScores[sub.SubjectID] ?? -1.72) < 0
              );
              const enteredCount = totalCount - missingRows.length;
              const subStatus = getScoreSubmissionRecord(db, {
                academicYearId: selectedAcademicYearId,
                semesterId: selectedSemesterId,
                classId: effectiveClassId,
                subjectId: sub.SubjectID,
                month: selectedMonth,
              });
              const assignedTeacherAsn = db.TeacherSubjectAssignments.find(
                (a) =>
                  a.ClassID === effectiveClassId &&
                  a.SubjectID === sub.SubjectID &&
                  a.Status === 'ACTIVE'
              );
              const teacherUser = db.Users.find(
                (u) => u.UserID === assignedTeacherAsn?.TeacherID
              );

              return (
                <div
                  key={sub.SubjectID}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-900 font-khmer-body">
                      {sub.SubjectNameKh}
                    </span>
                    <span className="text-[10px] font-mono-tabular font-bold text-blue-700">
                      {sub.SubjectCode}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-khmer-body">
                    គ្រូទទួលបន្ទុក៖{' '}
                    <span className="font-bold text-slate-800">
                      {teacherUser?.FullNameKh || 'ជួន លីរតនៈ'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-khmer-body pt-1">
                    <span className="text-emerald-700 font-bold">
                      បញ្ចូលរួច៖ {enteredCount}/{totalCount}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        missingRows.length > 0
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      ខ្វះ៖ {missingRows.length} នាក់
                    </span>
                  </div>
                  <div className="pt-1">{renderStatusBadge(subStatus.Status)}</div>
                </div>
              );
            })}
          </div>

          {/* List of Students with Missing Scores */}
          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-khmer-body">
                  <th className="py-2.5 px-3">អត្តលេខ</th>
                  <th className="py-2.5 px-3">ឈ្មោះសិស្ស</th>
                  <th className="py-2.5 px-3 text-center">ភេទ</th>
                  <th className="py-2.5 px-3">មុខវិជ្ជាដែលមិនទាន់មានពិន្ទុ</th>
                  <th className="py-2.5 px-3 text-right">សកម្មភាពរហ័ស</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                {classMatrix.rows
                  .filter((r) => r.isAbsentUnranked)
                  .map((row) => (
                    <tr key={row.student.StudentID} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-mono-tabular font-bold text-rose-700">
                        #{row.student.StudentCode}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {row.student.FullNameKh}
                      </td>
                      <td className="py-3 px-3 text-center">{row.student.Gender}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1.5">
                          {authorizedSubjects.map((sub) => (
                            <span
                              key={sub.SubjectID}
                              className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold"
                            >
                              ខ្វះពិន្ទុ៖ {sub.SubjectNameKh}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSubMenuChange('SCORE_ENTRY')}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold cursor-pointer"
                        >
                          ទៅបញ្ចូលពិន្ទុ
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBMENU 6: SCORE_SUBMISSION_STATUS (ស្ថានភាពការបញ្ជូនពិន្ទុ) */}
      {activeSubMenu === 'SCORE_SUBMISSION_STATUS' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-indigo-600" />
                <span>
                  ៦. ស្ថានភាពការបញ្ជូនពិន្ទុ និងការអនុម័ត (Score Submission Status & Approval Workflow)
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                ពិន្ទុដែលបានដាក់បញ្ជូន (SUBMITTED / APPROVED) ត្រូវបានចាក់សោការពារការកែប្រែ។ គ្រូអាចស្នើសុំបើកឡើងវិញ ហើយគណៈគ្រប់គ្រងសាលាអាចអនុម័ត ឬបើកសិទ្ធិឱ្យកែប្រែឡើងវិញ។
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs font-bold text-slate-700 font-khmer-body shrink-0">
              កំណត់ចំណាំ / មូលហេតុស្នើសុំបើក ឬអនុម័ត៖
            </label>
            <input
              type="text"
              value={reopenNote}
              onChange={(e) => setReopenNote(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-khmer-body"
            />
          </div>

          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-khmer-body">
                  <th className="py-2.5 px-3">មុខវិជ្ជា</th>
                  <th className="py-2.5 px-3">ថ្នាក់រៀន</th>
                  <th className="py-2.5 px-3">គ្រូបង្រៀនមុខវិជ្ជា</th>
                  <th className="py-2.5 px-3 text-center">ចំនួនសិស្សបញ្ចូលរួច</th>
                  <th className="py-2.5 px-3 text-center">ស្ថានភាពបច្ចុប្បន្ន</th>
                  <th className="py-2.5 px-3">កំណត់ចំណាំ / មូលហេតុ</th>
                  <th className="py-2.5 px-3 text-right">សកម្មភាពគ្រប់គ្រង (Workflow Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                {authorizedSubjects.map((sub) => {
                  const subRec = getScoreSubmissionRecord(db, {
                    academicYearId: selectedAcademicYearId,
                    semesterId: selectedSemesterId,
                    classId: effectiveClassId,
                    subjectId: sub.SubjectID,
                    month: selectedMonth,
                  });
                  const asn = db.TeacherSubjectAssignments.find(
                    (a) =>
                      a.ClassID === effectiveClassId &&
                      a.SubjectID === sub.SubjectID &&
                      a.Status === 'ACTIVE'
                  );
                  const teacher = db.Users.find((u) => u.UserID === asn?.TeacherID);
                  const isEditableByMe = editableSubjects.some(
                    (e) => e.SubjectID === sub.SubjectID
                  );

                  return (
                    <tr key={sub.SubjectID} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {sub.SubjectNameKh}{' '}
                        <span className="font-mono-tabular text-blue-600">({sub.SubjectCode})</span>
                      </td>
                      <td className="py-3 px-3 font-bold">ថ្នាក់ទី {selectedClass?.ClassName}</td>
                      <td className="py-3 px-3">{teacher?.FullNameKh || 'ជួន លីរតនៈ'}</td>
                      <td className="py-3 px-3 text-center font-mono-tabular">
                        <span className="text-emerald-700 font-bold">{subRec.EnteredCount}</span> /{' '}
                        {subRec.TotalStudents} (ខ្វះ {subRec.MissingCount})
                      </td>
                      <td className="py-3 px-3 text-center">{renderStatusBadge(subRec.Status)}</td>
                      <td className="py-3 px-3 text-slate-600">
                        {subRec.ReopenReason || subRec.ReviewNote || '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Teacher Submit Button */}
                          {isEditableByMe &&
                            (subRec.Status === 'DRAFT' ||
                              subRec.Status === 'REOPENED' ||
                              subRec.Status === 'REJECTED') && (
                              <button
                                type="button"
                                onClick={() => handleWorkflowTransition('SUBMIT', sub.SubjectID)}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                              >
                                ដាក់បញ្ជូនពិន្ទុ
                              </button>
                            )}

                          {/* Teacher Request Reopen Button */}
                          {isEditableByMe &&
                            (subRec.Status === 'SUBMITTED' || subRec.Status === 'APPROVED') && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleWorkflowTransition('REQUEST_REOPEN', sub.SubjectID)
                                }
                                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                              >
                                ស្នើសុំបើកឡើងវិញ
                              </button>
                            )}

                          {/* Administrator Approval & Reopen Controls */}
                          {scope.roleSummary.isAdministrator && (
                            <>
                              {subRec.Status !== 'APPROVED' && (
                                <button
                                  type="button"
                                  onClick={() => handleWorkflowTransition('APPROVE', sub.SubjectID)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                                >
                                  អនុម័ត (Approve)
                                </button>
                              )}
                              {subRec.Status !== 'REOPENED' && (
                                <button
                                  type="button"
                                  onClick={() => handleWorkflowTransition('REOPEN', sub.SubjectID)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                                >
                                  បើកឱ្យកែប្រែ (Reopen)
                                </button>
                              )}
                              {subRec.Status === 'REOPEN_REQUESTED' && (
                                <button
                                  type="button"
                                  onClick={() => handleWorkflowTransition('REJECT', sub.SubjectID)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                                >
                                  បដិសេធ (Reject)
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBMENU 7: SCORE_MODIFICATION_HISTORY (ប្រវត្តិនៃការកែប្រែពិន្ទុ) */}
      {activeSubMenu === 'SCORE_MODIFICATION_HISTORY' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>
                  ៧. ប្រវត្តិនៃការកែប្រែពិន្ទុ (Score Modification History & Audit Trail)
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                រាល់ការកែប្រែពិន្ទុទាំងអស់ត្រូវបានរក្សាទុកជាប្រវត្តិ (Audit Log) ដោយមិនលុបទិន្នន័យចាស់ចោលឡើយ។
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-khmer-body">
                  <th className="py-2.5 px-3">កាលបរិច្ឆេទ & ម៉ោង</th>
                  <th className="py-2.5 px-3">អត្តលេខ & ឈ្មោះសិស្ស</th>
                  <th className="py-2.5 px-3">ថ្នាក់ / មុខវិជ្ជា</th>
                  <th className="py-2.5 px-3">ឆ្នាំសិក្សា / ឆមាស</th>
                  <th className="py-2.5 px-3 text-center">ពិន្ទុចាស់ → ពិន្ទុថ្មី</th>
                  <th className="py-2.5 px-3">អ្នកកែប្រែ (Modified By)</th>
                  <th className="py-2.5 px-3">មូលហេតុកែប្រែ (Reason)</th>
                  <th className="py-2.5 px-3 text-center">ស្ថានភាពអនុម័ត</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                {(db.ScoreModificationHistory || [])
                  .filter((rec) =>
                    scope.authorizedClasses.some((c) => c.ClassID === rec.ClassID)
                  )
                  .map((rec) => (
                    <tr key={rec.ModificationID} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-mono-tabular text-[11px] text-slate-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{rec.ModifiedAt.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{rec.StudentNameKh}</div>
                        <div className="text-[11px] font-mono-tabular text-slate-500">
                          {rec.StudentID} (#{rec.StudentCode})
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-indigo-700">{rec.SubjectNameKh}</div>
                        <div className="text-[11px] text-slate-500">
                          {rec.ClassID} • ខែ{rec.Month}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-600">
                        <div>{rec.AcademicYearID}</div>
                        <div>{rec.SemesterID}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono-tabular">
                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold">
                          {rec.PreviousScore}
                        </span>
                        <span className="mx-1.5 text-slate-400">→</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-extrabold">
                          {rec.NewScore}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">{rec.ModifiedByNameKh}</div>
                        <div className="text-[10px] font-mono-tabular text-slate-500">
                          {rec.ModifiedByRole}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700">{rec.Reason}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          {rec.ApprovalStatus}
                        </span>
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
