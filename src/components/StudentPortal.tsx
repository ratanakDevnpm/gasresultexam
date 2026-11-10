import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DatabaseState,
  ExamAttemptRecord,
  QuestionRecord,
} from '../types/database';
import {
  autoGradeExamSubmission,
  calculateMoEYSGrade,
  getStudentClassScopedResults,
  getStudentExaminationPortalCatalog,
  StudentExamCardItem,
  StudentExamLifecycleStatus,
  StudentSubmittedAnswerInput,
  toKhmerNumerals,
  validateStudentExamAccess,
} from '../lib/domainRules';
import { HONOR_PORTRAIT_URLS } from '../lib/seedData';
import { resolveStudentProfilePhotoUrl } from '../lib/studentProfileRules';
import { StudentPersonalProfileCard } from './StudentPersonalProfileCard';
import {
  AlertCircle,
  ArrowLeft,
  Atom,
  Award,
  BookOpen,
  Calculator,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck2,
  FileText,
  Flag,
  Globe,
  GraduationCap,
  History,
  Info,
  Layers,
  Lock,
  Monitor,
  Play,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';

export type StudentPortalTabId = 'AVAILABLE_EXAMS' | 'MY_RESULTS' | 'MY_PROFILE';

interface StudentPortalProps {
  db: DatabaseState;
  setDb?: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  activeTab?: StudentPortalTabId;
  onTabChange?: (tab: StudentPortalTabId) => void;
  onSubmitExamAttempt?: (payload: {
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
  }) => ExamAttemptRecord;
  onStartExam?: (examId: string) => void;
  onLogout?: () => void;
}

type ExamPortalStage =
  | 'DASHBOARD_AND_SELECTION'
  | 'TAKING_EXAM'
  | 'SUBMISSION_RESULT';

interface ExtendedQuestionMeta {
  uiType?:
    | 'MCQ'
    | 'CHECKBOXES'
    | 'TRUE_FALSE'
    | 'SHORT_ANSWER'
    | 'PARAGRAPH'
    | 'DROPDOWN'
    | 'LINEAR_SCALE'
    | 'DATE'
    | 'TIME';
  required?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
}

function parseExtendedQuestionMeta(q: QuestionRecord): ExtendedQuestionMeta {
  try {
    const parsed = JSON.parse(q.CorrectAnswerJSON || '{}');
    return {
      uiType: parsed.uiType,
      required: parsed.required !== false,
      scaleMin: parsed.scaleMin ?? 1,
      scaleMax: parsed.scaleMax ?? 5,
      scaleMinLabel: parsed.scaleMinLabel || 'ទាបបំផុត',
      scaleMaxLabel: parsed.scaleMaxLabel || 'ខ្ពស់បំផុត',
    };
  } catch {
    return { required: true };
  }
}

function formatExamDateKh(isoStr: string): string {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('km-KH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatExamTimeWindow(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return '08:00 - 17:00';
  }
  const fmt = (dt: Date) =>
    dt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  return `${fmt(s)} – ${fmt(e)}`;
}

function getStatusBadgeStyle(status: StudentExamLifecycleStatus | 'NO_EXAMS'): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (status) {
    case 'AVAILABLE':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'IN_PROGRESS':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
      };
    case 'UPCOMING':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'COMPLETED':
      return {
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-200',
        dot: 'bg-indigo-500',
      };
    case 'EXPIRED':
    default:
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      };
  }
}

