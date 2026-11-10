import { DatabaseState } from '../types/database';

export const BACKUP_APPLICATION_VERSION = 'v2.6.0-teokchor-lms';
export const BACKUP_SCHEMA_VERSION = 'v1.2-25tables-19core-6ext';
export const BACKUP_HISTORY_STORAGE_KEY = 'teokchor_lms_phase1_backup_history_v1';

export type DatabaseTableKey = keyof DatabaseState;

export interface DatabaseTableDescriptor {
  key: DatabaseTableKey;
  sheetNumber: number;
  category: 'CORE_19_SHEETS' | 'OPTIONAL_COLLECTION';
  titleKh: string;
  titleEn: string;
  primaryKey: string;
  naturalUniqueKey?: string;
}

export const ALL_DATABASE_TABLE_DESCRIPTORS: DatabaseTableDescriptor[] = [
  // 19 Core Normalized Google Sheets
  {
    key: 'Users',
    sheetNumber: 1,
    category: 'CORE_19_SHEETS',
    titleKh: 'គណនីអ្នកប្រើប្រាស់',
    titleEn: 'Users',
    primaryKey: 'UserID',
    naturalUniqueKey: 'Username',
  },
  {
    key: 'Roles',
    sheetNumber: 2,
    category: 'CORE_19_SHEETS',
    titleKh: 'តួនាទី និងសិទ្ធិប្រើប្រាស់',
    titleEn: 'Roles',
    primaryKey: 'RoleID',
    naturalUniqueKey: 'RoleName',
  },
  {
    key: 'AcademicYears',
    sheetNumber: 3,
    category: 'CORE_19_SHEETS',
    titleKh: 'ឆ្នាំសិក្សា',
    titleEn: 'AcademicYears',
    primaryKey: 'AcademicYearID',
    naturalUniqueKey: 'AcademicYearName',
  },
  {
    key: 'Semesters',
    sheetNumber: 4,
    category: 'CORE_19_SHEETS',
    titleKh: 'ឆមាសសិក្សា',
    titleEn: 'Semesters',
    primaryKey: 'SemesterID',
  },
  {
    key: 'Classes',
    sheetNumber: 5,
    category: 'CORE_19_SHEETS',
    titleKh: 'ថ្នាក់រៀន (7A–12C)',
    titleEn: 'Classes',
    primaryKey: 'ClassID',
  },
  {
    key: 'Students',
    sheetNumber: 6,
    category: 'CORE_19_SHEETS',
    titleKh: 'បញ្ជីរាយនាមសិស្ស (36 ជួរឈរ)',
    titleEn: 'Students',
    primaryKey: 'StudentID',
    naturalUniqueKey: 'StudentCode',
  },
  {
    key: 'Enrollments',
    sheetNumber: 7,
    category: 'CORE_19_SHEETS',
    titleKh: 'ការចុះឈ្មោះសិស្សតាមថ្នាក់',
    titleEn: 'Enrollments',
    primaryKey: 'EnrollmentID',
  },
  {
    key: 'Subjects',
    sheetNumber: 8,
    category: 'CORE_19_SHEETS',
    titleKh: 'មុខវិជ្ជាសិក្សា',
    titleEn: 'Subjects',
    primaryKey: 'SubjectID',
    naturalUniqueKey: 'SubjectCode',
  },
  {
    key: 'TeacherSubjectAssignments',
    sheetNumber: 9,
    category: 'CORE_19_SHEETS',
    titleKh: 'ការចាត់តាំងគ្រូបង្រៀនតាមមុខវិជ្ជា',
    titleEn: 'TeacherSubjectAssignments',
    primaryKey: 'AssignmentID',
  },
  {
    key: 'Exams',
    sheetNumber: 10,
    category: 'CORE_19_SHEETS',
    titleKh: 'វិញ្ញាសាប្រឡងអនឡាញ',
    titleEn: 'Exams',
    primaryKey: 'ExamID',
  },
  {
    key: 'Questions',
    sheetNumber: 11,
    category: 'CORE_19_SHEETS',
    titleKh: 'ឃ្លាំងសំណួរប្រឡង',
    titleEn: 'Questions',
    primaryKey: 'QuestionID',
  },
  {
    key: 'ExamAttempts',
    sheetNumber: 12,
    category: 'CORE_19_SHEETS',
    titleKh: 'កំណត់ត្រាចូលប្រឡងរបស់សិស្ស',
    titleEn: 'ExamAttempts',
    primaryKey: 'AttemptID',
  },
  {
    key: 'ExamAnswers',
    sheetNumber: 13,
    category: 'CORE_19_SHEETS',
    titleKh: 'ចម្លើយប្រឡងរបស់សិស្ស',
    titleEn: 'ExamAnswers',
    primaryKey: 'AnswerID',
  },
  {
    key: 'MonthlyScores',
    sheetNumber: 14,
    category: 'CORE_19_SHEETS',
    titleKh: 'ពិន្ទុប្រឡងប្រចាំខែ',
    titleEn: 'MonthlyScores',
    primaryKey: 'MonthlyScoreID',
  },
  {
    key: 'SemesterScores',
    sheetNumber: 15,
    category: 'CORE_19_SHEETS',
    titleKh: 'ពិន្ទុប្រឡងប្រចាំឆមាស',
    titleEn: 'SemesterScores',
    primaryKey: 'SemesterScoreID',
  },
  {
    key: 'AnnualResults',
    sheetNumber: 16,
    category: 'CORE_19_SHEETS',
    titleKh: 'លទ្ធផលសិក្សាប្រចាំឆ្នាំ',
    titleEn: 'AnnualResults',
    primaryKey: 'AnnualResultID',
  },
  {
    key: 'GradingScales',
    sheetNumber: 17,
    category: 'CORE_19_SHEETS',
    titleKh: 'មាត្រដ្ឋាននិទ្ទេស (A–F)',
    titleEn: 'GradingScales',
    primaryKey: 'GradingScaleID',
  },
  {
    key: 'SystemSettings',
    sheetNumber: 18,
    category: 'CORE_19_SHEETS',
    titleKh: 'ការកំណត់ប្រព័ន្ធ',
    titleEn: 'SystemSettings',
    primaryKey: 'SettingID',
    naturalUniqueKey: 'SettingKey',
  },
  {
    key: 'AuditLogs',
    sheetNumber: 19,
    category: 'CORE_19_SHEETS',
    titleKh: 'កំណត់ហេតុសវនកម្មប្រព័ន្ធ',
    titleEn: 'AuditLogs',
    primaryKey: 'LogID',
  },

  // 6 Optional / Extended Domain Collections in DatabaseState
  {
    key: 'HomeroomTeacherAssignments',
    sheetNumber: 20,
    category: 'OPTIONAL_COLLECTION',
    titleKh: 'ការចាត់តាំងគ្រូបន្ទុកថ្នាក់',
    titleEn: 'HomeroomTeacherAssignments',
    primaryKey: 'AssignmentID',
  },
  {
    key: 'TeacherSpecializations',
    sheetNumber: 21,
    category: 'OPTIONAL_COLLECTION',
    titleKh: 'ឯកទេសមុខវិជ្ជារបស់គ្រូ',
    titleEn: 'TeacherSpecializations',
    primaryKey: 'SpecializationID',
  },
  {
    key: 'ScoreEntryLocks',
    sheetNumber: 22,
    category: 'OPTIONAL_COLLECTION',
    titleKh: 'ការចាក់សោការបញ្ចូលពិន្ទុ',
    titleEn: 'ScoreEntryLocks',
    primaryKey: 'LockID',
  },
  {
    key: 'ScoreSubmissions',
    sheetNumber: 23,
    category: 'OPTIONAL_COLLECTION',
    titleKh: 'ស្ថានភាពបញ្ជូនពិន្ទុតាមមុខវិជ្ជា',
    titleEn: 'ScoreSubmissions',
    primaryKey: 'SubmissionID',
  },
  {
    key: 'ScoreModificationHistory',
    sheetNumber: 24,
    category: 'OPTIONAL_COLLECTION',
    titleKh: 'ប្រវត្តិកែប្រែពិន្ទុសិស្ស',
    titleEn: 'ScoreModificationHistory',
    primaryKey: 'ModificationID',
  },
  {
    key: 'SubjectGradeRanges',
    sheetNumber: 25,
    category: 'OPTIONAL_COLLECTION',
    titleKh: 'ចន្លោះពិន្ទុនិទ្ទេសតាមមុខវិជ្ជា (18 Slots)',
    titleEn: 'SubjectGradeRanges',
    primaryKey: 'SlotID',
  },
];

