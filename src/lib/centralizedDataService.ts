import React from 'react';
import {
  AcademicYearRecord,
  AuditLogRecord,
  ClassRecord,
  DatabaseState,
  DisabilityStatusCode,
  EnrollmentRecord,
  ExamAnswerRecord,
  ExamAttemptRecord,
  ExamRecord,
  GenderKh,
  GradingScaleRecord,
  OrphanStatusCode,
  PovertyLevelCode,
  QuestionAction,
  QuestionRecord,
  QuestionType,
  StudentRecord,
  StudentStatusKh,
  SubjectRecord,
  SystemSettingRecord,
  TeacherSubjectAssignmentRecord,
  UserRecord,
} from '../types/database';
import {
  ALL_DATABASE_TABLE_DESCRIPTORS,
  DatabaseTableKey,
} from './databaseBackupService';
import {
  calculateCompetitionRanking,
  canManageQuestion,
} from './domainRules';
import {
  DatabaseOperationFeedback,
  DatabasePersistenceMode,
  GasAdapterConfig,
  GasPersistenceAdapter,
  GasRpcResponse,
  serverVerifyBackendAuthorization,
} from './gasPersistenceAdapter';
import { createInitialDatabaseState } from './seedData';

// ============================================================================
// 1. PRIMARY KEY & FOREIGN KEY SCHEMA REGISTRY FOR ALL 25 TABLES
// ============================================================================

export const TABLE_PRIMARY_KEY_MAP: Record<DatabaseTableKey, string> = {
  Users: 'UserID',
  Roles: 'RoleID',
  AcademicYears: 'AcademicYearID',
  Semesters: 'SemesterID',
  Classes: 'ClassID',
  Students: 'StudentID',
  Enrollments: 'EnrollmentID',
  Subjects: 'SubjectID',
  TeacherSubjectAssignments: 'AssignmentID',
  Exams: 'ExamID',
  Questions: 'QuestionID',
  ExamAttempts: 'AttemptID',
  ExamAnswers: 'AnswerID',
  MonthlyScores: 'MonthlyScoreID',
  SemesterScores: 'SemesterScoreID',
  AnnualResults: 'AnnualResultID',
  GradingScales: 'GradingScaleID',
  SystemSettings: 'SettingID',
  AuditLogs: 'LogID',
  HomeroomTeacherAssignments: 'AssignmentID',
  TeacherSpecializations: 'SpecializationID',
  ScoreEntryLocks: 'LockID',
  ScoreSubmissions: 'SubmissionID',
  ScoreModificationHistory: 'ModificationID',
  SubjectGradeRanges: 'SlotID',
};

export interface ForeignKeyRule {
  field: string;
  targetTable: DatabaseTableKey;
  targetPrimaryKey: string;
  optional?: boolean;
  allowedSentinels?: string[];
}

export const TABLE_FOREIGN_KEY_RULES: Partial<
  Record<DatabaseTableKey, ForeignKeyRule[]>
> = {
  Users: [
    { field: 'RoleID', targetTable: 'Roles', targetPrimaryKey: 'RoleID' },
  ],
  Semesters: [
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
    },
  ],
  Classes: [
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
    },
    {
      field: 'HomeroomTeacherID',
      targetTable: 'Users',
      targetPrimaryKey: 'UserID',
      optional: true,
    },
  ],
  Enrollments: [
    { field: 'StudentID', targetTable: 'Students', targetPrimaryKey: 'StudentID' },
    { field: 'ClassID', targetTable: 'Classes', targetPrimaryKey: 'ClassID' },
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
    },
  ],
  TeacherSubjectAssignments: [
    { field: 'TeacherID', targetTable: 'Users', targetPrimaryKey: 'UserID' },
    { field: 'SubjectID', targetTable: 'Subjects', targetPrimaryKey: 'SubjectID' },
    { field: 'ClassID', targetTable: 'Classes', targetPrimaryKey: 'ClassID' },
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
    },
  ],
  Exams: [
    { field: 'SubjectID', targetTable: 'Subjects', targetPrimaryKey: 'SubjectID' },
    { field: 'ClassID', targetTable: 'Classes', targetPrimaryKey: 'ClassID' },
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
      optional: true,
    },
    {
      field: 'SemesterID',
      targetTable: 'Semesters',
      targetPrimaryKey: 'SemesterID',
      optional: true,
    },
  ],
  Questions: [
    { field: 'SubjectID', targetTable: 'Subjects', targetPrimaryKey: 'SubjectID' },
  ],
  ExamAttempts: [
    { field: 'ExamID', targetTable: 'Exams', targetPrimaryKey: 'ExamID' },
    { field: 'StudentID', targetTable: 'Students', targetPrimaryKey: 'StudentID' },
  ],
  ExamAnswers: [
    {
      field: 'AttemptID',
      targetTable: 'ExamAttempts',
      targetPrimaryKey: 'AttemptID',
    },
    {
      field: 'QuestionID',
      targetTable: 'Questions',
      targetPrimaryKey: 'QuestionID',
    },
    {
      field: 'StudentID',
      targetTable: 'Students',
      targetPrimaryKey: 'StudentID',
      optional: true,
    },
  ],
  MonthlyScores: [
    { field: 'StudentID', targetTable: 'Students', targetPrimaryKey: 'StudentID' },
    { field: 'ClassID', targetTable: 'Classes', targetPrimaryKey: 'ClassID' },
    {
      field: 'SubjectID',
      targetTable: 'Subjects',
      targetPrimaryKey: 'SubjectID',
      allowedSentinels: ['ALL'],
    },
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
    },
  ],
  SemesterScores: [
    { field: 'StudentID', targetTable: 'Students', targetPrimaryKey: 'StudentID' },
    { field: 'ClassID', targetTable: 'Classes', targetPrimaryKey: 'ClassID' },
    {
      field: 'SubjectID',
      targetTable: 'Subjects',
      targetPrimaryKey: 'SubjectID',
      allowedSentinels: ['ALL'],
    },
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
    },
    {
      field: 'SemesterID',
      targetTable: 'Semesters',
      targetPrimaryKey: 'SemesterID',
    },
  ],
  AnnualResults: [
    { field: 'StudentID', targetTable: 'Students', targetPrimaryKey: 'StudentID' },
    { field: 'ClassID', targetTable: 'Classes', targetPrimaryKey: 'ClassID' },
    {
      field: 'SubjectID',
      targetTable: 'Subjects',
      targetPrimaryKey: 'SubjectID',
      allowedSentinels: ['ALL'],
    },
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
    },
  ],
  GradingScales: [
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
      optional: true,
    },
  ],
  HomeroomTeacherAssignments: [
    { field: 'TeacherID', targetTable: 'Users', targetPrimaryKey: 'UserID' },
    { field: 'ClassID', targetTable: 'Classes', targetPrimaryKey: 'ClassID' },
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
    },
  ],
  TeacherSpecializations: [
    { field: 'TeacherID', targetTable: 'Users', targetPrimaryKey: 'UserID' },
    { field: 'SubjectID', targetTable: 'Subjects', targetPrimaryKey: 'SubjectID' },
  ],
  ScoreEntryLocks: [
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
    },
    {
      field: 'ClassID',
      targetTable: 'Classes',
      targetPrimaryKey: 'ClassID',
      allowedSentinels: ['ALL'],
    },
  ],
  ScoreSubmissions: [
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
    },
    {
      field: 'SemesterID',
      targetTable: 'Semesters',
      targetPrimaryKey: 'SemesterID',
    },
    { field: 'ClassID', targetTable: 'Classes', targetPrimaryKey: 'ClassID' },
    { field: 'SubjectID', targetTable: 'Subjects', targetPrimaryKey: 'SubjectID' },
  ],
  ScoreModificationHistory: [
    { field: 'StudentID', targetTable: 'Students', targetPrimaryKey: 'StudentID' },
    { field: 'SubjectID', targetTable: 'Subjects', targetPrimaryKey: 'SubjectID' },
    { field: 'ClassID', targetTable: 'Classes', targetPrimaryKey: 'ClassID' },
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
    },
    {
      field: 'SemesterID',
      targetTable: 'Semesters',
      targetPrimaryKey: 'SemesterID',
    },
  ],
  SubjectGradeRanges: [
    {
      field: 'SubjectID',
      targetTable: 'Subjects',
      targetPrimaryKey: 'SubjectID',
      optional: true,
    },
    {
      field: 'AcademicYearID',
      targetTable: 'AcademicYears',
      targetPrimaryKey: 'AcademicYearID',
      optional: true,
    },
  ],
};

// ============================================================================
// 2. PERSISTENCE ADAPTER (IN_MEMORY_PREVIEW + GAS_PRODUCTION)
// ============================================================================

export type DataPersistenceMode = DatabasePersistenceMode;

export interface DataServiceOperationLog {
  operationId: string;
  operationType: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'TRANSACTION';
  tableKey: DatabaseTableKey | 'MULTI_TABLE';
  recordId: string;
  timestamp: string;
  mode: DataPersistenceMode;
}

