import { DatabaseState, StudentRecord } from '../types/database';
import {
  calculateStudentAge,
  formatDateKhmerDisplay,
  getStudentClassScopedResults,
} from './domainRules';
import { HONOR_PORTRAIT_URLS } from './seedData';

export interface StudentPresetAvatarOption {
  id: string;
  labelKh: string;
  url: string;
}

export const STUDENT_PRESET_AVATARS: StudentPresetAvatarOption[] = [
  {
    id: 'DRV-PHOTO-RANK1',
    labelKh: 'រូបគំរូសិស្សទី ១',
    url: HONOR_PORTRAIT_URLS['DRV-PHOTO-RANK1'],
  },
  {
    id: 'DRV-PHOTO-RANK2',
    labelKh: 'រូបគំរូសិស្សទី ២',
    url: HONOR_PORTRAIT_URLS['DRV-PHOTO-RANK2'],
  },
  {
    id: 'DRV-PHOTO-RANK3',
    labelKh: 'រូបគំរូសិស្សទី ៣',
    url: HONOR_PORTRAIT_URLS['DRV-PHOTO-RANK3'],
  },
  {
    id: 'DRV-PHOTO-RANK4',
    labelKh: 'រូបគំរូសិស្សទី ៤',
    url: HONOR_PORTRAIT_URLS['DRV-PHOTO-RANK4'],
  },
  {
    id: 'DRV-PHOTO-RANK5',
    labelKh: 'រូបគំរូសិស្សទី ៥',
    url: HONOR_PORTRAIT_URLS['DRV-PHOTO-RANK5'],
  },
];

export function isDirectImageSource(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('blob:')
  );
}

export function resolveStudentProfilePhotoUrl(
  profileImageId?: string | null,
  portraitUrls: Record<string, string> = {},
  fallbackSeedIndex = 0
): string {
  const raw = (profileImageId || '').trim();
  if (raw) {
    if (portraitUrls[raw]) {
      return portraitUrls[raw];
    }
    const preset = STUDENT_PRESET_AVATARS.find((p) => p.id === raw);
    if (preset) {
      return preset.url;
    }
    if (isDirectImageSource(raw)) {
      return raw;
    }
  }

  const values = Object.values(portraitUrls);
  if (values.length > 0) {
    return values[Math.abs(fallbackSeedIndex) % values.length];
  }
  return STUDENT_PRESET_AVATARS[
    Math.abs(fallbackSeedIndex) % STUDENT_PRESET_AVATARS.length
  ].url;
}

export function validateStudentProfilePhotoInput(input: string): {
  valid: boolean;
  normalizedValue: string;
  errorKh?: string;
} {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedValue: '',
      errorKh: 'សូមជ្រើសរើសរូបភាព ឬបញ្ចូលតំណភ្ជាប់រូបភាពឱ្យបានត្រឹមត្រូវ។',
    };
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:text/html')) {
    return {
      valid: false,
      normalizedValue: '',
      errorKh: 'ទម្រង់រូបភាពមិនត្រឹមត្រូវ ឬមិនមានសុវត្ថិភាពឡើយ។',
    };
  }

  const isPreset = STUDENT_PRESET_AVATARS.some((p) => p.id === trimmed);
  if (isPreset || isDirectImageSource(trimmed) || trimmed.startsWith('DRV-')) {
    return {
      valid: true,
      normalizedValue: trimmed,
    };
  }

  return {
    valid: false,
    normalizedValue: '',
    errorKh:
      'សូមបង្ហោះឯកសាររូបភាព (JPG, PNG, WEBP) ឬប្រើតំណភ្ជាប់រូបភាពដែលផ្តើមដោយ https://',
  };
}

