export type RoleName =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'TEACHER'
  | 'HOMEROOM_TEACHER'
  | 'STUDENT'
  | 'VIEWER';

export type GenderKh = 'ប្រុស' | 'ស្រី';

export type OrphanStatusCode = 'NONE' | '1' | '2' | '3'; // 1 = កំព្រាឪពុក, 2 = កំព្រាម្តាយ, 3 = កំព្រាឪពុក/ម្តាយ
export type DisabilityStatusCode = 'NONE' | '4'; // 4 = ពិការ (✓)
export type PovertyLevelCode = 'NONE' | 'ក១' | 'ក២' | '5'; // ក១ = ក្រីក្រកម្រិត១, ក២ = ក្រីក្រកម្រិត២, 5 = ងាយរងគ្រោះ
export type StudentStatusKh = 'កំពុងរៀន' | 'ផ្ទេរចេញ' | 'បោះបង់';

export type GradeLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'មិនចាត់ថ្នាក់';
export type PassStatusKh = 'ជាប់មធ្យមភាគ' | 'ធ្លាក់មធ្យមភាគ' | 'មិនចាត់ថ្នាក់';

export type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY';
export type QuestionAction = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE';

// Sheet 1: Users
export interface UserRecord {
  UserID: string;
  Username: string;
  Email: string;
  PasswordHash: string;
  PasswordSalt: string;
  FullNameKh: string;
  FullNameEn: string;
  Gender: GenderKh;
  Phone: string;
  RoleID: string;
  /** Optional multi-role assignment (e.g. ['TEACHER', 'HOMEROOM_TEACHER']) on the same Teacher ID */
  AssignedRoles?: RoleName[];
  /** Optional subject specializations (SubjectID[]) distinct from actual class teaching assignments */
  SubjectSpecializations?: string[];
  ProfileImageID: string;
  Status: 'ACTIVE' | 'INACTIVE';
  CreatedAt: string;
  UpdatedAt: string;
  LastLoginAt: string;
}

// Sheet 2: Roles
export interface RoleRecord {
  RoleID: string;
  RoleName: RoleName;
  Description: string;
  Status: 'ACTIVE' | 'INACTIVE';
}

// Sheet 3: AcademicYears
export interface AcademicYearRecord {
  AcademicYearID: string;
  AcademicYearName: string;
  StartDate: string;
  EndDate: string;
  IsCurrent: boolean;
  Status: 'ACTIVE' | 'ARCHIVED';
  CreatedAt: string;
}

// Sheet 4: Semesters
export interface SemesterRecord {
  SemesterID: string;
  AcademicYearID: string;
  SemesterName: string;
  StartDate: string;
  EndDate: string;
  Status: 'ACTIVE' | 'CLOSED';
}

// Sheet 5: Classes (17 Classes: 7A-7C, 8A-8C, 9A-9B, 10A-10C, 11A-11C, 12A-12C)
export interface ClassRecord {
  ClassID: string;
  ClassName: string;
  GradeLevel: '7' | '8' | '9' | '10' | '11' | '12';
  AcademicYearID: string;
  HomeroomTeacherID: string;
  Status: 'ACTIVE' | 'INACTIVE';
  CreatedAt: string;
}

// Sheet 6: Students (Aligned with 36-Column Master Sheet សិស្សទាំងអស់ & គម្រូបញ្ជីរាយនាមតាមថ្នាក់)
export interface StudentRecord {
  StudentID: string;
  StudentCode: string; // អត្តលេខ e.g. 6463
  LastNameKh: string; // គោត្តនាម
  FirstNameKh: string; // នាម
  FullNameKh: string; // គោត្តនាម + នាម
  FamilyNameEn: string;
  GivenNameEn: string;
  Gender: GenderKh;
  DateOfBirth: string; // YYYY-MM-DD
  Phone: string;
  BirthVillage: string;
  BirthCommune: string;
  BirthDistrict: string;
  BirthProvince: string;
  FatherLastNameKh: string;
  FatherFirstNameKh: string;
  FatherOccupation: string;
  MotherLastNameKh: string;
  MotherFirstNameKh: string;
  MotherOccupation: string;
  CurrentVillage: string;
  CurrentCommune: string;
  CurrentDistrict: string;
  CurrentProvince: string;
  OrphanStatus: OrphanStatusCode;
  DisabilityStatus: DisabilityStatusCode;
  PovertyLevel: PovertyLevelCode;
  PreviousSchool: string;
  ProfileImageID: string;
  StudentStatus: StudentStatusKh;
  Remarks: string;
  CreatedAt: string;
  UpdatedAt: string;
}

