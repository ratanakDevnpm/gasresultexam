import React, { useEffect, useMemo, useState } from 'react';
import {
  DatabaseState,
  GenderKh,
  RoleName,
} from '../types/database';
import {
  createOrUpdateTeacherAccount,
  getRegisteredTeachersWithAssignments,
  RegisteredTeacherSummary,
  saveHomeroomTeacherAssignment,
  saveTeacherSpecializationsAndRoles,
  saveTeacherSubjectClassAssignments,
  setTeacherAccountStatus,
} from '../lib/domainRules';
import { DataService } from '../lib/centralizedDataService';
import { invokeGasApi } from '../lib/gasBridge';
import { DualRoleTeacherPermissionCard } from './DualRoleTeacherPermissionCard';
import {
  OFFICIAL_TEOK_CHOR_DUTY_ROSTER_2026_2027,
  OfficialStaffDutyRecord,
  PAGE2_SUBJECT_FRAMEWORK_STATS,
  STAFF_DUTY_SECTIONS_META,
  StaffDutySectionId,
  toKhmerDigits,
} from '../lib/teacherDutyRosterData';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Filter,
  GraduationCap,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';

interface TeacherManagementViewProps {
  db: DatabaseState;
  setDb: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  externalSearchQuery?: string;
  onSelectUser?: (userId: string) => void;
  onNavigateSection?: (section: string) => void;
}