function renderSubjectIcon(subjectId: string, className = 'w-5 h-5') {
  if (subjectId.includes('ICT')) return <Monitor className={className} />;
  if (subjectId.includes('MATH')) return <Calculator className={className} />;
  if (subjectId.includes('ENG')) return <Globe className={className} />;
  if (subjectId.includes('PHY')) return <Atom className={className} />;
  return <BookOpen className={className} />;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  db,
  setDb,
  activeUserId,
  activeTab: controlledTab,
  onTabChange,
  onSubmitExamAttempt,
}) => {
  const [internalTab, setInternalTab] = useState<StudentPortalTabId>(
    'AVAILABLE_EXAMS'
  );
  const activeTab = controlledTab ?? internalTab;

  const handleSwitchTab = (tab: StudentPortalTabId) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  // Class-scoped results & rankings
  const {
    student,
    studentClass,
    totalClassStudents,
    femaleClassStudents,
    passedClassStudents,
    myRankedEntry,
    mySemesterResult,
    myAnnualResult,
    top5HonorStudents,
  } = useMemo(
    () => getStudentClassScopedResults(db, activeUserId, HONOR_PORTRAIT_URLS),
    [db, activeUserId]
  );

  const studentAvatarUrl = useMemo(
    () =>
      resolveStudentProfilePhotoUrl(
        student.ProfileImageID,
        HONOR_PORTRAIT_URLS,
        0
      ),
    [student.ProfileImageID]
  );

  // Authoritative Student Examination Portal Catalog (Subjects, Exams, History, Counts)
  const portalCatalog = useMemo(
    () => getStudentExaminationPortalCatalog(db, activeUserId),
    [db, activeUserId]
  );

  // Step 3 & Step 4: Subject & Examination Selection states
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | StudentExamLifecycleStatus
  >('ALL');
  const [examSearchQuery, setExamSearchQuery] = useState<string>('');

  // Step 5: Confirmation Modal state
  const [confirmingExamCard, setConfirmingExamCard] =
    useState<StudentExamCardItem | null>(null);
  const [hasAcceptedInstructions, setHasAcceptedInstructions] =
    useState<boolean>(false);
  const [accessErrorBanner, setAccessErrorBanner] = useState<string | null>(
    null
  );

  // Step 6 & 7: Active Examination Session & Submission Result states
  const [portalStage, setPortalStage] = useState<ExamPortalStage>(
    'DASHBOARD_AND_SELECTION'
  );
  const [activeExamCard, setActiveExamCard] =
    useState<StudentExamCardItem | null>(null);
  const [activeAttemptId, setActiveAttemptId] = useState<string>('');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(2400);
  const [studentAnswers, setStudentAnswers] = useState<
    Record<string, StudentSubmittedAnswerInput>
  >({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<
    Record<string, boolean>
  >({});
  const [questionNavFilter, setQuestionNavFilter] = useState<
    'ALL' | 'UNANSWERED' | 'FLAGGED'
  >('ALL');
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] =
    useState<boolean>(false);
  const [lastSubmittedAttempt, setLastSubmittedAttempt] =
    useState<ExamAttemptRecord | null>(null);

  // Reset stage when switching students
  useEffect(() => {
    setPortalStage('DASHBOARD_AND_SELECTION');
    setConfirmingExamCard(null);
    setAccessErrorBanner(null);
  }, [activeUserId]);

  // Filtered exams for Step 4
  const filteredExamCards = useMemo(() => {
    return portalCatalog.examCards.filter((card) => {
      if (
        selectedSubjectId !== 'ALL' &&
        card.subject.SubjectID !== selectedSubjectId
      ) {
        return false;
      }
      if (statusFilter !== 'ALL' && card.status !== statusFilter) {
        return false;
      }
      if (examSearchQuery.trim()) {
        const q = examSearchQuery.trim().toLowerCase();
        const matchTitle = card.exam.ExamTitle.toLowerCase().includes(q);
        const matchSubject =
          card.subject.SubjectNameKh.toLowerCase().includes(q) ||
          card.subject.SubjectNameEn.toLowerCase().includes(q);
        const matchType =
          card.examTypeLabelKh.toLowerCase().includes(q) ||
          card.examTypeLabelEn.toLowerCase().includes(q);
        if (!matchTitle && !matchSubject && !matchType) return false;
      }
      return true;
    });
  }, [
    portalCatalog.examCards,
    selectedSubjectId,
    statusFilter,
    examSearchQuery,
  ]);

  // Questions for the currently active examination (Step 6)
  const activeExamQuestions = useMemo(() => {
    if (!activeExamCard) return [];
    if (activeExamCard.questions && activeExamCard.questions.length > 0) {
      return activeExamCard.questions;
    }
    const exam = activeExamCard.exam;
    return db.Questions.filter(
      (q) => q.SubjectID === exam.SubjectID && q.Status === 'ACTIVE'
    );
  }, [db.Questions, activeExamCard]);

  // LocalStorage key for auto-saving answers during Step 6
  const autoSaveKey = useMemo(() => {
    if (!activeExamCard) return '';
    return `teokchor_exam_autosave_${student.StudentID}_${activeExamCard.exam.ExamID}`;
  }, [student.StudentID, activeExamCard]);

  // Auto-save answers to localStorage when modified during Step 6
  useEffect(() => {
    if (portalStage !== 'TAKING_EXAM' || !autoSaveKey) return;
    try {
      localStorage.setItem(
        autoSaveKey,
        JSON.stringify({
          studentAnswers,
          flaggedQuestions,
          savedAt: new Date().toISOString(),
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [portalStage, autoSaveKey, studentAnswers, flaggedQuestions]);

  // Step 5: Open Confirmation Dialog (with Backend Access Pre-Check)
  const handleRequestOpenConfirmation = (card: StudentExamCardItem) => {
    setAccessErrorBanner(null);
    const check = validateStudentExamAccess(
      db,
      student.StudentID,
      card.exam.ExamID
    );
    if (!check.allowed) {
      setAccessErrorBanner(check.reasonKh);
      return;
    }
    setConfirmingExamCard(card);
    setHasAcceptedInstructions(false);
  };

  // Step 5 -> Step 6: Confirm & Start Examination
  const handleConfirmAndStartExam = () => {
    if (!confirmingExamCard || !hasAcceptedInstructions) return;
    const check = validateStudentExamAccess(
      db,
      student.StudentID,
      confirmingExamCard.exam.ExamID
    );
    if (!check.allowed) {
      setAccessErrorBanner(check.reasonKh);
      setConfirmingExamCard(null);
      return;
    }

    const now = new Date();
    const durationSec = Math.max(
      60,
      (confirmingExamCard.exam.DurationMinutes || 40) * 60
    );
    const deadlineIso = new Date(
      now.getTime() + durationSec * 1000
    ).toISOString();

    const existingInProgress = db.ExamAttempts.find(
      (a) =>
        a.ExamID === confirmingExamCard.exam.ExamID &&
        a.StudentID === student.StudentID &&
        a.AttemptStatus === 'IN_PROGRESS'
    );

    const attemptId =
      existingInProgress?.AttemptID ||
      `ATT-${String(db.ExamAttempts.length + 1).padStart(4, '0')}`;

    if (!existingInProgress && setDb) {
      const newAttempt: ExamAttemptRecord = {
        AttemptID: attemptId,
        ExamID: confirmingExamCard.exam.ExamID,
        StudentID: student.StudentID,
        AttemptNumber: confirmingExamCard.completedAttemptsCount + 1,
        StartedAt: now.toISOString(),
        SubmittedAt: '',
        ServerDeadline: deadlineIso,
        AttemptStatus: 'IN_PROGRESS',
        TotalScore: 0,
        CreatedAt: now.toISOString(),
      };
      setDb((prev) => ({
        ...prev,
        ExamAttempts: [newAttempt, ...prev.ExamAttempts],
        AuditLogs: [
          {
            LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
            UserID: activeUserId,
            Action: 'START_ONLINE_EXAM_ATTEMPT',
            Module: 'ExaminationService.gs',
            RecordID: attemptId,
            OldValueJSON: '{}',
            NewValueJSON: JSON.stringify({
              ExamID: confirmingExamCard.exam.ExamID,
              StudentID: student.StudentID,
              ServerDeadline: deadlineIso,
            }),
            Timestamp: now.toISOString(),
            IPOrSessionReference: 'GAS-EXAM-SVC',
            Description: `Student ${student.StudentID} started exam ${confirmingExamCard.exam.ExamID}`,
          },
          ...prev.AuditLogs,
        ],
      }));
    }

    // Restore auto-saved answers if any exist for this student + exam
    let restoredAnswers: Record<string, StudentSubmittedAnswerInput> = {};
    let restoredFlags: Record<string, boolean> = {};
    try {
      const savedKey = `teokchor_exam_autosave_${student.StudentID}_${confirmingExamCard.exam.ExamID}`;
      const raw = localStorage.getItem(savedKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.studentAnswers) restoredAnswers = parsed.studentAnswers;
        if (parsed.flaggedQuestions) restoredFlags = parsed.flaggedQuestions;
      }
    } catch {
      // Ignore parse errors
    }

    setActiveExamCard(confirmingExamCard);
    setActiveAttemptId(attemptId);
    setRemainingSeconds(durationSec);
    setStudentAnswers(restoredAnswers);
    setFlaggedQuestions(restoredFlags);
    setQuestionNavFilter('ALL');
    setConfirmingExamCard(null);
    setPortalStage('TAKING_EXAM');
  };

  // Step 6 -> Step 7: Finalize & Submit Examination
  const handleFinalizeSubmission = useCallback(() => {
    if (!activeExamCard) return;
    const exam = activeExamCard.exam;
    const summary = autoGradeExamSubmission(
      activeExamQuestions,
      studentAnswers
    );

    let totalAutoEarned = 0;
    const answersToSave = summary.items.map((item) => {
      totalAutoEarned += item.scoreAwarded;
      const ansInput = studentAnswers[item.questionId] || {
        questionId: item.questionId,
      };
      return {
        questionId: item.questionId,
        answerJson: JSON.stringify(ansInput),
        scoreAwarded: item.scoreAwarded,
        isCorrect: item.isCorrect,
        gradedByUserId: item.requiresManualGrading ? '' : 'SYSTEM',
      };
    });

    const maxScore = activeExamCard.totalMarks || exam.MaximumScore || 100;
    const pct =
      maxScore > 0 ? Math.round((totalAutoEarned / maxScore) * 100) : 0;
    const normalized50 =
      maxScore > 0 ? (totalAutoEarned / maxScore) * 50 : 0;
    const rawGrade = calculateMoEYSGrade(normalized50, 50);
    const gradeLetter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' =
      rawGrade === 'មិនចាត់ថ្នាក់' ? 'F' : rawGrade;

    // Follow Result Publication Rules:
    // Newly submitted exams have AttemptStatus = 'SUBMITTED' until a teacher or admin publishes/grades them.
    let savedAttempt: ExamAttemptRecord;
    if (onSubmitExamAttempt) {
      savedAttempt = onSubmitExamAttempt({
        examId: exam.ExamID,
        studentId: student.StudentID,
        scoreObtained: totalAutoEarned,
        percentage: pct,
        grade: gradeLetter,
        attemptStatus: 'SUBMITTED',
        answersToSave,
      });
    } else {
      const nowIso = new Date().toISOString();
      savedAttempt = {
        AttemptID: activeAttemptId || `ATT-${Date.now()}`,
        ExamID: exam.ExamID,
        StudentID: student.StudentID,
        AttemptNumber: 1,
        StartedAt: nowIso,
        SubmittedAt: nowIso,
        ServerDeadline: nowIso,
        AttemptStatus: 'SUBMITTED',
        TotalScore: totalAutoEarned,
        CreatedAt: nowIso,
      };
    }

    // Clear auto-save cache on successful submission
    if (autoSaveKey) {
      try {
        localStorage.removeItem(autoSaveKey);
      } catch {
        // ignore
      }
    }

    setIsSubmitConfirmOpen(false);
    setLastSubmittedAttempt(savedAttempt);
    setPortalStage('SUBMISSION_RESULT');
  }, [
    activeExamCard,
    activeExamQuestions,
    studentAnswers,
    db.GradingScales,
    onSubmitExamAttempt,
    student.StudentID,
    activeAttemptId,
    autoSaveKey,
  ]);

  // Countdown timer during Step 6 (Enforces configured examination duration)
  useEffect(() => {
    if (portalStage !== 'TAKING_EXAM') return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          handleFinalizeSubmission();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [portalStage, handleFinalizeSubmission]);

  // Helper to check if a question is answered
  const isQuestionAnswered = (qId: string): boolean => {
    const ans = studentAnswers[qId];
    if (!ans) return false;
    if (typeof ans.selectedIndex === 'number') return true;
    if (typeof ans.booleanAnswer === 'boolean') return true;
    if (ans.textAnswer && ans.textAnswer.trim().length > 0) return true;
    return false;
  };

  const answeredCount = useMemo(
    () =>
      activeExamQuestions.filter((q) => isQuestionAnswered(q.QuestionID))
        .length,
    [activeExamQuestions, studentAnswers]
  );

  // Answer handlers for Step 6
  const handleSelectSingleOption = (q: QuestionRecord, optionIdx: number) => {
    if (q.QuestionType === 'TRUE_FALSE') {
      setStudentAnswers((prev) => ({
        ...prev,
        [q.QuestionID]: {
          questionId: q.QuestionID,
          selectedIndex: optionIdx,
          booleanAnswer: optionIdx === 0,
        },
      }));
    } else {
      setStudentAnswers((prev) => ({
        ...prev,
        [q.QuestionID]: {
          questionId: q.QuestionID,
          selectedIndex: optionIdx,
        },
      }));
    }
  };

  const handleToggleCheckboxOption = (q: QuestionRecord, optText: string) => {
    setStudentAnswers((prev) => {
      const currentRaw = prev[q.QuestionID]?.textAnswer || '[]';
      let currentList: string[] = [];
      try {
        const parsed = JSON.parse(currentRaw);
        if (Array.isArray(parsed)) currentList = parsed;
      } catch {
        currentList = [];
      }
      const nextList = currentList.includes(optText)
        ? currentList.filter((item) => item !== optText)
        : [...currentList, optText];
      return {
        ...prev,
        [q.QuestionID]: {
          questionId: q.QuestionID,
          textAnswer: JSON.stringify(nextList),
        },
      };
    });
  };

  const handleTextAnswerChange = (q: QuestionRecord, value: string) => {
    setStudentAnswers((prev) => ({
      ...prev,
      [q.QuestionID]: {
        questionId: q.QuestionID,
        textAnswer: value,
      },
    }));
  };

  const toggleFlagQuestion = (qId: string) => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const formatCountdown = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  // =========================================================================
  // MY RESULTS TAB METRICS (Preserved from existing student result rules)
  // =========================================================================
  const avgScoreVal = myRankedEntry?.averageScore ?? 39.31;
  const rankDisplay = myRankedEntry?.ranking
    ? `លេខ ${toKhmerNumerals(myRankedEntry.ranking)}`
    : 'មិនចាត់ថ្នាក់';
  const gradeDisplay = myRankedEntry?.grade || 'C';

  const subjectBreakdown = useMemo(() => {
    const ratio = avgScoreVal > 0 ? avgScoreVal / 39.31 : 0.75;
    return [
      {
        code: 'SUB-ICT',
        nameKh: 'ព័ត៌មានវិទ្យា (ICT)',
        badge: 'មេដាយមាសប្រចាំខែ',
        score: Math.min(50, Math.round(48 * ratio)),
        maxScore: 50,
        color: 'bg-emerald-500',
      },
      {
        code: 'SUB-MATH',
        nameKh: 'គណិតវិទ្យា',
        badge: 'ពិន្ទុខ្ពស់បំផុត',
        score: Math.min(125, Math.round(115 * ratio)),
        maxScore: 125,
        color: 'bg-blue-600',
      },
      {
        code: 'SUB-ENG',
        nameKh: 'ភាសាអង់គ្លេស',
        badge: 'និទ្ទេសល្អប្រសើរ',
        score: Math.min(50, Math.round(45 * ratio)),
        maxScore: 50,
        color: 'bg-indigo-500',
      },
      {
        code: 'SUB-KHM',
        nameKh: 'អក្សរសាស្ត្រខ្មែរ',
        badge: 'តារាងកិត្តិយស Top 5',
        score: Math.min(75, Math.round(66 * ratio)),
        maxScore: 75,
        color: 'bg-amber-500',
      },
      {
        code: 'SUB-PHY',
        nameKh: 'រូបវិទ្យា',
        badge: 'ជាប់មធ្យមភាគ',
        score: Math.min(75, Math.round(64 * ratio)),
        maxScore: 75,
        color: 'bg-sky-500',
      },
    ];
  }, [avgScoreVal]);

  return (
    <div className="space-y-5" data-testid="student-portal-root">
      {/* =====================================================================
          TAB 1: STUDENT ONLINE EXAMINATION PORTAL (WORKFLOW STEPS 2 TO 7)
         ===================================================================== */}
      {activeTab === 'AVAILABLE_EXAMS' && (
        <>
          {/* -----------------------------------------------------------------
              STAGE A: DASHBOARD, SUBJECT SELECTION & EXAMINATION SELECTION
              (Workflow Steps 2, 3, and 4)
             ----------------------------------------------------------------- */}
          {portalStage === 'DASHBOARD_AND_SELECTION' && (
            <div
              className="space-y-6"
              data-testid="student-exam-dashboard-stage"
            >
              {/* STEP 2: STUDENT EXAMINATION DASHBOARD HEADER */}
              <div
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
                data-testid="student-identity-banner"
              >
                <div className="bg-gradient-to-r from-[#1E3A8A] via-[#312E81] to-[#4C1D95] px-5 py-5 sm:px-7 sm:py-6 text-white">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-4">
                      <button
                        type="button"
                        onClick={() => handleSwitchTab('MY_PROFILE')}
                        title="ចុចដើម្បីមើលព័ត៌មានផ្ទាល់ខ្លួន និងដាក់រូប Profile"
                        className="relative w-16 h-16 rounded-2xl p-0.5 bg-white/20 backdrop-blur-xs border-2 border-amber-300/80 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer group"
                      >
                        <img
                          src={studentAvatarUrl}
                          alt={student.FullNameKh}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover rounded-xl"
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-slate-950/75 text-[9px] text-amber-300 font-bold font-khmer-body py-0.5 text-center">
                          រូប Profile
                        </span>
                      </button>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-400/20 border border-emerald-300/30 text-emerald-200 text-xs font-bold font-khmer-body">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>មណ្ឌលប្រឡងសិស្សផ្លូវការ • វិទ្យាល័យទឹកជោរ</span>
                          </span>
                          <span
                            className="px-2.5 py-0.5 rounded-md bg-white/15 text-white text-xs font-mono-tabular font-bold"
                            data-testid="student-dashboard-id"
                          >
                            អត្តលេខ៖ #{student.StudentCode || student.StudentID.replace('STD-', '')} ({student.StudentID})
                          </span>
                        </div>
                        <h2
                          className="text-xl sm:text-2xl font-bold font-khmer-moul tracking-wide text-white"
                          data-testid="student-dashboard-name"
                        >
                          {student.FullNameKh}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-blue-100 font-khmer-body">
                          <span data-testid="student-dashboard-class">
                            ថ្នាក់ទី៖{' '}
                            <strong className="text-white font-bold">
                              {studentClass.ClassName} (កម្រិតថ្នាក់ទី {studentClass.GradeLevel})
                            </strong>
                          </span>
                          <span className="text-blue-300/70">•</span>
                          <span data-testid="student-dashboard-academic-year">
                            ឆ្នាំសិក្សា៖{' '}
                            <strong className="text-white font-bold">
                              {portalCatalog.academicYearName}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Action to switch to Profile & Official Results */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleSwitchTab('MY_PROFILE')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold font-khmer-body transition-colors cursor-pointer shadow-2xs"
                        data-testid="btn-go-to-my-profile"
                      >
                        <UserCircle2 className="w-4 h-4" />
                        <span>ព័ត៌មានផ្ទាល់ខ្លួន & រូប Profile</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSwitchTab('MY_RESULTS')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold font-khmer-body transition-colors cursor-pointer"
                        data-testid="btn-go-to-my-results"
                      >
                        <Award className="w-4 h-4 text-amber-300" />
                        <span>មើលលទ្ធផលប្រឡង និងចំណាត់ថ្នាក់</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dashboard Summary KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 bg-slate-50/60">
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-500 font-khmer-body">
                        វិញ្ញាសាអាចចូលប្រឡងបាន
                      </div>
                      <div
                        className="text-2xl font-extrabold text-emerald-700 font-mono-tabular mt-0.5"
                        data-testid="kpi-available-exams"
                      >
                        {portalCatalog.counts.availableExams}{' '}
                        <span className="text-xs font-bold font-khmer-body text-slate-500">
                          វិញ្ញាសា
                        </span>
                      </div>
                    </div>
                    <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Play className="w-5 h-5" />
                    </span>
                  </div>

                  <div className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-500 font-khmer-body">
                        មុខវិជ្ជាប្រឡងសរុប (ថ្នាក់ {studentClass.ClassName})
                      </div>
                      <div
                        className="text-2xl font-extrabold text-blue-700 font-mono-tabular mt-0.5"
                        data-testid="kpi-total-subjects"
                      >
                        {portalCatalog.counts.totalSubjects}{' '}
                        <span className="text-xs font-bold font-khmer-body text-slate-500">
                          មុខវិជ្ជា
                        </span>
                      </div>
                    </div>
                    <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5" />
                    </span>
                  </div>

                  <div className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-500 font-khmer-body">
                        មិនទាន់ដល់ម៉ោងប្រឡង
                      </div>
                      <div
                        className="text-2xl font-extrabold text-amber-700 font-mono-tabular mt-0.5"
                        data-testid="kpi-upcoming-exams"
                      >
                        {portalCatalog.counts.upcomingExams}{' '}
                        <span className="text-xs font-bold font-khmer-body text-slate-500">
                          វិញ្ញាសា
                        </span>
                      </div>
                    </div>
                    <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" />
                    </span>
                  </div>

                  <div className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-500 font-khmer-body">
                        បានប្រឡងរួចរាល់ (History)
                      </div>
                      <div
                        className="text-2xl font-extrabold text-indigo-700 font-mono-tabular mt-0.5"
                        data-testid="kpi-completed-exams"
                      >
                        {portalCatalog.counts.completedExams}{' '}
                        <span className="text-xs font-bold font-khmer-body text-slate-500">
                          វិញ្ញាសា
                        </span>
                      </div>
                    </div>
                    <span className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <FileCheck2 className="w-5 h-5" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Banner if Backend Access Restriction Triggered */}
              {accessErrorBanner && (
                <div
                  className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start justify-between gap-3 text-rose-800"
                  data-testid="student-access-error-banner"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-xs sm:text-sm font-bold font-khmer-body">
                      {accessErrorBanner}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccessErrorBanner(null)}
                    className="text-rose-500 hover:text-rose-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* STEP 3: SUBJECT SELECTION */}
              <div
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4"
                data-testid="step3-subject-selection"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[11px] font-bold font-khmer-body">
                        ជំហានទី ១
                      </span>
                      <h3 className="text-base font-bold text-slate-900 font-khmer-moul">
                        ជ្រើសរើសមុខវិជ្ជាប្រឡង (Select Subject)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 font-khmer-body">
                      បង្ហាញមុខវិជ្ជាដែលមានសិទ្ធិប្រឡងសម្រាប់ថ្នាក់ទី{' '}
                      <strong className="text-slate-700">
                        {studentClass.ClassName}
                      </strong>{' '}
                      ប៉ុណ្ណោះ
                    </p>
                  </div>

                  {selectedSubjectId !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedSubjectId('ALL')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 font-khmer-body transition-colors cursor-pointer"
                      data-testid="btn-reset-subject-filter"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>បង្ហាញគ្រប់មុខវិជ្ជាទាំងអស់</span>
                    </button>
                  )}
                </div>

                {portalCatalog.subjectCards.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200">
                    <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <div className="text-sm font-bold text-slate-700 font-khmer-body">
                      មិនទាន់មានមុខវិជ្ជាប្រឡងសម្រាប់ថ្នាក់នេះនៅឡើយទេ
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                    {portalCatalog.subjectCards.map((subCard) => {
                      const isSelected =
                        selectedSubjectId === subCard.subject.SubjectID;
                      const badgeStyle = getStatusBadgeStyle(
                        subCard.overallStatus
                      );

                      return (
                        <button
                          key={subCard.subject.SubjectID}
                          type="button"
                          onClick={() =>
                            setSelectedSubjectId(
                              isSelected ? 'ALL' : subCard.subject.SubjectID
                            )
                          }
                          data-testid={`subject-card-${subCard.subject.SubjectID}`}
                          className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                            isSelected
                              ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                              : 'bg-white hover:bg-slate-50/80 border-slate-200/90'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {renderSubjectIcon(
                                subCard.subject.SubjectID,
                                'w-5 h-5'
                              )}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold font-khmer-body ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`}
                              />
                              <span>{subCard.statusLabelKh}</span>
                            </span>
                          </div>

                          <div>
                            <div className="text-sm font-extrabold text-slate-900 font-khmer-body line-clamp-1">
                              {subCard.subject.SubjectNameKh}
                            </div>
                            <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                              {subCard.subject.SubjectNameEn}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs font-khmer-body">
                            <span className="text-slate-600 font-medium">
                              វិញ្ញាសាបើកប្រឡង៖
                            </span>
                            <span className="font-mono-tabular font-extrabold text-slate-900">
                              {subCard.availableExamsCount} /{' '}
                              {subCard.totalExamsCount}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* STEP 4: EXAMINATION SELECTION */}
              <div
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4"
                data-testid="step4-examination-selection"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[11px] font-bold font-khmer-body">
                        ជំហានទី ២
                      </span>
                      <h3 className="text-base font-bold text-slate-900 font-khmer-moul">
                        ជ្រើសរើសវិញ្ញាសាប្រឡង (Select Examination)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 font-khmer-body">
                      សូមពិនិត្យព័ត៌មានវិញ្ញាសា រយៈពេល និងពិន្ទុ មុននឹងចុចប៊ូតុង{' '}
                      <strong className="text-slate-700">
                        «ចាប់ផ្តើមប្រឡង»
                      </strong>
                    </p>
                  </div>

                  {/* Filter Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={examSearchQuery}
                        onChange={(e) => setExamSearchQuery(e.target.value)}
                        placeholder="ស្វែងរកវិញ្ញាសា ឬមុខវិជ្ជា..."
                        className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-khmer-body text-slate-800 focus:outline-none focus:border-blue-600 w-52"
                        data-testid="input-search-student-exams"
                      />
                    </div>

                    <select
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(
                          e.target.value as 'ALL' | StudentExamLifecycleStatus
                        )
                      }
                      aria-label="ជ្រើសរើសស្ថានភាពវិញ្ញាសា"
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold font-khmer-body text-slate-700 bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
                      data-testid="select-status-student-exams"
                    >
                      <option value="ALL">គ្រប់ស្ថានភាពទាំងអស់</option>
                      <option value="AVAILABLE">អាចចូលប្រឡងបាន (Available)</option>
                      <option value="IN_PROGRESS">កំពុងប្រឡង (In Progress)</option>
                      <option value="UPCOMING">មិនទាន់ដល់ម៉ោង (Upcoming)</option>
                      <option value="COMPLETED">បានប្រឡងរួចរាល់ (Completed)</option>
                      <option value="EXPIRED">ផុតកំណត់ម៉ោង (Expired)</option>
                    </select>
                  </div>
                </div>

                {/* Examination Cards Grid */}
                {filteredExamCards.length === 0 ? (
                  <div
                    className="p-10 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 space-y-2"
                    data-testid="empty-exam-selection-state"
                  >
                    <FileText className="w-9 h-9 text-slate-400 mx-auto" />
                    <div className="text-sm font-bold text-slate-800 font-khmer-body">
                      មិនមានវិញ្ញាសាប្រឡងត្រូវនឹងលក្ខខណ្ឌជ្រើសរើសឡើយ
                    </div>
                    <p className="text-xs text-slate-500 font-khmer-body">
                      សូមជ្រើសរើសមុខវិជ្ជាផ្សេង ឬចុចបង្ហាញគ្រប់ស្ថានភាពទាំងអស់។
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubjectId('ALL');
                        setStatusFilter('ALL');
                        setExamSearchQuery('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-khmer-body cursor-pointer mt-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>បង្ហាញវិញ្ញាសាទាំងអស់ឡើងវិញ</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredExamCards.map((card) => {
                      const badge = getStatusBadgeStyle(card.status);
                      return (
                        <div
                          key={card.exam.ExamID}
                          data-testid={`exam-card-${card.exam.ExamID}`}
                          className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all ${
                            card.canStart
                              ? 'bg-white border-slate-200/90 hover:border-blue-400 shadow-2xs'
                              : 'bg-slate-50/70 border-slate-200/80'
                          }`}
                        >
                          {/* Top Row: Subject & Type + Status Badge */}
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center shrink-0">
                                  {renderSubjectIcon(
                                    card.subject.SubjectID,
                                    'w-5 h-5'
                                  )}
                                </span>
                                <div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs font-extrabold text-blue-700 font-khmer-body">
                                      {card.subject.SubjectNameKh}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold font-khmer-body">
                                      {card.examTypeLabelKh}
                                    </span>
                                  </div>
                                  <h4 className="text-base font-extrabold text-slate-900 font-khmer-body mt-0.5 leading-snug">
                                    {card.exam.ExamTitle}
                                  </h4>
                                </div>
                              </div>

                              <span
                                data-testid={`exam-status-badge-${card.exam.ExamID}`}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold font-khmer-body shrink-0 ${badge.bg} ${badge.text} ${badge.border}`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${badge.dot}`}
                                />
                                <span>{card.statusLabelKh}</span>
                              </span>
                            </div>

                            {/* Metadata Grid: Date, Start/End Time, Duration, Questions, Total Marks, Passing Marks */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs font-khmer-body">
                              <div>
                                <div className="text-slate-500 flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span>កាលបរិច្ឆេទប្រឡង</span>
                                </div>
                                <div className="font-bold text-slate-900 mt-0.5">
                                  {card.examDateDisplay}
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>ម៉ោងចាប់ផ្តើម - បញ្ចប់</span>
                                </div>
                                <div className="font-mono-tabular font-bold text-slate-900 mt-0.5">
                                  {card.startTimeDisplay} – {card.endTimeDisplay}
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-500 flex items-center gap-1">
                                  <Timer className="w-3.5 h-3.5 text-slate-400" />
                                  <span>រយៈពេលប្រឡង</span>
                                </div>
                                <div className="font-bold text-slate-900 mt-0.5">
                                  {toKhmerNumerals(card.durationMinutes)} នាទី (
                                  {card.durationMinutes}m)
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-500">ចំនួនសំណួរសរុប</div>
                                <div className="font-bold text-slate-900 mt-0.5">
                                  {toKhmerNumerals(card.totalQuestions)} សំណួរ (
                                  {card.totalQuestions} Qs)
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-500">ពិន្ទុសរុប (Total Marks)</div>
                                <div className="font-mono-tabular font-extrabold text-slate-900 mt-0.5">
                                  {card.totalMarks} ពិន្ទុ
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-500">ពិន្ទុជាប់ (Pass Marks)</div>
                                <div className="font-mono-tabular font-bold text-emerald-700 mt-0.5">
                                  {card.passingMarks} ពិន្ទុ
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Action Footer: Show Start Examination ONLY when Available / In Progress */}
                          <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs font-khmer-body text-slate-600">
                              {card.status === 'COMPLETED' && (
                                <span className="inline-flex items-center gap-1.5 font-bold text-indigo-700">
                                  <CheckCircle2 className="w-4 h-4" />
                                  {card.isResultPublished ? (
                                    <span>
                                      ប្រកាសលទ្ធផលរួចរាល់៖{' '}
                                      <strong>
                                        {card.latestAttempt?.TotalScore} /{' '}
                                        {card.totalMarks} ពិន្ទុ
                                      </strong>
                                    </span>
                                  ) : (
                                    <span>
                                      បានដាក់ស្នើរួចរាល់ • រង់ចាំគ្រូប្រកាសលទ្ធផល
                                    </span>
                                  )}
                                </span>
                              )}
                              {card.status === 'UPCOMING' && (
                                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                                  <Clock className="w-4 h-4" />
                                  <span>
                                    បើកនៅថ្ងៃទី {card.examDateDisplay}
                                  </span>
                                </span>
                              )}
                              {card.status === 'EXPIRED' && (
                                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-500">
                                  <Lock className="w-4 h-4" />
                                  <span>វិញ្ញាសានេះបានផុតកំណត់ម៉ោងប្រឡងហើយ</span>
                                </span>
                              )}
                              {(card.status === 'AVAILABLE' ||
                                card.status === 'IN_PROGRESS') && (
                                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                                  <Sparkles className="w-4 h-4" />
                                  <span>
                                    អនុញ្ញាតឱ្យប្រឡង (នៅសល់{' '}
                                    {card.remainingAttempts} លើក)
                                  </span>
                                </span>
                              )}
                            </div>

                            {card.canStart ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRequestOpenConfirmation(card)
                                }
                                data-testid={`btn-start-exam-${card.exam.ExamID}`}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-khmer-body shadow-xs transition-colors cursor-pointer"
                              >
                                <Play className="w-4 h-4 fill-current" />
                                <span>
                                  {card.status === 'IN_PROGRESS'
                                    ? 'បន្តការប្រឡង (Resume Exam)'
                                    : 'ចាប់ផ្តើមប្រឡង (Start Examination)'}
                                </span>
                              </button>
                            ) : card.status === 'COMPLETED' &&
                              card.latestAttempt ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveExamCard(card);
                                  setLastSubmittedAttempt(
                                    card.latestAttempt || null
                                  );
                                  setPortalStage('SUBMISSION_RESULT');
                                }}
                                data-testid={`btn-view-submission-${card.exam.ExamID}`}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
                              >
                                <FileCheck2 className="w-4 h-4" />
                                <span>
                                  {card.isResultPublished
                                    ? 'មើលលទ្ធផលផ្លូវការ'
                                    : 'មើលបង្កាន់ដៃដាក់ស្នើ'}
                                </span>
                              </button>
                            ) : (
                              <span
                                data-testid={`btn-disabled-exam-${card.exam.ExamID}`}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-200/80 text-slate-500 text-xs font-bold font-khmer-body cursor-not-allowed"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>{card.statusLabelKh}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* STEP 2 (PART B): EXAMINATION HISTORY & RESULT PUBLICATION STATUS */}
              <div
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4"
                data-testid="student-examination-history"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-base font-bold text-slate-900 font-khmer-moul">
                      ប្រវត្តិនៃការប្រឡងរបស់សិស្ស (Examination History)
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-slate-500 font-khmer-body">
                    ពិន្ទុផ្លូវការនឹងបង្ហាញតែក្រោយពេលគ្រូបង្រៀនពិនិត្យ និងប្រកាសលទ្ធផលប៉ុណ្ណោះ
                  </span>
                </div>

                {portalCatalog.examHistory.length === 0 ? (
                  <div className="p-6 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs font-bold text-slate-500 font-khmer-body">
                    មិនទាន់មានប្រវត្តិប្រឡងនៅឡើយទេ។
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 font-khmer-body bg-slate-50/80">
                          <th className="py-2.5 px-3">វិញ្ញាសាប្រឡង</th>
                          <th className="py-2.5 px-3">មុខវិជ្ជា</th>
                          <th className="py-2.5 px-3">ម៉ោងដាក់ស្នើ</th>
                          <th className="py-2.5 px-3">ស្ថានភាពប្រកាសលទ្ធផល</th>
                          <th className="py-2.5 px-3 text-right">ពិន្ទុផ្លូវការ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 text-xs font-khmer-body">
                        {portalCatalog.examHistory.map((hist) => (
                          <tr
                            key={hist.attempt.AttemptID}
                            className="hover:bg-slate-50/80"
                          >
                            <td className="py-3 px-3 font-bold text-slate-900">
                              {hist.exam.ExamTitle}
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-semibold">
                              {hist.subject.SubjectNameKh}
                            </td>
                            <td className="py-3 px-3 text-slate-600 font-mono-tabular">
                              {hist.submittedDateDisplay} •{' '}
                              {hist.submittedTimeDisplay}
                            </td>
                            <td className="py-3 px-3">
                              {hist.isResultPublished ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{hist.statusLabelKh}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{hist.statusLabelKh}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono-tabular font-extrabold">
                              {hist.isResultPublished &&
                              hist.publishedScore ? (
                                <span className="text-emerald-700">
                                  {hist.publishedScore.scoreObtained} /{' '}
                                  {hist.publishedScore.maxScore} ពិន្ទុ
                                </span>
                              ) : (
                                <span className="text-slate-400 font-khmer-body font-semibold">
                                  រង់ចាំការប្រកាសលទ្ធផល
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              STAGE B: STEP 6 – TAKING EXAMINATION INTERFACE
             ----------------------------------------------------------------- */}
          {portalStage === 'TAKING_EXAM' && activeExamCard && (
            <div
              className="space-y-4"
              data-testid="step6-taking-examination-stage"
            >
              {/* Top Sticky Examination Bar: Title, Student Info, Countdown Timer & Submit */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs sticky top-2 z-20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPortalStage('DASHBOARD_AND_SELECTION')}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    title="ត្រឡប់ទៅផ្ទាំងវិញ្ញាសា (ចម្លើយត្រូវបានរក្សាទុកស្វ័យប្រវត្តិ)"
                    data-testid="btn-exit-exam-to-dashboard"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[11px] font-bold font-khmer-body">
                        {activeExamCard.subject.SubjectNameKh}
                      </span>
                      <span className="text-xs font-bold text-slate-500 font-khmer-body">
                        សិស្ស៖ {student.FullNameKh} (#{student.StudentCode} • ថ្នាក់{' '}
                        {studentClass.ClassName})
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body mt-0.5">
                      {activeExamCard.exam.ExamTitle}
                    </h3>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Answered Counter */}
                  <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold font-khmer-body">
                    បានឆ្លើយ៖{' '}
                    <span className="font-mono-tabular text-blue-700">
                      {answeredCount}/{activeExamQuestions.length}
                    </span>{' '}
                    សំណួរ
                  </div>

                  {/* Live Countdown Timer */}
                  <div
                    data-testid="exam-countdown-timer"
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono-tabular text-sm font-extrabold ${
                      remainingSeconds <= 300
                        ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    <Timer className="w-4 h-4" />
                    <span>{formatCountdown(remainingSeconds)}</span>
                  </div>

                  {/* Submit Exam Button */}
                  <button
                    type="button"
                    onClick={() => setIsSubmitConfirmOpen(true)}
                    data-testid="btn-open-submit-exam-modal"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#673AB7] hover:bg-[#5E35B1] text-white text-xs font-bold font-khmer-body shadow-xs cursor-pointer transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>ដាក់ស្នើវិញ្ញាសា (Submit)</span>
                  </button>
                </div>
              </div>

              {/* Question Navigation Strip & Filter */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-700 font-khmer-body flex items-center gap-2">
                    <span>បញ្ជីសំណួរទាំង {toKhmerNumerals(activeExamQuestions.length)}៖</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      (រក្សាទុកចម្លើយស្វ័យប្រវត្តិ • Auto-Saved)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold font-khmer-body">
                    <button
                      type="button"
                      onClick={() => setQuestionNavFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                        questionNavFilter === 'ALL'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      ទាំងអស់ ({activeExamQuestions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionNavFilter('UNANSWERED')}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                        questionNavFilter === 'UNANSWERED'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      មិនទាន់ឆ្លើយ ({activeExamQuestions.length - answeredCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionNavFilter('FLAGGED')}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                        questionNavFilter === 'FLAGGED'
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      ចំណាំពិនិត្យឡើងវិញ
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeExamQuestions.map((q, idx) => {
                    const answered = isQuestionAnswered(q.QuestionID);
                    const flagged = Boolean(flaggedQuestions[q.QuestionID]);
                    return (
                      <a
                        key={q.QuestionID}
                        href={`#student-question-${q.QuestionID}`}
                        className={`w-9 h-9 rounded-xl font-mono-tabular text-xs font-extrabold flex items-center justify-center border transition-all ${
                          flagged
                            ? 'bg-rose-50 border-rose-400 text-rose-700'
                            : answered
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-400'
                        }`}
                      >
                        {idx + 1}
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* GOOGLE FORMS STYLE EXAMINATION CANVAS */}
              <div className="bg-[#F0EBF8] rounded-2xl py-5 px-3 sm:px-6 border border-[#DADCE0]/60">
                <div className="max-w-[720px] mx-auto space-y-4">
                  {/* 1. GOOGLE FORMS HEADER CARD */}
                  <div className="bg-white rounded-xl border border-[#DADCE0] shadow-2xs overflow-hidden">
                    <div className="h-[10px] bg-[#673AB7] w-full" />
                    <div className="px-6 pt-5 pb-4">
                      <h2 className="text-[24px] sm:text-[30px] font-normal text-[#202124] font-khmer-body leading-snug">
                        {activeExamCard.exam.ExamTitle}
                      </h2>
                      <div className="mt-3 space-y-1 text-[14px] sm:text-[15px] text-[#202124] font-khmer-body leading-relaxed">
                        <div>
                          មុខវិជ្ជា៖ {activeExamCard.subject.SubjectNameKh} • ថ្នាក់ទី{' '}
                          {studentClass.ClassName}
                        </div>
                        <div>
                          រយៈពេល៖{' '}
                          {toKhmerNumerals(
                            activeExamCard.exam.DurationMinutes
                          )}{' '}
                          នាទី • ពិន្ទុសរុប៖ {activeExamCard.totalMarks} ពិន្ទុ
                        </div>
                        {activeExamCard.exam.Instructions && (
                          <div className="text-[#5F6368] pt-1">
                            សេចក្តីណែនាំ៖ {activeExamCard.exam.Instructions}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-[#DADCE0] px-6 py-3 text-[13px] sm:text-[14px] text-[#D93025] font-khmer-body flex items-center justify-between">
                      <span>* បង្ហាញថាជាសំណួរដែលចាំបាច់</span>
                      <span className="text-emerald-700 font-semibold">
                        អត្តលេខសិស្ស៖ #{student.StudentCode} ({student.FullNameKh})
                      </span>
                    </div>
                  </div>

                  {/* 2. QUESTION CARDS */}
                  <div className="space-y-4">
                    {activeExamQuestions
                      .filter((q) => {
                        if (questionNavFilter === 'UNANSWERED') {
                          return !isQuestionAnswered(q.QuestionID);
                        }
                        if (questionNavFilter === 'FLAGGED') {
                          return Boolean(flaggedQuestions[q.QuestionID]);
                        }
                        return true;
                      })
                      .map((q, qIdx) => {
                        let options: string[] = [];
                        try {
                          options = JSON.parse(q.OptionsJSON || '[]');
                        } catch {
                          options = [];
                        }
                        const extMeta = parseExtendedQuestionMeta(q);
                        const effectiveUiType =
                          extMeta.uiType ||
                          (q.QuestionType === 'ESSAY'
                            ? 'PARAGRAPH'
                            : q.QuestionType);
                        const myAns = studentAnswers[q.QuestionID];
                        const isFlagged = Boolean(
                          flaggedQuestions[q.QuestionID]
                        );

                        let selectedCheckboxes: string[] = [];
                        if (effectiveUiType === 'CHECKBOXES') {
                          try {
                            const parsed = JSON.parse(
                              myAns?.textAnswer || '[]'
                            );
                            if (Array.isArray(parsed))
                              selectedCheckboxes = parsed;
                          } catch {
                            selectedCheckboxes = [];
                          }
                        }

                        return (
                          <div
                            key={q.QuestionID}
                            id={`student-question-${q.QuestionID}`}
                            data-testid={`taking-question-card-${q.QuestionID}`}
                            className="bg-white rounded-xl border border-[#DADCE0] p-6 shadow-2xs space-y-4"
                          >
                            {/* Question Header */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="text-[16px] sm:text-[17px] font-normal text-[#202124] font-khmer-body leading-[1.65]">
                                <span className="font-bold text-[#673AB7] mr-2">
                                  {toKhmerNumerals(qIdx + 1)}.
                                </span>
                                {q.QuestionText}
                              </div>

                              <div className="shrink-0 flex items-center gap-2 pt-0.5 whitespace-nowrap">
                                <span className="text-[13px] font-khmer-body text-[#5F6368]">
                                  <span className="text-[#D93025] font-bold mr-0.5">
                                    *
                                  </span>
                                  {q.Points} ពិន្ទុ
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleFlagQuestion(q.QuestionID)
                                  }
                                  title="ចំណាំដើម្បីពិនិត្យឡើងវិញ"
                                  className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                    isFlagged
                                      ? 'bg-rose-50 border-rose-300 text-rose-600'
                                      : 'border-slate-200 text-slate-400 hover:text-slate-600'
                                  }`}
                                >
                                  <Flag className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Optional Question Image */}
                            {q.ImageFileID && q.ImageFileID.startsWith('http') && (
                              <div className="rounded-xl overflow-hidden border border-slate-200 max-h-64">
                                <img
                                  src={q.ImageFileID}
                                  alt="រូបភាពសំណួរ"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-auto object-contain max-h-60"
                                />
                              </div>
                            )}

                            {/* Multiple Choice & True/False */}
                            {(effectiveUiType === 'MCQ' ||
                              effectiveUiType === 'TRUE_FALSE') && (
                              <div className="space-y-3.5 pt-1">
                                {options.map((optText, optIdx) => {
                                  const isSelected =
                                    myAns?.selectedIndex === optIdx;
                                  return (
                                    <div
                                      key={optIdx}
                                      onClick={() =>
                                        handleSelectSingleOption(q, optIdx)
                                      }
                                      data-testid={`option-${q.QuestionID}-${optIdx}`}
                                      className="flex items-start gap-3.5 cursor-pointer py-1 group"
                                    >
                                      <span
                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                          isSelected
                                            ? 'border-[#673AB7] bg-white'
                                            : 'border-[#5F6368] group-hover:border-[#202124] bg-white'
                                        }`}
                                      >
                                        {isSelected && (
                                          <span className="w-2.5 h-2.5 rounded-full bg-[#673AB7]" />
                                        )}
                                      </span>
                                      <span className="text-[15px] sm:text-[16px] text-[#202124] font-khmer-body leading-relaxed">
                                        {optText}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Checkboxes (Multiple Selection) */}
                            {effectiveUiType === 'CHECKBOXES' && (
                              <div className="space-y-3 pt-1">
                                {options.map((optText, optIdx) => {
                                  const checked =
                                    selectedCheckboxes.includes(optText);
                                  return (
                                    <label
                                      key={optIdx}
                                      className="flex items-start gap-3.5 cursor-pointer py-1"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() =>
                                          handleToggleCheckboxOption(q, optText)
                                        }
                                        className="w-4 h-4 mt-1 accent-[#673AB7] rounded cursor-pointer"
                                      />
                                      <span className="text-[15px] text-[#202124] font-khmer-body">
                                        {optText}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {/* Dropdown */}
                            {effectiveUiType === 'DROPDOWN' && (
                              <div className="pt-1">
                                <select
                                  value={
                                    typeof myAns?.selectedIndex === 'number'
                                      ? String(myAns.selectedIndex)
                                      : ''
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') return;
                                    handleSelectSingleOption(q, Number(val));
                                  }}
                                  className="w-full sm:w-72 px-3.5 py-2.5 rounded-lg border border-[#DADCE0] text-sm font-khmer-body text-[#202124] focus:outline-none focus:border-[#673AB7]"
                                >
                                  <option value="">ជ្រើសរើសចម្លើយ...</option>
                                  {options.map((optText, optIdx) => (
                                    <option key={optIdx} value={optIdx}>
                                      {optText}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Linear Scale */}
                            {effectiveUiType === 'LINEAR_SCALE' && (
                              <div className="pt-2 flex flex-wrap items-center gap-4">
                                <span className="text-xs text-[#5F6368] font-khmer-body">
                                  {extMeta.scaleMinLabel}
                                </span>
                                <div className="flex items-center gap-3">
                                  {Array.from(
                                    {
                                      length:
                                        (extMeta.scaleMax || 5) -
                                        (extMeta.scaleMin || 1) +
                                        1,
                                    },
                                    (_, i) => (extMeta.scaleMin || 1) + i
                                  ).map((val) => {
                                    const selected =
                                      myAns?.textAnswer === String(val);
                                    return (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() =>
                                          handleTextAnswerChange(q, String(val))
                                        }
                                        className={`w-9 h-9 rounded-full border text-xs font-bold cursor-pointer ${
                                          selected
                                            ? 'bg-[#673AB7] border-[#673AB7] text-white'
                                            : 'border-[#DADCE0] text-[#202124] hover:bg-slate-50'
                                        }`}
                                      >
                                        {val}
                                      </button>
                                    );
                                  })}
                                </div>
                                <span className="text-xs text-[#5F6368] font-khmer-body">
                                  {extMeta.scaleMaxLabel}
                                </span>
                              </div>
                            )}

                            {/* Date / Time */}
                            {effectiveUiType === 'DATE' && (
                              <input
                                type="date"
                                value={myAns?.textAnswer || ''}
                                onChange={(e) =>
                                  handleTextAnswerChange(q, e.target.value)
                                }
                                className="px-3.5 py-2 rounded-lg border border-[#DADCE0] text-sm text-[#202124]"
                              />
                            )}
                            {effectiveUiType === 'TIME' && (
                              <input
                                type="time"
                                value={myAns?.textAnswer || ''}
                                onChange={(e) =>
                                  handleTextAnswerChange(q, e.target.value)
                                }
                                className="px-3.5 py-2 rounded-lg border border-[#DADCE0] text-sm text-[#202124]"
                              />
                            )}

                            {/* Short Answer */}
                            {effectiveUiType === 'SHORT_ANSWER' && (
                              <div className="pt-1">
                                <input
                                  type="text"
                                  value={myAns?.textAnswer || ''}
                                  onChange={(e) =>
                                    handleTextAnswerChange(q, e.target.value)
                                  }
                                  placeholder="ចម្លើយខ្លីរបស់អ្នក..."
                                  data-testid={`input-short-answer-${q.QuestionID}`}
                                  className="w-full sm:w-2/3 border-b border-[#DADCE0] focus:border-[#673AB7] focus:border-b-2 py-2 text-[15px] text-[#202124] font-khmer-body focus:outline-none"
                                />
                              </div>
                            )}

                            {/* Paragraph / Essay */}
                            {effectiveUiType === 'PARAGRAPH' && (
                              <div className="pt-1">
                                <textarea
                                  rows={4}
                                  value={myAns?.textAnswer || ''}
                                  onChange={(e) =>
                                    handleTextAnswerChange(q, e.target.value)
                                  }
                                  placeholder="សរសេរចម្លើយបកស្រាយរបស់អ្នកនៅទីនេះ..."
                                  data-testid={`textarea-essay-${q.QuestionID}`}
                                  className="w-full rounded-xl border border-[#DADCE0] focus:border-[#673AB7] p-3 text-[15px] text-[#202124] font-khmer-body focus:outline-none"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* 3. BOTTOM SUBMIT & CLEAR BAR */}
                  <div className="flex items-center justify-between pt-2 pb-2">
                    <button
                      type="button"
                      onClick={() => setIsSubmitConfirmOpen(true)}
                      data-testid="btn-bottom-submit-exam"
                      className="bg-[#673AB7] hover:bg-[#5E35B1] text-white font-khmer-body text-sm font-semibold px-6 py-2.5 rounded-lg shadow-xs cursor-pointer transition-colors inline-flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>ដាក់ស្នើចម្លើយ (Submit Examination)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStudentAnswers({})}
                      className="text-[#673AB7] hover:bg-[#673AB7]/10 font-khmer-body text-sm font-semibold px-3 py-2 rounded-lg cursor-pointer transition-colors"
                    >
                      សម្អាតទម្រង់បែបបទ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              STAGE C: STEP 7 – EXAMINATION RESULT & PUBLICATION PRIVACY SCREEN
             ----------------------------------------------------------------- */}
          {portalStage === 'SUBMISSION_RESULT' && activeExamCard && (
            <div
              className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
              data-testid="step7-submission-result-stage"
            >
              <div className="h-2.5 bg-gradient-to-r from-[#673AB7] via-indigo-600 to-emerald-600 w-full" />
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold font-khmer-body">
                      បានកត់ត្រាចម្លើយចូលប្រព័ន្ធរួចរាល់
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 font-khmer-moul">
                      {activeExamCard.exam.ExamTitle}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 font-khmer-body">
                      មុខវិជ្ជា៖{' '}
                      <strong>{activeExamCard.subject.SubjectNameKh}</strong> •
                      សិស្ស៖ <strong>{student.FullNameKh}</strong> (#
                      {student.StudentCode} • ថ្នាក់ {studentClass.ClassName})
                    </p>
                  </div>
                </div>

                {/* Submission Receipt Details */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-khmer-body">
                  <div>
                    <div className="text-slate-500">លេខសម្គាល់ការប្រឡង</div>
                    <div className="font-mono-tabular font-bold text-slate-900 mt-0.5">
                      {lastSubmittedAttempt?.AttemptID || 'ATT-SUBMITTED'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">ម៉ោងដាក់ស្នើ</div>
                    <div className="font-mono-tabular font-bold text-slate-900 mt-0.5">
                      {formatExamDateKh(
                        lastSubmittedAttempt?.SubmittedAt ||
                          new Date().toISOString()
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">ស្ថានភាពលទ្ធផល</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {lastSubmittedAttempt?.AttemptStatus === 'GRADED'
                        ? 'បានប្រកាសលទ្ធផលផ្លូវការ'
                        : 'រង់ចាំគ្រូប្រកាសលទ្ធផល'}
                    </div>
                  </div>
                </div>

                {/* Result Publication Rule Enforcement:
                    Do NOT reveal scores or correct answers before teacher/admin publishes them (AttemptStatus === 'GRADED') */}
                {lastSubmittedAttempt?.AttemptStatus === 'GRADED' ? (
                  <div
                    className="p-5 rounded-2xl bg-emerald-50/90 border border-emerald-200 space-y-2"
                    data-testid="published-exam-score-box"
                  >
                    <div className="text-xs font-bold text-emerald-800 font-khmer-body flex items-center gap-1.5">
                      <Award className="w-4 h-4" />
                      <span>លទ្ធផលផ្លូវការត្រូវបានអនុម័ត និងប្រកាសដោយគ្រូបង្រៀន</span>
                    </div>
                    <div className="text-3xl font-extrabold text-emerald-900 font-mono-tabular">
                      {lastSubmittedAttempt.TotalScore} /{' '}
                      {activeExamCard.totalMarks}{' '}
                      <span className="text-sm font-khmer-body font-bold">
                        ពិន្ទុ
                      </span>
                    </div>
                    <div className="text-xs font-bold text-emerald-700 font-khmer-body">
                      លទ្ធផល៖{' '}
                      {lastSubmittedAttempt.TotalScore >=
                      activeExamCard.passingMarks
                        ? 'ជាប់មធ្យមភាគ (PASSED)'
                        : 'ធ្លាក់មធ្យមភាគ (FAILED)'}
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-5 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-2"
                    data-testid="unpublished-exam-notice-box"
                  >
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-sm font-khmer-body">
                      <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        ចម្លើយរបស់អ្នកត្រូវបានរក្សាទុកដោយសុវត្ថិភាព (រង់ចាំការប្រកាសលទ្ធផល)
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 font-khmer-body leading-relaxed">
                      យោងតាមគោលការណ៍ប្រឡងរបស់វិទ្យាល័យទឹកជោរ ពិន្ទុ និងចម្លើយត្រឹមត្រូវនឹងមិនត្រូវបានបង្ហាញភ្លាមៗនោះទេ រហូតដល់គ្រូបង្រៀនមុខវិជ្ជា ឬគណៈគ្រប់គ្រងពិនិត្យកែពិន្ទុ និងប្រកាសលទ្ធផលផ្លូវការ។
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPortalStage('DASHBOARD_AND_SELECTION')}
                    data-testid="btn-return-to-exam-dashboard"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-khmer-body cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>ត្រឡប់ទៅផ្ទាំងជ្រើសរើសវិញ្ញាសា</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPortalStage('DASHBOARD_AND_SELECTION');
                      handleSwitchTab('MY_RESULTS');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold font-khmer-body cursor-pointer"
                  >
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>ទៅកាន់ផ្ទាំងលទ្ធផលប្រឡងសរុប</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              STEP 5: EXAMINATION CONFIRMATION DIALOG (MODAL)
             ----------------------------------------------------------------- */}
          {confirmingExamCard && (
            <div
              className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
              data-testid="step5-exam-confirmation-modal"
            >
              <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="bg-gradient-to-r from-[#1E3A8A] to-[#4C1D95] px-6 py-4 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-amber-300" />
                    <h3 className="text-base font-bold font-khmer-moul">
                      បញ្ជាក់មុនចូលប្រឡង (Examination Confirmation)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmingExamCard(null)}
                    className="text-white/80 hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Exam Summary Details */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-blue-700 font-khmer-body">
                      {confirmingExamCard.subject.SubjectNameKh} (
                      {confirmingExamCard.examTypeLabelKh})
                    </span>
                    <h4
                      className="text-lg font-extrabold text-slate-900 font-khmer-body"
                      data-testid="confirm-modal-exam-title"
                    >
                      {confirmingExamCard.exam.ExamTitle}
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-khmer-body">
                    <div>
                      <span className="text-slate-500">មុខវិជ្ជា (Subject)៖</span>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {confirmingExamCard.subject.SubjectNameKh}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">រយៈពេល (Duration)៖</span>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {toKhmerNumerals(
                          confirmingExamCard.exam.DurationMinutes
                        )}{' '}
                        នាទី ({confirmingExamCard.exam.DurationMinutes} Minutes)
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">
                        ចំនួនសំណួរ (Total Questions)៖
                      </span>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {toKhmerNumerals(confirmingExamCard.totalQuestions)}{' '}
                        សំណួរ
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">
                        ពិន្ទុសរុប / ពិន្ទុជាប់៖
                      </span>
                      <div className="font-mono-tabular font-bold text-slate-900 mt-0.5">
                        {confirmingExamCard.totalMarks} ពិន្ទុ (ជាប់៖{' '}
                        {confirmingExamCard.passingMarks})
                      </div>
                    </div>
                  </div>

                  {/* Important Instructions */}
                  <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 space-y-2 text-xs font-khmer-body text-amber-950">
                    <div className="font-extrabold flex items-center gap-1.5 text-amber-900">
                      <Info className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>បទបញ្ជា និងសេចក្តីណែនាំសំខាន់ៗមុនចាប់ផ្តើមប្រឡង៖</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-amber-900 leading-relaxed">
                      <li>
                        {confirmingExamCard.exam.Instructions ||
                          'សូមអានសំណួរនីមួយៗឱ្យបានច្បាស់លាស់មុននឹងជ្រើសរើសចម្លើយ។'}
                      </li>
                      <li>
                        ម៉ោងប្រឡងនឹងរាប់ថយក្រោយដោយស្វ័យប្រវត្តិ ({confirmingExamCard.exam.DurationMinutes} នាទី) ហើយប្រព័ន្ធនឹងបិទនៅពេលអស់ម៉ោង។
                      </li>
                      <li>
                        វិញ្ញាសានេះអនុញ្ញាតឱ្យដាក់ស្នើតែ{' '}
                        <strong>
                          {confirmingExamCard.exam.AttemptLimit || 1} លើក
                        </strong>{' '}
                        ប៉ុណ្ណោះ (មិនអាចដាក់ស្នើស្ទួនបានទេ)។
                      </li>
                    </ul>
                  </div>

                  {/* Confirmation Checkbox */}
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasAcceptedInstructions}
                      onChange={(e) =>
                        setHasAcceptedInstructions(e.target.checked)
                      }
                      data-testid="checkbox-confirm-exam-instructions"
                      className="w-4 h-4 mt-0.5 accent-blue-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800 font-khmer-body leading-relaxed">
                      ខ្ញុំបានអាន និងយល់ព្រមតាមសេចក្តីណែនាំខាងលើ ហើយត្រៀមខ្លួនរួចរាល់ដើម្បីចាប់ផ្តើមប្រឡង។
                    </span>
                  </label>

                  {/* Modal Buttons */}
                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingExamCard(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 font-khmer-body cursor-pointer"
                    >
                      បោះបង់ (Cancel)
                    </button>
                    <button
                      type="button"
                      disabled={!hasAcceptedInstructions}
                      onClick={handleConfirmAndStartExam}
                      data-testid="btn-confirm-enter-exam"
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold font-khmer-body transition-colors ${
                        hasAcceptedInstructions
                          ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <span>យល់ព្រម និងចាប់ផ្តើមប្រឡង</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              STEP 6 SUBMIT CONFIRMATION MODAL
             ----------------------------------------------------------------- */}
          {isSubmitConfirmOpen && activeExamCard && (
            <div
              className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
              data-testid="modal-confirm-final-submission"
            >
              <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#673AB7] flex items-center justify-center shrink-0">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 font-khmer-moul">
                      បញ្ជាក់ការដាក់ស្នើវិញ្ញាសា
                    </h4>
                    <p className="text-xs text-slate-500 font-khmer-body">
                      {activeExamCard.exam.ExamTitle}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-khmer-body space-y-1">
                  <div>
                    សំណួរបានឆ្លើយ៖{' '}
                    <strong className="font-mono-tabular text-blue-700">
                      {answeredCount} / {activeExamQuestions.length}
                    </strong>{' '}
                    សំណួរ
                  </div>
                  {answeredCount < activeExamQuestions.length && (
                    <div className="text-rose-600 font-bold">
                      ប្រុងប្រយ័ត្ន៖ អ្នកនៅសល់{' '}
                      {activeExamQuestions.length - answeredCount}{' '}
                      សំណួរមិនទាន់បានឆ្លើយ!
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-600 font-khmer-body leading-relaxed">
                  ក្រោយពេលចុច «បញ្ជាក់ការដាក់ស្នើ» អ្នកមិនអាចកែប្រែចម្លើយ ឬប្រឡងម្តងទៀតបានឡើយ។
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSubmitConfirmOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 font-khmer-body cursor-pointer"
                  >
                    ពិនិត្យចម្លើយឡើងវិញ
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalizeSubmission}
                    data-testid="btn-confirm-final-submit"
                    className="px-5 py-2 rounded-xl bg-[#673AB7] hover:bg-[#5E35B1] text-white text-xs font-bold font-khmer-body cursor-pointer shadow-xs"
                  >
                    បញ្ជាក់ការដាក់ស្នើ (Submit Now)
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          TAB 2: MY RESULTS & ACHIEVEMENTS (Preserved Class-Scoped Results)
         ===================================================================== */}
      {activeTab === 'MY_RESULTS' && (
        <div className="space-y-5" data-testid="student-my-results-tab">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200/80 p-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-khmer-moul">
                  លទ្ធផលប្រឡង និងចំណាត់ថ្នាក់ផ្លូវការ • សិស្ស {student.FullNameKh} (#{student.StudentCode})
                </h3>
                <p className="text-xs text-slate-500 font-khmer-body">
                  ថ្នាក់ទី {studentClass.ClassName} • ឆ្នាំសិក្សា{' '}
                  {portalCatalog.academicYearName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSwitchTab('AVAILABLE_EXAMS')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-khmer-body cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>ត្រឡប់ទៅជ្រើសរើសវិញ្ញាសាប្រឡង</span>
            </button>
          </div>

          {/* Total Class Student Count + Monthly, Semester & Annual Standing Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Class Student Count (សិស្សសរុបក្នុងថ្នាក់) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-500 font-khmer-body">
                  សិស្សសរុបក្នុងថ្នាក់ {studentClass.ClassName}
                </div>
                <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono-tabular mt-1">
                {totalClassStudents}{' '}
                <span className="text-sm font-bold font-khmer-body text-slate-600">
                  នាក់
                </span>
              </div>
              <div className="text-xs text-slate-600 font-bold font-khmer-body mt-1">
                ស្រី {femaleClassStudents} នាក់ • ជាប់មធ្យមភាគ{' '}
                {passedClassStudents} នាក់
              </div>
            </div>

            {/* Card 2: Monthly Standing */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)]">
              <div className="text-xs font-bold text-slate-500 font-khmer-body">
                លទ្ធផលប្រចាំខែវិច្ឆិកា (ថ្នាក់ {studentClass.ClassName})
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono-tabular mt-1">
                {avgScoreVal.toFixed(2)}
              </div>
              <div className="text-xs text-emerald-700 font-bold font-khmer-body mt-1">
                ចំណាត់ថ្នាក់ {rankDisplay} /{' '}
                {toKhmerNumerals(totalClassStudents)} នាក់ • និទ្ទេស{' '}
                {gradeDisplay}
              </div>
            </div>

            {/* Card 3: Semester 1 Standing */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)]">
              <div className="text-xs font-bold text-slate-500 font-khmer-body">
                លទ្ធផលប្រចាំឆមាសទី១ (ថ្នាក់ {studentClass.ClassName})
              </div>
              <div className="text-2xl font-extrabold text-blue-700 font-mono-tabular mt-1">
                {(mySemesterResult?.AverageScore ?? avgScoreVal).toFixed(2)}
              </div>
              <div className="text-xs text-blue-700 font-bold font-khmer-body mt-1">
                ចំណាត់ថ្នាក់ លេខ{' '}
                {toKhmerNumerals(
                  mySemesterResult?.Ranking || myRankedEntry?.ranking || 1
                )}{' '}
                / {toKhmerNumerals(totalClassStudents)} នាក់ • និទ្ទេស{' '}
                {mySemesterResult?.Grade || gradeDisplay}
              </div>
            </div>

            {/* Card 4: Annual Standing */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)]">
              <div className="text-xs font-bold text-slate-500 font-khmer-body">
                លទ្ធផលប្រចាំឆ្នាំសិក្សា (ថ្នាក់ {studentClass.ClassName})
              </div>
              <div className="text-2xl font-extrabold text-indigo-700 font-mono-tabular mt-1">
                {(myAnnualResult?.AnnualAverage ?? 45.8).toFixed(2)}
              </div>
              <div className="text-xs text-indigo-700 font-bold font-khmer-body mt-1">
                ចំណាត់ថ្នាក់ លេខ{' '}
                {toKhmerNumerals(myAnnualResult?.Ranking || 1)} /{' '}
                {toKhmerNumerals(totalClassStudents)} នាក់ • និទ្ទេស{' '}
                {myAnnualResult?.Grade || 'A'}
              </div>
            </div>
          </div>

          {/* Subject-by-Subject Score Breakdown with Visual Progress Bars */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-extrabold text-slate-900 font-khmer-moul">
                  ពិន្ទុតាមមុខវិជ្ជា និងសមិទ្ធផល (Subject-by-Subject Breakdown)
                </h4>
              </div>
              <span className="text-xs font-bold text-slate-500 font-khmer-body">
                ថ្នាក់ទី {studentClass.ClassName} • {subjectBreakdown.length}{' '}
                មុខវិជ្ជាគោល
              </span>
            </div>

            <div className="space-y-3.5">
              {subjectBreakdown.map((item) => {
                const pct = Math.round((item.score / item.maxScore) * 100);
                return (
                  <div
                    key={item.code}
                    className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-khmer-body">
                      <div>
                        <span className="font-bold text-slate-900">
                          {item.nameKh}
                        </span>
                        <span className="ml-2 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-600">
                          {item.badge}
                        </span>
                      </div>
                      <div className="font-mono-tabular font-extrabold text-slate-900">
                        {item.score} / {item.maxScore} ({pct}%)
                      </div>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Class Honor Roll Top 5 Preview */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-extrabold text-slate-900 font-khmer-moul">
                  តារាងកិត្តិយសប្រចាំខែ ថ្នាក់ទី {studentClass.ClassName} (Top 5
                  Honor Roll)
                </h4>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold font-khmer-body">
                សិស្សសរុបក្នុងថ្នាក់ {studentClass.ClassName}:{' '}
                {totalClassStudents} នាក់ (ស្រី {femaleClassStudents} នាក់)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {top5HonorStudents.map((st, idx) => (
                <div
                  key={st.studentId}
                  className={`p-3 rounded-xl border text-center flex flex-col items-center ${
                    st.studentId === student.StudentID
                      ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20'
                      : 'bg-slate-50/70 border-slate-200/80'
                  }`}
                >
                  <span className="text-xs font-khmer-moul text-amber-700 mb-1.5">
                    លេខ {toKhmerNumerals(idx + 1)}
                  </span>
                  <img
                    src={
                      st.profileImageUrl ||
                      HONOR_PORTRAIT_URLS['DRV-PHOTO-RANK1']
                    }
                    alt={st.displayNameRanking}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-full object-cover border border-slate-300 mb-2"
                  />
                  <div className="text-xs font-bold text-slate-900 font-khmer-body truncate w-full">
                    {st.displayNameRanking}
                  </div>
                  <div className="text-[11px] font-mono-tabular font-semibold text-slate-600 mt-0.5">
                    ម.ភាគ {st.averageScore?.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: MY PERSONAL PROFILE & SELF-SERVICE PROFILE PHOTO
         ===================================================================== */}
      {activeTab === 'MY_PROFILE' && (
        <StudentPersonalProfileCard
          db={db}
          setDb={setDb}
          activeUserId={activeUserId}
          onNavigateExams={() => handleSwitchTab('AVAILABLE_EXAMS')}
          onNavigateResults={() => handleSwitchTab('MY_RESULTS')}
        />
      )}
    </div>
  );
};
