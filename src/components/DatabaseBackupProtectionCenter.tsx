import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DatabaseState } from '../types/database';
import {
  ALL_DATABASE_TABLE_DESCRIPTORS,
  BACKUP_APPLICATION_VERSION,
  BACKUP_HISTORY_STORAGE_KEY,
  BACKUP_SCHEMA_VERSION,
  BackupHistoryItem,
  DatabaseBackupEnvelope,
  DatabaseTableKey,
  RestorePreviewResult,
  applyDatabaseBackupRestore,
  computeDatabaseRecordCounts,
  createDatabaseBackupEnvelope,
  generateDatabaseValidationReport,
  inspectRuntimeDataSource,
  parseAndPreviewBackupPayload,
  serializeTableToCsv,
  serializeTableToExcelXml,
} from '../lib/databaseBackupService';
import { DataService } from '../lib/centralizedDataService';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Eye,
  FileCode2,
  FileSpreadsheet,
  HardDrive,
  History,
  Info,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';

interface DatabaseBackupProtectionCenterProps {
  db: DatabaseState;
  setDb?: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  canEditSettings: boolean;
  onResetDatabase?: () => void;
  onNotify?: (toast: {
    tone: 'success' | 'danger' | 'info';
    title: string;
    description?: string;
  }) => void;
}