export interface RuntimeDataSourceReport {
  mode: 'IN_MEMORY_PREVIEW' | 'GOOGLE_SHEETS_PERSISTED';
  stateInitializer: string;
  isPersistedToGoogleSheets: boolean;
  localBackupSnapshotsStored: number;
  coreTableCount: number;
  optionalCollectionCount: number;
  totalTableCount: number;
  totalRecordCount: number;
  statusHeadlineKh: string;
  statusDescriptionKh: string;
}

export interface BackupMetadata {
  backupId: string;
  fileName: string;
  backupTimestamp: string;
  applicationVersion: string;
  schemaVersion: string;
  runtimeDataSource: 'IN_MEMORY_REACT_STATE' | 'GOOGLE_SHEETS_SYNC';
  createdByUserId: string;
  note?: string;
  totalTables: number;
  coreTableCount: number;
  optionalCollectionCount: number;
  totalRecords: number;
  recordCounts: Record<DatabaseTableKey, number>;
}

export interface DatabaseBackupEnvelope {
  format: 'TEOKCHOR_LMS_FULL_DATABASE_BACKUP';
  metadata: BackupMetadata;
  recordCounts: Record<DatabaseTableKey, number>;
  data: DatabaseState;
}

export interface BackupHistoryItem {
  backupId: string;
  fileName: string;
  backupTimestamp: string;
  applicationVersion: string;
  schemaVersion: string;
  createdByUserId: string;
  note: string;
  totalTables: number;
  totalRecords: number;
  recordCounts: Record<DatabaseTableKey, number>;
  envelope: DatabaseBackupEnvelope;
}

export interface ValidationIssue {
  id: string;
  category: 'MISSING_TABLE' | 'DUPLICATE_ID' | 'INVALID_REFERENCE';
  severity: 'ERROR' | 'WARNING';
  tableKey: DatabaseTableKey;
  recordId: string;
  field: string;
  titleKh: string;
  descriptionKh: string;
}

export interface TableValidationSummary {
  key: DatabaseTableKey;
  sheetNumber: number;
  category: 'CORE_19_SHEETS' | 'OPTIONAL_COLLECTION';
  titleKh: string;
  titleEn: string;
  primaryKey: string;
  exists: boolean;
  recordCount: number;
  duplicateIdCount: number;
  invalidReferenceCount: number;
  samplePrimaryIds: string[];
  status: 'HEALTHY' | 'WARNING' | 'ERROR';
}

export interface DatabaseValidationReport {
  inspectedAt: string;
  totalTablesExpected: number;
  totalTablesPresent: number;
  missingTablesCount: number;
  totalRecords: number;
  duplicateIdsCount: number;
  invalidReferencesCount: number;
  overallStatus: 'VALID' | 'VALID_WITH_WARNINGS' | 'INVALID';
  tableSummaries: TableValidationSummary[];
  missingTables: ValidationIssue[];
  duplicateIds: ValidationIssue[];
  invalidReferences: ValidationIssue[];
}

export interface RestoreTableDiff {
  key: DatabaseTableKey;
  sheetNumber: number;
  category: 'CORE_19_SHEETS' | 'OPTIONAL_COLLECTION';
  titleKh: string;
  primaryKey: string;
  currentCount: number;
  backupCount: number;
  delta: number;
  presentInBackup: boolean;
  sampleIds: string[];
}

export interface RestorePreviewResult {
  ok: boolean;
  errorMessageKh?: string;
  sourceFileName: string;
  envelope: DatabaseBackupEnvelope | null;
  validationReport: DatabaseValidationReport | null;
  tableDiffs: RestoreTableDiff[];
  totalCurrentRecords: number;
  totalBackupRecords: number;
  preservesAllCoreTables: boolean;
  preservesAllOptionalCollections: boolean;
}

/**
 * Safely deep-clones any DatabaseState without mutating or stripping any fields.
 */
export function cloneDatabaseStatePreservingAllFields(db: DatabaseState): DatabaseState {
  return JSON.parse(JSON.stringify(db)) as DatabaseState;
}

/**
 * Returns the array of records for a given table key in DatabaseState.
 */
