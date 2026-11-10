import React, { useState, useMemo, useEffect } from 'react';
import {
  AcademicQuestionMonth,
  DatabaseState,
  ExamRecord,
  QuestionAction,
  QuestionRecord,
  QuestionType,
  SubjectRecord,
  TeacherSubjectAssignmentRecord,
} from '../types/database';
import { canManageQuestion } from '../lib/domainRules';
import { HONOR_PORTRAIT_URLS } from '../lib/seedData';
import { Toast } from './ui';
import {
  Atom,
  BookMarked,
  BookOpen,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Copy,
  Cpu,
  Download,
  Edit3,
  Eye,
  FilePlus2,
  FileSpreadsheet,
  FolderOpen,
  Globe,
  Layers,
  Lock,
  MoreVertical,
  Plus,
  PlusCircle,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';

interface SecuritySimulatorViewProps {
  db: DatabaseState;
  setDb?: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  onSelectUser: (userId: string) => void;
  onExecuteQuestionAction: (params: {
    userId: string;
    questionId: string | null;
    action: QuestionAction;
    subjectId?: string;
    questionText?: string;
    questionType?: QuestionType;
    points?: number;
  }) => { allowed: boolean; messageKh: string; messageEn: string; rule: string };
}

type GradeFilterOption = 'ALL' | 'GRADE_7_9' | 'GRADE_10_12' | 'CLASS_12C';
type DifficultyFilterOption = 'ALL' | 'EASY' | 'MEDIUM' | 'HARD';
type ImportModalTab = 'FROM_EXISTING_MONTH' | 'BULK_FILE_TEXT';

export const ACADEMIC_MONTH_TABS: Array<{
  id: 'ALL' | AcademicQuestionMonth;
  label: string;
  shortLabel: string;
}> = [
  { id: 'ALL', label: 'ទាំងអស់ (All)', shortLabel: 'ទាំងអស់' },
  { id: 'តុលា', label: 'ខែតុលា', shortLabel: 'តុលា' },
  { id: 'វិច្ឆិកា', label: 'ខែវិច្ឆិកា', shortLabel: 'វិច្ឆិកា' },
  { id: 'ធ្នូ', label: 'ខែធ្នូ', shortLabel: 'ធ្នូ' },
  { id: 'មករា', label: 'ខែមករា', shortLabel: 'មករា' },
  { id: 'កុម្ភៈ', label: 'ខែកុម្ភៈ', shortLabel: 'កុម្ភៈ' },
  { id: 'មីនា', label: 'ខែមីនា', shortLabel: 'មីនា' },
  { id: 'ឆមាសទី១', label: 'ឆមាសទី១', shortLabel: 'ឆមាសទី១' },
  { id: 'ឆមាសទី២', label: 'ឆមាសទី២', shortLabel: 'ឆមាសទី២' },
];

export const ALL_SUPPORTED_QUESTION_MONTHS: AcademicQuestionMonth[] = [
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
  'ឆមាសទី១',
  'ឆមាសទី២',
  'ប្រចាំឆ្នាំ',
];

export function formatMonthBadgeLabel(month?: string): string {
  const m = month || 'វិច្ឆិកា';
  if (m.startsWith('ឆមាស') || m.startsWith('ប្រចាំ') || m.startsWith('ខែ')) {
    return m;
  }
  return `ខែ${m}`;
}

export const SecuritySimulatorView: React.FC<SecuritySimulatorViewProps> = ({
  db,
  setDb,
  activeUserId,
  onExecuteQuestionAction,
}) => {
  // Active User & Role
  const activeUser = useMemo(
    () => db.Users.find((u) => u.UserID === activeUserId) || db.Users[2],
    [db.Users, activeUserId]
  );
  const activeRole = useMemo(
    () => db.Roles.find((r) => r.RoleID === activeUser.RoleID),
    [db.Roles, activeUser]
  );

  const isSuperOrAdmin =
    activeRole?.RoleName === 'SUPER_ADMIN' || activeRole?.RoleName === 'ADMIN';
  const isTeacher = activeRole?.RoleName === 'TEACHER';
  const isStudent = activeRole?.RoleName === 'STUDENT';

  // Local mirrors
  const [localSubjects, setLocalSubjects] = useState<SubjectRecord[]>(() => db.Subjects);
  const [localQuestions, setLocalQuestions] = useState<QuestionRecord[]>(() => db.Questions);
  const [localAssignments, setLocalAssignments] = useState<TeacherSubjectAssignmentRecord[]>(
    () => db.TeacherSubjectAssignments
  );

  useEffect(() => {
    setLocalSubjects(db.Subjects);
  }, [db.Subjects]);

  useEffect(() => {
    setLocalQuestions(db.Questions);
  }, [db.Questions]);

  useEffect(() => {
    setLocalAssignments(db.TeacherSubjectAssignments);
  }, [db.TeacherSubjectAssignments]);

  // Assigned Subject IDs for current Teacher
  const assignedSubjectIdsForTeacher = useMemo(() => {
    if (!isTeacher) return new Set<string>();
    return new Set(
      localAssignments
        .filter((a) => a.TeacherID === activeUser.UserID && a.Status === 'ACTIVE')
        .map((a) => a.SubjectID)
    );
  }, [localAssignments, activeUser.UserID, isTeacher]);

  // Selected Subject in Left Directory Pane
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (isSuperOrAdmin) return 'ALL';
    if (isTeacher) {
      const firstAssigned = localAssignments.find(
        (a) => a.TeacherID === activeUser.UserID && a.Status === 'ACTIVE'
      );
      return firstAssigned?.SubjectID || 'SUB-ICT';
    }
    return 'SUB-ICT';
  });

  // Keep Teacher locked to an authorized subject when switching roles
  useEffect(() => {
    if (isTeacher) {
      if (
        selectedSubjectId === 'ALL' ||
        !assignedSubjectIdsForTeacher.has(selectedSubjectId)
      ) {
        const firstAssigned = Array.from(assignedSubjectIdsForTeacher)[0] || 'SUB-ICT';
        setSelectedSubjectId(firstAssigned);
      }
    } else if (isSuperOrAdmin && !selectedSubjectId) {
      setSelectedSubjectId('ALL');
    }
  }, [isTeacher, isSuperOrAdmin, assignedSubjectIdsForTeacher, selectedSubjectId]);

  // Filters: Grade, Month, Search, Type, Difficulty
  const [gradeFilter, setGradeFilter] = useState<GradeFilterOption>('ALL');
  const [selectedMonthTab, setSelectedMonthTab] = useState<'ALL' | AcademicQuestionMonth>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'ALL' | QuestionType>('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilterOption>('ALL');

  // Multi-select checkboxes for Batch Quiz Creation / Cross-Month Copy
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  // Student Self-Practice / Study Mode State
  const [studentPracticeSelectedOption, setStudentPracticeSelectedOption] = useState<
    Record<string, number>
  >({});
  const [studentPracticeCheckedMap, setStudentPracticeCheckedMap] = useState<
    Record<string, boolean>
  >({});

  // Toast Notification
  const [toastBanner, setToastBanner] = useState<{
    tone: 'success' | 'info' | 'warning' | 'danger';
    title: string;
    description?: string;
  } | null>(null);

  // ============================================================================
  // MODAL 1 STATE: GOOGLE-FORMS-STYLE CREATE / EDIT QUESTION MODAL
  // ============================================================================
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState<boolean>(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionRecord | null>(null);
  const [qFormSubjectId, setQFormSubjectId] = useState<string>('SUB-ICT');
  const [qFormMonth, setQFormMonth] = useState<AcademicQuestionMonth>('វិច្ឆិកា');
  const [qFormClassName, setQFormClassName] = useState<string>('12C');
  const [qFormType, setQFormType] = useState<QuestionType>('MCQ');
  const [qFormDifficulty, setQFormDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [qFormPoints, setQFormPoints] = useState<string>('10');
  const [qFormText, setQFormText] = useState<string>('');
  const [qFormOptions, setQFormOptions] = useState<string[]>([
    'ក. ជម្រើសទី ១',
    'ខ. ជម្រើសទី ២',
    'គ. ជម្រើសទី ៣',
    'ឃ. ជម្រើសទី ៤',
  ]);
  const [qFormCorrectIndex, setQFormCorrectIndex] = useState<number>(0);
  const [qFormKeywordOrRubric, setQFormKeywordOrRubric] = useState<string>('SHA-256');

  // ============================================================================
  // MODAL 2 STATE: ADD / EDIT SUBJECT MODAL (SUPER_ADMIN & ADMIN)
  // ============================================================================
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState<boolean>(false);
  const [editingSubject, setEditingSubject] = useState<SubjectRecord | null>(null);
  const [subFormCode, setSubFormCode] = useState<string>('');
  const [subFormNameKh, setSubFormNameKh] = useState<string>('');
  const [subFormNameEn, setSubFormNameEn] = useState<string>('');
  const [subFormGrade, setSubFormGrade] = useState<string>('12');
  const [subFormMaxScore, setSubFormMaxScore] = useState<string>('50');
  const [subFormCoeff, setSubFormCoeff] = useState<string>('1.0');

  // ============================================================================
  // MODAL 3 STATE: ASSIGN TEACHER MODAL (SUPER_ADMIN & ADMIN)
  // ============================================================================
  const [isAssignTeacherModalOpen, setIsAssignTeacherModalOpen] = useState<boolean>(false);
  const [assignTeacherId, setAssignTeacherId] = useState<string>('USR-TCH-12C');
  const [assignSubjectId, setAssignSubjectId] = useState<string>('SUB-ICT');
  const [assignClassId, setAssignClassId] = useState<string>('CLS-12C');

  // ============================================================================
  // MODAL 4 STATE: CREATE QUIZ / DEPLOY MONTHLY PACKAGE TO NEW STUDENTS MODAL
  // ============================================================================
  const [isCreateQuizModalOpen, setIsCreateQuizModalOpen] = useState<boolean>(false);
  const [quizFormTitle, setQuizFormTitle] = useState<string>('');
  const [quizFormTargetMonth, setQuizFormTargetMonth] = useState<AcademicQuestionMonth>('ធ្នូ');
  const [quizFormClassId, setQuizFormClassId] = useState<string>('CLS-12C');
  const [quizFormSelectedClassIds, setQuizFormSelectedClassIds] = useState<string[]>(['CLS-12C']);
  const [quizFormAcademicYear, setQuizFormAcademicYear] = useState<string>('២០២៦-២០២៧');
  const [quizFormDuration, setQuizFormDuration] = useState<string>('60');
  const [showMonthlyPackagesGrid, setShowMonthlyPackagesGrid] = useState<boolean>(true);

  // ============================================================================
  // MODAL 5 STATE: COPY SELECTED QUESTIONS TO ANOTHER MONTH MODAL
  // ============================================================================
  const [isCopyMonthModalOpen, setIsCopyMonthModalOpen] = useState<boolean>(false);
  const [copyTargetMonth, setCopyTargetMonth] = useState<AcademicQuestionMonth>('ធ្នូ');

  // ============================================================================
  // MODAL 6 STATE: 2-TAB IMPORT QUESTIONS MODAL (+ នាំចូលសំណួរ / Import Questions)
  // ============================================================================
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importModalTab, setImportModalTab] = useState<ImportModalTab>('FROM_EXISTING_MONTH');
  const [importSourceSubjectId, setImportSourceSubjectId] = useState<string>('SUB-ICT');
  const [importSourceMonth, setImportSourceMonth] = useState<'ALL' | AcademicQuestionMonth>('វិច្ឆិកា');
  const [importCheckedIds, setImportCheckedIds] = useState<string[]>([]);
  const [importDestMonth, setImportDestMonth] = useState<AcademicQuestionMonth>('ធ្នូ');
  const [importDestExamId, setImportDestExamId] = useState<string>('NONE');

  // Bulk CSV / JSON / Text Import state
  const [bulkTargetSubjectId, setBulkTargetSubjectId] = useState<string>('SUB-ICT');
  const [bulkTargetMonth, setBulkTargetMonth] = useState<AcademicQuestionMonth>('វិច្ឆិកា');
  const [bulkTargetClassName, setBulkTargetClassName] = useState<string>('12C');
  const [bulkRawText, setBulkRawText] = useState<string>(
    `តើ اختصار HTML តំណាងឱ្យពាក្យអ្វី? | ក. HyperText Markup Language | ខ. HighText Machine Language | គ. HyperTool Multi Language | ឃ. Home Tool Markup Language | 0 | 10\nតើ CSS ត្រូវបានប្រើសម្រាប់ធ្វើអ្វីក្នុងការបង្កើតគេហទំព័រ? | ក. រចនាទម្រង់ និងពណ៌ (Styling & Layout) | ខ. រក្សាទុកទិន្នន័យសម្ងាត់ | គ. បង្កើនល្បឿន CPU | ឃ. ភ្ជាប់ម៉ាស៊ីនបោះពុម្ព | 0 | 10`
  );

  // Subject visual theme helper
  const getSubjectVisualTheme = (subId: string) => {
    switch (subId) {
      case 'SUB-ICT':
        return {
          icon: Cpu,
          badgeBg: 'bg-indigo-600 text-white',
          softBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          ringActive: 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/15',
        };
      case 'SUB-MATH':
        return {
          icon: Calculator,
          badgeBg: 'bg-emerald-600 text-white',
          softBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          ringActive: 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/15',
        };
      case 'SUB-ENG':
        return {
          icon: Globe,
          badgeBg: 'bg-amber-500 text-white',
          softBg: 'bg-amber-50 text-amber-800 border-amber-200',
          ringActive: 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/15',
        };
      case 'SUB-KHM':
        return {
          icon: BookMarked,
          badgeBg: 'bg-rose-600 text-white',
          softBg: 'bg-rose-50 text-rose-700 border-rose-200',
          ringActive: 'border-rose-600 bg-rose-50/40 ring-2 ring-rose-600/15',
        };
      case 'SUB-PHY':
      default:
        return {
          icon: Atom,
          badgeBg: 'bg-sky-600 text-white',
          softBg: 'bg-sky-50 text-sky-700 border-sky-200',
          ringActive: 'border-sky-600 bg-sky-50/40 ring-2 ring-sky-600/15',
        };
    }
  };

  // Filtered & Ordered Subjects for Left Directory Pane
  const directorySubjects = useMemo(() => {
    const activeSubs = localSubjects.filter((s) => {
      if (s.Status !== 'ACTIVE') return false;
      if (gradeFilter === 'GRADE_7_9') {
        return ['7', '8', '9'].includes(String(s.GradeLevel));
      }
      if (gradeFilter === 'GRADE_10_12') {
        return ['10', '11', '12'].includes(String(s.GradeLevel));
      }
      return true;
    });

    if (isTeacher) {
      return [...activeSubs].sort((a, b) => {
        const aAssigned = assignedSubjectIdsForTeacher.has(a.SubjectID) ? 0 : 1;
        const bAssigned = assignedSubjectIdsForTeacher.has(b.SubjectID) ? 0 : 1;
        return aAssigned - bAssigned;
      });
    }

    return activeSubs;
  }, [localSubjects, gradeFilter, isTeacher, assignedSubjectIdsForTeacher]);

  // Base questions accessible in the selected subject (before Month tab filter)
  const subjectAccessibleQuestions = useMemo(() => {
    return localQuestions.filter((q) => {
      if (q.Status !== 'ACTIVE') return false;
      if (isTeacher) {
        if (!assignedSubjectIdsForTeacher.has(q.SubjectID)) return false;
        if (q.CreatedByUserID !== activeUser.UserID) return false;
      }
      if (selectedSubjectId !== 'ALL' && q.SubjectID !== selectedSubjectId) {
        return false;
      }
      return true;
    });
  }, [
    localQuestions,
    isTeacher,
    assignedSubjectIdsForTeacher,
    activeUser.UserID,
    selectedSubjectId,
  ]);

  // Question counts per month for the Horizontal Month Selector Bar
  const monthQuestionCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: subjectAccessibleQuestions.length };
    ACADEMIC_MONTH_TABS.forEach((m) => {
      if (m.id !== 'ALL') counts[m.id] = 0;
    });
    subjectAccessibleQuestions.forEach((q) => {
      const m = q.ExamMonth || 'វិច្ឆិកា';
      counts[m] = (counts[m] || 0) + 1;
    });
    return counts;
  }, [subjectAccessibleQuestions]);

  // Reusable Monthly Question Packages (កញ្ចប់សំណួរតាមខែនីមួយៗសម្រាប់ប្រើប្រាស់ពេលក្រោយជាមួយសិស្សថ្មី)
  const monthlyQuestionPackages = useMemo(() => {
    const activeSubObj =
      selectedSubjectId !== 'ALL'
        ? localSubjects.find((s) => s.SubjectID === selectedSubjectId)
        : null;

    return ACADEMIC_MONTH_TABS.filter(
      (m): m is { id: AcademicQuestionMonth; label: string; shortLabel: string } =>
        m.id !== 'ALL'
    ).map((mTab) => {
      const questionsInMonth = subjectAccessibleQuestions.filter(
        (q) => (q.ExamMonth || 'វិច្ឆិកា') === mTab.id
      );
      const totalPoints = questionsInMonth.reduce((sum, q) => sum + (q.Points || 10), 0);
      const mcqCount = questionsInMonth.filter((q) => q.QuestionType === 'MCQ').length;
      const tfCount = questionsInMonth.filter((q) => q.QuestionType === 'TRUE_FALSE').length;
      const writtenCount = questionsInMonth.filter(
        (q) => q.QuestionType === 'SHORT_ANSWER' || q.QuestionType === 'ESSAY'
      ).length;

      return {
        monthId: mTab.id,
        monthLabel: mTab.label,
        packageCode: `PKG-${
          selectedSubjectId === 'ALL' ? 'ALL' : selectedSubjectId.replace('SUB-', '')
        }-${mTab.id}`,
        packageTitle: `កញ្ចប់សំណួរប្រឡងប្រចាំ${mTab.label}${
          activeSubObj ? ` (${activeSubObj.SubjectNameKh})` : ''
        }`,
        questionIds: questionsInMonth.map((q) => q.QuestionID),
        questionCount: questionsInMonth.length,
        totalPoints,
        mcqCount,
        tfCount,
        writtenCount,
      };
    });
  }, [subjectAccessibleQuestions, selectedSubjectId, localSubjects]);

  // Filtered Questions for Right Pane Question Bank Explorer
  const filteredQuestions = useMemo(() => {
    const qText = searchQuery.trim().toLowerCase();

    return subjectAccessibleQuestions.filter((q) => {
      const qMonth = q.ExamMonth || 'វិច្ឆិកា';
      if (selectedMonthTab !== 'ALL' && qMonth !== selectedMonthTab) {
        return false;
      }

      if (questionTypeFilter !== 'ALL' && q.QuestionType !== questionTypeFilter) {
        return false;
      }

      if (difficultyFilter !== 'ALL' && q.DifficultyLevel !== difficultyFilter) {
        return false;
      }

      if (!qText) return true;
      return (
        q.QuestionText.toLowerCase().includes(qText) ||
        q.QuestionID.toLowerCase().includes(qText) ||
        q.SubjectID.toLowerCase().includes(qText) ||
        qMonth.toLowerCase().includes(qText)
      );
    });
  }, [
    subjectAccessibleQuestions,
    selectedMonthTab,
    questionTypeFilter,
    difficultyFilter,
    searchQuery,
  ]);

  const totalFilteredPoints = useMemo(
    () => filteredQuestions.reduce((sum, q) => sum + (q.Points || 0), 0),
    [filteredQuestions]
  );

  // Check if all filtered questions in current view are selected
  const areAllFilteredSelected =
    filteredQuestions.length > 0 &&
    filteredQuestions.every((q) => selectedQuestionIds.includes(q.QuestionID));

  const handleToggleSelectAllInView = () => {
    if (areAllFilteredSelected) {
      const visibleIds = new Set(filteredQuestions.map((q) => q.QuestionID));
      setSelectedQuestionIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const merged = new Set([
        ...selectedQuestionIds,
        ...filteredQuestions.map((q) => q.QuestionID),
      ]);
      setSelectedQuestionIds(Array.from(merged));
    }
  };

  const handleToggleQuestionCheckbox = (questionId: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    );
  };

  // Open Create Question Modal
  const handleOpenCreateQuestionModal = () => {
    const defaultSubject =
      selectedSubjectId !== 'ALL'
        ? selectedSubjectId
        : isTeacher
        ? Array.from(assignedSubjectIdsForTeacher)[0] || 'SUB-ICT'
        : 'SUB-ICT';

    setEditingQuestion(null);
    setQFormSubjectId(defaultSubject);
    setQFormMonth(selectedMonthTab !== 'ALL' ? selectedMonthTab : 'វិច្ឆិកា');
    setQFormClassName('12C');
    setQFormType('MCQ');
    setQFormDifficulty('MEDIUM');
    setQFormPoints('10');
    setQFormText('');
    setQFormOptions([
      'ក. ជម្រើសទី ១',
      'ខ. ជម្រើសទី ២',
      'គ. ជម្រើសទី ៣',
      'ឃ. ជម្រើសទី ៤',
    ]);
    setQFormCorrectIndex(0);
    setQFormKeywordOrRubric('SHA-256');
    setIsQuestionModalOpen(true);
  };

  // Open Edit Question Modal
  const handleOpenEditQuestionModal = (q: QuestionRecord) => {
    const check = canManageQuestion(
      activeUser.UserID,
      q.QuestionID,
      'EDIT',
      {
        users: db.Users,
        roles: db.Roles,
        assignments: localAssignments,
        questions: localQuestions,
        classes: db.Classes,
      },
      q.SubjectID
    );

    if (!check.allowed) {
      setToastBanner({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិកែប្រែសំណួរនេះទេ (Ownership Guard)',
        description: check.reasonKh,
      });
      return;
    }

    let parsedOpts: string[] = [
      'ក. ជម្រើសទី ១',
      'ខ. ជម្រើសទី ២',
      'គ. ជម្រើសទី ៣',
      'ឃ. ជម្រើសទី ៤',
    ];
    try {
      const raw = JSON.parse(q.OptionsJSON || '[]');
      if (Array.isArray(raw) && raw.length > 0) parsedOpts = raw;
    } catch {
      // use fallback
    }

    let parsedAns: {
      answerIndex?: number;
      isTrue?: boolean;
      sampleKeyword?: string;
      rubric?: string;
    } = {};
    try {
      parsedAns = JSON.parse(q.CorrectAnswerJSON || '{}');
    } catch {
      parsedAns = {};
    }

    setEditingQuestion(q);
    setQFormSubjectId(q.SubjectID);
    setQFormMonth((q.ExamMonth as AcademicQuestionMonth) || 'វិច្ឆិកា');
    setQFormClassName(q.ClassName || '12C');
    setQFormType(q.QuestionType);
    setQFormDifficulty(q.DifficultyLevel || 'MEDIUM');
    setQFormPoints(String(q.Points || 10));
    setQFormText(q.QuestionText);
    setQFormOptions(
      q.QuestionType === 'TRUE_FALSE' ? ['ត្រូវ (True)', 'ខុស (False)'] : parsedOpts
    );
    setQFormCorrectIndex(
      q.QuestionType === 'TRUE_FALSE'
        ? parsedAns.isTrue === false
          ? 1
          : 0
        : parsedAns.answerIndex ?? 0
    );
    setQFormKeywordOrRubric(parsedAns.sampleKeyword || parsedAns.rubric || 'SHA-256');
    setIsQuestionModalOpen(true);
  };

  // Save Question (Create or Edit)
  const handleSaveQuestionFromModal = (keepOpenForAnother: boolean) => {
    if (!qFormText.trim()) {
      setToastBanner({
        tone: 'warning',
        title: 'សូមបញ្ចូលខ្លឹមសារសំណួរ',
        description: 'ខ្លឹមសារសំណួរមិនអាចទទេបានទេ។',
      });
      return;
    }

    const now = new Date().toISOString();
    const numericPoints = Math.max(1, Number(qFormPoints) || 10);

    const optionsJson =
      qFormType === 'MCQ'
        ? JSON.stringify(qFormOptions)
        : qFormType === 'TRUE_FALSE'
        ? JSON.stringify(['ត្រូវ (True)', 'ខុស (False)'])
        : JSON.stringify([]);

    const correctAnswerJson =
      qFormType === 'MCQ'
        ? JSON.stringify({ answerIndex: qFormCorrectIndex })
        : qFormType === 'TRUE_FALSE'
        ? JSON.stringify({
            isTrue: qFormCorrectIndex === 0,
            answerIndex: qFormCorrectIndex,
          })
        : qFormType === 'SHORT_ANSWER'
        ? JSON.stringify({ sampleKeyword: qFormKeywordOrRubric })
        : JSON.stringify({ rubric: qFormKeywordOrRubric });

    if (editingQuestion) {
      const res = onExecuteQuestionAction({
        userId: activeUser.UserID,
        questionId: editingQuestion.QuestionID,
        action: 'EDIT',
        subjectId: qFormSubjectId,
        questionText: qFormText.trim(),
        questionType: qFormType,
        points: numericPoints,
      });

      if (!res.allowed) {
        setToastBanner({
          tone: 'danger',
          title: 'បដិសេធសិទ្ធិកែប្រែសំណួរ',
          description: res.messageKh,
        });
        return;
      }

      const updater = (item: QuestionRecord): QuestionRecord =>
        item.QuestionID === editingQuestion.QuestionID
          ? {
              ...item,
              SubjectID: qFormSubjectId,
              QuestionText: qFormText.trim(),
              QuestionType: qFormType,
              DifficultyLevel: qFormDifficulty,
              Points: numericPoints,
              ExamMonth: qFormMonth,
              TargetMonth: qFormMonth,
              ClassName: qFormClassName,
              GradeLevel: qFormClassName.replace(/[A-Z]/g, '') || '12',
              OptionsJSON: optionsJson,
              CorrectAnswerJSON: correctAnswerJson,
              UpdatedByUserID: activeUser.UserID,
              UpdatedAt: now,
            }
          : item;

      setLocalQuestions((prev) => prev.map(updater));
      if (setDb) {
        setDb((prev) => ({
          ...prev,
          Questions: prev.Questions.map(updater),
        }));
      }

      setToastBanner({
        tone: 'success',
        title: 'កែប្រែសំណួរជោគជ័យ (Question Updated)',
        description: `សំណួរ ${editingQuestion.QuestionID} (${formatMonthBadgeLabel(qFormMonth)}) ត្រូវបានធ្វើបច្ចុប្បន្នភាព។`,
      });
    } else {
      const res = onExecuteQuestionAction({
        userId: activeUser.UserID,
        questionId: null,
        action: 'CREATE',
        subjectId: qFormSubjectId,
        questionText: qFormText.trim(),
        questionType: qFormType,
        points: numericPoints,
      });

      if (!res.allowed) {
        setToastBanner({
          tone: 'danger',
          title: 'បដិសេធសិទ្ធិបង្កើតសំណួរ',
          description: res.messageKh,
        });
        return;
      }

      const newId = `QST-${qFormSubjectId.replace('SUB-', '')}-${String(
        localQuestions.length + 1
      ).padStart(3, '0')}`;
      const newQuestion: QuestionRecord = {
        QuestionID: newId,
        SubjectID: qFormSubjectId,
        QuestionText: qFormText.trim(),
        QuestionType: qFormType,
        OptionsJSON: optionsJson,
        CorrectAnswerJSON: correctAnswerJson,
        Points: numericPoints,
        DifficultyLevel: qFormDifficulty,
        ExamMonth: qFormMonth,
        TargetMonth: qFormMonth,
        ClassName: qFormClassName,
        GradeLevel: qFormClassName.replace(/[A-Z]/g, '') || '12',
        ImageFileID: '',
        CreatedByUserID: activeUser.UserID,
        UpdatedByUserID: activeUser.UserID,
        Status: 'ACTIVE',
        CreatedAt: now,
        UpdatedAt: now,
      };

      setLocalQuestions((prev) => [newQuestion, ...prev]);
      if (setDb) {
        setDb((prev) => ({
          ...prev,
          Questions: [newQuestion, ...prev.Questions],
        }));
      }

      setToastBanner({
        tone: 'success',
        title: 'រក្សាទុកសំណួរថ្មីជោគជ័យ (Question Created)',
        description: `បានបន្ថែមសំណួរថ្មីទៅក្នុង ${formatMonthBadgeLabel(qFormMonth)} (${qFormSubjectId})។`,
      });
    }

    if (keepOpenForAnother) {
      setEditingQuestion(null);
      setQFormText('');
    } else {
      setIsQuestionModalOpen(false);
    }
  };

  // Duplicate Question
  const handleDuplicateQuestion = (q: QuestionRecord) => {
    const check = canManageQuestion(
      activeUser.UserID,
      q.QuestionID,
      'EDIT',
      {
        users: db.Users,
        roles: db.Roles,
        assignments: localAssignments,
        questions: localQuestions,
        classes: db.Classes,
      },
      q.SubjectID
    );

    if (!check.allowed) {
      setToastBanner({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិចម្លងសំណួរ',
        description: check.reasonKh,
      });
      return;
    }

    const now = new Date().toISOString();
    const copyId = `${q.QuestionID}-COPY-${Math.floor(Math.random() * 90 + 10)}`;
    const copyQuestion: QuestionRecord = {
      ...q,
      QuestionID: copyId,
      QuestionText: `${q.QuestionText} (ច្បាប់ចម្លង)`,
      CreatedByUserID: activeUser.UserID,
      UpdatedByUserID: activeUser.UserID,
      CreatedAt: now,
      UpdatedAt: now,
    };

    setLocalQuestions((prev) => [copyQuestion, ...prev]);
    if (setDb) {
      setDb((prev) => ({
        ...prev,
        Questions: [copyQuestion, ...prev.Questions],
      }));
    }

    setToastBanner({
      tone: 'info',
      title: 'បានចម្លងសំណួរ (Duplicated Question)',
      description: `សំណួរ ${copyId} ត្រូវបានចម្លងចូលឃ្លាំងសំណួរ។`,
    });
  };

  // Delete Question
  const handleDeleteQuestion = (q: QuestionRecord) => {
    const res = onExecuteQuestionAction({
      userId: activeUser.UserID,
      questionId: q.QuestionID,
      action: 'DELETE',
      subjectId: q.SubjectID,
    });

    if (!res.allowed) {
      setToastBanner({
        tone: 'danger',
        title: 'មិនអាចលុបសំណួរបានទេ (Ownership Guard)',
        description: res.messageKh,
      });
      return;
    }

    setLocalQuestions((prev) =>
      prev.map((item) =>
        item.QuestionID === q.QuestionID ? { ...item, Status: 'DELETED' as const } : item
      )
    );
    setSelectedQuestionIds((prev) => prev.filter((id) => id !== q.QuestionID));

    setToastBanner({
      tone: 'info',
      title: 'បានលុបសំណួរចេញពីឃ្លាំងសំណួរ',
      description: `សំណួរ ${q.QuestionID} ត្រូវបានលុប។`,
    });
  };

  // ============================================================================
  // BATCH ACTION 1: CREATE QUIZ / DEPLOY MONTHLY PACKAGE TO NEW STUDENTS
  // ============================================================================
  const handleOpenCreateQuizFromSelected = () => {
    const firstQ = localQuestions.find((q) => selectedQuestionIds.includes(q.QuestionID));
    const subId = firstQ?.SubjectID || (selectedSubjectId !== 'ALL' ? selectedSubjectId : 'SUB-ICT');
    const subObj = localSubjects.find((s) => s.SubjectID === subId);
    const defaultTargetMonth: AcademicQuestionMonth =
      selectedMonthTab !== 'ALL' ? selectedMonthTab : 'ធ្នូ';

    setQuizFormTargetMonth(defaultTargetMonth);
    setQuizFormClassId('CLS-12C');
    setQuizFormSelectedClassIds(['CLS-12C']);
    setQuizFormAcademicYear('២០២៦-២០២៧');
    setQuizFormDuration('60');
    setQuizFormTitle(
      `កញ្ចប់វិញ្ញាសាប្រឡងប្រចាំ${formatMonthBadgeLabel(defaultTargetMonth)} - ${
        subObj?.SubjectNameKh || 'ព័ត៌មានវិទ្យា (ICT)'
      }`
    );
    setIsCreateQuizModalOpen(true);
  };

  // Deploy a complete Monthly Question Package to new students / new classes / new academic year
  const handleDeployMonthlyPackageToNewStudents = (pkg: {
    monthId: AcademicQuestionMonth;
    monthLabel: string;
    questionIds: string[];
  }) => {
    if (pkg.questionIds.length === 0) {
      setSelectedMonthTab(pkg.monthId);
      handleOpenCreateQuestionModal();
      return;
    }

    setSelectedMonthTab(pkg.monthId);
    setSelectedQuestionIds(pkg.questionIds);

    const firstQ = localQuestions.find((q) => pkg.questionIds.includes(q.QuestionID));
    const subId = firstQ?.SubjectID || (selectedSubjectId !== 'ALL' ? selectedSubjectId : 'SUB-ICT');
    const subObj = localSubjects.find((s) => s.SubjectID === subId);

    setQuizFormTargetMonth(pkg.monthId);
    setQuizFormClassId('CLS-12C');
    setQuizFormSelectedClassIds(['CLS-12C']);
    setQuizFormAcademicYear('២០២៦-២០២៧');
    setQuizFormDuration('60');
    setQuizFormTitle(
      `កញ្ចប់វិញ្ញាសាប្រឡងប្រចាំ${formatMonthBadgeLabel(pkg.monthId)} - ${
        subObj?.SubjectNameKh || 'ព័ត៌មានវិទ្យា (ICT)'
      } (សិស្សថ្មី)`
    );
    setIsCreateQuizModalOpen(true);
  };

  // Clone an entire Monthly Question Package to another month
  const handleCloneMonthlyPackage = (pkg: {
    monthId: AcademicQuestionMonth;
    questionIds: string[];
  }) => {
    if (pkg.questionIds.length === 0) return;
    setSelectedMonthTab(pkg.monthId);
    setSelectedQuestionIds(pkg.questionIds);
    setIsCopyMonthModalOpen(true);
  };

  const handleToggleQuizTargetClass = (classId: string) => {
    setQuizFormSelectedClassIds((prev) => {
      if (prev.includes(classId)) {
        if (prev.length === 1) return prev;
        const next = prev.filter((id) => id !== classId);
        setQuizFormClassId(next[0]);
        return next;
      }
      const next = [...prev, classId];
      setQuizFormClassId(next[0]);
      return next;
    });
  };

  const handleConfirmCreateQuizFromSelected = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedQuestionIds.length === 0) return;

    const chosenQuestions = localQuestions.filter((q) =>
      selectedQuestionIds.includes(q.QuestionID)
    );
    const primarySubId =
      chosenQuestions[0]?.SubjectID ||
      (selectedSubjectId !== 'ALL' ? selectedSubjectId : 'SUB-ICT');
    const totalPts = chosenQuestions.reduce((acc, q) => acc + (q.Points || 10), 0) || 50;
    const now = new Date().toISOString();
    const newExamId = `EXM-PKG-${primarySubId.replace('SUB-', '')}-${Date.now()
      .toString()
      .slice(-4)}`;

    const effectiveClassIds =
      quizFormSelectedClassIds.length > 0 ? quizFormSelectedClassIds : [quizFormClassId];
    const targetClassNames = effectiveClassIds
      .map((cid) => db.Classes.find((c) => c.ClassID === cid)?.ClassName || cid.replace('CLS-', ''))
      .join(', ');

    const newExam: ExamRecord = {
      ExamID: newExamId,
      ExamTitle:
        quizFormTitle.trim() ||
        `វិញ្ញាសាប្រឡងប្រចាំ${formatMonthBadgeLabel(quizFormTargetMonth)}`,
      SubjectID: primarySubId,
      ClassID: effectiveClassIds[0] || quizFormClassId,
      ClassIDs: effectiveClassIds,
      AcademicYearID: `AY-${quizFormAcademicYear}`,
      SemesterID: quizFormTargetMonth === 'ឆមាសទី២' ? 'SEM-2526-2' : 'SEM-2526-1',
      ExamType: quizFormTargetMonth.startsWith('ឆមាស') ? 'SEMESTER' : 'MONTHLY',
      ExamMonth: quizFormTargetMonth,
      StartDateTime: now,
      EndDateTime: new Date(Date.now() + 14 * 86400000).toISOString(),
      DurationMinutes: Math.max(15, Number(quizFormDuration) || 60),
      MaximumScore: totalPts,
      PassScore: Number((totalPts / 2).toFixed(1)),
      AttemptLimit: 1,
      Instructions: `កញ្ចប់វិញ្ញាសាប្រឡងប្រចាំ${formatMonthBadgeLabel(
        quizFormTargetMonth
      )} សម្រាប់សិស្សថ្នាក់ទី ${targetClassNames} (ឆ្នាំសិក្សា ${quizFormAcademicYear}) • សូមឆ្លើយសំណួរទាំង ${
        chosenQuestions.length
      } ឱ្យបានត្រឹមត្រូវ។`,
      CreatedByUserID: activeUser.UserID,
      Status: 'PUBLISHED',
      QuestionIDs: [...selectedQuestionIds],
      CreatedAt: now,
      UpdatedAt: now,
    };

    if (setDb) {
      setDb((prev) => ({
        ...prev,
        Exams: [newExam, ...prev.Exams],
      }));
    }

    setIsCreateQuizModalOpen(false);
    setSelectedQuestionIds([]);
    setToastBanner({
      tone: 'success',
      title: 'បានដាក់ឱ្យប្រើប្រាស់កញ្ចប់សំណួរសម្រាប់សិស្សថ្មីជោគជ័យ! (Package Deployed)',
      description: `កញ្ចប់វិញ្ញាសា «${newExam.ExamTitle}» (${chosenQuestions.length} សំណួរ • ${totalPts} ពិន្ទុ) ត្រូវបានកំណត់ឱ្យសិស្សថ្នាក់ទី ${targetClassNames} ក្នុងឆ្នាំសិក្សា ${quizFormAcademicYear} រួចរាល់។`,
    });
  };

  // ============================================================================
  // BATCH ACTION 2: COPY SELECTED QUESTIONS TO ANOTHER MONTH
  // ============================================================================
  const handleConfirmCopySelectedToMonth = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedQuestionIds.length === 0) return;

    const now = new Date().toISOString();
    const sourceQuestions = localQuestions.filter((q) =>
      selectedQuestionIds.includes(q.QuestionID)
    );

    const clonedQuestions: QuestionRecord[] = sourceQuestions.map((q, idx) => ({
      ...q,
      QuestionID: `${q.QuestionID}-${copyTargetMonth}-${Math.floor(Math.random() * 900 + 100)}-${idx}`,
      ExamMonth: copyTargetMonth,
      TargetMonth: copyTargetMonth,
      CreatedByUserID: activeUser.UserID,
      UpdatedByUserID: activeUser.UserID,
      CreatedAt: now,
      UpdatedAt: now,
    }));

    setLocalQuestions((prev) => [...clonedQuestions, ...prev]);
    if (setDb) {
      setDb((prev) => ({
        ...prev,
        Questions: [...clonedQuestions, ...prev.Questions],
      }));
    }

    setIsCopyMonthModalOpen(false);
    setSelectedQuestionIds([]);
    setSelectedMonthTab(copyTargetMonth);

    setToastBanner({
      tone: 'success',
      title: `បានចម្លងសំណួរចំនួន ${clonedQuestions.length} ទៅកាន់ ${formatMonthBadgeLabel(
        copyTargetMonth
      )}`,
      description: 'សំណួរទាំងអស់ត្រូវបានចម្លង និងរៀបចំក្នុងខែថ្មីរួចរាល់ដោយមិនបាច់វាយឡើងវិញ។',
    });
  };

  // ============================================================================
  // MODAL 6 HANDLERS: 2-TAB IMPORT QUESTIONS MODAL (+ នាំចូលសំណួរ)
  // ============================================================================
  const importPreviewQuestions = useMemo(() => {
    return localQuestions.filter((q) => {
      if (q.Status !== 'ACTIVE') return false;
      if (isTeacher) {
        if (!assignedSubjectIdsForTeacher.has(q.SubjectID)) return false;
        if (q.CreatedByUserID !== activeUser.UserID) return false;
      }
      if (q.SubjectID !== importSourceSubjectId) return false;
      const m = q.ExamMonth || 'វិច្ឆិកា';
      if (importSourceMonth !== 'ALL' && m !== importSourceMonth) return false;
      return true;
    });
  }, [
    localQuestions,
    isTeacher,
    assignedSubjectIdsForTeacher,
    activeUser.UserID,
    importSourceSubjectId,
    importSourceMonth,
  ]);

  const handleOpenImportModal = () => {
    const defaultSub =
      selectedSubjectId !== 'ALL'
        ? selectedSubjectId
        : isTeacher
        ? Array.from(assignedSubjectIdsForTeacher)[0] || 'SUB-ICT'
        : 'SUB-ICT';

    setImportSourceSubjectId(defaultSub);
    setImportSourceMonth('វិច្ឆិកា');
    setImportDestMonth('ធ្នូ');
    setImportDestExamId('NONE');
    setBulkTargetSubjectId(defaultSub);
    setBulkTargetMonth(selectedMonthTab !== 'ALL' ? selectedMonthTab : 'វិច្ឆិកា');

    const initialMatches = localQuestions
      .filter(
        (q) =>
          q.Status === 'ACTIVE' &&
          q.SubjectID === defaultSub &&
          (q.ExamMonth || 'វិច្ឆិកា') === 'វិច្ឆិកា' &&
          (!isTeacher || q.CreatedByUserID === activeUser.UserID)
      )
      .map((q) => q.QuestionID);
    setImportCheckedIds(initialMatches);
    setIsImportModalOpen(true);
  };

  const handleExecuteCrossMonthImport = () => {
    if (importCheckedIds.length === 0) {
      setToastBanner({
        tone: 'warning',
        title: 'សូមជ្រើសរើសយ៉ាងហោចណាស់ ១ សំណួរ',
        description: 'សូមធីកសំណួរដែលអ្នកចង់ទាញយក។',
      });
      return;
    }

    const now = new Date().toISOString();
    const chosen = localQuestions.filter((q) => importCheckedIds.includes(q.QuestionID));
    const importedClones: QuestionRecord[] = chosen.map((q, idx) => ({
      ...q,
      QuestionID: `QST-${q.SubjectID.replace('SUB-', '')}-IMP-${Date.now()
        .toString()
        .slice(-3)}-${idx + 1}`,
      ExamMonth: importDestMonth,
      TargetMonth: importDestMonth,
      CreatedByUserID: activeUser.UserID,
      UpdatedByUserID: activeUser.UserID,
      CreatedAt: now,
      UpdatedAt: now,
    }));

    setLocalQuestions((prev) => [...importedClones, ...prev]);

    if (setDb) {
      setDb((prev) => {
        const nextExams =
          importDestExamId !== 'NONE'
            ? prev.Exams.map((ex) =>
                ex.ExamID === importDestExamId
                  ? {
                      ...ex,
                      QuestionIDs: Array.from(
                        new Set([
                          ...(ex.QuestionIDs || []),
                          ...importedClones.map((c) => c.QuestionID),
                        ])
                      ),
                      UpdatedAt: now,
                    }
                  : ex
              )
            : prev.Exams;

        return {
          ...prev,
          Questions: [...importedClones, ...prev.Questions],
          Exams: nextExams,
        };
      });
    }

    setSelectedSubjectId(importSourceSubjectId);
    setSelectedMonthTab(importDestMonth);
    setIsImportModalOpen(false);

    setToastBanner({
      tone: 'success',
      title: `ទាញយកសំណួរជោគជ័យ (${importedClones.length} សំណួរ)`,
      description: `បានទាញយកសំណួរពី ${formatMonthBadgeLabel(
        importSourceMonth === 'ALL' ? 'ទាំងអស់' : importSourceMonth
      )} មកដាក់ក្នុង ${formatMonthBadgeLabel(importDestMonth)} រួចរាល់។`,
    });
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBulkRawText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteBulkTextImport = () => {
    const raw = bulkRawText.trim();
    if (!raw) return;

    const now = new Date().toISOString();
    const createdBatch: QuestionRecord[] = [];

    // Support JSON array or line-by-line pipe/CSV format
    try {
      if (raw.startsWith('[')) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item, idx) => {
            createdBatch.push({
              QuestionID: `QST-${bulkTargetSubjectId.replace('SUB-', '')}-BLK-${Date.now()
                .toString()
                .slice(-3)}-${idx + 1}`,
              SubjectID: bulkTargetSubjectId,
              QuestionText: String(item.QuestionText || item.question || `សំណួរទី ${idx + 1}`),
              QuestionType: (item.QuestionType as QuestionType) || 'MCQ',
              OptionsJSON: JSON.stringify(
                item.options || [
                  'ក. ជម្រើសទី ១',
                  'ខ. ជម្រើសទី ២',
                  'គ. ជម្រើសទី ៣',
                  'ឃ. ជម្រើសទី ៤',
                ]
              ),
              CorrectAnswerJSON: JSON.stringify({
                answerIndex: Number(item.answerIndex ?? 0),
              }),
              Points: Number(item.Points || item.points || 10),
              DifficultyLevel: 'MEDIUM',
              ExamMonth: bulkTargetMonth,
              TargetMonth: bulkTargetMonth,
              ClassName: bulkTargetClassName,
              GradeLevel: bulkTargetClassName.replace(/[A-Z]/g, '') || '12',
              ImageFileID: '',
              CreatedByUserID: activeUser.UserID,
              UpdatedByUserID: activeUser.UserID,
              Status: 'ACTIVE',
              CreatedAt: now,
              UpdatedAt: now,
            });
          });
        }
      }
    } catch {
      // Fallback to line-by-line parser below
    }

    if (createdBatch.length === 0) {
      const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      lines.forEach((line, idx) => {
        const parts = line.includes('|') ? line.split('|') : line.split(',');
        const qText = (parts[0] || '').trim();
        if (!qText) return;
        const opt1 = (parts[1] || 'ក. ជម្រើសទី ១').trim();
        const opt2 = (parts[2] || 'ខ. ជម្រើសទី ២').trim();
        const opt3 = (parts[3] || 'គ. ជម្រើសទី ៣').trim();
        const opt4 = (parts[4] || 'ឃ. ជម្រើសទី ៤').trim();
        const correctIdx = Math.min(3, Math.max(0, Number((parts[5] || '0').trim()) || 0));
        const pts = Math.max(1, Number((parts[6] || '10').trim()) || 10);

        createdBatch.push({
          QuestionID: `QST-${bulkTargetSubjectId.replace('SUB-', '')}-BLK-${Date.now()
            .toString()
            .slice(-3)}-${idx + 1}`,
          SubjectID: bulkTargetSubjectId,
          QuestionText: qText,
          QuestionType: 'MCQ',
          OptionsJSON: JSON.stringify([opt1, opt2, opt3, opt4]),
          CorrectAnswerJSON: JSON.stringify({ answerIndex: correctIdx }),
          Points: pts,
          DifficultyLevel: 'MEDIUM',
          ExamMonth: bulkTargetMonth,
          TargetMonth: bulkTargetMonth,
          ClassName: bulkTargetClassName,
          GradeLevel: bulkTargetClassName.replace(/[A-Z]/g, '') || '12',
          ImageFileID: '',
          CreatedByUserID: activeUser.UserID,
          UpdatedByUserID: activeUser.UserID,
          Status: 'ACTIVE',
          CreatedAt: now,
          UpdatedAt: now,
        });
      });
    }

    if (createdBatch.length === 0) return;

    setLocalQuestions((prev) => [...createdBatch, ...prev]);
    if (setDb) {
      setDb((prev) => ({
        ...prev,
        Questions: [...createdBatch, ...prev.Questions],
      }));
    }

    setSelectedSubjectId(bulkTargetSubjectId);
    setSelectedMonthTab(bulkTargetMonth);
    setIsImportModalOpen(false);

    setToastBanner({
      tone: 'success',
      title: `នាំចូលសំណួរចំនួន ${createdBatch.length} ដោយជោគជ័យ!`,
      description: `សំណួរទាំងអស់ត្រូវបានបញ្ចូលទៅក្នុង ${formatMonthBadgeLabel(
        bulkTargetMonth
      )} (${bulkTargetSubjectId})។`,
    });
  };

  // Open Add / Edit Subject Modal (Super Admin / Admin)
  const handleOpenSubjectModal = (sub?: SubjectRecord) => {
    if (!isSuperOrAdmin) return;
    if (sub) {
      setEditingSubject(sub);
      setSubFormCode(sub.SubjectCode);
      setSubFormNameKh(sub.SubjectNameKh);
      setSubFormNameEn(sub.SubjectNameEn);
      setSubFormGrade(String(sub.GradeLevel));
      setSubFormMaxScore(String(sub.MaximumScore));
      setSubFormCoeff(String(sub.Coefficient));
    } else {
      setEditingSubject(null);
      setSubFormCode('CHEM-12');
      setSubFormNameKh('គីមីវិទ្យា');
      setSubFormNameEn('Chemistry');
      setSubFormGrade('12');
      setSubFormMaxScore('75');
      setSubFormCoeff('1.5');
    }
    setIsSubjectModalOpen(true);
  };

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperOrAdmin || !subFormNameKh.trim()) return;
    const now = new Date().toISOString();

    if (editingSubject) {
      const updater = (s: SubjectRecord): SubjectRecord =>
        s.SubjectID === editingSubject.SubjectID
          ? {
              ...s,
              SubjectCode: subFormCode.trim().toUpperCase(),
              SubjectNameKh: subFormNameKh.trim(),
              SubjectNameEn: subFormNameEn.trim(),
              GradeLevel: subFormGrade as SubjectRecord['GradeLevel'],
              MaximumScore: Math.max(10, Number(subFormMaxScore) || 50),
              Coefficient: Math.max(0.5, Number(subFormCoeff) || 1),
            }
          : s;

      setLocalSubjects((prev) => prev.map(updater));
      if (setDb) {
        setDb((prev) => ({
          ...prev,
          Subjects: prev.Subjects.map(updater),
        }));
      }

      setToastBanner({
        tone: 'success',
        title: 'បានកែប្រែព័ត៌មានមុខវិជ្ជា',
        description: `មុខវិជ្ជា ${subFormNameKh} ត្រូវបានធ្វើបច្ចុប្បន្នភាព។`,
      });
    } else {
      const newSubId = `SUB-${subFormCode.split('-')[0].toUpperCase() || 'NEW'}-${
        localSubjects.length + 1
      }`;
      const createdSub: SubjectRecord = {
        SubjectID: newSubId,
        SubjectCode: subFormCode.trim().toUpperCase(),
        SubjectNameKh: subFormNameKh.trim(),
        SubjectNameEn: subFormNameEn.trim() || subFormNameKh.trim(),
        GradeLevel: subFormGrade as SubjectRecord['GradeLevel'],
        MaximumScore: Math.max(10, Number(subFormMaxScore) || 50),
        Coefficient: Math.max(0.5, Number(subFormCoeff) || 1),
        Status: 'ACTIVE',
        CreatedAt: now,
      };

      setLocalSubjects((prev) => [...prev, createdSub]);
      if (setDb) {
        setDb((prev) => ({
          ...prev,
          Subjects: [...prev.Subjects, createdSub],
        }));
      }

      setSelectedSubjectId(newSubId);
      setToastBanner({
        tone: 'success',
        title: 'បានបន្ថែមមុខវិជ្ជាថ្មី (+)',
        description: `មុខវិជ្ជា ${createdSub.SubjectNameKh} (${createdSub.SubjectCode}) ត្រូវបានបង្កើត។`,
      });
    }

    setIsSubjectModalOpen(false);
  };

  const handleDeleteSubject = (sub: SubjectRecord) => {
    if (!isSuperOrAdmin) return;
    setLocalSubjects((prev) =>
      prev.map((s) =>
        s.SubjectID === sub.SubjectID ? { ...s, Status: 'INACTIVE' as const } : s
      )
    );
    if (setDb) {
      setDb((prev) => ({
        ...prev,
        Subjects: prev.Subjects.map((s) =>
          s.SubjectID === sub.SubjectID ? { ...s, Status: 'INACTIVE' as const } : s
        ),
      }));
    }
    setSelectedSubjectId('ALL');
    setIsSubjectModalOpen(false);
    setToastBanner({
      tone: 'info',
      title: 'បានលុបមុខវិជ្ជា',
      description: `មុខវិជ្ជា ${sub.SubjectNameKh} ត្រូវបានផ្លាស់ប្តូរទៅជា INACTIVE។`,
    });
  };

  // Assign Teacher Submit (Super Admin / Admin)
  const handleAssignTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperOrAdmin) return;
    const now = new Date().toISOString();
    const newAsn: TeacherSubjectAssignmentRecord = {
      AssignmentID: `ASN-2526-${String(localAssignments.length + 1).padStart(2, '0')}`,
      TeacherID: assignTeacherId,
      SubjectID: assignSubjectId,
      ClassID: assignClassId,
      AcademicYearID: 'AY-2025-2026',
      AssignedByUserID: activeUser.UserID,
      AssignedAt: now,
      Status: 'ACTIVE',
    };

    setLocalAssignments((prev) => [newAsn, ...prev]);
    if (setDb) {
      setDb((prev) => ({
        ...prev,
        TeacherSubjectAssignments: [newAsn, ...prev.TeacherSubjectAssignments],
      }));
    }

    const teacherObj = db.Users.find((u) => u.UserID === assignTeacherId);
    const subObj = localSubjects.find((s) => s.SubjectID === assignSubjectId);

    setToastBanner({
      tone: 'success',
      title: 'បានចាត់តាំងគ្រូទទួលបន្ទុកមុខវិជ្ជាជោគជ័យ',
      description: `បានចាត់តាំង ${teacherObj?.FullNameKh} ឱ្យទទួលបន្ទុកមុខវិជ្ជា ${subObj?.SubjectNameKh}។`,
    });
  };

  const handleRevokeAssignment = (assignmentId: string) => {
    if (!isSuperOrAdmin) return;
    setLocalAssignments((prev) => prev.filter((a) => a.AssignmentID !== assignmentId));
    if (setDb) {
      setDb((prev) => ({
        ...prev,
        TeacherSubjectAssignments: prev.TeacherSubjectAssignments.filter(
          (a) => a.AssignmentID !== assignmentId
        ),
      }));
    }
    setToastBanner({
      tone: 'info',
      title: 'បានដកហូតការចាត់តាំងគ្រូ',
      description: `ការចាត់តាំង ${assignmentId} ត្រូវបានលុប។`,
    });
  };

  // Role Context Subtitle
  const roleContextSubtitle = isSuperOrAdmin
    ? 'គ្រប់គ្រងមុខវិជ្ជាទាំងអស់ ការចាត់តាំងគ្រូ និងឃ្លាំងសំណួររួមតាមខែ'
    : isTeacher
    ? 'មុខវិជ្ជាដែលអ្នកទទួលបន្ទុក និងឃ្លាំងសំណួរផ្ទាល់ខ្លួនរបស់អ្នកតាមខែ'
    : 'មុខវិជ្ជាសិក្សា និងសំណួរស្វ័យសិក្សាប្រចាំខែ និងឆមាស';

  const canCreateNewQuestion =
    isSuperOrAdmin || (isTeacher && assignedSubjectIdsForTeacher.size > 0);

  return (
    <div className="space-y-6">
      {toastBanner && (
        <Toast
          tone={toastBanner.tone}
          title={toastBanner.title}
          description={toastBanner.description}
          onDismiss={() => setToastBanner(null)}
        />
      )}

      {/* ===================================================================== */}
      {/* A. TOP ACTION & ROLE CONTEXT BAR                                      */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs mb-6 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        {/* Left: Page Title & Role Context Subtitle */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 font-khmer-moul">
                មុខវិជ្ជា និងឃ្លាំងសំណួរ
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold font-mono-tabular">
                {activeRole?.RoleName}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-khmer-body mt-0.5">
              {roleContextSubtitle}
            </p>
          </div>
        </div>

        {/* Right Controls: Grade/Class Filter Pill + Role Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Grade / Class Filter Pills */}
          <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/70">
            {[
              { id: 'ALL' as GradeFilterOption, label: 'ទាំងអស់' },
              { id: 'GRADE_7_9' as GradeFilterOption, label: 'ថ្នាក់ទី 7–9' },
              { id: 'GRADE_10_12' as GradeFilterOption, label: 'ថ្នាក់ទី 10–12' },
              { id: 'CLASS_12C' as GradeFilterOption, label: '12C' },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setGradeFilter(pill.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-khmer-body transition-colors cursor-pointer ${
                  gradeFilter === pill.id
                    ? 'bg-white text-indigo-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Super Admin / Admin Controls */}
          {isSuperOrAdmin && (
            <>
              <button
                type="button"
                onClick={() => handleOpenSubjectModal()}
                aria-label="+ បន្ថែមមុខវិជ្ជាថ្មី (Add Subject)"
                title="បន្ថែមមុខវិជ្ជាថ្មី"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold font-khmer-body shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>បន្ថែមមុខវិជ្ជា</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAssignTeacherModalOpen(true)}
                aria-label="ចាត់តាំងគ្រូ (Assign Teacher)"
                title="ចាត់តាំងគ្រូបង្រៀន"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold font-khmer-body shadow-2xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                <span>ចាត់តាំងគ្រូ</span>
              </button>
            </>
          )}

          {/* Import Questions across Months / CSV Button */}
          {canCreateNewQuestion && (
            <button
              type="button"
              onClick={handleOpenImportModal}
              aria-label="នាំចូលសំណួរ (Import Questions)"
              title="នាំចូលសំណួរ"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 text-xs font-bold font-khmer-body shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>នាំចូលសំណួរ</span>
            </button>
          )}

          {/* Primary Indigo Button: បង្កើតសំណួរថ្មី (New Question) */}
          {canCreateNewQuestion && (
            <button
              type="button"
              onClick={handleOpenCreateQuestionModal}
              aria-label="+ បង្កើតសំណួរថ្មី (New Question)"
              title="បង្កើតសំណួរថ្មី"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>បង្កើតសំណួរថ្មី</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2-PANE MASTER-DETAIL WORKSPACE                                        */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* ================================================================= */}
        {/* B. LEFT PANE: SUBJECT DIRECTORY CARDS                             */}
        {/* ================================================================= */}
        <div
          aria-label="Subject Directory Cards"
          className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-3"
        >
          {/* All Subjects Summary Card (Visible to Super Admin, Admin & Student) */}
          {(isSuperOrAdmin || isStudent) && (
            <button
              type="button"
              onClick={() => setSelectedSubjectId('ALL')}
              className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedSubjectId === 'ALL'
                  ? 'bg-white border-indigo-600 ring-2 ring-indigo-600/15 shadow-xs'
                  : 'bg-white border-slate-200/80 hover:border-indigo-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-slate-900 font-khmer-body">
                      មុខវិជ្ជាទាំងអស់
                    </div>
                    <div className="text-[11px] text-slate-500 font-khmer-body">
                      {directorySubjects.length} មុខវិជ្ជា •{' '}
                      {localQuestions.filter((q) => q.Status === 'ACTIVE').length} សំណួរ
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-mono-tabular text-xs font-extrabold">
                  ALL
                </span>
              </div>
            </button>
          )}

          {/* Individual Subject Folder Cards */}
          {directorySubjects.map((sub) => {
            const theme = getSubjectVisualTheme(sub.SubjectID);
            const SubIcon = theme.icon;
            const isSelected = selectedSubjectId === sub.SubjectID;

            const isTeacherAuthorizedForSub =
              isSuperOrAdmin ||
              isStudent ||
              (isTeacher && assignedSubjectIdsForTeacher.has(sub.SubjectID));

            const subAssignment = localAssignments.find(
              (a) => a.SubjectID === sub.SubjectID && a.Status === 'ACTIVE'
            );
            const assignedTeacher = db.Users.find(
              (u) => u.UserID === subAssignment?.TeacherID
            );

            const questionCountForSub = localQuestions.filter(
              (q) =>
                q.SubjectID === sub.SubjectID &&
                q.Status === 'ACTIVE' &&
                (!isTeacher || q.CreatedByUserID === activeUser.UserID)
            ).length;

            return (
              <div
                key={sub.SubjectID}
                onClick={() => {
                  if (isTeacher && !isTeacherAuthorizedForSub) {
                    setToastBanner({
                      tone: 'danger',
                      title: '🔒 គ្មានសិទ្ធិចូលប្រើមុខវិជ្ជានេះទេ',
                      description: `អ្នកគ្រូ/លោកគ្រូ ${activeUser.FullNameKh} អាចចូលប្រើបានតែមុខវិជ្ជាដែលបានចាត់តាំងប៉ុណ្ណោះ។`,
                    });
                    return;
                  }
                  setSelectedSubjectId(sub.SubjectID);
                }}
                className={`rounded-2xl border p-4 transition-all ${
                  !isTeacherAuthorizedForSub
                    ? 'bg-slate-100/80 border-slate-200/70 opacity-75 cursor-not-allowed'
                    : isSelected
                    ? `bg-white ${theme.ringActive} shadow-sm cursor-pointer`
                    : 'bg-white border-slate-200/80 hover:border-indigo-300 shadow-2xs cursor-pointer'
                }`}
              >
                {/* Top Row: Icon + Subject Name + SubjectCode + Quick Settings (⋮) */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl ${theme.badgeBg} flex items-center justify-center shadow-2xs shrink-0`}
                    >
                      <SubIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-extrabold text-slate-900 font-khmer-body truncate">
                          {sub.SubjectNameKh}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-mono-tabular text-[10px] font-bold">
                          {sub.SubjectCode}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {sub.SubjectNameEn}
                      </p>
                    </div>
                  </div>

                  {isSuperOrAdmin && (
                    <button
                      type="button"
                      title="កែប្រែមុខវិជ្ជា (Edit Subject)"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSubjectModal(sub);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer shrink-0"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Role Authorization Badge for Teacher */}
                {isTeacher && (
                  <div className="mt-2.5">
                    {isTeacherAuthorizedForSub ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold font-khmer-body">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>មានសិទ្ធិគ្រប់គ្រង</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-600 text-[10px] font-bold font-khmer-body">
                        <Lock className="w-3 h-3" />
                        <span>គ្មានសិទ្ធិចូលប្រើ</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Key Metadata Pills: ពិន្ទុអតិបរមា, មេគុណ, ចំនួនសំណួរ */}
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold font-khmer-body">
                    ពិន្ទុអតិបរមា: {sub.MaximumScore}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold font-khmer-body">
                    មេគុណ: {sub.Coefficient}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold font-khmer-body ${theme.softBg}`}
                  >
                    ចំនួនសំណួរ: {questionCountForSub} សំណួរ
                  </span>
                </div>

                {/* Assigned Teacher Avatar & Name */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-600 font-khmer-body">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={HONOR_PORTRAIT_URLS['DRV-PHOTO-RANK2']}
                      alt={assignedTeacher?.FullNameKh || 'គ្រូបង្រៀន'}
                      className="w-5 h-5 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                    <span className="truncate">
                      គ្រូទទួលបន្ទុក:{' '}
                      <strong className="text-slate-900">
                        {assignedTeacher?.FullNameKh || 'គណៈគ្រប់គ្រងសាលា'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ================================================================= */}
        {/* C. RIGHT PANE: QUESTION BANK EXPLORER                             */}
        {/* ================================================================= */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-4">
          {/* 1. HORIZONTAL MONTH SELECTOR BAR (PILL TABS) & SUMMARY HEADER */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 font-khmer-body">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>ជ្រើសរើសខែប្រឡង ឬឆមាស៖</span>
              </div>
              {selectedMonthTab !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedMonthTab('ALL')}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 font-khmer-body cursor-pointer"
                >
                  បង្ហាញគ្រប់ខែទាំងអស់
                </button>
              )}
            </div>

            {/* Horizontal Scrollable Pill Tabs */}
            <div
              role="tablist"
              aria-label="Month Filter Bar"
              className="flex items-center gap-2 overflow-x-auto pb-1"
            >
              {ACADEMIC_MONTH_TABS.map((mTab) => {
                const isSelected = selectedMonthTab === mTab.id;
                const count = monthQuestionCounts[mTab.id] || 0;
                return (
                  <button
                    key={mTab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedMonthTab(mTab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold font-khmer-body whitespace-nowrap inline-flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                    }`}
                  >
                    <span>{mTab.label}</span>
                    {count > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono-tabular font-extrabold ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Dynamic Month Summary Header & "Select All in Month" Checkbox */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs sm:text-sm font-bold text-slate-800 font-khmer-body">
                {selectedMonthTab === 'ALL'
                  ? `សំណួរទាំងអស់ក្នុងឃ្លាំង • ចំនួន ${filteredQuestions.length} សំណួរ (ពិន្ទុសរុប: ${totalFilteredPoints} ពិន្ទុ)`
                  : `សំណួរប្រឡងប្រចាំ${formatMonthBadgeLabel(
                      selectedMonthTab
                    )} • ចំនួន ${filteredQuestions.length} សំណួរ (ពិន្ទុសរុប: ${totalFilteredPoints} ពិន្ទុ)`}
              </div>

              {!isStudent && filteredQuestions.length > 0 && (
                <label className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/70 px-3 py-1.5 rounded-xl border border-indigo-200/80 cursor-pointer select-none font-khmer-body">
                  <input
                    type="checkbox"
                    checked={areAllFilteredSelected}
                    onChange={handleToggleSelectAllInView}
                    className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>ជ្រើសរើសទាំងអស់ក្នុងខែនេះ</span>
                </label>
              )}
            </div>
          </div>

          {/* 1B. REUSABLE MONTHLY QUESTION PACKAGES (កញ្ចប់សំណួរតាមខែនីមួយៗសម្រាប់ប្រើជាមួយសិស្សថ្មី) */}
          <div className="bg-white rounded-2xl border border-indigo-200/80 p-4 shadow-2xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-khmer-moul">
                      កញ្ចប់សំណួរប្រចាំខែ
                    </h4>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-khmer-body">
                      ប្រើឡើងវិញសម្រាប់សិស្សថ្មី
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-khmer-body mt-0.5">
                    កំណត់កញ្ចប់សំណួរតាមខែដាក់ឱ្យសិស្សថ្មី ឬថ្នាក់ថ្មីប្រឡងបានភ្លាមៗ។
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowMonthlyPackagesGrid((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
              >
                {showMonthlyPackagesGrid ? 'លាក់កញ្ចប់សំណួរ' : 'បង្ហាញកញ្ចប់សំណួរ'}
              </button>
            </div>

            {showMonthlyPackagesGrid && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-1">
                {monthlyQuestionPackages.map((pkg) => {
                  const isActiveMonth = selectedMonthTab === pkg.monthId;
                  const hasQuestions = pkg.questionCount > 0;
                  return (
                    <div
                      key={pkg.monthId}
                      className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-all ${
                        isActiveMonth
                          ? 'bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/15'
                          : hasQuestions
                          ? 'bg-slate-50/60 hover:bg-white border-slate-200/90 hover:border-indigo-300'
                          : 'bg-slate-50/40 border-dashed border-slate-200'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold font-khmer-body">
                            <Layers className="w-3 h-3" />
                            <span>កញ្ចប់{pkg.monthLabel}</span>
                          </span>
                          <span className="text-[10px] font-mono-tabular font-bold text-slate-400">
                            {pkg.packageCode}
                          </span>
                        </div>

                        <div className="text-xs font-extrabold text-slate-900 font-khmer-body leading-snug">
                          {pkg.packageTitle}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-khmer-body">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              hasQuestions
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {pkg.questionCount} សំណួរ
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-bold">
                            {pkg.totalPoints} ពិន្ទុ
                          </span>
                          {hasQuestions && (
                            <span className="text-[10px] text-slate-500 font-mono-tabular">
                              MCQ:{pkg.mcqCount} • T/F:{pkg.tfCount} • សរសេរ:{pkg.writtenCount}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-slate-200/70 flex flex-col gap-1.5">
                        {!isStudent && hasQuestions ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDeployMonthlyPackageToNewStudents(pkg)}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold font-khmer-body shadow-2xs transition-colors cursor-pointer"
                            >
                              <FilePlus2 className="w-3.5 h-3.5 shrink-0" />
                              <span>ដាក់ប្រឡងសិស្សថ្មី / ថ្នាក់ថ្មី</span>
                            </button>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedMonthTab(pkg.monthId)}
                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold font-khmer-body transition-colors cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>មើលកញ្ចប់</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCloneMonthlyPackage(pkg)}
                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-bold font-khmer-body transition-colors cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                                <span>ចម្លងទុក</span>
                              </button>
                            </div>
                          </>
                        ) : !isStudent && !hasQuestions ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMonthTab(pkg.monthId);
                              handleOpenCreateQuestionModal();
                            }}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 text-[11px] font-bold font-khmer-body transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ បញ្ចូលសំណួរក្នុងកញ្ចប់{pkg.monthLabel}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedMonthTab(pkg.monthId)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold font-khmer-body transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>បើកមើលកញ្ចប់សំណួរ ({pkg.questionCount})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. BATCH ACTION BAR (Appears when 1+ questions are checked) */}
          {!isStudent && selectedQuestionIds.length > 0 && (
            <div className="bg-[#14171F] text-white rounded-2xl p-4 shadow-lg border border-indigo-500/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-mono-tabular text-xs font-extrabold">
                  {selectedQuestionIds.length} សំណួរបានជ្រើសរើស
                </span>
                <span className="text-xs text-slate-300 font-khmer-body">
                  អ្នកអាចបង្កើតវិញ្ញាសាប្រឡងថ្មី ឬចម្លងសំណួរទាំងនេះទៅខែផ្សេងបានភ្លាមៗ
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenCreateQuizFromSelected}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold font-khmer-body shadow-xs transition-colors cursor-pointer"
                >
                  <FilePlus2 className="w-4 h-4" />
                  <span>បង្កើតវិញ្ញាសាប្រឡង (Create Quiz from Selected)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCopyMonthModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-khmer-body shadow-xs transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>ចម្លងទៅខែផ្សេង (Copy/Import to Another Month)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedQuestionIds([])}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold font-khmer-body cursor-pointer"
                >
                  បោះបង់ការជ្រើសរើស
                </button>
              </div>
            </div>
          )}

          {/* 3. Search & Sub-Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ស្វែងរកសំណួរក្នុងមុខវិជ្ជានេះ..."
                  aria-label="ស្វែងរកសំណួរក្នុងមុខវិជ្ជានេះ"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs sm:text-sm font-khmer-body focus:outline-none focus:border-indigo-600"
                />
              </div>

              {/* Difficulty Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'ALL' as DifficultyFilterOption, label: 'គ្រប់កម្រិត' },
                  { id: 'EASY' as DifficultyFilterOption, label: 'ងាយស្រួល (Easy)' },
                  { id: 'MEDIUM' as DifficultyFilterOption, label: 'មធ្យម (Medium)' },
                  { id: 'HARD' as DifficultyFilterOption, label: 'ពិបាក (Hard)' },
                ].map((diff) => (
                  <button
                    key={diff.id}
                    type="button"
                    onClick={() => setDifficultyFilter(diff.id)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold font-khmer-body border transition-colors cursor-pointer ${
                      difficultyFilter === diff.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {diff.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Pills by Question Type */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL' as const, label: 'ទាំងអស់ (All)' },
                  { id: 'MCQ' as const, label: 'ជ្រើសរើសចម្លើយ (MCQ)' },
                  { id: 'TRUE_FALSE' as const, label: 'ពិត/មិនពិត (True/False)' },
                  { id: 'SHORT_ANSWER' as const, label: 'ចម្លើយខ្លី (Short Answer)' },
                  { id: 'ESSAY' as const, label: 'សំណួរសរសេរ (Essay)' },
                ].map((typePill) => (
                  <button
                    key={typePill.id}
                    type="button"
                    onClick={() => setQuestionTypeFilter(typePill.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-khmer-body transition-colors cursor-pointer ${
                      questionTypeFilter === typePill.id
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`}
                  >
                    {typePill.label}
                  </button>
                ))}
              </div>

              <span className="text-xs font-bold text-slate-500 font-khmer-body">
                បង្ហាញ {filteredQuestions.length} សំណួរ
              </span>
            </div>
          </div>

          {/* 4. Clean Question Cards Stack (space-y-4) */}
          {filteredQuestions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
              <FolderOpen className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="text-base font-bold text-slate-800 font-khmer-body">
                មិនមានសំណួរសម្រាប់ {selectedMonthTab === 'ALL' ? 'លក្ខខណ្ឌនេះ' : formatMonthBadgeLabel(selectedMonthTab)} នោះទេ
              </div>
              <p className="text-xs text-slate-500 font-khmer-body max-w-md mx-auto">
                អ្នកអាចចុចប៊ូតុង «+ បង្កើតសំណួរថ្មី» ឬចុច «នាំចូលសំណួរ (Import Questions)» ដើម្បីទាញយកសំណួរពីខែផ្សេងមកប្រើប្រាស់។
              </p>
              {canCreateNewQuestion && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleOpenImportModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold font-khmer-body cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ទាញយកសំណួរពីខែផ្សេង (Import from Another Month)</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuestions.map((q, idx) => {
                const subObj = localSubjects.find((s) => s.SubjectID === q.SubjectID);
                const creatorUser = db.Users.find((u) => u.UserID === q.CreatedByUserID);
                const isChecked = selectedQuestionIds.includes(q.QuestionID);
                const monthLabel = formatMonthBadgeLabel(q.ExamMonth);

                const canManageThisQuestion =
                  !isStudent &&
                  canManageQuestion(
                    activeUser.UserID,
                    q.QuestionID,
                    'EDIT',
                    {
                      users: db.Users,
                      roles: db.Roles,
                      assignments: localAssignments,
                      questions: localQuestions,
                      classes: db.Classes,
                    },
                    q.SubjectID
                  ).allowed;

                let options: string[] = [];
                try {
                  options = JSON.parse(q.OptionsJSON || '[]');
                } catch {
                  options = [];
                }

                let correctAns: {
                  answerIndex?: number;
                  isTrue?: boolean;
                  sampleKeyword?: string;
                  rubric?: string;
                } = {};
                try {
                  correctAns = JSON.parse(q.CorrectAnswerJSON || '{}');
                } catch {
                  correctAns = {};
                }

                const correctIdx =
                  q.QuestionType === 'TRUE_FALSE'
                    ? correctAns.isTrue === false
                      ? 1
                      : 0
                    : correctAns.answerIndex ?? 0;

                const diffBadge =
                  q.DifficultyLevel === 'EASY'
                    ? { label: 'ងាយស្រួល', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                    : q.DifficultyLevel === 'HARD'
                    ? { label: 'ពិបាក', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
                    : { label: 'មធ្យម', cls: 'bg-amber-50 text-amber-800 border-amber-200' };

                const studentSelectedIdx = studentPracticeSelectedOption[q.QuestionID];
                const isStudentChecked = Boolean(studentPracticeCheckedMap[q.QuestionID]);

                return (
                  <div
                    key={q.QuestionID}
                    className={`bg-white rounded-2xl border p-5 transition-all shadow-2xs space-y-4 ${
                      isChecked
                        ? 'border-indigo-600 ring-2 ring-indigo-600/15 bg-indigo-50/15'
                        : 'border-slate-200/80 hover:border-indigo-300'
                    }`}
                  >
                    {/* Card Header: Checkbox, #Number, Month Badge, Type, Difficulty, Points & Action Icons */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {!isStudent && (
                          <input
                            type="checkbox"
                            aria-label={`ជ្រើសរើសសំណួរ ${q.QuestionID}`}
                            checked={isChecked}
                            onChange={() => handleToggleQuestionCheckbox(q.QuestionID)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        )}
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono-tabular text-xs font-extrabold">
                          #{idx + 1}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold font-khmer-body inline-flex items-center gap-1">
                          <span>📅 {monthLabel}</span>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono-tabular text-xs font-bold">
                          {q.QuestionType}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-lg border text-xs font-bold font-khmer-body ${diffBadge.cls}`}
                        >
                          {diffBadge.label}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold font-khmer-body">
                          {q.Points} ពិន្ទុ
                        </span>
                        {q.ClassName && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold font-khmer-body">
                            ថ្នាក់ទី {q.ClassName}
                          </span>
                        )}
                      </div>

                      {/* Right Side Actions (Edit, Duplicate, Delete) for Admin or Creator Teacher */}
                      {canManageThisQuestion && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditQuestionModal(q)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>កែប្រែ (Edit)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateQuestion(q)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>ចម្លង</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>លុប</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Question Body */}
                    <div className="text-base font-semibold text-slate-900 font-khmer-body leading-relaxed">
                      {q.QuestionText}
                    </div>

                    {/* Options Grid (2x2 Grid on Desktop, 1 Column on Mobile) */}
                    {(q.QuestionType === 'MCQ' || q.QuestionType === 'TRUE_FALSE') && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {options.map((optText, optIdx) => {
                            const isCorrectOption = correctIdx === optIdx;

                            // For Admin & Authorized Teacher: highlight correct option in soft emerald green
                            if (!isStudent) {
                              return (
                                <div
                                  key={optIdx}
                                  className={`p-3 rounded-xl border text-xs sm:text-sm font-khmer-body flex items-center justify-between gap-2 ${
                                    isCorrectOption
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                                      : 'bg-slate-50/70 border-slate-200/80 text-slate-700'
                                  }`}
                                >
                                  <span>{optText}</span>
                                  {isCorrectOption && (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                                      ✓ ចម្លើយត្រឹមត្រូវ
                                    </span>
                                  )}
                                </div>
                              );
                            }

                            // For Student (Practice / Study Mode): hide answer initially, allow clicking to test
                            const isStudentPicked = studentSelectedIdx === optIdx;
                            let studentPillClass =
                              'bg-white border-slate-200 hover:bg-slate-50 text-slate-800';
                            if (isStudentPicked && !isStudentChecked) {
                              studentPillClass =
                                'bg-indigo-50 border-indigo-600 text-indigo-900 font-semibold';
                            } else if (isStudentChecked) {
                              if (isCorrectOption) {
                                studentPillClass =
                                  'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold';
                              } else if (isStudentPicked && !isCorrectOption) {
                                studentPillClass =
                                  'bg-rose-50 border-rose-400 text-rose-900 font-bold';
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() =>
                                  setStudentPracticeSelectedOption((prev) => ({
                                    ...prev,
                                    [q.QuestionID]: optIdx,
                                  }))
                                }
                                className={`p-3 rounded-xl border text-left text-xs sm:text-sm font-khmer-body flex items-center justify-between gap-2 cursor-pointer transition-all ${studentPillClass}`}
                              >
                                <span>{optText}</span>
                                {isStudentChecked && isCorrectOption && (
                                  <span className="text-[11px] font-bold text-emerald-700">
                                    ✓ ចម្លើយត្រឹមត្រូវ
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Student Practice Check Answer Button */}
                        {isStudent && (
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setStudentPracticeCheckedMap((prev) => ({
                                  ...prev,
                                  [q.QuestionID]: !prev[q.QuestionID],
                                }))
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold font-khmer-body cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>
                                {isStudentChecked
                                  ? 'លាក់ចម្លើយ (Hide Answer)'
                                  : 'បង្ហាញចម្លើយ (Check Answer)'}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Short Answer / Essay Answer Key Display */}
                    {(q.QuestionType === 'SHORT_ANSWER' || q.QuestionType === 'ESSAY') && (
                      <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs font-khmer-body text-emerald-900 flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold">
                            {q.QuestionType === 'SHORT_ANSWER'
                              ? '✓ ចម្លើយគំរូ (Sample Keyword)៖ '
                              : '✓ មូលដ្ឋានកែពិន្ទុ (Grading Rubric)៖ '}
                          </span>
                          <span>
                            {!isStudent || isStudentChecked
                              ? correctAns.sampleKeyword ||
                                correctAns.rubric ||
                                'SHA-256'
                              : 'ចុច «បង្ហាញចម្លើយ» ដើម្បីផ្ទៀងផ្ទាត់ចម្លើយស្វ័យសិក្សា'}
                          </span>
                        </div>

                        {isStudent && (
                          <button
                            type="button"
                            onClick={() =>
                              setStudentPracticeCheckedMap((prev) => ({
                                ...prev,
                                [q.QuestionID]: !prev[q.QuestionID],
                              }))
                            }
                            className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-bold cursor-pointer shrink-0"
                          >
                            {isStudentChecked ? 'លាក់ចម្លើយ' : 'បង្ហាញចម្លើយ (Check Answer)'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Card Footer: Creator Badge, Question ID, Month & Subject Tag */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-khmer-body">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700">
                          បង្កើតដោយ: {creatorUser?.FullNameKh || 'គ្រូបង្រៀន'}
                        </span>
                        <span>•</span>
                        <span className="font-mono-tabular">ID: {q.QuestionID}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                          {subObj?.SubjectNameKh || q.SubjectID}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: CLEAN GOOGLE-FORMS-STYLE CREATE & EDIT QUESTION MODAL        */}
      {/* ===================================================================== */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-label="Google Forms Question Modal"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden my-8"
          >
            <div className="h-2.5 bg-indigo-600 w-full" />

            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 font-khmer-moul">
                    {editingQuestion ? 'កែប្រែសំណួរ (Edit Question)' : '+ បង្កើតសំណួរថ្មី (New Question)'}
                  </h3>
                  <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                    កំណត់មុខវិជ្ជា ខែប្រឡង ខ្លឹមសារសំណួរ និងចម្លើយត្រឹមត្រូវ (Answer Key)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Metadata Grid: Subject, Exam Month, Class, Question Type, Difficulty, Points */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                    មុខវិជ្ជា (Subject)
                  </label>
                  <select
                    aria-label="មុខវិជ្ជាសំណួរ"
                    value={qFormSubjectId}
                    onChange={(e) => setQFormSubjectId(e.target.value)}
                    disabled={isTeacher && assignedSubjectIdsForTeacher.size === 1}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body focus:outline-none focus:border-indigo-600"
                  >
                    {localSubjects
                      .filter(
                        (s) =>
                          isSuperOrAdmin ||
                          assignedSubjectIdsForTeacher.has(s.SubjectID)
                      )
                      .map((s) => (
                        <option key={s.SubjectID} value={s.SubjectID}>
                          {s.SubjectNameKh}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                    ខែប្រឡង / ឆមាស (Month)
                  </label>
                  <select
                    aria-label="ខែប្រឡងនៃសំណួរ"
                    value={qFormMonth}
                    onChange={(e) => setQFormMonth(e.target.value as AcademicQuestionMonth)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body focus:outline-none focus:border-indigo-600"
                  >
                    {ALL_SUPPORTED_QUESTION_MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {formatMonthBadgeLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                    ថ្នាក់ (Class Tag)
                  </label>
                  <select
                    aria-label="ថ្នាក់គោលដៅ"
                    value={qFormClassName}
                    onChange={(e) => setQFormClassName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body focus:outline-none focus:border-indigo-600"
                  >
                    {db.Classes.map((c) => (
                      <option key={c.ClassID} value={c.ClassName}>
                        ថ្នាក់ទី {c.ClassName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                    ប្រភេទសំណួរ (Type)
                  </label>
                  <select
                    aria-label="ប្រភេទសំណួរ"
                    value={qFormType}
                    onChange={(e) => {
                      const next = e.target.value as QuestionType;
                      setQFormType(next);
                      if (next === 'TRUE_FALSE') {
                        setQFormOptions(['ត្រូវ (True)', 'ខុស (False)']);
                        setQFormCorrectIndex(0);
                      } else if (next === 'MCQ' && qFormOptions.length < 4) {
                        setQFormOptions([
                          'ក. ជម្រើសទី ១',
                          'ខ. ជម្រើសទី ២',
                          'គ. ជម្រើសទី ៣',
                          'ឃ. ជម្រើសទី ៤',
                        ]);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body focus:outline-none focus:border-indigo-600"
                  >
                    <option value="MCQ">ជ្រើសរើសចម្លើយ (MCQ)</option>
                    <option value="TRUE_FALSE">ពិត/មិនពិត (True/False)</option>
                    <option value="SHORT_ANSWER">ចម្លើយខ្លី (Short Answer)</option>
                    <option value="ESSAY">សំណួរសរសេរ (Essay)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                    កម្រិតលំបាក (Difficulty)
                  </label>
                  <select
                    aria-label="កម្រិតលំបាក"
                    value={qFormDifficulty}
                    onChange={(e) =>
                      setQFormDifficulty(e.target.value as 'EASY' | 'MEDIUM' | 'HARD')
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body focus:outline-none focus:border-indigo-600"
                  >
                    <option value="EASY">ងាយស្រួល (Easy)</option>
                    <option value="MEDIUM">មធ្យម (Medium)</option>
                    <option value="HARD">ពិបាក (Hard)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                    ពិន្ទុ (Points)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={qFormPoints}
                    onChange={(e) => setQFormPoints(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-extrabold font-mono-tabular focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Question Input Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1.5">
                  ខ្លឹមសារសំណួរ (Question Text) *
                </label>
                <textarea
                  rows={3}
                  value={qFormText}
                  onChange={(e) => setQFormText(e.target.value)}
                  placeholder="វាយបញ្ចូលខ្លឹមសារសំណួរនៅទីនេះ..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-600 focus:outline-none text-sm font-khmer-body"
                />
              </div>

              {/* Interactive Answer Key Selector */}
              {(qFormType === 'MCQ' || qFormType === 'TRUE_FALSE') && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 font-khmer-body">
                      ជម្រើសចម្លើយ និងចម្លើយត្រឹមត្រូវ (ចុចរង្វង់ ✓ ដើម្បីកំណត់ចម្លើយត្រឹមត្រូវ)
                    </label>
                  </div>

                  {qFormOptions.map((opt, idx) => {
                    const isCorrect = qFormCorrectIndex === idx;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setQFormCorrectIndex(idx)}
                          className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 cursor-pointer ${
                            isCorrect
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          {isCorrect && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        <input
                          type="text"
                          value={opt}
                          readOnly={qFormType === 'TRUE_FALSE'}
                          onChange={(e) => {
                            const copy = [...qFormOptions];
                            copy[idx] = e.target.value;
                            setQFormOptions(copy);
                          }}
                          placeholder={`ជម្រើសទី ${idx + 1}`}
                          className="flex-1 bg-transparent text-xs sm:text-sm font-khmer-body focus:outline-none"
                        />

                        {isCorrect && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold font-khmer-body">
                            ✓ ចម្លើយត្រឹមត្រូវ
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(qFormType === 'SHORT_ANSWER' || qFormType === 'ESSAY') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1.5">
                    {qFormType === 'SHORT_ANSWER'
                      ? 'ពាក្យគន្លឹះចម្លើយត្រឹមត្រូវ (Answer Key Keyword)'
                      : 'មូលដ្ឋានកែពិន្ទុ (Grading Rubric)'}
                  </label>
                  <input
                    type="text"
                    value={qFormKeywordOrRubric}
                    onChange={(e) => setQFormKeywordOrRubric(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50/60 text-xs sm:text-sm font-khmer-body focus:outline-none"
                  />
                </div>
              )}

              {/* Footer Buttons: Save Question & Save & Add Another */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 font-khmer-body cursor-pointer"
                >
                  បោះបង់
                </button>

                {!editingQuestion && (
                  <button
                    type="button"
                    onClick={() => handleSaveQuestionFromModal(true)}
                    className="px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold font-khmer-body cursor-pointer"
                  >
                    រក្សាទុក & បង្កើតមួយទៀត (Save & Add Another)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSaveQuestionFromModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body shadow-xs cursor-pointer"
                >
                  រក្សាទុកសំណួរ (Save Question)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: CREATE QUIZ / DEPLOY MONTHLY PACKAGE TO NEW STUDENTS MODAL   */}
      {/* ===================================================================== */}
      {isCreateQuizModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleConfirmCreateQuizFromSelected}
            role="dialog"
            aria-label="Create Quiz from Selected Questions Modal"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden my-8"
          >
            <div className="h-2.5 bg-indigo-600 w-full" />
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-khmer-moul">
                    កំណត់កញ្ចប់សំណួរដាក់ឱ្យសិស្សថ្មីប្រឡង ({selectedQuestionIds.length} សំណួរ)
                  </h3>
                  <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                    ជ្រើសរើសឆ្នាំសិក្សា ខែប្រឡង និងថ្នាក់រៀនរបស់សិស្សថ្មី ដើម្បីដាក់ឱ្យប្រឡងដោយស្វ័យប្រវត្តិ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateQuizModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                  ចំណងជើងវិញ្ញាសាប្រឡង (Exam Package Title) *
                </label>
                <input
                  type="text"
                  required
                  value={quizFormTitle}
                  onChange={(e) => setQuizFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold font-khmer-body focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    ឆ្នាំសិក្សាសិស្សថ្មី (Academic Year)
                  </label>
                  <select
                    aria-label="ឆ្នាំសិក្សាសម្រាប់សិស្សថ្មី"
                    value={quizFormAcademicYear}
                    onChange={(e) => setQuizFormAcademicYear(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold font-khmer-body bg-slate-50"
                  >
                    <option value="២០២៥-២០២៦">ឆ្នាំសិក្សា ២០២៥-២០២៦</option>
                    <option value="២០២៦-២០២៧">ឆ្នាំសិក្សា ២០២៦-២០២៧ (សិស្សថ្មី)</option>
                    <option value="២០២៧-២០២៨">ឆ្នាំសិក្សា ២០២៧-២០២៨ (ជំនាន់ថ្មី)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    កញ្ចប់ខែប្រឡង (Target Month)
                  </label>
                  <select
                    aria-label="ខែប្រឡងគោលដៅសម្រាប់វិញ្ញាសាថ្មី"
                    value={quizFormTargetMonth}
                    onChange={(e) =>
                      setQuizFormTargetMonth(e.target.value as AcademicQuestionMonth)
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold font-khmer-body bg-slate-50"
                  >
                    {ALL_SUPPORTED_QUESTION_MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {formatMonthBadgeLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    រយៈពេលប្រឡង (នាទី)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={240}
                    value={quizFormDuration}
                    onChange={(e) => setQuizFormDuration(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold font-mono-tabular bg-slate-50"
                  />
                </div>
              </div>

              {/* Multi-Class Selection for New Students */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 font-khmer-body">
                    ជ្រើសរើសថ្នាក់រៀនរបស់សិស្សថ្មី (អាចជ្រើសរើសបានច្រើនថ្នាក់ក្នុងពេលតែមួយ)៖
                  </label>
                  <span className="text-[11px] font-bold text-indigo-600 font-khmer-body">
                    បានជ្រើសរើស {quizFormSelectedClassIds.length} ថ្នាក់
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  {db.Classes.map((c) => {
                    const isPicked = quizFormSelectedClassIds.includes(c.ClassID);
                    return (
                      <button
                        key={c.ClassID}
                        type="button"
                        onClick={() => handleToggleQuizTargetClass(c.ClassID)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-khmer-body border transition-all cursor-pointer ${
                          isPicked
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ថ្នាក់ {c.ClassName}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateQuizModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 font-khmer-body cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body cursor-pointer"
                >
                  ដាក់កញ្ចប់សំណួរឱ្យសិស្សប្រឡង (Deploy Package)
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: COPY SELECTED QUESTIONS TO ANOTHER MONTH MODAL               */}
      {/* ===================================================================== */}
      {isCopyMonthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleConfirmCopySelectedToMonth}
            role="dialog"
            aria-label="Copy Questions to Another Month Modal"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden"
          >
            <div className="h-2.5 bg-emerald-600 w-full" />
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 font-khmer-moul">
                  ចម្លងសំណួរទៅខែផ្សេង ({selectedQuestionIds.length} សំណួរ)
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCopyMonthModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1.5">
                  ជ្រើសរើសខែគោលដៅដែលចង់ចម្លងទៅ (Destination Month)៖
                </label>
                <select
                  aria-label="ជ្រើសរើសខែគោលដៅ"
                  value={copyTargetMonth}
                  onChange={(e) => setCopyTargetMonth(e.target.value as AcademicQuestionMonth)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-bold font-khmer-body"
                >
                  {ALL_SUPPORTED_QUESTION_MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthBadgeLabel(m)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCopyMonthModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 font-khmer-body cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-khmer-body cursor-pointer"
                >
                  ចម្លងសំណួរទៅខែថ្មី (Copy to Selected Month)
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 6: 2-TAB IMPORT QUESTIONS MODAL (+ នាំចូលសំណួរ / Import)        */}
      {/* ===================================================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-label="Import Questions Modal"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden my-8"
          >
            <div className="h-2.5 bg-indigo-600 w-full" />
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 font-khmer-moul">
                    នាំចូលសំណួរ និងប្រើប្រាស់ឡើងវិញតាមខែ (Import & Reuse Questions)
                  </h3>
                  <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                    ទាញយកសំណួរពីខែចាស់ៗ (ឧ. ខែវិច្ឆិកា ទៅ ខែធ្នូ/ឆមាសទី១) ឬនាំចូលពីឯកសារ CSV / JSON / Text
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 2 Tabs Switcher */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setImportModalTab('FROM_EXISTING_MONTH')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold font-khmer-body inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    importModalTab === 'FROM_EXISTING_MONTH'
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>ទាញយកពីខែចាស់ៗ (Import from Existing Month/Subject)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportModalTab('BULK_FILE_TEXT')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold font-khmer-body inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    importModalTab === 'BULK_FILE_TEXT'
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>នាំចូលពីឯកសារ CSV / Excel / Text (Bulk Import)</span>
                </button>
              </div>

              {/* TAB 1: IMPORT FROM EXISTING MONTH / SUBJECT */}
              {importModalTab === 'FROM_EXISTING_MONTH' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        ១. ជ្រើសរើសមុខវិជ្ជាប្រភព (Source Subject)
                      </label>
                      <select
                        aria-label="មុខវិជ្ជាប្រភពសម្រាប់ទាញយក"
                        value={importSourceSubjectId}
                        onChange={(e) => {
                          const nextSub = e.target.value;
                          setImportSourceSubjectId(nextSub);
                          const nextMatches = localQuestions
                            .filter(
                              (q) =>
                                q.Status === 'ACTIVE' &&
                                q.SubjectID === nextSub &&
                                (importSourceMonth === 'ALL' ||
                                  (q.ExamMonth || 'វិច្ឆិកា') === importSourceMonth)
                            )
                            .map((q) => q.QuestionID);
                          setImportCheckedIds(nextMatches);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold font-khmer-body"
                      >
                        {localSubjects
                          .filter(
                            (s) =>
                              isSuperOrAdmin ||
                              assignedSubjectIdsForTeacher.has(s.SubjectID)
                          )
                          .map((s) => (
                            <option key={s.SubjectID} value={s.SubjectID}>
                              {s.SubjectNameKh}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        ២. ជ្រើសរើសខែប្រភព (Source Month - ឧ. ខែវិច្ឆិកា)
                      </label>
                      <select
                        aria-label="ខែប្រភពសម្រាប់ទាញយក"
                        value={importSourceMonth}
                        onChange={(e) => {
                          const nextMonth = e.target.value as 'ALL' | AcademicQuestionMonth;
                          setImportSourceMonth(nextMonth);
                          const nextMatches = localQuestions
                            .filter(
                              (q) =>
                                q.Status === 'ACTIVE' &&
                                q.SubjectID === importSourceSubjectId &&
                                (nextMonth === 'ALL' ||
                                  (q.ExamMonth || 'វិច្ឆិកា') === nextMonth)
                            )
                            .map((q) => q.QuestionID);
                          setImportCheckedIds(nextMatches);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold font-khmer-body"
                      >
                        <option value="ALL">គ្រប់ខែទាំងអស់ (All Months)</option>
                        {ALL_SUPPORTED_QUESTION_MONTHS.map((m) => (
                          <option key={m} value={m}>
                            {formatMonthBadgeLabel(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Preview Questions List with Checkboxes */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-700 font-khmer-body">
                        បញ្ជីសំណួរក្នុងខែប្រភព ({importPreviewQuestions.length} សំណួរ)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (importCheckedIds.length === importPreviewQuestions.length) {
                            setImportCheckedIds([]);
                          } else {
                            setImportCheckedIds(importPreviewQuestions.map((q) => q.QuestionID));
                          }
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 font-khmer-body cursor-pointer"
                      >
                        {importCheckedIds.length === importPreviewQuestions.length
                          ? 'ដកការជ្រើសរើសទាំងអស់'
                          : 'ជ្រើសរើសទាំងអស់'}
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                      {importPreviewQuestions.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500 font-khmer-body">
                          មិនមានសំណួរក្នុងខែនេះទេ។ សូមជ្រើសរើសខែផ្សេង (ឧ. ខែវិច្ឆិកា ឬ ខែតុលា)។
                        </div>
                      ) : (
                        importPreviewQuestions.map((q) => {
                          const checked = importCheckedIds.includes(q.QuestionID);
                          return (
                            <label
                              key={q.QuestionID}
                              className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                                checked ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setImportCheckedIds((prev) =>
                                    prev.includes(q.QuestionID)
                                      ? prev.filter((id) => id !== q.QuestionID)
                                      : [...prev, q.QuestionID]
                                  )
                                }
                                className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold font-khmer-body">
                                    📅 {formatMonthBadgeLabel(q.ExamMonth)}
                                  </span>
                                  <span className="text-[10px] font-mono-tabular font-bold text-indigo-600">
                                    {q.QuestionType} • {q.Points} ពិន្ទុ
                                  </span>
                                </div>
                                <div className="text-xs font-semibold text-slate-800 font-khmer-body mt-1 line-clamp-2">
                                  {q.QuestionText}
                                </div>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Destination Month & Optional Target Quiz */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-200/80">
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-950 font-khmer-body mb-1">
                        ៣. ទាញយកទៅដាក់ក្នុងខែគោលដៅ (Destination Month)
                      </label>
                      <select
                        aria-label="ខែគោលដៅសម្រាប់ទាញយក"
                        value={importDestMonth}
                        onChange={(e) =>
                          setImportDestMonth(e.target.value as AcademicQuestionMonth)
                        }
                        className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs font-bold font-khmer-body"
                      >
                        {ALL_SUPPORTED_QUESTION_MONTHS.map((m) => (
                          <option key={m} value={m}>
                            {formatMonthBadgeLabel(m)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-indigo-950 font-khmer-body mb-1">
                        ៤. ភ្ជាប់ទៅវិញ្ញាសាប្រឡង (Optional Target Quiz)
                      </label>
                      <select
                        aria-label="វិញ្ញាសាគោលដៅ"
                        value={importDestExamId}
                        onChange={(e) => setImportDestExamId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs font-bold font-khmer-body"
                      >
                        <option value="NONE">រក្សាទុកក្នុងឃ្លាំងសំណួរខែគោលដៅប៉ុណ្ណោះ</option>
                        {db.Exams.map((ex) => (
                          <option key={ex.ExamID} value={ex.ExamID}>
                            បញ្ចូលទៅ៖ {ex.ExamTitle}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 font-khmer-body cursor-pointer"
                    >
                      បោះបង់
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteCrossMonthImport}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body shadow-xs cursor-pointer"
                    >
                      ទាញយកសំណួរ (Import Selected)
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: BULK CSV / EXCEL / TEXT IMPORT */}
              {importModalTab === 'BULK_FILE_TEXT' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        មុខវិជ្ជាគោលដៅ (Target Subject)
                      </label>
                      <select
                        value={bulkTargetSubjectId}
                        onChange={(e) => setBulkTargetSubjectId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body"
                      >
                        {localSubjects
                          .filter(
                            (s) =>
                              isSuperOrAdmin ||
                              assignedSubjectIdsForTeacher.has(s.SubjectID)
                          )
                          .map((s) => (
                            <option key={s.SubjectID} value={s.SubjectID}>
                              {s.SubjectNameKh}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        ខែប្រឡងគោលដៅ (Target Month)
                      </label>
                      <select
                        value={bulkTargetMonth}
                        onChange={(e) =>
                          setBulkTargetMonth(e.target.value as AcademicQuestionMonth)
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body"
                      >
                        {ALL_SUPPORTED_QUESTION_MONTHS.map((m) => (
                          <option key={m} value={m}>
                            {formatMonthBadgeLabel(m)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1">
                        ថ្នាក់គោលដៅ (Class)
                      </label>
                      <select
                        value={bulkTargetClassName}
                        onChange={(e) => setBulkTargetClassName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body"
                      >
                        {db.Classes.map((c) => (
                          <option key={c.ClassID} value={c.ClassName}>
                            ថ្នាក់ទី {c.ClassName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* File Upload Box */}
                  <div className="p-4 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs font-khmer-body text-slate-700">
                      <Upload className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>បង្ហោះឯកសារ .CSV / .JSON / .TXT ឬបិទភ្ជាប់អត្ថបទសំណួរខាងក្រោម៖</span>
                    </div>
                    <input
                      type="file"
                      accept=".csv,.json,.txt"
                      onChange={handleBulkFileUpload}
                      className="text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 font-khmer-body">
                        ទម្រង់ទិន្នន័យ (សំណួរ | ជម្រើស ក | ជម្រើស ខ | ជម្រើស គ | ជម្រើស ឃ | ចម្លើយត្រឹមត្រូវ 0-3 | ពិន្ទុ)
                      </label>
                    </div>
                    <textarea
                      rows={5}
                      value={bulkRawText}
                      onChange={(e) => setBulkRawText(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-khmer-body focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 font-khmer-body cursor-pointer"
                    >
                      បោះបង់
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteBulkTextImport}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body shadow-xs cursor-pointer"
                    >
                      នាំចូលសំណួរទាំងអស់ (Import Bulk Questions)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: ADD / EDIT SUBJECT MODAL (SUPER_ADMIN & ADMIN)               */}
      {/* ===================================================================== */}
      {isSubjectModalOpen && isSuperOrAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveSubject}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden"
          >
            <div className="h-2 bg-indigo-600 w-full" />
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 font-khmer-moul">
                  {editingSubject ? 'កែប្រែមុខវិជ្ជា (Edit Subject)' : '+ បន្ថែមមុខវិជ្ជាថ្មី (Add Subject)'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    ឈ្មោះមុខវិជ្ជា (ខ្មែរ) *
                  </label>
                  <input
                    type="text"
                    required
                    value={subFormNameKh}
                    onChange={(e) => setSubFormNameKh(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-khmer-body"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    ឈ្មោះមុខវិជ្ជា (English)
                  </label>
                  <input
                    type="text"
                    value={subFormNameEn}
                    onChange={(e) => setSubFormNameEn(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    កូដមុខវិជ្ជា (SubjectCode)
                  </label>
                  <input
                    type="text"
                    required
                    value={subFormCode}
                    onChange={(e) => setSubFormCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    កម្រិតថ្នាក់ (Grade Level)
                  </label>
                  <select
                    value={subFormGrade}
                    onChange={(e) => setSubFormGrade(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-khmer-body"
                  >
                    {['7', '8', '9', '10', '11', '12'].map((g) => (
                      <option key={g} value={g}>
                        ថ្នាក់ទី {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    ពិន្ទុអតិបរមា (MaximumScore)
                  </label>
                  <input
                    type="number"
                    value={subFormMaxScore}
                    onChange={(e) => setSubFormMaxScore(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    មេគុណ (Coefficient)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={subFormCoeff}
                    onChange={(e) => setSubFormCoeff(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono-tabular"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {editingSubject ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteSubject(editingSubject)}
                    className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold font-khmer-body cursor-pointer"
                  >
                    លុបមុខវិជ្ជា
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSubjectModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 font-khmer-body cursor-pointer"
                  >
                    បោះបង់
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body cursor-pointer"
                  >
                    រក្សាទុកមុខវិជ្ជា
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: ASSIGN TEACHER MODAL (SUPER_ADMIN & ADMIN)                   */}
      {/* ===================================================================== */}
      {isAssignTeacherModalOpen && isSuperOrAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
            <div className="h-2 bg-emerald-600 w-full" />
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 font-khmer-moul">
                  ចាត់តាំងគ្រូទទួលបន្ទុកមុខវិជ្ជា (Assign Teacher to Subject)
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAssignTeacherModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAssignTeacherSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    ជ្រើសរើសគ្រូបង្រៀន
                  </label>
                  <select
                    value={assignTeacherId}
                    onChange={(e) => setAssignTeacherId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-khmer-body"
                  >
                    {db.Users.filter((u) => u.RoleID === 'ROL-03').map((t) => (
                      <option key={t.UserID} value={t.UserID}>
                        {t.FullNameKh}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    ជ្រើសរើសមុខវិជ្ជា
                  </label>
                  <select
                    value={assignSubjectId}
                    onChange={(e) => setAssignSubjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-khmer-body"
                  >
                    {localSubjects
                      .filter((s) => s.Status === 'ACTIVE')
                      .map((s) => (
                        <option key={s.SubjectID} value={s.SubjectID}>
                          {s.SubjectNameKh}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    ថ្នាក់រៀន (7A–12C)
                  </label>
                  <select
                    value={assignClassId}
                    onChange={(e) => setAssignClassId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-khmer-body"
                  >
                    {db.Classes.map((c) => (
                      <option key={c.ClassID} value={c.ClassID}>
                        ថ្នាក់ទី {c.ClassName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-khmer-body cursor-pointer"
                  >
                    + ចាត់តាំងគ្រូឥឡូវនេះ
                  </button>
                </div>
              </form>

              {/* Current Assignments List */}
              <div className="border-t border-slate-100 pt-3 space-y-2 max-h-56 overflow-y-auto">
                <div className="text-xs font-bold text-slate-600 font-khmer-body">
                  បញ្ជីការចាត់តាំងបច្ចុប្បន្ន ({localAssignments.length}):
                </div>
                {localAssignments.map((asn) => {
                  const t = db.Users.find((u) => u.UserID === asn.TeacherID);
                  const s = localSubjects.find((sub) => sub.SubjectID === asn.SubjectID);
                  const c = db.Classes.find((cls) => cls.ClassID === asn.ClassID);
                  return (
                    <div
                      key={asn.AssignmentID}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-khmer-body"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{t?.FullNameKh}</span>
                        <span className="mx-1.5 text-slate-400">•</span>
                        <span className="text-indigo-700 font-semibold">{s?.SubjectNameKh}</span>
                        <span className="mx-1.5 text-slate-400">•</span>
                        <span className="text-slate-600">ថ្នាក់ {c?.ClassName || asn.ClassID}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeAssignment(asn.AssignmentID)}
                        className="text-rose-600 hover:text-rose-800 text-[11px] font-bold cursor-pointer"
                      >
                        ដកហូត
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
