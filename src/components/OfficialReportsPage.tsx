import React, { useState, useMemo, useEffect } from 'react';
import { DatabaseState } from '../types/database';
import {
  calculateCompetitionRanking,
  calculateStudentAge,
  canManageStudentScore,
  computeClassRosterSummary,
  computeRankingSummaryStats,
  formatDateKhmerDisplay,
  getUserEffectiveRoles,
  isScoreEntryPeriodLocked,
  RankedStudentEntry,
  setScoreEntryPeriodLock,
  splitRankingRowsTwoColumns,
  toKhmerNumerals,
  upsertStudentSubjectScoreAndRecalculate,
  validateSubjectScoreInput,
} from '../lib/domainRules';
import { HONOR_PORTRAIT_URLS } from '../lib/seedData';
import {
  formatKhmerReportTitle,
  handleGlobalPrint,
} from '../utils/printHelper';
import { Toast } from './ui';
import { SubjectGradesAndRankingsSheet } from './SubjectGradesAndRankingsSheet';
import {
  Printer,
  Award,
  Users,
  FileSpreadsheet,
  Table2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Save,
  Calculator,
  Trophy,
  Search,
  CheckSquare,
  ArrowRightCircle,
  TrendingUp,
  Lock,
  Unlock,
  ShieldCheck,
  History,
} from 'lucide-react';

export type ReportTemplateTab =
  | 'SCORE_ENTRY_GRID'
  | 'SUBJECT_GRADES_RANKINGS'
  | 'CLASS_ROSTER'
  | 'MONTHLY_RANKING'
  | 'ANNUAL_RANKING'
  | 'MONTHLY_HONOR_ROLL'
  | 'ANNUAL_HONOR_ROLL';

export interface OfficialReportsViewProps {
  db: DatabaseState;
  setDb?: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId?: string;
  defaultTemplate?: ReportTemplateTab;
  onUpdateStudentScore: (params: {
    studentId: string;
    classId: string;
    periodType: 'MONTHLY' | 'ANNUAL';
    newAverageScore: number;
  }) => void;
}