// Sheet 7: Enrollments
export interface EnrollmentRecord {
  EnrollmentID: string;
  StudentID: string;
  ClassID: string;
  AcademicYearID: string;
  PreviousClass: string;
  IsNewTransfer: boolean;
  IsRepeater: boolean;
  ExamRoom: string;
  DeskNumber: string;
  ExamSession: string;
  EnrollmentDate: string;
  EnrollmentStatus: 'កំពុងរៀន' | 'ផ្ទេរចេញ';
  Remarks: string;
}

// Sheet 8: Subjects
export interface SubjectRecord {
  SubjectID: string;
  SubjectCode: string;
  SubjectNameKh: string;
  SubjectNameEn: string;
  GradeLevel: string;
  Coefficient: number;
  MaximumScore: number;
  /** Optional Academic Year & Semester configuration managed in Subject Management */
  AcademicYearID?: string;
  SemesterIDs?: string[];
  PassingScore?: number;
  Status: 'ACTIVE' | 'INACTIVE';
  CreatedAt: string;
}

// Sheet 9: TeacherSubjectAssignments
export interface TeacherSubjectAssignmentRecord {
  AssignmentID: string;
  TeacherID: string;
  SubjectID: string;
  ClassID: string;
  AcademicYearID: string;
  AssignedByUserID: string;
  AssignedAt: string;
  Status: 'ACTIVE' | 'INACTIVE';
}

export type AcademicQuestionMonth =
  | 'តុលា'
  | 'វិច្ឆិកា'
  | 'ធ្នូ'
  | 'មករា'
  | 'កុម្ភៈ'
  | 'មីនា'
  | 'មេសា'
  | 'ឧសភា'
  | 'មិថុនា'
  | 'កក្កដា'
  | 'ឆមាសទី១'
  | 'ឆមាសទី២'
  | 'ប្រចាំឆ្នាំ';

// Sheet 10: Exams
export interface ExamRecord {
  ExamID: string;
  ExamTitle: string;
  SubjectID: string;
  ClassID: string;
  ClassIDs?: string[];
  AcademicYearID: string;
  SemesterID: string;
  ExamType: 'MONTHLY' | 'SEMESTER' | 'ANNUAL' | 'QUIZ' | 'FINAL';
  ExamMonth: string;
  StartDateTime: string;
  EndDateTime: string;
  DurationMinutes: number;
  MaximumScore: number;
  PassScore: number;
  AttemptLimit: number;
  Instructions: string;
  CreatedByUserID: string;
  Status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  QuestionIDs?: string[];
  CreatedAt: string;
  UpdatedAt: string;
}

// Sheet 11: Questions
export interface QuestionRecord {
  QuestionID: string;
  SubjectID: string;
  QuestionText: string;
  QuestionType: QuestionType;
  OptionsJSON: string;
  CorrectAnswerJSON: string;
  Points: number;
  DifficultyLevel: 'EASY' | 'MEDIUM' | 'HARD';
  ExamMonth?: AcademicQuestionMonth | string;
  TargetMonth?: AcademicQuestionMonth | string;
  GradeLevel?: string;
  ClassName?: string;
  ImageFileID: string;
  CreatedByUserID: string;
  UpdatedByUserID: string;
  Status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  CreatedAt: string;
  UpdatedAt: string;
}

// Sheet 12: ExamAttempts
export interface ExamAttemptRecord {
  AttemptID: string;
  ExamID: string;
  StudentID: string;
  AttemptNumber: number;
  StartedAt: string;
  SubmittedAt: string;
  ServerDeadline: string;
  AttemptStatus: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'EXPIRED';
  TotalScore: number;
  CreatedAt: string;
}

// Sheet 13: ExamAnswers
export interface ExamAnswerRecord {
  AnswerID: string;
  AttemptID: string;
  QuestionID: string;
  StudentID: string;
  AnswerJSON: string;
  ScoreAwarded: number;
  IsCorrect: boolean;
  SavedAt: string;
  GradedByUserID: string;
  GradedAt: string;
}