export function getTableRecords(
  db: Partial<DatabaseState> | null | undefined,
  key: DatabaseTableKey
): Record<string, unknown>[] {
  if (!db || typeof db !== 'object') return [];
  const raw = (db as Record<string, unknown>)[key];
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

/**
 * Computes exact record counts for all 25 tables (19 core + 6 optional).
 */
export function computeDatabaseRecordCounts(
  db: Partial<DatabaseState> | null | undefined
): Record<DatabaseTableKey, number> {
  const counts = {} as Record<DatabaseTableKey, number>;
  for (const desc of ALL_DATABASE_TABLE_DESCRIPTORS) {
    counts[desc.key] = getTableRecords(db, desc.key).length;
  }
  return counts;
}

/**
 * Inspects the runtime data source and distinguishes in-memory React state from Google Sheets persistence.
 */
export function inspectRuntimeDataSource(
  db: DatabaseState,
  localBackupHistoryCount = 0
): RuntimeDataSourceReport {
  const counts = computeDatabaseRecordCounts(db);
  const totalRecordCount = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const coreTableCount = ALL_DATABASE_TABLE_DESCRIPTORS.filter(
    (d) => d.category === 'CORE_19_SHEETS'
  ).length;
  const optionalCollectionCount = ALL_DATABASE_TABLE_DESCRIPTORS.filter(
    (d) => d.category === 'OPTIONAL_COLLECTION'
  ).length;

  // Check if running inside Google Apps Script iframe (window.google?.script?.run)
  // or connected via GAS_PRODUCTION mode in GasPersistenceAdapter
  const hasNativeGasBridge =
    typeof window !== 'undefined' &&
    typeof (window as unknown as { google?: { script?: { run?: unknown } } }).google?.script
      ?.run !== 'undefined';

  let isGasProductionConnected = false;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const rawCfg = window.localStorage.getItem(
        'TEOK_CHOR_GAS_ADAPTER_CONFIG_V3'
      );
      if (rawCfg) {
        const parsed = JSON.parse(rawCfg);
        isGasProductionConnected =
          parsed.mode === 'GAS_PRODUCTION' &&
          parsed.connectionState === 'CONNECTED' &&
          !parsed.simulateConnectionFailure;
      }
    }
  } catch {
    // Ignore storage access errors
  }

  const hasGasBridge = hasNativeGasBridge || isGasProductionConnected;

  return {
    mode: hasGasBridge ? 'GOOGLE_SHEETS_PERSISTED' : 'IN_MEMORY_PREVIEW',
    stateInitializer:
      'React useState<DatabaseState>(() => createInitialDatabaseState())',
    isPersistedToGoogleSheets: hasGasBridge,
    localBackupSnapshotsStored: localBackupHistoryCount,
    coreTableCount,
    optionalCollectionCount,
    totalTableCount: coreTableCount + optionalCollectionCount,
    totalRecordCount,
    statusHeadlineKh: hasGasBridge
      ? 'បានភ្ជាប់ផ្ទាល់ជាមួយ Google Sheets (GAS_PRODUCTION Persisted Mode)'
      : 'កំពុងដំណើរការក្នុង Local Preview Mode (In-Memory State — មិនទាន់រក្សាទុកអចិន្ត្រៃយ៍ក្នុង Google Sheets)',
    statusDescriptionKh: hasGasBridge
      ? 'ទិន្នន័យត្រូវបានធ្វើសមកាលកម្មជាមួយ Google Sheets ទាំង ២៥ តារាងតាមរយៈ Google Apps Script (GAS_PRODUCTION)។'
      : 'កម្មវិធីបច្ចុប្បន្នផ្ទុកទិន្នន័យក្នុងអង្គចងចាំបណ្តោះអាសន្ន (React useState + createInitialDatabaseState())។ ប្រសិនបើ Refresh ទំព័រដោយមិនបានទាញយកឯកសារ Backup (.json) ឬរក្សាទុកក្នុងប្រវត្តិ Backup ទេ ការកែប្រែថ្មីៗនឹងត្រឡប់ទៅទិន្នន័យដើមវិញ។',
  };
}

/**
 * Creates a complete, lossless DatabaseBackupEnvelope containing all 19 core tables
 * and all 6 optional collections, plus timestamp, app version, schema version, and record counts.
 */
export function createDatabaseBackupEnvelope(
  db: DatabaseState,
  options?: {
    createdByUserId?: string;
    note?: string;
    customTimestamp?: string;
    customBackupId?: string;
  }
): DatabaseBackupEnvelope {
  const backupTimestamp = options?.customTimestamp || new Date().toISOString();
  const dateCompact = backupTimestamp.replace(/[:.]/g, '-').slice(0, 19);
  const backupId =
    options?.customBackupId ||
    `BKP-${backupTimestamp.slice(0, 10).replace(/-/g, '')}-${String(
      Math.floor(1000 + Math.random() * 9000)
    )}`;
  const fileName = `TeokChor_LMS_FullBackup_25Tables_${dateCompact}.json`;

  const clonedData = cloneDatabaseStatePreservingAllFields(db);

  // Ensure all 6 optional arrays exist explicitly on the exported snapshot so nothing is omitted
  const normalizedData: DatabaseState = {
    ...clonedData,
    HomeroomTeacherAssignments: Array.isArray(clonedData.HomeroomTeacherAssignments)
      ? clonedData.HomeroomTeacherAssignments
      : [],
    TeacherSpecializations: Array.isArray(clonedData.TeacherSpecializations)
      ? clonedData.TeacherSpecializations
      : [],
    ScoreEntryLocks: Array.isArray(clonedData.ScoreEntryLocks)
      ? clonedData.ScoreEntryLocks
      : [],
    ScoreSubmissions: Array.isArray(clonedData.ScoreSubmissions)
      ? clonedData.ScoreSubmissions
      : [],
    ScoreModificationHistory: Array.isArray(clonedData.ScoreModificationHistory)
      ? clonedData.ScoreModificationHistory
      : [],
    SubjectGradeRanges: Array.isArray(clonedData.SubjectGradeRanges)
      ? clonedData.SubjectGradeRanges
      : [],
  };

  const recordCounts = computeDatabaseRecordCounts(normalizedData);
  const totalRecords = Object.values(recordCounts).reduce((sum, c) => sum + c, 0);
  const coreTableCount = ALL_DATABASE_TABLE_DESCRIPTORS.filter(
    (d) => d.category === 'CORE_19_SHEETS'
  ).length;
  const optionalCollectionCount = ALL_DATABASE_TABLE_DESCRIPTORS.filter(
    (d) => d.category === 'OPTIONAL_COLLECTION'
  ).length;

  const metadata: BackupMetadata = {
    backupId,
    fileName,
    backupTimestamp,
    applicationVersion: BACKUP_APPLICATION_VERSION,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    runtimeDataSource: 'IN_MEMORY_REACT_STATE',
    createdByUserId: options?.createdByUserId || 'USR-SUP-01',
    note:
      options?.note ||
      'Phase 1 Full Database Backup (19 Core Sheets + 6 Extended Collections)',
    totalTables: coreTableCount + optionalCollectionCount,
    coreTableCount,
    optionalCollectionCount,
    totalRecords,
    recordCounts,
  };

  return {
    format: 'TEOKCHOR_LMS_FULL_DATABASE_BACKUP',
    metadata,
    recordCounts,
    data: normalizedData,
  };
}

/**
 * Generates a comprehensive, non-destructive validation report detecting:
 * 1. Missing tables (across all 19 core + 6 optional collections)
 * 2. Duplicate primary IDs and duplicate natural keys
 * 3. Invalid foreign key references and relationship inconsistencies
 */
