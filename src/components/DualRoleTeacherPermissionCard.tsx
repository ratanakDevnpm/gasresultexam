import React, { useMemo, useState } from 'react';
import { DatabaseState } from '../types/database';
import {
  DUAL_ROLE_POLICY_STATEMENT_KH,
  HOMEROOM_TEACHER_PERMISSIONS_KH,
  HOMEROOM_TEACHER_ROLE_TITLE_KH,
  SUBJECT_TEACHER_PERMISSIONS_KH,
  SUBJECT_TEACHER_ROLE_TITLE_KH,
  evaluateTeacherAccountPermissions,
} from '../lib/teacherRolePermissions';
import {
  saveHomeroomTeacherAssignment,
  saveTeacherSubjectClassAssignments,
} from '../lib/domainRules';
import {
  Award,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Layers,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';

interface DualRoleTeacherPermissionCardProps {
  db: DatabaseState;
  setDb?: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId?: string;
  academicYearId?: string;
  compact?: boolean;
}

export const DualRoleTeacherPermissionCard: React.FC<
  DualRoleTeacherPermissionCardProps
> = ({
  db,
  setDb,
  activeUserId = 'USR-TCH-12C',
  academicYearId = 'AY-2025-2026',
  compact = false,
}) => {
  const teacherUsers = useMemo(
    () =>
      db.Users.filter(
        (u) =>
          u.Status === 'ACTIVE' &&
          (u.RoleID === 'ROL-03' ||
            (u.AssignedRoles &&
              (u.AssignedRoles.includes('TEACHER') ||
                u.AssignedRoles.includes('HOMEROOM_TEACHER'))))
      ),
    [db.Users]
  );

  const defaultSelectedTeacherId = useMemo(() => {
    if (teacherUsers.some((t) => t.UserID === activeUserId)) {
      return activeUserId;
    }
    return teacherUsers[0]?.UserID || 'USR-TCH-12C';
  }, [teacherUsers, activeUserId]);

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    defaultSelectedTeacherId
  );
  const [inspectClassId, setInspectClassId] = useState<string>('CLS-12C');
  const [inspectSubjectId, setInspectSubjectId] = useState<string>('SUB-ICT');
  const [feedbackMessageKh, setFeedbackMessageKh] = useState<string>('');

  const evaluation = useMemo(
    () =>
      evaluateTeacherAccountPermissions(
        db,
        selectedTeacherId,
        academicYearId === 'ALL' ? 'AY-2025-2026' : academicYearId
      ),
    [db, selectedTeacherId, academicYearId]
  );

  const activeClasses = useMemo(
    () => db.Classes.filter((c) => c.Status === 'ACTIVE'),
    [db.Classes]
  );
  const activeSubjects = useMemo(
    () => db.Subjects.filter((s) => s.Status === 'ACTIVE'),
    [db.Subjects]
  );

  const handleQuickAssignHomeroomToSelectedClass = () => {
    if (!setDb) return;
    const effectiveAy =
      academicYearId === 'ALL' ? 'AY-2025-2026' : academicYearId;
    const res = saveHomeroomTeacherAssignment(
      db,
      {
        teacherId: selectedTeacherId,
        academicYearId: effectiveAy,
        classId: inspectClassId,
        status: 'ACTIVE',
      },
      'USR-001'
    );
    if (res.ok) {
      setDb(res.updatedDb);
      setFeedbackMessageKh(res.messageKh);
    } else {
      setFeedbackMessageKh(res.messageKh);
    }
  };

  const handleQuickAssignSubjectInSelectedClass = () => {
    if (!setDb) return;
    const effectiveAy =
      academicYearId === 'ALL' ? 'AY-2025-2026' : academicYearId;
    const currentAssignments = db.TeacherSubjectAssignments.filter(
      (a) =>
        a.TeacherID === selectedTeacherId &&
        a.AcademicYearID === effectiveAy &&
        a.Status === 'ACTIVE'
    );

    const nextSubjectClassMap: Record<string, string[]> = {};
    currentAssignments.forEach((a) => {
      if (!nextSubjectClassMap[a.SubjectID]) {
        nextSubjectClassMap[a.SubjectID] = [];
      }
      if (!nextSubjectClassMap[a.SubjectID].includes(a.ClassID)) {
        nextSubjectClassMap[a.SubjectID].push(a.ClassID);
      }
    });
    if (!nextSubjectClassMap[inspectSubjectId]) {
      nextSubjectClassMap[inspectSubjectId] = [];
    }
    if (!nextSubjectClassMap[inspectSubjectId].includes(inspectClassId)) {
      nextSubjectClassMap[inspectSubjectId].push(inspectClassId);
    }

    const res = saveTeacherSubjectClassAssignments(
      db,
      {
        academicYearId: effectiveAy,
        teacherId: selectedTeacherId,
        subjectClassMap: nextSubjectClassMap,
        replaceForYear: false,
      },
      'USR-001'
    );
    if (res.ok) {
      setDb(res.updatedDb);
      setFeedbackMessageKh(res.messageKh);
    } else {
      setFeedbackMessageKh(res.messageKh);
    }
  };

  return (
    <div
      data-testid="dual-role-teacher-policy-section"
      className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
    >
      {/* Top Policy Banner */}
      <div className="bg-gradient-to-r from-[#14171F] via-[#1E293B] to-[#1E3A8A] px-5 py-4 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-300/30 text-amber-200 text-xs font-bold font-khmer-body">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>គោលការណ៍កំណត់សិទ្ធិគ្រូបង្រៀន (Dual-Role Single Account Policy)</span>
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-white font-khmer-title">
              សិទ្ធិប្រើប្រាស់សម្រាប់គ្រូបន្ទុកថ្នាក់ និងគ្រូមុខវិជ្ជាក្នុងគណនីតែមួយ
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-bold font-khmer-body">
              <Award className="w-3.5 h-3.5 text-amber-300" />
              <span>១. គ្រូបន្ទុកថ្នាក់ (៦ សិទ្ធិគោល)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-bold font-khmer-body">
              <BookOpen className="w-3.5 h-3.5 text-emerald-300" />
              <span>២. គ្រូមុខវិជ្ជា (៦ សិទ្ធិគោល)</span>
            </span>
          </div>
        </div>

        {/* Core Policy Rule Statement */}
        <div
          data-testid="dual-role-policy-statement"
          className="mt-3 p-3.5 rounded-xl bg-white/10 border border-white/15 text-xs sm:text-sm text-amber-100 font-bold font-khmer-body leading-relaxed"
        >
          {DUAL_ROLE_POLICY_STATEMENT_KH}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-5 space-y-5">
        {/* Two Side-by-Side Role Specification Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: 1. គ្រូបន្ទុកថ្នាក់ (Homeroom Teacher) */}
          <div
            data-testid="homeroom-teacher-permissions-card"
            className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-amber-200/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body">
                    {HOMEROOM_TEACHER_ROLE_TITLE_KH}
                  </h4>
                  <p className="text-[11px] text-amber-800 font-khmer-body">
                    គ្រប់គ្រងសិស្សតាមថ្នាក់បន្ទុករបស់ខ្លួន និងមុខវិជ្ជាដែលខ្លួនបង្រៀនផ្ទាល់
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-extrabold font-mono-tabular">
                6 សិទ្ធិ
              </span>
            </div>

            <ul className="space-y-2">
              {HOMEROOM_TEACHER_PERMISSIONS_KH.map((perm) => (
                <li
                  key={perm.id}
                  className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-800 font-khmer-body bg-white/90 px-3 py-2 rounded-xl border border-amber-200/60"
                >
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{perm.labelKh}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Card 2: 2. គ្រូមុខវិជ្ជា (Subject Teacher) */}
          <div
            data-testid="subject-teacher-permissions-card"
            className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-emerald-200/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-body">
                    {SUBJECT_TEACHER_ROLE_TITLE_KH}
                  </h4>
                  <p className="text-[11px] text-emerald-800 font-khmer-body">
                    គ្រប់គ្រងពិន្ទុ សំណួរ វិញ្ញាសាប្រឡង និងរបាយការណ៍តាមមុខវិជ្ជាទទួលបន្ទុក
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-extrabold font-mono-tabular">
                6 សិទ្ធិ
              </span>
            </div>

            <ul className="space-y-2">
              {SUBJECT_TEACHER_PERMISSIONS_KH.map((perm) => (
                <li
                  key={perm.id}
                  className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-800 font-khmer-body bg-white/90 px-3 py-2 rounded-xl border border-emerald-200/60"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{perm.labelKh}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Interactive Single-Account Dual-Role Inspector & Assignment Tester */}
        {!compact && (
          <div
            data-testid="dual-role-account-inspector"
            className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  <span>
                    ត្រួតពិនិត្យ និងកំណត់តួនាទីទាំងពីរក្នុងគណនីតែមួយ (Single-Account Dual-Role Inspector)
                  </span>
                </h4>
                <p className="text-xs text-slate-600 font-khmer-body mt-0.5">
                  ជ្រើសរើសគណនីគ្រូបង្រៀន ដើម្បីពិនិត្យសិទ្ធិជា គ្រូបន្ទុកថ្នាក់ និង គ្រូមុខវិជ្ជា ក្នុងគណនីតែមួយ
                </p>
              </div>

              {evaluation.hasBothRolesInSingleAccount ? (
                <span
                  data-testid="dual-role-active-badge"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold font-khmer-body shadow-2xs"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  <span>មានតួនាទីទាំងពីរក្នុងគណនីតែមួយ (គ្រូបន្ទុកថ្នាក់ + គ្រូមុខវិជ្ជា)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold font-khmer-body">
                  <span>{evaluation.roleSummaryLabelKh}</span>
                </span>
              )}
            </div>

            {feedbackMessageKh && (
              <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold font-khmer-body flex items-center justify-between">
                <span>{feedbackMessageKh}</span>
                <button
                  type="button"
                  onClick={() => setFeedbackMessageKh('')}
                  className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Filter & Context Selector Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="dual-role-teacher-select"
                  className="block text-xs font-bold text-slate-700 font-khmer-body mb-1"
                >
                  ១. គណនីគ្រូបង្រៀន (គណនីតែមួយ)
                </label>
                <select
                  id="dual-role-teacher-select"
                  data-testid="dual-role-teacher-select"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 font-khmer-body"
                >
                  {teacherUsers.map((t) => {
                    const ev = evaluateTeacherAccountPermissions(
                      db,
                      t.UserID,
                      academicYearId === 'ALL' ? 'AY-2025-2026' : academicYearId
                    );
                    const tag = ev.hasBothRolesInSingleAccount
                      ? 'គ្រូបន្ទុកថ្នាក់ + គ្រូមុខវិជ្ជា'
                      : ev.isHomeroomTeacher
                      ? 'គ្រូបន្ទុកថ្នាក់'
                      : 'គ្រូមុខវិជ្ជា';
                    return (
                      <option key={t.UserID} value={t.UserID}>
                        {t.FullNameKh} ({t.UserID}) — [{tag}]
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label
                  htmlFor="dual-role-class-select"
                  className="block text-xs font-bold text-slate-700 font-khmer-body mb-1"
                >
                  ២. ថ្នាក់រៀនសម្រាប់ផ្ទៀងផ្ទាត់សិទ្ធិ
                </label>
                <select
                  id="dual-role-class-select"
                  data-testid="dual-role-class-select"
                  value={inspectClassId}
                  onChange={(e) => setInspectClassId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 font-khmer-body"
                >
                  {activeClasses.map((c) => (
                    <option key={c.ClassID} value={c.ClassID}>
                      ថ្នាក់ទី {c.ClassName} ({c.ClassID})
                      {evaluation.homeroomClassIds.includes(c.ClassID)
                        ? ' ★ [ថ្នាក់បន្ទុករបស់ខ្លួន]'
                        : evaluation.taughtClassIds.includes(c.ClassID)
                        ? ' • [ថ្នាក់ដែលខ្លួនបង្រៀន]'
                        : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="dual-role-subject-select"
                  className="block text-xs font-bold text-slate-700 font-khmer-body mb-1"
                >
                  ៣. មុខវិជ្ជាសម្រាប់ផ្ទៀងផ្ទាត់សិទ្ធិ
                </label>
                <select
                  id="dual-role-subject-select"
                  data-testid="dual-role-subject-select"
                  value={inspectSubjectId}
                  onChange={(e) => setInspectSubjectId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 font-khmer-body"
                >
                  {activeSubjects.map((s) => (
                    <option key={s.SubjectID} value={s.SubjectID}>
                      {s.SubjectNameKh} ({s.SubjectID})
                      {evaluation.taughtSubjectIds.includes(s.SubjectID)
                        ? ' ★ [មុខវិជ្ជាដែលខ្លួនបង្រៀន]'
                        : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Scopes Summary for Selected Teacher */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 font-khmer-body flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600" />
                    <span>តួនាទីទី១៖ គ្រូបន្ទុកថ្នាក់ (Homeroom Scope)</span>
                  </span>
                  {setDb &&
                    !evaluation.homeroomClassIds.includes(inspectClassId) && (
                      <button
                        type="button"
                        onClick={handleQuickAssignHomeroomToSelectedClass}
                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold font-khmer-body cursor-pointer"
                      >
                        + ចាត់តាំងជាគ្រូបន្ទុកថ្នាក់នេះ
                      </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {evaluation.homeroomClasses.length > 0 ? (
                    evaluation.homeroomClasses.map((cls) => (
                      <span
                        key={cls.ClassID}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold font-khmer-body"
                      >
                        <GraduationCap className="w-3.5 h-3.5 text-amber-700" />
                        <span>ថ្នាក់បន្ទុក៖ {cls.ClassName}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 font-khmer-body">
                      មិនទាន់មានថ្នាក់បន្ទុក
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 font-khmer-body flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>តួនាទីទី២៖ គ្រូមុខវិជ្ជា (Subject Teacher Scope)</span>
                  </span>
                  {setDb &&
                    !evaluation.canEditSubjectScoreInClass(
                      inspectSubjectId,
                      inspectClassId
                    ) && (
                      <button
                        type="button"
                        onClick={handleQuickAssignSubjectInSelectedClass}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold font-khmer-body cursor-pointer"
                      >
                        + ចាត់តាំងបង្រៀនមុខវិជ្ជានេះ
                      </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {evaluation.taughtSubjects.length > 0 ? (
                    evaluation.taughtSubjects.map((sub) => {
                      const clsList =
                        evaluation.classesBySubjectId[sub.SubjectID] || [];
                      return (
                        <span
                          key={sub.SubjectID}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold font-khmer-body"
                        >
                          <Layers className="w-3.5 h-3.5 text-emerald-700" />
                          <span>
                            {sub.SubjectNameKh} (
                            {clsList.map((c) => c.ClassName).join(', ') || '-'})
                          </span>
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-500 font-khmer-body">
                      មិនទាន់មានមុខវិជ្ជាបង្រៀន
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Live Action-Level Evaluation Grid for Selected Class + Subject */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {[
                {
                  labelKh: 'គ្រប់គ្រងបញ្ជីសិស្សក្នុងថ្នាក់របស់ខ្លួន',
                  roleTag: 'គ្រូបន្ទុកថ្នាក់',
                  allowed:
                    evaluation.canManageStudentRosterInClass(inspectClassId),
                },
                {
                  labelKh: 'មើល និងតាមដានពិន្ទុគ្រប់មុខវិជ្ជា និងចំណាត់ថ្នាក់សិស្ស',
                  roleTag: 'គ្រូបន្ទុកថ្នាក់',
                  allowed:
                    evaluation.canViewAllSubjectScoresInClass(inspectClassId) &&
                    evaluation.canTrackClassResultAndRanking(inspectClassId),
                },
                {
                  labelKh: 'បង្កើត និងបោះពុម្ពរបាយការណ៍ថ្នាក់',
                  roleTag: 'គ្រូបន្ទុកថ្នាក់',
                  allowed: evaluation.canPrintClassReport(inspectClassId),
                },
                {
                  labelKh: 'មើលថ្នាក់ និងបញ្ជីសិស្សដែលខ្លួនបង្រៀន',
                  roleTag: 'គ្រូមុខវិជ្ជា / គ្រូបន្ទុកថ្នាក់',
                  allowed: evaluation.canViewStudentListInClass(inspectClassId),
                },
                {
                  labelKh: 'បញ្ចូល និងកែប្រែពិន្ទុតាមមុខវិជ្ជាដែលខ្លួនបង្រៀន',
                  roleTag: 'គ្រូបន្ទុកថ្នាក់ / គ្រូមុខវិជ្ជា',
                  allowed: evaluation.canEditSubjectScoreInClass(
                    inspectSubjectId,
                    inspectClassId
                  ),
                },
                {
                  labelKh:
                    'បង្កើតសំណួរ រៀបចំវិញ្ញាសាប្រឡងអនឡាញ និងបោះពុម្ពរបាយការណ៍មុខវិជ្ជា',
                  roleTag: 'គ្រូបន្ទុកថ្នាក់ / គ្រូមុខវិជ្ជា',
                  allowed:
                    evaluation.canManageQuestionsAndExamsForSubject(
                      inspectSubjectId,
                      inspectClassId
                    ) &&
                    evaluation.canViewAndPrintSubjectReport(
                      inspectSubjectId,
                      inspectClassId
                    ),
                },
              ].map((checkItem, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-khmer-body ${
                    checkItem.allowed
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/60 border-rose-200 text-rose-900'
                  }`}
                >
                  {checkItem.allowed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold leading-snug">
                      {checkItem.labelKh}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      [{checkItem.roleTag}] —{' '}
                      {checkItem.allowed ? 'អនុញ្ញាត (Allowed)' : 'បដិសេធ (Denied)'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