export interface StudentPersonalProfileSummary {
  student: StudentRecord;
  studentId: string;
  studentCode: string;
  fullNameKh: string;
  lastNameKh: string;
  firstNameKh: string;
  fullNameEn: string;
  familyNameEn: string;
  givenNameEn: string;
  gender: 'ប្រុស' | 'ស្រី';
  dateOfBirthIso: string;
  dateOfBirthKh: string;
  ageYears: number;
  phone: string;
  studentStatus: string;
  profileImageId: string;
  profilePhotoUrl: string;
  hasCustomPhoto: boolean;
  // Class & Enrollment
  classId: string;
  className: string;
  gradeLevel: string;
  academicYearId: string;
  academicYearName: string;
  homeroomTeacherNameKh: string;
  homeroomTeacherPhone: string;
  examRoom: string;
  deskNumber: string;
  examSession: string;
  enrollmentDate: string;
  previousClass: string;
  previousSchool: string;
  // Birthplace & Current Address
  birthVillage: string;
  birthCommune: string;
  birthDistrict: string;
  birthProvince: string;
  birthAddressFullKh: string;
  currentVillage: string;
  currentCommune: string;
  currentDistrict: string;
  currentProvince: string;
  currentAddressFullKh: string;
  // Parents / Family
  fatherFullNameKh: string;
  fatherOccupation: string;
  motherFullNameKh: string;
  motherOccupation: string;
  // Social Status
  orphanStatusLabelKh: string;
  disabilityStatusLabelKh: string;
  povertyLevelLabelKh: string;
  remarks: string;
  // Academic Standing
  monthlyAverage: number;
  monthlyRank: number | null;
  monthlyGrade: string;
  semesterAverage: number;
  annualAverage: number;
  totalClassStudents: number;
}

function formatOrphanStatusKh(code: StudentRecord['OrphanStatus']): string {
  switch (code) {
    case '1':
      return 'កំព្រាឪពុក (កូដ 1)';
    case '2':
      return 'កំព្រាម្តាយ (កូដ 2)';
    case '3':
      return 'កំព្រាទាំងឪពុក និងម្តាយ (កូដ 3)';
    default:
      return 'ធម្មតា (មានឪពុកម្តាយ)';
  }
}

function formatDisabilityStatusKh(
  code: StudentRecord['DisabilityStatus']
): string {
  if (code === '4') return 'មានពិការភាព (កូដ 4)';
  return 'គ្មានពិការភាព';
}

function formatPovertyLevelKh(code: StudentRecord['PovertyLevel']): string {
  switch (code) {
    case 'ក១':
      return 'បណ្ណសមធម៌ ក្រីក្រកម្រិត ១ (ក១)';
    case 'ក២':
      return 'បណ្ណសមធម៌ ក្រីក្រកម្រិត ២ (ក២)';
    case '5':
      return 'គ្រួសារងាយរងគ្រោះ (កូដ 5)';
    default:
      return 'ធម្មតា';
  }
}