// Sheet 14: MonthlyScores
export interface MonthlyScoreRecord {
  MonthlyScoreID: string;
  StudentID: string;
  ClassID: string;
  SubjectID: string; // SubjectID or 'ALL' for monthly summary
  AcademicYearID: string;
  Month: string; // e.g., វិច្ឆិកា, ធ្នូ
  AssessmentType: 'ONLINE_EXAM' | 'MANUAL_SCORE' | 'MONTHLY_SUMMARY';
  Score: number;
  MaximumScore: number;
  AverageScore: number; // Supports -1.72 sentinel for unranked/absent
  Ranking: number | null;
  Grade: GradeLetter;
  IsPass: PassStatusKh;
  IsHonorRoll: boolean;
  EnteredByUserID: string;
  ApprovedByUserID: string;
  Status: 'DRAFT' | 'APPROVED' | 'PUBLISHED';
  CreatedAt: string;
  UpdatedAt: string;
}

// Sheet 15: SemesterScores
export interface SemesterScoreRecord {
  SemesterScoreID: string;
  StudentID: string;
  ClassID: string;
  SubjectID: string;
  AcademicYearID: string;
  SemesterID: string;
  MonthlyAverage: number;
  ExamScore: number;
  TotalScore: number;
  MaximumScore: number;
  AverageScore: number;
  Grade: GradeLetter;
  Ranking: number | null;
  Status: 'CALCULATED' | 'PUBLISHED';
  CalculatedAt: string;
}

// Sheet 16: AnnualResults
export interface AnnualResultRecord {
  AnnualResultID: string;
  StudentID: string;
  ClassID: string;
  SubjectID: string; // 'ALL' for overall annual class standing
  AcademicYearID: string;
  AnnualTotal: number;
  AnnualAverage: number; // e.g. 10.61, 39.45, or -1.72 for unranked
  Grade: GradeLetter;
  Ranking: number | null;
  IsHonorRoll: boolean;
  ResultStatus: PassStatusKh;
  PublishedAt: string;
}

// Sheet 17: GradingScales
export interface GradingScaleRecord {
  GradingScaleID: string;
  ScaleName: string;
  MinimumScore: number;
  MaximumScore: number;
  Grade: GradeLetter;
  Description: string;
  AcademicYearID: string;
  Status: 'ACTIVE' | 'INACTIVE';
}

// Sheet 18: SystemSettings
export interface SystemSettingRecord {
  SettingID: string;
  SettingKey: string;
  SettingValue: string;
  SettingGroup: 'SCHOOL_IDENTITY' | 'REPORT_HEADER' | 'SECURITY' | 'ACADEMIC';
  Description: string;
  UpdatedByUserID: string;
  UpdatedAt: string;
}

// Sheet 19: AuditLogs
export interface AuditLogRecord {
  LogID: string;
  UserID: string;
  Action: string;
  Module: string;
  RecordID: string;
  OldValueJSON: string;
  NewValueJSON: string;
  Timestamp: string;
  IPOrSessionReference: string;
  Description: string;
}