export interface DataServiceMutationResult<T = unknown> {
  ok: boolean;
  persisted?: boolean;
  mode?: DataPersistenceMode;
  db: DatabaseState;
  record?: T;
  records?: T[];
  errorCode?:
    | 'DUPLICATE_PRIMARY_ID'
    | 'DUPLICATE_TEACHER_SUBJECT_ASSIGNMENT'
    | 'INVALID_FOREIGN_KEY'
    | 'RECORD_NOT_FOUND'
    | 'MISSING_PRIMARY_ID'
    | 'GAS_UNAVAILABLE'
    | 'GAS_DISCONNECTED'
    | 'GAS_NETWORK_ERROR'
    | 'DUPLICATE_SUBMISSION_IN_FLIGHT'
    | 'SERVER_DUPLICATE_PRIMARY_ID'
    | 'SERVER_DUPLICATE_TEACHER_SUBJECT_ASSIGNMENT'
    | 'SERVER_INVALID_FOREIGN_KEY'
    | 'SERVER_RECORD_NOT_FOUND'
    | 'SERVER_UNAUTHORIZED_ROLE'
    | 'SERVER_TEACHER_SUBJECT_FORBIDDEN'
    | 'SERVER_QUESTION_OWNERSHIP_FORBIDDEN'
    | 'SERVER_VALIDATION_FAILED';
  errorMessageKh?: string;
  errorMessageEn?: string;
}

// ============================================================================
// 3. VALIDATION ENGINE (PRIMARY ID DUPLICATES, FK INTEGRITY, TEACHER-SUBJECT)
// ============================================================================

export function getTablePrimaryKey(tableKey: DatabaseTableKey): string {
  return TABLE_PRIMARY_KEY_MAP[tableKey];
}

export function readTableRecords<K extends DatabaseTableKey>(
  db: DatabaseState,
  tableKey: K
): NonNullable<DatabaseState[K]> {
  const raw = db[tableKey];
  return (Array.isArray(raw) ? raw : []) as NonNullable<DatabaseState[K]>;
}

/**
 * Validates that a record has a non-empty Primary ID and that the Primary ID
 * does not already exist in the target table.
 */
export function validatePrimaryIdNotDuplicate(
  db: DatabaseState,
  tableKey: DatabaseTableKey,
  candidateRecord: Record<string, unknown>,
  excludePrimaryId?: string
): {
  valid: boolean;
  primaryKey: string;
  primaryIdValue: string;
  errorCode?: 'MISSING_PRIMARY_ID' | 'DUPLICATE_PRIMARY_ID';
  errorMessageKh?: string;
  errorMessageEn?: string;
} {
  const primaryKey = getTablePrimaryKey(tableKey);
  const primaryIdValue = String(candidateRecord[primaryKey] ?? '').trim();

  if (!primaryIdValue) {
    return {
      valid: false,
      primaryKey,
      primaryIdValue: '',
      errorCode: 'MISSING_PRIMARY_ID',
      errorMessageKh: `បាត់លេខសម្គាល់ Primary ID (${primaryKey}) សម្រាប់តារាង ${tableKey}។`,
      errorMessageEn: `Missing primary key "${primaryKey}" on table "${tableKey}".`,
    };
  }

  const records = readTableRecords(db, tableKey) as unknown as Record<
    string,
    unknown
  >[];
  const duplicateExists = records.some((existing) => {
    const existingId = String(existing[primaryKey] ?? '').trim();
    if (excludePrimaryId && existingId === excludePrimaryId) {
      return false;
    }
    return existingId === primaryIdValue;
  });

  if (duplicateExists) {
    return {
      valid: false,
      primaryKey,
      primaryIdValue,
      errorCode: 'DUPLICATE_PRIMARY_ID',
      errorMessageKh: `លេខសម្គាល់ ${primaryKey}="${primaryIdValue}" មានរួចហើយនៅក្នុងតារាង ${tableKey} (Duplicate Primary ID)។`,
      errorMessageEn: `Duplicate primary key ${primaryKey}="${primaryIdValue}" in table "${tableKey}".`,
    };
  }

  return {
    valid: true,
    primaryKey,
    primaryIdValue,
  };
}

/**
 * Validates foreign-key relationships for a candidate record before saving or updating.
 */