export function buildStudentPersonalProfileSummary(
  db: DatabaseState,
  activeUserId: string,
  portraitUrls: Record<string, string> = {},
  overrideStudentId?: string
): StudentPersonalProfileSummary {
  const scoped = getStudentClassScopedResults(db, activeUserId, portraitUrls);

  const targetStudent =
    (overrideStudentId
      ? db.Students.find((s) => s.StudentID === overrideStudentId)
      : undefined) || scoped.student;

  const enrollment =
    db.Enrollments.find((e) => e.StudentID === targetStudent.StudentID) ||
    scoped.enrollment;

  const studentClass =
    db.Classes.find((c) => c.ClassID === enrollment?.ClassID) ||
    scoped.studentClass;

  const academicYear =
    db.AcademicYears.find(
      (ay) => ay.AcademicYearID === studentClass.AcademicYearID
    ) ||
    db.AcademicYears.find((ay) => ay.IsCurrent) ||
    db.AcademicYears[0];

  const homeroomTeacher = db.Users.find(
    (u) => u.UserID === studentClass.HomeroomTeacherID
  );

  const studentIdx = Math.max(
    0,
    db.Students.findIndex((s) => s.StudentID === targetStudent.StudentID)
  );

  const profilePhotoUrl = resolveStudentProfilePhotoUrl(
    targetStudent.ProfileImageID,
    portraitUrls,
    studentIdx
  );

  const fullNameEn =
    `${targetStudent.FamilyNameEn || ''} ${targetStudent.GivenNameEn || ''}`.trim() ||
    targetStudent.StudentCode;

  const birthParts = [
    targetStudent.BirthVillage ? `ភូមិ${targetStudent.BirthVillage}` : '',
    targetStudent.BirthCommune ? `ឃុំ/សង្កាត់${targetStudent.BirthCommune}` : '',
    targetStudent.BirthDistrict ? `ស្រុក/ក្រុង${targetStudent.BirthDistrict}` : '',
    targetStudent.BirthProvince ? `ខេត្ត${targetStudent.BirthProvince}` : '',
  ].filter(Boolean);

  const currentParts = [
    targetStudent.CurrentVillage ? `ភូមិ${targetStudent.CurrentVillage}` : '',
    targetStudent.CurrentCommune ? `ឃុំ/សង្កាត់${targetStudent.CurrentCommune}` : '',
    targetStudent.CurrentDistrict
      ? `ស្រុក/ក្រុង${targetStudent.CurrentDistrict}`
      : '',
    targetStudent.CurrentProvince ? `ខេត្ត${targetStudent.CurrentProvince}` : '',
  ].filter(Boolean);

  const fatherFullNameKh =
    `${targetStudent.FatherLastNameKh || ''} ${targetStudent.FatherFirstNameKh || ''}`.trim() ||
    '—';
  const motherFullNameKh =
    `${targetStudent.MotherLastNameKh || ''} ${targetStudent.MotherFirstNameKh || ''}`.trim() ||
    '—';

  const rankedForTarget =
    scoped.classRankedEntries.find(
      (r) => r.studentId === targetStudent.StudentID
    ) || scoped.myRankedEntry;

  const semForTarget =
    db.SemesterScores.find(
      (s) =>
        s.StudentID === targetStudent.StudentID &&
        s.ClassID === studentClass.ClassID
    ) || scoped.mySemesterResult;

  const annForTarget =
    db.AnnualResults.find(
      (a) =>
        a.StudentID === targetStudent.StudentID &&
        a.ClassID === studentClass.ClassID
    ) || scoped.myAnnualResult;

  return {
    student: targetStudent,
    studentId: targetStudent.StudentID,
    studentCode: targetStudent.StudentCode,
    fullNameKh: targetStudent.FullNameKh,
    lastNameKh: targetStudent.LastNameKh,
    firstNameKh: targetStudent.FirstNameKh,
    fullNameEn,
    familyNameEn: targetStudent.FamilyNameEn || '',
    givenNameEn: targetStudent.GivenNameEn || '',
    gender: targetStudent.Gender,
    dateOfBirthIso: targetStudent.DateOfBirth,
    dateOfBirthKh: formatDateKhmerDisplay(targetStudent.DateOfBirth),
    ageYears: calculateStudentAge(targetStudent.DateOfBirth, 2026),
    phone: targetStudent.Phone || '—',
    studentStatus: targetStudent.StudentStatus,
    profileImageId: targetStudent.ProfileImageID || '',
    profilePhotoUrl,
    hasCustomPhoto: Boolean(
      targetStudent.ProfileImageID && targetStudent.ProfileImageID.trim() !== ''
    ),
    classId: studentClass.ClassID,
    className: studentClass.ClassName,
    gradeLevel: studentClass.GradeLevel,
    academicYearId: academicYear?.AcademicYearID || 'AY-2025-2026',
    academicYearName: academicYear?.AcademicYearName || '២០២៥-២០២៦',
    homeroomTeacherNameKh: homeroomTeacher?.FullNameKh || 'ជួន លីរតនៈ',
    homeroomTeacherPhone: homeroomTeacher?.Phone || '012 888 999',
    examRoom: enrollment?.ExamRoom || 'បន្ទប់ ១២C',
    deskNumber: enrollment?.DeskNumber || '01',
    examSession: enrollment?.ExamSession || 'ព្រឹក',
    enrollmentDate: enrollment?.EnrollmentDate || '2025-10-01',
    previousClass: enrollment?.PreviousClass || '11C',
    previousSchool: targetStudent.PreviousSchool || 'វិទ្យាល័យទឹកជោរ',
    birthVillage: targetStudent.BirthVillage || '',
    birthCommune: targetStudent.BirthCommune || '',
    birthDistrict: targetStudent.BirthDistrict || '',
    birthProvince: targetStudent.BirthProvince || '',
    birthAddressFullKh:
      birthParts.length > 0 ? birthParts.join(' • ') : 'មិនទាន់បញ្ចូល',
    currentVillage: targetStudent.CurrentVillage || '',
    currentCommune: targetStudent.CurrentCommune || '',
    currentDistrict: targetStudent.CurrentDistrict || '',
    currentProvince: targetStudent.CurrentProvince || '',
    currentAddressFullKh:
      currentParts.length > 0 ? currentParts.join(' • ') : 'មិនទាន់បញ្ចូល',
    fatherFullNameKh,
    fatherOccupation: targetStudent.FatherOccupation || 'កសិករ',
    motherFullNameKh,
    motherOccupation: targetStudent.MotherOccupation || 'កសិករ',
    orphanStatusLabelKh: formatOrphanStatusKh(targetStudent.OrphanStatus),
    disabilityStatusLabelKh: formatDisabilityStatusKh(
      targetStudent.DisabilityStatus
    ),
    povertyLevelLabelKh: formatPovertyLevelKh(targetStudent.PovertyLevel),
    remarks: targetStudent.Remarks || 'សិស្សកំពុងសិក្សាទៀងទាត់',
    monthlyAverage: rankedForTarget?.averageScore ?? 39.31,
    monthlyRank: rankedForTarget?.ranking ?? 1,
    monthlyGrade: rankedForTarget?.grade || 'C',
    semesterAverage:
      semForTarget?.AverageScore ?? rankedForTarget?.averageScore ?? 39.31,
    annualAverage: annForTarget?.AnnualAverage ?? 45.8,
    totalClassStudents: scoped.totalClassStudents,
  };
}