function triggerBrowserDownload(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const DatabaseBackupProtectionCenter: React.FC<
  DatabaseBackupProtectionCenterProps
> = ({
  db,
  setDb,
  activeUserId,
  canEditSettings,
  onResetDatabase,
  onNotify,
}) => {
  // Load or initialize backup history from localStorage (non-destructive protection snapshot)
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(BACKUP_HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BackupHistoryItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to creating initial baseline snapshot in memory
    }

    const initialEnvelope = createDatabaseBackupEnvelope(db, {
      createdByUserId: activeUserId || 'USR-SUP-01',
      customBackupId: 'BKP-PHASE1-BASELINE',
      note: 'Phase 1 Auto-Protected Baseline Snapshot (Initial DatabaseState)',
    });

    const baselineItem: BackupHistoryItem = {
      backupId: initialEnvelope.metadata.backupId,
      fileName: initialEnvelope.metadata.fileName,
      backupTimestamp: initialEnvelope.metadata.backupTimestamp,
      applicationVersion: initialEnvelope.metadata.applicationVersion,
      schemaVersion: initialEnvelope.metadata.schemaVersion,
      createdByUserId: initialEnvelope.metadata.createdByUserId,
      note: initialEnvelope.metadata.note || 'Phase 1 Auto-Protected Baseline Snapshot',
      totalTables: initialEnvelope.metadata.totalTables,
      totalRecords: initialEnvelope.metadata.totalRecords,
      recordCounts: initialEnvelope.recordCounts,
      envelope: initialEnvelope,
    };

    try {
      localStorage.setItem(BACKUP_HISTORY_STORAGE_KEY, JSON.stringify([baselineItem]));
    } catch {
      // ignore storage quota errors
    }

    return [baselineItem];
  });

  const [backupNoteInput, setBackupNoteInput] = useState<string>(
    'Phase 1 Full Pre-Cleanup Protection Backup (All 25 Tables)'
  );
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Restore Preview State
  const [restorePreview, setRestorePreview] = useState<RestorePreviewResult | null>(null);
  const [rawJsonInput, setRawJsonInput] = useState<string>('');
  const [showJsonPasteBox, setShowJsonPasteBox] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Validation Report Filter State
  const [validationTab, setValidationTab] = useState<
    'ALL_ISSUES' | 'MISSING_TABLES' | 'DUPLICATE_IDS' | 'INVALID_REFERENCES' | 'TABLE_MATRIX'
  >('ALL_ISSUES');

  // Individual Table Export Filter State
  const [tableCategoryFilter, setTableCategoryFilter] = useState<
    'ALL' | 'CORE_19_SHEETS' | 'OPTIONAL_COLLECTION'
  >('ALL');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [confirmSeedReset, setConfirmSeedReset] = useState<boolean>(false);

  // Sync backupHistory to localStorage whenever it updates
  useEffect(() => {
    try {
      localStorage.setItem(
        BACKUP_HISTORY_STORAGE_KEY,
        JSON.stringify(backupHistory.slice(0, 12))
      );
    } catch {
      // ignore storage quota errors
    }
  }, [backupHistory]);

  const runtimeSourceReport = useMemo(
    () => inspectRuntimeDataSource(db, backupHistory.length),
    [db, backupHistory.length]
  );

  const liveRecordCounts = useMemo(() => computeDatabaseRecordCounts(db), [db]);

  const validationReport = useMemo(() => generateDatabaseValidationReport(db), [db]);

  const filteredExportTables = useMemo(() => {
    const q = tableSearchQuery.trim().toLowerCase();
    return ALL_DATABASE_TABLE_DESCRIPTORS.filter((desc) => {
      if (tableCategoryFilter !== 'ALL' && desc.category !== tableCategoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        desc.key.toLowerCase().includes(q) ||
        desc.titleKh.toLowerCase().includes(q) ||
        desc.titleEn.toLowerCase().includes(q) ||
        desc.primaryKey.toLowerCase().includes(q)
      );
    });
  }, [tableCategoryFilter, tableSearchQuery]);

  // Create a new backup snapshot (and optionally download the .json file)
  const handleCreateFullBackup = (downloadFile: boolean) => {
    const envelope = createDatabaseBackupEnvelope(db, {
      createdByUserId: activeUserId || 'USR-SUP-01',
      note:
        backupNoteInput.trim() ||
        'Phase 1 Full Database Backup (19 Core Sheets + 6 Optional Collections)',
    });

    const newItem: BackupHistoryItem = {
      backupId: envelope.metadata.backupId,
      fileName: envelope.metadata.fileName,
      backupTimestamp: envelope.metadata.backupTimestamp,
      applicationVersion: envelope.metadata.applicationVersion,
      schemaVersion: envelope.metadata.schemaVersion,
      createdByUserId: envelope.metadata.createdByUserId,
      note: envelope.metadata.note || '',
      totalTables: envelope.metadata.totalTables,
      totalRecords: envelope.metadata.totalRecords,
      recordCounts: envelope.recordCounts,
      envelope,
    };

    setBackupHistory((prev) => [newItem, ...prev]);

    if (setDb) {
      const now = new Date().toISOString();
      DataService.commitState(setDb, (prev) =>
        DataService.appendAuditLog(prev, {
          LogID: `LOG-BKP-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
          UserID: activeUserId,
          Action: downloadFile
            ? 'EXPORT_FULL_DATABASE_BACKUP_JSON'
            : 'CREATE_LOCAL_BACKUP_SNAPSHOT',
          Module: 'BackupRestoreService.gs',
          RecordID: envelope.metadata.backupId,
          OldValueJSON: '{}',
          NewValueJSON: JSON.stringify({
            fileName: envelope.metadata.fileName,
            schemaVersion: envelope.metadata.schemaVersion,
            totalTables: envelope.metadata.totalTables,
            totalRecords: envelope.metadata.totalRecords,
          }),
          Timestamp: now,
          IPOrSessionReference: 'PHASE1-BACKUP-ENGINE',
          Description: `Created full database backup ${envelope.metadata.fileName} (${envelope.metadata.totalRecords} records across ${envelope.metadata.totalTables} tables)`,
        })
      );
    }

    if (downloadFile) {
      const jsonPayload = JSON.stringify(envelope, null, 2);
      triggerBrowserDownload(jsonPayload, envelope.metadata.fileName, 'application/json');
    }

    onNotify?.({
      tone: 'success',
      title: downloadFile
        ? `បានបង្កើត និងទាញយកឯកសារ Backup ពេញលេញ (${envelope.metadata.fileName})`
        : `បានរក្សាទុក Snapshot ក្នុងប្រវត្តិ Backup (${envelope.metadata.backupId})`,
      description: `រក្សាទុកទិន្នន័យសរុប ${envelope.metadata.totalRecords} កំណត់ត្រា ក្នុង ${envelope.metadata.totalTables} តារាង (19 Core + 6 Optional) ដោយជោគជ័យ។`,
    });
  };

  // Download an existing backup from history
  const handleDownloadHistoryItem = (item: BackupHistoryItem) => {
    const jsonPayload = JSON.stringify(item.envelope, null, 2);
    triggerBrowserDownload(jsonPayload, item.fileName, 'application/json');
    onNotify?.({
      tone: 'info',
      title: `កំពុងទាញយកឯកសារ ${item.fileName}`,
      description: `Backup ID: ${item.backupId} • សរុប ${item.totalRecords} កំណត់ត្រា។`,
    });
  };

  // Preview a backup from History before restoring
  const handlePreviewHistoryBackup = (item: BackupHistoryItem) => {
    const raw = JSON.stringify(item.envelope);
    const preview = parseAndPreviewBackupPayload(raw, db, item.fileName);
    setRestorePreview(preview);
    onNotify?.({
      tone: 'info',
      title: `បានបើកការត្រួតពិនិត្យមុនពេលស្តារទិន្នន័យ (${item.backupId})`,
      description:
        'សូមពិនិត្យមើលចំនួនកំណត់ត្រា និងរបាយការណ៍ផ្ទៀងផ្ទាត់ខាងក្រោម មុនពេលចុចប៊ូតុងអនុវត្តការស្តារទិន្នន័យ។',
    });
  };

  // Handle JSON file upload for Restore Preview
  const handleUploadBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const preview = parseAndPreviewBackupPayload(text, db, file.name);
      setRestorePreview(preview);
      if (!preview.ok) {
        onNotify?.({
          tone: 'danger',
          title: 'ឯកសារ Backup មិនត្រឹមត្រូវ',
          description: preview.errorMessageKh,
        });
      } else {
        onNotify?.({
          tone: 'success',
          title: `បានផ្ទៀងផ្ទាត់ឯកសារ "${file.name}" រួចរាល់សម្រាប់ការមើលជាមុន`,
          description: `រកឃើញ ${preview.totalBackupRecords} កំណត់ត្រា ក្នុង ${
            preview.envelope?.metadata.totalTables || 25
          } តារាង។`,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handle validating pasted JSON
  const handleValidatePastedJson = () => {
    const preview = parseAndPreviewBackupPayload(
      rawJsonInput,
      db,
      'Pasted_JSON_Backup.json'
    );
    setRestorePreview(preview);
    if (!preview.ok) {
      onNotify?.({
        tone: 'danger',
        title: 'ទម្រង់ JSON មិនត្រឹមត្រូវ',
        description: preview.errorMessageKh,
      });
    } else {
      onNotify?.({
        tone: 'success',
        title: 'បានផ្ទៀងផ្ទាត់ទិន្នន័យ JSON រួចរាល់សម្រាប់ការមើលជាមុន',
        description: `រកឃើញ ${preview.totalBackupRecords} កំណត់ត្រា។ សូមពិនិត្យតារាងប្រៀបធៀបមុនពេលស្តារ។`,
      });
    }
  };

  // Execute the confirmed restore
  const handleConfirmRestore = () => {
    if (!restorePreview || !restorePreview.ok || !restorePreview.envelope) return;
    if (!setDb) {
      onNotify?.({
        tone: 'danger',
        title: 'មិនអាចស្តារទិន្នន័យបានទេ',
        description: 'setDb មិនត្រូវបានផ្តល់ឱ្យក្នុងសមាសភាគនេះទេ។',
      });
      return;
    }

    const restoredState = applyDatabaseBackupRestore(
      restorePreview.envelope,
      activeUserId
    );
    DataService.commitState(setDb, restoredState);

    // Ensure restored backup is also in history if it came from an external file
    const env = restorePreview.envelope;
    setBackupHistory((prev) => {
      if (prev.some((p) => p.backupId === env.metadata.backupId)) {
        return prev;
      }
      const added: BackupHistoryItem = {
        backupId: env.metadata.backupId,
        fileName: env.metadata.fileName,
        backupTimestamp: env.metadata.backupTimestamp,
        applicationVersion: env.metadata.applicationVersion,
        schemaVersion: env.metadata.schemaVersion,
        createdByUserId: env.metadata.createdByUserId,
        note: env.metadata.note || `Restored from ${restorePreview.sourceFileName}`,
        totalTables: env.metadata.totalTables,
        totalRecords: env.metadata.totalRecords,
        recordCounts: env.recordCounts,
        envelope: env,
      };
      return [added, ...prev];
    });

    onNotify?.({
      tone: 'success',
      title: `បានស្តារទិន្នន័យពេញលេញដោយជោគជ័យ (${env.metadata.backupId})`,
      description: `រាល់កំណត់ត្រាទាំង ${env.metadata.totalRecords} Primary IDs, Foreign Keys និងទំនាក់ទំនងទាំងអស់ត្រូវបានស្តារឡើងវិញ ១០០%។`,
    });
    setRestorePreview(null);
  };

  // Individual Table CSV Export
  const handleExportTableCsv = (tableKey: DatabaseTableKey) => {
    const { fileName, csvContent, rowCount } = serializeTableToCsv(db, tableKey);
    triggerBrowserDownload(csvContent, fileName, 'text/csv;charset=utf-8;');
    onNotify?.({
      tone: 'success',
      title: `បានទាញយកតារាង ${tableKey} ជាឯកសារ CSV (${fileName})`,
      description: `នាំចេញចំនួន ${rowCount} ជួរទិន្នន័យ (UTF-8 BOM សម្រាប់អក្សរខ្មែរ)។`,
    });
  };

  // Individual Table Excel (.xls) Export
  const handleExportTableExcel = (tableKey: DatabaseTableKey) => {
    const { fileName, excelXmlContent, rowCount } = serializeTableToExcelXml(
      db,
      tableKey
    );
    triggerBrowserDownload(
      excelXmlContent,
      fileName,
      'application/vnd.ms-excel;charset=utf-8;'
    );
    onNotify?.({
      tone: 'success',
      title: `បានទាញយកតារាង ${tableKey} ជាឯកសារ Excel (${fileName})`,
      description: `នាំចេញចំនួន ${rowCount} ជួរទិន្នន័យក្នុងទម្រង់ Excel SpreadsheetML (.xls)។`,
    });
  };

  return (
    <div className="space-y-6" data-testid="database-backup-protection-center">
      {/* =========================================================================
          1. RUNTIME DATA SOURCE & LOCAL PREVIEW PERSISTENCE DISCLOSURE BANNER
      ========================================================================= */}
      <div
        data-testid="runtime-datasource-banner"
        className="p-5 rounded-2xl bg-amber-50/90 border border-amber-300/90 shadow-2xs space-y-3"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-200/80 text-amber-950 text-[11px] font-mono-tabular font-extrabold uppercase tracking-wider">
                  LOCAL PREVIEW MODE • IN-MEMORY DATA SOURCE
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-white border border-amber-300 text-amber-900 text-[11px] font-mono-tabular font-bold">
                  {runtimeSourceReport.stateInitializer}
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-amber-950 font-khmer-body mt-1.5">
                {runtimeSourceReport.statusHeadlineKh}
              </h4>
              <p className="text-xs text-amber-900/90 font-khmer-body leading-relaxed mt-0.5">
                {runtimeSourceReport.statusDescriptionKh}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-white border border-amber-200 text-right">
              <div className="text-[10px] font-khmer-body text-slate-500">
                ប្រភពទិន្នន័យសកម្ម (Active Runtime)
              </div>
              <div className="text-xs font-mono-tabular font-extrabold text-slate-900">
                In-Memory DatabaseState ({runtimeSourceReport.totalTableCount} Tables)
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-white border border-amber-200 text-right">
              <div className="text-[10px] font-khmer-body text-slate-500">
                ស្ថានភាព Google Sheets
              </div>
              <div className="text-xs font-khmer-body font-extrabold text-amber-800">
                មិនទាន់ភ្ជាប់អចិន្ត្រៃយ៍ (Not Persisted)
              </div>
            </div>
          </div>
        </div>

        {/* Distinction Comparison Bar: In-Memory vs Persisted Google Sheets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-amber-200/80 text-xs font-khmer-body">
          <div className="p-3 rounded-xl bg-white/90 border border-amber-200/80 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900">
                ១. ទិន្នន័យក្នុងអង្គចងចាំបច្ចុប្បន្ន (In-Memory React State):
              </div>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                ផ្ទុកតារាងស្នូលទាំង <strong>{runtimeSourceReport.coreTableCount} សន្លឹក</strong> និងតារាងបន្ថែម{' '}
                <strong>{runtimeSourceReport.optionalCollectionCount} តារាង</strong> (សរុប{' '}
                <strong>{runtimeSourceReport.totalRecordCount} កំណត់ត្រា</strong>) តាមរយៈ{' '}
                <code className="font-mono-tabular text-indigo-700">createInitialDatabaseState()</code>។
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/90 border border-amber-200/80 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900">
                ២. ការការពារទិន្នន័យមុនពេលសម្អាត (Phase 1 Data Protection):
              </div>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                អ្នកអាចទាញយកឯកសារ <strong>Full JSON Backup (.json)</strong> ឬរក្សាទុកក្នុង{' '}
                <strong>ប្រវត្តិ Backup ({backupHistory.length} Snapshots)</strong> ដើម្បីធានាថាគ្មានទិន្នន័យណាមួយបាត់បង់ឡើយ។
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. FULL DATABASE SNAPSHOT METADATA & EXPORT CONTROL CENTER
      ========================================================================= */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 font-khmer-body">
              <Database className="w-4 h-4" />
              <span>PHASE 1 – FULL DATABASE BACKUP &amp; SNAPSHOT GENERATOR</span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 font-khmer-body">
              ប្រព័ន្ធបម្រុងទុកមូលដ្ឋានទិន្នន័យពេញលេញ (Complete 25-Table DatabaseState Backup)
            </h3>
            <p className="text-xs text-slate-500 font-khmer-body">
              រក្សាទុកគ្រប់កំណត់ត្រា Primary Keys, Foreign Keys និងទំនាក់ទំនងទាំងអស់ពីតារាងស្នូលទាំង ១៩ និងតារាងបន្ថែមទាំង ៦។
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              data-testid="btn-save-snapshot-history"
              onClick={() => handleCreateFullBackup(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
            >
              <History className="w-4 h-4 text-indigo-600" />
              <span>រក្សាទុក Snapshot ក្នុងប្រវត្តិ Backup</span>
            </button>

            <button
              type="button"
              data-testid="btn-download-full-json-backup"
              onClick={() => handleCreateFullBackup(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>ទាញយកឯកសារ Backup ពេញលេញ (.json)</span>
            </button>
          </div>
        </div>

        {/* 4 Key Metadata Cards: Timestamp, App Version, Schema Version, Record Counts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-khmer-body text-slate-500">
              <span>ពេលវេលាបច្ចុប្បន្ន (Backup Timestamp)</span>
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div
              data-testid="backup-meta-timestamp"
              className="text-xs font-mono-tabular font-extrabold text-slate-900"
            >
              {backupHistory[0]?.backupTimestamp || new Date().toISOString()}
            </div>
            <div className="text-[11px] text-slate-500 font-khmer-body">
              ISO-8601 ស្តង់ដារអន្តរជាតិ
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-khmer-body text-slate-500">
              <span>កំណែកម្មវិធី (Application Version)</span>
              <FileCode2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div
              data-testid="backup-meta-app-version"
              className="text-sm font-mono-tabular font-extrabold text-slate-900"
            >
              {BACKUP_APPLICATION_VERSION}
            </div>
            <div className="text-[11px] text-slate-500 font-khmer-body">
              វិទ្យាល័យទឹកជោរ (Teok Chor LMS)
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-khmer-body text-slate-500">
              <span>កំណែទម្រង់ទិន្នន័យ (Schema Version)</span>
              <Layers className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div
              data-testid="backup-meta-schema-version"
              className="text-sm font-mono-tabular font-extrabold text-slate-900"
            >
              {BACKUP_SCHEMA_VERSION}
            </div>
            <div className="text-[11px] text-slate-500 font-khmer-body">
              19 Core Sheets + 6 Optional Tables
            </div>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/80 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-khmer-body text-indigo-700 font-semibold">
              <span>ចំនួនទិន្នន័យសរុប (Total Records)</span>
              <Database className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div
              data-testid="backup-meta-total-records"
              className="text-sm font-mono-tabular font-extrabold text-indigo-950"
            >
              {runtimeSourceReport.totalRecordCount} កំណត់ត្រា (ក្នុង {runtimeSourceReport.totalTableCount} តារាង)
            </div>
            <div className="text-[11px] text-indigo-700 font-khmer-body">
              រក្សាទុកគ្រប់ Primary ID &amp; Foreign Key ១០០%
            </div>
          </div>
        </div>

        {/* Optional Backup Description / Note Input */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-1">
          <div className="md:col-span-2 space-y-1">
            <label
              htmlFor="backup-note-input"
              className="block text-xs font-bold text-slate-700 font-khmer-body"
            >
              កំណត់ចំណាំសម្រាប់ឯកសារ Backup (Backup Note / Label)
            </label>
            <input
              id="backup-note-input"
              type="text"
              value={backupNoteInput}
              onChange={(e) => setBackupNoteInput(e.target.value)}
              placeholder="ឧ. Backup មុនពេលសម្អាតទិន្នន័យស្ទួន Phase 2..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-khmer-body text-slate-900 bg-slate-50/60 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="text-[11px] text-slate-500 font-khmer-body bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200/70">
            ឈ្មោះឯកសារស្តង់ដារ៖{' '}
            <code className="font-mono-tabular font-bold text-slate-800">
              TeokChor_LMS_FullBackup_25Tables_*.json
            </code>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. BACKUP HISTORY & RESTORE VALIDATION / PREVIEW SECTION
      ========================================================================= */}
      <div className="space-y-6">
        {/* Backup History Table */}
        <div
          data-testid="backup-history-section"
          className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>ប្រវត្តិនៃការបម្រុងទុកទិន្នន័យ (Backup History)</span>
              </h4>
              <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                បង្ហាញកាលបរិច្ឆេទ ឈ្មោះឯកសារ កំណែទម្រង់ និងចំនួនកំណត់ត្រាសម្រាប់ Snapshot នីមួយៗ។
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-mono-tabular font-bold">
              {backupHistory.length} Snapshots
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs font-khmer-body">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">កាលបរិច្ឆេទ (Backup Date)</th>
                  <th className="py-2.5 px-3">ឈ្មោះឯកសារ (File Name)</th>
                  <th className="py-2.5 px-3 text-center">ចំនួនទិន្នន័យ (Records)</th>
                  <th className="py-2.5 px-3 text-right">សកម្មភាព (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {backupHistory.map((item) => {
                  const isExpanded = expandedHistoryId === item.backupId;
                  return (
                    <React.Fragment key={item.backupId}>
                      <tr className="hover:bg-slate-50/80">
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <div className="font-mono-tabular font-bold text-slate-900">
                            {item.backupTimestamp.slice(0, 19).replace('T', ' ')}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-indigo-600 font-semibold">
                            {item.backupId}
                          </div>
                        </td>
                        <td className="py-3 px-3 align-top">
                          <div className="font-mono-tabular font-bold text-slate-800">
                            {item.fileName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {item.note} • <span className="font-mono-tabular">{item.schemaVersion}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono-tabular font-bold text-[11px]">
                            {item.totalRecords} rows / {item.totalTables} tables
                          </span>
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedHistoryId(isExpanded ? null : item.backupId)
                              }
                              className="text-[11px] text-indigo-600 hover:underline font-semibold cursor-pointer"
                            >
                              {isExpanded ? 'លាក់ចំនួនតាមតារាង' : 'មើលចំនួនតាមតារាង'}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              data-testid={`btn-preview-restore-${item.backupId}`}
                              onClick={() => handlePreviewHistoryBackup(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>ពិនិត្យ &amp; ស្តារ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadHistoryItem(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>.json</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={4} className="p-3">
                            <div className="text-[11px] font-bold text-slate-700 mb-2">
                              ចំនួនកំណត់ត្រាក្នុងតារាងទាំង {item.totalTables} ({item.backupId}):
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] font-mono-tabular">
                              {ALL_DATABASE_TABLE_DESCRIPTORS.map((desc) => (
                                <div
                                  key={desc.key}
                                  className="px-2 py-1 rounded bg-white border border-slate-200 flex items-center justify-between"
                                >
                                  <span className="truncate text-slate-600">{desc.key}</span>
                                  <span className="font-bold text-slate-900">
                                    {item.recordCounts[desc.key] ?? 0}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Database Restore Upload, Validation & Preview Before Restoration */}
        <div
          data-testid="restore-preview-section"
          className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4"
        >
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>ស្តារទិន្នន័យ និងពិនិត្យមើលជាមុន (Validate &amp; Preview Restore)</span>
              </h4>
              <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                ផ្ទុកឯកសារ Backup (.json) ឬជ្រើសរើសពីប្រវត្តិ Backup ដើម្បីពិនិត្យសុពលភាពមុនពេលស្តារទិន្នន័យ។
              </p>
            </div>

            {/* Upload File or Paste JSON Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleUploadBackupFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-khmer-body transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>ជ្រើសរើសឯកសារ Backup (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowJsonPasteBox((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>{showJsonPasteBox ? 'លាក់ប្រអប់ JSON' : 'បិទភ្ជាប់កូដ JSON ផ្ទាល់'}</span>
              </button>
            </div>

            {showJsonPasteBox && (
              <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label
                  htmlFor="paste-backup-json"
                  className="block text-xs font-bold text-slate-700 font-khmer-body"
                >
                  បិទភ្ជាប់ទិន្នន័យ JSON Backup ដើម្បីផ្ទៀងផ្ទាត់៖
                </label>
                <textarea
                  id="paste-backup-json"
                  rows={4}
                  value={rawJsonInput}
                  onChange={(e) => setRawJsonInput(e.target.value)}
                  placeholder='{"format": "TEOKCHOR_LMS_FULL_DATABASE_BACKUP", ...}'
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono-tabular bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleValidatePastedJson}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body cursor-pointer"
                >
                  ពិនិត្យសុពលភាព និងមើលជាមុន (Validate &amp; Preview)
                </button>
              </div>
            )}

            {/* Restore Preview Output */}
            {!restorePreview ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2">
                <Eye className="w-6 h-6 text-slate-400 mx-auto" />
                <div className="text-xs font-bold text-slate-700 font-khmer-body">
                  មិនទាន់មានឯកសារ Backup ត្រូវបានជ្រើសរើសសម្រាប់ការមើលជាមុនទេ
                </div>
                <p className="text-[11px] text-slate-500 font-khmer-body">
                  ចុចប៊ូតុង <strong>&ldquo;ពិនិត្យ &amp; ស្តារ&rdquo;</strong> ក្នុងតារាងប្រវត្តិ Backup ឬផ្ទុកឯកសារ <code>.json</code> ដើម្បីមើលរបាយការណ៍ប្រៀបធៀបមុនពេលស្តារ។
                </p>
              </div>
            ) : !restorePreview.ok ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                <div className="flex items-center gap-2 text-xs font-extrabold text-rose-800 font-khmer-body">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>ការផ្ទៀងផ្ទាត់ឯកសារ Backup បរាជ័យ ({restorePreview.sourceFileName})</span>
                </div>
                <p className="text-xs text-rose-700 font-khmer-body">
                  {restorePreview.errorMessageKh}
                </p>
              </div>
            ) : (
              <div
                data-testid="restore-preview-active-card"
                className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-900 font-khmer-body">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ឯកសារ Backup មានសុពលភាពពេញលេញ (Ready to Restore)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRestorePreview(null)}
                    className="text-[11px] text-slate-500 hover:text-slate-800 font-khmer-body cursor-pointer"
                  >
                    បិទ (Close)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-khmer-body bg-white p-2.5 rounded-lg border border-emerald-200">
                  <div>
                    <span className="text-slate-500">ឯកសារ៖</span>{' '}
                    <span className="font-mono-tabular font-bold text-slate-900 break-all">
                      {restorePreview.sourceFileName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Backup ID៖</span>{' '}
                    <span className="font-mono-tabular font-bold text-indigo-700">
                      {restorePreview.envelope?.metadata.backupId}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">ទិន្នន័យបច្ចុប្បន្ន៖</span>{' '}
                    <span className="font-mono-tabular font-bold text-slate-800">
                      {restorePreview.totalCurrentRecords} rows
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">ទិន្នន័យក្នុង Backup៖</span>{' '}
                    <span className="font-mono-tabular font-bold text-emerald-700">
                      {restorePreview.totalBackupRecords} rows (25 tables)
                    </span>
                  </div>
                </div>

                {/* Scrollable Table-by-Table Preview Diff */}
                <div className="max-h-44 overflow-y-auto border border-emerald-200 rounded-lg bg-white">
                  <table className="w-full text-left border-collapse text-[11px] font-khmer-body">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                        <th className="py-1.5 px-2.5">តារាង (Table)</th>
                        <th className="py-1.5 px-2 text-center">បច្ចុប្បន្ន</th>
                        <th className="py-1.5 px-2 text-center">Backup</th>
                        <th className="py-1.5 px-2 text-right">លំអៀង (Delta)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {restorePreview.tableDiffs.map((diff) => (
                        <tr key={diff.key}>
                          <td className="py-1.5 px-2.5 font-mono-tabular font-semibold text-slate-800">
                            {diff.key}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono-tabular text-slate-600">
                            {diff.currentCount}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono-tabular font-bold text-slate-900">
                            {diff.backupCount}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono-tabular font-bold">
                            {diff.delta === 0 ? (
                              <span className="text-slate-400">0</span>
                            ) : diff.delta > 0 ? (
                              <span className="text-emerald-600">+{diff.delta}</span>
                            ) : (
                              <span className="text-amber-600">{diff.delta}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  data-testid="btn-confirm-restore-database"
                  onClick={handleConfirmRestore}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-khmer-body shadow-sm transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>
                    អនុវត្តការស្តារទិន្នន័យឥឡូវនេះ (Restore All {restorePreview.totalBackupRecords} Records)
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. DATABASE VALIDATION REPORT (MISSING TABLES, DUPLICATE IDs, INVALID REFS)
      ========================================================================= */}
      <div
        data-testid="database-validation-report-section"
        className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>
                របាយការណ៍ត្រួតពិនិត្យសុពលភាពមូលដ្ឋានទិន្នន័យ (Database Integrity &amp; Validation Report)
              </span>
            </h4>
            <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
              ត្រួតពិនិត្យដោយស្វ័យប្រវត្តិ (Read-Only) នូវតារាងដែលបាត់ លេខសម្គាល់ស្ទួន (Duplicate IDs) និងទំនាក់ទំនងមិនត្រឹមត្រូវ (Invalid References)។
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {validationReport.overallStatus === 'VALID' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold font-khmer-body">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>សុពលភាពល្អឥតខ្ចោះ (100% Valid)</span>
              </span>
            )}
            {validationReport.overallStatus === 'VALID_WITH_WARNINGS' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold font-khmer-body">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>
                  តារាងទាំង ២៥ ពេញលេញ • មានចំណុចព្រមានទំនាក់ទំនងចំនួន{' '}
                  {validationReport.invalidReferencesCount}
                </span>
              </span>
            )}
            {validationReport.overallStatus === 'INVALID' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold font-khmer-body">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>រកឃើញបញ្ហាសុពលភាពដែលត្រូវពិនិត្យ</span>
              </span>
            )}
          </div>
        </div>

        {/* Validation Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
            <div className="text-[11px] font-khmer-body text-emerald-800 font-semibold">
              ១. តារាងទិន្នន័យសរុប (Tables Present)
            </div>
            <div
              data-testid="validation-tables-present"
              className="text-lg font-mono-tabular font-extrabold text-emerald-950"
            >
              {validationReport.totalTablesPresent} / {validationReport.totalTablesExpected}
            </div>
            <div className="text-[11px] text-emerald-700 font-khmer-body">
              តារាងដែលបាត់ (Missing Tables): <strong>{validationReport.missingTablesCount}</strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1">
            <div className="text-[11px] font-khmer-body text-blue-800 font-semibold">
              ២. លេខសម្គាល់ស្ទួន (Duplicate Primary IDs)
            </div>
            <div
              data-testid="validation-duplicate-ids"
              className="text-lg font-mono-tabular font-extrabold text-blue-950"
            >
              {validationReport.duplicateIdsCount}
            </div>
            <div className="text-[11px] text-blue-700 font-khmer-body">
              ត្រួតពិនិត្យលើគ្រប់ Primary Keys ទាំង ២៥ តារាង
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
            <div className="text-[11px] font-khmer-body text-amber-900 font-semibold">
              ៣. ទំនាក់ទំនងមិនត្រឹមត្រូវ (Invalid References)
            </div>
            <div
              data-testid="validation-invalid-refs"
              className="text-lg font-mono-tabular font-extrabold text-amber-950"
            >
              {validationReport.invalidReferencesCount}
            </div>
            <div className="text-[11px] text-amber-800 font-khmer-body">
              Foreign Keys &amp; ភាពមិនស៊ីគ្នារវាងតារាង
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-[11px] font-khmer-body text-slate-600 font-semibold">
              ៤. កំណត់ត្រាដែលបានត្រួតពិនិត្យ (Audited Rows)
            </div>
            <div className="text-lg font-mono-tabular font-extrabold text-slate-900">
              {validationReport.totalRecords}
            </div>
            <div className="text-[11px] text-slate-500 font-khmer-body">
              គ្មានការលុប ឬកែប្រែទិន្នន័យដើមឡើយ (Read-Only)
            </div>
          </div>
        </div>

        {/* Filter Tabs for Validation Details */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          {[
            {
              id: 'ALL_ISSUES' as const,
              labelKh: `បញ្ជីចំណុចរកឃើញសរុប (${
                validationReport.missingTablesCount +
                validationReport.duplicateIdsCount +
                validationReport.invalidReferencesCount
              })`,
            },
            {
              id: 'MISSING_TABLES' as const,
              labelKh: `តារាងដែលបាត់ (${validationReport.missingTablesCount})`,
            },
            {
              id: 'DUPLICATE_IDS' as const,
              labelKh: `លេខសម្គាល់ស្ទួន (${validationReport.duplicateIdsCount})`,
            },
            {
              id: 'INVALID_REFERENCES' as const,
              labelKh: `ទំនាក់ទំនងមិនត្រឹមត្រូវ (${validationReport.invalidReferencesCount})`,
            },
            {
              id: 'TABLE_MATRIX' as const,
              labelKh: `តារាងសុខភាពទិន្នន័យទាំង ២៥ (25-Table Health Matrix)`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setValidationTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-khmer-body transition-colors cursor-pointer ${
                validationTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.labelKh}
            </button>
          ))}
        </div>

        {validationTab === 'TABLE_MATRIX' ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs font-khmer-body">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">ឈ្មោះតារាង (Table Name)</th>
                  <th className="py-2.5 px-3">ប្រភេទ (Category)</th>
                  <th className="py-2.5 px-3">Primary Key</th>
                  <th className="py-2.5 px-3 text-center">ចំនួនកំណត់ត្រា</th>
                  <th className="py-2.5 px-3 text-center">Duplicate IDs</th>
                  <th className="py-2.5 px-3 text-center">Invalid Refs</th>
                  <th className="py-2.5 px-3 text-right">ស្ថានភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {validationReport.tableSummaries.map((tbl) => (
                  <tr key={tbl.key} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 text-center font-mono-tabular text-slate-400">
                      {tbl.sheetNumber}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-mono-tabular font-bold text-slate-900">
                        {tbl.key}
                      </div>
                      <div className="text-[11px] text-slate-500">{tbl.titleKh}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular font-bold ${
                          tbl.category === 'CORE_19_SHEETS'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {tbl.category === 'CORE_19_SHEETS' ? 'CORE SHEET' : 'OPTIONAL'}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono-tabular font-semibold text-indigo-600">
                      {tbl.primaryKey}
                    </td>
                    <td className="py-2 px-3 text-center font-mono-tabular font-bold text-slate-900">
                      {tbl.recordCount}
                    </td>
                    <td className="py-2 px-3 text-center font-mono-tabular font-bold text-slate-700">
                      {tbl.duplicateIdCount}
                    </td>
                    <td className="py-2 px-3 text-center font-mono-tabular font-bold text-slate-700">
                      {tbl.invalidReferenceCount}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {tbl.status === 'HEALTHY' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          HEALTHY
                        </span>
                      )}
                      {tbl.status === 'WARNING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                          WARNING
                        </span>
                      )}
                      {tbl.status === 'ERROR' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                          ERROR
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-2.5">
            {(() => {
              const items =
                validationTab === 'MISSING_TABLES'
                  ? validationReport.missingTables
                  : validationTab === 'DUPLICATE_IDS'
                    ? validationReport.duplicateIds
                    : validationTab === 'INVALID_REFERENCES'
                      ? validationReport.invalidReferences
                      : [
                          ...validationReport.missingTables,
                          ...validationReport.duplicateIds,
                          ...validationReport.invalidReferences,
                        ];

              if (items.length === 0) {
                return (
                  <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3 text-xs font-khmer-body text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      មិនរកឃើញបញ្ហាក្នុងផ្នែកនេះទេ (០ បញ្ហា) — រាល់ទិន្នន័យមានសុពលភាពត្រឹមត្រូវ។
                    </span>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs font-khmer-body">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">ប្រភេទ (Category)</th>
                        <th className="py-2.5 px-3">តារាង (Table)</th>
                        <th className="py-2.5 px-3">លេខសម្គាល់ (Record ID / Field)</th>
                        <th className="py-2.5 px-3">ពិពណ៌នាលម្អិត (Validation Finding)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70">
                      {items.map((issue) => (
                        <tr key={issue.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 align-top">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono-tabular font-bold ${
                                issue.severity === 'ERROR'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {issue.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 align-top font-mono-tabular font-bold text-slate-900">
                            {issue.tableKey}
                          </td>
                          <td className="py-2.5 px-3 align-top font-mono-tabular">
                            <div className="font-bold text-indigo-700">{issue.recordId}</div>
                            <div className="text-[11px] text-slate-500">Field: {issue.field}</div>
                          </td>
                          <td className="py-2.5 px-3 align-top">
                            <div className="font-bold text-slate-900">{issue.titleKh}</div>
                            <div className="text-slate-600 text-[11px] mt-0.5">
                              {issue.descriptionKh}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* =========================================================================
          5. INDIVIDUAL TABLE EXPORT AS CSV OR EXCEL (ALL 25 TABLES)
      ========================================================================= */}
      <div
        data-testid="individual-table-export-section"
        className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>
                នាំចេញទិន្នន័យតាមតារាងនីមួយៗជា CSV ឬ Excel (Individual Table Exporter — 25 Tables)
              </span>
            </h4>
            <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
              គាំទ្រការទាញយកតារាងនីមួយៗជាឯកសារ <code>.csv</code> (UTF-8 BOM) ឬ <code>.xls</code> (Excel SpreadsheetML) ដោយរក្សាទុកអក្សរខ្មែរ និងលេខសម្គាល់ដើមទាំងអស់។
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                placeholder="ស្វែងរកតារាង (ឧ. Students, Scores)..."
                aria-label="ស្វែងរកតារាងសម្រាប់នាំចេញ"
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-khmer-body bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {(['ALL', 'CORE_19_SHEETS', 'OPTIONAL_COLLECTION'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setTableCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-khmer-body transition-colors cursor-pointer ${
                  tableCategoryFilter === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat === 'ALL'
                  ? 'ទាំងអស់ (25)'
                  : cat === 'CORE_19_SHEETS'
                    ? 'តារាងស្នូល (19)'
                    : 'តារាងបន្ថែម (6)'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs font-khmer-body">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">ឈ្មោះតារាង (Table / Collection)</th>
                <th className="py-2.5 px-3">ប្រភេទ</th>
                <th className="py-2.5 px-3">Primary Key</th>
                <th className="py-2.5 px-3 text-center">ចំនួនកំណត់ត្រា (Rows)</th>
                <th className="py-2.5 px-3 text-right">ទាញយកតាមតារាង (Export CSV / Excel)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filteredExportTables.map((desc) => {
                const count = liveRecordCounts[desc.key] ?? 0;
                return (
                  <tr key={desc.key} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 text-center font-mono-tabular text-slate-400">
                      {desc.sheetNumber}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono-tabular font-bold text-slate-900">
                        {desc.key}
                      </div>
                      <div className="text-[11px] text-slate-500">{desc.titleKh}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular font-bold ${
                          desc.category === 'CORE_19_SHEETS'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {desc.category === 'CORE_19_SHEETS' ? 'CORE 19' : 'EXTENDED'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular font-semibold text-indigo-600">
                      {desc.primaryKey}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono-tabular font-bold text-slate-900">
                      {count}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          data-testid={`btn-export-csv-${desc.key}`}
                          onClick={() => handleExportTableCsv(desc.key)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono-tabular font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          <Download className="w-3 h-3 text-slate-500" />
                          <span>CSV</span>
                        </button>
                        <button
                          type="button"
                          data-testid={`btn-export-excel-${desc.key}`}
                          onClick={() => handleExportTableExcel(desc.key)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-mono-tabular font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                          <span>Excel (.xls)</span>
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

      {/* =========================================================================
          6. PROTECTED SEED RESTORE CARD (PRESERVED EXISTING FEATURE WITH SAFETY GUARD)
      ========================================================================= */}
      <div className="p-5 rounded-2xl bg-rose-50/40 border border-rose-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
            <RotateCcw className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-rose-950 font-khmer-body">
              កំណត់ទិន្នន័យដើមឡើងវិញ (Factory Seed Reset — Protected by Phase 1 Safeguard)
            </h4>
            <p className="text-xs text-rose-800/80 font-khmer-body mt-0.5">
              មុខងារនេះត្រូវបានរក្សាទុក ប៉ុន្តែត្រូវបានការពារដោយប្រព័ន្ធបញ្ជាក់ពីរជាន់ (Two-Step Confirmation) ដើម្បីការពារការច្រឡំលុបការកែប្រែបច្ចុប្បន្ន។
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!confirmSeedReset ? (
            <button
              type="button"
              disabled={!canEditSettings}
              onClick={() => setConfirmSeedReset(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-rose-300 hover:bg-rose-50 disabled:opacity-50 text-rose-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>កំណត់ទិន្នន័យដើមឡើងវិញ (Factory Seed Reset)</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmSeedReset(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold font-khmer-body cursor-pointer"
              >
                បោះបង់ (Cancel)
              </button>
              <button
                type="button"
                onClick={() => {
                  // Auto-save a backup snapshot before resetting so zero data is ever lost
                  handleCreateFullBackup(false);
                  onResetDatabase?.();
                  setConfirmSeedReset(false);
                  onNotify?.({
                    tone: 'info',
                    title: 'បានកំណត់ទិន្នន័យប្រព័ន្ធទៅកាន់ទិន្នន័យដើមឡើងវិញ (Auto-Backup Saved)',
                    description:
                      'ទិន្នន័យមុនពេល Reset ត្រូវបានរក្សាទុកក្នុងប្រវត្តិ Backup ដោយស្វ័យប្រវត្តិ។',
                  });
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold font-khmer-body cursor-pointer"
              >
                បញ្ជាក់ការស្តារទិន្នន័យដើម (Auto-Backup &amp; Reset)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