export function generateDatabaseValidationReport(
  db: Partial<DatabaseState> | null | undefined
): DatabaseValidationReport {
  const inspectedAt = new Date().toISOString();
  const missingTables: ValidationIssue[] = [];
  const duplicateIds: ValidationIssue[] = [];
  const invalidReferences: ValidationIssue[] = [];
  const tableSummaries: TableValidationSummary[] = [];

  const safeDb = (db && typeof db === 'object' ? db : {}) as Record<string, unknown>;

  // First pass: check table existence & duplicate primary keys
  const pkSetsByTable = new Map<DatabaseTableKey, Set<string>>();

  for (const desc of ALL_DATABASE_TABLE_DESCRIPTORS) {
    const rawTable = safeDb[desc.key];
    const exists = Array.isArray(rawTable);
    const records = exists ? (rawTable as Record<string, unknown>[]) : [];

    if (!exists) {
      missingTables.push({
        id: `MISS-TBL-${desc.key}`,
        category: 'MISSING_TABLE',
        severity: desc.category === 'CORE_19_SHEETS' ? 'ERROR' : 'WARNING',
        tableKey: desc.key,
        recordId: desc.key,
        field: desc.key,
        titleKh: `បាត់តារាងទិន្នន័យ ${desc.titleKh} (${desc.key})`,
        descriptionKh: `តារាង ${desc.key} (${
          desc.category === 'CORE_19_SHEETS' ? 'Core Sheet' : 'Optional Collection'
        }) មិនមាននៅក្នុង DatabaseState ទេ។`,
      });
    }

    const seenPks = new Set<string>();
    const seenNaturalKeys = new Set<string>();
    let tableDupCount = 0;
    const samplePrimaryIds: string[] = [];

    records.forEach((row, idx) => {
      const pkVal = String(row?.[desc.primaryKey] ?? '').trim();
      if (pkVal && samplePrimaryIds.length < 4) {
        samplePrimaryIds.push(pkVal);
      }

      if (!pkVal) {
        tableDupCount += 1;
        duplicateIds.push({
          id: `EMPTY-PK-${desc.key}-${idx}`,
          category: 'DUPLICATE_ID',
          severity: 'ERROR',
          tableKey: desc.key,
          recordId: `ROW-${idx + 1}`,
          field: desc.primaryKey,
          titleKh: `បាត់លេខសម្គាល់ Primary Key (${desc.primaryKey}) ក្នុងតារាង ${desc.key}`,
          descriptionKh: `ជួរទី ${idx + 1} ក្នុងតារាង ${desc.titleKh} មិនមានតម្លៃ ${desc.primaryKey} ទេ។`,
        });
      } else if (seenPks.has(pkVal)) {
        tableDupCount += 1;
        duplicateIds.push({
          id: `DUP-PK-${desc.key}-${pkVal}-${idx}`,
          category: 'DUPLICATE_ID',
          severity: 'ERROR',
          tableKey: desc.key,
          recordId: pkVal,
          field: desc.primaryKey,
          titleKh: `លេខសម្គាល់ស្ទួន (Duplicate Primary Key) ក្នុងតារាង ${desc.key}`,
          descriptionKh: `លេខសម្គាល់ ${desc.primaryKey}="${pkVal}" មានស្ទួនលើសពី ១ ជួរក្នុងតារាង ${desc.titleKh}។`,
        });
      } else {
        seenPks.add(pkVal);
      }

      if (desc.naturalUniqueKey) {
        const natVal = String(row?.[desc.naturalUniqueKey] ?? '').trim();
        if (natVal) {
          if (seenNaturalKeys.has(natVal)) {
            tableDupCount += 1;
            duplicateIds.push({
              id: `DUP-NAT-${desc.key}-${natVal}-${idx}`,
              category: 'DUPLICATE_ID',
              severity: 'WARNING',
              tableKey: desc.key,
              recordId: pkVal || `ROW-${idx + 1}`,
              field: desc.naturalUniqueKey,
              titleKh: `តម្លៃស្ទួន (${desc.naturalUniqueKey}) ក្នុងតារាង ${desc.key}`,
              descriptionKh: `${desc.naturalUniqueKey}="${natVal}" ត្រូវបានប្រើប្រាស់ស្ទួនក្នុងតារាង ${desc.titleKh}។`,
            });
          } else {
            seenNaturalKeys.add(natVal);
          }
        }
      }
    });

    pkSetsByTable.set(desc.key, seenPks);

    tableSummaries.push({
      key: desc.key,
      sheetNumber: desc.sheetNumber,
      category: desc.category,
      titleKh: desc.titleKh,
      titleEn: desc.titleEn,
      primaryKey: desc.primaryKey,
      exists,
      recordCount: records.length,
      duplicateIdCount: tableDupCount,
      invalidReferenceCount: 0, // updated after FK pass
      samplePrimaryIds,
      status: !exists || tableDupCount > 0 ? 'ERROR' : 'HEALTHY',
    });
  }

  // Helper to record an invalid reference and increment the table summary counter
  const addInvalidReference = (issue: ValidationIssue) => {
    invalidReferences.push(issue);
    const summary = tableSummaries.find((s) => s.key === issue.tableKey);
    if (summary) {
      summary.invalidReferenceCount += 1;
      if (issue.severity === 'ERROR') {
        summary.status = 'ERROR';
      } else if (summary.status === 'HEALTHY') {
        summary.status = 'WARNING';
      }
    }
  };

  const roleIds = pkSetsByTable.get('Roles') || new Set<string>();
  const userIds = pkSetsByTable.get('Users') || new Set<string>();
  const yearIds = pkSetsByTable.get('AcademicYears') || new Set<string>();
  const semesterIds = pkSetsByTable.get('Semesters') || new Set<string>();
  const classIds = pkSetsByTable.get('Classes') || new Set<string>();
  const studentIds = pkSetsByTable.get('Students') || new Set<string>();
  const subjectIds = pkSetsByTable.get('Subjects') || new Set<string>();
  const examIds = pkSetsByTable.get('Exams') || new Set<string>();
  const questionIds = pkSetsByTable.get('Questions') || new Set<string>();
  const attemptIds = pkSetsByTable.get('ExamAttempts') || new Set<string>();

  const classesMap = new Map<string, Record<string, unknown>>();
  getTableRecords(db, 'Classes').forEach((c) => {
    classesMap.set(String(c.ClassID), c);
  });

  const subjectsMap = new Map<string, Record<string, unknown>>();
  getTableRecords(db, 'Subjects').forEach((s) => {
    subjectsMap.set(String(s.SubjectID), s);
  });

  // 1. Validate Users -> Roles
  getTableRecords(db, 'Users').forEach((u) => {
    const userId = String(u.UserID || '');
    const roleId = String(u.RoleID || '');
    if (roleId && !roleIds.has(roleId)) {
      addInvalidReference({
        id: `FK-USR-ROL-${userId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'Users',
        recordId: userId,
        field: 'RoleID',
        titleKh: `User "${userId}" យោងទៅ RoleID មិនត្រឹមត្រូវ`,
        descriptionKh: `Users.RoleID="${roleId}" មិនមាននៅក្នុងតារាង Roles ទេ។`,
      });
    }
  });

  // 2. Validate Semesters -> AcademicYears
  getTableRecords(db, 'Semesters').forEach((sem) => {
    const semId = String(sem.SemesterID || '');
    const ayId = String(sem.AcademicYearID || '');
    if (ayId && !yearIds.has(ayId)) {
      addInvalidReference({
        id: `FK-SEM-AY-${semId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'Semesters',
        recordId: semId,
        field: 'AcademicYearID',
        titleKh: `Semester "${semId}" យោងទៅ AcademicYearID មិនត្រឹមត្រូវ`,
        descriptionKh: `Semesters.AcademicYearID="${ayId}" មិនមាននៅក្នុងតារាង AcademicYears ទេ។`,
      });
    }
  });

  // 3. Validate Classes -> AcademicYears & HomeroomTeacherID -> Users
  getTableRecords(db, 'Classes').forEach((cls) => {
    const clsId = String(cls.ClassID || '');
    const ayId = String(cls.AcademicYearID || '');
    const teacherId = String(cls.HomeroomTeacherID || '');
    if (ayId && !yearIds.has(ayId)) {
      addInvalidReference({
        id: `FK-CLS-AY-${clsId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'Classes',
        recordId: clsId,
        field: 'AcademicYearID',
        titleKh: `Class "${clsId}" យោងទៅ AcademicYearID មិនត្រឹមត្រូវ`,
        descriptionKh: `Classes.AcademicYearID="${ayId}" មិនមាននៅក្នុងតារាង AcademicYears ទេ។`,
      });
    }
    if (teacherId && !userIds.has(teacherId)) {
      addInvalidReference({
        id: `FK-CLS-TCH-${clsId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'Classes',
        recordId: clsId,
        field: 'HomeroomTeacherID',
        titleKh: `Class "${clsId}" យោងទៅ HomeroomTeacherID មិនត្រឹមត្រូវ`,
        descriptionKh: `Classes.HomeroomTeacherID="${teacherId}" មិនមាននៅក្នុងតារាង Users ទេ។`,
      });
    }
  });

  // 4. Validate Enrollments -> Students, Classes, AcademicYears
  getTableRecords(db, 'Enrollments').forEach((enr) => {
    const enrId = String(enr.EnrollmentID || '');
    const stdId = String(enr.StudentID || '');
    const clsId = String(enr.ClassID || '');
    const ayId = String(enr.AcademicYearID || '');
    if (stdId && !studentIds.has(stdId)) {
      addInvalidReference({
        id: `FK-ENR-STD-${enrId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'Enrollments',
        recordId: enrId,
        field: 'StudentID',
        titleKh: `Enrollment "${enrId}" យោងទៅ StudentID ដែលមិនមាន`,
        descriptionKh: `Enrollments.StudentID="${stdId}" មិនមាននៅក្នុងតារាង Students ទេ។`,
      });
    }
    if (clsId && !classIds.has(clsId)) {
      addInvalidReference({
        id: `FK-ENR-CLS-${enrId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'Enrollments',
        recordId: enrId,
        field: 'ClassID',
        titleKh: `Enrollment "${enrId}" យោងទៅ ClassID ដែលមិនមាន`,
        descriptionKh: `Enrollments.ClassID="${clsId}" មិនមាននៅក្នុងតារាង Classes ទេ។`,
      });
    }
    if (ayId && !yearIds.has(ayId)) {
      addInvalidReference({
        id: `FK-ENR-AY-${enrId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'Enrollments',
        recordId: enrId,
        field: 'AcademicYearID',
        titleKh: `Enrollment "${enrId}" យោងទៅ AcademicYearID ដែលមិនមាន`,
        descriptionKh: `Enrollments.AcademicYearID="${ayId}" មិនមាននៅក្នុងតារាង AcademicYears ទេ។`,
      });
    }
  });

  // 5. Validate TeacherSubjectAssignments -> Users, Subjects, Classes, AcademicYears + GradeLevel match
  const seenAssignmentTuples = new Set<string>();
  getTableRecords(db, 'TeacherSubjectAssignments').forEach((asn) => {
    const asnId = String(asn.AssignmentID || '');
    const teacherId = String(asn.TeacherID || '');
    const subjectId = String(asn.SubjectID || '');
    const classId = String(asn.ClassID || '');
    const ayId = String(asn.AcademicYearID || '');

    const tupleKey = `${teacherId}|${subjectId}|${classId}|${ayId}`;
    if (seenAssignmentTuples.has(tupleKey)) {
      duplicateIds.push({
        id: `DUP-ASN-TUPLE-${asnId}`,
        category: 'DUPLICATE_ID',
        severity: 'WARNING',
        tableKey: 'TeacherSubjectAssignments',
        recordId: asnId,
        field: 'TeacherID+SubjectID+ClassID+AcademicYearID',
        titleKh: `ការចាត់តាំងគ្រូបង្រៀនស្ទួន (${asnId})`,
        descriptionKh: `ការចាត់តាំង (${teacherId}, ${subjectId}, ${classId}, ${ayId}) មានរួចហើយ។`,
      });
    } else {
      seenAssignmentTuples.add(tupleKey);
    }

    if (teacherId && !userIds.has(teacherId)) {
      addInvalidReference({
        id: `FK-ASN-TCH-${asnId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'TeacherSubjectAssignments',
        recordId: asnId,
        field: 'TeacherID',
        titleKh: `Assignment "${asnId}" យោងទៅ TeacherID ដែលមិនមាន`,
        descriptionKh: `TeacherSubjectAssignments.TeacherID="${teacherId}" មិនមានក្នុង Users ទេ។`,
      });
    }
    if (subjectId && !subjectIds.has(subjectId)) {
      addInvalidReference({
        id: `FK-ASN-SUB-${asnId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'TeacherSubjectAssignments',
        recordId: asnId,
        field: 'SubjectID',
        titleKh: `Assignment "${asnId}" យោងទៅ SubjectID ដែលមិនមាន`,
        descriptionKh: `TeacherSubjectAssignments.SubjectID="${subjectId}" មិនមានក្នុង Subjects ទេ។`,
      });
    }
    if (classId && !classIds.has(classId)) {
      addInvalidReference({
        id: `FK-ASN-CLS-${asnId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'TeacherSubjectAssignments',
        recordId: asnId,
        field: 'ClassID',
        titleKh: `Assignment "${asnId}" យោងទៅ ClassID ដែលមិនមាន`,
        descriptionKh: `TeacherSubjectAssignments.ClassID="${classId}" មិនមានក្នុង Classes ទេ។`,
      });
    }

    const clsObj = classesMap.get(classId);
    const subObj = subjectsMap.get(subjectId);
    if (clsObj && subObj && String(clsObj.GradeLevel) !== String(subObj.GradeLevel)) {
      addInvalidReference({
        id: `REL-ASN-GRADE-${asnId}`,
        category: 'INVALID_REFERENCE',
        severity: 'WARNING',
        tableKey: 'TeacherSubjectAssignments',
        recordId: asnId,
        field: 'GradeLevel',
        titleKh: `ភាពមិនស៊ីគ្នានៃកម្រិតថ្នាក់ (GradeLevel Mismatch) លើ ${asnId}`,
        descriptionKh: `ថ្នាក់ ${classId} (កម្រិតថ្នាក់ទី ${String(
          clsObj.GradeLevel
        )}) ត្រូវបានភ្ជាប់ជាមួយមុខវិជ្ជា ${subjectId} (កម្រិតថ្នាក់ទី ${String(subObj.GradeLevel)})។`,
      });
    }
  });

  // 6. Validate Exams & ExamAttempts & ExamAnswers
  getTableRecords(db, 'Exams').forEach((exm) => {
    const examId = String(exm.ExamID || '');
    const subId = String(exm.SubjectID || '');
    const clsId = String(exm.ClassID || '');
    if (subId && !subjectIds.has(subId)) {
      addInvalidReference({
        id: `FK-EXM-SUB-${examId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'Exams',
        recordId: examId,
        field: 'SubjectID',
        titleKh: `Exam "${examId}" យោងទៅ SubjectID ដែលមិនមាន`,
        descriptionKh: `Exams.SubjectID="${subId}" មិនមានក្នុងតារាង Subjects ទេ។`,
      });
    }
    if (clsId && !classIds.has(clsId)) {
      addInvalidReference({
        id: `FK-EXM-CLS-${examId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'Exams',
        recordId: examId,
        field: 'ClassID',
        titleKh: `Exam "${examId}" យោងទៅ ClassID ដែលមិនមាន`,
        descriptionKh: `Exams.ClassID="${clsId}" មិនមានក្នុងតារាង Classes ទេ។`,
      });
    }
  });

  getTableRecords(db, 'ExamAttempts').forEach((att) => {
    const attId = String(att.AttemptID || '');
    const exmId = String(att.ExamID || '');
    const stdId = String(att.StudentID || '');
    if (exmId && !examIds.has(exmId)) {
      addInvalidReference({
        id: `FK-ATT-EXM-${attId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'ExamAttempts',
        recordId: attId,
        field: 'ExamID',
        titleKh: `ExamAttempt "${attId}" យោងទៅ ExamID ដែលមិនមាន`,
        descriptionKh: `ExamAttempts.ExamID="${exmId}" មិនមានក្នុងតារាង Exams ទេ។`,
      });
    }
    if (stdId && !studentIds.has(stdId)) {
      addInvalidReference({
        id: `FK-ATT-STD-${attId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'ExamAttempts',
        recordId: attId,
        field: 'StudentID',
        titleKh: `ExamAttempt "${attId}" យោងទៅ StudentID ដែលមិនមាន`,
        descriptionKh: `ExamAttempts.StudentID="${stdId}" មិនមានក្នុងតារាង Students ទេ។`,
      });
    }
  });

  getTableRecords(db, 'ExamAnswers').forEach((ans) => {
    const ansId = String(ans.AnswerID || '');
    const attId = String(ans.AttemptID || '');
    const qId = String(ans.QuestionID || '');
    if (attId && !attemptIds.has(attId)) {
      addInvalidReference({
        id: `FK-ANS-ATT-${ansId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'ExamAnswers',
        recordId: ansId,
        field: 'AttemptID',
        titleKh: `ExamAnswer "${ansId}" យោងទៅ AttemptID ដែលមិនមាន`,
        descriptionKh: `ExamAnswers.AttemptID="${attId}" មិនមានក្នុងតារាង ExamAttempts ទេ។`,
      });
    }
    if (qId && !questionIds.has(qId)) {
      addInvalidReference({
        id: `FK-ANS-Q-${ansId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'ExamAnswers',
        recordId: ansId,
        field: 'QuestionID',
        titleKh: `ExamAnswer "${ansId}" យោងទៅ QuestionID ដែលមិនមាន`,
        descriptionKh: `ExamAnswers.QuestionID="${qId}" មិនមានក្នុងតារាង Questions ទេ។`,
      });
    }
  });

  // 7. Validate SubjectGradeRanges -> Subjects
  getTableRecords(db, 'SubjectGradeRanges').forEach((slot) => {
    const slotId = String(slot.SlotID || '');
    const subjectNameKh = String(slot.SubjectNameKh || '').trim();
    const subId = slot.SubjectID ? String(slot.SubjectID).trim() : '';
    if (subjectNameKh && !subId) {
      addInvalidReference({
        id: `REL-SLOT-SUB-${slotId}`,
        category: 'INVALID_REFERENCE',
        severity: 'WARNING',
        tableKey: 'SubjectGradeRanges',
        recordId: slotId,
        field: 'SubjectID',
        titleKh: `Slot "${slotId}" (${subjectNameKh}) មិនទាន់មាន SubjectID ភ្ជាប់ទៅតារាង Subjects`,
        descriptionKh: `មុខវិជ្ជា "${subjectNameKh}" ក្នុង SubjectGradeRanges មិនទាន់មានកំណត់ត្រាក្នុងតារាង Subjects ទេ។`,
      });
    } else if (subId && !subjectIds.has(subId)) {
      addInvalidReference({
        id: `FK-SLOT-SUB-${slotId}`,
        category: 'INVALID_REFERENCE',
        severity: 'ERROR',
        tableKey: 'SubjectGradeRanges',
        recordId: slotId,
        field: 'SubjectID',
        titleKh: `Slot "${slotId}" យោងទៅ SubjectID="${subId}" ដែលមិនមាន`,
        descriptionKh: `SubjectGradeRanges.SubjectID="${subId}" មិនមានក្នុងតារាង Subjects ទេ។`,
      });
    }
  });

  // 8. Validate Score Tables -> Students & Classes
  const scoreTableChecks: Array<{
    key: 'MonthlyScores' | 'SemesterScores' | 'AnnualResults';
    pk: string;
  }> = [
    { key: 'MonthlyScores', pk: 'MonthlyScoreID' },
    { key: 'SemesterScores', pk: 'SemesterScoreID' },
    { key: 'AnnualResults', pk: 'AnnualResultID' },
  ];

  for (const check of scoreTableChecks) {
    getTableRecords(db, check.key).forEach((row) => {
      const recId = String(row[check.pk] || '');
      const stdId = String(row.StudentID || '');
      const clsId = String(row.ClassID || '');
      const subId = String(row.SubjectID || '');
      if (stdId && !studentIds.has(stdId)) {
        addInvalidReference({
          id: `FK-${check.key}-STD-${recId}`,
          category: 'INVALID_REFERENCE',
          severity: 'ERROR',
          tableKey: check.key,
          recordId: recId,
          field: 'StudentID',
          titleKh: `${check.key} "${recId}" យោងទៅ StudentID ដែលមិនមាន`,
          descriptionKh: `${check.key}.StudentID="${stdId}" មិនមានក្នុងតារាង Students ទេ។`,
        });
      }
      if (clsId && !classIds.has(clsId)) {
        addInvalidReference({
          id: `FK-${check.key}-CLS-${recId}`,
          category: 'INVALID_REFERENCE',
          severity: 'ERROR',
          tableKey: check.key,
          recordId: recId,
          field: 'ClassID',
          titleKh: `${check.key} "${recId}" យោងទៅ ClassID ដែលមិនមាន`,
          descriptionKh: `${check.key}.ClassID="${clsId}" មិនមានក្នុងតារាង Classes ទេ។`,
        });
      }
      if (subId && subId !== 'ALL' && !subjectIds.has(subId)) {
        addInvalidReference({
          id: `FK-${check.key}-SUB-${recId}`,
          category: 'INVALID_REFERENCE',
          severity: 'ERROR',
          tableKey: check.key,
          recordId: recId,
          field: 'SubjectID',
          titleKh: `${check.key} "${recId}" យោងទៅ SubjectID ដែលមិនមាន`,
          descriptionKh: `${check.key}.SubjectID="${subId}" មិនមានក្នុងតារាង Subjects ទេ។`,
        });
      }
    });
  }

  const totalTablesExpected = ALL_DATABASE_TABLE_DESCRIPTORS.length;
  const totalTablesPresent = tableSummaries.filter((t) => t.exists).length;
  const totalRecords = tableSummaries.reduce((sum, t) => sum + t.recordCount, 0);

  const hasHardError =
    missingTables.some((m) => m.severity === 'ERROR') ||
    duplicateIds.some((d) => d.severity === 'ERROR') ||
    invalidReferences.some((r) => r.severity === 'ERROR');

  const hasWarning =
    missingTables.length > 0 || duplicateIds.length > 0 || invalidReferences.length > 0;

  return {
    inspectedAt,
    totalTablesExpected,
    totalTablesPresent,
    missingTablesCount: missingTables.length,
    totalRecords,
    duplicateIdsCount: duplicateIds.length,
    invalidReferencesCount: invalidReferences.length,
    overallStatus: hasHardError
      ? 'INVALID'
      : hasWarning
        ? 'VALID_WITH_WARNINGS'
        : 'VALID',
    tableSummaries,
    missingTables,
    duplicateIds,
    invalidReferences,
  };
}

/**
 * Parses and validates a JSON backup payload (supports both DatabaseBackupEnvelope and raw DatabaseState JSON)
 * and builds a complete preview before any restoration occurs.
 */
export function parseAndPreviewBackupPayload(
  rawJson: string,
  currentDb: DatabaseState,
  sourceFileName = 'Uploaded_Backup.json'
): RestorePreviewResult {
  if (!rawJson || !rawJson.trim()) {
    return {
      ok: false,
      errorMessageKh: 'ឯកសារ Backup ទទេ ឬមិនមានទិន្នន័យ JSON ទេ។',
      sourceFileName,
      envelope: null,
      validationReport: null,
      tableDiffs: [],
      totalCurrentRecords: 0,
      totalBackupRecords: 0,
      preservesAllCoreTables: false,
      preservesAllOptionalCollections: false,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      ok: false,
      errorMessageKh: 'ទម្រង់ឯកសារ JSON មិនត្រឹមត្រូវ (Invalid JSON syntax)។',
      sourceFileName,
      envelope: null,
      validationReport: null,
      tableDiffs: [],
      totalCurrentRecords: 0,
      totalBackupRecords: 0,
      preservesAllCoreTables: false,
      preservesAllOptionalCollections: false,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      errorMessageKh: 'ទិន្នន័យ JSON មិនមែនជា Object ត្រឹមត្រូវសម្រាប់ DatabaseState ទេ។',
      sourceFileName,
      envelope: null,
      validationReport: null,
      tableDiffs: [],
      totalCurrentRecords: 0,
      totalBackupRecords: 0,
      preservesAllCoreTables: false,
      preservesAllOptionalCollections: false,
    };
  }

  const candidateObj = parsed as Record<string, unknown>;
  const isEnvelope =
    candidateObj.format === 'TEOKCHOR_LMS_FULL_DATABASE_BACKUP' &&
    candidateObj.data &&
    typeof candidateObj.data === 'object';

  const rawDataObj = (isEnvelope ? candidateObj.data : candidateObj) as Partial<DatabaseState>;

  // Check if at least core tables exist in the payload
  const coreDescriptors = ALL_DATABASE_TABLE_DESCRIPTORS.filter(
    (d) => d.category === 'CORE_19_SHEETS'
  );
  const missingCore = coreDescriptors.filter((d) => !Array.isArray(rawDataObj[d.key]));

  if (missingCore.length > 0) {
    return {
      ok: false,
      errorMessageKh: `ឯកសារ Backup បាត់តារាងស្នូលចំនួន ${missingCore.length} (${missingCore
        .map((m) => m.key)
        .join(', ')})។ មិនអាចស្តារទិន្នន័យបានទេ។`,
      sourceFileName,
      envelope: null,
      validationReport: generateDatabaseValidationReport(rawDataObj),
      tableDiffs: [],
      totalCurrentRecords: 0,
      totalBackupRecords: 0,
      preservesAllCoreTables: false,
      preservesAllOptionalCollections: false,
    };
  }

  // Normalize optional collections if raw DatabaseState was uploaded while preserving existing fallback if omitted
  const normalizedRestoreState: DatabaseState = {
    ...(rawDataObj as DatabaseState),
    HomeroomTeacherAssignments: Array.isArray(rawDataObj.HomeroomTeacherAssignments)
      ? rawDataObj.HomeroomTeacherAssignments
      : currentDb.HomeroomTeacherAssignments || [],
    TeacherSpecializations: Array.isArray(rawDataObj.TeacherSpecializations)
      ? rawDataObj.TeacherSpecializations
      : currentDb.TeacherSpecializations || [],
    ScoreEntryLocks: Array.isArray(rawDataObj.ScoreEntryLocks)
      ? rawDataObj.ScoreEntryLocks
      : currentDb.ScoreEntryLocks || [],
    ScoreSubmissions: Array.isArray(rawDataObj.ScoreSubmissions)
      ? rawDataObj.ScoreSubmissions
      : currentDb.ScoreSubmissions || [],
    ScoreModificationHistory: Array.isArray(rawDataObj.ScoreModificationHistory)
      ? rawDataObj.ScoreModificationHistory
      : currentDb.ScoreModificationHistory || [],
    SubjectGradeRanges: Array.isArray(rawDataObj.SubjectGradeRanges)
      ? rawDataObj.SubjectGradeRanges
      : currentDb.SubjectGradeRanges || [],
  };

  const envelope: DatabaseBackupEnvelope = isEnvelope
    ? {
        ...(candidateObj as unknown as DatabaseBackupEnvelope),
        data: cloneDatabaseStatePreservingAllFields(normalizedRestoreState),
        recordCounts: computeDatabaseRecordCounts(normalizedRestoreState),
      }
    : createDatabaseBackupEnvelope(normalizedRestoreState, {
        note: `Imported from ${sourceFileName}`,
      });

  const validationReport = generateDatabaseValidationReport(envelope.data);
  const currentCounts = computeDatabaseRecordCounts(currentDb);
  const backupCounts = envelope.recordCounts;

  const tableDiffs: RestoreTableDiff[] = ALL_DATABASE_TABLE_DESCRIPTORS.map((desc) => {
    const currentCount = currentCounts[desc.key] || 0;
    const backupCount = backupCounts[desc.key] || 0;
    const presentInBackup = Array.isArray(rawDataObj[desc.key]);
    const records = getTableRecords(envelope.data, desc.key);
    const sampleIds = records
      .slice(0, 3)
      .map((r) => String(r[desc.primaryKey] ?? ''))
      .filter(Boolean);

    return {
      key: desc.key,
      sheetNumber: desc.sheetNumber,
      category: desc.category,
      titleKh: desc.titleKh,
      primaryKey: desc.primaryKey,
      currentCount,
      backupCount,
      delta: backupCount - currentCount,
      presentInBackup,
      sampleIds,
    };
  });

  const totalCurrentRecords = Object.values(currentCounts).reduce((s, n) => s + n, 0);
  const totalBackupRecords = Object.values(backupCounts).reduce((s, n) => s + n, 0);
  const optionalDescriptors = ALL_DATABASE_TABLE_DESCRIPTORS.filter(
    (d) => d.category === 'OPTIONAL_COLLECTION'
  );
  const preservesAllOptionalCollections = optionalDescriptors.every((d) =>
    Array.isArray(envelope.data[d.key])
  );

  return {
    ok: true,
    sourceFileName,
    envelope,
    validationReport,
    tableDiffs,
    totalCurrentRecords,
    totalBackupRecords,
    preservesAllCoreTables: true,
    preservesAllOptionalCollections,
  };
}

/**
 * Restores a validated DatabaseBackupEnvelope into a new DatabaseState,
 * preserving every existing record, primary ID, foreign key, and relationship,
 * and appends a non-destructive RESTORE_DATABASE_BACKUP entry to AuditLogs.
 */
export function applyDatabaseBackupRestore(
  envelope: DatabaseBackupEnvelope,
  actorUserId = 'USR-SUP-01'
): DatabaseState {
  const restored = cloneDatabaseStatePreservingAllFields(envelope.data);
  const now = new Date().toISOString();
  const auditEntry = {
    LogID: `LOG-RESTORE-${String(restored.AuditLogs.length + 1).padStart(4, '0')}`,
    UserID: actorUserId,
    Action: 'RESTORE_DATABASE_BACKUP',
    Module: 'BackupRestoreService.gs',
    RecordID: envelope.metadata.backupId,
    OldValueJSON: '{}',
    NewValueJSON: JSON.stringify({
      backupId: envelope.metadata.backupId,
      fileName: envelope.metadata.fileName,
      backupTimestamp: envelope.metadata.backupTimestamp,
      schemaVersion: envelope.metadata.schemaVersion,
      totalRecords: envelope.metadata.totalRecords,
    }),
    Timestamp: now,
    IPOrSessionReference: 'LOCAL-BACKUP-RESTORE',
    Description: `Restored complete database snapshot ${envelope.metadata.fileName} (${envelope.metadata.totalRecords} records across ${envelope.metadata.totalTables} tables)`,
  };

  return {
    ...restored,
    AuditLogs: [auditEntry, ...(restored.AuditLogs || [])],
  };
}

/**
 * Converts a specific table from DatabaseState into RFC-4180 CSV content (with UTF-8 BOM for Khmer Excel support).
 */
export function serializeTableToCsv(
  db: DatabaseState,
  tableKey: DatabaseTableKey
): { fileName: string; csvContent: string; rowCount: number; columnNames: string[] } {
  const records = getTableRecords(db, tableKey);
  const datePart = new Date().toISOString().slice(0, 10);
  const fileName = `TeokChor_${tableKey}_${datePart}.csv`;

  const columnSet = new Set<string>();
  records.forEach((row) => {
    Object.keys(row).forEach((k) => columnSet.add(k));
  });
  const columnNames = Array.from(columnSet);

  if (columnNames.length === 0) {
    const desc = ALL_DATABASE_TABLE_DESCRIPTORS.find((d) => d.key === tableKey);
    if (desc) columnNames.push(desc.primaryKey);
  }

  const escapeCsvCell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const raw =
      typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (raw.includes('"') || raw.includes(',') || raw.includes('\n') || raw.includes('\r')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const headerLine = columnNames.map(escapeCsvCell).join(',');
  const dataLines = records.map((row) =>
    columnNames.map((col) => escapeCsvCell(row[col])).join(',')
  );

  const csvContent = `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
  return {
    fileName,
    csvContent,
    rowCount: records.length,
    columnNames,
  };
}

/**
 * Converts a specific table from DatabaseState into an Excel SpreadsheetML (.xls) XML workbook
 * so Khmer Unicode, numeric scores, and IDs open cleanly in Microsoft Excel and Google Sheets.
 */
export function serializeTableToExcelXml(
  db: DatabaseState,
  tableKey: DatabaseTableKey
): { fileName: string; excelXmlContent: string; rowCount: number; columnNames: string[] } {
  const records = getTableRecords(db, tableKey);
  const datePart = new Date().toISOString().slice(0, 10);
  const fileName = `TeokChor_${tableKey}_${datePart}.xls`;

  const columnSet = new Set<string>();
  records.forEach((row) => {
    Object.keys(row).forEach((k) => columnSet.add(k));
  });
  const columnNames = Array.from(columnSet);

  const escapeXml = (str: string): string =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const headerCellsXml = columnNames
    .map(
      (col) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col)}</Data></Cell>`
    )
    .join('');

  const rowsXml = records
    .map((row) => {
      const cells = columnNames
        .map((col) => {
          const val = row[col];
          if (typeof val === 'number' && Number.isFinite(val)) {
            return `<Cell><Data ss:Type="Number">${val}</Data></Cell>`;
          }
          const strVal =
            val === null || val === undefined
              ? ''
              : typeof val === 'object'
                ? JSON.stringify(val)
                : String(val);
          return `<Cell><Data ss:Type="String">${escapeXml(strVal)}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('\n');

  const excelXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Font ss:FontName="Khmer OS Siemreap" ss:Size="10"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Khmer OS Siemreap" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(tableKey.slice(0, 31))}">
  <Table>
   <Row>${headerCellsXml}</Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

  return {
    fileName,
    excelXmlContent,
    rowCount: records.length,
    columnNames,
  };
}