export interface HomeroomTeacherAssignmentRecord {
  AssignmentID: string;
  TeacherID: string;
  AcademicYearID: string;
  GradeLevel: '7' | '8' | '9' | '10' | '11' | '12';
  ClassID: string;
  StartDate: string;
  EndDate: string;
  Status: 'ACTIVE' | 'INACTIVE';
  AssignedByUserID: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface TeacherSpecializationRecord {
  SpecializationID: string;
  TeacherID: string;
  SubjectID: string;
  CertificationNote?: string;
  Status: 'ACTIVE' | 'INACTIVE';
  AssignedByUserID: string;
  UpdatedAt: string;
}

export interface ScoreEntryLockRecord {
  LockID: string;
  AcademicYearID: string;
  ClassID: string; // Specific ClassID or 'ALL'
  PeriodType: 'MONTHLY' | 'SEMESTER' | 'ANNUAL';
  PeriodKey: string; // e.g., 'វិច្ឆិកា', 'SEM-2526-1', 'ANNUAL'
  IsLocked: boolean;
  LockedByUserID: string;
  UpdatedAt: string;
  Reason?: string;
}

export type SheetName =
  | 'Users'
  | 'Roles'
  | 'AcademicYears'
  | 'Semesters'
  | 'Classes'
  | 'Students'
  | 'Enrollments'
  | 'Subjects'
  | 'TeacherSubjectAssignments'
  | 'Exams'
  | 'Questions'
  | 'ExamAttempts'
  | 'ExamAnswers'
  | 'MonthlyScores'
  | 'SemesterScores'
  | 'AnnualResults'
  | 'GradingScales'
  | 'SystemSettings'
  | 'AuditLogs';

export type SubjectManagementSubMenuId =
  | 'SUBJECT_LIST'
  | 'SUBJECT_ACADEMIC_CONFIG'
  | 'MAX_SCORE_CONFIG'
  | 'GRADE_RANGE_CONFIG'
  | 'COEFFICIENT_CONFIG'
  | 'TEACHER_SUBJECT_CLASS_ASSIGNMENTS';

export type ScoreManagementSubMenuId =
  | 'SCORE_ENTRY'
  | 'SCORE_EDITING'
  | 'SCORES_BY_CLASS'
  | 'SCORES_BY_SUBJECT'
  | 'MISSING_SCORE_MONITORING'
  | 'SCORE_SUBMISSION_STATUS'
  | 'SCORE_MODIFICATION_HISTORY';

export type ScoreSubmissionWorkflowStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REOPEN_REQUESTED'
  | 'REOPENED'
  | 'REJECTED';

export interface ScoreSubmissionRecord {
  SubmissionID: string;
  AcademicYearID: string;
  SemesterID: string;
  GradeLevel: string;
  ClassID: string;
  SubjectID: string;
  AssessmentType: 'MONTHLY' | 'SEMESTER' | 'ANNUAL' | 'ONLINE_EXAM' | 'MANUAL_SCORE';
  Month: string;
  Status: ScoreSubmissionWorkflowStatus;
  SubmittedByUserID: string;
  SubmittedAt: string;
  ReviewedByUserID?: string;
  ReviewedAt?: string;
  ReopenReason?: string;
  ReviewNote?: string;
  TotalStudents: number;
  EnteredCount: number;
  MissingCount: number;
  UpdatedAt: string;
}

export interface ScoreModificationRecord {
  ModificationID: string;
  StudentID: string;
  StudentCode: string;
  StudentNameKh: string;
  SubjectID: string;
  SubjectNameKh: string;
  ClassID: string;
  ClassName: string;
  AcademicYearID: string;
  SemesterID: string;
  Month: string;
  AssessmentType: string;
  PreviousScore: number | null;
  NewScore: number;
  MaximumScore: number;
  ModifiedByUserID: string;
  ModifiedByNameKh: string;
  ModifiedByRole?: string;
  ModifiedAt: string;
  Reason: string;
  ApprovalStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
}

export interface SubjectGradeRangeRecord {
  SlotID: string;
  ColumnSide: 'LEFT' | 'RIGHT';
  RowIndex: number; // 1 to 9
  SubjectID?: string;
  SubjectNameKh: string;
  MaximumScore: number | null;
  GradeAThreshold: number | null; // >=
  GradeBThreshold: number | null; // >=
  GradeCThreshold: number | null; // >=
  GradeDThreshold: number | null; // >=
  GradeEThreshold: number | null; // >=
  GradeFThreshold: number | null; // <=
  AcademicYearID: string;
  UpdatedAt: string;
}

export interface DatabaseState {
  Users: UserRecord[];
  Roles: RoleRecord[];
  AcademicYears: AcademicYearRecord[];
  Semesters: SemesterRecord[];
  Classes: ClassRecord[];
  Students: StudentRecord[];
  Enrollments: EnrollmentRecord[];
  Subjects: SubjectRecord[];
  TeacherSubjectAssignments: TeacherSubjectAssignmentRecord[];
  HomeroomTeacherAssignments?: HomeroomTeacherAssignmentRecord[];
  TeacherSpecializations?: TeacherSpecializationRecord[];
  ScoreEntryLocks?: ScoreEntryLockRecord[];
  ScoreSubmissions?: ScoreSubmissionRecord[];
  ScoreModificationHistory?: ScoreModificationRecord[];
  SubjectGradeRanges?: SubjectGradeRangeRecord[];
  Exams: ExamRecord[];
  Questions: QuestionRecord[];
  ExamAttempts: ExamAttemptRecord[];
  ExamAnswers: ExamAnswerRecord[];
  MonthlyScores: MonthlyScoreRecord[];
  SemesterScores: SemesterScoreRecord[];
  AnnualResults: AnnualResultRecord[];
  GradingScales: GradingScaleRecord[];
  SystemSettings: SystemSettingRecord[];
  AuditLogs: AuditLogRecord[];
}