export interface UpdateStudentSelfProfileParams {
  actorUserId: string;
  studentId: string;
  profileImageId?: string;
  phone?: string;
  familyNameEn?: string;
  givenNameEn?: string;
  currentVillage?: string;
  currentCommune?: string;
  currentDistrict?: string;
  currentProvince?: string;
}

export function updateStudentSelfProfile(
  db: DatabaseState,
  params: UpdateStudentSelfProfileParams
): {
  ok: boolean;
  nextDb: DatabaseState;
  updatedStudent?: StudentRecord;
  messageKh: string;
} {
  const existingStudent = db.Students.find(
    (s) => s.StudentID === params.studentId
  );
  if (!existingStudent) {
    return {
      ok: false,
      nextDb: db,
      messageKh: 'រកមិនឃើញទិន្នន័យសិស្សសម្រាប់ធ្វើបច្ចុប្បន្នភាពឡើយ។',
    };
  }

  // If profileImageId is provided and non-empty, validate it
  let nextProfileImageId = existingStudent.ProfileImageID;
  if (params.profileImageId !== undefined) {
    if (params.profileImageId.trim() === '') {
      nextProfileImageId = '';
    } else {
      const check = validateStudentProfilePhotoInput(params.profileImageId);
      if (!check.valid) {
        return {
          ok: false,
          nextDb: db,
          messageKh:
            check.errorKh || 'ទម្រង់រូបភាពមិនត្រឹមត្រូវ សូមពិនិត្យម្តងទៀត។',
        };
      }
      nextProfileImageId = check.normalizedValue;
    }
  }

  const nowIso = new Date().toISOString();
  const updatedStudent: StudentRecord = {
    ...existingStudent,
    ProfileImageID: nextProfileImageId,
    Phone:
      params.phone !== undefined ? params.phone.trim() : existingStudent.Phone,
    FamilyNameEn:
      params.familyNameEn !== undefined
        ? params.familyNameEn.trim().toUpperCase()
        : existingStudent.FamilyNameEn,
    GivenNameEn:
      params.givenNameEn !== undefined
        ? params.givenNameEn.trim().toUpperCase()
        : existingStudent.GivenNameEn,
    CurrentVillage:
      params.currentVillage !== undefined
        ? params.currentVillage.trim()
        : existingStudent.CurrentVillage,
    CurrentCommune:
      params.currentCommune !== undefined
        ? params.currentCommune.trim()
        : existingStudent.CurrentCommune,
    CurrentDistrict:
      params.currentDistrict !== undefined
        ? params.currentDistrict.trim()
        : existingStudent.CurrentDistrict,
    CurrentProvince:
      params.currentProvince !== undefined
        ? params.currentProvince.trim()
        : existingStudent.CurrentProvince,
    UpdatedAt: nowIso,
  };

  const nextStudents = db.Students.map((s) =>
    s.StudentID === updatedStudent.StudentID ? updatedStudent : s
  );

  // Also synchronize UserRecord.ProfileImageID for the matching student login account
  const studentCode = updatedStudent.StudentCode;
  const nextUsers = db.Users.map((u) => {
    const isLinkedStudentUser =
      u.UserID === `USR-STD-${studentCode}` ||
      u.UserID === `USR-${updatedStudent.StudentID}` ||
      u.Username === studentCode ||
      u.Username === `student_${studentCode}` ||
      (u.UserID === params.actorUserId && u.RoleID === 'ROL-04');
    if (!isLinkedStudentUser) return u;
    return {
      ...u,
      ProfileImageID: nextProfileImageId,
      Phone: updatedStudent.Phone || u.Phone,
      UpdatedAt: nowIso,
    };
  });

  const newAuditLog = {
    LogID: `LOG-${String(db.AuditLogs.length + 1).padStart(4, '0')}`,
    UserID: params.actorUserId,
    Action: 'UPDATE_STUDENT_SELF_PROFILE',
    Module: 'StudentProfileService.gs',
    RecordID: updatedStudent.StudentID,
    OldValueJSON: JSON.stringify({
      ProfileImageID: existingStudent.ProfileImageID,
      Phone: existingStudent.Phone,
    }),
    NewValueJSON: JSON.stringify({
      ProfileImageID: nextProfileImageId.startsWith('data:image/')
        ? 'DATA_URL_UPLOADED_IMAGE'
        : nextProfileImageId,
      Phone: updatedStudent.Phone,
    }),
    Timestamp: nowIso,
    IPOrSessionReference: 'STUDENT-SELF-PROFILE',
    Description: `សិស្ស ${updatedStudent.FullNameKh} (#${updatedStudent.StudentCode}) បានធ្វើបច្ចុប្បន្នភាពព័ត៌មានផ្ទាល់ខ្លួន និងរូបថត Profile`,
  };

  return {
    ok: true,
    nextDb: {
      ...db,
      Students: nextStudents,
      Users: nextUsers,
      AuditLogs: [newAuditLog, ...db.AuditLogs],
    },
    updatedStudent,
    messageKh: `បានរក្សាទុកព័ត៌មានផ្ទាល់ខ្លួន និងរូបថត Profile របស់សិស្ស ${updatedStudent.FullNameKh} (#${updatedStudent.StudentCode}) ដោយជោគជ័យ!`,
  };
}