export const OfficialReportsPage: React.FC<OfficialReportsViewProps> = ({
  db,
  setDb,
  activeUserId = 'USR-TCH-12C',
  defaultTemplate = 'SCORE_ENTRY_GRID',
  onUpdateStudentScore,
}) => {
  const [activeReport, setActiveReport] = useState<ReportTemplateTab>(defaultTemplate);
  const [selectedClassId, setSelectedClassId] = useState<string>('CLS-12C');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('២០២៦-២០២៧');
  const [selectedPeriodMode, setSelectedPeriodMode] = useState<'MONTHLY' | 'SEMESTER_1' | 'SEMESTER_2' | 'ANNUAL'>('MONTHLY');
  const [selectedMonth, setSelectedMonth] = useState<string>('វិច្ឆិកា');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('SUB-ICT');
  const [isA4PaperPreview, setIsA4PaperPreview] = useState<boolean>(true);

  // Gradebook Spreadsheet States
  const [spreadsheetDrafts, setSpreadsheetDrafts] = useState<Record<string, string>>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [approvedStudentIds, setApprovedStudentIds] = useState<Record<string, boolean>>({});
  const [scoreSearchQuery, setScoreSearchQuery] = useState<string>('');
  const [scoreStatusFilter, setScoreStatusFilter] = useState<'ALL' | 'PASSED' | 'FAILED' | 'UNRANKED' | 'HONOR'>('ALL');
  const [validationErrorKh, setValidationErrorKh] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' | 'info' } | null>(null);

  const effectivePeriodType = useMemo<'MONTHLY' | 'SEMESTER' | 'ANNUAL'>(() => {
    if (
      activeReport === 'ANNUAL_RANKING' ||
      activeReport === 'ANNUAL_HONOR_ROLL' ||
      selectedPeriodMode === 'ANNUAL'
    ) {
      return 'ANNUAL';
    }
    if (selectedPeriodMode === 'SEMESTER_1' || selectedPeriodMode === 'SEMESTER_2') {
      return 'SEMESTER';
    }
    return 'MONTHLY';
  }, [activeReport, selectedPeriodMode]);

  const effectiveRoles = useMemo(
    () => getUserEffectiveRoles(db, activeUserId, 'AY-2025-2026'),
    [db, activeUserId]
  );

  const periodLockStatus = useMemo(
    () =>
      isScoreEntryPeriodLocked(db, {
        academicYearId: 'AY-2025-2026',
        classId: selectedClassId,
        periodType: effectivePeriodType,
        periodKey: selectedMonth,
      }),
    [db, selectedClassId, effectivePeriodType, selectedMonth]
  );

  const scorePermission = useMemo(
    () =>
      canManageStudentScore(db, activeUserId, {
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        academicYearId: 'AY-2025-2026',
        periodType: effectivePeriodType,
        periodKey: selectedMonth,
        action: 'EDIT',
      }),
    [db, activeUserId, selectedClassId, selectedSubjectId, effectivePeriodType, selectedMonth]
  );

  useEffect(() => {
    setActiveReport(defaultTemplate);
  }, [defaultTemplate]);

  const settingsMap = useMemo(() => {
    const map: Record<string, string> = {};
    db.SystemSettings.forEach((s) => {
      map[s.SettingKey] = s.SettingValue;
    });
    return map;
  }, [db.SystemSettings]);

  const schoolProvinceHeader =
    settingsMap.ProvinceMoEYS ||
    settingsMap.PROVINCE_NAME_KH ||
    'មន្ទីរអប់រំយុវជន និងកីឡាខេត្តបន្ទាយមានជ័យ';
  const schoolDistrictHeader =
    settingsMap.DistrictOffice ||
    settingsMap.DISTRICT_NAME_KH ||
    'ការិយាល័យអប់រំ នៃរដ្ឋបាលស្រុកព្រះនេត្រព្រះ';
  const schoolNameHeader =
    settingsMap.SchoolName || settingsMap.SCHOOL_NAME_KH || 'វិទ្យាល័យទឹកជោរ';
  const principalNameFooter =
    settingsMap.PrincipalName || settingsMap.PRINCIPAL_NAME_KH || 'សុខ សុវណ្ណារ៉ា';
  const lunarDateFooter =
    settingsMap.DefaultLunarDate ||
    settingsMap.LUNAR_DATE_TEXT ||
    'ថ្ងៃសៅរ៍ ៩កើត ខែមិគសិរ ឆ្នាំជូត ទោស័ក ព.ស. ២៥៦៩';
  const solarDateFooter =
    settingsMap.DefaultSolarDate ||
    settingsMap.SOLAR_DATE_TEXT ||
    'ទឹកជោរ, ថ្ងៃទី២៩ ខែវិច្ឆិកា ឆ្នាំ២០២៥';

  const currentClass = useMemo(
    () => db.Classes.find((c) => c.ClassID === selectedClassId) || db.Classes[16],
    [db.Classes, selectedClassId]
  );

  const homeroomTeacher = useMemo(
    () => db.Users.find((u) => u.UserID === currentClass.HomeroomTeacherID),
    [db.Users, currentClass]
  );

  const selectedSubject = useMemo(
    () => db.Subjects.find((s) => s.SubjectID === selectedSubjectId) || db.Subjects[0],
    [db.Subjects, selectedSubjectId]
  );

  const effectiveMaxScore = useMemo(() => {
    return selectedSubject ? selectedSubject.MaximumScore : 50;
  }, [selectedSubject]);

  const classStudents = useMemo(() => {
    const enrolledIds = new Set(
      db.Enrollments.filter((e) => e.ClassID === selectedClassId).map((e) => e.StudentID)
    );
    return db.Students.filter((s) => enrolledIds.has(s.StudentID));
  }, [db.Enrollments, db.Students, selectedClassId]);

  const rosterSummary = useMemo(
    () => computeClassRosterSummary(classStudents, 2026),
    [classStudents]
  );

  const rankedEntries = useMemo(() => {
    const isAnnual =
      activeReport === 'ANNUAL_RANKING' ||
      activeReport === 'ANNUAL_HONOR_ROLL' ||
      (activeReport === 'SCORE_ENTRY_GRID' && selectedPeriodMode === 'ANNUAL');

    const rawInputs = classStudents.map((st, idx) => {
      if (isAnnual) {
        const ann = db.AnnualResults.find(
          (a) => a.StudentID === st.StudentID && a.ClassID === selectedClassId
        );
        return {
          studentId: st.StudentID,
          studentCode: st.StudentCode,
          lastNameKh: st.LastNameKh,
          firstNameKh: st.FirstNameKh,
          gender: st.Gender,
          averageScore: ann ? ann.AnnualAverage : 30.0,
          profileImageUrl:
            st.ProfileImageID && HONOR_PORTRAIT_URLS[st.ProfileImageID]
              ? HONOR_PORTRAIT_URLS[st.ProfileImageID]
              : Object.values(HONOR_PORTRAIT_URLS)[idx % 5],
        };
      } else {
        const mon = db.MonthlyScores.find(
          (m) => m.StudentID === st.StudentID && m.ClassID === selectedClassId
        );
        return {
          studentId: st.StudentID,
          studentCode: st.StudentCode,
          lastNameKh: st.LastNameKh,
          firstNameKh: st.FirstNameKh,
          gender: st.Gender,
          averageScore: mon ? mon.AverageScore : 30.0,
          profileImageUrl:
            st.ProfileImageID && HONOR_PORTRAIT_URLS[st.ProfileImageID]
              ? HONOR_PORTRAIT_URLS[st.ProfileImageID]
              : Object.values(HONOR_PORTRAIT_URLS)[idx % 5],
        };
      }
    });

    return calculateCompetitionRanking(rawInputs, 50);
  }, [
    classStudents,
    db.AnnualResults,
    db.MonthlyScores,
    selectedClassId,
    activeReport,
    selectedPeriodMode,
  ]);

  const filteredSpreadsheetEntries = useMemo(() => {
    const q = scoreSearchQuery.trim().toLowerCase();
    return rankedEntries.filter((entry) => {
      if (q) {
        const matchesName = entry.displayNameRanking.toLowerCase().includes(q) || entry.fullNameKh.toLowerCase().includes(q);
        const matchesCode = entry.studentCode.toLowerCase().includes(q);
        if (!matchesName && !matchesCode) return false;
      }
      if (scoreStatusFilter === 'PASSED') return !entry.isUnranked && entry.passStatus === 'ជាប់មធ្យមភាគ';
      if (scoreStatusFilter === 'FAILED') return !entry.isUnranked && entry.passStatus === 'ធ្លាក់មធ្យមភាគ';
      if (scoreStatusFilter === 'UNRANKED') return entry.isUnranked;
      if (scoreStatusFilter === 'HONOR') return entry.isHonorRoll;
      return true;
    });
  }, [rankedEntries, scoreSearchQuery, scoreStatusFilter]);

  const twoColumnSplit = useMemo(
    () => splitRankingRowsTwoColumns(rankedEntries),
    [rankedEntries]
  );

  const rankingStats = useMemo(
    () => computeRankingSummaryStats(rankedEntries),
    [rankedEntries]
  );

  const top5HonorStudents = useMemo(() => {
    return [...rankedEntries]
      .filter((r) => !r.isUnranked && r.ranking !== null && r.isHonorRoll)
      .sort((a, b) => (a.ranking ?? 999) - (b.ranking ?? 999))
      .slice(0, 5);
  }, [rankedEntries]);

  const getReportTitle = (tab: ReportTemplateTab = activeReport): string => {
    const configMap: Record<ReportTemplateTab, { reportNameKh: string; extraContext?: string }> = {
      CLASS_ROSTER: { reportNameKh: 'បញ្ជីរាយនាមសិស្ស' },
      SUBJECT_GRADES_RANKINGS: {
        reportNameKh: 'និទ្ទេស និងចំណាត់ថ្នាក់តាមមុខវិជ្ជា',
        extraContext: selectedMonth,
      },
      MONTHLY_RANKING: { reportNameKh: 'តារាងចំណាត់ថ្នាក់ប្រចាំខែ', extraContext: selectedMonth },
      MONTHLY_HONOR_ROLL: { reportNameKh: 'តារាងកិត្តិយសប្រចាំខែ', extraContext: selectedMonth },
      ANNUAL_RANKING: { reportNameKh: 'តារាងចំណាត់ថ្នាក់ប្រចាំឆ្នាំ' },
      ANNUAL_HONOR_ROLL: { reportNameKh: 'តារាងកិត្តិយសប្រចាំឆ្នាំ' },
      SCORE_ENTRY_GRID: { reportNameKh: 'តារាងពិន្ទុប្រចាំខែ', extraContext: selectedMonth },
    };
    const cfg = configMap[tab];
    return formatKhmerReportTitle({
      reportNameKh: cfg.reportNameKh,
      className: currentClass.ClassName,
      academicYear: selectedAcademicYear,
      extraContext: cfg.extraContext,
    });
  };

  const triggerPrintReport = (customTitle?: string) => {
    const docTitle = customTitle || getReportTitle(activeReport);
    handleGlobalPrint(docTitle);
  };

  const handleToggleScorePeriodLock = () => {
    if (!setDb) return;
    const nextLockState = !periodLockStatus.isLocked;
    // Allow administrator or demo toggle from UI (using USR-ADM-01 if teacher clicks admin lock simulation button)
    const lockActorId = effectiveRoles.isAdministrator ? activeUserId : 'USR-ADM-01';
    const res = setScoreEntryPeriodLock(
      db,
      {
        academicYearId: 'AY-2025-2026',
        classId: selectedClassId,
        periodType: effectivePeriodType,
        periodKey: selectedMonth,
        isLocked: nextLockState,
        reason: nextLockState
          ? `បិទការបញ្ចូលពិន្ទុថ្នាក់ ${currentClass.ClassName} (${selectedMonth})`
          : `បើកសិទ្ធិបញ្ចូលពិន្ទុឡើងវិញថ្នាក់ ${currentClass.ClassName} (${selectedMonth})`,
      },
      lockActorId
    );
    if (res.ok) {
      setDb(res.updatedDb);
      setValidationErrorKh(null);
      setToast({
        message: res.messageKh,
        variant: nextLockState ? 'info' : 'success',
      });
    } else {
      setValidationErrorKh(res.messageKh);
      setToast({ message: res.messageKh, variant: 'error' });
    }
  };

  const handleCommitSpreadsheetRow = (studentId: string, rawVal: string) => {
    if (!scorePermission.allowed) {
      setValidationErrorKh(scorePermission.reasonKh);
      setToast({ message: scorePermission.reasonKh, variant: 'error' });
      return false;
    }

    const val = Number(rawVal);
    const validation = validateSubjectScoreInput(val, effectiveMaxScore, true);
    if (!validation.valid) {
      setValidationErrorKh(validation.messageKh);
      setToast({ message: validation.messageKh || 'ពិន្ទុមិនត្រឹមត្រូវ', variant: 'error' });
      return false;
    }

    if (setDb) {
      const result = upsertStudentSubjectScoreAndRecalculate(
        db,
        {
          studentId,
          classId: selectedClassId,
          subjectId: selectedSubjectId,
          academicYearId: 'AY-2025-2026',
          periodType: effectivePeriodType,
          periodKey: selectedMonth,
          newScore: val,
          reason: `កែពិន្ទុមុខវិជ្ជា ${selectedSubject.SubjectNameKh} (${selectedMonth})`,
        },
        activeUserId
      );
      if (!result.ok) {
        setValidationErrorKh(result.messageKh);
        setToast({ message: result.messageKh, variant: 'error' });
        return false;
      }
      setDb(result.updatedDb);
      setValidationErrorKh(null);
      setToast({
        message: result.messageKh,
        variant: 'success',
      });
      return true;
    }

    setValidationErrorKh(null);
    onUpdateStudentScore({
      studentId,
      classId: selectedClassId,
      periodType:
        activeReport === 'ANNUAL_RANKING' ||
        activeReport === 'ANNUAL_HONOR_ROLL' ||
        selectedPeriodMode === 'ANNUAL'
          ? 'ANNUAL'
          : 'MONTHLY',
      newAverageScore: val,
    });
    setToast({
      message: `បានរក្សាទុកពិន្ទុសិស្ស ${studentId} (${val === -1.72 ? 'មិនចាត់ថ្នាក់ (-1.72)' : `${val.toFixed(2)} / ${effectiveMaxScore}`})`,
      variant: 'success',
    });
    return true;
  };

  const handleSaveAllChanges = () => {
    if (!scorePermission.allowed) {
      setValidationErrorKh(scorePermission.reasonKh);
      setToast({ message: scorePermission.reasonKh, variant: 'error' });
      return false;
    }

    const draftEntries = Object.entries(spreadsheetDrafts);
    if (draftEntries.length === 0) {
      setValidationErrorKh(null);
      setToast({
        message: `បានរក្សាទុកទិន្នន័យពិន្ទុថ្នាក់ទី ${currentClass.ClassName} (${selectedSubject.SubjectNameKh} • ខែ${selectedMonth}) រួចរាល់!`,
        variant: 'success',
      });
      return true;
    }

    for (const [studentId, rawVal] of draftEntries) {
      const val = Number(rawVal);
      const validation = validateSubjectScoreInput(val, effectiveMaxScore, true);
      if (!validation.valid) {
        const st = rankedEntries.find((r) => r.studentId === studentId);
        const errText = `${st ? st.displayNameRanking : studentId}: ${validation.messageKh}`;
        setValidationErrorKh(errText);
        setToast({ message: errText, variant: 'error' });
        return false;
      }
    }

    if (setDb) {
      let workingDb = db;
      for (const [studentId, rawVal] of draftEntries) {
        const res = upsertStudentSubjectScoreAndRecalculate(
          workingDb,
          {
            studentId,
            classId: selectedClassId,
            subjectId: selectedSubjectId,
            academicYearId: 'AY-2025-2026',
            periodType: effectivePeriodType,
            periodKey: selectedMonth,
            newScore: Number(rawVal),
            reason: `រក្សាទុកពិន្ទុមុខវិជ្ជា ${selectedSubject.SubjectNameKh} (${selectedMonth})`,
          },
          activeUserId
        );
        if (!res.ok) {
          setValidationErrorKh(res.messageKh);
          setToast({ message: res.messageKh, variant: 'error' });
          return false;
        }
        workingDb = res.updatedDb;
      }
      setDb(workingDb);
      setSpreadsheetDrafts({});
      setValidationErrorKh(null);
      setToast({
        message: `បានរក្សាទុក និងគណនាមធ្យមភាគ-ចំណាត់ថ្នាក់ស្វ័យប្រវត្តិសម្រាប់សិស្ស ${draftEntries.length} នាក់ (${selectedSubject.SubjectNameKh} • ថ្នាក់ទី ${currentClass.ClassName})!`,
        variant: 'success',
      });
      return true;
    }

    const periodType =
      activeReport === 'ANNUAL_RANKING' ||
      activeReport === 'ANNUAL_HONOR_ROLL' ||
      selectedPeriodMode === 'ANNUAL'
        ? 'ANNUAL'
        : 'MONTHLY';

    draftEntries.forEach(([studentId, rawVal]) => {
      onUpdateStudentScore({
        studentId,
        classId: selectedClassId,
        periodType,
        newAverageScore: Number(rawVal),
      });
    });

    setSpreadsheetDrafts({});
    setValidationErrorKh(null);
    setToast({
      message: `បានរក្សាទុកការកែប្រែពិន្ទុចំនួន ${draftEntries.length} នាក់ ក្នុងថ្នាក់ទី ${currentClass.ClassName} ដោយជោគជ័យ!`,
      variant: 'success',
    });
    return true;
  };

  const handleCalculateRankingsAction = () => {
    const ok = handleSaveAllChanges();
    if (!ok) return;
    setToast({
      message: `បានគណនាមធ្យមភាគ និងចំណាត់ថ្នាក់ស្វ័យប្រវត្តិ (សរុប ${rankingStats.totalStudents.total} នាក់ • ជាប់ ${rankingStats.passed.total} នាក់ • មិនចាត់ថ្នាក់ ${rankingStats.unranked.total} នាក់)!`,
      variant: 'info',
    });
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredSpreadsheetEntries.map((e) => e.studentId);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedStudentIds(Array.from(new Set([...selectedStudentIds, ...visibleIds])));
    }
  };

  const handleApproveScores = () => {
    const ok = handleSaveAllChanges();
    if (!ok) return;
    const targetIds =
      selectedStudentIds.length > 0
        ? selectedStudentIds
        : filteredSpreadsheetEntries.map((e) => e.studentId);
    setApprovedStudentIds((prev) => {
      const next = { ...prev };
      targetIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
    setToast({
      message: `បានអនុម័តពិន្ទុសិស្សចំនួន ${targetIds.length} នាក់ សម្រាប់មុខវិជ្ជា ${selectedSubject.SubjectNameKh} (ខែ${selectedMonth}) រួចរាល់!`,
      variant: 'success',
    });
  };

  const handleSyncToRankingTab = () => {
    const ok = handleSaveAllChanges();
    if (!ok) return;
    const nextTab = selectedPeriodMode === 'ANNUAL' ? 'ANNUAL_RANKING' : 'MONTHLY_RANKING';
    setActiveReport(nextTab);
    setToast({
      message: `បានផ្ទេរពិន្ទុទៅកាន់ "${nextTab === 'ANNUAL_RANKING' ? 'លទ្ធផល & ចំណាត់ថ្នាក់ប្រចាំឆ្នាំ' : `តារាងចំណាត់ថ្នាក់ប្រចាំខែ${selectedMonth}`}" ដោយជោគជ័យ!`,
      variant: 'success',
    });
  };

  const handleSyncOnlineExamScores = () => {
    const gradedAttempts = db.ExamAttempts.filter(
      (att) => att.AttemptStatus === 'GRADED'
    );
    let syncedCount = 0;
    gradedAttempts.forEach((att) => {
      const enrolledInClass = classStudents.some((s) => s.StudentID === att.StudentID);
      if (enrolledInClass) {
        const exam = db.Exams.find((ex) => ex.ExamID === att.ExamID);
        const examMax = exam?.MaximumScore || 50;
        const normalizedTo50 = Number(((att.TotalScore / examMax) * 50).toFixed(2));
        onUpdateStudentScore({
          studentId: att.StudentID,
          classId: selectedClassId,
          periodType: selectedPeriodMode === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY',
          newAverageScore: normalizedTo50,
        });
        syncedCount += 1;
      }
    });
    setToast({
      message: `បានធ្វើសមកាលកម្មពិន្ទុប្រឡងអនឡាញ (Online Exam Sync) ចំនួន ${syncedCount} នាក់ ចូលក្នុងតារាងពិន្ទុថ្នាក់ ${currentClass.ClassName} ដោយជោគជ័យ!`,
      variant: 'info',
    });
  };

  const renderHonorCard = (student: RankedStudentEntry | undefined, rankNumber: number) => {
    const khmerRank = toKhmerNumerals(rankNumber);
    const isFirst = rankNumber === 1;
    return (
      <div
        className={`border-2 ${
          isFirst ? 'border-amber-500 ring-4 ring-amber-500/10' : 'border-slate-900'
        } bg-white rounded-xl p-4 w-full max-w-[235px] mx-auto flex flex-col items-center text-center shadow-xs transition-transform`}
      >
        <div className="inline-flex items-center gap-1.5 text-sm font-khmer-moul text-slate-900 mb-2">
          <Trophy className={`w-4 h-4 ${isFirst ? 'text-amber-500' : 'text-slate-700'}`} />
          <span>លេខ {khmerRank}</span>
        </div>
        <div className="w-28 h-36 border border-slate-400 bg-sky-100 overflow-hidden rounded-lg mb-2.5 flex items-center justify-center">
          {student?.profileImageUrl ? (
            <img
              src={student.profileImageUrl}
              alt={student.fullNameKh}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-xs text-slate-500 font-khmer-body p-2">រូបថត 4x6</div>
          )}
        </div>
        <div className="text-sm font-extrabold text-slate-900 font-khmer-body">
          {student ? student.displayNameRanking : 'មិនទាន់មានទិន្នន័យ'}
        </div>
        {student && (
          <div className="text-xs text-slate-700 font-khmer-body mt-1 tabular-nums">
            ម.ភាគ៖ <strong>{student.averageScore?.toFixed(2)}</strong> · និទ្ទេស <strong>{student.grade}</strong>
          </div>
        )}
      </div>
    );
  };

  const isHonorTabActive =
    activeReport === 'MONTHLY_HONOR_ROLL' || activeReport === 'ANNUAL_HONOR_ROLL';

  return (
    <div className="space-y-6">
      {toast && (
        <Toast
          tone={toast.variant === 'error' ? 'danger' : toast.variant === 'success' ? 'success' : 'info'}
          title={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* TOP WORKSPACE HEADER, NAVIGATION TABS & CONTEXTUAL FILTER/ACTION BAR (Hidden when printing) */}
      <div className="no-print bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
        {/* Top Row: Workspace Title & Quick A4 / Print Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-khmer-body">
              <span className="font-semibold text-blue-600">មជ្ឈមណ្ឌលពិន្ទុ និងចំណាត់ថ្នាក់</span>
              <span aria-hidden="true">·</span>
              <span>វិទ្យាល័យទឹកជោរ</span>
              <span aria-hidden="true">·</span>
              <span>គ្រូបន្ទុកថ្នាក់៖ {homeroomTeacher?.FullNameKh || 'ជួន លីរតនៈ'}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 font-khmer-moul mt-1">
              ពិន្ទុ ចំណាត់ថ្នាក់ និងតារាងកិត្តិយស ({currentClass.ClassName} • {selectedAcademicYear})
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap xl:flex-nowrap shrink-0">
            <button
              type="button"
              onClick={() => setIsA4PaperPreview((v) => !v)}
              title="មើលគម្រូទំព័រ A4"
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer whitespace-nowrap shrink-0 font-khmer-body ${
                isA4PaperPreview
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>មើលគម្រូ A4</span>
            </button>

            <button
              type="button"
              onClick={() => triggerPrintReport()}
              aria-label="បោះពុម្ព / Save ជា PDF (A4)"
              title="បោះពុម្ព ឬរក្សាទុកជា PDF (A4)"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#14171F] hover:bg-slate-800 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0 font-khmer-body"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>បោះពុម្ព / PDF</span>
            </button>
          </div>
        </div>

        {/* Section 2.A: Top Level View Tabs (Lucide Icons + Concise Khmer Labels) */}
        <div
          role="tablist"
          aria-label="ផ្ទាំងគ្រប់គ្រងពិន្ទុ និងចំណាត់ថ្នាក់"
          className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeReport === 'SCORE_ENTRY_GRID'}
            onClick={() => {
              setSelectedPeriodMode('MONTHLY');
              setActiveReport('SCORE_ENTRY_GRID');
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-colors font-khmer-body whitespace-nowrap shrink-0 cursor-pointer ${
              activeReport === 'SCORE_ENTRY_GRID'
                ? 'bg-[#14171F] text-white shadow-xs'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Table2 className="w-3.5 h-3.5 text-blue-400" />
            <span>ពិន្ទុប្រចាំខែ</span>
          </button>

          <button
            type="button"
            role="tab"
            data-testid="tab-subject-grades-rankings"
            aria-selected={activeReport === 'SUBJECT_GRADES_RANKINGS'}
            onClick={() => setActiveReport('SUBJECT_GRADES_RANKINGS')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-colors font-khmer-body whitespace-nowrap shrink-0 cursor-pointer ${
              activeReport === 'SUBJECT_GRADES_RANKINGS'
                ? 'bg-[#990000] text-white shadow-xs'
                : 'bg-rose-50 text-[#990000] border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-300" />
            <span>និទ្ទេស និងចំណាត់ថ្នាក់តាមមុខវិជ្ជា</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeReport === 'MONTHLY_RANKING'}
            onClick={() => setActiveReport('MONTHLY_RANKING')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-colors font-khmer-body whitespace-nowrap shrink-0 cursor-pointer ${
              activeReport === 'MONTHLY_RANKING'
                ? 'bg-[#14171F] text-white shadow-xs'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>ចំណាត់ថ្នាក់ប្រចាំខែ</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeReport === 'ANNUAL_RANKING'}
            onClick={() => setActiveReport('ANNUAL_RANKING')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-colors font-khmer-body whitespace-nowrap shrink-0 cursor-pointer ${
              activeReport === 'ANNUAL_RANKING'
                ? 'bg-[#14171F] text-white shadow-xs'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>ចំណាត់ថ្នាក់ប្រចាំឆ្នាំ</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={isHonorTabActive}
            onClick={() =>
              setActiveReport(
                activeReport === 'ANNUAL_RANKING' ? 'ANNUAL_HONOR_ROLL' : 'MONTHLY_HONOR_ROLL'
              )
            }
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-colors font-khmer-body whitespace-nowrap shrink-0 cursor-pointer ${
              isHonorTabActive
                ? 'bg-[#14171F] text-white shadow-xs'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>តារាងកិត្តិយស Top 5</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeReport === 'CLASS_ROSTER'}
            onClick={() => setActiveReport('CLASS_ROSTER')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-colors font-khmer-body whitespace-nowrap shrink-0 cursor-pointer ${
              activeReport === 'CLASS_ROSTER'
                ? 'bg-[#14171F] text-white shadow-xs'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>បញ្ជីរាយនាមសិស្ស</span>
          </button>
        </div>

        {/* Section 2.B: Contextual Filter & Action Bar */}
        {activeReport !== 'SUBJECT_GRADES_RANKINGS' && (
          <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-4 space-y-3.5">
            {/* Top Row: 4 Contextual Dropdown Filters in Clean 4-Column Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="report-ay-select"
                  className="text-[11px] font-bold text-slate-600 font-khmer-body"
                >
                  ឆ្នាំសិក្សា
                </label>
                <select
                  id="report-ay-select"
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-900 font-khmer-body cursor-pointer focus:outline-none focus:border-blue-600"
                >
                  <option value="២០២៦-២០២៧">២០២៦-២០២៧</option>
                  <option value="២០២៥-២០២៦">២០២៥-២០២៦</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="report-class-select"
                  className="text-[11px] font-bold text-slate-600 font-khmer-body"
                >
                  ថ្នាក់រៀន (7A–12C)
                </label>
                <select
                  id="report-class-select"
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedStudentIds([]);
                    setSpreadsheetDrafts({});
                  }}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-900 font-khmer-body cursor-pointer focus:outline-none focus:border-blue-600"
                >
                  <option value="CLS-12C">12C (56 នាក់ / ស្រី 26 - ជួន លីរតនៈ)</option>
                  <option value="CLS-7A">7A (6 នាក់ - សុខ ចាន់ថន)</option>
                  {db.Classes.filter((c) => c.ClassID !== 'CLS-12C' && c.ClassID !== 'CLS-7A').map((c) => (
                    <option key={c.ClassID} value={c.ClassID}>
                      ថ្នាក់ទី {c.ClassName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="report-subject-select"
                  className="text-[11px] font-bold text-slate-600 font-khmer-body"
                >
                  មុខវិជ្ជា
                </label>
                <select
                  id="report-subject-select"
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setValidationErrorKh(null);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-900 font-khmer-body cursor-pointer focus:outline-none focus:border-blue-600"
                >
                  {db.Subjects.map((sub) => (
                    <option key={sub.SubjectID} value={sub.SubjectID}>
                      {sub.SubjectNameKh} (Max: {sub.MaximumScore})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="report-month-select"
                  className="text-[11px] font-bold text-slate-600 font-khmer-body"
                >
                  ខែ / ឆមាស
                </label>
                <select
                  id="report-month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-900 font-khmer-body cursor-pointer focus:outline-none focus:border-blue-600"
                >
                  <option value="វិច្ឆិកា">ខែវិច្ឆិកា</option>
                  <option value="ធ្នូ">ខែធ្នូ</option>
                  <option value="មករា">ខែមករា</option>
                  <option value="កុម្ភៈ">ខែកុម្ភៈ</option>
                  <option value="មីនា">ខែមីនា</option>
                  <option value="មេសា">ខែមេសា</option>
                  <option value="ឆមាសទី១">ឆមាសទី១</option>
                  <option value="ឆមាសទី២">ឆមាសទី២</option>
                </select>
              </div>
            </div>

            {/* Bottom Row: Active Context Summary & Primary Score Actions (No duplicate Print button) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2.5 border-t border-slate-200/80">
              <div className="text-xs text-slate-600 font-khmer-body flex items-center gap-2 flex-wrap">
                <span>ថ្នាក់៖ <strong>{currentClass.ClassName}</strong></span>
                <span aria-hidden="true">·</span>
                <span>មុខវិជ្ជា៖ <strong>{selectedSubject.SubjectNameKh}</strong></span>
                <span aria-hidden="true">·</span>
                <span>សិស្សសរុប៖ <strong className="tabular-nums">{rankingStats.totalStudents.total} នាក់ (ស្រី {rankingStats.totalStudents.female})</strong></span>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveAllChanges}
                  aria-label="រក្សាទុកពិន្ទុ (Save Changes)"
                  title="រក្សាទុកពិន្ទុ"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0 font-khmer-body shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>រក្សាទុកពិន្ទុ</span>
                </button>

                <button
                  type="button"
                  onClick={handleCalculateRankingsAction}
                  aria-label="គណនាមធ្យមភាគ & ចំណាត់ថ្នាក់ស្វ័យប្រវត្តិ (Calculate Rankings)"
                  title="គណនាមធ្យមភាគ និងចំណាត់ថ្នាក់"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0 font-khmer-body"
                >
                  <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                  <span>គណនាចំណាត់ថ្នាក់</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Validation Alert Banner when Score > Subject.MaximumScore */}
        {validationErrorKh && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold font-khmer-body flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationErrorKh}</span>
            </div>
            <button
              type="button"
              onClick={() => setValidationErrorKh(null)}
              className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 cursor-pointer"
            >
              បិទ
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          TAB 1: ពិន្ទុប្រចាំខែ (MONTHLY SCORES SPREADSHEET GRID)
         ===================================================================== */}
      {activeReport === 'SCORE_ENTRY_GRID' && (
        <div className="no-print bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
          {/* Top Summary & Period Selector */}
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-khmer-moul">
                តារាងបញ្ចូលពិន្ទុប្រចាំខែ{selectedMonth} · ថ្នាក់ទី {currentClass.ClassName} ({selectedSubject.SubjectNameKh})
              </h3>
              <p className="text-xs text-slate-500 font-khmer-body mt-1">
                ពិន្ទុអតិបរមា៖ <strong className="text-blue-700 font-mono-tabular">{effectiveMaxScore} ពិន្ទុ</strong> · មិនចាត់ថ្នាក់៖ <strong>-1.72</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'MONTHLY', label: `ប្រចាំខែ (${selectedMonth})` },
                  { id: 'SEMESTER_1', label: 'ឆមាសទី១' },
                  { id: 'SEMESTER_2', label: 'ឆមាសទី២' },
                  { id: 'ANNUAL', label: 'ប្រចាំឆ្នាំ' },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setSelectedPeriodMode(pm.id as typeof selectedPeriodMode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-khmer-body transition-colors cursor-pointer whitespace-nowrap ${
                      selectedPeriodMode === pm.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleSyncOnlineExamScores}
                title="ធ្វើសមកាលកម្មពិន្ទុពីការប្រឡងអនឡាញ"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl font-khmer-body cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync ពិន្ទុអនឡាញ</span>
              </button>
            </div>
          </div>

          {/* =====================================================================
              HOMEROOM TEACHER & SUBJECT TEACHER SCORE PERMISSION + PERIOD LOCK BANNER
             ===================================================================== */}
          <div
            data-testid="score-permission-status-banner"
            className={`rounded-2xl border p-4 space-y-3 ${
              scorePermission.allowed
                ? 'bg-emerald-50/60 border-emerald-200'
                : 'bg-rose-50/70 border-rose-200'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-khmer-body">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold ${
                      scorePermission.allowed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {scorePermission.allowed ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          មានសិទ្្ធិបញ្ចូល និងកែពិន្ទុ ({scorePermission.authorizedBy === 'HOMEROOM_TEACHER'
                            ? 'សិទ្ធិគ្រូបន្ទុកថ្នាក់ — គ្រប់មុខវិជ្ជា'
                            : scorePermission.authorizedBy === 'SUBJECT_TEACHER'
                            ? 'សិទ្ធិគ្រូបង្រៀនមុខវិជ្ជា'
                            : 'សិទ្ធិគណៈគ្រប់គ្រងសាលា'})
                        </span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>គ្មានសិទ្ធិកែប្រែពិន្ទុ ឬការបញ្ចូលពិន្ទុត្រូវបានចាក់សោ</span>
                      </>
                    )}
                  </span>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      គណនីកំពុងប្រើ៖ {db.Users.find((u) => u.UserID === activeUserId)?.FullNameKh || activeUserId} (
                      {effectiveRoles.effectiveRoles.join(' + ')})
                    </span>
                  </span>

                  {homeroomTeacher && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold">
                      <Award className="w-3.5 h-3.5 text-amber-600" />
                      <span>គ្រូបន្ទុកថ្នាក់ {currentClass.ClassName}៖ {homeroomTeacher.FullNameKh}</span>
                    </span>
                  )}
                </div>

                <p
                  data-testid="score-permission-reason-text"
                  className={`text-xs font-bold font-khmer-body ${
                    scorePermission.allowed ? 'text-emerald-900' : 'text-rose-800'
                  }`}
                >
                  {scorePermission.reasonKh}
                </p>
              </div>

              {/* Score Period Lock / Reopen Control */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span
                  data-testid="score-period-lock-badge"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-khmer-body border ${
                    periodLockStatus.isLocked
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-white text-emerald-700 border-emerald-200'
                  }`}
                >
                  {periodLockStatus.isLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-rose-600" />
                      <span>បានចាក់សោបិទការបញ្ចូលពិន្ទុ ({selectedMonth})</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>បើកឱ្យបញ្ចូលពិន្ទុ ({selectedMonth})</span>
                    </>
                  )}
                </span>

                {setDb && (
                  <button
                    type="button"
                    data-testid="toggle-score-period-lock-btn"
                    onClick={handleToggleScorePeriodLock}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-khmer-body transition-colors cursor-pointer ${
                      periodLockStatus.isLocked
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {periodLockStatus.isLocked ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>បើកសិទ្ធិបញ្ចូលពិន្ទុឡើងវិញ (Reopen)</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>ចាក់សោបិទវគ្គពិន្ទុ (Lock Period)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Quick Subject Selector Pills showing Homeroom vs Subject Teacher permissions per subject */}
            <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-600 font-khmer-body">
                ជ្រើសរើសមុខវិជ្ជាក្នុងថ្នាក់ទី {currentClass.ClassName}៖
              </span>
              {db.Subjects.map((sub) => {
                const subPerm = canManageStudentScore(db, activeUserId, {
                  classId: selectedClassId,
                  subjectId: sub.SubjectID,
                  academicYearId: 'AY-2025-2026',
                  periodType: effectivePeriodType,
                  periodKey: selectedMonth,
                  action: 'EDIT',
                });
                const isSelectedSub = selectedSubjectId === sub.SubjectID;
                return (
                  <button
                    key={sub.SubjectID}
                    type="button"
                    data-testid={`score-subject-pill-${sub.SubjectID}`}
                    onClick={() => {
                      setSelectedSubjectId(sub.SubjectID);
                      setValidationErrorKh(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-khmer-body border transition-all cursor-pointer ${
                      isSelectedSub
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : subPerm.allowed
                        ? 'bg-white text-slate-800 border-emerald-300 hover:bg-emerald-50'
                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200/70'
                    }`}
                  >
                    <span>{sub.SubjectNameKh}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        isSelectedSub
                          ? 'bg-blue-700 text-white'
                          : subPerm.allowed
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {subPerm.allowed
                        ? subPerm.authorizedBy === 'HOMEROOM_TEACHER'
                          ? 'កែបាន (គ្រូបន្ទុក)'
                          : subPerm.authorizedBy === 'SUBJECT_TEACHER'
                          ? 'កែបាន (គ្រូមុខវិជ្ជា)'
                          : 'កែបាន (Admin)'
                        : 'មើលប៉ុណ្ណោះ'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4 Clean Summary Metrics Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs font-khmer-body">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-slate-500 font-semibold">សិស្សសរុប (ថ្នាក់ {currentClass.ClassName})</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1 tabular-nums">
                {rankingStats.totalStudents.total} នាក់ · ស្រី {rankingStats.totalStudents.female} នាក់
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-slate-500 font-semibold">ជាប់មធ្យមភាគ (&ge; 25.00)</div>
              <div className="text-lg font-extrabold text-emerald-700 mt-1 tabular-nums">
                {rankingStats.passed.total} នាក់ · ស្រី {rankingStats.passed.female} នាក់
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-slate-500 font-semibold">ធ្លាក់មធ្យមភាគ (&lt; 25.00)</div>
              <div className="text-lg font-extrabold text-rose-600 mt-1 tabular-nums">
                {rankingStats.failed.total} នាក់ · ស្រី {rankingStats.failed.female} នាក់
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-slate-500 font-semibold">មិនចាត់ថ្នាក់ (-1.72)</div>
              <div className="text-lg font-extrabold text-amber-700 mt-1 tabular-nums">
                {rankingStats.unranked.total} នាក់ · ស្រី {rankingStats.unranked.female} នាក់
              </div>
            </div>
          </div>

          {/* Search & Quick Filter Bar for the Gradebook Table */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label="ស្វែងរកសិស្សក្នុងតារាងពិន្ទុ"
                placeholder="ស្វែងរកតាមឈ្មោះ ឬ អត្តលេខសិស្ស (ឧ. 5187, 6463, រឺ យូរៀន)..."
                value={scoreSearchQuery}
                onChange={(e) => setScoreSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-khmer-body border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-khmer-body">
              {[
                { id: 'ALL', label: `ទាំងអស់ (${rankedEntries.length})` },
                { id: 'HONOR', label: `Top 5 កិត្តិយស (${top5HonorStudents.length})` },
                { id: 'PASSED', label: `ជាប់ (${rankingStats.passed.total})` },
                { id: 'FAILED', label: `ធ្លាក់ (${rankingStats.failed.total})` },
                { id: 'UNRANKED', label: `មិនចាត់ថ្នាក់ (${rankingStats.unranked.total})` },
              ].map((flt) => (
                <button
                  key={flt.id}
                  type="button"
                  onClick={() => setScoreStatusFilter(flt.id as typeof scoreStatusFilter)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    scoreStatusFilter === flt.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {flt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Batch Action Bar (Docked cleanly above the sticky table so it never covers rows) */}
          <div className="bg-[#14171F] text-white rounded-2xl px-5 py-3.5 shadow-sm border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 text-xs font-khmer-body">
              <span className="font-bold text-white">
                បានជ្រើសរើស៖ <strong className="text-blue-400 font-mono-tabular">{selectedStudentIds.length}</strong> / {filteredSpreadsheetEntries.length} នាក់
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-300">
                អនុម័តរួច៖ <strong className="text-emerald-400 font-mono-tabular">{Object.keys(approvedStudentIds).length}</strong> នាក់
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer font-khmer-body whitespace-nowrap"
              >
                <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                <span>ជ្រើសរើសទាំងអស់</span>
              </button>

              <button
                type="button"
                onClick={handleApproveScores}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors cursor-pointer font-khmer-body whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>អនុម័តពិន្ទុ (Approve Scores)</span>
              </button>

              <button
                type="button"
                onClick={handleSyncToRankingTab}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors cursor-pointer font-khmer-body whitespace-nowrap"
              >
                <ArrowRightCircle className="w-3.5 h-3.5" />
                <span>ផ្ទេរទៅតារាងចំណាត់ថ្នាក់ (Sync to Ranking)</span>
              </button>
            </div>
          </div>

          {/* Clean Sticky Gradebook Spreadsheet Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs font-khmer-body">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-bold">
                  <th className="py-3 px-3 w-10 text-center border-r border-slate-200">
                    <input
                      type="checkbox"
                      aria-label="ជ្រើសរើសសិស្សទាំងអស់"
                      checked={
                        filteredSpreadsheetEntries.length > 0 &&
                        filteredSpreadsheetEntries.every((e) => selectedStudentIds.includes(e.studentId))
                      }
                      onChange={handleToggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 cursor-pointer"
                    />
                  </th>
                  <th className="sticky left-0 z-10 bg-slate-100 py-3 px-3 w-12 text-center border-r border-slate-200">
                    ល.រ
                  </th>
                  <th className="sticky left-12 z-10 bg-slate-100 py-3 px-3 w-20 text-center border-r border-slate-200">
                    អត្តលេខ
                  </th>
                  <th className="sticky left-32 z-10 bg-slate-100 py-3 px-3.5 border-r border-slate-200 min-w-[180px]">
                    គោត្តនាម និងនាម (ក. សម្រាប់ស្រី)
                  </th>
                  <th className="py-3 px-3 w-64">
                    ពិន្ទុមុខវិជ្ជា [ ___ / {effectiveMaxScore} ]
                  </th>
                  <th className="py-3 px-3 w-24 text-right">ម.ភាគ</th>
                  <th className="py-3 px-3 w-28 text-center">ចំ.ថ្នាក់</th>
                  <th className="py-3 px-3 w-24 text-center">និទ្ទេស</th>
                  <th className="py-3 px-3 w-40 text-center">ស្ថានភាព (ជាប់ / ធ្លាក់ / មិនចាត់ថ្នាក់)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {filteredSpreadsheetEntries.map((entry) => {
                  const currentValStr =
                    spreadsheetDrafts[entry.studentId] !== undefined
                      ? spreadsheetDrafts[entry.studentId]
                      : String(entry.averageScore ?? 0);

                  const numericVal = Number(currentValStr);
                  const isExceedingMax =
                    currentValStr.trim() !== '' &&
                    !Number.isNaN(numericVal) &&
                    numericVal > effectiveMaxScore;
                  const isInvalidNegative =
                    currentValStr.trim() !== '' &&
                    !Number.isNaN(numericVal) &&
                    numericVal < 0 &&
                    numericVal !== -1.72;
                  const hasInputError = isExceedingMax || isInvalidNegative;

                  const isTiedRank =
                    entry.ranking === 6 || entry.ranking === 13 || entry.ranking === 42;
                  const isSelected = selectedStudentIds.includes(entry.studentId);
                  const isApproved = Boolean(approvedStudentIds[entry.studentId]);

                  return (
                    <tr
                      key={entry.studentId}
                      className={`transition-colors ${
                        hasInputError
                          ? 'bg-rose-50/70'
                          : isSelected
                          ? 'bg-blue-50/50'
                          : entry.isUnranked
                          ? 'bg-amber-50/40 hover:bg-amber-50/70'
                          : entry.isHonorRoll
                          ? 'bg-emerald-50/25 hover:bg-emerald-50/50'
                          : 'hover:bg-slate-50/90'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center border-r border-slate-200">
                        <input
                          type="checkbox"
                          aria-label={`ជ្រើសរើស ${entry.displayNameRanking}`}
                          checked={isSelected}
                          onChange={() =>
                            setSelectedStudentIds((prev) =>
                              prev.includes(entry.studentId)
                                ? prev.filter((id) => id !== entry.studentId)
                                : [...prev, entry.studentId]
                            )
                          }
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="sticky left-0 z-10 bg-white py-2.5 px-3 text-center font-mono-tabular font-semibold text-slate-500 border-r border-slate-200">
                        {entry.listIndex}
                      </td>
                      <td className="sticky left-12 z-10 bg-white py-2.5 px-3 text-center font-mono-tabular font-bold text-slate-800 border-r border-slate-200">
                        {entry.studentCode}
                      </td>
                      <td className="sticky left-32 z-10 bg-white py-2.5 px-3.5 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-2">
                          <span>{entry.displayNameRanking}</span>
                          <span className="text-[11px] font-normal text-slate-500">
                            {entry.gender}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`inline-flex items-center rounded-lg border px-2 py-1 bg-white transition-colors ${
                                hasInputError
                                  ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/20'
                                  : 'border-slate-300 focus-within:border-blue-600'
                              }`}
                            >
                              <input
                                type="number"
                                step="0.01"
                                aria-label={`ពិន្ទុរបស់ ${entry.displayNameRanking}`}
                                value={currentValStr}
                                onChange={(e) =>
                                  setSpreadsheetDrafts((prev) => ({
                                    ...prev,
                                    [entry.studentId]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCommitSpreadsheetRow(entry.studentId, currentValStr);
                                  }
                                }}
                                className={`w-18 text-xs font-mono-tabular font-bold bg-transparent focus:outline-none ${
                                  hasInputError ? 'text-rose-900' : 'text-slate-900'
                                }`}
                              />
                              <span className="text-[11px] font-mono-tabular text-slate-400 select-none pl-1 border-l border-slate-200">
                                / {effectiveMaxScore}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleCommitSpreadsheetRow(entry.studentId, currentValStr)
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
                            >
                              រក្សាទុក
                            </button>

                            <button
                              type="button"
                              title="កំណត់ជាមិនចាត់ថ្នាក់ (-1.72)"
                              onClick={() => {
                                setSpreadsheetDrafts((prev) => ({
                                  ...prev,
                                  [entry.studentId]: '-1.72',
                                }));
                                handleCommitSpreadsheetRow(entry.studentId, '-1.72');
                              }}
                              className="px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold cursor-pointer whitespace-nowrap"
                            >
                              -1.72
                            </button>
                          </div>

                          {isExceedingMax && (
                            <div className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>លើសពិន្ទុអតិបរមា ({effectiveMaxScore})!</span>
                            </div>
                          )}
                          {isInvalidNegative && (
                            <div className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>ពិន្ទុមិនអាចអវិជ្ជមាន (លើកលែង -1.72)</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-slate-900">
                        {entry.isUnranked ? '-1.72' : entry.averageScore?.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono-tabular font-extrabold text-slate-900">
                        {entry.isUnranked ? (
                          <span className="text-amber-800 font-bold text-[11px]">
                            #{entry.bottomGroupRank} (មិនចាត់ថ្នាក់)
                          </span>
                        ) : (
                          <span
                            className={
                              isTiedRank
                                ? 'text-indigo-700 font-extrabold'
                                : entry.isHonorRoll
                                ? 'text-emerald-700 font-extrabold'
                                : 'text-slate-900'
                            }
                          >
                            #{entry.ranking}
                            {isTiedRank ? ' (ស្មើ)' : ''}
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-center font-bold ${
                          entry.isUnranked
                            ? 'text-amber-800'
                            : entry.grade === 'A' || entry.grade === 'B'
                            ? 'text-emerald-700'
                            : entry.grade === 'F'
                            ? 'text-rose-700'
                            : 'text-slate-800'
                        }`}
                      >
                        {entry.grade}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5 flex-wrap">
                          {entry.isUnranked ? (
                            <span className="text-[11px] font-bold text-amber-800">
                              មិនចាត់ថ្នាក់
                            </span>
                          ) : entry.passStatus === 'ជាប់មធ្យមភាគ' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>ជាប់</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-rose-700">
                              ធ្លាក់
                            </span>
                          )}
                          {entry.isHonorRoll && (
                            <span className="text-[11px] font-bold text-amber-700">
                              · Top {toKhmerNumerals(entry.ranking || 1)}
                            </span>
                          )}
                          {isApproved && (
                            <span className="text-[10px] font-bold text-blue-700">
                              · អនុម័តរួច
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* =====================================================================
              SCORE ENTRY & HOMEROOM AUDIT LOG SECTION
             ===================================================================== */}
          <div
            data-testid="score-audit-log-section"
            className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-4 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 font-khmer-body">
                <History className="w-4 h-4 text-indigo-600" />
                <span>កំណត់ត្រាសវនកម្មការបញ្ចូល និងកែប្រែពិន្ទុ (Score Management & Lock Audit Log)</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 font-khmer-body">
                កត់ត្រាស្វ័យប្រវត្តិគ្រប់ការកែពិន្ទុ និងការចាក់សោ
              </span>
            </div>

            <div className="overflow-x-auto max-h-48">
              <table className="w-full text-left border-collapse text-xs font-khmer-body">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1.5 pr-3">ពេលវេលា</th>
                    <th className="py-1.5 px-3">អ្នកប្រើប្រាស់</th>
                    <th className="py-1.5 px-3">សកម្មភាព</th>
                    <th className="py-1.5 pl-3">ព័ត៌មានលម្អិត (មុនកែ → ក្រោយកែ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60">
                  {db.AuditLogs.filter(
                    (log) =>
                      log.Action.includes('SCORE') ||
                      log.Action.includes('HOMEROOM') ||
                      log.Action.includes('LOCK') ||
                      log.Action.includes('TEACHER')
                  )
                    .slice(0, 8)
                    .map((log) => {
                      const actor = db.Users.find((u) => u.UserID === log.UserID);
                      return (
                        <tr key={log.LogID}>
                          <td className="py-1.5 pr-3 font-mono-tabular text-[11px] text-slate-500 whitespace-nowrap">
                            {log.Timestamp}
                          </td>
                          <td className="py-1.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                            {actor ? actor.FullNameKh : log.UserID}
                          </td>
                          <td className="py-1.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono-tabular text-[10px] font-bold">
                              {log.Action}
                            </span>
                          </td>
                          <td className="py-1.5 pl-3 text-slate-700">{log.Description}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ANNUAL STANDINGS OVERVIEW BAR (Shown on Tab 3: ANNUAL_RANKING)
         ===================================================================== */}
      {activeReport === 'ANNUAL_RANKING' && (
        <div className="no-print bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 font-khmer-moul">
                សង្ខេបលទ្ធផលសិក្សា និងចំណាត់ថ្នាក់ប្រចាំឆ្នាំ ({selectedAcademicYear} • ថ្នាក់ទី {currentClass.ClassName})
              </h3>
              <p className="text-xs text-slate-600 font-khmer-body mt-0.5">
                គណនាមធ្យមភាគប្រចាំឆ្នាំពីឆមាសទី១ និងឆមាសទី២ ព្រមទាំងបែងចែកនិទ្ទេស A–F និងចំណាត់ថ្នាក់ស្វ័យប្រវត្តិ។
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-khmer-body">
              <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500">ជាប់មធ្យមភាគប្រចាំឆ្នាំ៖ </span>
                <strong className="text-emerald-700 tabular-nums">
                  {rankingStats.passed.total} នាក់ (ស្រី {rankingStats.passed.female})
                </strong>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500">ធ្លាក់មធ្យមភាគ៖ </span>
                <strong className="text-rose-700 tabular-nums">
                  {rankingStats.failed.total} នាក់ (ស្រី {rankingStats.failed.female})
                </strong>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500">មិនចាត់ថ្នាក់៖ </span>
                <strong className="text-amber-700 tabular-nums">
                  {rankingStats.unranked.total} នាក់
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          HONOR ROLL CONTEXTUAL TOOLBAR (Shown on Tab 4: HONOR ROLL BOARDS)
         ===================================================================== */}
      {isHonorTabActive && (
        <div className="no-print bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-khmer-body">
              <button
                type="button"
                onClick={() => setActiveReport('MONTHLY_HONOR_ROLL')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  activeReport === 'MONTHLY_HONOR_ROLL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                តារាងកិត្តិយសប្រចាំខែ ({selectedMonth})
              </button>
              <button
                type="button"
                onClick={() => setActiveReport('ANNUAL_HONOR_ROLL')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  activeReport === 'ANNUAL_HONOR_ROLL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                តារាងកិត្តិយសប្រចាំឆ្នាំ ({selectedAcademicYear})
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => triggerPrintReport(getReportTitle(activeReport))}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#14171F] hover:bg-slate-800 rounded-xl transition-colors cursor-pointer font-khmer-body whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>បោះពុម្ពតារាងកិត្តិយស (Print Honor Roll)</span>
          </button>
        </div>
      )}

      {/* =====================================================================
          SUBJECT GRADES & RANKINGS SHEET (និទ្ទេស និងចំណាត់ថ្នាក់តាមមុខវិជ្ជា & សរុប A–F)
         ===================================================================== */}
      {activeReport === 'SUBJECT_GRADES_RANKINGS' && (
        <SubjectGradesAndRankingsSheet
          db={db}
          defaultClassId={selectedClassId}
          defaultMonth={selectedMonth}
          defaultAcademicYear={selectedAcademicYear}
          defaultPeriodMode={selectedPeriodMode}
        />
      )}

      {/* =====================================================================
          PRINTABLE OFFICIAL KHMER A4 SHEET CONTAINER
          (Visible on Ranking / Honor Roll / Class Roster tabs, or when printing)
         ===================================================================== */}
      <div
        className={`print-sheet bg-white border border-slate-300 rounded-xl p-6 sm:p-8 shadow-sm mx-auto text-slate-950 font-khmer-body ${
          activeReport === 'SCORE_ENTRY_GRID' || activeReport === 'SUBJECT_GRADES_RANKINGS'
            ? 'hidden'
            : ''
        } ${isA4PaperPreview ? 'max-w-[1120px]' : 'max-w-full'}`}
      >
        {/* Official Kingdom & Provincial / District / School Header */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="text-xs space-y-0.5 leading-relaxed">
            <div className="font-khmer-moul text-[13px]">
              {schoolProvinceHeader}
            </div>
            <div className="font-semibold">
              {schoolDistrictHeader}
            </div>
            <div className="font-khmer-moul text-[13px]">
              {schoolNameHeader}
            </div>
          </div>

          <div className="text-right flex flex-col items-end justify-start">
            <div className="text-center">
              <div className="font-khmer-moul text-sm">ព្រះរាជាណាចក្រកម្ពុជា</div>
              <div className="font-khmer-moul text-xs mt-0.5">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              <div className="text-xs tracking-widest mt-0.5">〜〜〜❖〜〜〜</div>
            </div>
          </div>
        </div>

        {/* REPORT 1: បញ្ជីរាយនាមសិស្សតាមថ្នាក់ (Class Student Roster - e.g., 12C, 2026–2027) */}
        {activeReport === 'CLASS_ROSTER' && (
          <div className="space-y-4">
            <div className="text-center space-y-1 mb-4">
              <h3 className="font-khmer-moul text-base">
                បញ្ជីរាយនាមសិស្សថ្នាក់ទី {currentClass.ClassName} ឆ្នាំសិក្សា {selectedAcademicYear}
              </h3>
              <p className="text-xs text-slate-700">
                គ្រូបន្ទុកថ្នាក់៖ <strong>{homeroomTeacher?.FullNameKh || 'ជួន លីរតនៈ'}</strong>
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="print-table w-full border-collapse border border-slate-900 text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-center font-bold">
                    <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 w-7">ល.រ</th>
                    <th rowSpan={2} className="border border-slate-900 py-1.5 px-1.5 w-14">អត្តលេខ</th>
                    <th colSpan={2} className="border border-slate-900 py-1.5 px-2">គោត្តនាម និង នាមខ្លួន</th>
                    <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 w-10">ភេទ</th>
                    <th rowSpan={2} className="border border-slate-900 py-1.5 px-1.5 w-22">ថ្ងៃខែឆ្នាំកំណើត</th>
                    <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 w-14">អាយុ</th>
                    <th colSpan={3} className="border border-slate-900 py-1 px-1">កំព្រា</th>
                    <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 w-10">ពិការ</th>
                    <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 w-12">ក្រីក្រ</th>
                    <th rowSpan={2} className="border border-slate-900 py-1.5 px-2">មកពីសាលា</th>
                    <th rowSpan={2} className="border border-slate-900 py-1.5 px-1.5 w-24">លេខទូរស័ព្ទ</th>
                    <th rowSpan={2} className="border border-slate-900 py-1.5 px-2">ផ្សេងៗ</th>
                  </tr>
                  <tr className="bg-slate-100 text-center font-bold">
                    <th className="border border-slate-900 py-1 px-2">គោត្តនាម</th>
                    <th className="border border-slate-900 py-1 px-2">នាមខ្លួន</th>
                    <th className="border border-slate-900 py-1 px-1 w-10">ឪពុក</th>
                    <th className="border border-slate-900 py-1 px-1 w-10">ម្តាយ</th>
                    <th className="border border-slate-900 py-1 px-1 w-14">ឪពុក/ម្តាយ</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((st, idx) => {
                    const age = calculateStudentAge(st.DateOfBirth, 2026);
                    return (
                      <tr key={st.StudentID} className="hover:bg-slate-50">
                        <td className="border border-slate-900 py-0.5 px-1 text-center tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-900 py-0.5 px-1.5 text-center font-mono-tabular">
                          {st.StudentCode}
                        </td>
                        <td className="border border-slate-900 py-0.5 px-2 font-semibold">
                          {st.LastNameKh}
                        </td>
                        <td className="border border-slate-900 py-0.5 px-2 font-semibold">
                          {st.FirstNameKh}
                        </td>
                        <td className="border border-slate-900 py-0.5 px-1 text-center">
                          {st.Gender}
                        </td>
                        <td className="border border-slate-900 py-0.5 px-1.5 text-center font-mono-tabular">
                          {formatDateKhmerDisplay(st.DateOfBirth)}
                        </td>
                        <td className="border border-slate-900 py-0.5 px-1 text-center tabular-nums">
                          {age} ឆ្នាំ
                        </td>
                        <td className="border border-slate-900 py-0.5 px-1 text-center font-bold">
                          {st.OrphanStatus === '1' ? '✓' : ''}
                        </td>
                        <td className="border border-slate-900 py-0.5 px-1 text-center font-bold">
                          {st.OrphanStatus === '2' ? '✓' : ''}
                        </td>
                        <td className="border border-slate-900 py-0.5 px-1 text-center font-bold">
                          {st.OrphanStatus === '3' ? '✓' : ''}
                        </td>
                        <td className="border border-slate-900 py-0.5 px-1 text-center font-bold">
                          {st.DisabilityStatus === '4' ? '✓' : ''}
                        </td>
                        <td className="border border-slate-900 py-0.5 px-1 text-center font-semibold">
                          {st.PovertyLevel === 'NONE' ? '' : st.PovertyLevel}
                        </td>
                        <td className="border border-slate-900 py-0.5 px-2">
                          {st.PreviousSchool}
                        </td>
                        <td className="border border-slate-900 py-0.5 px-1.5 text-center font-mono-tabular">
                          {st.Phone}
                        </td>
                        <td className="border border-slate-900 py-0.5 px-2">
                          {st.Remarks}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Official Class Roster Footer Summary: Age (11-20), Orphan, Disability, Poverty */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 text-xs">
              <div className="space-y-2 border border-slate-900 p-3.5 rounded-xs">
                <div className="font-bold text-slate-900">
                  បញ្ឈប់បញ្ជីរាយនាមសិស្សត្រឹមចំនួន ៖ សរុប {toKhmerNumerals(rosterSummary.totalStudents.total)} នាក់ / ស្រី {toKhmerNumerals(rosterSummary.totalStudents.female)} នាក់ (សរុប ៖ 49 នាក់/ស្រី 32 នាក់ សម្រាប់គម្រូដើម ២០២៦-២០២៧)
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  {[11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((age) => {
                    const pair = rosterSummary.ageBreakdown[age];
                    return (
                      <div key={age} className="flex justify-between border-b border-dotted border-slate-300 py-0.5">
                        <span>អាយុ {toKhmerNumerals(age)}ឆ្នាំ ៖</span>
                        <span className="tabular-nums">
                          {pair.total} នាក់/ស្រី {pair.female} នាក់
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-1 space-y-1 text-[11px] border-t border-slate-300">
                  <div>
                    • កំព្រាឪពុក៖ {rosterSummary.orphanFather.total} នាក់/ស្រី {rosterSummary.orphanFather.female} នាក់ · កំព្រាម្តាយ៖ {rosterSummary.orphanMother.total} នាក់/ស្រី {rosterSummary.orphanMother.female} នាក់ · កំព្រាឪពុក/ម្តាយ៖ {rosterSummary.orphanBoth.total} នាក់/ស្រី {rosterSummary.orphanBoth.female} នាក់
                  </div>
                  <div>
                    • ពិការ ៖ {rosterSummary.disability.total} នាក់/ស្រី {rosterSummary.disability.female} នាក់ · ក្រីក្រ (ក១៖ {rosterSummary.povertyK1.total}, ក២៖ {rosterSummary.povertyK2.total}, 5៖ {rosterSummary.povertyVulnerable.total})
                  </div>
                </div>
              </div>

              {/* Official Lunar/Solar Date & Dual Signature Block */}
              <div className="flex flex-col justify-between text-center space-y-6">
                <div className="space-y-1 text-xs">
                  <div>{lunarDateFooter}</div>
                  <div>{solarDateFooter}</div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-12">
                    <div className="font-khmer-moul text-xs">បានឃើញ និងឯកភាព<br />នាយកសាលា</div>
                    <div className="font-bold text-xs">{principalNameFooter}</div>
                  </div>
                  <div className="space-y-12">
                    <div className="font-khmer-moul text-xs">គ្រូបន្ទុកថ្នាក់</div>
                    <div className="font-bold text-xs">{homeroomTeacher?.FullNameKh || 'ជួន លីរតនៈ'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORT 2 & 4 (AND PRINT FALLBACK FOR SCORE_ENTRY_GRID): MONTHLY & ANNUAL RANKING TABLES IN 2-COLUMN SPLIT (1-35 AND 36-70) */}
        {(activeReport === 'MONTHLY_RANKING' ||
          activeReport === 'ANNUAL_RANKING' ||
          activeReport === 'SCORE_ENTRY_GRID') && (
          <div className="space-y-4">
            <div className="text-center space-y-1 mb-3">
              <h3 className="font-khmer-moul text-base">
                {activeReport === 'ANNUAL_RANKING' ||
                (activeReport === 'SCORE_ENTRY_GRID' && selectedPeriodMode === 'ANNUAL')
                  ? `តារាងចំណាត់ថ្នាក់ប្រចាំឆ្នាំ ថ្នាក់ទី ${currentClass.ClassName} ឆ្នាំសិក្សា ${selectedAcademicYear}`
                  : `តារាងចំណាត់ថ្នាក់ប្រចាំខែ${selectedMonth} ថ្នាក់ទី ${currentClass.ClassName} ឆ្នាំសិក្សា ${selectedAcademicYear}`}
              </h3>
              <p className="text-xs text-slate-700">
                ទម្រង់បំបែក ២ ជួរឈរ (១–៣៥ និង ៣៦–៧០) · បន្ថែមបុព្វបទ &quot;ក.&quot; ដោយស្វ័យប្រវត្តិសម្រាប់សិស្សស្រី
              </p>
            </div>

            {/* 2-Column Split Table: Left 1-35, Right 36-70 (Side-by-Side on Screen and A4 Print) */}
            <div className="print-two-col-grid grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[
                { title: 'ផ្នែកទី១ (ល.រ ១ ដល់ ៣៥)', rows: twoColumnSplit.leftColumn },
                { title: 'ផ្នែកទី២ (ល.រ ៣៦ ដល់ ៧០)', rows: twoColumnSplit.rightColumn },
              ].map((colGroup, groupIdx) => (
                <div key={groupIdx} className="overflow-x-auto">
                  <table className="print-table w-full border-collapse border border-slate-900 text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 text-center font-bold">
                        <th className="border border-slate-900 py-1 px-1 w-7">ល.</th>
                        <th className="border border-slate-900 py-1 px-1.5 w-13">ID</th>
                        <th className="border border-slate-900 py-1 px-2 text-left">គោត្តនាម និងនាម</th>
                        <th className="border border-slate-900 py-1 px-1.5 w-14">ម.ភាគ</th>
                        <th className="border border-slate-900 py-1 px-1.5 w-20">ចំ.ថ្នាក់</th>
                        <th className="border border-slate-900 py-1 px-1.5 w-18">និទ្ទេស</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colGroup.rows.map(({ slotNumber, entry }) => (
                        <tr
                          key={slotNumber}
                          className={`h-6 ${
                            entry?.isUnranked
                              ? 'bg-amber-50/70'
                              : entry?.isHonorRoll
                              ? 'bg-emerald-50/40'
                              : ''
                          }`}
                        >
                          <td className="border border-slate-900 py-0.5 px-1 text-center font-mono-tabular">
                            {slotNumber}
                          </td>
                          <td className="border border-slate-900 py-0.5 px-1.5 text-center font-mono-tabular">
                            {entry ? entry.studentCode : ''}
                          </td>
                          <td className="border border-slate-900 py-0.5 px-2 font-semibold">
                            {entry ? entry.displayNameRanking : ''}
                          </td>
                          <td className="border border-slate-900 py-0.5 px-1.5 text-right font-mono-tabular">
                            {entry
                              ? entry.isUnranked
                                ? '-1.72'
                                : entry.averageScore?.toFixed(2)
                              : ''}
                          </td>
                          <td className="border border-slate-900 py-0.5 px-1.5 text-center font-mono-tabular font-bold whitespace-nowrap">
                            {entry
                              ? entry.isUnranked
                                ? `${entry.bottomGroupRank} (មិនចាត់ថ្នាក់)`
                                : entry.ranking
                              : ''}
                          </td>
                          <td
                            className={`border border-slate-900 py-0.5 px-1.5 text-center font-bold whitespace-nowrap ${
                              entry?.grade === 'F' || entry?.isUnranked
                                ? 'text-red-700'
                                : 'text-slate-900'
                            }`}
                          >
                            {entry ? entry.grade : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* Official Ranking Summary Footer Table (សរុប / ស្រី & Grades A-F) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-3 items-start text-xs">
              <div className="md:col-span-7 space-y-2">
                <div className="font-bold">
                  បញ្ឈប់បញ្ជីឈ្មោះសិស្សត្រឹមចំនួន ៖ សរុប {toKhmerNumerals(rankingStats.totalStudents.total)} នាក់ / ស្រី {toKhmerNumerals(rankingStats.totalStudents.female)} នាក់ ({rankingStats.totalStudents.total} / ស្រី {rankingStats.totalStudents.female})
                </div>

                <table className="print-table w-full border-collapse border border-slate-900 text-[11px] text-center">
                  <thead>
                    <tr className="bg-slate-100 font-bold">
                      <th className="border border-slate-900 py-1 px-2 text-left">ផ្នែកបូកសរុបលទ្ធផល</th>
                      <th className="border border-slate-900 py-1 px-2">សរុប</th>
                      <th className="border border-slate-900 py-1 px-2">ស្រី</th>
                      <th className="border border-slate-900 py-1 px-2">និទ្ទេស A</th>
                      <th className="border border-slate-900 py-1 px-2">និទ្ទេស B</th>
                      <th className="border border-slate-900 py-1 px-2">និទ្ទេស C</th>
                      <th className="border border-slate-900 py-1 px-2">និទ្ទេស D</th>
                      <th className="border border-slate-900 py-1 px-2">និទ្ទេស E</th>
                      <th className="border border-slate-900 py-1 px-2">និទ្ទេស F</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    <tr>
                      <td className="border border-slate-900 py-1 px-2 text-left font-semibold">
                        ជាប់មធ្យមភាគ ({rankingStats.passed.total}/{rankingStats.passed.female})
                      </td>
                      <td className="border border-slate-900 py-1 px-2 font-bold">
                        {rankingStats.passed.total}
                      </td>
                      <td className="border border-slate-900 py-1 px-2">
                        {rankingStats.passed.female}
                      </td>
                      <td className="border border-slate-900 py-1 px-2">
                        {rankingStats.grades.A.total} / {rankingStats.grades.A.female}
                      </td>
                      <td className="border border-slate-900 py-1 px-2">
                        {rankingStats.grades.B.total} / {rankingStats.grades.B.female}
                      </td>
                      <td className="border border-slate-900 py-1 px-2">
                        {rankingStats.grades.C.total} / {rankingStats.grades.C.female}
                      </td>
                      <td className="border border-slate-900 py-1 px-2">
                        {rankingStats.grades.D.total} / {rankingStats.grades.D.female}
                      </td>
                      <td className="border border-slate-900 py-1 px-2">
                        {rankingStats.grades.E.total} / {rankingStats.grades.E.female}
                      </td>
                      <td className="border border-slate-900 py-1 px-2">
                        {rankingStats.grades.F.total} / {rankingStats.grades.F.female}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-900 py-1 px-2 text-left font-semibold">
                        ធ្លាក់មធ្យមភាគ
                      </td>
                      <td className="border border-slate-900 py-1 px-2 font-bold text-red-700">
                        {rankingStats.failed.total}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 text-red-700">
                        {rankingStats.failed.female}
                      </td>
                      <td colSpan={6} className="border border-slate-900 py-1 px-2 text-left">
                        មិនចាត់ថ្នាក់ ៖ សរុប {rankingStats.unranked.total} នាក់ / ស្រី {rankingStats.unranked.female} នាក់ (Rank {rankedEntries[0]?.bottomGroupRank || 51})
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="md:col-span-5 text-center space-y-4">
                <div className="text-xs space-y-0.5">
                  <div>{lunarDateFooter}</div>
                  <div>{solarDateFooter}</div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="space-y-10">
                    <div className="font-khmer-moul text-xs">បានឃើញ និងឯកភាព<br />នាយកសាលា</div>
                    <div className="font-bold text-xs">{principalNameFooter}</div>
                  </div>
                  <div className="space-y-10">
                    <div className="font-khmer-moul text-xs">គ្រូបន្ទុកថ្នាក់</div>
                    <div className="font-bold text-xs">{homeroomTeacher?.FullNameKh || 'ជួន លីរតនៈ'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORT 3 & 5: តារាងកិត្តិយសប្រចាំខែ & ប្រចាំឆ្នាំ (TOP 5 5-PHOTO PYRAMID LAYOUT) */}
        {isHonorTabActive && (
          <div className="space-y-6">
            <div className="text-center space-y-1.5">
              <h3 className="font-khmer-moul text-lg">
                {activeReport === 'MONTHLY_HONOR_ROLL'
                  ? `តារាងកិត្តិយសប្រចាំ ខែ ${selectedMonth} ថ្នាក់ទី ${currentClass.ClassName} ឆ្នាំសិក្សា៖ ${selectedAcademicYear}`
                  : `តារាងកិត្តិយសប្រចាំឆ្នាំ ថ្នាក់ទី ${currentClass.ClassName} ឆ្នាំសិក្សា៖ ${selectedAcademicYear}`}
              </h3>
            </div>

            {/* 5-Photo Pyramid Layout: Row 1 (Rank 1 Center), Row 2 (Rank 2 & 3), Row 3 (Rank 4 & 5) */}
            <div className="space-y-6 py-2 max-w-3xl mx-auto">
              {/* Row 1 (Center): លេខ ១ (ក. រឺ យូរៀន) */}
              <div className="flex justify-center">
                {renderHonorCard(top5HonorStudents[0], 1)}
              </div>

              {/* Row 2 (Left & Right): លេខ ២ (មេឃ សីហាក់) & លេខ ៣ (ក. ភឿន លីសៀន) */}
              <div className="print-pyramid-row grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
                {renderHonorCard(top5HonorStudents[1], 2)}
                {renderHonorCard(top5HonorStudents[2], 3)}
              </div>

              {/* Row 3 (Left & Right): លេខ ៤ (លឿន វិសាល) & លេខ ៥ (ក. ភើយ ឡាពីន) */}
              <div className="print-pyramid-row grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
                {renderHonorCard(top5HonorStudents[3], 4)}
                {renderHonorCard(top5HonorStudents[4], 5)}
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-6 pt-4 text-center text-xs">
              <div className="space-y-12 pt-4">
                <div className="font-khmer-moul">បានឃើញ និងឯកភាព<br />នាយកសាលា</div>
                <div className="font-bold">{principalNameFooter}</div>
              </div>
              <div className="space-y-4">
                <div className="space-y-0.5">
                  <div>{lunarDateFooter}</div>
                  <div>{solarDateFooter}</div>
                </div>
                <div className="space-y-12 pt-2">
                  <div className="font-khmer-moul">គ្រូទទួលបន្ទុកថ្នាក់</div>
                  <div className="font-bold">{homeroomTeacher?.FullNameKh || 'ជួន លីរតនៈ'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const OfficialReportsView = OfficialReportsPage;