export const TeacherManagementView: React.FC<TeacherManagementViewProps> = ({
  db,
  setDb,
  activeUserId,
  externalSearchQuery = '',
  onSelectUser,
  onNavigateSection,
}) => {
  const [activeSubView, setActiveSubView] = useState<
    'TEACHER_LIST' | 'ASSIGNMENT_MANAGER' | 'HOMEROOM_AND_SPECIALIZATIONS'
  >('TEACHER_LIST');

  // Filters for Teacher List & Duty Roster
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('AY-2025-2026');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [sectionFilter, setSectionFilter] = useState<'ALL' | StaffDutySectionId>('ALL');
  const [frameworkFilter, setFrameworkFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Synchronization state (Loading / Success / Error)
  const [syncState, setSyncState] = useState<{
    status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
    messageKh: string;
    timestamp?: string;
  }>({
    status: 'IDLE',
    messageKh: 'ទិន្នន័យគ្រូបង្រៀន មុខវិជ្ជា និងថ្នាក់រៀន ត្រូវបានធ្វើសមកាលកម្មជាមួយប្រព័ន្ធមេ (Single Source of Truth)',
  });

  // Role Confirmation Alert Pop-up State
  const [isRoleConfirmPopupOpen, setIsRoleConfirmPopupOpen] = useState<boolean>(false);
  const [rolePopupTeacherId, setRolePopupTeacherId] = useState<string>(activeUserId);

  // Add / Edit Teacher Modal State
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState<boolean>(false);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [formFullNameKh, setFormFullNameKh] = useState<string>('');
  const [formFullNameEn, setFormFullNameEn] = useState<string>('');
  const [formUsername, setFormUsername] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formGender, setFormGender] = useState<GenderKh>('ប្រុស');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formPassword, setFormPassword] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formHomeroomClassId, setFormHomeroomClassId] = useState<string>('');
  const [formInitialSubjectIds, setFormInitialSubjectIds] = useState<string[]>(['SUB-ICT']);
  const [formInitialClassIds, setFormInitialClassIds] = useState<string[]>(['CLS-12C']);
  const [formErrorKh, setFormErrorKh] = useState<string>('');

  // 5-Step Teacher-Subject-Class Assignment Manager State
  const [assignAcademicYearId, setAssignAcademicYearId] = useState<string>('AY-2025-2026');
  const [assignTeacherId, setAssignTeacherId] = useState<string>('USR-TCH-12C');
  const [assignSubjectClassMap, setAssignSubjectClassMap] = useState<Record<string, string[]>>({});

  // Homeroom Teacher Assignment & Multi-Subject Specialization Manager State
  const [homeroomAcademicYearId, setHomeroomAcademicYearId] = useState<string>('AY-2025-2026');
  const [homeroomClassId, setHomeroomClassId] = useState<string>('CLS-12C');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState<string>('USR-TCH-12C');
  const [homeroomStartDate, setHomeroomStartDate] = useState<string>('2025-11-01');
  const [homeroomEndDate, setHomeroomEndDate] = useState<string>('2026-08-31');
  const [homeroomStatus, setHomeroomStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [homeroomSearch, setHomeroomSearch] = useState<string>('');

  const [specTeacherId, setSpecTeacherId] = useState<string>('USR-TCH-12C');
  const [specSelectedSubjectIds, setSpecSelectedSubjectIds] = useState<string[]>(['SUB-ICT', 'SUB-MATH']);
  const [specSelectedRoles, setSpecSelectedRoles] = useState<RoleName[]>(['TEACHER', 'HOMEROOM_TEACHER']);

  const activeUser = useMemo(
    () => db.Users.find((u) => u.UserID === activeUserId),
    [db.Users, activeUserId]
  );
  const activeRole = useMemo(
    () => db.Roles.find((r) => r.RoleID === activeUser?.RoleID),
    [db.Roles, activeUser]
  );
  const canManageTeachersAndAssignments = activeRole?.RoleName !== 'STUDENT';
  const effectiveAdminActorId =
    activeRole?.RoleName === 'SUPER_ADMIN' || activeRole?.RoleName === 'ADMIN'
      ? activeUserId
      : 'USR-001';

  const activeSubjects = useMemo(
    () => db.Subjects.filter((s) => s.Status === 'ACTIVE'),
    [db.Subjects]
  );
  const activeClasses = useMemo(
    () => db.Classes.filter((c) => c.Status === 'ACTIVE'),
    [db.Classes]
  );

  // Authoritative list of registered teachers with their assignments
  const registeredTeachers = useMemo(
    () => getRegisteredTeachersWithAssignments(db, selectedAcademicYearId),
    [db, selectedAcademicYearId]
  );

  // Synchronize Assignment Manager draft whenever selected teacher or academic year changes
  useEffect(() => {
    const teacherSummary = getRegisteredTeachersWithAssignments(db, assignAcademicYearId).find(
      (t) => t.teacherId === assignTeacherId
    );
    if (!teacherSummary) {
      setAssignSubjectClassMap({});
      return;
    }
    const nextMap: Record<string, string[]> = {};
    teacherSummary.assignedSubjects.forEach((sub) => {
      const clsList = teacherSummary.classesBySubject[sub.SubjectID] || [];
      nextMap[sub.SubjectID] = clsList.map((c) => c.ClassID);
    });
    setAssignSubjectClassMap(nextMap);
  }, [db, assignTeacherId, assignAcademicYearId]);

  // Synchronize Specialization & Role Manager draft when specTeacherId changes
  useEffect(() => {
    const teacherSummary = getRegisteredTeachersWithAssignments(db, 'ALL').find(
      (t) => t.teacherId === specTeacherId
    );
    if (!teacherSummary) return;
    setSpecSelectedSubjectIds(
      teacherSummary.specializedSubjects.map((s) => s.SubjectID)
    );
    setSpecSelectedRoles(
      teacherSummary.effectiveRoles && teacherSummary.effectiveRoles.length > 0
        ? teacherSummary.effectiveRoles
        : ['TEACHER']
    );
  }, [db, specTeacherId]);

  // Filtered teachers for the Teacher List view
  const effectiveSearch = (localSearch || externalSearchQuery).trim().toLowerCase();
  const filteredTeachers = useMemo(() => {
    return registeredTeachers.filter((item) => {
      if (statusFilter !== 'ALL' && item.user.Status !== statusFilter) {
        return false;
      }
      if (
        subjectFilter !== 'ALL' &&
        !item.assignedSubjects.some((s) => s.SubjectID === subjectFilter)
      ) {
        return false;
      }
      if (
        classFilter !== 'ALL' &&
        !item.assignedClasses.some((c) => c.ClassID === classFilter) &&
        !item.homeroomClasses.some((c) => c.ClassID === classFilter)
      ) {
        return false;
      }
      if (effectiveSearch) {
        const hay = [
          item.teacherId,
          item.user.FullNameKh,
          item.user.FullNameEn,
          item.user.Username,
          item.user.Email,
          item.user.Phone,
          ...item.assignedSubjects.map((s) => s.SubjectNameKh),
          ...item.assignedClasses.map((c) => c.ClassName),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(effectiveSearch)) {
          return false;
        }
      }
      return true;
    });
  }, [registeredTeachers, statusFilter, subjectFilter, classFilter, effectiveSearch]);

  // Merge the 46 official Teok Chor High School staff/teacher duty roster records with live registered teachers
  const mergedDutyRoster = useMemo<OfficialStaffDutyRecord[]>(() => {
    const baseRecords = OFFICIAL_TEOK_CHOR_DUTY_ROSTER_2026_2027.map((rec) => {
      if (!rec.linkedUserId) return rec;
      const matchedTeacher = registeredTeachers.find((t) => t.teacherId === rec.linkedUserId);
      if (!matchedTeacher) return rec;
      const homeroomLabel =
        matchedTeacher.homeroomClasses.length > 0
          ? `គ្រូបន្ទុកថ្នាក់ ${matchedTeacher.homeroomClasses.map((c) => c.ClassName).join(', ')}`
          : rec.roleTitleKh;
      return {
        ...rec,
        fullNameKh: matchedTeacher.user.FullNameKh || rec.fullNameKh,
        genderShort: matchedTeacher.user.Gender === 'ស្រី' ? ('ស' as const) : ('ប' as const),
        phone: matchedTeacher.user.Phone || rec.phone,
        roleTitleKh: homeroomLabel,
      };
    });

    const linkedIds = new Set(
      baseRecords.map((r) => r.linkedUserId).filter((id): id is string => Boolean(id))
    );
    const baseNames = new Set(baseRecords.map((r) => r.fullNameKh.trim()));

    const extraRecords: OfficialStaffDutyRecord[] = [];
    registeredTeachers.forEach((t) => {
      if (linkedIds.has(t.teacherId) || baseNames.has(t.user.FullNameKh.trim())) {
        return;
      }
      const nextOrder = baseRecords.length + extraRecords.length + 1;
      const primarySub = t.assignedSubjects[0]?.SubjectNameKh || t.specializedSubjects[0]?.SubjectNameKh || 'ICT';
      const secondSub = t.assignedSubjects[1]?.SubjectNameKh || t.specializedSubjects[1]?.SubjectNameKh || '';
      const subShort = t.assignedSubjects[0]?.SubjectCode?.slice(0, 3) || 'ICT';
      const hasLower = t.assignedClasses.some((c) => ['7', '8', '9'].some((g) => c.ClassName.startsWith(g)));
      const sectionId: StaffDutySectionId = hasLower
        ? 'SECTION_B_TEACHERS_7_8_9'
        : 'SECTION_D_TEACHERS_10_11_12';
      extraRecords.push({
        indexKh: toKhmerDigits(nextOrder),
        orderNumber: nextOrder,
        sectionId,
        civilServantId: t.teacherId,
        fullNameKh: t.user.FullNameKh,
        genderShort: t.user.Gender === 'ស្រី' ? 'ស' : 'ប',
        dobKh: '០១/០១/១៩៩៥',
        roleTitleKh:
          t.homeroomClasses.length > 0
            ? `គ្រូបន្ទុកថ្នាក់ ${t.homeroomClasses.map((c) => c.ClassName).join(', ')}`
            : 'សិក្ខាបនធារី',
        frameworkKh: 'កម្រិតឧត្តម',
        nationalIdNumber: '190899001',
        majorSpec1Kh: primarySub,
        majorSpec2Kh: secondSub,
        salaryScaleKh: 'ក.៣.៤',
        grade7: { subjectCode: '', hours: null },
        grade8: { subjectCode: '', hours: null },
        grade9: { subjectCode: '', hours: null },
        grade10: { subjectCode: '', hours: null },
        grade11: { subjectCode: '', hours: null },
        grade12: { subjectCode: subShort, hours: 12 },
        totalHours: 12,
        phone: t.user.Phone || '',
        linkedUserId: t.teacherId,
      });
    });

    return [...baseRecords, ...extraRecords];
  }, [registeredTeachers]);

  // Filtered duty roster rows
  const filteredDutyRoster = useMemo<OfficialStaffDutyRecord[]>(() => {
    return mergedDutyRoster.filter((row) => {
      if (sectionFilter !== 'ALL' && row.sectionId !== sectionFilter) {
        return false;
      }
      if (frameworkFilter !== 'ALL' && row.frameworkKh !== frameworkFilter) {
        return false;
      }
      if (subjectFilter !== 'ALL') {
        const selectedSub = activeSubjects.find((s) => s.SubjectID === subjectFilter);
        if (selectedSub) {
          const subName = selectedSub.SubjectNameKh.toLowerCase();
          const haySub = `${row.majorSpec1Kh} ${row.majorSpec2Kh}`.toLowerCase();
          if (!haySub.includes(subName) && !(subName.includes('ict') && haySub.includes('ict'))) {
            return false;
          }
        }
      }
      if (classFilter !== 'ALL') {
        const selectedCls = activeClasses.find((c) => c.ClassID === classFilter);
        if (selectedCls) {
          const clsName = selectedCls.ClassName.toLowerCase();
          const gradeNum = clsName.replace(/[^0-9]/g, '');
          const roleMatchesClass = row.roleTitleKh.toLowerCase().includes(clsName);
          const gradeMatch =
            (gradeNum === '7' && row.grade7.hours) ||
            (gradeNum === '8' && row.grade8.hours) ||
            (gradeNum === '9' && row.grade9.hours) ||
            (gradeNum === '10' && row.grade10.hours) ||
            (gradeNum === '11' && row.grade11.hours) ||
            (gradeNum === '12' && row.grade12.hours);
          if (!roleMatchesClass && !gradeMatch) {
            return false;
          }
        }
      }
      if (effectiveSearch) {
        const hay = [
          row.indexKh,
          String(row.orderNumber),
          row.civilServantId,
          row.fullNameKh,
          row.roleTitleKh,
          row.frameworkKh,
          row.nationalIdNumber,
          row.majorSpec1Kh,
          row.majorSpec2Kh,
          row.salaryScaleKh,
          row.phone,
          row.linkedUserId || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(effectiveSearch)) {
          return false;
        }
      }
      return true;
    });
  }, [
    mergedDutyRoster,
    sectionFilter,
    frameworkFilter,
    subjectFilter,
    classFilter,
    activeSubjects,
    activeClasses,
    effectiveSearch,
  ]);

  // Summary KPI counts
  const kpiStats = useMemo(() => {
    const totalTeachers = registeredTeachers.length;
    const activeTeachers = registeredTeachers.filter(
      (t) => t.user.Status === 'ACTIVE'
    ).length;
    const inactiveTeachers = totalTeachers - activeTeachers;
    const totalActiveAssignments = db.TeacherSubjectAssignments.filter(
      (a) =>
        a.Status === 'ACTIVE' &&
        (selectedAcademicYearId === 'ALL' || a.AcademicYearID === selectedAcademicYearId)
    ).length;
    const totalRosterStaff = mergedDutyRoster.length;
    const femaleRosterStaff = mergedDutyRoster.filter((r) => r.genderShort === 'ស').length;
    const totalWeeklyHours = mergedDutyRoster.reduce(
      (sum, r) => sum + (r.totalHours || 0),
      0
    );
    return {
      totalTeachers,
      activeTeachers,
      inactiveTeachers,
      totalActiveAssignments,
      totalRosterStaff,
      femaleRosterStaff,
      totalWeeklyHours,
    };
  }, [registeredTeachers, db.TeacherSubjectAssignments, selectedAcademicYearId, mergedDutyRoster]);

  const handleOpenAddTeacherModal = () => {
    setEditingTeacherId(null);
    setFormFullNameKh('');
    setFormFullNameEn('');
    setFormUsername('');
    setFormEmail('');
    setFormGender('ប្រុស');
    setFormPhone('012 ');
    setFormPassword('');
    setFormStatus('ACTIVE');
    setFormHomeroomClassId('');
    setFormInitialSubjectIds(['SUB-ICT']);
    setFormInitialClassIds(['CLS-12C']);
    setFormErrorKh('');
    setActiveSubView('TEACHER_LIST');
    setIsTeacherModalOpen(true);
  };

  const handleOpenEditTeacherModal = (teacher: RegisteredTeacherSummary) => {
    setEditingTeacherId(teacher.teacherId);
    setFormFullNameKh(teacher.user.FullNameKh);
    setFormFullNameEn(teacher.user.FullNameEn);
    setFormUsername(teacher.user.Username);
    setFormEmail(teacher.user.Email);
    setFormGender(teacher.user.Gender);
    setFormPhone(teacher.user.Phone);
    setFormPassword('');
    setFormStatus(teacher.user.Status);
    setFormHomeroomClassId(teacher.homeroomClasses[0]?.ClassID || '');
    setFormErrorKh('');
    setActiveSubView('TEACHER_LIST');
    setIsTeacherModalOpen(true);
  };

  const handleOpenDutyRowEdit = (row: OfficialStaffDutyRecord) => {
    if (row.linkedUserId) {
      const matched = registeredTeachers.find((t) => t.teacherId === row.linkedUserId);
      if (matched) {
        handleOpenEditTeacherModal(matched);
        return;
      }
    }
    setEditingTeacherId(null);
    setFormFullNameKh(row.fullNameKh);
    setFormFullNameEn(row.fullNameKh);
    setFormUsername(`tch.${row.civilServantId.slice(-4)}`);
    setFormEmail(`tch.${row.civilServantId.slice(-4)}@teokchor.edu.kh`);
    setFormGender(row.genderShort === 'ស' ? 'ស្រី' : 'ប្រុស');
    setFormPhone(row.phone || '012 ');
    setFormPassword('');
    setFormStatus('ACTIVE');
    setFormHomeroomClassId('');
    setFormErrorKh('');
    setActiveSubView('TEACHER_LIST');
    setIsTeacherModalOpen(true);
  };

  const handleOpenAssignForTeacher = (teacherId: string) => {
    setAssignTeacherId(teacherId);
    setActiveSubView('ASSIGNMENT_MANAGER');
    setIsTeacherModalOpen(true);
  };

  const handleManualSyncRefresh = async () => {
    setSyncState({
      status: 'SYNCING',
      messageKh: 'កំពុងធ្វើសមកាលកម្មទិន្នន័យគ្រូបង្រៀន មុខវិជ្ជា និងថ្នាក់រៀនជាមួយ Google Sheets...',
    });
    const res = await invokeGasApi(
      'TeacherService',
      'listTeachersWithAssignments',
      { academicYearId: selectedAcademicYearId },
      () => getRegisteredTeachersWithAssignments(db, selectedAcademicYearId)
    );
    if (res.ok) {
      setSyncState({
        status: 'SUCCESS',
        messageKh: `ធ្វើសមកាលកម្មទិន្នន័យជោគជ័យ (${res.data.length} គ្រូបង្រៀន · ប្រភពទិន្នន័យតែមួយ Single Source of Truth)`,
        timestamp: new Date().toLocaleTimeString('km-KH'),
      });
    } else {
      setSyncState({
        status: 'ERROR',
        messageKh: res.error || 'បរាជ័យក្នុងការធ្វើសមកាលកម្មទិន្នន័យ។ ទិន្នន័យក្នុងម៉ាស៊ីនត្រូវបានរក្សាទុកដោយសុវត្ថិភាព។',
      });
    }
  };

  const handleSaveTeacherModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrorKh('');

    const trimmedNameKh = formFullNameKh.trim();
    const trimmedUsername = formUsername.trim().toLowerCase();

    if (!trimmedNameKh || !trimmedUsername) {
      setFormErrorKh('សូមបំពេញគោត្តនាម-នាមគ្រូ និងឈ្មោះគណនី (Username) ជាមុនសិន។');
      return;
    }

    setSyncState({
      status: 'SYNCING',
      messageKh: 'កំពុងរក្សាទុក និងធ្វើសមកាលកម្មគណនីគ្រូបង្រៀន...',
    });

    const result = createOrUpdateTeacherAccount(
      db,
      {
        teacherId: editingTeacherId || undefined,
        fullNameKh: trimmedNameKh,
        fullNameEn: formFullNameEn.trim() || trimmedNameKh.toUpperCase(),
        username: trimmedUsername,
        email: formEmail.trim() || `${trimmedUsername}@teokchor.edu.kh`,
        gender: formGender,
        phone: formPhone.trim() || '012 000 000',
        password: formPassword.trim() || undefined,
        status: formStatus,
        homeroomClassId: formHomeroomClassId,
        initialAcademicYearId:
          selectedAcademicYearId === 'ALL' ? 'AY-2025-2026' : selectedAcademicYearId,
        initialSubjectIds: !editingTeacherId ? formInitialSubjectIds : undefined,
        initialClassIds: !editingTeacherId ? formInitialClassIds : undefined,
      },
      effectiveAdminActorId
    );

    if (!result.ok) {
      setFormErrorKh(result.messageKh);
      setSyncState({
        status: 'ERROR',
        messageKh: result.messageKh,
      });
      return;
    }

    await invokeGasApi(
      'TeacherService',
      'createOrUpdateTeacher',
      {
        teacherId: result.teacher?.UserID,
        fullNameKh: result.teacher?.FullNameKh,
        fullNameEn: result.teacher?.FullNameEn,
        username: result.teacher?.Username,
        email: result.teacher?.Email,
        gender: result.teacher?.Gender,
        phone: result.teacher?.Phone,
        status: result.teacher?.Status,
      },
      () => result.teacher
    );

    DataService.commitState(setDb, result.updatedDb);
    if (result.teacher?.UserID) {
      setAssignTeacherId(result.teacher.UserID);
    }
    setIsTeacherModalOpen(false);
    setSyncState({
      status: 'SUCCESS',
      messageKh: result.messageKh,
      timestamp: new Date().toLocaleTimeString('km-KH'),
    });
  };

  const handleToggleTeacherStatus = async (teacher: RegisteredTeacherSummary) => {
    const nextStatus = teacher.user.Status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setSyncState({
      status: 'SYNCING',
      messageKh: `កំពុងប្តូរស្ថានភាពគណនីគ្រូ "${teacher.user.FullNameKh}"...`,
    });

    const result = setTeacherAccountStatus(
      db,
      teacher.teacherId,
      nextStatus,
      effectiveAdminActorId
    );
    if (!result.ok) {
      setSyncState({
        status: 'ERROR',
        messageKh: result.messageKh,
      });
      return;
    }

    await invokeGasApi(
      'TeacherService',
      'setTeacherAccountStatus',
      { teacherId: teacher.teacherId, status: nextStatus },
      () => ({ ok: true })
    );

    DataService.commitState(setDb, result.updatedDb);
    setSyncState({
      status: 'SUCCESS',
      messageKh: result.messageKh,
      timestamp: new Date().toLocaleTimeString('km-KH'),
    });
  };

  // Step 3 & 4 Handlers in Assignment Manager
  const handleToggleSubjectInAssignment = (subjectId: string) => {
    setAssignSubjectClassMap((prev) => {
      const next = { ...prev };
      if (next[subjectId]) {
        delete next[subjectId];
      } else {
        // Default to CLS-12C so teacher immediately has at least 1 valid class selected
        next[subjectId] = ['CLS-12C'];
      }
      return next;
    });
  };

  const handleToggleClassForSubject = (subjectId: string, classId: string) => {
    setAssignSubjectClassMap((prev) => {
      const currentClasses = prev[subjectId] || [];
      const exists = currentClasses.includes(classId);
      const nextClasses = exists
        ? currentClasses.filter((c) => c !== classId)
        : [...currentClasses, classId];
      const next = { ...prev };
      if (nextClasses.length === 0) {
        delete next[subjectId];
      } else {
        next[subjectId] = nextClasses;
      }
      return next;
    });
  };

  const handleSelectGrade12ClassesForSubject = (subjectId: string) => {
    setAssignSubjectClassMap((prev) => ({
      ...prev,
      [subjectId]: ['CLS-12A', 'CLS-12B', 'CLS-12C'],
    }));
  };

  const handleSelectAllClassesForSubject = (subjectId: string) => {
    setAssignSubjectClassMap((prev) => ({
      ...prev,
      [subjectId]: activeClasses.map((c) => c.ClassID),
    }));
  };

  const handleSaveAssignments = async () => {
    setSyncState({
      status: 'SYNCING',
      messageKh: 'កំពុងរក្សាទុក និងធ្វើសមកាលកម្មការចាត់តាំងគ្រូ-មុខវិជ្ជា-ថ្នាក់រៀន...',
    });

    const result = saveTeacherSubjectClassAssignments(
      db,
      {
        academicYearId: assignAcademicYearId,
        teacherId: assignTeacherId,
        subjectClassMap: assignSubjectClassMap,
        replaceForYear: true,
      },
      effectiveAdminActorId
    );

    if (!result.ok) {
      setSyncState({
        status: 'ERROR',
        messageKh: result.messageKh,
      });
      return;
    }

    await invokeGasApi(
      'TeacherService',
      'saveTeacherAssignments',
      {
        academicYearId: assignAcademicYearId,
        teacherId: assignTeacherId,
        subjectClassMap: assignSubjectClassMap,
      },
      () => ({ ok: true, count: result.activeAssignmentsCount })
    );

    DataService.commitState(setDb, result.updatedDb);
    setSyncState({
      status: 'SUCCESS',
      messageKh: result.messageKh,
      timestamp: new Date().toLocaleTimeString('km-KH'),
    });
  };

  const selectedAssignTeacher = useMemo(
    () =>
      registeredTeachers.find((t) => t.teacherId === assignTeacherId) ||
      getRegisteredTeachersWithAssignments(db, 'ALL').find(
        (t) => t.teacherId === assignTeacherId
      ),
    [registeredTeachers, db, assignTeacherId]
  );

  const handleSaveHomeroomAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = saveHomeroomTeacherAssignment(
      db,
      {
        teacherId: homeroomTeacherId,
        academicYearId: homeroomAcademicYearId,
        classId: homeroomClassId,
        startDate: homeroomStartDate,
        endDate: homeroomEndDate,
        status: homeroomStatus,
      },
      effectiveAdminActorId
    );
    if (!res.ok) {
      setSyncState({
        status: 'ERROR',
        messageKh: res.messageKh,
      });
      return;
    }
    DataService.commitState(setDb, res.updatedDb);
    setSyncState({
      status: 'SUCCESS',
      messageKh: res.messageKh,
      timestamp: new Date().toLocaleTimeString('km-KH'),
    });
  };

  const handleToggleHomeroomAssignmentStatus = (
    assignmentId: string,
    teacherId: string,
    academicYearId: string,
    classId: string,
    currentStatus: 'ACTIVE' | 'INACTIVE'
  ) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const res = saveHomeroomTeacherAssignment(
      db,
      {
        assignmentId,
        teacherId,
        academicYearId,
        classId,
        status: nextStatus,
      },
      effectiveAdminActorId
    );
    if (!res.ok) {
      setSyncState({ status: 'ERROR', messageKh: res.messageKh });
      return;
    }
    DataService.commitState(setDb, res.updatedDb);
    setSyncState({
      status: 'SUCCESS',
      messageKh: res.messageKh,
      timestamp: new Date().toLocaleTimeString('km-KH'),
    });
  };

  const handleSaveSpecializationsAndRoles = () => {
    const res = saveTeacherSpecializationsAndRoles(
      db,
      {
        teacherId: specTeacherId,
        subjectIds: specSelectedSubjectIds,
        assignedRoles: specSelectedRoles,
      },
      effectiveAdminActorId
    );
    if (!res.ok) {
      setSyncState({ status: 'ERROR', messageKh: res.messageKh });
      return;
    }
    DataService.commitState(setDb, res.updatedDb);
    setSyncState({
      status: 'SUCCESS',
      messageKh: res.messageKh,
      timestamp: new Date().toLocaleTimeString('km-KH'),
    });
  };

  const filteredHomeroomAssignments = useMemo(() => {
    const rows = db.HomeroomTeacherAssignments || [];
    const q = homeroomSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (
        homeroomAcademicYearId !== 'ALL' &&
        r.AcademicYearID !== homeroomAcademicYearId
      ) {
        return false;
      }
      if (!q) return true;
      const teacher = db.Users.find((u) => u.UserID === r.TeacherID);
      const cls = db.Classes.find((c) => c.ClassID === r.ClassID);
      const hay = `${r.AssignmentID} ${r.TeacherID} ${teacher?.FullNameKh || ''} ${
        cls?.ClassName || ''
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [db.HomeroomTeacherAssignments, db.Users, db.Classes, homeroomAcademicYearId, homeroomSearch]);

  return (
    <div className="space-y-5">
      {/* =====================================================================
          1. TOP HEADER & SUB-VIEW SWITCHER (បញ្ជីគ្រូបង្រៀន | ការចាត់តាំងមុខវិជ្ជា-ថ្នាក់)
         ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-khmer-moul">
              បញ្ជីគ្រូ
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            {canManageTeachersAndAssignments && (
              <button
                type="button"
                data-testid="open-add-teacher-modal-btn"
                onClick={handleOpenAddTeacherModal}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>បន្ថែមគ្រូបង្រៀនថ្មី</span>
              </button>
            )}

            <button
              type="button"
              data-testid="open-role-confirm-popup-btn"
              onClick={() => {
                setRolePopupTeacherId(activeUserId);
                setIsRoleConfirmPopupOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>បញ្ជាក់តួនាទី</span>
            </button>

            <button
              type="button"
              onClick={handleManualSyncRefresh}
              title="ធ្វើសមកាលកម្មទិន្នន័យជាមួយ Google Sheets"
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-blue-600 ${
                  syncState.status === 'SYNCING' ? 'animate-spin' : ''
                }`}
              />
              <span>ធ្វើសមកាលកម្ម</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>បោះពុម្ព</span>
            </button>
          </div>
        </div>

        {/* Live Synchronization Status Bar */}
        <div
          data-testid="teacher-sync-status-banner"
          className={`mt-4 px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs font-khmer-body no-print ${
            syncState.status === 'ERROR'
              ? 'bg-rose-50/80 border-rose-200 text-rose-800'
              : syncState.status === 'SYNCING'
              ? 'bg-blue-50/80 border-blue-200 text-blue-800'
              : syncState.status === 'SUCCESS'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
              : 'bg-slate-50 border-slate-200/80 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncState.status === 'SYNCING' ? (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            ) : syncState.status === 'ERROR' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span className="font-semibold">{syncState.messageKh}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono-tabular">
            Sheet: Users (ROL-03) &amp; TeacherSubjectAssignments
            {syncState.timestamp ? ` · ${syncState.timestamp}` : ''}
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. SUMMARY KPI ROW (4 ESSENTIAL METRICS)
         ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 font-khmer-body">
              មន្ត្រីរាជការ និងគ្រូបង្រៀនសរុប
            </span>
            <div className="text-2xl font-extrabold text-slate-900 font-mono-tabular mt-1">
              {kpiStats.totalRosterStaff}{' '}
              <span className="text-xs font-bold text-slate-500 font-khmer-body">នាក់</span>
            </div>
            <div className="text-[11px] text-slate-500 font-khmer-body mt-1">
              ស្រី {kpiStats.femaleRosterStaff} នាក់ · គណនីប្រព័ន្ធ {kpiStats.totalTeachers} នាក់
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 font-khmer-body">
              ចំនួនម៉ោងបង្រៀនសរុប (ថ្នាក់ទី ៧–១២)
            </span>
            <div className="text-2xl font-extrabold text-emerald-600 font-mono-tabular mt-1">
              {kpiStats.totalWeeklyHours}{' '}
              <span className="text-xs font-bold text-slate-500 font-khmer-body">ម៉ោង/សប្ដាហ៍</span>
            </div>
            <div className="text-[11px] text-slate-500 font-khmer-body mt-1">
              ការចាត់តាំងសកម្ម {kpiStats.totalActiveAssignments} ថ្នាក់-មុខវិជ្ជា
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 font-khmer-body">
              មុខវិជ្ជាឯកទេសចម្បង
            </span>
            <div className="text-2xl font-extrabold text-blue-600 font-mono-tabular mt-1">
              {PAGE2_SUBJECT_FRAMEWORK_STATS.subjectHeaders.length}
            </div>
            <div className="text-[11px] text-slate-500 font-khmer-body mt-1">
              ឧត្តម · មូលដ្ឋាន · បឋម · កិច្ចព្រមព្រៀង
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 font-khmer-body">
              ថ្នាក់រៀនផ្លូវការ (Official Classes)
            </span>
            <div className="text-2xl font-extrabold text-slate-900 font-mono-tabular mt-1">
              {activeClasses.length}
            </div>
            <div className="text-[11px] text-slate-500 font-khmer-body mt-1">
              ថ្នាក់ទី 7A ដល់ 12C · ឆ្នាំសិក្សា ២០២៦-២០២៧
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <GraduationCap className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* =====================================================================
          OFFICIAL DUTY ALLOCATION ROSTER (បញ្ជីរាយនាម និងបំណែងចែកភារកិច្ចមន្ត្រីរាជការបម្រើការ នៅវិទ្យាល័យទឹកជោរ)
         ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Filter Bar (Hidden on Print) */}
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 no-print">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="ស្វែងរកឈ្មោះមន្ត្រី/គ្រូ, អត្តលេខមន្ត្រី, តួនាទី, ឯកទេស, លេខទូរស័ព្ទ..."
              aria-label="ស្វែងរកគ្រូបង្រៀន"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-khmer-body bg-slate-50/70 focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="ត្រងតាមផ្នែកភារកិច្ច"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value as 'ALL' | StaffDutySectionId)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body"
            >
              <option value="ALL">គ្រប់ផ្នែកទាំង ៤ (ក, ខ, គ, ឃ)</option>
              <option value="SECTION_A_ADMIN_LOWER">ក. បុគ្គលិកទីចាត់ការ បឋមភូមិ</option>
              <option value="SECTION_B_TEACHERS_7_8_9">ខ. គ្រូបង្រៀនថ្នាក់ទី ៧,៨,៩</option>
              <option value="SECTION_C_ADMIN_UPPER">គ. បុគ្គលិកទីចាត់ការ ទុតិយភូមិ</option>
              <option value="SECTION_D_TEACHERS_10_11_12">ឃ. គ្រូបង្រៀនថ្នាក់ទី ១០,១១,១២</option>
            </select>

            <select
              aria-label="ត្រងតាមក្របខ័ណ្ឌ"
              value={frameworkFilter}
              onChange={(e) => setFrameworkFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body"
            >
              <option value="ALL">គ្រប់ក្របខ័ណ្ឌ</option>
              <option value="កម្រិតឧត្តម">កម្រិតឧត្តម</option>
              <option value="កម្រិតមូលដ្ឋាន">កម្រិតមូលដ្ឋាន</option>
              <option value="កិច្ចព្រមព្រៀង">កិច្ចព្រមព្រៀង</option>
            </select>

            <select
              aria-label="ត្រងតាមមុខវិជ្ជាបង្រៀន"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body"
            >
              <option value="ALL">គ្រប់មុខវិជ្ជា</option>
              {activeSubjects.map((sub) => (
                <option key={sub.SubjectID} value={sub.SubjectID}>
                  {sub.SubjectNameKh}
                </option>
              ))}
            </select>

            <select
              aria-label="ត្រងតាមថ្នាក់រៀន"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body"
            >
              <option value="ALL">គ្រប់ថ្នាក់ (7A–12C)</option>
              {activeClasses.map((cls) => (
                <option key={cls.ClassID} value={cls.ClassID}>
                  ថ្នាក់ទី {cls.ClassName}
                </option>
              ))}
            </select>

            {(localSearch ||
              sectionFilter !== 'ALL' ||
              frameworkFilter !== 'ALL' ||
              subjectFilter !== 'ALL' ||
              classFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  setSectionFilter('ALL');
                  setFrameworkFilter('ALL');
                  setSubjectFilter('ALL');
                  setClassFilter('ALL');
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 font-khmer-body cursor-pointer"
              >
                កំណត់ឡើងវិញ
              </button>
            )}
          </div>
        </div>

        {/* Official MoEYS Document Sheet (Page 1 & Page 2 Layout from PDF) */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Official Header (ព្រះរាជាណាចក្រកម្ពុជា & មន្ទីរអប់រំ យុវជន និងកីឡាខេត្តបន្ទាយមានជ័យ) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 text-xs sm:text-sm text-slate-900 font-khmer-body">
              <div className="space-y-1 font-bold leading-relaxed">
                <div>មន្ទីរអប់រំយុវជន និងកីឡាខេត្តបន្ទាយមានជ័យ</div>
                <div>ការិយាល័យអប់រំនៃរដ្ឋបាលស្រុកព្រះនេត្រព្រះ</div>
                <div>វិទ្យាល័យទឹកជោរ</div>
              </div>
              <div className="text-left sm:text-center space-y-1 font-khmer-moul leading-relaxed">
                <div>ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              </div>
            </div>

            <div className="text-center space-y-1.5 pt-1">
              <h3 className="text-sm sm:text-base font-bold text-slate-950 font-khmer-moul">
                បញ្ជីរាយនាម និងបំណែងចែកភារកិច្ចមន្ត្រីរាជការបម្រើការ នៅវិទ្យាល័យទឹកជោរ
              </h3>
              <p className="text-xs sm:text-sm font-bold text-slate-800 font-khmer-body">
                ដូចមានរាយនាមខាងក្រោមត្រូវបានចាត់តាំងឲ្យទទួលភារកិច្ចក្នុងឆ្នាំសិក្សា ២០២៦-២០២៧
              </p>
            </div>
          </div>

          {/* Page 1: Official 23-Column Duty Allocation Table */}
          <div className="overflow-x-auto border border-slate-900 rounded-sm">
            <table className="w-full text-center border-collapse text-[11px] font-khmer-body text-slate-950">
              <thead>
                <tr className="bg-slate-100 font-bold text-slate-950">
                  <th rowSpan={2} className="border border-slate-800 px-1.5 py-2 whitespace-nowrap">
                    ល.រ
                  </th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-2 whitespace-nowrap">
                    អត្តលេខមន្ត្រី
                  </th>
                  <th rowSpan={2} className="border border-slate-800 px-2.5 py-2 whitespace-nowrap min-w-[130px]">
                    គោត្តនាម និងនាម
                  </th>
                  <th rowSpan={2} className="border border-slate-800 px-1.5 py-2 whitespace-nowrap">
                    ភេទ
                  </th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-2 whitespace-nowrap">
                    ថ្ងៃខែឆ្នាំកំណើត
                  </th>
                  <th rowSpan={2} className="border border-slate-800 px-2.5 py-2 whitespace-nowrap min-w-[135px]">
                    តួនាទី
                  </th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-2 whitespace-nowrap">
                    ក្របខ័ណ្ឌ
                  </th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-2 whitespace-nowrap">
                    លេខសញ្ជាតិខ្មែរ
                  </th>
                  <th colSpan={2} rowSpan={2} className="border border-slate-800 px-2 py-2 whitespace-nowrap">
                    មុខវិជ្ជាឯកទេស
                  </th>
                  <th rowSpan={2} className="border border-slate-800 px-1.5 py-2 whitespace-nowrap">
                    កាំប្រាក់
                  </th>
                  <th colSpan={2} className="border border-slate-800 px-1.5 py-1 whitespace-nowrap">
                    ថ្នាក់ទី៧
                  </th>
                  <th colSpan={2} className="border border-slate-800 px-1.5 py-1 whitespace-nowrap">
                    ថ្នាក់ទី៨
                  </th>
                  <th colSpan={2} className="border border-slate-800 px-1.5 py-1 whitespace-nowrap">
                    ថ្នាក់ទី៩
                  </th>
                  <th colSpan={2} className="border border-slate-800 px-1.5 py-1 whitespace-nowrap">
                    ថ្នាក់ទី១០
                  </th>
                  <th colSpan={2} className="border border-slate-800 px-1.5 py-1 whitespace-nowrap">
                    ថ្នាក់ទី១១
                  </th>
                  <th colSpan={2} className="border border-slate-800 px-1.5 py-1 whitespace-nowrap">
                    ថ្នាក់ទី១២
                  </th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-2 whitespace-nowrap">
                    សរុប
                  </th>
                  <th rowSpan={2} className="border border-slate-800 px-2 py-2 whitespace-nowrap">
                    លេខទូរស័ព្ទ
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-800 px-2.5 py-2 whitespace-nowrap no-print"
                  >
                    សកម្មភាព
                  </th>
                </tr>
                <tr className="bg-slate-100 font-bold text-[10px] text-slate-900">
                  {/* Grades 7 to 12 sub-columns: មុខវិជ្ជា | ចំ.ម៉ោង */}
                  {[7, 8, 9, 10, 11, 12].map((g) => (
                    <React.Fragment key={g}>
                      <th className="border border-slate-800 px-1 py-1 whitespace-nowrap">
                        មុខវិជ្ជា
                      </th>
                      <th className="border border-slate-800 px-1 py-1 whitespace-nowrap">
                        ចំ.ម៉ោង
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredDutyRoster.length === 0 ? (
                  <tr>
                    <td colSpan={25} className="py-10 text-center text-slate-500 font-khmer-body">
                      មិនមានទិន្នន័យមន្ត្រីរាជការ ឬគ្រូបង្រៀនត្រូវតាមលក្ខខណ្ឌស្វែងរកឡើយ។
                    </td>
                  </tr>
                ) : (
                  <>
                    {STAFF_DUTY_SECTIONS_META.map((sec) => {
                      const secRows = filteredDutyRoster.filter((r) => r.sectionId === sec.id);
                      if (secRows.length === 0) return null;

                      const secTotalHours = secRows.reduce(
                        (sum, r) => sum + (r.totalHours || 0),
                        0
                      );

                      return (
                        <React.Fragment key={sec.id}>
                          {/* Section Header Row (ក, ខ, គ, ឃ) */}
                          <tr className="bg-slate-100/90 font-bold text-left text-slate-950">
                            <td
                              colSpan={24}
                              className="border border-slate-800 px-3 py-1.5 font-khmer-moul text-[11px]"
                            >
                              {sec.titleKh}
                            </td>
                            <td className="border border-slate-800 px-2 py-1.5 no-print" />
                          </tr>

                          {/* Staff / Teacher Rows in Section */}
                          {secRows.map((row) => {
                            const isHomeroomRole = row.roleTitleKh.includes('គ្រូបន្ទុកថ្នាក់');
                            const rowTestId = row.linkedUserId || `roster-${row.orderNumber}`;
                            return (
                              <tr
                                key={`${row.orderNumber}-${row.civilServantId}`}
                                data-testid={`teacher-row-${rowTestId}`}
                                className="hover:bg-indigo-50/40 transition-colors"
                              >
                                <td className="border border-slate-800 px-1.5 py-1.5 font-bold whitespace-nowrap">
                                  {row.indexKh}
                                </td>
                                <td className="border border-slate-800 px-2 py-1.5 font-mono-tabular whitespace-nowrap">
                                  {row.civilServantId}
                                </td>
                                <td className="border border-slate-800 px-2.5 py-1.5 text-left font-bold whitespace-nowrap">
                                  {row.fullNameKh}
                                </td>
                                <td className="border border-slate-800 px-1.5 py-1.5 font-bold whitespace-nowrap">
                                  {row.genderShort}
                                </td>
                                <td className="border border-slate-800 px-2 py-1.5 whitespace-nowrap">
                                  {row.dobKh}
                                </td>
                                <td
                                  className={`border border-slate-800 px-2 py-1.5 whitespace-nowrap font-bold ${
                                    isHomeroomRole ? 'text-red-600' : 'text-slate-900'
                                  }`}
                                >
                                  {row.roleTitleKh}
                                </td>
                                <td className="border border-slate-800 px-2 py-1.5 whitespace-nowrap">
                                  {row.frameworkKh}
                                </td>
                                <td className="border border-slate-800 px-2 py-1.5 font-mono-tabular whitespace-nowrap">
                                  {row.nationalIdNumber}
                                </td>
                                <td className="border border-slate-800 px-2 py-1.5 whitespace-nowrap">
                                  {row.majorSpec1Kh}
                                </td>
                                <td className="border border-slate-800 px-2 py-1.5 whitespace-nowrap">
                                  {row.majorSpec2Kh}
                                </td>
                                <td className="border border-slate-800 px-1.5 py-1.5 whitespace-nowrap">
                                  {row.salaryScaleKh}
                                </td>

                                {/* Grade 7 */}
                                <td className="border border-slate-800 px-1 py-1.5 font-mono-tabular font-semibold">
                                  {row.grade7.subjectCode}
                                </td>
                                <td className="border border-slate-800 px-1 py-1.5 font-mono-tabular font-bold">
                                  {row.grade7.hours ?? ''}
                                </td>

                                {/* Grade 8 */}
                                <td className="border border-slate-800 px-1 py-1.5 font-mono-tabular font-semibold">
                                  {row.grade8.subjectCode}
                                </td>
                                <td className="border border-slate-800 px-1 py-1.5 font-mono-tabular font-bold">
                                  {row.grade8.hours ?? ''}
                                </td>

                                {/* Grade 9 */}
                                <td className="border border-slate-800 px-1 py-1.5 font-mono-tabular font-semibold">
                                  {row.grade9.subjectCode}
                                </td>
                                <td className="border border-slate-800 px-1 py-1.5 font-mono-tabular font-bold">
                                  {row.grade9.hours ?? ''}
                                </td>

                                {/* Grade 10 */}
                                <td className="border border-slate-800 px-1 py-1.5 font-mono-tabular font-semibold">
                                  {row.grade10.subjectCode}
                                </td>
                                <td className="border border-slate-800 px-1 py-1.5 font-mono-tabular font-bold">
                                  {row.grade10.hours ?? ''}
                                </td>

                                {/* Grade 11 */}
                                <td className="border border-slate-800 px-1 py-1.5 font-mono-tabular font-semibold">
                                  {row.grade11.subjectCode}
                                </td>
                                <td className="border border-slate-800 px-1 py-1.5 font-mono-tabular font-bold">
                                  {row.grade11.hours ?? ''}
                                </td>

                                {/* Grade 12 */}
                                <td className="border border-slate-800 px-1 py-1.5 font-mono-tabular font-semibold">
                                  {row.grade12.subjectCode}
                                </td>
                                <td className="border border-slate-800 px-1 py-1.5 font-mono-tabular font-bold">
                                  {row.grade12.hours ?? ''}
                                </td>

                                {/* Total Hours */}
                                <td className="border border-slate-800 px-2 py-1.5 font-mono-tabular font-extrabold text-slate-950">
                                  {row.totalHours ?? ''}
                                </td>

                                {/* Phone */}
                                <td className="border border-slate-800 px-2 py-1.5 font-mono-tabular whitespace-nowrap">
                                  {row.phone}
                                </td>

                                {/* Actions (Hidden on Print) */}
                                <td className="border border-slate-800 px-2 py-1.5 whitespace-nowrap no-print">
                                  <div className="inline-flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      data-testid={`confirm-role-teacher-btn-${rowTestId}`}
                                      onClick={() => {
                                        setRolePopupTeacherId(row.linkedUserId || activeUserId);
                                        setIsRoleConfirmPopupOpen(true);
                                      }}
                                      title="បញ្ជាក់តួនាទី"
                                      className="px-2 py-1 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <ShieldCheck className="w-3 h-3" />
                                      <span>បញ្ជាក់តួនាទី</span>
                                    </button>

                                    <button
                                      type="button"
                                      data-testid={`assign-teacher-btn-${rowTestId}`}
                                      onClick={() =>
                                        handleOpenAssignForTeacher(
                                          row.linkedUserId || 'USR-TCH-12C'
                                        )
                                      }
                                      title="ចាត់តាំងមុខវិជ្ជា និងថ្នាក់រៀន"
                                      className="px-2 py-1 rounded-md border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <Layers className="w-3 h-3" />
                                      <span>ចាត់តាំង</span>
                                    </button>

                                    {canManageTeachersAndAssignments && (
                                      <button
                                        type="button"
                                        data-testid={`edit-teacher-btn-${rowTestId}`}
                                        onClick={() => handleOpenDutyRowEdit(row)}
                                        title="កែប្រែព័ត៌មានគ្រូ"
                                        className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                        <span>កែប្រែ</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {/* Section Subtotal Row (សរុប) */}
                          <tr className="bg-slate-50 font-bold text-slate-950">
                            <td colSpan={11} className="border border-slate-800 px-3 py-1.5 text-center font-khmer-moul">
                              សរុប
                            </td>
                            <td colSpan={12} className="border border-slate-800 px-2 py-1.5" />
                            <td className="border border-slate-800 px-2 py-1.5 font-mono-tabular font-extrabold">
                              {secTotalHours}
                            </td>
                            <td className="border border-slate-800 px-2 py-1.5" />
                            <td className="border border-slate-800 px-2 py-1.5 no-print" />
                          </tr>
                        </React.Fragment>
                      );
                    })}

                    {/* Grand Total Row (សរុបរួម) */}
                    {(() => {
                      const sumG7 = filteredDutyRoster.reduce(
                        (s, r) => s + (r.grade7.hours || 0),
                        0
                      );
                      const sumG8 = filteredDutyRoster.reduce(
                        (s, r) => s + (r.grade8.hours || 0),
                        0
                      );
                      const sumG9 = filteredDutyRoster.reduce(
                        (s, r) => s + (r.grade9.hours || 0),
                        0
                      );
                      const sumG10 = filteredDutyRoster.reduce(
                        (s, r) => s + (r.grade10.hours || 0),
                        0
                      );
                      const sumG11 = filteredDutyRoster.reduce(
                        (s, r) => s + (r.grade11.hours || 0),
                        0
                      );
                      const sumG12 = filteredDutyRoster.reduce(
                        (s, r) => s + (r.grade12.hours || 0),
                        0
                      );
                      const sumAll = filteredDutyRoster.reduce(
                        (s, r) => s + (r.totalHours || 0),
                        0
                      );
                      return (
                        <tr className="bg-amber-50/80 font-extrabold text-slate-950">
                          <td
                            colSpan={11}
                            className="border border-slate-800 px-3 py-2 text-center font-khmer-moul"
                          >
                            សរុបរួម
                          </td>
                          <td className="border border-slate-800 px-1 py-2" />
                          <td className="border border-slate-800 px-1 py-2 font-mono-tabular">
                            {sumG7}
                          </td>
                          <td className="border border-slate-800 px-1 py-2" />
                          <td className="border border-slate-800 px-1 py-2 font-mono-tabular">
                            {sumG8}
                          </td>
                          <td className="border border-slate-800 px-1 py-2" />
                          <td className="border border-slate-800 px-1 py-2 font-mono-tabular">
                            {sumG9}
                          </td>
                          <td className="border border-slate-800 px-1 py-2" />
                          <td className="border border-slate-800 px-1 py-2 font-mono-tabular">
                            {sumG10}
                          </td>
                          <td className="border border-slate-800 px-1 py-2" />
                          <td className="border border-slate-800 px-1 py-2 font-mono-tabular">
                            {sumG11}
                          </td>
                          <td className="border border-slate-800 px-1 py-2" />
                          <td className="border border-slate-800 px-1 py-2 font-mono-tabular">
                            {sumG12}
                          </td>
                          <td className="border border-slate-800 px-2 py-2 font-mono-tabular text-red-600">
                            {sumAll}
                          </td>
                          <td className="border border-slate-800 px-2 py-2" />
                          <td className="border border-slate-800 px-2 py-2 no-print" />
                        </tr>
                      );
                    })()}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Page 2: Gender Legend, Subject/Framework Statistics Table & Principal Endorsement */}
          <div className="pt-2 space-y-4">
            <div className="text-xs font-bold text-slate-900 font-khmer-body">
              ភេទ៖ ប = ប្រុស , ស = ស្រី
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left 8 Columns: ស្ថិតិគ្រូតាមមុខវិជ្ជាឯកទេសចម្បង និងក្របខ័ណ្ឌ */}
              <div className="xl:col-span-8 overflow-x-auto">
                <table className="w-full text-center border-collapse text-[11px] font-khmer-body text-slate-950 border border-slate-800">
                  <thead>
                    <tr className="bg-slate-100 font-bold">
                      <th
                        colSpan={2}
                        className="border border-slate-800 px-2.5 py-2 font-khmer-moul text-[11px]"
                      >
                        ស្ថិតិគ្រូតាមមុខវិជ្ជាឯកទេសចម្បង និងក្របខ័ណ្ឌ
                      </th>
                      {PAGE2_SUBJECT_FRAMEWORK_STATS.subjectHeaders.map((subHeader) => (
                        <th
                          key={subHeader}
                          className="border border-slate-800 px-2 py-2 whitespace-nowrap"
                        >
                          {subHeader}
                        </th>
                      ))}
                      <th className="border border-slate-800 px-2.5 py-2 whitespace-nowrap">
                        សរុប
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {PAGE2_SUBJECT_FRAMEWORK_STATS.rows.map((statRow) => {
                      const rowSumTotal = statRow.total.reduce((a, b) => a + b, 0);
                      const rowSumFemale = statRow.female.reduce((a, b) => a + b, 0);
                      return (
                        <React.Fragment key={statRow.frameworkLabelKh}>
                          <tr
                            className={
                              statRow.isGrandTotal ? 'bg-amber-50/70 font-extrabold' : ''
                            }
                          >
                            <td
                              rowSpan={2}
                              className="border border-slate-800 px-2.5 py-1.5 text-left font-bold whitespace-nowrap"
                            >
                              {statRow.frameworkLabelKh}
                            </td>
                            <td className="border border-slate-800 px-2 py-1 font-semibold whitespace-nowrap">
                              សរុប
                            </td>
                            {statRow.total.map((val, idx) => (
                              <td
                                key={idx}
                                className="border border-slate-800 px-2 py-1 font-mono-tabular font-bold"
                              >
                                {val}
                              </td>
                            ))}
                            <td className="border border-slate-800 px-2 py-1 font-mono-tabular font-extrabold">
                              {rowSumTotal}
                            </td>
                          </tr>
                          <tr
                            className={
                              statRow.isGrandTotal ? 'bg-amber-50/70 font-extrabold' : ''
                            }
                          >
                            <td className="border border-slate-800 px-2 py-1 font-semibold whitespace-nowrap">
                              ស្រី
                            </td>
                            {statRow.female.map((val, idx) => (
                              <td
                                key={idx}
                                className="border border-slate-800 px-2 py-1 font-mono-tabular"
                              >
                                {val}
                              </td>
                            ))}
                            <td className="border border-slate-800 px-2 py-1 font-mono-tabular font-bold">
                              {rowSumFemale}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Right 4 Columns: Official Endorsement & Principal Signature Block */}
              <div className="xl:col-span-4 flex flex-col items-center justify-center text-center space-y-2 pt-2 font-khmer-body text-xs text-slate-900">
                <div className="font-bold font-khmer-moul text-slate-950">
                  បានឃើញ និងឯកភាព
                </div>
                <div className="font-semibold">
                  ថ្ងៃពុធ ២កើត ខែកត្តិក ឆ្នាំមមី អដ្ឋស័ក ព.ស ២៥៧០
                </div>
                <div className="font-semibold">
                  ទឹកជោរ ថ្ងៃទី១១ ខែវិច្ឆិកា ឆ្នាំ២០២៦
                </div>
                <div className="font-bold font-khmer-moul text-slate-950 pt-1">
                  នាយកវិទ្យាល័យ
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODAL: ADD / EDIT TEACHER ACCOUNT & 3 INTEGRATED FUNCTIONS
         ===================================================================== */}
      {isTeacherModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            editingTeacherId ? 'កែប្រែព័ត៌មានគ្រូបង្រៀន' : 'បន្ថែមគ្រូបង្រៀនថ្មី'
          }
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full overflow-hidden my-8">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-slate-50/70">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-moul">
                  {editingTeacherId
                    ? `កែប្រែព័ត៌មានគ្រូបង្រៀន (${editingTeacherId})`
                    : 'បន្ថែមគ្រូបង្រៀនថ្មី'}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* 3 Functions Segmented Control Inside បន្ថែមគ្រូបង្រៀនថ្មី Modal */}
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
                  <button
                    type="button"
                    data-testid="teacher-subview-list-btn"
                    onClick={() => setActiveSubView('TEACHER_LIST')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      activeSubView === 'TEACHER_LIST'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>បញ្ជីគ្រូ ({kpiStats.totalTeachers})</span>
                  </button>

                  <button
                    type="button"
                    data-testid="open-assignment-manager-btn"
                    onClick={() => setActiveSubView('ASSIGNMENT_MANAGER')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      activeSubView === 'ASSIGNMENT_MANAGER'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ចាត់តាំងមុខវិជ្ជា &amp; ថ្នាក់ ({kpiStats.totalActiveAssignments})</span>
                  </button>

                  <button
                    type="button"
                    data-testid="open-homeroom-specializations-btn"
                    onClick={() => setActiveSubView('HOMEROOM_AND_SPECIALIZATIONS')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      activeSubView === 'HOMEROOM_AND_SPECIALIZATIONS'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>គ្រូបន្ទុកថ្នាក់ &amp; ឯកទេស ({(db.HomeroomTeacherAssignments || []).filter((h) => h.Status === 'ACTIVE').length})</span>
                  </button>
                </div>

                <button
                  type="button"
                  aria-label="បិទផ្ទាំង"
                  onClick={() => setIsTeacherModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[78vh] overflow-y-auto p-5">
              {/* =====================================================================
                  SUB-VIEW 2: 5-STEP TEACHER–SUBJECT–CLASS ASSIGNMENT INTERFACE
                 ===================================================================== */}
              {activeSubView === 'ASSIGNMENT_MANAGER' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-title">
                  ការចាត់តាំង គ្រូបង្រៀន – មុខវិជ្ជា – ថ្នាក់រៀន (5-Step Assignment Workflow)
                </h3>
                <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                  គ្រូម្នាក់អាចបង្រៀនច្រើនមុខវិជ្ជា និងច្រើនថ្នាក់ · មុខវិជ្ជាមួយអាចមានគ្រូច្រើននាក់ · ធ្វើសមកាលកម្មភ្លាមៗជាមួយការប្រឡងអនឡាញ
                </p>
              </div>
              {onNavigateSection && (
                <button
                  type="button"
                  onClick={() => onNavigateSection('ONLINE_EXAMS')}
                  className="px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 cursor-pointer self-start"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>ទៅកាន់ការប្រឡងអនឡាញ</span>
                </button>
              )}
            </div>

            {/* STEP 1 & STEP 2: Select Academic Year & Select Teacher */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step 1: Select Academic Year */}
              <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 space-y-2">
                <label
                  htmlFor="assign-step1-academic-year"
                  className="block text-xs font-extrabold text-slate-800 font-khmer-body"
                >
                  ជំហានទី ១៖ ជ្រើសរើសឆ្នាំសិក្សា (1. Select Academic Year) *
                </label>
                <select
                  id="assign-step1-academic-year"
                  data-testid="assign-academic-year-select"
                  value={assignAcademicYearId}
                  onChange={(e) => setAssignAcademicYearId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 font-khmer-body"
                >
                  {db.AcademicYears.map((ay) => (
                    <option key={ay.AcademicYearID} value={ay.AcademicYearID}>
                      ឆ្នាំសិក្សា {ay.AcademicYearName} ({ay.AcademicYearID})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Select Teacher */}
              <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 space-y-2">
                <label
                  htmlFor="assign-step2-teacher"
                  className="block text-xs font-extrabold text-slate-800 font-khmer-body"
                >
                  ជំហានទី ២៖ ជ្រើសរើសគ្រូបង្រៀន (2. Select Teacher) *
                </label>
                <select
                  id="assign-step2-teacher"
                  data-testid="assign-teacher-select"
                  value={assignTeacherId}
                  onChange={(e) => setAssignTeacherId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 font-khmer-body"
                >
                  {getRegisteredTeachersWithAssignments(db, 'ALL').map((t) => (
                    <option key={t.teacherId} value={t.teacherId}>
                      {t.user.FullNameKh} ({t.teacherId} · {t.user.Username})
                      {t.user.Status === 'INACTIVE' ? ' [ផ្អាក]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* STEP 3: Select One or Multiple Subjects */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-extrabold text-slate-800 font-khmer-body">
                  ជំហានទី ៣៖ ជ្រើសរើសមុខវិជ្ជាមួយ ឬច្រើនសម្រាប់គ្រូ{' '}
                  <span className="text-indigo-600">
                    {selectedAssignTeacher?.user.FullNameKh}
                  </span>{' '}
                  (3. Select One or Multiple Subjects) *
                </div>
                <span className="text-[11px] text-slate-500 font-khmer-body">
                  បានជ្រើសរើស {Object.keys(assignSubjectClassMap).length} មុខវិជ្ជា
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {activeSubjects.map((sub) => {
                  const isSelected = Boolean(assignSubjectClassMap[sub.SubjectID]);
                  const selectedClassesCount =
                    assignSubjectClassMap[sub.SubjectID]?.length || 0;
                  return (
                    <button
                      key={sub.SubjectID}
                      type="button"
                      data-testid={`assign-subject-toggle-${sub.SubjectID}`}
                      onClick={() => handleToggleSubjectInAssignment(sub.SubjectID)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold font-khmer-body truncate">
                          {sub.SubjectNameKh}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-tabular mt-0.5">
                          {sub.SubjectCode} · {selectedClassesCount} ថ្នាក់
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 4: Assign One or Multiple Classes to Each Selected Subject */}
            <div className="space-y-3">
              <div className="text-xs font-extrabold text-slate-800 font-khmer-body">
                ជំហានទី ៤៖ កំណត់ថ្នាក់រៀនមួយ ឬច្រើនសម្រាប់មុខវិជ្ជានីមួយៗ (4. Assign One or Multiple Classes per Subject) *
              </div>

              {Object.keys(assignSubjectClassMap).length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 font-khmer-body">
                  សូមជ្រើសរើសមុខវិជ្ជាយ៉ាងតិច ១ នៅជំហានទី ៣ ខាងលើ ដើម្បីកំណត់ថ្នាក់រៀន។
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.keys(assignSubjectClassMap).map((subjectId) => {
                    const sub = activeSubjects.find((s) => s.SubjectID === subjectId);
                    if (!sub) return null;
                    const assignedClassIds = assignSubjectClassMap[subjectId] || [];

                    return (
                      <div
                        key={subjectId}
                        data-testid={`assign-classes-card-${subjectId}`}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-600" />
                            <span className="text-xs font-extrabold text-slate-900 font-khmer-body">
                              {sub.SubjectNameKh} ({sub.SubjectCode})
                            </span>
                            <span className="text-xs text-indigo-700 font-bold font-khmer-body">
                              · បានជ្រើសរើស {assignedClassIds.length} ថ្នាក់
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSelectGrade12ClassesForSubject(subjectId)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-700 font-khmer-body cursor-pointer"
                            >
                              ថ្នាក់ទី ១២ (12A–12C)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectAllClassesForSubject(subjectId)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-700 font-khmer-body cursor-pointer"
                            >
                              គ្រប់ថ្នាក់ (7A–12C)
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {activeClasses.map((cls) => {
                            const checked = assignedClassIds.includes(cls.ClassID);
                            return (
                              <button
                                key={cls.ClassID}
                                type="button"
                                data-testid={`assign-class-btn-${subjectId}-${cls.ClassID}`}
                                onClick={() =>
                                  handleToggleClassForSubject(subjectId, cls.ClassID)
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono-tabular border transition-all cursor-pointer ${
                                  checked
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {checked ? `✓ ${cls.ClassName}` : cls.ClassName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* STEP 5: Save and Synchronize Assignments */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600 font-khmer-body">
                ជំហានទី ៥៖ រក្សាទុក និងធ្វើសមកាលកម្មសិទ្ធិគ្រូបង្រៀនទៅកាន់ប្រព័ន្ធប្រឡងអនឡាញ និងឃ្លាំងសំណួរ
              </div>

              <div className="flex items-center gap-2">
                {onSelectUser && selectedAssignTeacher?.user.Status === 'ACTIVE' && (
                  <button
                    type="button"
                    data-testid="switch-to-assigned-teacher-btn"
                    onClick={() => {
                      onSelectUser(assignTeacherId);
                      if (onNavigateSection) {
                        onNavigateSection('ONLINE_EXAMS');
                      }
                    }}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>សាកល្បងចូលគណនីគ្រូនេះក្នុងការប្រឡងអនឡាញ</span>
                  </button>
                )}

                <button
                  type="button"
                  data-testid="save-teacher-assignments-btn"
                  onClick={handleSaveAssignments}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-khmer-body inline-flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>រក្សាទុកការចាត់តាំង (Save &amp; Sync Assignments)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Complete Active Assignments Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-khmer-title">
                តារាងសង្ខេបការចាត់តាំងគ្រូ-មុខវិជ្ជា-ថ្នាក់រៀន ក្នុងឆ្នាំសិក្សា ({assignAcademicYearId})
              </h4>
              <span className="text-xs text-slate-500 font-khmer-body">
                សរុប{' '}
                {
                  db.TeacherSubjectAssignments.filter(
                    (a) =>
                      a.Status === 'ACTIVE' &&
                      a.AcademicYearID === assignAcademicYearId
                  ).length
                }{' '}
                កំណត់ត្រាសកម្ម
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 font-khmer-body">
                    <th className="py-2.5 px-4">គ្រូបង្រៀន (Teacher)</th>
                    <th className="py-2.5 px-4">គណនី (Username)</th>
                    <th className="py-2.5 px-4">មុខវិជ្ជា (Subjects)</th>
                    <th className="py-2.5 px-4">ថ្នាក់រៀនដែលបានចាត់តាំង (Assigned Classes)</th>
                    <th className="py-2.5 px-4 text-right">កែសម្រួល</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                  {getRegisteredTeachersWithAssignments(db, assignAcademicYearId).map((t) => (
                    <tr key={t.teacherId} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {t.user.FullNameKh}{' '}
                        <span className="text-[11px] font-normal text-slate-400 font-mono-tabular">
                          ({t.teacherId})
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-slate-600">
                        {t.user.Username}
                      </td>
                      <td className="py-3 px-4">
                        {t.assignedSubjects.map((s) => s.SubjectNameKh).join(' · ') || '—'}
                      </td>
                      <td className="py-3 px-4">
                        {t.assignedSubjects.length === 0
                          ? 'មិនទាន់ចាត់តាំង'
                          : t.assignedSubjects
                              .map(
                                (s) =>
                                  `${s.SubjectNameKh}: ${(
                                    t.classesBySubject[s.SubjectID] || []
                                  )
                                    .map((c) => c.ClassName)
                                    .join(', ')}`
                              )
                              .join(' | ')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setAssignTeacherId(t.teacherId)}
                          className="text-indigo-600 hover:underline font-bold cursor-pointer"
                        >
                          ជ្រើសរើសកែប្រែ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-VIEW 3: HOMEROOM TEACHER ASSIGNMENT & MULTI-SUBJECT SPECIALIZATIONS
         ===================================================================== */}
      {activeSubView === 'HOMEROOM_AND_SPECIALIZATIONS' && (
        <div className="space-y-5">
          {/* Top Grid: Homeroom Assignment Form + Multi-Role & Subject Specialization Editor */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Card (7 cols): Assign / Edit Primary Homeroom Teacher per Class & Academic Year */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-title">
                    ការចាត់តាំងគ្រូបន្ទុកថ្នាក់ (Homeroom Teacher Assignment)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-khmer-body mt-1">
                  ថ្នាក់រៀននីមួយៗមានគ្រូបន្ទុកថ្នាក់គោលសកម្មតែ ១ រូបប៉ុណ្ណោះក្នុងមួយឆ្នាំសិក្សា។ គ្រូបន្ទុកថ្នាក់មានសិទ្ធិមើល បញ្ចូល និងកែប្រែពិន្ទុគ្រប់មុខវិជ្ជាទាំងអស់សម្រាប់សិស្សក្នុងថ្នាក់បន្ទុករបស់ខ្លួន។
                </p>
              </div>

              <form onSubmit={handleSaveHomeroomAssignment} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="homeroom-ay-select"
                      className="block text-xs font-bold text-slate-700 font-khmer-body mb-1"
                    >
                      ឆ្នាំសិក្សា (Academic Year)
                    </label>
                    <select
                      id="homeroom-ay-select"
                      data-testid="homeroom-ay-select"
                      value={homeroomAcademicYearId}
                      onChange={(e) => setHomeroomAcademicYearId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold font-khmer-body"
                    >
                      {db.AcademicYears.map((ay) => (
                        <option key={ay.AcademicYearID} value={ay.AcademicYearID}>
                          {ay.AcademicYearName} ({ay.AcademicYearID})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="homeroom-class-select"
                      className="block text-xs font-bold text-slate-700 font-khmer-body mb-1"
                    >
                      ថ្នាក់រៀន (Class 7A–12C)
                    </label>
                    <select
                      id="homeroom-class-select"
                      data-testid="homeroom-class-select"
                      value={homeroomClassId}
                      onChange={(e) => setHomeroomClassId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold font-khmer-body"
                    >
                      {activeClasses.map((cls) => (
                        <option key={cls.ClassID} value={cls.ClassID}>
                          ថ្នាក់ទី {cls.ClassName} (កម្រិតទី {cls.GradeLevel})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="homeroom-teacher-select"
                      className="block text-xs font-bold text-slate-700 font-khmer-body mb-1"
                    >
                      គ្រូបន្ទុកថ្នាក់ (Teacher ID)
                    </label>
                    <select
                      id="homeroom-teacher-select"
                      data-testid="homeroom-teacher-select"
                      value={homeroomTeacherId}
                      onChange={(e) => setHomeroomTeacherId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold font-khmer-body"
                    >
                      {getRegisteredTeachersWithAssignments(db, 'ALL').map((t) => (
                        <option key={t.teacherId} value={t.teacherId}>
                          {t.user.FullNameKh} ({t.teacherId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="homeroom-start-date"
                      className="block text-xs font-bold text-slate-700 font-khmer-body mb-1"
                    >
                      ថ្ងៃចាប់ផ្តើម (Start Date)
                    </label>
                    <input
                      id="homeroom-start-date"
                      type="date"
                      value={homeroomStartDate}
                      onChange={(e) => setHomeroomStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono-tabular"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="homeroom-end-date"
                      className="block text-xs font-bold text-slate-700 font-khmer-body mb-1"
                    >
                      ថ្ងៃបញ្ចប់ (End Date)
                    </label>
                    <input
                      id="homeroom-end-date"
                      type="date"
                      value={homeroomEndDate}
                      onChange={(e) => setHomeroomEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono-tabular"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="homeroom-status-select"
                      className="block text-xs font-bold text-slate-700 font-khmer-body mb-1"
                    >
                      ស្ថានភាព (Status)
                    </label>
                    <select
                      id="homeroom-status-select"
                      value={homeroomStatus}
                      onChange={(e) => setHomeroomStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold font-khmer-body"
                    >
                      <option value="ACTIVE">សកម្ម (ACTIVE)</option>
                      <option value="INACTIVE">ផ្អាក (INACTIVE)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    type="submit"
                    data-testid="save-homeroom-assignment-btn"
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>រក្សាទុកការចាត់តាំងគ្រូបន្ទុកថ្នាក់</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Card (5 cols): Multi-Role & Multi-Subject Specialization Manager */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-title">
                    តួនាទីរួម និងឯកទេសមុខវិជ្ជា (Multi-Role &amp; Specializations)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-khmer-body mt-1">
                  គ្រូម្នាក់អាចមានតួនាទីជា «គ្រូបង្រៀនមុខវិជ្ជា» និង «គ្រូបន្ទុកថ្នាក់» ក្នុងគណនីតែមួយ ព្រមទាំងមានឯកទេសច្រើនមុខវិជ្ជា។
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="spec-teacher-select"
                    className="block text-xs font-bold text-slate-700 font-khmer-body mb-1"
                  >
                    ជ្រើសរើសគ្រូបង្រៀន (Select Teacher Account)
                  </label>
                  <select
                    id="spec-teacher-select"
                    data-testid="spec-teacher-select"
                    value={specTeacherId}
                    onChange={(e) => setSpecTeacherId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold font-khmer-body"
                  >
                    {getRegisteredTeachersWithAssignments(db, 'ALL').map((t) => (
                      <option key={t.teacherId} value={t.teacherId}>
                        {t.user.FullNameKh} ({t.teacherId} · {t.user.Username})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-700 font-khmer-body mb-1.5">
                    តួនាទីគណនី (Simultaneous User Roles on Single Account)៖
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { role: 'TEACHER' as RoleName, labelKh: 'គ្រូបង្រៀនមុខវិជ្ជា (Subject Teacher)' },
                      { role: 'HOMEROOM_TEACHER' as RoleName, labelKh: 'គ្រូបន្ទុកថ្នាក់ (Homeroom Teacher)' },
                    ].map((rItem) => {
                      const checked = specSelectedRoles.includes(rItem.role);
                      return (
                        <button
                          key={rItem.role}
                          type="button"
                          data-testid={`spec-role-toggle-${rItem.role}`}
                          onClick={() =>
                            setSpecSelectedRoles((prev) => {
                              const exists = prev.includes(rItem.role);
                              const next = exists
                                ? prev.filter((r) => r !== rItem.role)
                                : [...prev, rItem.role];
                              return next.length > 0 ? next : ['TEACHER'];
                            })
                          }
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 cursor-pointer ${
                            checked
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {checked && <Check className="w-3.5 h-3.5" />}
                          <span>{rItem.labelKh}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-700 font-khmer-body mb-1.5">
                    ឯកទេសមុខវិជ្ជា (Subject Specializations — ១ ឬច្រើនមុខវិជ្ជា)៖
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeSubjects.map((sub) => {
                      const checked = specSelectedSubjectIds.includes(sub.SubjectID);
                      return (
                        <button
                          key={sub.SubjectID}
                          type="button"
                          data-testid={`spec-subject-toggle-${sub.SubjectID}`}
                          onClick={() =>
                            setSpecSelectedSubjectIds((prev) =>
                              prev.includes(sub.SubjectID)
                                ? prev.filter((id) => id !== sub.SubjectID)
                                : [...prev, sub.SubjectID]
                            )
                          }
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold font-khmer-body cursor-pointer ${
                            checked
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {checked ? `✓ ${sub.SubjectNameKh}` : sub.SubjectNameKh}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200/70 rounded-lg px-2.5 py-1.5 mt-2 font-khmer-body">
                    ចំណាំ៖ ការមានឯកទេសមុខវិជ្ជាមិនផ្តល់សិទ្ធិបង្រៀនគ្រប់ថ្នាក់ដោយស្វ័យប្រវត្តិទេ។ សិទ្ធិបង្រៀន និងដាក់វិញ្ញាសាប្រឡងអាស្រ័យលើការចាត់តាំងក្នុងផ្ទាំងទី ២។
                  </p>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    data-testid="save-specializations-roles-btn"
                    onClick={handleSaveSpecializationsAndRoles}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>រក្សាទុកឯកទេស &amp; តួនាទី</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Table: All Homeroom Teacher Assignments across Classes */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-khmer-title">
                  តារាងគ្រូបន្ទុកថ្នាក់តាមថ្នាក់រៀនទាំង ១៧ (Homeroom Teacher Assignments Table)
                </h4>
                <p className="text-[11px] text-slate-500 font-khmer-body mt-0.5">
                  បង្ហាញ Assignment ID, Teacher ID, Academic Year, Grade Level, Class, Start/End Date និង Status
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={homeroomSearch}
                  onChange={(e) => setHomeroomSearch(e.target.value)}
                  placeholder="ស្វែងរកថ្នាក់ (12C, 7A) ឬឈ្មោះគ្រូ..."
                  aria-label="ស្វែងរកការចាត់តាំងគ្រូបន្ទុកថ្នាក់"
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-khmer-body bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 font-khmer-body">
                    <th className="py-2.5 px-4">Assignment ID</th>
                    <th className="py-2.5 px-4">ថ្នាក់រៀន &amp; កម្រិតថ្នាក់</th>
                    <th className="py-2.5 px-4">គ្រូបន្ទុកថ្នាក់ (Teacher ID &amp; Name)</th>
                    <th className="py-2.5 px-4">ឆ្នាំសិក្សា &amp; រយៈពេល</th>
                    <th className="py-2.5 px-4">សិទ្ធិគ្រប់គ្រងពិន្ទុ</th>
                    <th className="py-2.5 px-4">ស្ថានភាព</th>
                    <th className="py-2.5 px-4 text-right">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-khmer-body">
                  {filteredHomeroomAssignments.map((h) => {
                    const teacher = db.Users.find((u) => u.UserID === h.TeacherID);
                    const cls = db.Classes.find((c) => c.ClassID === h.ClassID);
                    return (
                      <tr key={h.AssignmentID} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-mono-tabular font-semibold text-slate-700">
                          {h.AssignmentID}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          ថ្នាក់ទី {cls?.ClassName || h.ClassID.replace('CLS-', '')}{' '}
                          <span className="text-[11px] font-normal text-slate-500">
                            (ទី {h.GradeLevel})
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-slate-900">
                            {teacher?.FullNameKh || h.TeacherID}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono-tabular">
                            {h.TeacherID} · {teacher?.Username}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-mono-tabular text-[11px] text-slate-600">
                          <div>{h.AcademicYearID}</div>
                          <div>
                            {h.StartDate} → {h.EndDate}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                            គ្រប់មុខវិជ្ជាក្នុងថ្នាក់ {cls?.ClassName || h.ClassID.replace('CLS-', '')}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`font-bold ${
                              h.Status === 'ACTIVE' ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {h.Status === 'ACTIVE' ? 'សកម្ម (ACTIVE)' : 'ផ្អាក (INACTIVE)'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setHomeroomAcademicYearId(h.AcademicYearID);
                                setHomeroomClassId(h.ClassID);
                                setHomeroomTeacherId(h.TeacherID);
                                setHomeroomStartDate(h.StartDate);
                                setHomeroomEndDate(h.EndDate);
                                setHomeroomStatus(h.Status);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 cursor-pointer"
                            >
                              កែប្រែ
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleHomeroomAssignmentStatus(
                                  h.AssignmentID,
                                  h.TeacherID,
                                  h.AcademicYearID,
                                  h.ClassID,
                                  h.Status
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                                h.Status === 'ACTIVE'
                                  ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {h.Status === 'ACTIVE' ? 'ផ្អាក' : 'បើកវិញ'}
                            </button>
                          </div>
                        </td>
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
          SUB-VIEW 1 INSIDE MODAL: ADD / EDIT TEACHER ACCOUNT FORM
         ===================================================================== */}
      {activeSubView === 'TEACHER_LIST' && (
        <form onSubmit={handleSaveTeacherModal} className="space-y-4">
              {formErrorKh && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-khmer-body font-semibold">
                  {formErrorKh}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    គោត្តនាម និងនាម (អក្សរខ្មែរ) *
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="teacher-form-fullname-kh"
                    value={formFullNameKh}
                    onChange={(e) => setFormFullNameKh(e.target.value)}
                    placeholder="ឧ. សំរិទ្ធ សុខា"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-khmer-body"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    ឈ្មោះអក្សរឡាតាំង (Full Name EN)
                  </label>
                  <input
                    type="text"
                    data-testid="teacher-form-fullname-en"
                    value={formFullNameEn}
                    onChange={(e) => setFormFullNameEn(e.target.value)}
                    placeholder="e.g. SAMRITH SOKHA"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono-tabular uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    ឈ្មោះគណនីចូលប្រព័ន្ធ (Username) *
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="teacher-form-username"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="e.g. samrith.sokha"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    អ៊ីមែលផ្លូវការ (Email)
                  </label>
                  <input
                    type="email"
                    data-testid="teacher-form-email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="sokha@teokchor.edu.kh"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    ភេទ (Gender)
                  </label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as GenderKh)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-khmer-body bg-white"
                  >
                    <option value="ប្រុស">ប្រុស</option>
                    <option value="ស្រី">ស្រី</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    លេខទូរស័ព្ទ (Phone)
                  </label>
                  <input
                    type="text"
                    data-testid="teacher-form-phone"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="012 345 678"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    គ្រូបន្ទុកថ្នាក់ (Homeroom Class - Optional)
                  </label>
                  <select
                    value={formHomeroomClassId}
                    onChange={(e) => setFormHomeroomClassId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-khmer-body bg-white"
                  >
                    <option value="">មិនមែនជាគ្រូបន្ទុកថ្នាក់</option>
                    {activeClasses.map((cls) => (
                      <option key={cls.ClassID} value={cls.ClassID}>
                        ថ្នាក់ទី {cls.ClassName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 font-khmer-body mb-1">
                    ស្ថានភាពគណនី (Account Status)
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as 'ACTIVE' | 'INACTIVE')
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-khmer-body bg-white"
                  >
                    <option value="ACTIVE">សកម្ម (ACTIVE)</option>
                    <option value="INACTIVE">ផ្អាក (INACTIVE)</option>
                  </select>
                </div>
              </div>

              {!editingTeacherId && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="text-xs font-bold text-slate-800 font-khmer-body">
                    ចាត់តាំងមុខវិជ្ជាដំបូង (Initial Subject Assignment)៖
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeSubjects.map((sub) => {
                      const checked = formInitialSubjectIds.includes(sub.SubjectID);
                      return (
                        <button
                          key={sub.SubjectID}
                          type="button"
                          onClick={() =>
                            setFormInitialSubjectIds((prev) =>
                              prev.includes(sub.SubjectID)
                                ? prev.filter((id) => id !== sub.SubjectID)
                                : [...prev, sub.SubjectID]
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold font-khmer-body border cursor-pointer ${
                            checked
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {sub.SubjectNameKh}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTeacherModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 font-khmer-body cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  data-testid="save-teacher-modal-btn"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingTeacherId ? 'រក្សាទុកការកែប្រែ' : 'បង្កើតគណនីគ្រូបង្រៀន'}</span>
                </button>
              </div>
            </form>
          )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ALERT POP-UP MODAL: CONFIRM & INSPECT TEACHER ROLE (បញ្ជាក់តួនាទី)
         ===================================================================== */}
      {isRoleConfirmPopupOpen && (
        <div
          data-testid="role-confirm-alert-popup"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden my-8">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-khmer-moul">
                    បញ្ជាក់តួនាទីគ្រូបង្រៀន
                  </h3>
                  <p className="text-[11px] text-slate-500 font-khmer-body">
                    ត្រួតពិនិត្យ និងកំណត់តួនាទីជាគ្រូបន្ទុកថ្នាក់ និងគ្រូមុខវិជ្ជាក្នុងគណនីតែមួយ
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="បិទផ្ទាំងបញ្ជាក់តួនាទី"
                onClick={() => setIsRoleConfirmPopupOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto">
              <DualRoleTeacherPermissionCard
                key={rolePopupTeacherId}
                db={db}
                setDb={setDb}
                activeUserId={rolePopupTeacherId}
                academicYearId={selectedAcademicYearId}
              />
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRoleConfirmPopupOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 font-khmer-body cursor-pointer"
              >
                បិទ
              </button>
              <button
                type="button"
                data-testid="confirm-role-popup-ok-btn"
                onClick={() => {
                  setIsRoleConfirmPopupOpen(false);
                  setSyncState({
                    status: 'SUCCESS',
                    messageKh: 'បានបញ្ជាក់ និងរក្សាទុកតួនាទីគ្រូបង្រៀនរួចរាល់!',
                    timestamp: new Date().toLocaleTimeString('km-KH'),
                  });
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>យល់ព្រម / បញ្ជាក់តួនាទី</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
