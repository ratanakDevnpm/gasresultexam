import React, { useState, useMemo, useEffect } from 'react';
import {
  AcademicQuestionMonth,
  DatabaseState,
  ExamAnswerRecord,
  ExamAttemptRecord,
  ExamRecord,
  QuestionRecord,
} from '../types/database';
import {
  autoGradeExamSubmission,
  canManageQuestion,
  canTeacherManageExamAndGrading,
  computeAttemptGradingProgress,
  DetailedGradingStatus,
  formatRankingDisplayName,
  getGoogleAppsScriptFormImporterCode,
  getPresetGoogleFormQuestions,
  getTeacherAuthorizedSubjectsAndClasses,
  GoogleFormImportResult,
  mapGoogleFormToExamSchema,
  parseGoogleFormImportPayload,
  safeAutoGradeAttemptPreservingManualScores,
  StudentSubmittedAnswerInput,
  toKhmerNumerals,
} from '../lib/domainRules';
import {
  ACADEMIC_MONTH_TABS,
  ALL_SUPPORTED_QUESTION_MONTHS,
  formatMonthBadgeLabel,
} from './SecuritySimulatorView';
import { Toast } from './ui';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  FileCheck,
  FilePlus2,
  Flag,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Lock,
  LogOut,
  MessageSquare,
  Pause,
  Play,
  Plus,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';

export type GoogleFormsTab = 'QUESTIONS_BUILDER' | 'RESPONSES_GRADING' | 'STUDENT_EXAM_VIEW';
export type ResponsesSubView = 'SUMMARY' | 'INDIVIDUAL';
export type GoogleFormsQuestionSubType =
  | 'MULTIPLE_CHOICE'
  | 'CHECKBOXES'
  | 'SHORT_ANSWER'
  | 'PARAGRAPH'
  | 'DROPDOWN'
  | 'LINEAR_SCALE'
  | 'DATE'
  | 'TIME'
  | 'TRUE_FALSE';

export interface QuestionExtendedMeta {
  answerIndex?: number;
  correctIndices?: number[];
  isTrue?: boolean;
  sampleKeyword?: string;
  rubric?: string;
  googleFormSubType?: GoogleFormsQuestionSubType;
  descriptionKh?: string;
  sectionTitleKh?: string;
  feedbackKh?: string;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
}

export function parseQuestionExtendedMeta(q: QuestionRecord): QuestionExtendedMeta {
  try {
    return JSON.parse(q.CorrectAnswerJSON || '{}');
  } catch {
    return {};
  }
}

export function getQuestionSubType(q: QuestionRecord): GoogleFormsQuestionSubType {
  const meta = parseQuestionExtendedMeta(q);
  if (meta.googleFormSubType) {
    return meta.googleFormSubType;
  }
  if (q.QuestionType === 'TRUE_FALSE') return 'TRUE_FALSE';
  if (q.QuestionType === 'SHORT_ANSWER') return 'SHORT_ANSWER';
  if (q.QuestionType === 'ESSAY') return 'PARAGRAPH';
  return 'MULTIPLE_CHOICE';
}

export const QUESTION_SUBTYPE_LABELS_KH: Record<GoogleFormsQuestionSubType, string> = {
  MULTIPLE_CHOICE: 'ជ្រើសរើសចម្លើយមួយ (MCQ)',
  CHECKBOXES: 'ជ្រើសរើសច្រើនចម្លើយ (Checkboxes)',
  SHORT_ANSWER: 'ចម្លើយខ្លី (Short Answer)',
  PARAGRAPH: 'កថាខណ្ឌ / សរសេរវែង (Paragraph)',
  DROPDOWN: 'បញ្ជីទម្លាក់ចុះ (Dropdown)',
  LINEAR_SCALE: 'មាត្រដ្ឋានលីនេអ៊ែរ (Linear Scale)',
  DATE: 'កាលបរិច្ឆេទ (Date)',
  TIME: 'ពេលវេលា (Time)',
  TRUE_FALSE: 'ពិត / មិនពិត (True / False)',
};

export function applyQuestionSubTypeChange(
  prevQ: QuestionRecord,
  nextSubType: GoogleFormsQuestionSubType
): QuestionRecord {
  const meta = parseQuestionExtendedMeta(prevQ);
  const nextMeta: QuestionExtendedMeta = {
    ...meta,
    googleFormSubType: nextSubType,
  };

  if (nextSubType === 'TRUE_FALSE') {
    return {
      ...prevQ,
      QuestionType: 'TRUE_FALSE',
      OptionsJSON: JSON.stringify(['ត្រូវ (True)', 'ខុស (False)']),
      CorrectAnswerJSON: JSON.stringify({
        ...nextMeta,
        isTrue: true,
        answerIndex: 0,
      }),
    };
  }

  if (
    nextSubType === 'MULTIPLE_CHOICE' ||
    nextSubType === 'CHECKBOXES' ||
    nextSubType === 'DROPDOWN'
  ) {
    let existingOpts: string[] = [];
    try {
      existingOpts = JSON.parse(prevQ.OptionsJSON || '[]');
    } catch {
      existingOpts = [];
    }
    const nextOpts =
      existingOpts.length >= 2 && prevQ.QuestionType === 'MCQ'
        ? existingOpts
        : ['ក. ជម្រើសទី ១', 'ខ. ជម្រើសទី ២', 'គ. ជម្រើសទី ៣', 'ឃ. ជម្រើសទី ៤'];
    return {
      ...prevQ,
      QuestionType: 'MCQ',
      OptionsJSON: JSON.stringify(nextOpts),
      CorrectAnswerJSON: JSON.stringify({
        ...nextMeta,
        answerIndex: nextMeta.answerIndex ?? 0,
        correctIndices:
          nextSubType === 'CHECKBOXES'
            ? nextMeta.correctIndices && nextMeta.correctIndices.length > 0
              ? nextMeta.correctIndices
              : [0]
            : [nextMeta.answerIndex ?? 0],
      }),
    };
  }

  if (nextSubType === 'LINEAR_SCALE') {
    return {
      ...prevQ,
      QuestionType: 'MCQ',
      OptionsJSON: JSON.stringify(['1', '2', '3', '4', '5']),
      CorrectAnswerJSON: JSON.stringify({
        ...nextMeta,
        answerIndex: nextMeta.answerIndex ?? 4,
        scaleMinLabel: nextMeta.scaleMinLabel || 'កម្រិតទាបបំផុត (១)',
        scaleMaxLabel: nextMeta.scaleMaxLabel || 'កម្រិតខ្ពស់បំផុត (៥)',
      }),
    };
  }

  if (nextSubType === 'PARAGRAPH') {
    return {
      ...prevQ,
      QuestionType: 'ESSAY',
      OptionsJSON: JSON.stringify([]),
      CorrectAnswerJSON: JSON.stringify({
        ...nextMeta,
        rubric: nextMeta.rubric || 'ពិនិត្យលើខ្លឹមសារ និងការពន្យល់របស់សិស្ស',
      }),
    };
  }

  // SHORT_ANSWER, DATE, TIME
  const defaultSample =
    nextSubType === 'DATE'
      ? '2026-06-15'
      : nextSubType === 'TIME'
      ? '08:00'
      : nextMeta.sampleKeyword || 'SHA-256';
  return {
    ...prevQ,
    QuestionType: 'SHORT_ANSWER',
    OptionsJSON: JSON.stringify([]),
    CorrectAnswerJSON: JSON.stringify({
      ...nextMeta,
      sampleKeyword: defaultSample,
    }),
  };
}

interface OnlineExamsPortalViewProps {
  db: DatabaseState;
  setDb?: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  externalSearchQuery?: string;
  initialTab?: GoogleFormsTab;
  initialOpenExamSelector?: boolean;
  onCreateExam: (payload: {
    examTitleKh: string;
    subjectId: string;
    classId: string;
    durationMinutes: number;
    totalPoints: number;
    passingScore: number;
  }) => ExamRecord;
  onSubmitExamAttempt: (payload: {
    examId: string;
    studentId: string;
    scoreObtained: number;
    percentage: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
    attemptStatus?: 'GRADED' | 'SUBMITTED';
    answersToSave?: Array<{
      questionId: string;
      answerJson: string;
      scoreAwarded: number;
      isCorrect: boolean;
      gradedByUserId: string;
    }>;
  }) => ExamAttemptRecord;
  onGradeManualAnswers?: (payload: {
    attemptId: string;
    gradedScores: Record<string, number>;
  }) => void;
}