export function validateForeignKeyRelationships(
  db: DatabaseState,
  tableKey: DatabaseTableKey,
  candidateRecord: Record<string, unknown>
): {
  valid: boolean;
  failedField?: string;
  targetTable?: DatabaseTableKey;
  errorMessageKh?: string;
  errorMessageEn?: string;
} {
  const fkRules = TABLE_FOREIGN_KEY_RULES[tableKey];
  if (!fkRules || fkRules.length === 0) {
    return { valid: true };
  }

  for (const rule of fkRules) {
    const rawValue = candidateRecord[rule.field];
    const strValue =
      rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();

    if (!strValue) {
      if (rule.optional) continue;
      return {
        valid: false,
        failedField: rule.field,
        targetTable: rule.targetTable,
        errorMessageKh: `បាត់តម្លៃ Foreign Key "${rule.field}" ដែលត្រូវភ្ជាប់ទៅតារាង ${rule.targetTable}។`,
        errorMessageEn: `Missing required foreign key "${rule.field}" referencing "${rule.targetTable}.${rule.targetPrimaryKey}".`,
      };
    }

    if (rule.allowedSentinels && rule.allowedSentinels.includes(strValue)) {
      continue;
    }

    const targetRecords = readTableRecords(
      db,
      rule.targetTable
    ) as unknown as Record<string, unknown>[];
    const existsInTarget = targetRecords.some(
      (targetRow) =>
        String(targetRow[rule.targetPrimaryKey] ?? '').trim() === strValue
    );

    if (!existsInTarget) {
      return {
        valid: false,
        failedField: rule.field,
        targetTable: rule.targetTable,
        errorMessageKh: `តម្លៃ Foreign Key ${tableKey}.${rule.field}="${strValue}" មិនមាននៅក្នុងតារាង ${rule.targetTable} (${rule.targetPrimaryKey}) ទេ។`,
        errorMessageEn: `Invalid foreign key ${tableKey}.${rule.field}="${strValue}" — not found in ${rule.targetTable}.${rule.targetPrimaryKey}.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Requirement 6: Prevent duplicate TeacherSubjectAssignments using the existing
 * TeacherID + SubjectID + AcademicYearID combination.
 */
export function validateTeacherSubjectAssignmentCombination(
  db: DatabaseState,
  candidate: Partial<TeacherSubjectAssignmentRecord>,
  excludeAssignmentId?: string
): {
  valid: boolean;
  existingDuplicate?: TeacherSubjectAssignmentRecord;
  errorMessageKh?: string;
  errorMessageEn?: string;
} {
  const teacherId = String(candidate.TeacherID ?? '').trim();
  const subjectId = String(candidate.SubjectID ?? '').trim();
  const academicYearId = String(candidate.AcademicYearID ?? '').trim();

  if (!teacherId || !subjectId || !academicYearId) {
    return {
      valid: false,
      errorMessageKh:
        'ត្រូវការ TeacherID, SubjectID និង AcademicYearID សម្រាប់ការចាត់តាំងគ្រូមុខវិជ្ជា។',
      errorMessageEn:
        'TeacherID, SubjectID, and AcademicYearID are required for TeacherSubjectAssignments.',
    };
  }

  const existingDuplicate = db.TeacherSubjectAssignments.find((asn) => {
    if (excludeAssignmentId && asn.AssignmentID === excludeAssignmentId) {
      return false;
    }
    return (
      asn.TeacherID === teacherId &&
      asn.SubjectID === subjectId &&
      asn.AcademicYearID === academicYearId
    );
  });

  if (existingDuplicate) {
    return {
      valid: false,
      existingDuplicate,
      errorMessageKh: `ការចាត់តាំងគ្រូ (${teacherId}) សម្រាប់មុខវិជ្ជា (${subjectId}) ក្នុងឆ្នាំសិក្សា (${academicYearId}) មានរួចហើយ (${existingDuplicate.AssignmentID})។ មិនអនុញ្ញាតឱ្យបង្កើតស្ទួនទេ។`,
      errorMessageEn: `Duplicate TeacherSubjectAssignment prevented for combination TeacherID="${teacherId}" + SubjectID="${subjectId}" + AcademicYearID="${academicYearId}" (existing: ${existingDuplicate.AssignmentID}).`,
    };
  }

  return { valid: true };
}

// ============================================================================
// 4. CENTRALIZED CRUD SERVICE (READ, CREATE, UPDATE, DELETE ACROSS 25 TABLES)
// ============================================================================

export function recomputeClassRankingsInDb(
  nextDb: DatabaseState,
  classId: string
): DatabaseState {
  const enrolledIds = new Set(
    nextDb.Enrollments.filter((e) => e.ClassID === classId).map(
      (e) => e.StudentID
    )
  );
  const classStudents = nextDb.Students.filter((s) =>
    enrolledIds.has(s.StudentID)
  );

  const monthlyRaw = classStudents.map((st) => {
    const m = nextDb.MonthlyScores.find(
      (ms) => ms.StudentID === st.StudentID && ms.ClassID === classId
    );
    return {
      studentId: st.StudentID,
      studentCode: st.StudentCode,
      lastNameKh: st.LastNameKh,
      firstNameKh: st.FirstNameKh,
      gender: st.Gender,
      averageScore: m ? m.AverageScore : 30.0,
    };
  });
  const rankedMonthly = calculateCompetitionRanking(monthlyRaw, 50);

  const annualRaw = classStudents.map((st) => {
    const a = nextDb.AnnualResults.find(
      (an) => an.StudentID === st.StudentID && an.ClassID === classId
    );
    return {
      studentId: st.StudentID,
      studentCode: st.StudentCode,
      lastNameKh: st.LastNameKh,
      firstNameKh: st.FirstNameKh,
      gender: st.Gender,
      averageScore: a ? a.AnnualAverage : 30.0,
    };
  });
  const rankedAnnual = calculateCompetitionRanking(annualRaw, 50);

  const updatedMonthlyScores = nextDb.MonthlyScores.map((ms) => {
    if (ms.ClassID !== classId) return ms;
    const r = rankedMonthly.find((item) => item.studentId === ms.StudentID);
    if (!r) return ms;
    return {
      ...ms,
      Ranking: r.ranking,
      Grade: r.grade,
      IsPass: r.passStatus,
      IsHonorRoll: r.isHonorRoll,
    };
  });

  const updatedAnnualResults = nextDb.AnnualResults.map((an) => {
    if (an.ClassID !== classId) return an;
    const r = rankedAnnual.find((item) => item.studentId === an.StudentID);
    if (!r) return an;
    return {
      ...an,
      Ranking: r.ranking,
      Grade: r.grade,
      ResultStatus: r.passStatus,
      IsHonorRoll: r.isHonorRoll,
    };
  });

  return {
    ...nextDb,
    MonthlyScores: updatedMonthlyScores,
    AnnualResults: updatedAnnualResults,
  };
}

export const DataService = {
  /**
   * Returns metadata for all 25 tables managed by the Centralized Data Service.
   */
  getTableDescriptors() {
    return ALL_DATABASE_TABLE_DESCRIPTORS;
  },

  /**
   * Returns the current Database Persistence Mode: 'IN_MEMORY_PREVIEW' | 'GAS_PRODUCTION'
   */
  getPersistenceMode(): DataPersistenceMode {
    return GasPersistenceAdapter.getConfig().mode;
  },

  /**
   * Returns the complete Google Apps Script / Google Sheets Adapter Configuration.
   */
  getAdapterConfig(): GasAdapterConfig {
    return GasPersistenceAdapter.getConfig();
  },

  /**
   * Switches explicitly between 'IN_MEMORY_PREVIEW' and 'GAS_PRODUCTION'.
   */
  setPersistenceMode(
    mode: DataPersistenceMode,
    options?: {
      currentDb?: DatabaseState;
      gasWebAppUrl?: string;
      simulateConnectionFailure?: boolean;
    }
  ) {
    return GasPersistenceAdapter.setMode(mode, options);
  },

  /**
   * Simulates or clears a GAS connection failure (for testing no-silent-fallback behavior).
   */
  setSimulateGasFailure(simulateFailure: boolean): GasAdapterConfig {
    return GasPersistenceAdapter.setSimulateConnectionFailure(simulateFailure);
  },

  /**
   * Updates the active authenticated actor UserID for backend authorization checks.
   */
  setActiveActorUserId(userId: string): void {
    GasPersistenceAdapter.setActiveActorUserId(userId);
  },

  /**
   * Subscribes to real-time operation feedback (LOADING, SUCCESS, ERROR) and connection status.
   */
  subscribeFeedback(
    listener: (
      feedback: DatabaseOperationFeedback,
      config: GasAdapterConfig
    ) => void
  ): () => void {
    return GasPersistenceAdapter.subscribe(listener);
  },

  /**
   * Initializes the DatabaseState on application startup or reload:
   * - In GAS_PRODUCTION mode (when connected): loads the persisted 25-table state from Google Sheets.
   * - In IN_MEMORY_PREVIEW mode: loads the initial seed state (488 records across 25 tables).
   */
  initializeDatabaseState(): DatabaseState {
    const cfg = GasPersistenceAdapter.getConfig();
    if (
      cfg.mode === 'GAS_PRODUCTION' &&
      cfg.connectionState === 'CONNECTED' &&
      !cfg.simulateConnectionFailure
    ) {
      return GasPersistenceAdapter.readPersistedGoogleSheetsState();
    }
    return createInitialDatabaseState();
  },

  /**
   * Explicitly reads all 25 tables from Google Sheets via the GAS Adapter.
   */
  readAllTablesFromGoogleSheets(
    actorUserId = 'USR-TCH-12C'
  ): GasRpcResponse<DatabaseState> {
    return GasPersistenceAdapter.executeServerRpc<DatabaseState>({
      module: 'Database',
      action: 'readAll25Tables',
      actorUserId,
    });
  },

  /**
   * READ: Returns all records in a given table.
   */
  readTable<K extends DatabaseTableKey>(
    db: DatabaseState,
    tableKey: K
  ): NonNullable<DatabaseState[K]> {
    return readTableRecords(db, tableKey);
  },

  /**
   * READ: Finds a single record by its table-specific Primary ID.
   */
  findById<
    K extends DatabaseTableKey,
    R = NonNullable<DatabaseState[K]>[number],
  >(db: DatabaseState, tableKey: K, primaryId: string): R | undefined {
    const pk = getTablePrimaryKey(tableKey);
    const records = readTableRecords(db, tableKey) as unknown as Record<
      string,
      unknown
    >[];
    const targetId = String(primaryId).trim();
    return records.find(
      (row) => String(row[pk] ?? '').trim() === targetId
    ) as R | undefined;
  },

  /**
   * READ: Filters records in a table using a predicate function.
   */
  findWhere<
    K extends DatabaseTableKey,
    R = NonNullable<DatabaseState[K]>[number],
  >(
    db: DatabaseState,
    tableKey: K,
    predicate: (record: R, index: number) => boolean
  ): R[] {
    const records = readTableRecords(db, tableKey) as unknown as R[];
    return records.filter(predicate);
  },

  /**
   * CREATE: Validates Primary ID uniqueness, Foreign Key relationships,
   * TeacherSubjectAssignments uniqueness, and backend RBAC before inserting a new record.
   * In GAS_PRODUCTION mode, persists to Google Sheets and NEVER silently falls back on failure.
   */
  createRecord<
    K extends DatabaseTableKey,
    R extends object = NonNullable<DatabaseState[K]>[number],
  >(
    db: DatabaseState,
    tableKey: K,
    newRecord: R,
    options?: {
      position?: 'APPEND' | 'PREPEND';
      skipForeignKeyValidation?: boolean;
      actorUserId?: string;
      operationKey?: string;
      auditLog?: Omit<AuditLogRecord, 'LogID' | 'Timestamp'> & {
        LogID?: string;
        Timestamp?: string;
      };
    }
  ): DataServiceMutationResult<R> {
    const cfg = GasPersistenceAdapter.getConfig();
    const pk = getTablePrimaryKey(tableKey);
    const candidateId = String(
      (newRecord as Record<string, unknown>)[pk] ?? ''
    ).trim();
    const opKey =
      options?.operationKey || `CREATE:${tableKey}:${candidateId || 'NEW'}`;

    // 0. Duplicate submission guard
    if (GasPersistenceAdapter.isOperationInFlight(opKey)) {
      return {
        ok: false,
        persisted: false,
        mode: cfg.mode,
        db,
        errorCode: 'DUPLICATE_SUBMISSION_IN_FLIGHT',
        errorMessageKh: `ប្រតិបត្តិការបង្កើតកំណត់ត្រា (${tableKey}) កំពុងដំណើរការរួចហើយ។ សូមកុំចុចបញ្ជូនស្ទួន។`,
        errorMessageEn: `Duplicate submission prevented: CREATE on "${tableKey}" is already in progress.`,
      };
    }

    // 0b. In GAS_PRODUCTION mode, verify GAS availability (STRICT NO SILENT FALLBACK!)
    if (cfg.mode === 'GAS_PRODUCTION') {
      const gasCheck = GasPersistenceAdapter.assertGasAvailableForProduction(
        `CREATE ${tableKey}`
      );
      if (!gasCheck.available && gasCheck.errorResponse) {
        return {
          ok: false,
          persisted: false,
          mode: 'GAS_PRODUCTION',
          db,
          errorCode: gasCheck.errorResponse.errorCode,
          errorMessageKh: gasCheck.errorResponse.errorMessageKh,
          errorMessageEn: gasCheck.errorResponse.errorMessageEn,
        };
      }
    }

    // 0c. Server-side RBAC & Teacher Subject Restriction check when actorUserId is provided
    if (options?.actorUserId) {
      const authCheck = serverVerifyBackendAuthorization(
        db,
        options.actorUserId,
        tableKey,
        'CREATE',
        newRecord as Record<string, unknown>
      );
      if (!authCheck.allowed) {
        return {
          ok: false,
          persisted: false,
          mode: cfg.mode,
          db,
          errorCode: authCheck.errorCode || 'SERVER_UNAUTHORIZED_ROLE',
          errorMessageKh: authCheck.errorMessageKh,
          errorMessageEn: authCheck.errorMessageEn,
        };
      }
    }

    // 1. Validate Primary ID uniqueness
    const pkCheck = validatePrimaryIdNotDuplicate(
      db,
      tableKey,
      newRecord as Record<string, unknown>
    );
    if (!pkCheck.valid) {
      return {
        ok: false,
        persisted: false,
        mode: cfg.mode,
        db,
        errorCode: pkCheck.errorCode,
        errorMessageKh: pkCheck.errorMessageKh,
        errorMessageEn: pkCheck.errorMessageEn,
      };
    }

    // 2. Prevent duplicate TeacherSubjectAssignments (TeacherID + SubjectID + AcademicYearID)
    if (tableKey === 'TeacherSubjectAssignments') {
      const asnCheck = validateTeacherSubjectAssignmentCombination(
        db,
        newRecord as unknown as Partial<TeacherSubjectAssignmentRecord>
      );
      if (!asnCheck.valid) {
        return {
          ok: false,
          persisted: false,
          mode: cfg.mode,
          db,
          errorCode: 'DUPLICATE_TEACHER_SUBJECT_ASSIGNMENT',
          errorMessageKh: asnCheck.errorMessageKh,
          errorMessageEn: asnCheck.errorMessageEn,
        };
      }
    }

    // 3. Validate Foreign-Key relationships
    if (!options?.skipForeignKeyValidation) {
      const fkCheck = validateForeignKeyRelationships(
        db,
        tableKey,
        newRecord as Record<string, unknown>
      );
      if (!fkCheck.valid) {
        return {
          ok: false,
          persisted: false,
          mode: cfg.mode,
          db,
          errorCode: 'INVALID_FOREIGN_KEY',
          errorMessageKh: fkCheck.errorMessageKh,
          errorMessageEn: fkCheck.errorMessageEn,
        };
      }
    }

    const existingList = readTableRecords(db, tableKey) as unknown as R[];
    const nextList =
      options?.position === 'PREPEND'
        ? [newRecord, ...existingList]
        : [...existingList, newRecord];

    let nextAuditLogs = db.AuditLogs;
    if (options?.auditLog) {
      const now = options.auditLog.Timestamp || new Date().toISOString();
      const logId =
        options.auditLog.LogID ||
        `LOG-${String(db.AuditLogs.length + 1).padStart(4, '0')}`;
      nextAuditLogs = [
        {
          ...options.auditLog,
          LogID: logId,
          Timestamp: now,
        },
        ...db.AuditLogs,
      ];
    }

    const nextDb: DatabaseState = {
      ...db,
      [tableKey]: nextList,
      AuditLogs: nextAuditLogs,
    };

    if (cfg.mode === 'GAS_PRODUCTION') {
      GasPersistenceAdapter.writePersistedGoogleSheetsState(nextDb);
    }

    return {
      ok: true,
      persisted: cfg.mode === 'GAS_PRODUCTION',
      mode: cfg.mode,
      db: nextDb,
      record: newRecord,
    };
  },

  /**
   * UPDATE: Validates target existence, Primary ID collision, Foreign Key relationships,
   * TeacherSubjectAssignments uniqueness, and backend RBAC before updating a record by Primary ID.
   * In GAS_PRODUCTION mode, persists to Google Sheets and NEVER silently falls back on failure.
   */
  updateRecord<
    K extends DatabaseTableKey,
    R extends object = NonNullable<DatabaseState[K]>[number],
  >(
    db: DatabaseState,
    tableKey: K,
    primaryId: string,
    patchOrUpdater: Partial<R> | ((existing: R) => R),
    options?: {
      skipForeignKeyValidation?: boolean;
      actorUserId?: string;
      operationKey?: string;
      auditLog?: Omit<AuditLogRecord, 'LogID' | 'Timestamp'> & {
        LogID?: string;
        Timestamp?: string;
      };
    }
  ): DataServiceMutationResult<R> {
    const cfg = GasPersistenceAdapter.getConfig();
    const pk = getTablePrimaryKey(tableKey);
    const targetId = String(primaryId).trim();
    const opKey = options?.operationKey || `UPDATE:${tableKey}:${targetId}`;

    // 0. Duplicate submission guard
    if (GasPersistenceAdapter.isOperationInFlight(opKey)) {
      return {
        ok: false,
        persisted: false,
        mode: cfg.mode,
        db,
        errorCode: 'DUPLICATE_SUBMISSION_IN_FLIGHT',
        errorMessageKh: `ប្រតិបត្តិការកែប្រែកំណត់ត្រា (${tableKey}: ${targetId}) កំពុងដំណើរការរួចហើយ។ សូមកុំចុចបញ្ជូនស្ទួន។`,
        errorMessageEn: `Duplicate submission prevented: UPDATE on "${tableKey}" (${targetId}) is already in progress.`,
      };
    }

    // 0b. In GAS_PRODUCTION mode, verify GAS availability (STRICT NO SILENT FALLBACK!)
    if (cfg.mode === 'GAS_PRODUCTION') {
      const gasCheck = GasPersistenceAdapter.assertGasAvailableForProduction(
        `UPDATE ${tableKey} (${targetId})`
      );
      if (!gasCheck.available && gasCheck.errorResponse) {
        return {
          ok: false,
          persisted: false,
          mode: 'GAS_PRODUCTION',
          db,
          errorCode: gasCheck.errorResponse.errorCode,
          errorMessageKh: gasCheck.errorResponse.errorMessageKh,
          errorMessageEn: gasCheck.errorResponse.errorMessageEn,
        };
      }
    }

    const existingList = readTableRecords(db, tableKey) as unknown as R[];
    const targetIndex = existingList.findIndex(
      (row) =>
        String((row as Record<string, unknown>)[pk] ?? '').trim() === targetId
    );

    if (targetIndex === -1) {
      return {
        ok: false,
        persisted: false,
        mode: cfg.mode,
        db,
        errorCode: 'RECORD_NOT_FOUND',
        errorMessageKh: `រកមិនឃើញកំណត់ត្រា ${pk}="${targetId}" នៅក្នុងតារាង ${tableKey} ទេ។`,
        errorMessageEn: `Record with ${pk}="${targetId}" not found in table "${tableKey}".`,
      };
    }

    const currentRecord = existingList[targetIndex];
    const updatedRecord: R =
      typeof patchOrUpdater === 'function'
        ? patchOrUpdater(currentRecord)
        : ({ ...currentRecord, ...patchOrUpdater } as R);

    // 0c. Server-side RBAC & Teacher Subject Restriction check when actorUserId is provided
    if (options?.actorUserId) {
      const authCheck = serverVerifyBackendAuthorization(
        db,
        options.actorUserId,
        tableKey,
        'UPDATE',
        updatedRecord as Record<string, unknown>,
        currentRecord as Record<string, unknown>
      );
      if (!authCheck.allowed) {
        return {
          ok: false,
          persisted: false,
          mode: cfg.mode,
          db,
          errorCode: authCheck.errorCode || 'SERVER_UNAUTHORIZED_ROLE',
          errorMessageKh: authCheck.errorMessageKh,
          errorMessageEn: authCheck.errorMessageEn,
        };
      }
    }

    // 1. Validate Primary ID was not changed to a duplicate
    const pkCheck = validatePrimaryIdNotDuplicate(
      db,
      tableKey,
      updatedRecord as Record<string, unknown>,
      targetId
    );
    if (!pkCheck.valid) {
      return {
        ok: false,
        persisted: false,
        mode: cfg.mode,
        db,
        errorCode: pkCheck.errorCode,
        errorMessageKh: pkCheck.errorMessageKh,
        errorMessageEn: pkCheck.errorMessageEn,
      };
    }

    // 2. If TeacherSubjectAssignments, prevent updating into a duplicate TeacherID + SubjectID + AcademicYearID
    if (tableKey === 'TeacherSubjectAssignments') {
      const asnCheck = validateTeacherSubjectAssignmentCombination(
        db,
        updatedRecord as unknown as Partial<TeacherSubjectAssignmentRecord>,
        targetId
      );
      if (!asnCheck.valid) {
        return {
          ok: false,
          persisted: false,
          mode: cfg.mode,
          db,
          errorCode: 'DUPLICATE_TEACHER_SUBJECT_ASSIGNMENT',
          errorMessageKh: asnCheck.errorMessageKh,
          errorMessageEn: asnCheck.errorMessageEn,
        };
      }
    }

    // 3. Validate Foreign-Key relationships on updated record
    if (!options?.skipForeignKeyValidation) {
      const fkCheck = validateForeignKeyRelationships(
        db,
        tableKey,
        updatedRecord as Record<string, unknown>
      );
      if (!fkCheck.valid) {
        return {
          ok: false,
          persisted: false,
          mode: cfg.mode,
          db,
          errorCode: 'INVALID_FOREIGN_KEY',
          errorMessageKh: fkCheck.errorMessageKh,
          errorMessageEn: fkCheck.errorMessageEn,
        };
      }
    }

    const nextList = existingList.map((item, idx) =>
      idx === targetIndex ? updatedRecord : item
    );

    let nextAuditLogs = db.AuditLogs;
    if (options?.auditLog) {
      const now = options.auditLog.Timestamp || new Date().toISOString();
      const logId =
        options.auditLog.LogID ||
        `LOG-${String(db.AuditLogs.length + 1).padStart(4, '0')}`;
      nextAuditLogs = [
        {
          ...options.auditLog,
          LogID: logId,
          Timestamp: now,
        },
        ...db.AuditLogs,
      ];
    }

    const nextDb: DatabaseState = {
      ...db,
      [tableKey]: nextList,
      AuditLogs: nextAuditLogs,
    };

    if (cfg.mode === 'GAS_PRODUCTION') {
      GasPersistenceAdapter.writePersistedGoogleSheetsState(nextDb);
    }

    return {
      ok: true,
      persisted: cfg.mode === 'GAS_PRODUCTION',
      mode: cfg.mode,
      db: nextDb,
      record: updatedRecord,
    };
  },

  /**
   * DELETE: Deletes a record by Primary ID from the specified table.
   * In GAS_PRODUCTION mode, persists to Google Sheets and NEVER silently falls back on failure.
   */
  deleteRecord<
    K extends DatabaseTableKey,
    R extends object = NonNullable<DatabaseState[K]>[number],
  >(
    db: DatabaseState,
    tableKey: K,
    primaryId: string,
    options?: {
      actorUserId?: string;
      operationKey?: string;
      auditLog?: Omit<AuditLogRecord, 'LogID' | 'Timestamp'> & {
        LogID?: string;
        Timestamp?: string;
      };
    }
  ): DataServiceMutationResult<R> {
    const cfg = GasPersistenceAdapter.getConfig();
    const pk = getTablePrimaryKey(tableKey);
    const targetId = String(primaryId).trim();
    const opKey = options?.operationKey || `DELETE:${tableKey}:${targetId}`;

    // 0. Duplicate submission guard
    if (GasPersistenceAdapter.isOperationInFlight(opKey)) {
      return {
        ok: false,
        persisted: false,
        mode: cfg.mode,
        db,
        errorCode: 'DUPLICATE_SUBMISSION_IN_FLIGHT',
        errorMessageKh: `ប្រតិបត្តិការលុបកំណត់ត្រា (${tableKey}: ${targetId}) កំពុងដំណើរការរួចហើយ។ សូមកុំចុចបញ្ជូនស្ទួន។`,
        errorMessageEn: `Duplicate submission prevented: DELETE on "${tableKey}" (${targetId}) is already in progress.`,
      };
    }

    // 0b. In GAS_PRODUCTION mode, verify GAS availability (STRICT NO SILENT FALLBACK!)
    if (cfg.mode === 'GAS_PRODUCTION') {
      const gasCheck = GasPersistenceAdapter.assertGasAvailableForProduction(
        `DELETE ${tableKey} (${targetId})`
      );
      if (!gasCheck.available && gasCheck.errorResponse) {
        return {
          ok: false,
          persisted: false,
          mode: 'GAS_PRODUCTION',
          db,
          errorCode: gasCheck.errorResponse.errorCode,
          errorMessageKh: gasCheck.errorResponse.errorMessageKh,
          errorMessageEn: gasCheck.errorResponse.errorMessageEn,
        };
      }
    }

    const existingList = readTableRecords(db, tableKey) as unknown as R[];
    const targetRecord = existingList.find(
      (row) =>
        String((row as Record<string, unknown>)[pk] ?? '').trim() === targetId
    );

    if (!targetRecord) {
      return {
        ok: false,
        persisted: false,
        mode: cfg.mode,
        db,
        errorCode: 'RECORD_NOT_FOUND',
        errorMessageKh: `រកមិនឃើញកំណត់ត្រា ${pk}="${targetId}" នៅក្នុងតារាង ${tableKey} ទេ។`,
        errorMessageEn: `Record with ${pk}="${targetId}" not found in table "${tableKey}".`,
      };
    }

    // 0c. Server-side RBAC & Teacher Subject Restriction check when actorUserId is provided
    if (options?.actorUserId) {
      const authCheck = serverVerifyBackendAuthorization(
        db,
        options.actorUserId,
        tableKey,
        'DELETE',
        targetRecord as Record<string, unknown>,
        targetRecord as Record<string, unknown>
      );
      if (!authCheck.allowed) {
        return {
          ok: false,
          persisted: false,
          mode: cfg.mode,
          db,
          errorCode: authCheck.errorCode || 'SERVER_UNAUTHORIZED_ROLE',
          errorMessageKh: authCheck.errorMessageKh,
          errorMessageEn: authCheck.errorMessageEn,
        };
      }
    }

    const nextList = existingList.filter(
      (row) =>
        String((row as Record<string, unknown>)[pk] ?? '').trim() !== targetId
    );

    let nextAuditLogs = db.AuditLogs;
    if (options?.auditLog) {
      const now = options.auditLog.Timestamp || new Date().toISOString();
      const logId =
        options.auditLog.LogID ||
        `LOG-${String(db.AuditLogs.length + 1).padStart(4, '0')}`;
      nextAuditLogs = [
        {
          ...options.auditLog,
          LogID: logId,
          Timestamp: now,
        },
        ...db.AuditLogs,
      ];
    }

    const nextDb: DatabaseState = {
      ...db,
      [tableKey]: nextList,
      AuditLogs: nextAuditLogs,
    };

    if (cfg.mode === 'GAS_PRODUCTION') {
      GasPersistenceAdapter.writePersistedGoogleSheetsState(nextDb);
    }

    return {
      ok: true,
      persisted: cfg.mode === 'GAS_PRODUCTION',
      mode: cfg.mode,
      db: nextDb,
      record: targetRecord,
    };
  },

  /**
   * Appends a single AuditLogRecord through the centralized service.
   */
  appendAuditLog(
    db: DatabaseState,
    entry: Omit<AuditLogRecord, 'LogID' | 'Timestamp'> & {
      LogID?: string;
      Timestamp?: string;
    }
  ): DatabaseState {
    const now = entry.Timestamp || new Date().toISOString();
    const logId =
      entry.LogID || `LOG-${String(db.AuditLogs.length + 1).padStart(4, '0')}`;
    const fullLog: AuditLogRecord = {
      ...entry,
      LogID: logId,
      Timestamp: now,
    };
    return {
      ...db,
      AuditLogs: [fullLog, ...db.AuditLogs],
    };
  },

  /**
   * Centralized State Commit Adapter:
   * - In IN_MEMORY_PREVIEW mode: commits state to React memory.
   * - In GAS_PRODUCTION mode: verifies GAS connection first; if GAS is unavailable,
   *   refuses to mutate React state (NO SILENT FALLBACK) and reports that data was NOT saved.
   *   If GAS is connected, commits and persists all 25 tables to Google Sheets.
   */
  commitState(
    setDb: React.Dispatch<React.SetStateAction<DatabaseState>> | undefined,
    updaterOrNextState:
      | DatabaseState
      | ((prev: DatabaseState) => DatabaseState),
    options?: {
      operationLabel?: string;
    }
  ): boolean {
    if (!setDb) return false;
    const cfg = GasPersistenceAdapter.getConfig();
    if (cfg.mode === 'GAS_PRODUCTION') {
      const check = GasPersistenceAdapter.assertGasAvailableForProduction(
        options?.operationLabel || 'COMMIT_DATABASE_STATE'
      );
      if (!check.available) {
        // Strictly NO silent fallback to in-memory storage when GAS is unavailable!
        return false;
      }
    }

    setDb((prev) => {
      const next =
        typeof updaterOrNextState === 'function'
          ? updaterOrNextState(prev)
          : updaterOrNextState;
      if (next !== prev && GasPersistenceAdapter.getConfig().mode === 'GAS_PRODUCTION') {
        GasPersistenceAdapter.executeServerRpc({
          module: 'Database',
          action: 'commitDatabaseState',
          actorUserId: GasPersistenceAdapter.getConfig().activeActorUserId,
          fullState: next,
          previousState: prev,
        });
      }
      return next;
    });
    return true;
  },

  /**
   * Factory Seed Reset routed through the Centralized Data Service.
   */
  resetToInitialSeedState(
    setDb: React.Dispatch<React.SetStateAction<DatabaseState>> | undefined
  ): DatabaseState {
    const seed = createInitialDatabaseState();
    if (setDb) {
      DataService.commitState(setDb, seed, {
        operationLabel: 'RESET_TO_INITIAL_SEED',
      });
    }
    return seed;
  },

  // ==========================================================================
  // 5. HIGH-LEVEL DOMAIN CRUD OPERATIONS ROUTED THROUGH CENTRALIZED SERVICE
  // ==========================================================================

  /**
   * Creates a new Student record along with Enrollment, MonthlyScore, and AnnualResult
   * after validating Primary ID uniqueness and ClassID Foreign Key.
   */
  addStudentRecordCascade(
    db: DatabaseState,
    payload: {
      studentCode: string;
      lastNameKh: string;
      firstNameKh: string;
      familyNameEn: string;
      givenNameEn: string;
      gender: GenderKh;
      dateOfBirth: string;
      phone: string;
      village: string;
      classId: string;
      orphanStatus: OrphanStatusCode;
      disabilityStatus: DisabilityStatusCode;
      povertyLevel: PovertyLevelCode;
      previousSchool: string;
      monthlyAverage: number;
    },
    actorUserId: string
  ): DataServiceMutationResult<StudentRecord> {
    const now = new Date().toISOString();
    const studentId = `STD-${payload.studentCode}`;
    const fullNameKh = `${payload.lastNameKh} ${payload.firstNameKh}`.trim();

    const newStudent: StudentRecord = {
      StudentID: studentId,
      StudentCode: payload.studentCode,
      LastNameKh: payload.lastNameKh,
      FirstNameKh: payload.firstNameKh,
      FullNameKh: fullNameKh,
      FamilyNameEn: payload.familyNameEn,
      GivenNameEn: payload.givenNameEn,
      Gender: payload.gender,
      DateOfBirth: payload.dateOfBirth,
      Phone: payload.phone,
      BirthVillage: payload.village,
      BirthCommune: 'ទឹកជោរ',
      BirthDistrict: 'ព្រះនេត្រព្រះ',
      BirthProvince: 'បន្ទាយមានជ័យ',
      FatherLastNameKh: payload.lastNameKh,
      FatherFirstNameKh: 'សុខា',
      FatherOccupation: 'កសិករ',
      MotherLastNameKh: 'ស៊ឹម',
      MotherFirstNameKh: 'សុភា',
      MotherOccupation: 'កសិករ',
      CurrentVillage: payload.village,
      CurrentCommune: 'ទឹកជោរ',
      CurrentDistrict: 'ព្រះនេត្រព្រះ',
      CurrentProvince: 'បន្ទាយមានជ័យ',
      OrphanStatus: payload.orphanStatus,
      DisabilityStatus: payload.disabilityStatus,
      PovertyLevel: payload.povertyLevel,
      PreviousSchool: payload.previousSchool,
      ProfileImageID: '',
      StudentStatus: 'កំពុងរៀន',
      Remarks:
        payload.monthlyAverage < 0 ? 'អវត្តមានប្រឡង (មិនចាត់ថ្នាក់)' : '',
      CreatedAt: now,
      UpdatedAt: now,
    };

    const stdCreate = DataService.createRecord(db, 'Students', newStudent);
    if (!stdCreate.ok) {
      return stdCreate;
    }

    let workingDb = stdCreate.db;

    const newEnrollment: EnrollmentRecord = {
      EnrollmentID: `ENR-2526-${payload.studentCode}`,
      StudentID: studentId,
      ClassID: payload.classId,
      AcademicYearID: 'AY-2025-2026',
      PreviousClass: '11C',
      IsNewTransfer: false,
      IsRepeater: false,
      ExamRoom: 'បន្ទប់-12C-2',
      DeskNumber: String(workingDb.Students.length),
      ExamSession: '២០២៥-២០២៦',
      EnrollmentDate: '2025-11-01',
      EnrollmentStatus: 'កំពុងរៀន',
      Remarks: '',
    };

    const enrCreate = DataService.createRecord(
      workingDb,
      'Enrollments',
      newEnrollment
    );
    if (!enrCreate.ok) {
      return {
        ok: false,
        db,
        errorCode: enrCreate.errorCode,
        errorMessageKh: enrCreate.errorMessageKh,
        errorMessageEn: enrCreate.errorMessageEn,
      };
    }
    workingDb = enrCreate.db;

    const mscCreate = DataService.createRecord(workingDb, 'MonthlyScores', {
      MonthlyScoreID: `MSC-2526-NOV-${payload.studentCode}`,
      StudentID: studentId,
      ClassID: payload.classId,
      SubjectID: 'ALL',
      AcademicYearID: 'AY-2025-2026',
      Month: 'វិច្ឆិកា',
      AssessmentType: 'MONTHLY_SUMMARY',
      Score:
        payload.monthlyAverage < 0
          ? 0
          : Math.round(payload.monthlyAverage * 10),
      MaximumScore: 500,
      AverageScore: payload.monthlyAverage,
      Ranking: null,
      Grade: 'មិនចាត់ថ្នាក់',
      IsPass: 'មិនចាត់ថ្នាក់',
      IsHonorRoll: false,
      EnteredByUserID: actorUserId,
      ApprovedByUserID: 'USR-ADM-01',
      Status: 'PUBLISHED',
      CreatedAt: now,
      UpdatedAt: now,
    });
    if (mscCreate.ok) workingDb = mscCreate.db;

    const anrCreate = DataService.createRecord(workingDb, 'AnnualResults', {
      AnnualResultID: `ANR-2526-${payload.studentCode}`,
      StudentID: studentId,
      ClassID: payload.classId,
      SubjectID: 'ALL',
      AcademicYearID: 'AY-2025-2026',
      AnnualTotal:
        payload.monthlyAverage < 0
          ? 0
          : Math.round(payload.monthlyAverage * 12),
      AnnualAverage: payload.monthlyAverage,
      Grade: 'មិនចាត់ថ្នាក់',
      Ranking: null,
      IsHonorRoll: false,
      ResultStatus: 'មិនចាត់ថ្នាក់',
      PublishedAt: now,
    });
    if (anrCreate.ok) workingDb = anrCreate.db;

    workingDb = DataService.appendAuditLog(workingDb, {
      UserID: actorUserId,
      Action: 'CREATE_STUDENT_ROSTER',
      Module: 'StudentService.gs',
      RecordID: studentId,
      OldValueJSON: '{}',
      NewValueJSON: JSON.stringify({
        StudentCode: payload.studentCode,
        ClassID: payload.classId,
      }),
      IPOrSessionReference: 'GAS-WEB-SESSION',
      Description: `Added student ${fullNameKh} (${payload.studentCode}) to ${payload.classId}`,
    });

    workingDb = recomputeClassRankingsInDb(workingDb, payload.classId);

    return {
      ok: true,
      db: workingDb,
      record: newStudent,
    };
  },

  /**
   * Updates an existing Student and their Enrollment record with FK validation.
   */
  editStudentRecordCascade(
    db: DatabaseState,
    studentId: string,
    payload: {
      studentCode: string;
      lastNameKh: string;
      firstNameKh: string;
      gender: GenderKh;
      dateOfBirth: string;
      phone: string;
      village: string;
      classId: string;
      orphanStatus: OrphanStatusCode;
      disabilityStatus: DisabilityStatusCode;
      povertyLevel: PovertyLevelCode;
      studentStatus: StudentStatusKh;
    },
    actorUserId: string
  ): DataServiceMutationResult<StudentRecord> {
    const now = new Date().toISOString();
    const fullNameKh = `${payload.lastNameKh} ${payload.firstNameKh}`.trim();

    const stdUpdate = DataService.updateRecord(
      db,
      'Students',
      studentId,
      (st) => ({
        ...st,
        StudentCode: payload.studentCode || st.StudentCode,
        LastNameKh: payload.lastNameKh,
        FirstNameKh: payload.firstNameKh,
        FullNameKh: fullNameKh,
        Gender: payload.gender,
        DateOfBirth: payload.dateOfBirth,
        Phone: payload.phone,
        BirthVillage: payload.village,
        CurrentVillage: payload.village,
        StudentStatus: payload.studentStatus,
        OrphanStatus: payload.orphanStatus,
        DisabilityStatus: payload.disabilityStatus,
        PovertyLevel: payload.povertyLevel,
        UpdatedAt: now,
      })
    );
    if (!stdUpdate.ok) return stdUpdate;

    let workingDb = stdUpdate.db;
    const targetEnrollment = workingDb.Enrollments.find(
      (e) => e.StudentID === studentId
    );
    if (targetEnrollment && payload.classId) {
      const enrUpdate = DataService.updateRecord(
        workingDb,
        'Enrollments',
        targetEnrollment.EnrollmentID,
        (enr) => ({
          ...enr,
          ClassID: payload.classId,
          EnrollmentStatus:
            payload.studentStatus === 'កំពុងរៀន'
              ? ('កំពុងរៀន' as const)
              : ('ផ្ទេរចេញ' as const),
        })
      );
      if (!enrUpdate.ok) {
        return {
          ok: false,
          db,
          errorCode: enrUpdate.errorCode,
          errorMessageKh: enrUpdate.errorMessageKh,
          errorMessageEn: enrUpdate.errorMessageEn,
        };
      }
      workingDb = enrUpdate.db;
    }

    workingDb = DataService.appendAuditLog(workingDb, {
      UserID: actorUserId,
      Action: 'EDIT_STUDENT_ROSTER',
      Module: 'StudentService.gs',
      RecordID: studentId,
      OldValueJSON: '{}',
      NewValueJSON: JSON.stringify({
        FullNameKh: fullNameKh,
        StudentStatus: payload.studentStatus,
      }),
      IPOrSessionReference: 'GAS-WEB-SESSION',
      Description: `Updated student record ${fullNameKh} (${studentId})`,
    });

    return {
      ok: true,
      db: workingDb,
      record: stdUpdate.record,
    };
  },

  /**
   * Deletes a Student and their Enrollment, MonthlyScores, and AnnualResults
   * through the centralized service and recomputes class rankings.
   */
  deleteStudentRecordCascade(
    db: DatabaseState,
    studentId: string,
    actorUserId: string
  ): DataServiceMutationResult<StudentRecord> {
    const enr = db.Enrollments.find((e) => e.StudentID === studentId);
    const classId = enr?.ClassID || 'CLS-12C';

    const stdDelete = DataService.deleteRecord(db, 'Students', studentId);
    if (!stdDelete.ok) return stdDelete;

    let workingDb: DatabaseState = {
      ...stdDelete.db,
      Enrollments: stdDelete.db.Enrollments.filter(
        (e) => e.StudentID !== studentId
      ),
      MonthlyScores: stdDelete.db.MonthlyScores.filter(
        (m) => m.StudentID !== studentId
      ),
      AnnualResults: stdDelete.db.AnnualResults.filter(
        (a) => a.StudentID !== studentId
      ),
    };

    workingDb = DataService.appendAuditLog(workingDb, {
      UserID: actorUserId,
      Action: 'DELETE_STUDENT_ROSTER',
      Module: 'StudentService.gs',
      RecordID: studentId,
      OldValueJSON: JSON.stringify({ StudentID: studentId }),
      NewValueJSON: '{}',
      IPOrSessionReference: 'GAS-WEB-SESSION',
      Description: `Deleted student ${studentId} from master roster`,
    });

    workingDb = recomputeClassRankingsInDb(workingDb, classId);

    return {
      ok: true,
      db: workingDb,
      record: stdDelete.record,
    };
  },

  /**
   * Creates a Class record with Primary ID duplicate validation and FK validation.
   */
  createClassRecord(
    db: DatabaseState,
    payload: {
      className: string;
      gradeLevel: 7 | 8 | 9 | 10 | 11 | 12;
      homeroomTeacherId: string;
      roomNumber: string;
    },
    actorUserId: string
  ): DataServiceMutationResult<ClassRecord> {
    const now = new Date().toISOString();
    const classId = `CLS-${payload.className.toUpperCase()}`;
    const created: ClassRecord = {
      ClassID: classId,
      ClassName: payload.className.toUpperCase(),
      GradeLevel: String(payload.gradeLevel) as ClassRecord['GradeLevel'],
      AcademicYearID: 'AY-2025-2026',
      HomeroomTeacherID: payload.homeroomTeacherId,
      Status: 'ACTIVE',
      CreatedAt: now,
    };

    return DataService.createRecord(db, 'Classes', created, {
      position: 'APPEND',
      auditLog: {
        UserID: actorUserId,
        Action: 'CREATE_CLASS',
        Module: 'ClassService.gs',
        RecordID: classId,
        OldValueJSON: '{}',
        NewValueJSON: JSON.stringify(payload),
        IPOrSessionReference: 'GAS-WEB-SESSION',
        Description: `Created class ${payload.className}`,
      },
    });
  },

  /**
   * Creates an Online Exam record with Primary ID duplicate and FK validation.
   */
  createExamRecord(
    db: DatabaseState,
    payload: {
      examTitleKh: string;
      subjectId: string;
      classId: string;
      durationMinutes: number;
      totalPoints: number;
      passingScore: number;
    },
    actorUserId: string
  ): DataServiceMutationResult<ExamRecord> {
    const now = new Date().toISOString();
    let seq = db.Exams.length + 1;
    let examId = `EXM-2526-${String(seq).padStart(3, '0')}`;
    while (db.Exams.some((e) => e.ExamID === examId)) {
      seq += 1;
      examId = `EXM-2526-${String(seq).padStart(3, '0')}`;
    }

    const created: ExamRecord = {
      ExamID: examId,
      ExamTitle: payload.examTitleKh,
      SubjectID: payload.subjectId,
      ClassID: payload.classId,
      AcademicYearID: 'AY-2025-2026',
      SemesterID: 'SEM-2526-1',
      ExamType: 'MONTHLY',
      ExamMonth: 'វិច្ឆិកា',
      StartDateTime: now,
      EndDateTime: new Date(Date.now() + 7 * 86400000).toISOString(),
      DurationMinutes: payload.durationMinutes,
      MaximumScore: payload.totalPoints,
      PassScore: payload.passingScore,
      AttemptLimit: 2,
      Instructions: 'សូមជ្រើសរើសចម្លើយដែលត្រឹមត្រូវបំផុត។',
      CreatedByUserID: actorUserId,
      Status: 'PUBLISHED',
      CreatedAt: now,
      UpdatedAt: now,
    };

    return DataService.createRecord(db, 'Exams', created, {
      position: 'PREPEND',
      auditLog: {
        UserID: actorUserId,
        Action: 'CREATE_ONLINE_EXAM',
        Module: 'ExamService.gs',
        RecordID: examId,
        OldValueJSON: '{}',
        NewValueJSON: JSON.stringify({
          ExamTitle: payload.examTitleKh,
          ClassID: payload.classId,
        }),
        IPOrSessionReference: 'GAS-EXAM-SVC',
        Description: `Created online exam ${payload.examTitleKh} (${examId})`,
      },
    });
  },

  /**
   * Assigns a Teacher to a Subject with strict Primary ID, Foreign Key, and
   * TeacherID + SubjectID + AcademicYearID duplicate validation.
   */
  assignTeacherSubjectRecord(
    db: DatabaseState,
    payload: {
      teacherId: string;
      subjectId: string;
      classId: string;
      academicYearId: string;
      assignmentIdPrefix?: string;
    },
    actorUserId: string
  ): DataServiceMutationResult<TeacherSubjectAssignmentRecord> {
    const now = new Date().toISOString();
    const prefix = payload.assignmentIdPrefix || 'ASN-2526';
    let seq = db.TeacherSubjectAssignments.length + 1;
    let assignmentId = `${prefix}-${String(seq).padStart(2, '0')}`;
    while (
      db.TeacherSubjectAssignments.some((a) => a.AssignmentID === assignmentId)
    ) {
      seq += 1;
      assignmentId = `${prefix}-${String(seq).padStart(2, '0')}`;
    }

    const newAssignment: TeacherSubjectAssignmentRecord = {
      AssignmentID: assignmentId,
      TeacherID: payload.teacherId,
      SubjectID: payload.subjectId,
      ClassID: payload.classId,
      AcademicYearID: payload.academicYearId,
      AssignedByUserID: actorUserId,
      Status: 'ACTIVE',
      AssignedAt: now,
    };

    return DataService.createRecord(
      db,
      'TeacherSubjectAssignments',
      newAssignment,
      {
        position: 'PREPEND',
        auditLog: {
          UserID: actorUserId,
          Action: 'ASSIGN_TEACHER_SUBJECT',
          Module: 'TeacherAssignmentService.gs',
          RecordID: newAssignment.AssignmentID,
          OldValueJSON: '{}',
          NewValueJSON: JSON.stringify(newAssignment),
          IPOrSessionReference: 'GAS-ASSIGNMENT-SVC',
          Description: `Assigned TeacherID=${payload.teacherId} to SubjectID=${payload.subjectId} (${payload.classId})`,
        },
      }
    );
  },

  /**
   * Submits or updates an Online Exam Attempt and its ExamAnswers through the service.
   */
  submitExamAttemptCascade(
    db: DatabaseState,
    payload: {
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
    },
    actorUserId: string
  ): DataServiceMutationResult<ExamAttemptRecord> {
    const now = new Date().toISOString();
    const existingInProgress = db.ExamAttempts.find(
      (a) =>
        a.ExamID === payload.examId &&
        a.StudentID === payload.studentId &&
        a.AttemptStatus === 'IN_PROGRESS'
    );

    let seq = db.ExamAttempts.length + 1;
    let generatedId = `ATT-${String(seq).padStart(4, '0')}`;
    while (db.ExamAttempts.some((a) => a.AttemptID === generatedId)) {
      seq += 1;
      generatedId = `ATT-${String(seq).padStart(4, '0')}`;
    }

    const attemptId = existingInProgress?.AttemptID || generatedId;
    const createdAttempt: ExamAttemptRecord = {
      AttemptID: attemptId,
      ExamID: payload.examId,
      StudentID: payload.studentId,
      AttemptNumber: existingInProgress?.AttemptNumber || 1,
      StartedAt: existingInProgress?.StartedAt || now,
      SubmittedAt: now,
      ServerDeadline:
        existingInProgress?.ServerDeadline ||
        new Date(Date.now() + 3600000).toISOString(),
      AttemptStatus: payload.attemptStatus || 'SUBMITTED',
      TotalScore: payload.scoreObtained,
      CreatedAt: existingInProgress?.CreatedAt || now,
    };

    const newAnswerRecords: ExamAnswerRecord[] = (
      payload.answersToSave || []
    ).map((ans, idx) => ({
      AnswerID: `ANS-${attemptId}-${idx + 1}`,
      AttemptID: attemptId,
      QuestionID: ans.questionId,
      StudentID: payload.studentId,
      AnswerJSON: ans.answerJson,
      IsCorrect: ans.isCorrect,
      ScoreAwarded: ans.scoreAwarded,
      GradedByUserID: ans.gradedByUserId,
      GradedAt: ans.gradedByUserId ? now : '',
      SavedAt: now,
    }));

    let workingDb = db;
    if (existingInProgress) {
      const upd = DataService.updateRecord(
        workingDb,
        'ExamAttempts',
        attemptId,
        createdAttempt
      );
      if (!upd.ok) return upd;
      workingDb = upd.db;
    } else {
      const crt = DataService.createRecord(
        workingDb,
        'ExamAttempts',
        createdAttempt,
        { position: 'PREPEND' }
      );
      if (!crt.ok) return crt;
      workingDb = crt.db;
    }

    workingDb = {
      ...workingDb,
      ExamAnswers: [
        ...newAnswerRecords,
        ...workingDb.ExamAnswers.filter((a) => a.AttemptID !== attemptId),
      ],
    };

    workingDb = DataService.appendAuditLog(workingDb, {
      UserID: actorUserId,
      Action: 'SUBMIT_ONLINE_EXAM_ATTEMPT',
      Module: 'ExaminationService.gs',
      RecordID: attemptId,
      OldValueJSON: '{}',
      NewValueJSON: JSON.stringify({
        examId: payload.examId,
        studentId: payload.studentId,
        scoreObtained: payload.scoreObtained,
        status: createdAttempt.AttemptStatus,
      }),
      IPOrSessionReference: 'GAS-EXAM-SVC',
      Description: `Submitted exam ${payload.examId} for ${payload.studentId}: ${payload.scoreObtained} pts (Status: ${createdAttempt.AttemptStatus})`,
    });

    return {
      ok: true,
      db: workingDb,
      record: createdAttempt,
    };
  },

  /**
   * Grades manual answers for an ExamAttempt and updates TotalScore.
   */
  gradeManualAnswersCascade(
    db: DatabaseState,
    payload: {
      attemptId: string;
      gradedScores: Record<string, number>;
    },
    actorUserId: string
  ): DataServiceMutationResult<ExamAttemptRecord> {
    const now = new Date().toISOString();
    const updatedAnswers = db.ExamAnswers.map((ans) => {
      if (ans.AttemptID !== payload.attemptId) return ans;
      const score = payload.gradedScores[ans.AnswerID];
      if (score === undefined) return ans;
      return {
        ...ans,
        IsCorrect: score > 0,
        ScoreAwarded: score,
        GradedByUserID: actorUserId,
        SavedAt: now,
      };
    });

    const totalAttemptScore = updatedAnswers
      .filter((a) => a.AttemptID === payload.attemptId)
      .reduce((sum, a) => sum + a.ScoreAwarded, 0);

    let workingDb: DatabaseState = {
      ...db,
      ExamAnswers: updatedAnswers,
    };

    const attUpdate = DataService.updateRecord(
      workingDb,
      'ExamAttempts',
      payload.attemptId,
      (att) => ({
        ...att,
        TotalScore: totalAttemptScore,
        AttemptStatus: 'GRADED' as const,
      }),
      {
        auditLog: {
          UserID: actorUserId,
          Action: 'TEACHER_MANUAL_GRADE_ATTEMPT',
          Module: 'ExamService.gs',
          RecordID: payload.attemptId,
          OldValueJSON: '{"AttemptStatus":"SUBMITTED"}',
          NewValueJSON: JSON.stringify({
            AttemptStatus: 'GRADED',
            TotalScore: totalAttemptScore,
          }),
          IPOrSessionReference: 'GAS-TEACHER-GRADING',
          Description: `Teacher ${actorUserId} completed manual grading for ${payload.attemptId} (Total: ${totalAttemptScore} pts)`,
        },
      }
    );

    return attUpdate;
  },

  /**
   * Updates a student's Monthly or Annual average score and recomputes class rankings.
   */
  updateStudentAverageScoreCascade(
    db: DatabaseState,
    params: {
      studentId: string;
      classId: string;
      periodType: 'MONTHLY' | 'ANNUAL';
      newAverageScore: number;
    },
    actorUserId: string
  ): DataServiceMutationResult {
    const now = new Date().toISOString();
    const nextMonthly =
      params.periodType === 'MONTHLY'
        ? db.MonthlyScores.map((m) =>
            m.StudentID === params.studentId && m.ClassID === params.classId
              ? { ...m, AverageScore: params.newAverageScore, UpdatedAt: now }
              : m
          )
        : db.MonthlyScores;

    const nextAnnual =
      params.periodType === 'ANNUAL'
        ? db.AnnualResults.map((a) =>
            a.StudentID === params.studentId && a.ClassID === params.classId
              ? { ...a, AnnualAverage: params.newAverageScore, PublishedAt: now }
              : a
          )
        : db.AnnualResults;

    let workingDb: DatabaseState = {
      ...db,
      MonthlyScores: nextMonthly,
      AnnualResults: nextAnnual,
    };

    workingDb = DataService.appendAuditLog(workingDb, {
      UserID: actorUserId,
      Action: `UPDATE_${params.periodType}_SCORE`,
      Module: 'ScoreService.gs',
      RecordID: params.studentId,
      OldValueJSON: '{}',
      NewValueJSON: JSON.stringify({
        newAverageScore: params.newAverageScore,
      }),
      IPOrSessionReference: 'GAS-SCORE-SESSION',
      Description: `Updated ${params.periodType} average score for ${params.studentId} to ${params.newAverageScore}`,
    });

    workingDb = recomputeClassRankingsInDb(workingDb, params.classId);

    return {
      ok: true,
      db: workingDb,
    };
  },

  /**
   * Executes RBAC-checked Question Bank actions (VIEW, CREATE, EDIT, DELETE)
   * through the Centralized Data Service.
   */
  executeQuestionAction(
    db: DatabaseState,
    params: {
      userId: string;
      questionId: string | null;
      action: QuestionAction;
      subjectId?: string;
      questionText?: string;
      questionType?: QuestionType;
      points?: number;
    }
  ): {
    allowed: boolean;
    messageKh: string;
    messageEn: string;
    rule: string;
    db: DatabaseState;
  } {
    const decision = canManageQuestion(
      params.userId,
      params.questionId,
      params.action,
      {
        users: db.Users,
        roles: db.Roles,
        assignments: db.TeacherSubjectAssignments,
        questions: db.Questions,
        classes: db.Classes,
      },
      params.subjectId
    );

    const now = new Date().toISOString();

    if (!decision.allowed) {
      const deniedDb = DataService.appendAuditLog(db, {
        UserID: params.userId,
        Action: `SECURITY_DENIED_${params.action}`,
        Module: 'Authorization.canManageQuestion',
        RecordID: params.questionId || params.subjectId || 'QUESTION_BANK',
        OldValueJSON: '{}',
        NewValueJSON: JSON.stringify({ enforcedRule: decision.enforcedRule }),
        IPOrSessionReference: 'GAS-SECURITY-GUARD',
        Description: decision.reasonEn,
      });

      return {
        allowed: false,
        messageKh: decision.reasonKh,
        messageEn: decision.reasonEn,
        rule: decision.enforcedRule,
        db: deniedDb,
      };
    }

    let workingDb = db;

    if (
      params.action === 'CREATE' &&
      params.subjectId &&
      params.questionText
    ) {
      let seq = db.Questions.length + 1;
      let newQuestionId = `QST-${params.subjectId.replace('SUB-', '')}-00${seq}`;
      while (db.Questions.some((q) => q.QuestionID === newQuestionId)) {
        seq += 1;
        newQuestionId = `QST-${params.subjectId.replace('SUB-', '')}-00${seq}`;
      }

      const newQ: QuestionRecord = {
        QuestionID: newQuestionId,
        SubjectID: params.subjectId,
        QuestionText: params.questionText,
        QuestionType: params.questionType || 'MCQ',
        OptionsJSON: JSON.stringify([
          'ក. ជម្រើសទី ១',
          'ខ. ជម្រើសទី ២',
          'គ. ជម្រើសទី ៣',
          'ឃ. ជម្រើសទី ៤',
        ]),
        CorrectAnswerJSON: JSON.stringify({ answerIndex: 0 }),
        Points: params.points || 10,
        DifficultyLevel: 'MEDIUM',
        ImageFileID: '',
        CreatedByUserID: params.userId,
        UpdatedByUserID: params.userId,
        Status: 'ACTIVE',
        CreatedAt: now,
        UpdatedAt: now,
      };

      const crt = DataService.createRecord(workingDb, 'Questions', newQ, {
        position: 'PREPEND',
        auditLog: {
          UserID: params.userId,
          Action: 'CREATE_QUESTION_ALLOWED',
          Module: 'QuestionService.gs',
          RecordID: newQuestionId,
          OldValueJSON: '{}',
          NewValueJSON: JSON.stringify({
            SubjectID: params.subjectId,
            CreatedByUserID: params.userId,
          }),
          IPOrSessionReference: 'GAS-QUESTION-SVC',
          Description: `Created question ${newQuestionId} with server-enforced CreatedByUserID=${params.userId}`,
        },
      });
      if (crt.ok) workingDb = crt.db;
    } else if (params.action === 'DELETE' && params.questionId) {
      const upd = DataService.updateRecord(
        workingDb,
        'Questions',
        params.questionId,
        (q) => ({ ...q, Status: 'DELETED' as const, UpdatedAt: now }),
        {
          auditLog: {
            UserID: params.userId,
            Action: 'DELETE_QUESTION_ALLOWED',
            Module: 'QuestionService.gs',
            RecordID: params.questionId,
            OldValueJSON: '{"Status":"ACTIVE"}',
            NewValueJSON: '{"Status":"DELETED"}',
            IPOrSessionReference: 'GAS-QUESTION-SVC',
            Description: `Deleted question ${params.questionId} after ownership verification.`,
          },
        }
      );
      if (upd.ok) workingDb = upd.db;
    } else if (params.action === 'EDIT' && params.questionId) {
      const upd = DataService.updateRecord(
        workingDb,
        'Questions',
        params.questionId,
        (q) => ({
          ...q,
          QuestionText: params.questionText
            ? params.questionText
            : q.QuestionText.includes('[កែប្រែរួច]')
              ? q.QuestionText
              : `${q.QuestionText} [កែប្រែរួច]`,
          QuestionType: params.questionType || q.QuestionType,
          Points: params.points ?? q.Points,
          UpdatedByUserID: params.userId,
          UpdatedAt: now,
        }),
        {
          auditLog: {
            UserID: params.userId,
            Action: 'EDIT_QUESTION_ALLOWED',
            Module: 'QuestionService.gs',
            RecordID: params.questionId,
            OldValueJSON: '{}',
            NewValueJSON: JSON.stringify({ UpdatedByUserID: params.userId }),
            IPOrSessionReference: 'GAS-QUESTION-SVC',
            Description: `Edited question ${params.questionId} after ownership verification.`,
          },
        }
      );
      if (upd.ok) workingDb = upd.db;
    }

    return {
      allowed: true,
      messageKh: decision.reasonKh,
      messageEn: decision.reasonEn,
      rule: decision.enforcedRule,
      db: workingDb,
    };
  },

  /**
   * Saves updated SystemSettings records through the centralized service.
   */
  saveSystemSettingsRecords(
    db: DatabaseState,
    updatedSettings: SystemSettingRecord[],
    actorUserId: string
  ): DatabaseState {
    const nextDb: DatabaseState = {
      ...db,
      SystemSettings: updatedSettings,
    };
    return DataService.appendAuditLog(nextDb, {
      UserID: actorUserId,
      Action: 'UPDATE_SYSTEM_SETTINGS',
      Module: 'ReportService.gs',
      RecordID: 'SYS-METADATA',
      OldValueJSON: JSON.stringify({ count: db.SystemSettings.length }),
      NewValueJSON: JSON.stringify({
        updatedKeys: updatedSettings.map((s) => s.SettingKey),
      }),
      IPOrSessionReference: 'GAS-ADMIN-SETTINGS',
      Description:
        'Updated dynamic school metadata & official report dates in SystemSettings',
    });
  },

  /**
   * Saves updated GradingScales records through the centralized service.
   */
  saveGradingScalesRecords(
    db: DatabaseState,
    updatedScales: GradingScaleRecord[],
    actorUserId: string
  ): DatabaseState {
    const nextDb: DatabaseState = {
      ...db,
      GradingScales: updatedScales,
    };
    return DataService.appendAuditLog(nextDb, {
      UserID: actorUserId,
      Action: 'UPDATE_GRADING_SCALES',
      Module: 'ScoreService.gs',
      RecordID: 'GRADING-SCALES-AF',
      OldValueJSON: JSON.stringify(
        db.GradingScales.map((g) => ({
          grade: g.Grade,
          min: g.MinimumScore,
          max: g.MaximumScore,
        }))
      ),
      NewValueJSON: JSON.stringify(
        updatedScales.map((g) => ({
          grade: g.Grade,
          min: g.MinimumScore,
          max: g.MaximumScore,
        }))
      ),
      IPOrSessionReference: 'GAS-ADMIN-SETTINGS',
      Description:
        'Updated global grading scale thresholds (A–F) in GradingScales sheet',
    });
  },
};