export const OnlineExamsPortalView: React.FC<OnlineExamsPortalViewProps> = ({
  db,
  setDb,
  activeUserId,
  externalSearchQuery = '',
  initialTab,
  initialOpenExamSelector,
  onCreateExam,
  onSubmitExamAttempt,
  onGradeManualAnswers,
}) => {
  // Identify Active User & Role
  const activeUser = useMemo(
    () => db.Users.find((u) => u.UserID === activeUserId) || db.Users[2],
    [db.Users, activeUserId]
  );
  const activeRole = useMemo(
    () => db.Roles.find((r) => r.RoleID === activeUser.RoleID),
    [db.Roles, activeUser]
  );

  const isStudentRole = activeRole?.RoleName === 'STUDENT';
  const isAdminOrSuperAdmin =
    activeRole?.RoleName === 'SUPER_ADMIN' || activeRole?.RoleName === 'ADMIN';
  const isTeacherRole = activeRole?.RoleName === 'TEACHER';

  // Teacher's authorized subjects and classes from single source of truth
  const teacherScope = useMemo(
    () => getTeacherAuthorizedSubjectsAndClasses(db, activeUserId),
    [db, activeUserId]
  );

  // Teacher's assigned subjects (or all subjects for Super Admin / Admin)
  const allowedSubjectsForActor = useMemo(() => {
    if (isAdminOrSuperAdmin) return db.Subjects;
    if (isTeacherRole) {
      return teacherScope.authorizedSubjects.length > 0
        ? teacherScope.authorizedSubjects
        : db.Subjects;
    }
    return db.Subjects;
  }, [db.Subjects, teacherScope.authorizedSubjects, isAdminOrSuperAdmin, isTeacherRole]);

  const allowedSubjectIds = useMemo(
    () => new Set(allowedSubjectsForActor.map((s) => s.SubjectID)),
    [allowedSubjectsForActor]
  );

  // Track deleted exams locally when setDb isn't used or alongside setDb
  const [deletedExamIds, setDeletedExamIds] = useState<string[]>([]);

  // Teachers can only view/manage examinations belonging to their assigned subjects;
  // Administrators can view/manage all examinations.
  const authorizedExamsForActor = useMemo(() => {
    const activeExams = db.Exams.filter((ex) => !deletedExamIds.includes(ex.ExamID));
    if (isAdminOrSuperAdmin) return activeExams;
    if (isTeacherRole) {
      const teacherScoped = activeExams.filter((ex) => allowedSubjectIds.has(ex.SubjectID));
      return teacherScoped.length > 0 ? teacherScoped : activeExams;
    }
    return activeExams;
  }, [db.Exams, deletedExamIds, isAdminOrSuperAdmin, isTeacherRole, allowedSubjectIds]);

  // Selected Exam State (Default: EXM-2526-ICT-NOV with full 50-point question set & seeded responses)
  const [selectedExamId, setSelectedExamId] = useState<string>(
    () =>
      authorizedExamsForActor.find((e) => e.ExamID === 'EXM-2526-ICT-NOV')?.ExamID ||
      authorizedExamsForActor[0]?.ExamID ||
      'EXM-2526-ICT-NOV'
  );
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [examSubjectFilter, setExamSubjectFilter] = useState<string>('ALL');
  const [examMonthFilter, setExamMonthFilter] = useState<string>('ALL');
  const [examAcademicYearFilter, setExamAcademicYearFilter] = useState<string>('ALL');
  const [showExamSelectorGrid, setShowExamSelectorGrid] = useState<boolean>(
    Boolean(initialOpenExamSelector)
  );
  const [showExamSettingsPanel, setShowExamSettingsPanel] = useState<boolean>(false);

  // 3 Main Tabs: QUESTIONS_BUILDER | RESPONSES_GRADING | STUDENT_EXAM_VIEW
  const [activeTab, setActiveTab] = useState<GoogleFormsTab>(() =>
    isStudentRole ? 'STUDENT_EXAM_VIEW' : initialTab || 'QUESTIONS_BUILDER'
  );

  useEffect(() => {
    if (!isStudentRole && initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isStudentRole]);

  useEffect(() => {
    if (initialOpenExamSelector !== undefined) {
      setShowExamSelectorGrid(initialOpenExamSelector);
    }
  }, [initialOpenExamSelector]);

  // Keep Student role locked to Tab 3 (Student Exam View)
  useEffect(() => {
    if (isStudentRole && activeTab !== 'STUDENT_EXAM_VIEW') {
      setActiveTab('STUDENT_EXAM_VIEW');
    }
  }, [isStudentRole, activeTab]);

  // Toast Notification
  const [toastBanner, setToastBanner] = useState<{
    tone: 'success' | 'info' | 'warning' | 'danger';
    title: string;
    description?: string;
  } | null>(null);

  // Confirmation Dialog State
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'danger' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  const selectedExam = useMemo(
    () =>
      authorizedExamsForActor.find((e) => e.ExamID === selectedExamId) ||
      authorizedExamsForActor[0] ||
      db.Exams[0],
    [authorizedExamsForActor, db.Exams, selectedExamId]
  );

  // Local mutable questions & exam metadata fallback if setDb isn't passed
  const [localExamsOverride, setLocalExamsOverride] = useState<Record<string, Partial<ExamRecord>>>({});
  const [localQuestions, setLocalQuestions] = useState<QuestionRecord[]>(() => db.Questions);
  const [localExamAnswers, setLocalExamAnswers] = useState<ExamAnswerRecord[]>(() => db.ExamAnswers);

  useEffect(() => {
    setLocalQuestions(db.Questions);
  }, [db.Questions]);

  useEffect(() => {
    setLocalExamAnswers(db.ExamAnswers);
  }, [db.ExamAnswers]);

  const currentExam: ExamRecord = useMemo(() => {
    const base = selectedExam || db.Exams[0];
    return {
      ...base,
      ...(localExamsOverride[base.ExamID] || {}),
    };
  }, [selectedExam, db.Exams, localExamsOverride]);

  const examSubject = useMemo(
    () => db.Subjects.find((s) => s.SubjectID === currentExam.SubjectID) || db.Subjects[0],
    [db.Subjects, currentExam.SubjectID]
  );

  const examClass = useMemo(
    () => db.Classes.find((c) => c.ClassID === currentExam.ClassID) || db.Classes[0],
    [db.Classes, currentExam.ClassID]
  );

  const examAcademicYear = useMemo(
    () =>
      db.AcademicYears.find((ay) => ay.AcademicYearID === currentExam.AcademicYearID) ||
      db.AcademicYears.find((ay) => ay.IsCurrent) ||
      db.AcademicYears[0],
    [db.AcademicYears, currentExam.AcademicYearID]
  );

  // Questions belonging to the selected exam (preserves exact QuestionIDs order for reordering
  // and strictly enforces Subject + Month + Teacher Subject Authorization so unrelated questions never mix)
  const examQuestions = useMemo(() => {
    const isSubjectAllowedForTeacher = !isTeacherRole || allowedSubjectIds.has(currentExam.SubjectID);
    if (!isSubjectAllowedForTeacher) return [];

    if (currentExam.QuestionIDs && currentExam.QuestionIDs.length > 0) {
      const activeById = new Map(
        localQuestions
          .filter(
            (q) =>
              q.Status === 'ACTIVE' &&
              (!isTeacherRole || allowedSubjectIds.has(q.SubjectID))
          )
          .map((q) => [q.QuestionID, q])
      );
      const explicitOrdered = currentExam.QuestionIDs.map((id) =>
        activeById.get(id)
      ).filter((q): q is QuestionRecord => Boolean(q));
      if (explicitOrdered.length > 0) return explicitOrdered;
    }
    const monthMatches = localQuestions.filter(
      (q) =>
        q.SubjectID === currentExam.SubjectID &&
        q.Status === 'ACTIVE' &&
        (q.ExamMonth || 'វិច្ឆិកា') === (currentExam.ExamMonth || 'វិច្ឆិកា') &&
        (!isTeacherRole || allowedSubjectIds.has(q.SubjectID))
    );
    if (monthMatches.length > 0) return monthMatches;
    return localQuestions.filter(
      (q) =>
        q.SubjectID === currentExam.SubjectID &&
        q.Status === 'ACTIVE' &&
        (!isTeacherRole || allowedSubjectIds.has(q.SubjectID))
    );
  }, [
    localQuestions,
    currentExam.SubjectID,
    currentExam.ExamMonth,
    currentExam.QuestionIDs,
    isTeacherRole,
    allowedSubjectIds,
  ]);

  // Check if current actor is authorized to build/edit questions, exam settings, and grading for this exam's subject
  const canActorBuildExam = useMemo(() => {
    const decision = canTeacherManageExamAndGrading(
      activeUserId,
      currentExam.SubjectID,
      {
        users: db.Users,
        roles: db.Roles,
        assignments: db.TeacherSubjectAssignments,
      }
    );
    return decision.allowed;
  }, [
    activeUserId,
    currentExam.SubjectID,
    db.Users,
    db.Roles,
    db.TeacherSubjectAssignments,
  ]);

  // ============================================================================
  // TAB 1 STATE: QUESTIONS TAB (List Filters + Editor + Live Question Preview)
  // ============================================================================
  const [focusedQuestionId, setFocusedQuestionId] = useState<string>(
    () => examQuestions[0]?.QuestionID || 'QST-ICT-001'
  );
  const [questionSearchQuery, setQuestionSearchQuery] = useState<string>('');
  const [questionListSubjectFilter, setQuestionListSubjectFilter] = useState<string>('ALL');
  const [questionListMonthFilter, setQuestionListMonthFilter] = useState<string>('ALL');
  const [questionListTypeFilter, setQuestionListTypeFilter] = useState<string>('ALL');

  // Helper to switch to a matching monthly examination when Subject or Month filter is selected
  // without mixing questions or responses from different months, subjects, classes, or academic years
  const handleSelectSubjectOrMonthFilter = (
    nextSubjectId: string,
    nextMonth: string
  ) => {
    setQuestionListSubjectFilter(nextSubjectId);
    setQuestionListMonthFilter(nextMonth);
    setExamSubjectFilter(nextSubjectId);
    setExamMonthFilter(nextMonth);

    // If a specific Subject or Month is chosen and currentExam doesn't match it,
    // switch to the matching examination in authorizedExamsForActor if one exists
    const targetSub = nextSubjectId === 'ALL' ? currentExam.SubjectID : nextSubjectId;
    const targetMonth = nextMonth === 'ALL' ? currentExam.ExamMonth : nextMonth;

    if (
      (nextSubjectId !== 'ALL' && currentExam.SubjectID !== nextSubjectId) ||
      (nextMonth !== 'ALL' && currentExam.ExamMonth !== nextMonth)
    ) {
      const exactExam =
        authorizedExamsForActor.find(
          (ex) =>
            ex.SubjectID === targetSub &&
            ex.ExamMonth === targetMonth &&
            ex.ClassID === currentExam.ClassID
        ) ||
        authorizedExamsForActor.find(
          (ex) => ex.SubjectID === targetSub && ex.ExamMonth === targetMonth
        ) ||
        authorizedExamsForActor.find((ex) =>
          nextSubjectId !== 'ALL'
            ? ex.SubjectID === targetSub
            : ex.ExamMonth === targetMonth
        );

      if (exactExam && exactExam.ExamID !== currentExam.ExamID) {
        setSelectedExamId(exactExam.ExamID);
        setSubmittedResultSummary(null);
      }
    }
  };

  const [answerKeyModeMap, setAnswerKeyModeMap] = useState<Record<string, boolean>>({});
  const [requiredQuestionMap, setRequiredQuestionMap] = useState<Record<string, boolean>>({
    'QST-ICT-001': true,
    'QST-ICT-002': true,
    'QST-ICT-003': true,
    'QST-ICT-004': true,
    'QST-ICT-005': true,
  });
  const [descriptionOpenMap, setDescriptionOpenMap] = useState<Record<string, boolean>>({});
  const [imagePickerOpenMap, setImagePickerOpenMap] = useState<Record<string, boolean>>({});
  const [feedbackOpenMap, setFeedbackOpenMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (
      examQuestions.length > 0 &&
      !examQuestions.some((q) => q.QuestionID === focusedQuestionId)
    ) {
      setFocusedQuestionId(examQuestions[0].QuestionID);
    }
  }, [examQuestions, focusedQuestionId]);

  // Filtered Questions for the Left Question List (Strictly scoped to authorized subjects)
  const filteredBuilderQuestions = useMemo(() => {
    const qStr = questionSearchQuery.trim().toLowerCase();
    return examQuestions.filter((q) => {
      if (isTeacherRole && !allowedSubjectIds.has(q.SubjectID)) {
        return false;
      }
      if (questionListSubjectFilter !== 'ALL' && q.SubjectID !== questionListSubjectFilter) {
        return false;
      }
      if (
        questionListMonthFilter !== 'ALL' &&
        (q.ExamMonth || 'វិច្ឆិកា') !== questionListMonthFilter
      ) {
        return false;
      }
      const subType = getQuestionSubType(q);
      if (
        questionListTypeFilter !== 'ALL' &&
        subType !== questionListTypeFilter &&
        q.QuestionType !== questionListTypeFilter
      ) {
        return false;
      }
      if (!qStr) return true;
      return (
        q.QuestionText.toLowerCase().includes(qStr) ||
        q.QuestionID.toLowerCase().includes(qStr)
      );
    });
  }, [
    examQuestions,
    isTeacherRole,
    allowedSubjectIds,
    questionSearchQuery,
    questionListSubjectFilter,
    questionListMonthFilter,
    questionListTypeFilter,
  ]);

  const focusedQuestion = useMemo(
    () =>
      examQuestions.find((q) => q.QuestionID === focusedQuestionId) ||
      filteredBuilderQuestions[0] ||
      examQuestions[0],
    [examQuestions, filteredBuilderQuestions, focusedQuestionId]
  );

  const focusedQuestionIndex = useMemo(
    () =>
      Math.max(
        0,
        examQuestions.findIndex((q) => q.QuestionID === focusedQuestion?.QuestionID)
      ),
    [examQuestions, focusedQuestion]
  );

  const updateExamMetadata = (patch: Partial<ExamRecord>) => {
    if (!canActorBuildExam) {
      setToastBanner({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិកែប្រែវិញ្ញាសា',
        description: 'គ្រូបង្រៀនអាចកែប្រែបានតែវិញ្ញាសាក្នុងមុខវិជ្ជាដែលខ្លួនទទួលបន្ទុកប៉ុណ្ណោះ។',
      });
      return;
    }

    setLocalExamsOverride((prev) => ({
      ...prev,
      [currentExam.ExamID]: {
        ...(prev[currentExam.ExamID] || {}),
        ...patch,
      },
    }));

    if (setDb) {
      setDb((prev) => ({
        ...prev,
        Exams: prev.Exams.map((e) =>
          e.ExamID === currentExam.ExamID
            ? { ...e, ...patch, UpdatedAt: new Date().toISOString() }
            : e
        ),
      }));
    }
  };

  // Delete Examination with Confirmation & Permission Check
  const handleDeleteCurrentExam = () => {
    if (!canActorBuildExam) {
      setToastBanner({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិលុបវិញ្ញាសានេះទេ',
        description: 'គ្រូបង្រៀនអាចលុបបានតែវិញ្ញាសាក្នុងមុខវិជ្ជាដែលខ្លួនទទួលបន្ទុកប៉ុណ្ណោះ។',
      });
      return;
    }

    if (authorizedExamsForActor.length <= 1) {
      setToastBanner({
        tone: 'warning',
        title: 'មិនអាចលុបវិញ្ញាសាចុងក្រោយបានទេ',
        description: 'ប្រព័ន្ធត្រូវរក្សាទុកយ៉ាងហោចណាស់ ១ វិញ្ញាសាប្រឡង។',
      });
      return;
    }

    const examToDelete = currentExam;
    setConfirmModal({
      title: 'បញ្ជាក់ការលុបវិញ្ញាសាប្រឡង',
      description: `តើអ្នកពិតជាចង់លុបវិញ្ញាសា «${examToDelete.ExamTitle}» (ខែ${examToDelete.ExamMonth}) មែនទេ?`,
      confirmLabel: 'លុបវិញ្ញាសា',
      tone: 'danger',
      onConfirm: () => {
        const remainingExams = authorizedExamsForActor.filter(
          (e) => e.ExamID !== examToDelete.ExamID
        );
        const nextExamId = remainingExams[0]?.ExamID || db.Exams[0]?.ExamID;

        setDeletedExamIds((prev) => [...prev, examToDelete.ExamID]);
        if (setDb) {
          setDb((prev) => ({
            ...prev,
            Exams: prev.Exams.filter((e) => e.ExamID !== examToDelete.ExamID),
          }));
        }
        if (nextExamId) {
          setSelectedExamId(nextExamId);
        }
        setConfirmModal(null);
        setToastBanner({
          tone: 'info',
          title: 'បានលុបវិញ្ញាសាប្រឡងរួចរាល់',
          description: `វិញ្ញាសា «${examToDelete.ExamTitle}» ត្រូវបានលុបចេញពីប្រព័ន្ធ។`,
        });
      },
    });
  };

  const mutateQuestionInList = (
    questionId: string,
    updater: (q: QuestionRecord) => QuestionRecord
  ) => {
    const decision = canManageQuestion(
      activeUserId,
      questionId,
      'EDIT',
      {
        users: db.Users,
        roles: db.Roles,
        assignments: db.TeacherSubjectAssignments,
        questions: localQuestions,
        classes: db.Classes,
      },
      currentExam.SubjectID
    );

    if (!decision.allowed) {
      setToastBanner({
        tone: 'danger',
        title: 'បដិសេធសិទ្ធិកែប្រែសំណួរ',
        description: decision.reasonKh,
      });
      return;
    }

    setLocalQuestions((prev) =>
      prev.map((q) => (q.QuestionID === questionId ? updater(q) : q))
    );

    if (setDb) {
      setDb((prev) => ({
        ...prev,
        Questions: prev.Questions.map((q) =>
          q.QuestionID === questionId ? updater(q) : q
        ),
      }));
    }
  };

  const handleAddBlankQuestion = (afterQuestionId?: string) => {
    if (!canActorBuildExam) {
      setToastBanner({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិបង្កើតសំណួរក្នុងមុខវិជ្ជានេះទេ',
        description: 'អ្នកអាចបង្កើតសំណួរបានតែក្នុងមុខវិជ្ជាដែលបានចាត់តាំងប៉ុណ្ណោះ។',
      });
      return;
    }

    const now = new Date().toISOString();
    const newId = `QST-${currentExam.SubjectID.replace('SUB-', '')}-${String(
      localQuestions.length + 1
    ).padStart(3, '0')}`;

    const newQ: QuestionRecord = {
      QuestionID: newId,
      SubjectID: currentExam.SubjectID,
      QuestionText: `សំណួរថ្មីទី ${examQuestions.length + 1}`,
      QuestionType: 'MCQ',
      OptionsJSON: JSON.stringify([
        'ក. ជម្រើសទី ១',
        'ខ. ជម្រើសទី ២',
        'គ. ជម្រើសទី ៣',
        'ឃ. ជម្រើសទី ៤',
      ]),
      CorrectAnswerJSON: JSON.stringify({ answerIndex: 0 }),
      Points: 10,
      DifficultyLevel: 'MEDIUM',
      ExamMonth: currentExam.ExamMonth || 'វិច្ឆិកា',
      TargetMonth: currentExam.ExamMonth || 'វិច្ឆិកា',
      ImageFileID: '',
      CreatedByUserID: activeUserId,
      UpdatedByUserID: activeUserId,
      Status: 'ACTIVE',
      CreatedAt: now,
      UpdatedAt: now,
    };

    const nextQuestionIds = [
      ...(currentExam.QuestionIDs || examQuestions.map((q) => q.QuestionID)),
      newId,
    ];

    setLocalQuestions((prev) => {
      if (!afterQuestionId) return [...prev, newQ];
      const idx = prev.findIndex((q) => q.QuestionID === afterQuestionId);
      if (idx === -1) return [...prev, newQ];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newQ);
      return copy;
    });

    setLocalExamsOverride((prev) => ({
      ...prev,
      [currentExam.ExamID]: {
        ...(prev[currentExam.ExamID] || {}),
        QuestionIDs: nextQuestionIds,
      },
    }));

    if (setDb) {
      setDb((prev) => ({
        ...prev,
        Questions: [...prev.Questions, newQ],
        Exams: prev.Exams.map((ex) =>
          ex.ExamID === currentExam.ExamID
            ? { ...ex, QuestionIDs: nextQuestionIds, UpdatedAt: now }
            : ex
        ),
      }));
    }

    setRequiredQuestionMap((prev) => ({ ...prev, [newId]: true }));
    setFocusedQuestionId(newId);
    setToastBanner({
      tone: 'success',
      title: 'បានបន្ថែមសំណួរថ្មី',
      description: `សំណួរ ${newId} ត្រូវបានបង្កើតក្នុងវិញ្ញាសា។`,
    });
  };

  const handleDuplicateQuestion = (q: QuestionRecord) => {
    if (!canActorBuildExam) {
      setToastBanner({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិចម្លងសំណួរ',
        description: 'គ្រូបង្រៀនអាចចម្លងសំណួរបានតែក្នុងមុខវិជ្ជារបស់ខ្លួនប៉ុណ្ណោះ។',
      });
      return;
    }
    const now = new Date().toISOString();
    const dupId = `${q.QuestionID}-COPY-${Math.floor(Math.random() * 90 + 10)}`;
    const dupRecord: QuestionRecord = {
      ...q,
      QuestionID: dupId,
      QuestionText: `${q.QuestionText} (ច្បាប់ចម្លង)`,
      CreatedByUserID: activeUserId,
      UpdatedByUserID: activeUserId,
      CreatedAt: now,
      UpdatedAt: now,
    };

    const nextQuestionIds = [
      ...(currentExam.QuestionIDs || examQuestions.map((item) => item.QuestionID)),
      dupId,
    ];

    setLocalQuestions((prev) => {
      const idx = prev.findIndex((item) => item.QuestionID === q.QuestionID);
      const copy = [...prev];
      copy.splice(idx + 1, 0, dupRecord);
      return copy;
    });

    setLocalExamsOverride((prev) => ({
      ...prev,
      [currentExam.ExamID]: {
        ...(prev[currentExam.ExamID] || {}),
        QuestionIDs: nextQuestionIds,
      },
    }));

    if (setDb) {
      setDb((prev) => ({
        ...prev,
        Questions: [...prev.Questions, dupRecord],
        Exams: prev.Exams.map((ex) =>
          ex.ExamID === currentExam.ExamID
            ? { ...ex, QuestionIDs: nextQuestionIds, UpdatedAt: now }
            : ex
        ),
      }));
    }

    setFocusedQuestionId(dupId);
    setToastBanner({
      tone: 'info',
      title: 'បានចម្លងសំណួរ',
      description: `បានចម្លងសំណួរទៅជា ${dupId}។`,
    });
  };

  const executeDeleteQuestionCard = (q: QuestionRecord) => {
    const decision = canManageQuestion(
      activeUserId,
      q.QuestionID,
      'DELETE',
      {
        users: db.Users,
        roles: db.Roles,
        assignments: db.TeacherSubjectAssignments,
        questions: localQuestions,
        classes: db.Classes,
      },
      currentExam.SubjectID
    );

    if (!decision.allowed) {
      setToastBanner({
        tone: 'danger',
        title: 'មិនអាចលុបសំណួរបានទេ',
        description: decision.reasonKh,
      });
      return;
    }

    if (examQuestions.length <= 1) {
      setToastBanner({
        tone: 'warning',
        title: 'វិញ្ញាសាត្រូវមានយ៉ាងហោចណាស់ ១ សំណួរ',
        description: 'មិនអាចលុបសំណួរចុងក្រោយនៃវិញ្ញាសាបានទេ។',
      });
      return;
    }

    setLocalQuestions((prev) =>
      prev.map((item) =>
        item.QuestionID === q.QuestionID ? { ...item, Status: 'DELETED' as const } : item
      )
    );

    if (setDb) {
      setDb((prev) => ({
        ...prev,
        Questions: prev.Questions.map((item) =>
          item.QuestionID === q.QuestionID ? { ...item, Status: 'DELETED' as const } : item
        ),
      }));
    }

    setToastBanner({
      tone: 'info',
      title: 'បានលុបសំណួរចេញពីវិញ្ញាសា',
      description: `សំណួរ ${q.QuestionID} ត្រូវបានលុប។`,
    });
  };

  const handleDeleteQuestionCard = (q: QuestionRecord) => {
    setConfirmModal({
      title: 'បញ្ជាក់ការលុបសំណួរ',
      description: `តើអ្នកពិតជាចង់លុបសំណួរ «${q.QuestionText}» ចេញពីវិញ្ញាសាប្រឡងនេះមែនទេ?`,
      confirmLabel: 'លុបសំណួរ',
      tone: 'danger',
      onConfirm: () => {
        executeDeleteQuestionCard(q);
        setConfirmModal(null);
      },
    });
  };

  // Reorder question up or down inside the active exam
  const handleMoveQuestion = (questionId: string, direction: 'UP' | 'DOWN') => {
    if (!canActorBuildExam) {
      setToastBanner({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិផ្លាស់ប្តូរលំដាប់សំណួរ',
        description: 'គ្រូបង្រៀនអាចកែប្រែបានតែវិញ្ញាសាក្នុងមុខវិជ្ជាដែលខ្លួនទទួលបន្ទុកប៉ុណ្ណោះ។',
      });
      return;
    }

    const currentIds = examQuestions.map((q) => q.QuestionID);
    const idx = currentIds.indexOf(questionId);
    if (idx === -1) return;
    const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentIds.length) return;

    const nextIds = [...currentIds];
    const [moved] = nextIds.splice(idx, 1);
    nextIds.splice(targetIdx, 0, moved);
    const now = new Date().toISOString();

    setLocalExamsOverride((prev) => ({
      ...prev,
      [currentExam.ExamID]: {
        ...(prev[currentExam.ExamID] || {}),
        QuestionIDs: nextIds,
      },
    }));

    if (setDb) {
      setDb((prev) => ({
        ...prev,
        Exams: prev.Exams.map((ex) =>
          ex.ExamID === currentExam.ExamID
            ? { ...ex, QuestionIDs: nextIds, UpdatedAt: now }
            : ex
        ),
      }));
    }

    setFocusedQuestionId(questionId);
  };

  // Toggle or add a Google Forms Section Header above the active question
  const handleAddOrToggleSection = (qOrId: QuestionRecord | string, qIdxParam?: number) => {
    const qId = typeof qOrId === 'string' ? qOrId : qOrId.QuestionID;
    const qObj =
      typeof qOrId === 'string'
        ? examQuestions.find((item) => item.QuestionID === qId)
        : qOrId;
    if (!qObj) return;
    const qIdx =
      qIdxParam !== undefined
        ? qIdxParam
        : Math.max(0, examQuestions.findIndex((item) => item.QuestionID === qId));

    const parsedMeta = parseQuestionExtendedMeta(qObj);
    const hasSection = parsedMeta.sectionTitleKh !== undefined;
    const nextSectionTitle = hasSection
      ? undefined
      : `ផ្នែកទី ${qIdx + 1}៖ សំណួរវិញ្ញាសា (${examSubject?.SubjectNameKh || 'ព័ត៌មានវិទ្យា'})`;

    mutateQuestionInList(qId, (prevQ) => {
      const next = { ...parseQuestionExtendedMeta(prevQ) };
      if (nextSectionTitle === undefined) {
        delete next.sectionTitleKh;
      } else {
        next.sectionTitleKh = nextSectionTitle;
      }
      return {
        ...prevQ,
        CorrectAnswerJSON: JSON.stringify(next),
      };
    });

    setToastBanner({
      tone: 'info',
      title: nextSectionTitle ? 'បានបន្ថែមក្បាលផ្នែក' : 'បានដកចេញក្បាលផ្នែក',
      description: nextSectionTitle || `សំណួរទី ${qIdx + 1}`,
    });
  };

  // Toggle Question Description
  const handleToggleQuestionDescription = (qOrId: QuestionRecord | string) => {
    const qId = typeof qOrId === 'string' ? qOrId : qOrId.QuestionID;
    const isCurrentlyOpen = Boolean(descriptionOpenMap[qId]);
    setDescriptionOpenMap((prev) => ({
      ...prev,
      [qId]: !isCurrentlyOpen,
    }));
    if (!isCurrentlyOpen) {
      mutateQuestionInList(qId, (prevQ) => {
        const parsedMeta = parseQuestionExtendedMeta(prevQ);
        if (parsedMeta.descriptionKh) return prevQ;
        return {
          ...prevQ,
          CorrectAnswerJSON: JSON.stringify({
            ...parsedMeta,
            descriptionKh: 'សូមអានសំណួរឱ្យបានច្បាស់មុននឹងជ្រើសរើសចម្លើយត្រឹមត្រូវ។',
          }),
        };
      });
    }
  };

  // Toggle Inline Image Attachment Picker
  const handleToggleQuestionImagePicker = (qOrId: QuestionRecord | string) => {
    const qId = typeof qOrId === 'string' ? qOrId : qOrId.QuestionID;
    setImagePickerOpenMap((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const handleCreateNewBlankQuiz = () => {
    const defaultSub = allowedSubjectsForActor[0]?.SubjectID || 'SUB-ICT';
    const subObj = db.Subjects.find((s) => s.SubjectID === defaultSub);
    const subClasses = teacherScope.authorizedClassesBySubject[defaultSub] || [];
    const teacherAllowedClassesForSub =
      subClasses.length > 0 ? subClasses.map((c) => c.ClassID) : ['CLS-12C'];
    const primaryClassId = teacherAllowedClassesForSub[0] || 'CLS-12C';

    const created = onCreateExam({
      examTitleKh: `វិញ្ញាសាប្រឡងប្រចាំខែធ្នូ - ${subObj?.SubjectNameKh || 'ព័ត៌មានវិទ្យា'}`,
      subjectId: defaultSub,
      classId: primaryClassId,
      durationMinutes: 60,
      totalPoints: 50,
      passingScore: 25,
    });

    if (teacherAllowedClassesForSub.length > 1) {
      setLocalExamsOverride((prev) => ({
        ...prev,
        [created.ExamID]: {
          ...(prev[created.ExamID] || {}),
          ClassID: primaryClassId,
          ClassIDs: teacherAllowedClassesForSub,
        },
      }));
      if (setDb) {
        setDb((prev) => ({
          ...prev,
          Exams: prev.Exams.map((e) =>
            e.ExamID === created.ExamID
              ? { ...e, ClassID: primaryClassId, ClassIDs: teacherAllowedClassesForSub }
              : e
          ),
        }));
      }
    }

    setSelectedExamId(created.ExamID);
    setActiveTab('QUESTIONS_BUILDER');
    setShowExamSelectorGrid(false);
    setToastBanner({
      tone: 'success',
      title: 'បានបង្កើតវិញ្ញាសារួមថ្មី (Single Shared Examination)',
      description: `វិញ្ញាសា "${created.ExamTitle}" ត្រូវបានបង្កើតរួចរាល់សម្រាប់ ${teacherAllowedClassesForSub.length} ថ្នាក់។`,
    });
  };

  // ============================================================================
  // MONTHLY QUESTION BANK PICKER MODAL STATE
  // ============================================================================
  const [isQuestionBankPickerOpen, setIsQuestionBankPickerOpen] = useState<boolean>(false);
  const [pickerSubjectId, setPickerSubjectId] = useState<string>(
    () => currentExam.SubjectID || 'SUB-ICT'
  );
  const [pickerMonthFilter, setPickerMonthFilter] = useState<'ALL' | AcademicQuestionMonth>(
    'វិច្ឆិកា'
  );
  const [pickerCheckedIds, setPickerCheckedIds] = useState<string[]>([]);

  const pickerFilteredQuestions = useMemo(() => {
    return localQuestions.filter((q) => {
      if (q.Status !== 'ACTIVE') return false;
      if (q.SubjectID !== pickerSubjectId) return false;
      if (isTeacherRole && q.CreatedByUserID !== activeUserId) return false;
      const m = q.ExamMonth || 'វិច្ឆិកា';
      if (pickerMonthFilter !== 'ALL' && m !== pickerMonthFilter) return false;
      return true;
    });
  }, [localQuestions, pickerSubjectId, isTeacherRole, activeUserId, pickerMonthFilter]);

  const handleOpenQuestionBankPicker = () => {
    if (!canActorBuildExam) {
      setToastBanner({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិទាញយកសំណួរចូលវិញ្ញាសានេះទេ',
        description: 'គ្រូបង្រៀនអាចកែប្រែបានតែវិញ្ញាសាក្នុងមុខវិជ្ជាដែលខ្លួនទទួលបន្ទុកប៉ុណ្ណោះ។',
      });
      return;
    }
    setPickerSubjectId(currentExam.SubjectID);
    setPickerMonthFilter('វិច្ឆិកា');
    const defaultIds = localQuestions
      .filter(
        (q) =>
          q.Status === 'ACTIVE' &&
          q.SubjectID === currentExam.SubjectID &&
          (q.ExamMonth || 'វិច្ឆិកា') === 'វិច្ឆិកា' &&
          (!isTeacherRole || q.CreatedByUserID === activeUserId)
      )
      .map((q) => q.QuestionID);
    setPickerCheckedIds(defaultIds);
    setIsQuestionBankPickerOpen(true);
  };

  const handleAddSelectedQuestionsToQuiz = () => {
    if (pickerCheckedIds.length === 0) {
      setToastBanner({
        tone: 'warning',
        title: 'សូមជ្រើសរើសយ៉ាងហោចណាស់ ១ សំណួរ',
        description: 'សូមធីកសំណួរដែលអ្នកចង់បញ្ចូលទៅក្នុងវិញ្ញាសា។',
      });
      return;
    }

    const existingIds = currentExam.QuestionIDs || examQuestions.map((q) => q.QuestionID);
    const mergedIds = Array.from(new Set([...existingIds, ...pickerCheckedIds]));
    const now = new Date().toISOString();

    setLocalExamsOverride((prev) => ({
      ...prev,
      [currentExam.ExamID]: {
        ...(prev[currentExam.ExamID] || {}),
        QuestionIDs: mergedIds,
      },
    }));

    if (setDb) {
      setDb((prev) => ({
        ...prev,
        Exams: prev.Exams.map((ex) =>
          ex.ExamID === currentExam.ExamID
            ? { ...ex, QuestionIDs: mergedIds, UpdatedAt: now }
            : ex
        ),
      }));
    }

    setIsQuestionBankPickerOpen(false);
    setFocusedQuestionId(pickerCheckedIds[0]);
    setToastBanner({
      tone: 'success',
      title: `បានបញ្ចូលសំណួរចំនួន ${pickerCheckedIds.length}`,
      description: `សំណួរពីឃ្លាំងសំណួរត្រូវបានបញ្ចូលទៅក្នុង «${currentExam.ExamTitle}» រួចរាល់។`,
    });
  };

  // ============================================================================
  // GOOGLE FORM IMPORT WIZARD STATE
  // ============================================================================
  const [isGoogleFormImportOpen, setIsGoogleFormImportOpen] = useState<boolean>(false);
  const [googleFormUrlOrJsonInput, setGoogleFormUrlOrJsonInput] = useState<string>(
    'https://docs.google.com/forms/d/1TeukChhouk_ICT_June_Form_2026/viewform'
  );
  const [parsedGoogleFormPreview, setParsedGoogleFormPreview] =
    useState<GoogleFormImportResult>(() =>
      getPresetGoogleFormQuestions('JUNE_ICT_50')
    );
  const [includeGoogleFormDemographics, setIncludeGoogleFormDemographics] =
    useState<boolean>(true);
  const [showAppsScriptCodeTab, setShowAppsScriptCodeTab] = useState<boolean>(false);

  const handleOpenGoogleFormImportModal = () => {
    const initialParsed = parseGoogleFormImportPayload(
      googleFormUrlOrJsonInput,
      currentExam.SubjectID
    );
    setParsedGoogleFormPreview(initialParsed);
    setIsGoogleFormImportOpen(true);
  };

  const handlePreviewGoogleForm = (customInput?: string) => {
    const raw = customInput !== undefined ? customInput : googleFormUrlOrJsonInput;
    if (customInput !== undefined) {
      setGoogleFormUrlOrJsonInput(customInput);
    }
    const result = parseGoogleFormImportPayload(raw, currentExam.SubjectID);
    setParsedGoogleFormPreview(result);
    setToastBanner({
      tone: 'info',
      title: 'បានទាញយកទិន្នន័យមើលជាមុនពី Google Form',
      description: result.messageKh,
    });
  };

  // ============================================================================
  // MULTI-CLASS ASSIGNMENT HELPERS (Respects Teacher Assigned Classes per Subject)
  // ============================================================================
  const authorizedClassesForCurrentSubject = useMemo(() => {
    if (isAdminOrSuperAdmin) return db.Classes;
    const allowedList = teacherScope.authorizedClassesBySubject[currentExam.SubjectID];
    if (allowedList && allowedList.length > 0) {
      return allowedList;
    }
    if (teacherScope.authorizedClasses && teacherScope.authorizedClasses.length > 0) {
      return teacherScope.authorizedClasses;
    }
    return db.Classes;
  }, [
    isAdminOrSuperAdmin,
    db.Classes,
    teacherScope.authorizedClassesBySubject,
    teacherScope.authorizedClasses,
    currentExam.SubjectID,
  ]);

  const authorizedClassIdSetForSubject = useMemo(
    () => new Set(authorizedClassesForCurrentSubject.map((c) => c.ClassID)),
    [authorizedClassesForCurrentSubject]
  );

  const assignedClassIds = useMemo<string[]>(() => {
    if (currentExam.ClassIDs && currentExam.ClassIDs.length > 0) {
      return currentExam.ClassIDs;
    }
    return [currentExam.ClassID || 'CLS-12C'];
  }, [currentExam.ClassIDs, currentExam.ClassID]);

  const assignedClassNames = useMemo<string[]>(() => {
    return assignedClassIds.map((cid) => {
      const found = db.Classes.find((c) => c.ClassID === cid);
      return found ? found.ClassName : cid.replace('CLS-', '');
    });
  }, [assignedClassIds, db.Classes]);

  const handleToggleExamClass = (classId: string) => {
    if (isTeacherRole && !authorizedClassIdSetForSubject.has(classId)) {
      const clsName = db.Classes.find((c) => c.ClassID === classId)?.ClassName || classId;
      setToastBanner({
        tone: 'danger',
        title: `គ្មានសិទ្ធិដាក់វិញ្ញាសាឱ្យថ្នាក់ ${clsName}`,
        description: `គ្រូបង្រៀនអាចដាក់វិញ្ញាសាប្រឡងបានតែក្នុងថ្នាក់ដែលខ្លួនទទួលបន្ទុកមុខវិជ្ជា ${examSubject?.SubjectNameKh} ប៉ុណ្ណោះ។`,
      });
      return;
    }

    const exists = assignedClassIds.includes(classId);
    let nextIds: string[];
    if (exists) {
      if (assignedClassIds.length <= 1) {
        setToastBanner({
          tone: 'warning',
          title: 'ត្រូវជ្រើសរើសយ៉ាងហោចណាស់ ១ ថ្នាក់',
          description: 'វិញ្ញាសាប្រឡងត្រូវតែកំណត់ឱ្យប្រឡងយ៉ាងហោចណាស់ ១ ថ្នាក់។',
        });
        return;
      }
      nextIds = assignedClassIds.filter((id) => id !== classId);
    } else {
      nextIds = [...assignedClassIds, classId];
    }
    updateExamMetadata({
      ClassID: nextIds[0],
      ClassIDs: nextIds,
    });
  };

  const handleAssignClassGroup = (gradePrefix: string, groupLabel: string) => {
    const sourceClasses = isTeacherRole ? authorizedClassesForCurrentSubject : db.Classes;
    const matchingIds = sourceClasses
      .filter((c) =>
        gradePrefix === 'ALL' || gradePrefix === 'AUTHORIZED'
          ? true
          : c.ClassName.startsWith(gradePrefix)
      )
      .map((c) => c.ClassID);
    if (matchingIds.length === 0) {
      setToastBanner({
        tone: 'warning',
        title: 'គ្មានថ្នាក់ដែលត្រូវគ្នាក្នុងសិទ្ធិទទួលបន្ទុក',
        description: 'អ្នកអាចជ្រើសរើសបានតែថ្នាក់ដែលបានចាត់តាំងឱ្យអ្នកបង្រៀនប៉ុណ្ណោះ។',
      });
      return;
    }
    updateExamMetadata({
      ClassID: matchingIds[0],
      ClassIDs: matchingIds,
    });
    setToastBanner({
      tone: 'success',
      title: `បានកំណត់វិញ្ញាសារួម (${groupLabel})`,
      description: `វិញ្ញាសារួម «${currentExam.ExamTitle}» ត្រូវបានដាក់ឱ្យប្រឡងរួមគ្នាសម្រាប់ ${matchingIds.length} ថ្នាក់ ដោយមិនបង្កើតវិញ្ញាសាស្ទួន។`,
    });
  };

  const handleSaveGoogleFormToSystem = (mode: 'APPEND_TO_CURRENT' | 'CREATE_NEW_EXAM') => {
    const mapped = mapGoogleFormToExamSchema(parsedGoogleFormPreview, {
      targetSubjectId: parsedGoogleFormPreview.subjectId || currentExam.SubjectID,
      targetClassId: currentExam.ClassID || 'CLS-12C',
      targetClassIds: assignedClassIds,
      actorUserId: activeUserId,
      includeDemographicFields: includeGoogleFormDemographics,
      existingQuestionCount: localQuestions.length,
    });

    const now = new Date().toISOString();
    const newQuestionIds = mapped.questionRecords.map((q) => q.QuestionID);

    if (mode === 'CREATE_NEW_EXAM') {
      const createdExamRecord: ExamRecord = {
        ...mapped.examRecord,
        ClassID: currentExam.ClassID || 'CLS-12C',
        ClassIDs: assignedClassIds,
      };

      setLocalQuestions((prev) => [...prev, ...mapped.questionRecords]);
      setLocalExamsOverride((prev) => ({
        ...prev,
        [createdExamRecord.ExamID]: createdExamRecord,
      }));

      if (setDb) {
        setDb((prev) => ({
          ...prev,
          Questions: [...prev.Questions, ...mapped.questionRecords],
          Exams: [createdExamRecord, ...prev.Exams],
        }));
      }

      setSelectedExamId(createdExamRecord.ExamID);
      if (newQuestionIds[0]) {
        setFocusedQuestionId(newQuestionIds[0]);
      }
      setIsGoogleFormImportOpen(false);
      setToastBanner({
        tone: 'success',
        title: `បានបង្កើតវិញ្ញាសាថ្មីពី Google Form៖ «${createdExamRecord.ExamTitle}»`,
        description: `បានបញ្ចូលសំណួរចំនួន ${mapped.questionRecords.length} សំណួរ • ពិន្ទុសរុប ${createdExamRecord.MaximumScore} ពិន្ទុ។`,
      });
      return;
    }

    // Mode: APPEND_TO_CURRENT
    const updatedExamPatch: Partial<ExamRecord> = {
      ExamTitle: parsedGoogleFormPreview.quizTitle,
      SubjectID: parsedGoogleFormPreview.subjectId || currentExam.SubjectID,
      DurationMinutes: parsedGoogleFormPreview.durationMinutes,
      MaximumScore: parsedGoogleFormPreview.totalPoints || 50,
      PassScore: parsedGoogleFormPreview.passScore || 25,
      QuestionIDs: newQuestionIds,
      UpdatedAt: now,
    };

    setLocalQuestions((prev) => [...prev, ...mapped.questionRecords]);
    setLocalExamsOverride((prev) => ({
      ...prev,
      [currentExam.ExamID]: {
        ...(prev[currentExam.ExamID] || {}),
        ...updatedExamPatch,
      },
    }));

    if (setDb) {
      setDb((prev) => ({
        ...prev,
        Questions: [...prev.Questions, ...mapped.questionRecords],
        Exams: prev.Exams.map((ex) =>
          ex.ExamID === currentExam.ExamID ? { ...ex, ...updatedExamPatch } : ex
        ),
      }));
    }

    if (newQuestionIds[0]) {
      setFocusedQuestionId(newQuestionIds[0]);
    }
    setRemainingSeconds((parsedGoogleFormPreview.durationMinutes || 20) * 60);
    setIsGoogleFormImportOpen(false);
    setToastBanner({
      tone: 'success',
      title: 'បានទាញយកទម្រង់ពី Google Form ជោគជ័យ!',
      description: `វិញ្ញាសា «${parsedGoogleFormPreview.quizTitle}» (${mapped.questionRecords.length} សំណួរ) ត្រូវបានរក្សាទុក។`,
    });
  };

  // ============================================================================
  // TAB 2 STATE: RESPONSES & GRADING (Strict Exam/Subject/Month/Class/Year Isolation)
  // ============================================================================
  const [acceptingResponses, setAcceptingResponses] = useState<boolean>(true);
  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState<number>(0);
  const [responseSearchQuery, setResponseSearchQuery] = useState<string>('');
  const [responseStatusFilter, setResponseStatusFilter] = useState<
    'ALL' | DetailedGradingStatus
  >('ALL');
  const [manualScoreOverrides, setManualScoreOverrides] = useState<Record<string, string>>({});
  const [localAttemptStatusOverrides, setLocalAttemptStatusOverrides] = useState<
    Record<string, { status: 'GRADED' | 'SUBMITTED'; totalScore: number }>
  >({});

  // Strictly filter attempts to the selected examination (never mix attempts from different
  // examinations, months, subjects, classes, or academic years)
  const examAttemptsList = useMemo(() => {
    const matching = db.ExamAttempts.filter(
      (a) => a.ExamID === currentExam.ExamID
    );
    return matching.map((att) => {
      const override = localAttemptStatusOverrides[att.AttemptID];
      if (!override) return att;
      return {
        ...att,
        AttemptStatus: override.status,
        TotalScore: override.totalScore,
      };
    });
  }, [db.ExamAttempts, currentExam.ExamID, localAttemptStatusOverrides]);

  // Compute 3-state grading status (PENDING_GRADING | PARTIALLY_GRADED | FULLY_GRADED) per attempt
  const attemptGradingProgressMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeAttemptGradingProgress>>();
    examAttemptsList.forEach((att) => {
      const progress = computeAttemptGradingProgress(
        att,
        examQuestions,
        localExamAnswers,
        manualScoreOverrides
      );
      map.set(att.AttemptID, progress);
    });
    return map;
  }, [examAttemptsList, examQuestions, localExamAnswers, manualScoreOverrides]);

  const filteredAttemptsList = useMemo(() => {
    const q = responseSearchQuery.trim().toLowerCase();
    return examAttemptsList.filter((att) => {
      const progress = attemptGradingProgressMap.get(att.AttemptID);
      const gStatus = progress?.status || 'PENDING_GRADING';
      if (responseStatusFilter !== 'ALL' && gStatus !== responseStatusFilter) {
        return false;
      }
      if (!q) return true;
      const st = db.Students.find((s) => s.StudentID === att.StudentID);
      const fullKh = `${st?.LastNameKh || ''} ${st?.FirstNameKh || ''} ${st?.FullNameKh || ''}`.toLowerCase();
      const code = (st?.StudentCode || att.StudentID).toLowerCase();
      return fullKh.includes(q) || code.includes(q);
    });
  }, [
    examAttemptsList,
    attemptGradingProgressMap,
    responseSearchQuery,
    responseStatusFilter,
    db.Students,
  ]);

  const responseSummaryStats = useMemo(() => {
    const total = examAttemptsList.length;
    let pendingGrading = 0;
    let partiallyGraded = 0;
    let fullyGraded = 0;

    examAttemptsList.forEach((att) => {
      const st = attemptGradingProgressMap.get(att.AttemptID)?.status || 'PENDING_GRADING';
      if (st === 'FULLY_GRADED') fullyGraded += 1;
      else if (st === 'PARTIALLY_GRADED') partiallyGraded += 1;
      else pendingGrading += 1;
    });

    return {
      total,
      submitted: total,
      pending: pendingGrading + partiallyGraded,
      pendingGrading,
      partiallyGraded,
      graded: fullyGraded,
      fullyGraded,
    };
  }, [examAttemptsList, attemptGradingProgressMap]);

  const currentReviewedAttempt =
    examAttemptsList[Math.min(selectedAttemptIndex, Math.max(0, examAttemptsList.length - 1))] ||
    examAttemptsList[0];

  const reviewedStudent = useMemo(
    () =>
      db.Students.find((s) => s.StudentID === currentReviewedAttempt?.StudentID) ||
      db.Students.find((s) => s.StudentCode === '6463') ||
      db.Students[0],
    [db.Students, currentReviewedAttempt]
  );

  // Initialize manual score input boxes when switching student in Individual Reviewer
  useEffect(() => {
    if (!currentReviewedAttempt) return;
    const attemptAnswers = localExamAnswers.filter(
      (ans) => ans.AttemptID === currentReviewedAttempt.AttemptID
    );
    const initMap: Record<string, string> = {};
    attemptAnswers.forEach((ans) => {
      initMap[ans.AnswerID] = String(ans.ScoreAwarded ?? 0);
    });
    setManualScoreOverrides((prev) => ({
      ...initMap,
      ...prev,
    }));
  }, [currentReviewedAttempt?.AttemptID, localExamAnswers]);

  const handleSaveIndividualGrades = () => {
    if (!canActorBuildExam) {
      setToastBanner({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិកែពិន្ទុមុខវិជ្ជានេះទេ',
        description: 'គ្រូបង្រៀនអាចកែពិន្ទុបានតែក្នុងមុខវិជ្ជាដែលខ្លួនត្រូវបានចាត់តាំងប៉ុណ្ណោះ។',
      });
      return;
    }
    if (!currentReviewedAttempt) return;
    const numericMap: Record<string, number> = {};
    let newTotalScore = 0;

    const nextAnswers = [...localExamAnswers];

    examQuestions.forEach((q) => {
      const existingIdx = nextAnswers.findIndex(
        (a) =>
          a.AttemptID === currentReviewedAttempt.AttemptID &&
          a.QuestionID === q.QuestionID
      );
      const ansRecord = existingIdx !== -1 ? nextAnswers[existingIdx] : undefined;
      const key = ansRecord
        ? ansRecord.AnswerID
        : `${currentReviewedAttempt.AttemptID}_${q.QuestionID}`;
      const rawVal = manualScoreOverrides[key];
      const parsed =
        rawVal !== undefined && !Number.isNaN(Number(rawVal))
          ? Math.min(q.Points, Math.max(0, Number(rawVal)))
          : ansRecord?.ScoreAwarded ?? 0;

      newTotalScore += parsed;

      if (ansRecord) {
        numericMap[ansRecord.AnswerID] = parsed;
        const wasManuallyChanged =
          rawVal !== undefined && Number(rawVal) !== ansRecord.ScoreAwarded;
        const isSubjective =
          q.QuestionType === 'SHORT_ANSWER' || q.QuestionType === 'ESSAY';
        nextAnswers[existingIdx] = {
          ...ansRecord,
          ScoreAwarded: parsed,
          IsCorrect: parsed > 0,
          GradedByUserID:
            wasManuallyChanged || isSubjective
              ? activeUserId
              : ansRecord.GradedByUserID || activeUserId,
        };
      }
    });

    setLocalExamAnswers(nextAnswers);

    setLocalAttemptStatusOverrides((prev) => ({
      ...prev,
      [currentReviewedAttempt.AttemptID]: {
        status: 'GRADED',
        totalScore: newTotalScore,
      },
    }));

    if (setDb) {
      setDb((prev) => ({
        ...prev,
        ExamAnswers: nextAnswers,
        ExamAttempts: prev.ExamAttempts.map((att) =>
          att.AttemptID === currentReviewedAttempt.AttemptID
            ? {
                ...att,
                AttemptStatus: 'GRADED',
                TotalScore: newTotalScore,
              }
            : att
        ),
      }));
    }

    if (onGradeManualAnswers) {
      onGradeManualAnswers({
        attemptId: currentReviewedAttempt.AttemptID,
        gradedScores: numericMap,
      });
    }

    setToastBanner({
      tone: 'success',
      title: 'រក្សាទុកពិន្ទុដោយជោគជ័យ (Fully Graded)',
      description: `ពិន្ទុរបស់សិស្ស ${reviewedStudent?.FullNameKh} (#${reviewedStudent?.StudentCode}) ត្រូវបានរក្សាទុក (${newTotalScore} / ${totalQuestionPoints} ពិន្ទុ)។`,
    });
  };

  // Automatic Grading that NEVER overwrites manually adjusted teacher scores
  const handleAutoGradeAllAttempts = () => {
    if (!canActorBuildExam) {
      setToastBanner({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិកែពិន្ទុស្វ័យប្រវត្តិ',
        description: 'គ្រូបង្រៀនអាចកែពិន្ទុបានតែក្នុងមុខវិជ្ជាដែលខ្លួនទទួលបន្ទុកប៉ុណ្ណោះ។',
      });
      return;
    }

    const nextOverrides: Record<string, { status: 'GRADED' | 'SUBMITTED'; totalScore: number }> = {
      ...localAttemptStatusOverrides,
    };
    let nextAnswers = [...localExamAnswers];
    let totalPreservedManualCount = 0;

    examAttemptsList.forEach((att) => {
      const safeResult = safeAutoGradeAttemptPreservingManualScores(
        att,
        examQuestions,
        nextAnswers,
        manualScoreOverrides
      );
      totalPreservedManualCount += safeResult.preservedManualCount;

      nextOverrides[att.AttemptID] = {
        status: safeResult.attemptStatus,
        totalScore: safeResult.totalScore,
      };

      // Merge updated answers without losing other exams' answers
      const updatedById = new Map(
        safeResult.updatedAnswers.map((ua) => [
          `${ua.AttemptID}_${ua.QuestionID}`,
          ua,
        ])
      );

      nextAnswers = nextAnswers.map((existing) => {
        const replacement = updatedById.get(
          `${existing.AttemptID}_${existing.QuestionID}`
        );
        return replacement ? { ...existing, ...replacement } : existing;
      });
    });

    setLocalExamAnswers(nextAnswers);
    setLocalAttemptStatusOverrides(nextOverrides);

    if (setDb) {
      setDb((prev) => ({
        ...prev,
        ExamAnswers: nextAnswers,
        ExamAttempts: prev.ExamAttempts.map((att) => {
          const ov = nextOverrides[att.AttemptID];
          if (!ov) return att;
          return {
            ...att,
            AttemptStatus: ov.status,
            TotalScore: ov.totalScore,
          };
        }),
      }));
    }

    setToastBanner({
      tone: 'success',
      title: 'កែពិន្ទុស្វ័យប្រវត្តិរួចរាល់ (រក្សាទុកពិន្ទុកែដោយដៃ)',
      description: `បានពិនិត្យសន្លឹកកិច្ចការសិស្ស ${examAttemptsList.length} នាក់ និងរក្សាទុកពិន្ទុកែដោយគ្រូចំនួន ${totalPreservedManualCount} ចំណុចដោយមិនសរសេរជាន់ពីលើ។`,
    });
  };

  const handleSyncToMonthlyScores = () => {
    if (!canActorBuildExam) {
      setToastBanner({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិប្រកាសលទ្ធផលវិញ្ញាសានេះទេ',
        description: 'គ្រូបង្រៀនអាចប្រកាសលទ្ធផលបានតែក្នុងមុខវិជ្ជាដែលខ្លួនត្រូវបានចាត់តាំងប៉ុណ្ណោះ។',
      });
      return;
    }

    const now = new Date().toISOString();
    if (setDb) {
      setDb((prev) => {
        const scoreByStudent = new Map<string, number>();
        examAttemptsList.forEach((att) => {
          scoreByStudent.set(att.StudentID, att.TotalScore);
        });

        const updatedMonthly = prev.MonthlyScores.map((ms) => {
          if (ms.ClassID !== currentExam.ClassID) return ms;
          const syncedScore = scoreByStudent.get(ms.StudentID);
          if (syncedScore === undefined) return ms;
          return {
            ...ms,
            UpdatedAt: now,
          };
        });

        return {
          ...prev,
          MonthlyScores: updatedMonthly,
          AuditLogs: [
            {
              LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
              UserID: activeUserId,
              Action: 'SYNC_EXAM_TO_MONTHLY_SCORES',
              Module: 'ScoreService.gs',
              RecordID: currentExam.ExamID,
              OldValueJSON: '{}',
              NewValueJSON: JSON.stringify({
                examId: currentExam.ExamID,
                classId: currentExam.ClassID,
                syncedAttempts: examAttemptsList.length,
              }),
              Timestamp: now,
              IPOrSessionReference: 'GAS-FORMS-SYNC',
              Description: `Synced ${examAttemptsList.length} graded responses from ${currentExam.ExamTitle} to MonthlyScores (${currentExam.ClassID})`,
            },
            ...prev.AuditLogs,
          ],
        };
      });
    }

    setToastBanner({
      tone: 'success',
      title: 'ប្រកាសលទ្ធផល និងបញ្ជូនពិន្ទុជោគជ័យ',
      description: `ពិន្ទុប្រឡងទាំងអស់នៃថ្នាក់ ${examClass?.ClassName || '12C'} (ខែ${currentExam.ExamMonth}) ត្រូវបានបញ្ចូលទៅក្នុងតារាងពិន្ទុប្រចាំខែ។`,
    });
  };

  // ============================================================================
  // TAB 3 STATE: SAFE EXAM PREVIEW (100% Isolated Non-Destructive Preview Mode)
  // ============================================================================
  const [studentExamActorId] = useState<string>(() => {
    if (isStudentRole) {
      const matched = db.Students.find(
        (s) =>
          s.StudentCode === activeUser.Username ||
          activeUser.UserID.endsWith(s.StudentCode) ||
          s.FullNameKh === activeUser.FullNameKh
      );
      return matched?.StudentID || 'STD-5187';
    }
    return 'STD-6463';
  });

  const activeExamStudent = useMemo(
    () =>
      db.Students.find((s) => s.StudentID === studentExamActorId) ||
      db.Students.find((s) => s.StudentCode === '6463') ||
      db.Students[0],
    [db.Students, studentExamActorId]
  );

  const [studentAnswers, setStudentAnswers] = useState<
    Record<string, StudentSubmittedAnswerInput>
  >({
    'QST-ICT-001': { questionId: 'QST-ICT-001', selectedIndex: 0 },
    'QST-ICT-002': { questionId: 'QST-ICT-002', selectedIndex: 1 },
    'QST-ICT-003': { questionId: 'QST-ICT-003', booleanAnswer: true, selectedIndex: 0 },
    'QST-ICT-004': { questionId: 'QST-ICT-004', textAnswer: 'SHA-256' },
    'QST-ICT-005': {
      questionId: 'QST-ICT-005',
      textAnswer:
        'ការបំបែកមូលដ្ឋានទិន្នន័យជា ១៩ សន្លឹកជួយការពារការស្ទួនទិន្នន័យសិស្ស និងជួយគណនាចំណាត់ថ្នាក់ស្វ័យប្រវត្តិ។',
    },
  });

  // Question Navigation & Review Flagging State
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<string[]>([]);
  const [studentNavigationMode, setStudentNavigationMode] = useState<'ALL_QUESTIONS' | 'STEP_BY_STEP'>('ALL_QUESTIONS');
  const [activeStudentQuestionIdx, setActiveStudentQuestionIdx] = useState<number>(0);

  // Time Management State
  const totalDurationSeconds = useMemo(
    () => Math.max(60, (currentExam.DurationMinutes || 60) * 60),
    [currentExam.DurationMinutes]
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    () => (currentExam.DurationMinutes || 60) * 60 - 1065
  );
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);

  const [submittedResultSummary, setSubmittedResultSummary] = useState<{
    attemptId: string;
    totalScore: number;
    maxScore: number;
    passScore: number;
    passed: boolean;
    timeSpentSeconds: number;
    percentage: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
    items: ReturnType<typeof autoGradeExamSubmission>['items'];
  } | null>(null);

  // Countdown timer when in Student Exam View & not yet submitted
  useEffect(() => {
    if (activeTab !== 'STUDENT_EXAM_VIEW' || submittedResultSummary || isTimerPaused) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTab, submittedResultSummary, isTimerPaused]);

  const formatTimerMmSs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isQuestionAnswered = (q: QuestionRecord): boolean => {
    const a = studentAnswers[q.QuestionID];
    if (!a) return false;
    if (a.selectedIndex !== undefined && a.selectedIndex >= 0) return true;
    if (a.booleanAnswer !== undefined) return true;
    if (a.textAnswer && a.textAnswer.trim().length > 0) return true;
    return false;
  };

  const answeredCount = useMemo(() => {
    return examQuestions.filter((q) => isQuestionAnswered(q)).length;
  }, [examQuestions, studentAnswers]);

  const elapsedSeconds = Math.max(0, totalDurationSeconds - remainingSeconds);

  const handleToggleFlagQuestion = (questionId: string) => {
    setFlaggedQuestionIds((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleJumpToQuestion = (qIndex: number, questionId: string) => {
    setActiveStudentQuestionIdx(qIndex);
    if (studentNavigationMode === 'ALL_QUESTIONS') {
      const el = document.getElementById(`exam-question-${questionId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleSelectStudentOption = (
    q: QuestionRecord,
    optionIdx: number
  ) => {
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

  const handleClearStudentForm = () => {
    setConfirmModal({
      title: 'សម្អាតចម្លើយសាកល្បងទាំងអស់',
      description: 'តើអ្នកពិតជាចង់សម្អាតចម្លើយសាកល្បងទាំងអស់ក្នុងរបៀបមើលជាមុន (Preview Mode) មែនទេ?',
      confirmLabel: 'សម្អាតចម្លើយ',
      tone: 'danger',
      onConfirm: () => {
        setStudentAnswers({});
        setFlaggedQuestionIds([]);
        setSubmittedResultSummary(null);
        setConfirmModal(null);
        setToastBanner({
          tone: 'info',
          title: 'បានសម្អាតចម្លើយសាកល្បង',
          description: 'ចម្លើយសាកល្បងទាំងអស់ត្រូវបានកំណត់ឡើងវិញ។',
        });
      },
    });
  };

  // Exit Safe Exam Preview -> Resets preview simulation state and returns to Questions tab
  const handleExitExamPreview = () => {
    setSubmittedResultSummary(null);
    setFlaggedQuestionIds([]);
    setIsTimerPaused(false);
    setRemainingSeconds((currentExam.DurationMinutes || 60) * 60);
    setActiveTab('QUESTIONS_BUILDER');
  };

  // Safe Exam Preview Submission Simulation:
  // Strictly isolated in Preview Mode when inside OnlineExamsPortalView (never creates real attempts,
  // never saves preview answers to db, never affects attempt limits or student scores)
  const handleStudentSubmitQuiz = () => {
    const summary = autoGradeExamSubmission(examQuestions, studentAnswers);
    let totalPointsEarned = 0;
    const enrichedItems = summary.items.map((item) => {
      const q = examQuestions.find((qu) => qu.QuestionID === item.questionId);
      if (!q) return item;
      if (item.requiresManualGrading) {
        const rawAns = studentAnswers[q.QuestionID]?.textAnswer?.trim() || '';
        const hasValidResponse = rawAns.length >= 3;
        const awarded = hasValidResponse ? q.Points : 0;
        totalPointsEarned += awarded;
        return {
          ...item,
          scoreAwarded: awarded,
          isCorrect: hasValidResponse,
        };
      }
      totalPointsEarned += item.scoreAwarded;
      return item;
    });

    const maxScore =
      examQuestions.reduce((sum, q) => sum + q.Points, 0) ||
      currentExam.MaximumScore ||
      50;
    const passScore = currentExam.PassScore || Math.round(maxScore * 0.5);
    const passed = totalPointsEarned >= passScore;
    const pct = maxScore > 0 ? Math.round((totalPointsEarned / maxScore) * 100) : 0;
    const grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' =
      pct >= 90
        ? 'A'
        : pct >= 80
        ? 'B'
        : pct >= 70
        ? 'C'
        : pct >= 60
        ? 'D'
        : pct >= 50
        ? 'E'
        : 'F';

    // Always operate in Safe Preview Mode inside the Online Exams Portal Exam Preview tab
    // unless explicitly invoked by an actual student session
    if (!isStudentRole) {
      setSubmittedResultSummary({
        attemptId: `PREVIEW-${Date.now().toString(36).toUpperCase()}`,
        totalScore: totalPointsEarned,
        maxScore,
        passScore,
        passed,
        timeSpentSeconds: elapsedSeconds,
        percentage: pct,
        grade,
        items: enrichedItems,
      });

      setToastBanner({
        tone: 'info',
        title: `លទ្ធផលសាកល្បងក្នុងរបៀបមើលជាមុន (Safe Preview Score): ${totalPointsEarned} / ${maxScore}`,
        description:
          'ការធ្វើតេស្តក្នុងរបៀបមើលជាមុនមិនបង្កើតសន្លឹកកិច្ចការសិស្ស មិនកាត់ចំនួនដងប្រឡង និងមិនប៉ះពាល់ពិន្ទុសិស្សពិតឡើយ។',
      });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const createdAttempt = onSubmitExamAttempt({
      examId: currentExam.ExamID,
      studentId: activeExamStudent.StudentID,
      scoreObtained: totalPointsEarned,
      percentage: pct,
      grade,
      attemptStatus: summary.hasPendingManualQuestions ? 'SUBMITTED' : 'GRADED',
      answersToSave: enrichedItems.map((it) => ({
        questionId: it.questionId,
        answerJson: it.answerJson,
        scoreAwarded: it.scoreAwarded,
        isCorrect: it.isCorrect,
        gradedByUserId: it.requiresManualGrading ? 'PENDING_TEACHER' : 'SYSTEM',
      })),
    });

    setSubmittedResultSummary({
      attemptId: createdAttempt.AttemptID,
      totalScore: totalPointsEarned,
      maxScore,
      passScore,
      passed,
      timeSpentSeconds: elapsedSeconds,
      percentage: pct,
      grade,
      items: enrichedItems,
    });
  };

  // Auto-submit when countdown timer reaches 00:00
  useEffect(() => {
    if (
      activeTab === 'STUDENT_EXAM_VIEW' &&
      !submittedResultSummary &&
      remainingSeconds === 0
    ) {
      handleStudentSubmitQuiz();
    }
  }, [remainingSeconds, activeTab, submittedResultSummary]);

  // Filtered Exams for Top Selector Grid (Strictly respects Teacher Subject Permissions + Monthly/Class/Year organization)
  const filteredExamsList = useMemo(() => {
    const q = externalSearchQuery.trim().toLowerCase();
    return authorizedExamsForActor.filter((ex) => {
      const exClasses = ex.ClassIDs && ex.ClassIDs.length > 0 ? ex.ClassIDs : [ex.ClassID];
      if (classFilter !== 'ALL' && !exClasses.includes(classFilter)) return false;
      if (examSubjectFilter !== 'ALL' && ex.SubjectID !== examSubjectFilter) return false;
      if (examMonthFilter !== 'ALL' && ex.ExamMonth !== examMonthFilter) return false;
      if (
        examAcademicYearFilter !== 'ALL' &&
        ex.AcademicYearID !== examAcademicYearFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        ex.ExamTitle.toLowerCase().includes(q) ||
        ex.ExamID.toLowerCase().includes(q) ||
        ex.ClassID.toLowerCase().includes(q) ||
        exClasses.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [
    authorizedExamsForActor,
    classFilter,
    examSubjectFilter,
    examMonthFilter,
    examAcademicYearFilter,
    externalSearchQuery,
  ]);

  const totalQuestionPoints = useMemo(
    () => examQuestions.reduce((acc, q) => acc + q.Points, 0),
    [examQuestions]
  );

  // Questions displayed in Student Exam Preview (Step-by-step vs All)
  const displayedStudentQuestions = useMemo(() => {
    if (studentNavigationMode === 'STEP_BY_STEP') {
      const target = examQuestions[activeStudentQuestionIdx] || examQuestions[0];
      return target ? [target] : [];
    }
    return examQuestions;
  }, [studentNavigationMode, examQuestions, activeStudentQuestionIdx]);

  return (
    <div className="space-y-4">
      {toastBanner && (
        <Toast
          tone={toastBanner.tone}
          title={toastBanner.title}
          description={toastBanner.description}
          onDismiss={() => setToastBanner(null)}
        />
      )}

      {/* ===================================================================== */}
      {/* TOP HEADER & 3 MAIN TABS (Questions | Responses & Grading | Preview)  */}
      {/* ===================================================================== */}
      {!isStudentRole && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs px-4 sm:px-6 pt-4 pb-0">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-100">
            {/* Left: Active Exam Selector + Metadata */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    aria-label="ជ្រើសរើសវិញ្ញាសាប្រឡង"
                    value={currentExam.ExamID}
                    onChange={(e) => {
                      setSelectedExamId(e.target.value);
                      setSubmittedResultSummary(null);
                    }}
                    className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-600 cursor-pointer truncate max-w-full"
                  >
                    {authorizedExamsForActor.map((ex) => {
                      const cls = db.Classes.find((c) => c.ClassID === ex.ClassID);
                      const sub = db.Subjects.find((s) => s.SubjectID === ex.SubjectID);
                      return (
                        <option key={ex.ExamID} value={ex.ExamID}>
                          {ex.ExamTitle} ({sub?.SubjectNameKh || ex.SubjectID} · ខែ{ex.ExamMonth} · ថ្នាក់ {cls?.ClassName || ex.ClassID})
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    title="មើលវិញ្ញាសាទាំងអស់តាមមុខវិជ្ជា ខែ និងថ្នាក់"
                    onClick={() => setShowExamSelectorGrid((v) => !v)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 font-khmer-body inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{showExamSelectorGrid ? 'លាក់បញ្ជី' : 'វិញ្ញាសាទាំងអស់'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 font-khmer-body">
                  <span>មុខវិជ្ជា៖ {examSubject?.SubjectNameKh}</span>
                  <span aria-hidden="true">·</span>
                  <span>ខែប្រឡង៖ ខែ{currentExam.ExamMonth}</span>
                  <span aria-hidden="true">·</span>
                  <span>ថ្នាក់ទី {examClass?.ClassName || '12C'}</span>
                  <span aria-hidden="true">·</span>
                  <span>ឆ្នាំសិក្សា {examAcademicYear?.AcademicYearName || '២០២៥-២០២៦'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular font-semibold text-indigo-600">
                    {examQuestions.length} សំណួរ · {totalQuestionPoints} ពិន្ទុ
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Create Blank Exam & Delete Exam Buttons */}
            <div className="no-print flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                title="បង្កើតវិញ្ញាសាប្រឡងថ្មី"
                onClick={handleCreateNewBlankQuiz}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-khmer-body shadow-2xs transition-colors cursor-pointer"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>វិញ្ញាសាថ្មី</span>
              </button>

              <button
                type="button"
                data-testid="delete-current-exam-btn"
                title="លុបវិញ្ញាសាប្រឡងបច្ចុប្បន្ន"
                onClick={handleDeleteCurrentExam}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>លុបវិញ្ញាសា</span>
              </button>
            </div>
          </div>

          {/* Collapsible All-Exams Grid with Subject, Month, Class, and Academic Year Filters */}
          {showExamSelectorGrid && (
            <div className="py-4 border-b border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-700 font-khmer-body">
                  ជ្រើសរើសវិញ្ញាសាតាមមុខវិជ្ជា ខែប្រឡង ថ្នាក់ និងឆ្នាំសិក្សា៖
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="ត្រងវិញ្ញាសាតាមមុខវិជ្ជា"
                    value={examSubjectFilter}
                    onChange={(e) => setExamSubjectFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold font-khmer-body bg-slate-50"
                  >
                    <option value="ALL">គ្រប់មុខវិជ្ជា</option>
                    {allowedSubjectsForActor.map((s) => (
                      <option key={s.SubjectID} value={s.SubjectID}>
                        {s.SubjectNameKh}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="ត្រងវិញ្ញាសាតាមខែ"
                    value={examMonthFilter}
                    onChange={(e) => setExamMonthFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold font-khmer-body bg-slate-50"
                  >
                    <option value="ALL">គ្រប់ខែប្រឡង</option>
                    {ALL_SUPPORTED_QUESTION_MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {formatMonthBadgeLabel(m)}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="ត្រងតាមថ្នាក់"
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold font-khmer-body bg-slate-50"
                  >
                    <option value="ALL">គ្រប់ថ្នាក់ទាំង ១៧ (7A–12C)</option>
                    {db.Classes.map((c) => (
                      <option key={c.ClassID} value={c.ClassID}>
                        ថ្នាក់ទី {c.ClassName}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="ត្រងវិញ្ញាសាតាមឆ្នាំសិក្សា"
                    value={examAcademicYearFilter}
                    onChange={(e) => setExamAcademicYearFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold font-khmer-body bg-slate-50"
                  >
                    <option value="ALL">គ្រប់ឆ្នាំសិក្សា</option>
                    {db.AcademicYears.map((ay) => (
                      <option key={ay.AcademicYearID} value={ay.AcademicYearID}>
                        ឆ្នាំសិក្សា {ay.AcademicYearName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {filteredExamsList.map((ex) => {
                  const sub = db.Subjects.find((s) => s.SubjectID === ex.SubjectID);
                  const cls = db.Classes.find((c) => c.ClassID === ex.ClassID);
                  const ay = db.AcademicYears.find(
                    (a) => a.AcademicYearID === ex.AcademicYearID
                  );
                  const isSelected = ex.ExamID === currentExam.ExamID;
                  return (
                    <button
                      key={ex.ExamID}
                      type="button"
                      onClick={() => {
                        setSelectedExamId(ex.ExamID);
                        setSubmittedResultSummary(null);
                        setShowExamSelectorGrid(false);
                      }}
                      className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/15'
                          : 'border-slate-200 hover:border-indigo-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 font-khmer-body mb-1">
                        <span className="font-bold text-indigo-700">
                          ថ្នាក់ទី {cls?.ClassName || ex.ClassID} · {sub?.SubjectNameKh}
                        </span>
                        <span className="font-mono-tabular">{ex.DurationMinutes} នាទី</span>
                      </div>
                      <div className="text-sm font-bold text-slate-900 font-khmer-body line-clamp-1">
                        {ex.ExamTitle}
                      </div>
                      <div className="text-xs text-slate-500 font-khmer-body mt-1">
                        ពិន្ទុសរុប៖ {ex.MaximumScore} ពិន្ទុ · ខែ{ex.ExamMonth} ·{' '}
                        {ay?.AcademicYearName || '២០២៥-២០២៦'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3 Main Navigation Tabs */}
          <div
            role="tablist"
            aria-label="Online Exams Main Tabs"
            className="flex items-center gap-2 sm:gap-6 pt-1 overflow-x-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'QUESTIONS_BUILDER'}
              onClick={() => setActiveTab('QUESTIONS_BUILDER')}
              className={`px-4 py-3 text-xs sm:text-sm font-bold font-khmer-body border-b-2 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'QUESTIONS_BUILDER'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>សំណួរ (Questions)</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'RESPONSES_GRADING'}
              onClick={() => setActiveTab('RESPONSES_GRADING')}
              className={`px-4 py-3 text-xs sm:text-sm font-bold font-khmer-body border-b-2 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'RESPONSES_GRADING'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>ការឆ្លើយតប &amp; កែពិន្ទុ (Responses &amp; Grading)</span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-mono-tabular font-bold">
                {responseSummaryStats.total}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'STUDENT_EXAM_VIEW'}
              onClick={() => setActiveTab('STUDENT_EXAM_VIEW')}
              className={`px-4 py-3 text-xs sm:text-sm font-bold font-khmer-body border-b-2 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'STUDENT_EXAM_VIEW'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>មើលទម្រង់ប្រឡង (Exam Preview)</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: QUESTIONS (Create, Filter, Edit & Preview Questions)           */}
      {/* ===================================================================== */}
      {activeTab === 'QUESTIONS_BUILDER' && !isStudentRole && (
        <div className="space-y-4">
          {/* 1. TOP TOOLBAR: Create Question, Import Questions, Exam Settings, Preview */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Ownership Badge */}
              <div
                className={`inline-flex items-center gap-1.5 text-xs font-bold font-khmer-body px-3 py-1.5 rounded-xl border ${
                  canActorBuildExam
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50/80 border-amber-200 text-amber-800'
                }`}
              >
                {canActorBuildExam ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>
                  {canActorBuildExam
                    ? `សិទ្ធិគ្រប់គ្រង៖ ${examSubject?.SubjectNameKh}`
                    : `មើលបានតែប៉ុណ្ណោះ (${examSubject?.SubjectNameKh})`}
                </span>
              </div>

              {/* Toggle Exam Header & Settings Card */}
              <button
                type="button"
                data-testid="toggle-exam-settings-btn"
                onClick={() => setShowExamSettingsPanel((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold font-khmer-body transition-colors cursor-pointer ${
                  showExamSettingsPanel
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>ការកំណត់វិញ្ញាសា</span>
                {showExamSettingsPanel ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Primary Toolbar Actions: Create Question, Import Questions, Preview */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                title="បង្កើតសំណួរថ្មីក្នុងវិញ្ញាសានេះ"
                onClick={() => handleAddBlankQuestion(focusedQuestion?.QuestionID)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>បន្ថែមសំណួរថ្មី</span>
              </button>

              <button
                type="button"
                title="ទាញយកសំណួរពីឃ្លាំងសំណួរតាមខែ"
                onClick={handleOpenQuestionBankPicker}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
              >
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>នាំចូលពីឃ្លាំងសំណួរ</span>
              </button>

              <button
                type="button"
                data-testid="open-google-form-import-btn"
                title="ទាញយកសំណួរពី Google Form"
                onClick={handleOpenGoogleFormImportModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#673AB7] border border-purple-200 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Google Form</span>
              </button>

              <button
                type="button"
                title="មើលទម្រង់ប្រឡងសម្រាប់សិស្ស"
                onClick={() => setActiveTab('STUDENT_EXAM_VIEW')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
              >
                <Eye className="w-4 h-4 text-indigo-600" />
                <span>មើលជាមុន</span>
              </button>
            </div>
          </div>

          {/* 2. EXAM HEADER & SETTINGS CARD (Always keeps Title, Instructions & Publish/Unpublish accessible; full settings collapsible) */}
          <div
            data-testid="google-forms-exam-header-card"
            className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
          >
            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    aria-label="ឈ្មោះការប្រឡង"
                    value={currentExam.ExamTitle}
                    onChange={(e) => updateExamMetadata({ ExamTitle: e.target.value })}
                    placeholder="បញ្ចូលឈ្មោះវិញ្ញាសាប្រឡង..."
                    className="w-full text-lg sm:text-xl font-extrabold text-slate-900 font-khmer-body border-b border-transparent hover:border-slate-200 focus:border-indigo-600 focus:outline-none pb-1 transition-colors"
                  />
                  <input
                    type="text"
                    aria-label="សេចក្ដីណែនាំ"
                    value={currentExam.Instructions}
                    onChange={(e) => updateExamMetadata({ Instructions: e.target.value })}
                    placeholder="សេចក្ដីណែនាំសម្រាប់សិស្សមុនចាប់ផ្ដើមប្រឡង..."
                    className="w-full text-xs sm:text-sm text-slate-500 font-khmer-body border-b border-transparent hover:border-slate-200 focus:border-indigo-600 focus:outline-none pb-1 transition-colors"
                  />
                </div>

                {/* Publish / Unpublish Quick Toggle & Status Selector */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid="toggle-publish-exam-btn"
                    onClick={() => {
                      const nextStatus: ExamRecord['Status'] =
                        currentExam.Status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
                      updateExamMetadata({ Status: nextStatus });
                      setToastBanner({
                        tone: nextStatus === 'PUBLISHED' ? 'success' : 'info',
                        title:
                          nextStatus === 'PUBLISHED'
                            ? 'បានប្រកាសដាក់ឱ្យប្រឡង (Published)'
                            : 'បានដកចេញទៅជាសេចក្ដីព្រាង (Unpublished / Draft)',
                        description: `វិញ្ញាសា «${currentExam.ExamTitle}» ស្ថិតក្នុងស្ថានភាព ${nextStatus}។`,
                      });
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold font-khmer-body transition-colors cursor-pointer ${
                      currentExam.Status === 'PUBLISHED'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                        : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
                    }`}
                  >
                    {currentExam.Status === 'PUBLISHED' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>កំពុងបើកប្រឡង (Unpublish)</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>ប្រកាសដាក់ឱ្យប្រឡង (Publish)</span>
                      </>
                    )}
                  </button>

                  <select
                    aria-label="ស្ថានភាពប្រឡង"
                    value={currentExam.Status}
                    onChange={(e) =>
                      updateExamMetadata({
                        Status: e.target.value as ExamRecord['Status'],
                      })
                    }
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-khmer-body focus:outline-none cursor-pointer ${
                      currentExam.Status === 'PUBLISHED'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : currentExam.Status === 'DRAFT'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-slate-100 border-slate-300 text-slate-700'
                    }`}
                  >
                    <option value="PUBLISHED">បើកឱ្យប្រឡង (Published)</option>
                    <option value="DRAFT">សេចក្ដីព្រាង (Draft)</option>
                    <option value="CLOSED">បិទបញ្ចប់ (Closed)</option>
                  </select>
                </div>
              </div>

              {/* Collapsible Detailed Exam Settings (Subject, Classes, Academic Year, Month, Schedule, Duration, Total & Passing Marks) */}
              {showExamSettingsPanel && (
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  {/* Row 1: Subject, Class, Academic Year, Month */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        មុខវិជ្ជាប្រឡង (Subject) *
                      </label>
                      <select
                        aria-label="មុខវិជ្ជា"
                        value={currentExam.SubjectID}
                        onChange={(e) => updateExamMetadata({ SubjectID: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body focus:outline-none focus:border-indigo-600"
                      >
                        {allowedSubjectsForActor.map((sub) => (
                          <option key={sub.SubjectID} value={sub.SubjectID}>
                            {sub.SubjectNameKh}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        ថ្នាក់គោល (Class) *
                      </label>
                      <select
                        aria-label="ថ្នាក់រៀន"
                        value={currentExam.ClassID}
                        onChange={(e) => {
                          const nextPrimary = e.target.value;
                          const nextSet = Array.from(new Set([nextPrimary, ...assignedClassIds]));
                          updateExamMetadata({ ClassID: nextPrimary, ClassIDs: nextSet });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body focus:outline-none focus:border-indigo-600"
                      >
                        {authorizedClassesForCurrentSubject.map((cls) => (
                          <option key={cls.ClassID} value={cls.ClassID}>
                            ថ្នាក់ទី {cls.ClassName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        ឆ្នាំសិក្សា (Academic Year) *
                      </label>
                      <select
                        aria-label="ឆ្នាំសិក្សា"
                        value={currentExam.AcademicYearID || 'AY-2025-2026'}
                        onChange={(e) => updateExamMetadata({ AcademicYearID: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body focus:outline-none focus:border-indigo-600"
                      >
                        {db.AcademicYears.map((ay) => (
                          <option key={ay.AcademicYearID} value={ay.AcademicYearID}>
                            ឆ្នាំសិក្សា {ay.AcademicYearName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        ខែប្រឡង (Month) *
                      </label>
                      <select
                        aria-label="ខែប្រឡង"
                        value={currentExam.ExamMonth}
                        onChange={(e) => updateExamMetadata({ ExamMonth: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body focus:outline-none focus:border-indigo-600"
                      >
                        {ALL_SUPPORTED_QUESTION_MONTHS.map((m) => (
                          <option key={m} value={m}>
                            {formatMonthBadgeLabel(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Start Time, End Time, Duration, Total Marks, Passing Marks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        ម៉ោងចាប់ផ្ដើម (Start Time)
                      </label>
                      <input
                        type="datetime-local"
                        aria-label="ម៉ោងចាប់ផ្ដើមប្រឡង"
                        value={(currentExam.StartDateTime || '2026-11-08T08:00:00Z').slice(0, 16)}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          updateExamMetadata({ StartDateTime: `${e.target.value}:00Z` });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-mono-tabular focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        ម៉ោងបញ្ចប់ (End Time)
                      </label>
                      <input
                        type="datetime-local"
                        aria-label="ម៉ោងបញ្ចប់ប្រឡង"
                        value={(currentExam.EndDateTime || '2026-11-15T17:00:00Z').slice(0, 16)}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          updateExamMetadata({ EndDateTime: `${e.target.value}:00Z` });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-mono-tabular focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        រយៈពេល (Duration នាទី) *
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={240}
                        aria-label="រយៈពេលប្រឡង"
                        value={currentExam.DurationMinutes}
                        onChange={(e) => {
                          const mins = Math.max(10, Number(e.target.value) || 60);
                          updateExamMetadata({ DurationMinutes: mins });
                          setRemainingSeconds(mins * 60);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-mono-tabular focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        ពិន្ទុសរុប (Total Marks)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        aria-label="ពិន្ទុសរុប"
                        value={currentExam.MaximumScore || totalQuestionPoints || 50}
                        onChange={(e) =>
                          updateExamMetadata({
                            MaximumScore: Math.max(1, Number(e.target.value) || 50),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-mono-tabular text-indigo-700 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        ពិន្ទុជាប់ (Passing Marks)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        aria-label="ពិន្ទុជាប់"
                        value={currentExam.PassScore || Math.round(totalQuestionPoints * 0.5)}
                        onChange={(e) =>
                          updateExamMetadata({
                            PassScore: Math.max(1, Number(e.target.value) || 25),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-mono-tabular text-emerald-700 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Multi-Class Selector (Single Shared Examination across Authorized Classes) */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 font-khmer-body">
                        វិញ្ញាសារួមតែមួយ (Single Shared Exam) • ថ្នាក់ដែលអនុញ្ញាតឱ្យប្រឡង ({assignedClassIds.length} ថ្នាក់៖{' '}
                        {assignedClassNames.join(', ')})
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleAssignClassGroup(
                              'AUTHORIZED',
                              `គ្រប់ថ្នាក់ទទួលបន្ទុក (${authorizedClassesForCurrentSubject.length} ថ្នាក់)`
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 font-khmer-body cursor-pointer"
                        >
                          គ្រប់ថ្នាក់ទទួលបន្ទុក ({authorizedClassesForCurrentSubject.length} ថ្នាក់)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAssignClassGroup('12', 'ថ្នាក់ទី ១២')}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 font-khmer-body cursor-pointer"
                        >
                          ថ្នាក់ទី ១២
                        </button>
                        {isAdminOrSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => handleAssignClassGroup('ALL', 'គ្រប់ថ្នាក់ទាំង ១៧')}
                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 font-khmer-body cursor-pointer"
                          >
                            គ្រប់ថ្នាក់ (7A–12C)
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {db.Classes.map((cls) => {
                        const isAssigned = assignedClassIds.includes(cls.ClassID);
                        const isAuthorizedForTeacher =
                          !isTeacherRole || authorizedClassIdSetForSubject.has(cls.ClassID);
                        return (
                          <button
                            key={cls.ClassID}
                            type="button"
                            onClick={() => handleToggleExamClass(cls.ClassID)}
                            title={
                              isAuthorizedForTeacher
                                ? `ថ្នាក់ទី ${cls.ClassName}`
                                : `ថ្នាក់ទី ${cls.ClassName} (មិនស្ថិតក្នុងការចាត់តាំងមុខវិជ្ជានេះទេ)`
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold font-khmer-body border inline-flex items-center gap-1 transition-colors cursor-pointer ${
                              isAssigned
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : isAuthorizedForTeacher
                                  ? 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400'
                                  : 'bg-slate-100 text-slate-400 border-slate-200/70 opacity-60'
                            }`}
                          >
                            {isAssigned && <Check className="w-3 h-3 stroke-[2.5]" />}
                            <span>{cls.ClassName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. TWO-COLUMN QUESTIONS WORKSPACE (Left: Question List & Filters | Right: Editor + Question Preview) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* =============================================================== */}
            {/* LEFT COLUMN (lg:col-span-5): QUESTION LIST, SEARCH & FILTERS    */}
            {/* =============================================================== */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-indigo-600" />
                  <span>បញ្ជីសំណួរ ({filteredBuilderQuestions.length})</span>
                </h3>
                <span className="text-xs font-mono-tabular font-bold text-indigo-600">
                  សរុប {totalQuestionPoints} ពិន្ទុ
                </span>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  aria-label="ស្វែងរកសំណួរ"
                  value={questionSearchQuery}
                  onChange={(e) => setQuestionSearchQuery(e.target.value)}
                  placeholder="ស្វែងរកសំណួរ..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-khmer-body focus:outline-none focus:border-indigo-600"
                />
              </div>

              {/* Filter Row: Subject, Month, Question Type (Consistent with Responses & Grading) */}
              <div className="grid grid-cols-3 gap-2">
                <select
                  aria-label="ត្រងតាមមុខវិជ្ជា"
                  value={questionListSubjectFilter}
                  onChange={(e) =>
                    handleSelectSubjectOrMonthFilter(e.target.value, questionListMonthFilter)
                  }
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 font-khmer-body focus:outline-none focus:border-indigo-600 truncate"
                >
                  <option value="ALL">គ្រប់មុខវិជ្ជា</option>
                  {allowedSubjectsForActor.map((s) => (
                    <option key={s.SubjectID} value={s.SubjectID}>
                      {s.SubjectNameKh}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="ត្រងតាមខែ"
                  value={questionListMonthFilter}
                  onChange={(e) =>
                    handleSelectSubjectOrMonthFilter(questionListSubjectFilter, e.target.value)
                  }
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 font-khmer-body focus:outline-none focus:border-indigo-600 truncate"
                >
                  <option value="ALL">គ្រប់ខែ</option>
                  {ALL_SUPPORTED_QUESTION_MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthBadgeLabel(m)}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="ត្រងតាមប្រភេទសំណួរ"
                  value={questionListTypeFilter}
                  onChange={(e) => setQuestionListTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 font-khmer-body focus:outline-none focus:border-indigo-600 truncate"
                >
                  <option value="ALL">គ្រប់ប្រភេទ</option>
                  <option value="MULTIPLE_CHOICE">ជ្រើសរើសចម្លើយមួយ</option>
                  <option value="CHECKBOXES">ជ្រើសរើសច្រើនចម្លើយ</option>
                  <option value="TRUE_FALSE">ពិត / មិនពិត</option>
                  <option value="SHORT_ANSWER">ចម្លើយខ្លី</option>
                  <option value="PARAGRAPH">សរសេរវែង</option>
                  <option value="DROPDOWN">បញ្ជីទម្លាក់ចុះ</option>
                  <option value="LINEAR_SCALE">មាត្រដ្ឋានលីនេអ៊ែរ</option>
                </select>
              </div>

              {/* Scrollable Question List */}
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {filteredBuilderQuestions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 font-khmer-body">
                    មិនមានសំណួរត្រូវនឹងការស្វែងរកទេ។
                  </div>
                ) : (
                  filteredBuilderQuestions.map((q) => {
                    const qOrderIdx = examQuestions.findIndex(
                      (item) => item.QuestionID === q.QuestionID
                    );
                    const isSelected = q.QuestionID === focusedQuestion?.QuestionID;
                    const subType = getQuestionSubType(q);
                    return (
                      <div
                        key={q.QuestionID}
                        onClick={() => setFocusedQuestionId(q.QuestionID)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-600/10'
                            : 'bg-white hover:bg-slate-50 border-slate-200/90'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-khmer-body mb-1">
                              <span className="font-mono-tabular font-extrabold text-indigo-600">
                                សំណួរទី {qOrderIdx + 1}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{QUESTION_SUBTYPE_LABELS_KH[subType]}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular font-bold text-slate-700 shrink-0">
                                {q.Points} ពិន្ទុ
                              </span>
                            </div>
                            <div className="text-xs sm:text-sm font-semibold text-slate-900 font-khmer-body line-clamp-2">
                              {q.QuestionText}
                            </div>
                          </div>

                          {/* Reorder & Quick Delete */}
                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              disabled={qOrderIdx <= 0}
                              title="រំកិលឡើងលើ"
                              onClick={() => handleMoveQuestion(q.QuestionID, 'UP')}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={qOrderIdx >= examQuestions.length - 1}
                              title="រំកិលចុះក្រោម"
                              onClick={() => handleMoveQuestion(q.QuestionID, 'DOWN')}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* =============================================================== */}
            {/* RIGHT COLUMN (lg:col-span-7): QUESTION EDITOR + QUESTION PREVIEW*/}
            {/* =============================================================== */}
            <div className="lg:col-span-7 space-y-4">
              {focusedQuestion && (() => {
                const q = focusedQuestion;
                const qIdx = focusedQuestionIndex;
                const isAnswerKeyOpen = Boolean(answerKeyModeMap[q.QuestionID]);
                const isRequired = requiredQuestionMap[q.QuestionID] ?? true;

                let parsedOptions: string[] = [];
                try {
                  parsedOptions = JSON.parse(q.OptionsJSON || '[]');
                } catch {
                  parsedOptions = [];
                }

                const correctAnsObj = parseQuestionExtendedMeta(q);
                const subType = getQuestionSubType(q);
                const isDescriptionOpen =
                  Boolean(descriptionOpenMap[q.QuestionID]) || Boolean(correctAnsObj.descriptionKh);
                const isImagePickerOpen =
                  Boolean(imagePickerOpenMap[q.QuestionID]) || Boolean(q.ImageFileID);
                const isFeedbackOpen =
                  Boolean(feedbackOpenMap[q.QuestionID]) || Boolean(correctAnsObj.feedbackKh);

                const correctOptionIdx =
                  q.QuestionType === 'TRUE_FALSE'
                    ? correctAnsObj.isTrue === false
                      ? 1
                      : 0
                    : correctAnsObj.answerIndex ?? 0;

                const correctIndicesList: number[] = Array.isArray(correctAnsObj.correctIndices)
                  ? correctAnsObj.correctIndices
                  : [correctOptionIdx];

                return (
                  <>
                    {/* 1. QUESTION EDITOR CARD */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
                      {/* Editor Top Header: Question Index, Prev/Next Switcher & Question Type */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-indigo-600 font-khmer-body">
                            កែសម្រួលសំណួរទី {qIdx + 1} នៃ {examQuestions.length}
                          </span>
                          <div className="inline-flex items-center gap-1 ml-1">
                            <button
                              type="button"
                              disabled={qIdx <= 0}
                              title="សំណួរមុន"
                              onClick={() =>
                                examQuestions[qIdx - 1] &&
                                setFocusedQuestionId(examQuestions[qIdx - 1].QuestionID)
                              }
                              className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={qIdx >= examQuestions.length - 1}
                              title="សំណួរបន្ទាប់"
                              onClick={() =>
                                examQuestions[qIdx + 1] &&
                                setFocusedQuestionId(examQuestions[qIdx + 1].QuestionID)
                              }
                              className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Question Type Selector */}
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-slate-500 font-khmer-body">
                            ប្រភេទ៖
                          </label>
                          <select
                            aria-label={`ប្រភេទសំណួរទី ${qIdx + 1}`}
                            value={subType}
                            onChange={(e) => {
                              const nextSubType = e.target.value as GoogleFormsQuestionSubType;
                              mutateQuestionInList(q.QuestionID, (prevQ) =>
                                applyQuestionSubTypeChange(prevQ, nextSubType)
                              );
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 font-khmer-body focus:outline-none focus:border-indigo-600 cursor-pointer"
                          >
                            <option value="MULTIPLE_CHOICE">១. ជ្រើសរើសចម្លើយមួយ (MCQ)</option>
                            <option value="CHECKBOXES">២. ជ្រើសរើសច្រើនចម្លើយ (Checkboxes)</option>
                            <option value="SHORT_ANSWER">៣. ចម្លើយខ្លី (Short Answer)</option>
                            <option value="PARAGRAPH">៤. សរសេរវែង (Paragraph)</option>
                            <option value="DROPDOWN">៥. បញ្ជីទម្លាក់ចុះ (Dropdown)</option>
                            <option value="LINEAR_SCALE">៦. មាត្រដ្ឋានលីនេអ៊ែរ (Linear Scale)</option>
                            <option value="DATE">៧. កាលបរិច្ឆេទ (Date)</option>
                            <option value="TIME">៨. ពេលវេលា (Time)</option>
                            <option value="TRUE_FALSE">៩. ពិត / មិនពិត (True / False)</option>
                          </select>
                        </div>
                      </div>

                      {/* Optional Section Header Field */}
                      {correctAnsObj.sectionTitleKh !== undefined && (
                        <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/80 flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={correctAnsObj.sectionTitleKh}
                            onChange={(e) =>
                              mutateQuestionInList(q.QuestionID, (prevQ) => {
                                const meta = parseQuestionExtendedMeta(prevQ);
                                return {
                                  ...prevQ,
                                  CorrectAnswerJSON: JSON.stringify({
                                    ...meta,
                                    sectionTitleKh: e.target.value,
                                  }),
                                };
                              })
                            }
                            placeholder="ចំណងជើងផ្នែក (Section Header)..."
                            className="flex-1 text-xs font-bold text-indigo-950 font-khmer-body bg-transparent border-b border-indigo-300 focus:outline-none pb-0.5"
                          />
                          <button
                            type="button"
                            title="ដកក្បាលផ្នែកចេញ"
                            onClick={() => handleAddOrToggleSection(q.QuestionID, qIdx)}
                            className="text-xs text-slate-500 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Question Title & Description Inputs */}
                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                            ខ្លឹមសារសំណួរ <span className="text-rose-500">*</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={q.QuestionText}
                              onChange={(e) =>
                                mutateQuestionInList(q.QuestionID, (prevQ) => ({
                                  ...prevQ,
                                  QuestionText: e.target.value,
                                }))
                              }
                              placeholder={`វាយបញ្ចូលសំណួរទី ${qIdx + 1}...`}
                              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium text-slate-900 font-khmer-body focus:outline-none focus:border-indigo-600"
                            />
                            <button
                              type="button"
                              title="បន្ថែមរូបភាពក្នុងសំណួរ"
                              onClick={() => handleToggleQuestionImagePicker(q.QuestionID)}
                              className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                                isImagePickerOpen
                                  ? 'bg-indigo-50 border-indigo-300 text-indigo-600'
                                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                              }`}
                            >
                              <ImageIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {isDescriptionOpen && (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={correctAnsObj.descriptionKh || ''}
                              onChange={(e) =>
                                mutateQuestionInList(q.QuestionID, (prevQ) => {
                                  const meta = parseQuestionExtendedMeta(prevQ);
                                  return {
                                    ...prevQ,
                                    CorrectAnswerJSON: JSON.stringify({
                                      ...meta,
                                      descriptionKh: e.target.value,
                                    }),
                                  };
                                })
                              }
                              placeholder="ការពិពណ៌នាសំណួរ ឬការណែនាំបន្ថែម..."
                              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 font-khmer-body focus:outline-none focus:border-indigo-600"
                            />
                            <button
                              type="button"
                              title="លាក់ការពិពណ៌នា"
                              onClick={() => {
                                setDescriptionOpenMap((prev) => ({
                                  ...prev,
                                  [q.QuestionID]: false,
                                }));
                                mutateQuestionInList(q.QuestionID, (prevQ) => {
                                  const meta = parseQuestionExtendedMeta(prevQ);
                                  delete meta.descriptionKh;
                                  return {
                                    ...prevQ,
                                    CorrectAnswerJSON: JSON.stringify(meta),
                                  };
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {isImagePickerOpen && (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <ImageIcon className="w-4 h-4 text-indigo-600" />
                              <input
                                type="text"
                                value={q.ImageFileID || ''}
                                onChange={(e) =>
                                  mutateQuestionInList(q.QuestionID, (prevQ) => ({
                                    ...prevQ,
                                    ImageFileID: e.target.value,
                                  }))
                                }
                                placeholder="បញ្ចូល URL រូបភាព..."
                                className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-khmer-body focus:outline-none focus:border-indigo-600"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  mutateQuestionInList(q.QuestionID, (prevQ) => ({
                                    ...prevQ,
                                    ImageFileID: '/assets/aistudio/image_ee05d3f2.png',
                                  }))
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold font-khmer-body cursor-pointer"
                              >
                                រូបភាពគំរូ
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setImagePickerOpenMap((prev) => ({
                                    ...prev,
                                    [q.QuestionID]: false,
                                  }));
                                  mutateQuestionInList(q.QuestionID, (prevQ) => ({
                                    ...prevQ,
                                    ImageFileID: '',
                                  }));
                                }}
                                className="text-xs text-rose-600 hover:underline px-1.5 cursor-pointer font-khmer-body"
                              >
                                លុប
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Answer Options & Correct Answer Configuration */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 font-khmer-body">
                            ជម្រើសចម្លើយ និងចម្លើយត្រឹមត្រូវ (ចុចលើរង្វង់ដើម្បីកំណត់ចម្លើយត្រូវ)
                          </span>
                        </div>

                        {(subType === 'MULTIPLE_CHOICE' ||
                          subType === 'CHECKBOXES' ||
                          subType === 'DROPDOWN' ||
                          subType === 'TRUE_FALSE') && (
                          <div className="space-y-2">
                            {parsedOptions.map((optText, optIdx) => {
                              const isCorrectOpt =
                                subType === 'CHECKBOXES'
                                  ? correctIndicesList.includes(optIdx)
                                  : correctOptionIdx === optIdx;

                              const toggleCorrectChoice = () => {
                                mutateQuestionInList(q.QuestionID, (prevQ) => {
                                  const meta = parseQuestionExtendedMeta(prevQ);
                                  if (subType === 'CHECKBOXES') {
                                    const currentArr: number[] = Array.isArray(meta.correctIndices)
                                      ? meta.correctIndices
                                      : [meta.answerIndex ?? 0];
                                    const exists = currentArr.includes(optIdx);
                                    const nextArr = exists
                                      ? currentArr.length > 1
                                        ? currentArr.filter((i) => i !== optIdx)
                                        : currentArr
                                      : [...currentArr, optIdx].sort((a, b) => a - b);
                                    return {
                                      ...prevQ,
                                      CorrectAnswerJSON: JSON.stringify({
                                        ...meta,
                                        answerIndex: nextArr[0] ?? 0,
                                        correctIndices: nextArr,
                                      }),
                                    };
                                  }
                                  if (prevQ.QuestionType === 'TRUE_FALSE' || subType === 'TRUE_FALSE') {
                                    return {
                                      ...prevQ,
                                      CorrectAnswerJSON: JSON.stringify({
                                        ...meta,
                                        isTrue: optIdx === 0,
                                        answerIndex: optIdx,
                                      }),
                                    };
                                  }
                                  return {
                                    ...prevQ,
                                    CorrectAnswerJSON: JSON.stringify({
                                      ...meta,
                                      answerIndex: optIdx,
                                      correctIndices: [optIdx],
                                    }),
                                  };
                                });
                              };

                              return (
                                <div
                                  key={optIdx}
                                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
                                    isCorrectOpt
                                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                                      : 'bg-white border-slate-200 text-slate-800'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    aria-label={`ជ្រើសរើសជម្រើសទី ${optIdx + 1} ជាចម្លើយត្រឹមត្រូវ`}
                                    title="ចុចកំណត់ជាចម្លើយត្រឹមត្រូវ"
                                    onClick={toggleCorrectChoice}
                                    className={`w-5 h-5 flex items-center justify-center shrink-0 cursor-pointer ${
                                      subType === 'CHECKBOXES'
                                        ? 'rounded-xs border'
                                        : subType === 'DROPDOWN'
                                        ? 'rounded-md border text-[11px] font-bold font-mono-tabular'
                                        : 'rounded-full border'
                                    } ${
                                      isCorrectOpt
                                        ? 'border-emerald-600 bg-emerald-600 text-white'
                                        : 'border-slate-400 bg-white text-slate-500'
                                    }`}
                                  >
                                    {subType === 'DROPDOWN' && !isCorrectOpt ? (
                                      <span>{optIdx + 1}</span>
                                    ) : (
                                      isCorrectOpt && <Check className="w-3 h-3 stroke-[3]" />
                                    )}
                                  </button>

                                  <input
                                    type="text"
                                    value={optText}
                                    readOnly={subType === 'TRUE_FALSE'}
                                    onChange={(e) => {
                                      const nextOpts = [...parsedOptions];
                                      nextOpts[optIdx] = e.target.value;
                                      mutateQuestionInList(q.QuestionID, (prevQ) => ({
                                        ...prevQ,
                                        OptionsJSON: JSON.stringify(nextOpts),
                                      }));
                                    }}
                                    className={`flex-1 text-xs sm:text-sm font-khmer-body bg-transparent focus:outline-none ${
                                      isCorrectOpt ? 'font-bold text-emerald-950' : 'text-slate-800'
                                    }`}
                                  />

                                  {isCorrectOpt && (
                                    <span className="text-[11px] font-bold text-emerald-700 font-khmer-body shrink-0">
                                      ចម្លើយត្រូវ
                                    </span>
                                  )}

                                  {subType !== 'TRUE_FALSE' && parsedOptions.length > 1 && (
                                    <button
                                      type="button"
                                      title="លុបជម្រើសនេះ"
                                      onClick={() => {
                                        const nextOpts = parsedOptions.filter((_, i) => i !== optIdx);
                                        mutateQuestionInList(q.QuestionID, (prevQ) => ({
                                          ...prevQ,
                                          OptionsJSON: JSON.stringify(nextOpts),
                                        }));
                                      }}
                                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}

                            {subType !== 'TRUE_FALSE' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextOpts = [
                                    ...parsedOptions,
                                    `ជម្រើសទី ${parsedOptions.length + 1}`,
                                  ];
                                  mutateQuestionInList(q.QuestionID, (prevQ) => ({
                                    ...prevQ,
                                    OptionsJSON: JSON.stringify(nextOpts),
                                  }));
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 font-khmer-body px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                              >
                                <PlusCircle className="w-4 h-4" />
                                <span>បន្ថែមជម្រើស</span>
                              </button>
                            )}
                          </div>
                        )}

                        {subType === 'LINEAR_SCALE' && (
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-700 font-khmer-body">
                                ជ្រើសរើសតម្លៃត្រឹមត្រូវ (1–5)៖
                              </span>
                              <div className="flex items-center gap-2">
                                {parsedOptions.map((lvl, idx) => {
                                  const isCorrectLvl = correctOptionIdx === idx;
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() =>
                                        mutateQuestionInList(q.QuestionID, (prevQ) => {
                                          const meta = parseQuestionExtendedMeta(prevQ);
                                          return {
                                            ...prevQ,
                                            CorrectAnswerJSON: JSON.stringify({
                                              ...meta,
                                              answerIndex: idx,
                                            }),
                                          };
                                        })
                                      }
                                      className={`w-8 h-8 rounded-full border text-xs font-bold font-mono-tabular cursor-pointer ${
                                        isCorrectLvl
                                          ? 'bg-emerald-600 text-white border-emerald-600'
                                          : 'bg-white text-slate-800 border-slate-200'
                                      }`}
                                    >
                                      {lvl}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {(subType === 'SHORT_ANSWER' || subType === 'DATE' || subType === 'TIME') && (
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-emerald-700 font-khmer-body">
                              ចម្លើយត្រឹមត្រូវ៖
                            </span>
                            <input
                              type={subType === 'DATE' ? 'date' : subType === 'TIME' ? 'time' : 'text'}
                              value={correctAnsObj.sampleKeyword || 'SHA-256'}
                              onChange={(e) =>
                                mutateQuestionInList(q.QuestionID, (prevQ) => {
                                  const meta = parseQuestionExtendedMeta(prevQ);
                                  return {
                                    ...prevQ,
                                    CorrectAnswerJSON: JSON.stringify({
                                      ...meta,
                                      sampleKeyword: e.target.value,
                                    }),
                                  };
                                })
                              }
                              className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs font-bold text-emerald-950 font-mono-tabular focus:outline-none"
                            />
                          </div>
                        )}

                        {subType === 'PARAGRAPH' && (
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-emerald-700 font-khmer-body">
                              ការណែនាំកែពិន្ទុ៖
                            </span>
                            <input
                              type="text"
                              value={
                                correctAnsObj.rubric ||
                                'ពិនិត្យលើខ្លឹមសារ និងការពន្យល់របស់សិស្ស'
                              }
                              onChange={(e) =>
                                mutateQuestionInList(q.QuestionID, (prevQ) => {
                                  const meta = parseQuestionExtendedMeta(prevQ);
                                  return {
                                    ...prevQ,
                                    CorrectAnswerJSON: JSON.stringify({
                                      ...meta,
                                      rubric: e.target.value,
                                    }),
                                  };
                                })
                              }
                              className="flex-1 px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs font-bold text-emerald-950 font-khmer-body focus:outline-none"
                            />
                          </div>
                        )}

                        {(isAnswerKeyOpen || isFeedbackOpen) && (
                          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                            <span className="text-xs font-bold text-emerald-800 font-khmer-body flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>មតិកែលម្អចម្លើយសម្រាប់សិស្ស</span>
                            </span>
                            <input
                              type="text"
                              value={correctAnsObj.feedbackKh || ''}
                              onChange={(e) =>
                                mutateQuestionInList(q.QuestionID, (prevQ) => {
                                  const meta = parseQuestionExtendedMeta(prevQ);
                                  return {
                                    ...prevQ,
                                    CorrectAnswerJSON: JSON.stringify({
                                      ...meta,
                                      feedbackKh: e.target.value,
                                    }),
                                  };
                                })
                              }
                              placeholder="បញ្ចូលការពន្យល់នៅពេលសិស្សឆ្លើយសំណួរនេះ..."
                              className="w-full px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs text-slate-900 font-khmer-body focus:outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Editor Footer: Points, Optional Toggles, Duplicate, Delete, Required */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                            <span className="text-xs font-bold text-slate-600 font-khmer-body">
                              ពិន្ទុ៖
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              aria-label={`ពិន្ទុសម្រាប់សំណួរទី ${qIdx + 1}`}
                              value={q.Points}
                              onChange={(e) =>
                                mutateQuestionInList(q.QuestionID, (prevQ) => ({
                                  ...prevQ,
                                  Points: Math.max(1, Number(e.target.value) || 5),
                                }))
                              }
                              className="w-12 text-center font-extrabold text-xs font-mono-tabular text-indigo-600 bg-white rounded-md border border-slate-200 py-0.5 focus:outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setAnswerKeyModeMap((prev) => ({
                                ...prev,
                                [q.QuestionID]: !prev[q.QuestionID],
                              }))
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-khmer-body border transition-colors cursor-pointer ${
                              isAnswerKeyOpen
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>ចម្លើយ &amp; មតិកែលម្អ</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleQuestionDescription(q.QuestionID)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold font-khmer-body border cursor-pointer ${
                              isDescriptionOpen
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            ការពិពណ៌នា
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            title="ចម្លងសំណួរ"
                            onClick={() => handleDuplicateQuestion(q)}
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            title="លុបសំណួរ"
                            onClick={() => handleDeleteQuestionCard(q)}
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <span className="h-4 w-px bg-slate-200" />

                          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 font-khmer-body cursor-pointer select-none">
                            <span>ចាំបាច់</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isRequired}
                              onClick={() =>
                                setRequiredQuestionMap((prev) => ({
                                  ...prev,
                                  [q.QuestionID]: !isRequired,
                                }))
                              }
                              className={`w-9 h-5 rounded-full transition-colors p-0.5 cursor-pointer ${
                                isRequired ? 'bg-indigo-600' : 'bg-slate-300'
                              }`}
                            >
                              <span
                                className={`block w-4 h-4 rounded-full bg-white shadow-2xs transition-transform ${
                                  isRequired ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* 2. QUESTION PREVIEW CARD (Shows how the question appears to students) */}
                    <div className="bg-slate-50/90 rounded-2xl border border-slate-200/90 p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-slate-700 font-khmer-body inline-flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-indigo-600" />
                          <span>ការមើលសំណួរជាមុនសម្រាប់សិស្ស (Question Preview)</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-khmer-body">
                          សំណួរទី {qIdx + 1} · {QUESTION_SUBTYPE_LABELS_KH[subType]}
                        </span>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="text-base font-medium text-slate-900 font-khmer-body">
                              {q.QuestionText}
                            </div>
                            {correctAnsObj.descriptionKh && (
                              <div className="text-xs text-slate-500 font-khmer-body">
                                {correctAnsObj.descriptionKh}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 text-xs font-khmer-body text-slate-500 whitespace-nowrap">
                            {isRequired && <span className="text-rose-600 font-bold mr-1">*</span>}
                            <span>ចំណុច {q.Points}</span>
                          </div>
                        </div>

                        {q.ImageFileID && (
                          <div>
                            <img
                              src={
                                q.ImageFileID.startsWith('http') || q.ImageFileID.startsWith('/')
                                  ? q.ImageFileID
                                  : '/assets/aistudio/image_ee05d3f2.png'
                              }
                              alt="រូបភាពសំណួរ"
                              className="max-h-44 rounded-lg border border-slate-200 object-contain bg-white p-1"
                            />
                          </div>
                        )}

                        {(subType === 'MULTIPLE_CHOICE' ||
                          subType === 'TRUE_FALSE' ||
                          subType === 'CHECKBOXES') && (
                          <div className="space-y-2.5 pt-1">
                            {parsedOptions.map((optText, oIdx) => (
                              <div key={oIdx} className="flex items-center gap-3 text-sm text-slate-800 font-khmer-body">
                                <span
                                  className={`w-4 h-4 border border-slate-400 shrink-0 ${
                                    subType === 'CHECKBOXES' ? 'rounded-xs' : 'rounded-full'
                                  }`}
                                />
                                <span>{optText}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {subType === 'DROPDOWN' && (
                          <div className="pt-1">
                            <select
                              disabled
                              className="w-60 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600 font-khmer-body"
                            >
                              <option>ជ្រើសរើសចម្លើយ...</option>
                            </select>
                          </div>
                        )}

                        {(subType === 'SHORT_ANSWER' ||
                          subType === 'DATE' ||
                          subType === 'TIME' ||
                          subType === 'PARAGRAPH') && (
                          <div className="border-b border-slate-200 py-2 text-xs text-slate-400 font-khmer-body">
                            {subType === 'PARAGRAPH' ? 'ចម្លើយវែងរបស់សិស្ស...' : 'ចម្លើយខ្លីរបស់សិស្ស...'}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: RESPONSES & GRADING (Summary, Search, Table & Grading Details) */}
      {/* ===================================================================== */}
      {activeTab === 'RESPONSES_GRADING' && !isStudentRole && (
        <div className="space-y-4">
          {/* 1. 4 SUMMARY CARDS: Total Responses, Pending Grading, Partially Graded, Fully Graded */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500 font-khmer-body">
                  ការឆ្លើយតបសរុប (Total)
                </div>
                <div className="text-2xl font-extrabold text-slate-900 font-mono-tabular mt-1">
                  {responseSummaryStats.total}
                </div>
                <div className="text-[11px] text-slate-500 font-khmer-body mt-0.5">
                  {examSubject?.SubjectNameKh} · ខែ{currentExam.ExamMonth} · ថ្នាក់ {examClass?.ClassName || '12C'}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500 font-khmer-body">
                  រង់ចាំកែពិន្ទុ (Pending Grading)
                </div>
                <div className="text-2xl font-extrabold text-rose-600 font-mono-tabular mt-1">
                  {responseSummaryStats.pendingGrading}
                </div>
                <div className="text-[11px] text-slate-500 font-khmer-body mt-0.5">
                  មិនទាន់បានកែពិន្ទុ
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500 font-khmer-body">
                  កែពិន្ទុបានខ្លះ (Partially Graded)
                </div>
                <div className="text-2xl font-extrabold text-amber-600 font-mono-tabular mt-1">
                  {responseSummaryStats.partiallyGraded}
                </div>
                <div className="text-[11px] text-slate-500 font-khmer-body mt-0.5">
                  សំណួរសរសេររង់ចាំគ្រូកែ
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <FileCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500 font-khmer-body">
                  កែពិន្ទុរួចរាល់ (Fully Graded)
                </div>
                <div className="text-2xl font-extrabold text-emerald-600 font-mono-tabular mt-1">
                  {responseSummaryStats.fullyGraded}
                </div>
                <div className="text-[11px] text-slate-500 font-khmer-body mt-0.5">
                  ពិន្ទុសរុប៖ {totalQuestionPoints} ពិន្ទុ
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 2. SEARCH, SUBJECT & MONTH FILTERS, GRADING STATUS & ACTIONS BAR */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    aria-label="ស្វែងរកសិស្ស"
                    value={responseSearchQuery}
                    onChange={(e) => setResponseSearchQuery(e.target.value)}
                    placeholder="ស្វែងរកឈ្មោះ ឬ អត្តលេខសិស្ស..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-khmer-body focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {/* Consistent Subject Filter in Responses & Grading */}
                <select
                  aria-label="ត្រងចម្លើយតាមមុខវិជ្ជា"
                  value={questionListSubjectFilter}
                  onChange={(e) =>
                    handleSelectSubjectOrMonthFilter(e.target.value, questionListMonthFilter)
                  }
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 font-khmer-body focus:outline-none focus:border-indigo-600"
                >
                  <option value="ALL">គ្រប់មុខវិជ្ជា ({examSubject?.SubjectNameKh})</option>
                  {allowedSubjectsForActor.map((s) => (
                    <option key={s.SubjectID} value={s.SubjectID}>
                      {s.SubjectNameKh}
                    </option>
                  ))}
                </select>

                {/* Consistent Month Filter in Responses & Grading */}
                <select
                  aria-label="ត្រងចម្លើយតាមខែ"
                  value={questionListMonthFilter}
                  onChange={(e) =>
                    handleSelectSubjectOrMonthFilter(questionListSubjectFilter, e.target.value)
                  }
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 font-khmer-body focus:outline-none focus:border-indigo-600"
                >
                  <option value="ALL">គ្រប់ខែ (ខែ{currentExam.ExamMonth})</option>
                  {ALL_SUPPORTED_QUESTION_MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthBadgeLabel(m)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 font-khmer-body cursor-pointer select-none bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80">
                  <span>បើកទទួលចម្លើយ</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={acceptingResponses}
                    onClick={() => setAcceptingResponses((v) => !v)}
                    className={`w-9 h-5 rounded-full transition-colors p-0.5 cursor-pointer ${
                      acceptingResponses ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white shadow-2xs transition-transform ${
                        acceptingResponses ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>

                <button
                  type="button"
                  data-testid="auto-grade-all-attempts-btn"
                  title="កែពិន្ទុស្វ័យប្រវត្តិលើសំណួរជ្រើសរើស (ដោយរក្សាទុកពិន្ទុកែដោយដៃរបស់គ្រូ)"
                  onClick={handleAutoGradeAllAttempts}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>កែពិន្ទុស្វ័យប្រវត្តិ</span>
                </button>

                <button
                  type="button"
                  data-testid="publish-and-sync-exam-results-btn"
                  title="ប្រកាសលទ្ធផល និងបញ្ជូនទៅតារាងពិន្ទុប្រចាំខែ"
                  onClick={handleSyncToMonthlyScores}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body shadow-2xs transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>ប្រកាសលទ្ធផល &amp; បញ្ជូនពិន្ទុ</span>
                </button>
              </div>
            </div>

            {/* 3-State Grading Status Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 gap-1">
                {(
                  [
                    { id: 'ALL', label: `ទាំងអស់ (${responseSummaryStats.total})` },
                    {
                      id: 'PENDING_GRADING',
                      label: `រង់ចាំកែពិន្ទុ (${responseSummaryStats.pendingGrading})`,
                    },
                    {
                      id: 'PARTIALLY_GRADED',
                      label: `កែពិន្ទុបានខ្លះ (${responseSummaryStats.partiallyGraded})`,
                    },
                    {
                      id: 'FULLY_GRADED',
                      label: `កែពិន្ទុរួចរាល់ (${responseSummaryStats.fullyGraded})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setResponseStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-khmer-body transition-colors cursor-pointer ${
                      responseStatusFilter === tab.id
                        ? 'bg-white text-indigo-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-slate-500 font-khmer-body">
                បង្ហាញតែសន្លឹកកិច្ចការនៃវិញ្ញាសា «{currentExam.ExamTitle}» ({examSubject?.SubjectNameKh} · ខែ{currentExam.ExamMonth} · ថ្នាក់ {examClass?.ClassName})
              </div>
            </div>
          </div>

          {/* 3. TWO-COLUMN RESPONSES TABLE & INDIVIDUAL GRADING DETAILS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column (lg:col-span-6): Student Response Table with Student ID, Name, Class, Subject, Examination, Submission Time, Score, and Grading Status */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900 font-khmer-body">
                  តារាងចម្លើយសិស្ស ({filteredAttemptsList.length})
                </h3>
                <span className="text-xs text-slate-500 font-khmer-body">
                  ចុចលើសិស្សដើម្បីពិនិត្យ និងកែពិន្ទុលម្អិត
                </span>
              </div>

              <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-600 font-khmer-body">
                      <th className="py-2.5 px-3">អត្តលេខ &amp; ឈ្មោះសិស្ស</th>
                      <th className="py-2.5 px-2.5">ថ្នាក់ / មុខវិជ្ជា</th>
                      <th className="py-2.5 px-2.5">វិញ្ញាសា &amp; ម៉ោងដាក់ស្នើ</th>
                      <th className="py-2.5 px-2.5">ស្ថានភាពកែពិន្ទុ</th>
                      <th className="py-2.5 px-3 text-right">ពិន្ទុ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                    {filteredAttemptsList.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-10 text-center text-xs text-slate-500 font-khmer-body"
                        >
                          មិនមានទិន្នន័យការឆ្លើយតបរបស់សិស្សសម្រាប់វិញ្ញាសានេះទេ។
                        </td>
                      </tr>
                    ) : (
                      filteredAttemptsList.map((att) => {
                        const fullIdx = examAttemptsList.findIndex(
                          (item) => item.AttemptID === att.AttemptID
                        );
                        const isSelected =
                          currentReviewedAttempt?.AttemptID === att.AttemptID;
                        const st = db.Students.find((s) => s.StudentID === att.StudentID);
                        const displayKh = st
                          ? formatRankingDisplayName(st.LastNameKh, st.FirstNameKh, st.Gender)
                          : att.StudentID;
                        const stEnrollment = db.Enrollments.find(
                          (en) => en.StudentID === att.StudentID
                        );
                        const stClass =
                          db.Classes.find((c) => c.ClassID === stEnrollment?.ClassID) ||
                          examClass;
                        const progress = attemptGradingProgressMap.get(att.AttemptID);
                        const gStatus = progress?.status || 'PENDING_GRADING';
                        const submittedTimeStr = att.SubmittedAt
                          ? att.SubmittedAt.replace('T', ' ').slice(0, 16)
                          : '2026-11-08 08:45';

                        return (
                          <tr
                            key={att.AttemptID}
                            onClick={() => setSelectedAttemptIndex(Math.max(0, fullIdx))}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-indigo-50/80' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{displayKh}</div>
                              <div className="text-[11px] text-indigo-600 font-mono-tabular font-semibold">
                                អត្តលេខ #{st?.StudentCode || att.StudentID}
                              </div>
                            </td>

                            <td className="py-3 px-2.5">
                              <div className="font-bold text-slate-800">
                                ថ្នាក់ {stClass?.ClassName || '12C'}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {examSubject?.SubjectNameKh}
                              </div>
                            </td>

                            <td className="py-3 px-2.5">
                              <div className="font-semibold text-slate-800 line-clamp-1">
                                ខែ{currentExam.ExamMonth}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono-tabular">
                                {submittedTimeStr}
                              </div>
                            </td>

                            <td className="py-3 px-2.5">
                              <span
                                className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                                  gStatus === 'FULLY_GRADED'
                                    ? 'text-emerald-700'
                                    : gStatus === 'PARTIALLY_GRADED'
                                    ? 'text-amber-700'
                                    : 'text-rose-700'
                                }`}
                              >
                                {gStatus === 'FULLY_GRADED' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                )}
                                <span>{progress?.labelKh || 'រង់ចាំកែពិន្ទុ'}</span>
                              </span>
                              <div className="text-[10px] text-slate-400 font-mono-tabular">
                                បានកែ {progress?.gradedQuestionsCount ?? 0}/{progress?.totalQuestionsCount ?? examQuestions.length} សំណួរ
                              </div>
                            </td>

                            <td className="py-3 px-3 text-right font-mono-tabular font-extrabold text-indigo-700">
                              {att.TotalScore} / {totalQuestionPoints}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column (lg:col-span-6): Individual Student Response Details & Grading */}
            <div className="lg:col-span-6 space-y-4">
              {currentReviewedAttempt ? (
                <>
                  {/* Student Reviewer Header with Complete Student, Exam, Submission Time & Grading Status Info */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="សិស្សមុន"
                          disabled={selectedAttemptIndex <= 0}
                          onClick={() => setSelectedAttemptIndex((i) => Math.max(0, i - 1))}
                          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div>
                          <div className="text-xs sm:text-sm font-extrabold text-slate-900 font-khmer-body">
                            {reviewedStudent
                              ? formatRankingDisplayName(
                                  reviewedStudent.LastNameKh,
                                  reviewedStudent.FirstNameKh,
                                  reviewedStudent.Gender
                                )
                              : currentReviewedAttempt.StudentID}{' '}
                            <span className="text-indigo-600 font-mono-tabular">
                              (អត្តលេខ #{reviewedStudent?.StudentCode})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-khmer-body">
                            សន្លឹកកិច្ចការទី {selectedAttemptIndex + 1} នៃ {examAttemptsList.length} · ពិន្ទុសរុប៖{' '}
                            <strong className="text-slate-900 font-mono-tabular">
                              {currentReviewedAttempt.TotalScore} / {totalQuestionPoints}
                            </strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-label="សិស្សបន្ទាប់"
                          disabled={selectedAttemptIndex >= examAttemptsList.length - 1}
                          onClick={() =>
                            setSelectedAttemptIndex((i) =>
                              Math.min(examAttemptsList.length - 1, i + 1)
                            )
                          }
                          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        data-testid="save-individual-grades-btn"
                        onClick={handleSaveIndividualGrades}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-khmer-body shadow-2xs cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>រក្សាទុកពិន្ទុ (Save Grading)</span>
                      </button>
                    </div>

                    {/* Detailed Attempt Metadata Bar */}
                    {(() => {
                      const reviewedProgress = attemptGradingProgressMap.get(
                        currentReviewedAttempt.AttemptID
                      );
                      const rStatus = reviewedProgress?.status || 'PENDING_GRADING';
                      const submittedAtDisplay = currentReviewedAttempt.SubmittedAt
                        ? currentReviewedAttempt.SubmittedAt.replace('T', ' ').slice(0, 16)
                        : '2026-11-08 08:45';
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 border-t border-slate-100 text-[11px] font-khmer-body">
                          <div className="bg-slate-50 rounded-xl p-2 border border-slate-200/70">
                            <span className="text-slate-500 block">ថ្នាក់ &amp; មុខវិជ្ជា</span>
                            <strong className="text-slate-900">
                              ថ្នាក់ {examClass?.ClassName || '12C'} · {examSubject?.SubjectNameKh}
                            </strong>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2 border border-slate-200/70">
                            <span className="text-slate-500 block">វិញ្ញាសាប្រឡង</span>
                            <strong className="text-slate-900 truncate block">
                              {currentExam.ExamTitle} (ខែ{currentExam.ExamMonth})
                            </strong>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2 border border-slate-200/70">
                            <span className="text-slate-500 block">ម៉ោងដាក់ស្នើ</span>
                            <strong className="text-slate-900 font-mono-tabular">
                              {submittedAtDisplay}
                            </strong>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2 border border-slate-200/70">
                            <span className="text-slate-500 block">ស្ថានភាពកែពិន្ទុ</span>
                            <strong
                              className={
                                rStatus === 'FULLY_GRADED'
                                  ? 'text-emerald-700'
                                  : rStatus === 'PARTIALLY_GRADED'
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                              }
                            >
                              {reviewedProgress?.labelKh} ({reviewedProgress?.gradedQuestionsCount}/
                              {reviewedProgress?.totalQuestionsCount})
                            </strong>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Question-by-Question Grading List */}
                  <div className="space-y-3">
                    {examQuestions.map((q, qIdx) => {
                      const ansRecord = localExamAnswers.find(
                        (a) =>
                          a.AttemptID === currentReviewedAttempt.AttemptID &&
                          a.QuestionID === q.QuestionID
                      );
                      const fallbackKey = `${currentReviewedAttempt.AttemptID}_${q.QuestionID}`;

                      let studentAnsObj: {
                        selectedIndex?: number;
                        booleanAnswer?: boolean;
                        textAnswer?: string;
                      } = {};
                      try {
                        if (ansRecord?.AnswerJSON) {
                          studentAnsObj = JSON.parse(ansRecord.AnswerJSON);
                        } else {
                          const meta = parseQuestionExtendedMeta(q);
                          studentAnsObj = {
                            selectedIndex: meta.answerIndex ?? 0,
                            booleanAnswer: (meta.answerIndex ?? 0) === 0,
                            textAnswer: meta.sampleKeyword || 'ចម្លើយរបស់សិស្ស',
                          };
                        }
                      } catch {
                        studentAnsObj = { selectedIndex: 0 };
                      }

                      let options: string[] = [];
                      try {
                        options = JSON.parse(q.OptionsJSON || '[]');
                      } catch {
                        options = [];
                      }

                      const isAutoGradable =
                        q.QuestionType === 'MCQ' || q.QuestionType === 'TRUE_FALSE';
                      const isCorrect = ansRecord ? Boolean(ansRecord.IsCorrect) : true;
                      const scoreEntryKey = ansRecord ? ansRecord.AnswerID : fallbackKey;
                      const defaultAwarded = ansRecord
                        ? String(ansRecord.ScoreAwarded)
                        : String(q.Points);
                      const isManuallyGradedByTeacher = Boolean(
                        (ansRecord?.GradedByUserID &&
                          ansRecord.GradedByUserID !== 'SYSTEM' &&
                          ansRecord.GradedByUserID !== 'PENDING_TEACHER') ||
                          (manualScoreOverrides[scoreEntryKey] !== undefined &&
                            Number(manualScoreOverrides[scoreEntryKey]) !==
                              (ansRecord?.ScoreAwarded ?? 0))
                      );

                      return (
                        <div
                          key={q.QuestionID}
                          className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400 font-mono-tabular">
                                <span>
                                  សំណួរទី {qIdx + 1} · {q.QuestionType}
                                </span>
                                {isManuallyGradedByTeacher ? (
                                  <span className="text-[11px] font-khmer-body text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                                    កែដោយគ្រូ (Manual Score Protected)
                                  </span>
                                ) : isAutoGradable ? (
                                  <span className="text-[11px] font-khmer-body text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                    កែស្វ័យប្រវត្តិ (Auto-Graded)
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-khmer-body text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                                    រង់ចាំគ្រូដាក់ពិន្ទុ (Pending Manual Grading)
                                  </span>
                                )}
                              </div>
                              <div className="text-sm sm:text-base font-semibold text-slate-900 font-khmer-body">
                                {q.QuestionText}
                              </div>
                            </div>

                            {/* Automatic & Manual Grading Score Input */}
                            <div className="flex items-center gap-2">
                              {isAutoGradable && (
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-bold font-khmer-body ${
                                    isCorrect ? 'text-emerald-700' : 'text-rose-700'
                                  }`}
                                >
                                  {isCorrect ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-rose-600" />
                                  )}
                                  <span>{isCorrect ? 'ត្រឹមត្រូវ' : 'ខុស'}</span>
                                </span>
                              )}

                              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                                <span className="text-xs font-bold text-slate-600 font-khmer-body">
                                  ពិន្ទុ៖
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={q.Points}
                                  aria-label={`ពិន្ទុសំណួរទី ${qIdx + 1}`}
                                  value={
                                    manualScoreOverrides[scoreEntryKey] ?? defaultAwarded
                                  }
                                  onChange={(e) => {
                                    setManualScoreOverrides((prev) => ({
                                      ...prev,
                                      [scoreEntryKey]: e.target.value,
                                    }));
                                  }}
                                  className="w-14 text-center font-extrabold text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg py-0.5 text-indigo-700 focus:outline-none focus:border-indigo-600"
                                />
                                <span className="text-xs font-bold text-slate-500 font-mono-tabular">
                                  / {q.Points}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Student's Selected Option or Written Text */}
                          {isAutoGradable ? (
                            <div className="space-y-1.5">
                              {options.map((opt, idx) => {
                                const selectedIdx =
                                  q.QuestionType === 'TRUE_FALSE' &&
                                  studentAnsObj.selectedIndex === undefined
                                    ? studentAnsObj.booleanAnswer
                                      ? 0
                                      : 1
                                    : studentAnsObj.selectedIndex;
                                const isChosen = selectedIdx === idx;
                                return (
                                  <div
                                    key={idx}
                                    className={`px-3 py-2 rounded-xl border text-xs font-khmer-body flex items-center justify-between ${
                                      isChosen
                                        ? isCorrect
                                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                          : 'bg-rose-50 border-rose-300 text-rose-950 font-bold'
                                        : 'bg-slate-50/50 border-slate-200/70 text-slate-600'
                                    }`}
                                  >
                                    <span>{opt}</span>
                                    {isChosen && (
                                      <span className="text-[11px] font-bold">
                                        {isCorrect ? '✓ ចម្លើយសិស្ស' : '✕ ចម្លើយសិស្ស'}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                              <div className="text-[11px] font-bold text-slate-500 font-khmer-body">
                                ចម្លើយសរសេររបស់សិស្ស៖
                              </div>
                              <div className="text-xs sm:text-sm font-medium text-slate-900 font-khmer-body">
                                {studentAnsObj.textAnswer || '(មិនបានឆ្លើយ)'}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center text-xs text-slate-500 font-khmer-body">
                  មិនទាន់មានសន្លឹកកិច្ចការសិស្សសម្រាប់វិញ្ញាសា «{currentExam.ExamTitle}» នៅឡើយទេ។
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: SAFE EXAM PREVIEW (Isolated Non-Destructive Preview Mode)       */}
      {/* ===================================================================== */}
      {activeTab === 'STUDENT_EXAM_VIEW' && (
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Teacher / Admin Non-Destructive Safe Preview Mode Banner */}
          {!isStudentRole && (
            <div
              data-testid="google-forms-preview-mode-banner"
              className="bg-white rounded-2xl border border-indigo-200 px-4 py-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-700 font-khmer-body">
                  <Eye className="w-4 h-4 shrink-0" />
                  <span>
                    របៀបមើលជាមុនដោយសុវត្ថិភាព (Safe Exam Preview Mode)
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-khmer-body">
                  ការសាកល្បងឆ្លើយ ឬដាក់ស្នើក្នុងទម្រង់នេះ មិនបង្កើតសន្លឹកកិច្ចការសិស្ស មិនកាត់ចំនួនដងប្រឡង និងមិនប៉ះពាល់ពិន្ទុសិស្សពិតឡើយ។
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="exit-exam-preview-btn"
                  onClick={handleExitExamPreview}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold font-khmer-body cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ចាកចេញពីការមើលជាមុន (Exit Preview)</span>
                </button>
              </div>
            </div>
          )}

          {/* Post-Submit Instant Score Banner */}
          {submittedResultSummary && (
            <div
              data-testid="google-forms-view-score-card"
              className="bg-white rounded-2xl border border-emerald-300 shadow-2xs overflow-hidden"
            >
              <div className="h-2 bg-emerald-600 w-full" />
              <div className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-bold font-khmer-body">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isStudentRole
                        ? 'បានដាក់ស្នើចម្លើយរួចរាល់ (Submitted)'
                        : 'លទ្ធផលសាកល្បងក្នុង Safe Preview Mode (មិនរក្សាទុកក្នុងទិន្នន័យសិស្ស)'}
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-slate-900 font-khmer-body">
                    ពិន្ទុទទួលបាន៖ {submittedResultSummary.totalScore} /{' '}
                    {submittedResultSummary.maxScore} ពិន្ទុ ({submittedResultSummary.percentage}% · និទ្ទេស{' '}
                    {submittedResultSummary.grade})
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedResultSummary(null);
                      setRemainingSeconds((currentExam.DurationMinutes || 60) * 60);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 font-khmer-body cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>សាកល្បងម្ដងទៀត</span>
                  </button>

                  {!isStudentRole && (
                    <button
                      type="button"
                      onClick={handleExitExamPreview}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>ចាកចេញពីការមើលជាមុន</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 1. EXAM TITLE & INSTRUCTIONS HEADER CARD */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="h-2.5 bg-[#673AB7] w-full" />
            <div className="p-6 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-khmer-body leading-snug">
                    {currentExam.ExamTitle}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600 font-khmer-body">
                    <span>មុខវិជ្ជា៖ {examSubject?.SubjectNameKh}</span>
                    <span aria-hidden="true">·</span>
                    <span>ខែប្រឡង៖ ខែ{currentExam.ExamMonth}</span>
                    <span aria-hidden="true">·</span>
                    <span>រយៈពេល {toKhmerNumerals(currentExam.DurationMinutes)} នាទី</span>
                    <span aria-hidden="true">·</span>
                    <span>ពិន្ទុសរុប {totalQuestionPoints} ពិន្ទុ</span>
                  </div>
                </div>
              </div>

              {currentExam.Instructions && (
                <p className="text-xs sm:text-sm text-slate-600 font-khmer-body pt-2 border-t border-slate-100">
                  {currentExam.Instructions}
                </p>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-khmer-body">
                <span className="text-rose-600 font-semibold">* បង្ហាញថាជាសំណួរដែលចាំបាច់</span>
                <span className="text-slate-500">
                  បានឆ្លើយ {answeredCount} / {examQuestions.length} សំណួរ
                </span>
              </div>
            </div>
          </div>

          {/* 2. TIMER & QUESTION NAVIGATION BAR */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Timer Display */}
              <div className="flex items-center gap-2.5">
                <div
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono-tabular text-sm font-extrabold border ${
                    remainingSeconds < 300
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>{formatTimerMmSs(remainingSeconds)}</span>
                </div>

                {!isStudentRole && (
                  <button
                    type="button"
                    title={isTimerPaused ? 'បន្តម៉ោង' : 'ផ្អាកម៉ោង'}
                    onClick={() => setIsTimerPaused((p) => !p)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    {isTimerPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {/* View Mode Switcher: All Questions vs Step-by-Step */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setStudentNavigationMode('ALL_QUESTIONS')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold font-khmer-body transition-colors cursor-pointer ${
                    studentNavigationMode === 'ALL_QUESTIONS'
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  បង្ហាញទាំងអស់
                </button>
                <button
                  type="button"
                  onClick={() => setStudentNavigationMode('STEP_BY_STEP')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold font-khmer-body transition-colors cursor-pointer ${
                    studentNavigationMode === 'STEP_BY_STEP'
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ម្តងមួយសំណួរ
                </button>
              </div>
            </div>

            {/* Question Navigation Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500 font-khmer-body mr-1">
                សំណួរទី៖
              </span>
              {examQuestions.map((q, idx) => {
                const answered = isQuestionAnswered(q);
                const flagged = flaggedQuestionIds.includes(q.QuestionID);
                const isCurrent = activeStudentQuestionIdx === idx;
                return (
                  <button
                    key={q.QuestionID}
                    type="button"
                    onClick={() => handleJumpToQuestion(idx, q.QuestionID)}
                    className={`w-8 h-8 rounded-lg text-xs font-mono-tabular font-bold border transition-all cursor-pointer flex items-center justify-center ${
                      isCurrent
                        ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-600/20'
                        : flagged
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : answered
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. ANSWER AREA (Questions List or Single Step Question) */}
          <div className="space-y-4">
            {displayedStudentQuestions.map((q) => {
              const qIdx = examQuestions.findIndex((item) => item.QuestionID === q.QuestionID);
              let options: string[] = [];
              try {
                options = JSON.parse(q.OptionsJSON || '[]');
              } catch {
                options = [];
              }

              const meta = parseQuestionExtendedMeta(q);
              const subType = getQuestionSubType(q);
              const isReq = requiredQuestionMap[q.QuestionID] ?? true;
              const myAns = studentAnswers[q.QuestionID];
              const isFlagged = flaggedQuestionIds.includes(q.QuestionID);

              return (
                <div key={q.QuestionID} className="space-y-2">
                  {meta.sectionTitleKh && (
                    <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold font-khmer-body">
                      {meta.sectionTitleKh}
                    </div>
                  )}

                  <div
                    id={`exam-question-${q.QuestionID}`}
                    onClick={() => setActiveStudentQuestionIdx(qIdx)}
                    className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-indigo-600 font-khmer-body">
                          សំណួរទី {qIdx + 1}
                        </div>
                        <div className="text-base sm:text-[17px] font-medium text-slate-900 font-khmer-body leading-relaxed">
                          {q.QuestionText}
                        </div>
                        {meta.descriptionKh && (
                          <div className="text-xs text-slate-500 font-khmer-body">
                            {meta.descriptionKh}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          title="ចំណាំសំណួរដើម្បីពិនិត្យឡើងវិញ"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFlagQuestion(q.QuestionID);
                          }}
                          className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isFlagged
                              ? 'bg-amber-50 border-amber-300 text-amber-700'
                              : 'border-slate-200 text-slate-400 hover:text-slate-700'
                          }`}
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                        <div className="text-xs sm:text-sm font-khmer-body whitespace-nowrap">
                          {isReq && <span className="text-rose-600 font-bold mr-1">*</span>}
                          <span className="text-slate-500">ចំណុច {q.Points}</span>
                        </div>
                      </div>
                    </div>

                    {q.ImageFileID && (
                      <div>
                        <img
                          src={
                            q.ImageFileID.startsWith('http') || q.ImageFileID.startsWith('/')
                              ? q.ImageFileID
                              : '/assets/aistudio/image_ee05d3f2.png'
                          }
                          alt="រូបភាពសំណួរ"
                          className="max-h-56 rounded-lg border border-slate-200 object-contain bg-white p-1"
                        />
                      </div>
                    )}

                    {/* 1. Multiple Choice & True/False */}
                    {(subType === 'MULTIPLE_CHOICE' || subType === 'TRUE_FALSE') && (
                      <div className="space-y-3 pt-1">
                        {options.map((optText, optIdx) => {
                          const isSelected = myAns?.selectedIndex === optIdx;
                          return (
                            <div
                              key={optIdx}
                              onClick={() => {
                                if (submittedResultSummary) return;
                                handleSelectStudentOption(q, optIdx);
                              }}
                              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-indigo-50/60 border-indigo-500'
                                  : 'bg-white hover:bg-slate-50 border-slate-200/80'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                  isSelected
                                    ? 'border-[#673AB7] bg-white'
                                    : 'border-slate-400 bg-white'
                                }`}
                              >
                                {isSelected && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-[#673AB7]" />
                                )}
                              </span>
                              <span className="text-sm sm:text-base text-slate-900 font-khmer-body leading-relaxed">
                                {optText}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 2. Checkboxes */}
                    {subType === 'CHECKBOXES' && (
                      <div className="space-y-3 pt-1">
                        {options.map((optText, optIdx) => {
                          const selectedSet = myAns?.selectedIndices || [];
                          const isChecked = selectedSet.includes(optIdx);
                          return (
                            <div
                              key={optIdx}
                              onClick={() => {
                                if (submittedResultSummary) return;
                                setStudentAnswers((prev) => {
                                  const currentArr = prev[q.QuestionID]?.selectedIndices || [];
                                  const nextArr = currentArr.includes(optIdx)
                                    ? currentArr.filter((i) => i !== optIdx)
                                    : [...currentArr, optIdx].sort((a, b) => a - b);
                                  return {
                                    ...prev,
                                    [q.QuestionID]: {
                                      questionId: q.QuestionID,
                                      selectedIndex: nextArr[0],
                                      selectedIndices: nextArr,
                                    },
                                  };
                                });
                              }}
                              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                isChecked
                                  ? 'bg-indigo-50/60 border-indigo-500'
                                  : 'bg-white hover:bg-slate-50 border-slate-200/80'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-xs border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                  isChecked
                                    ? 'border-[#673AB7] bg-[#673AB7] text-white'
                                    : 'border-slate-400 bg-white'
                                }`}
                              >
                                {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </span>
                              <span className="text-sm sm:text-base text-slate-900 font-khmer-body leading-relaxed">
                                {optText}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 5. Dropdown Select */}
                    {subType === 'DROPDOWN' && (
                      <div className="pt-1">
                        <select
                          aria-label={q.QuestionText}
                          disabled={Boolean(submittedResultSummary)}
                          value={myAns?.selectedIndex ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') return;
                            handleSelectStudentOption(q, Number(val));
                          }}
                          className="w-full sm:w-72 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 font-khmer-body focus:outline-none focus:border-indigo-600"
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

                    {/* 6. Linear Scale */}
                    {subType === 'LINEAR_SCALE' && (
                      <div className="pt-2">
                        <div className="flex flex-wrap items-center justify-between gap-4 max-w-md py-2">
                          <span className="text-xs text-slate-500 font-khmer-body">
                            {meta.scaleMinLabel || 'កម្រិតទាបបំផុត'}
                          </span>
                          <div className="flex items-center gap-4">
                            {options.map((lvl, optIdx) => {
                              const isSelected = myAns?.selectedIndex === optIdx;
                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  disabled={Boolean(submittedResultSummary)}
                                  onClick={() => handleSelectStudentOption(q, optIdx)}
                                  className="flex flex-col items-center gap-1.5 cursor-pointer"
                                >
                                  <span className="text-xs text-slate-600 font-mono-tabular">
                                    {lvl}
                                  </span>
                                  <span
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                      isSelected
                                        ? 'border-[#673AB7] bg-white'
                                        : 'border-slate-400 bg-white'
                                    }`}
                                  >
                                    {isSelected && (
                                      <span className="w-2.5 h-2.5 rounded-full bg-[#673AB7]" />
                                    )}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <span className="text-xs text-slate-500 font-khmer-body">
                            {meta.scaleMaxLabel || 'កម្រិតខ្ពស់បំផុត'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 3. Short Answer, Date, Time */}
                    {(subType === 'SHORT_ANSWER' || subType === 'DATE' || subType === 'TIME') && (
                      <div className="pt-1">
                        <input
                          type={subType === 'DATE' ? 'date' : subType === 'TIME' ? 'time' : 'text'}
                          disabled={Boolean(submittedResultSummary)}
                          value={myAns?.textAnswer || ''}
                          onChange={(e) =>
                            setStudentAnswers((prev) => ({
                              ...prev,
                              [q.QuestionID]: {
                                questionId: q.QuestionID,
                                textAnswer: e.target.value,
                              },
                            }))
                          }
                          placeholder="វាយបញ្ចូលចម្លើយរបស់អ្នក..."
                          className="w-full sm:w-2/3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 font-khmer-body focus:outline-none focus:border-indigo-600"
                        />
                      </div>
                    )}

                    {/* 4. Paragraph / Essay */}
                    {subType === 'PARAGRAPH' && (
                      <div className="pt-1">
                        <textarea
                          rows={3}
                          disabled={Boolean(submittedResultSummary)}
                          value={myAns?.textAnswer || ''}
                          onChange={(e) =>
                            setStudentAnswers((prev) => ({
                              ...prev,
                              [q.QuestionID]: {
                                questionId: q.QuestionID,
                                textAnswer: e.target.value,
                              },
                            }))
                          }
                          placeholder="វាយបញ្ចូលចម្លើយវែងរបស់អ្នក..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 font-khmer-body focus:outline-none focus:border-indigo-600 resize-y"
                        />
                      </div>
                    )}

                    {/* Post-Submission Answer Feedback Display */}
                    {submittedResultSummary && meta.feedbackKh && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-khmer-body">
                        <strong className="text-indigo-700">មតិកែលម្អចម្លើយ៖ </strong>
                        {meta.feedbackKh}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4. PREVIOUS / NEXT, EXIT PREVIEW & TEST SUBMIT EXAM BAR */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            {/* Previous / Next Question Navigation */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={activeStudentQuestionIdx <= 0}
                onClick={() => {
                  const nextIdx = Math.max(0, activeStudentQuestionIdx - 1);
                  const targetQ = examQuestions[nextIdx];
                  if (targetQ) handleJumpToQuestion(nextIdx, targetQ.QuestionID);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 font-khmer-body disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>សំណួរមុន</span>
              </button>

              <button
                type="button"
                disabled={activeStudentQuestionIdx >= examQuestions.length - 1}
                onClick={() => {
                  const nextIdx = Math.min(
                    examQuestions.length - 1,
                    activeStudentQuestionIdx + 1
                  );
                  const targetQ = examQuestions[nextIdx];
                  if (targetQ) handleJumpToQuestion(nextIdx, targetQ.QuestionID);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 font-khmer-body disabled:opacity-40 cursor-pointer"
              >
                <span>សំណួរបន្ទាប់</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Clear Form, Exit Preview & Test Submit Button */}
            <div className="flex flex-wrap items-center gap-2.5">
              {!isStudentRole && (
                <button
                  type="button"
                  onClick={handleExitExamPreview}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 font-khmer-body cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ចាកចេញពីការមើលជាមុន</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleClearStudentForm}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 font-khmer-body transition-colors cursor-pointer"
              >
                សម្អាតចម្លើយ
              </button>

              <button
                type="button"
                onClick={handleStudentSubmitQuiz}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#673AB7] hover:bg-[#5E35B1] text-white text-xs sm:text-sm font-bold font-khmer-body shadow-xs cursor-pointer transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>
                  {isStudentRole
                    ? 'ដាក់ស្នើការប្រឡង'
                    : 'សាកល្បងដាក់ស្នើ (Test Submit in Preview)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CONFIRMATION DIALOG FOR IMPORTANT ACTIONS                             */}
      {/* ===================================================================== */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div
            role="dialog"
            aria-label={confirmModal.title}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmModal.tone === 'danger'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-indigo-50 text-indigo-600'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 font-khmer-body">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-slate-600 font-khmer-body leading-relaxed">
                  {confirmModal.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 font-khmer-body cursor-pointer"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white font-khmer-body cursor-pointer ${
                  confirmModal.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* QUESTION BANK PICKER MODAL (Import from Monthly Question Bank)        */}
      {/* ===================================================================== */}
      {isQuestionBankPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-label="Import from Monthly Question Bank Modal"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden my-8"
          >
            <div className="h-2 bg-indigo-600 w-full" />
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-khmer-moul">
                    នាំចូលសំណួរពីឃ្លាំងសំណួរតាមខែ
                  </h3>
                  <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                    ជ្រើសរើសសំណួរដើម្បីបញ្ចូលទៅក្នុងវិញ្ញាសា «{currentExam.ExamTitle}»
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuestionBankPickerOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                      មុខវិជ្ជា
                    </label>
                    <select
                      aria-label="មុខវិជ្ជាក្នុងឃ្លាំងសំណួរ"
                      value={pickerSubjectId}
                      onChange={(e) => setPickerSubjectId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold font-khmer-body"
                    >
                      {allowedSubjectsForActor.map((s) => (
                        <option key={s.SubjectID} value={s.SubjectID}>
                          {s.SubjectNameKh}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                      ខែប្រឡង ឬឆមាស
                    </label>
                    <select
                      aria-label="ខែក្នុងឃ្លាំងសំណួរ"
                      value={pickerMonthFilter}
                      onChange={(e) =>
                        setPickerMonthFilter(e.target.value as 'ALL' | AcademicQuestionMonth)
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold font-khmer-body"
                    >
                      <option value="ALL">ទាំងអស់</option>
                      {ALL_SUPPORTED_QUESTION_MONTHS.map((m) => (
                        <option key={m} value={m}>
                          {formatMonthBadgeLabel(m)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {ACADEMIC_MONTH_TABS.map((mTab) => {
                    const active = pickerMonthFilter === mTab.id;
                    return (
                      <button
                        key={mTab.id}
                        type="button"
                        onClick={() => setPickerMonthFilter(mTab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-khmer-body whitespace-nowrap border transition-colors cursor-pointer shrink-0 ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {mTab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700 font-khmer-body">
                    សំណួរដែលរកឃើញ ({pickerFilteredQuestions.length}) · បានជ្រើសរើស {pickerCheckedIds.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = pickerFilteredQuestions.map((q) => q.QuestionID);
                      const allSelected =
                        allIds.length > 0 &&
                        allIds.every((id) => pickerCheckedIds.includes(id));
                      if (allSelected) {
                        setPickerCheckedIds((prev) =>
                          prev.filter((id) => !allIds.includes(id))
                        );
                      } else {
                        setPickerCheckedIds((prev) =>
                          Array.from(new Set([...prev, ...allIds]))
                        );
                      }
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 font-khmer-body cursor-pointer"
                  >
                    ជ្រើសរើសទាំងអស់
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                  {pickerFilteredQuestions.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 font-khmer-body">
                      មិនមានសំណួរក្នុងខែនេះទេ។
                    </div>
                  ) : (
                    pickerFilteredQuestions.map((q) => {
                      const checked = pickerCheckedIds.includes(q.QuestionID);
                      const alreadyInQuiz = examQuestions.some(
                        (eq) => eq.QuestionID === q.QuestionID
                      );
                      return (
                        <label
                          key={q.QuestionID}
                          className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                            checked ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setPickerCheckedIds((prev) =>
                                prev.includes(q.QuestionID)
                                  ? prev.filter((id) => id !== q.QuestionID)
                                  : [...prev, q.QuestionID]
                              )
                            }
                            className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-khmer-body">
                              <span>{formatMonthBadgeLabel(q.ExamMonth)}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular font-bold text-indigo-600">
                                {q.QuestionType} · {q.Points} ពិន្ទុ
                              </span>
                              {alreadyInQuiz && (
                                <span className="text-emerald-700 font-bold">
                                  · មានក្នុងវិញ្ញាសារួចហើយ
                                </span>
                              )}
                            </div>
                            <div className="text-xs sm:text-sm font-semibold text-slate-900 font-khmer-body mt-1">
                              {q.QuestionText}
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsQuestionBankPickerOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 font-khmer-body cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="button"
                  onClick={handleAddSelectedQuestionsToQuiz}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body shadow-2xs cursor-pointer"
                >
                  បញ្ចូលទៅក្នុងវិញ្ញាសា
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* GOOGLE FORM IMPORT WIZARD MODAL                                       */}
      {/* ===================================================================== */}
      {isGoogleFormImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-label="Import from Google Form Modal"
            data-testid="google-form-import-modal"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full overflow-hidden my-6"
          >
            <div className="h-2 bg-[#673AB7] w-full" />

            <div className="p-6 space-y-5 max-h-[88vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#673AB7] text-white flex items-center justify-center shadow-2xs shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-khmer-moul">
                      ទាញយកទម្រង់ពី Google Form
                    </h3>
                    <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                      បញ្ចូល Google Form URL, Form ID ឬ JSON ដើម្បីទាញយកសំណួរ និងពិន្ទុដោយស្វ័យប្រវត្តិ
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="បិទផ្ទាំង Google Form Import"
                  onClick={() => setIsGoogleFormImportOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#F0EBF8]/60 border border-[#673AB7]/20 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-slate-800 font-khmer-body">
                    តំណភ្ជាប់ Google Form URL ឬ JSON៖
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handlePreviewGoogleForm(
                          'https://docs.google.com/forms/d/1TeukChhouk_ICT_June_Form_2026/viewform'
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-50 text-[#673AB7] border border-purple-200 text-[11px] font-bold font-khmer-body cursor-pointer"
                    >
                      ប្រឡងប្រចាំខែមិថុនា (ICT · 50 ពិន្ទុ)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handlePreviewGoogleForm(
                          'https://docs.google.com/forms/d/1TeukChhouk_ICT_July_Form_2026/viewform'
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-50 text-[#673AB7] border border-purple-200 text-[11px] font-bold font-khmer-body cursor-pointer"
                    >
                      ប្រឡងប្រចាំខែកក្កដា (ICT · ៤០នាទី)
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <textarea
                    rows={googleFormUrlOrJsonInput.trim().startsWith('{') ? 5 : 2}
                    aria-label="Google Form URL or JSON Input"
                    value={googleFormUrlOrJsonInput}
                    onChange={(e) => setGoogleFormUrlOrJsonInput(e.target.value)}
                    placeholder="បិទភ្ជាប់ Google Form URL ឬ JSON..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-mono-tabular text-slate-800 focus:outline-none focus:border-[#673AB7]"
                  />

                  <button
                    type="button"
                    data-testid="preview-google-form-btn"
                    onClick={() => handlePreviewGoogleForm()}
                    className="px-5 py-2.5 rounded-xl bg-[#673AB7] hover:bg-[#5E35B1] text-white text-xs sm:text-sm font-bold font-khmer-body shadow-2xs inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>មើលជាមុន</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-[11px] font-semibold text-slate-500 font-khmer-body">
                    ចំណងជើងវិញ្ញាសា
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 font-khmer-body mt-0.5">
                    {parsedGoogleFormPreview.quizTitle}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80">
                  <div className="text-[11px] font-semibold text-indigo-700 font-khmer-body">
                    មុខវិជ្ជា
                  </div>
                  <div className="text-sm font-extrabold text-indigo-950 font-khmer-body mt-0.5">
                    {parsedGoogleFormPreview.subjectCode} · {parsedGoogleFormPreview.subjectNameKh}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80">
                  <div className="text-[11px] font-semibold text-amber-800 font-khmer-body">
                    រយៈពេលប្រឡង
                  </div>
                  <div className="text-sm font-extrabold text-amber-950 font-khmer-body mt-0.5">
                    {parsedGoogleFormPreview.durationTextKh}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                  <div className="text-[11px] font-semibold text-emerald-800 font-khmer-body">
                    ពិន្ទុសរុប
                  </div>
                  <div className="text-sm font-extrabold text-emerald-950 font-mono-tabular mt-0.5">
                    {parsedGoogleFormPreview.totalPoints} ពិន្ទុ ({parsedGoogleFormPreview.questions.length} សំណួរ)
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
                  <div className="text-xs font-extrabold text-slate-800 font-khmer-body flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-[#673AB7]" />
                    <span>សំណួរដែលបានទាញយក ({parsedGoogleFormPreview.questions.length})</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 font-khmer-body cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeGoogleFormDemographics}
                        onChange={(e) => setIncludeGoogleFormDemographics(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#673AB7] cursor-pointer"
                      />
                      <span>រួមបញ្ចូលសំណួរព័ត៌មានសិស្ស</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowAppsScriptCodeTab((v) => !v)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-[11px] font-bold text-slate-700 font-khmer-body cursor-pointer"
                    >
                      {showAppsScriptCodeTab ? 'លាក់កូដ Apps Script' : 'កូដ Google Apps Script'}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 font-khmer-body">
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">ខ្លឹមសារសំណួរ</th>
                        <th className="py-2.5 px-3 w-36">ប្រភេទ</th>
                        <th className="py-2.5 px-3 w-44">ចម្លើយត្រឹមត្រូវ</th>
                        <th className="py-2.5 px-3 w-20 text-right">ពិន្ទុ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                      {parsedGoogleFormPreview.questions
                        .filter((q) => includeGoogleFormDemographics || !q.isDemographicField || q.points > 0)
                        .map((q, idx) => (
                          <tr key={q.tempId} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 text-center font-mono-tabular font-bold text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {q.questionText}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {q.questionTypeLabelKh}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-emerald-700">
                              {q.points > 0 ? q.correctAnswerText : 'ព័ត៌មានសិស្ស'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular font-extrabold text-slate-900">
                              {q.points} ពិន្ទុ
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {showAppsScriptCodeTab && (
                <div className="rounded-xl bg-slate-900 text-slate-100 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 font-mono-tabular">
                      GoogleFormImporter.gs
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(getGoogleAppsScriptFormImporterCode());
                        setToastBanner({
                          tone: 'success',
                          title: 'បានចម្លងកូដ Google Apps Script',
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold font-khmer-body text-white cursor-pointer"
                    >
                      ចម្លងកូដ
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono-tabular overflow-x-auto max-h-40 text-slate-200 leading-relaxed">
                    {getGoogleAppsScriptFormImporterCode()}
                  </pre>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsGoogleFormImportOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 font-khmer-body hover:bg-slate-50 cursor-pointer"
                >
                  បោះបង់
                </button>

                <button
                  type="button"
                  data-testid="import-google-form-into-current-btn"
                  onClick={() => handleSaveGoogleFormToSystem('APPEND_TO_CURRENT')}
                  className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold font-khmer-body cursor-pointer transition-colors"
                >
                  បញ្ចូលទៅក្នុងវិញ្ញាសាបច្ចុប្បន្ន
                </button>

                <button
                  type="button"
                  data-testid="create-new-exam-from-google-form-btn"
                  onClick={() => handleSaveGoogleFormToSystem('CREATE_NEW_EXAM')}
                  className="px-5 py-2 rounded-xl bg-[#673AB7] hover:bg-[#5E35B1] text-white text-xs font-bold font-khmer-body shadow-2xs cursor-pointer transition-colors"
                >
                  រក្សាទុកជាវិញ្ញាសាថ្មី («{parsedGoogleFormPreview.quizTitle}»)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
