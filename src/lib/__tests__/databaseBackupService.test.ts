import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDatabaseState } from '../seedData';
import {
  ALL_DATABASE_TABLE_DESCRIPTORS,
  BACKUP_APPLICATION_VERSION,
  BACKUP_SCHEMA_VERSION,
  applyDatabaseBackupRestore,
  computeDatabaseRecordCounts,
  createDatabaseBackupEnvelope,
  generateDatabaseValidationReport,
  inspectRuntimeDataSource,
  parseAndPreviewBackupPayload,
  serializeTableToCsv,
  serializeTableToExcelXml,
} from '../databaseBackupService';

test('Phase 1 Backup: exports complete DatabaseState with all 19 core tables and 6 optional collections (25 tables, 488 records)', () => {
  const db = createInitialDatabaseState();
  const envelope = createDatabaseBackupEnvelope(db, {
    createdByUserId: 'USR-SUP-01',
    note: 'Unit test full snapshot',
  });

  assert.equal(envelope.format, 'TEOKCHOR_LMS_FULL_DATABASE_BACKUP');
  assert.equal(envelope.metadata.applicationVersion, BACKUP_APPLICATION_VERSION);
  assert.equal(envelope.metadata.schemaVersion, BACKUP_SCHEMA_VERSION);
  assert.equal(envelope.metadata.totalTables, 25);
  assert.equal(envelope.metadata.coreTableCount, 19);
  assert.equal(envelope.metadata.optionalCollectionCount, 6);
  assert.equal(envelope.metadata.totalRecords, 488);

  // Verify every single table is preserved in envelope.data and recordCounts
  for (const desc of ALL_DATABASE_TABLE_DESCRIPTORS) {
    assert.ok(Array.isArray(envelope.data[desc.key]), `Table ${desc.key} must be an array`);
    assert.equal(
      envelope.recordCounts[desc.key],
      (db[desc.key] as unknown[]).length,
      `Count mismatch on ${desc.key}`
    );
  }
});

test('Phase 1 Backup: inspectRuntimeDataSource distinguishes in-memory React state from Google Sheets', () => {
  const db = createInitialDatabaseState();
  const report = inspectRuntimeDataSource(db, 2);

  assert.equal(report.mode, 'IN_MEMORY_PREVIEW');
  assert.equal(report.isPersistedToGoogleSheets, false);
  assert.equal(report.coreTableCount, 19);
  assert.equal(report.optionalCollectionCount, 6);
  assert.equal(report.totalTableCount, 25);
  assert.equal(report.totalRecordCount, 488);
  assert.equal(report.localBackupSnapshotsStored, 2);
});

test('Phase 1 Validation Report: detects missing tables, duplicate IDs, and invalid references non-destructively', () => {
  const db = createInitialDatabaseState();
  const baseReport = generateDatabaseValidationReport(db);

  assert.equal(baseReport.totalTablesExpected, 25);
  assert.equal(baseReport.totalTablesPresent, 25);
  assert.equal(baseReport.missingTablesCount, 0);
  assert.equal(baseReport.duplicateIdsCount, 0);
  // Seed data has known cross-grade warnings and unlinked SubjectGradeRanges slots
  assert.equal(baseReport.invalidReferencesCount, 11);
  assert.equal(baseReport.overallStatus, 'VALID_WITH_WARNINGS');

  // Simulate a corrupted payload with a missing table, duplicate StudentID, and broken ClassID FK
  const mutated = JSON.parse(JSON.stringify(db));
  delete mutated.Semesters;
  mutated.Students.push({ ...mutated.Students[0] }); // Duplicate StudentID & StudentCode
  mutated.Enrollments[0].ClassID = 'CLS-NON-EXISTENT';

  const corruptedReport = generateDatabaseValidationReport(mutated);
  assert.equal(corruptedReport.missingTablesCount, 1);
  assert.equal(corruptedReport.missingTables[0].tableKey, 'Semesters');
  assert.ok(corruptedReport.duplicateIdsCount >= 1);
  assert.ok(
    corruptedReport.invalidReferences.some(
      (r) => r.tableKey === 'Enrollments' && r.field === 'ClassID'
    )
  );
  assert.equal(corruptedReport.overallStatus, 'INVALID');
});

test('Phase 1 Restore Preview & Execution: validates and previews backup data and preserves every record, ID, and relationship on restore', () => {
  const originalDb = createInitialDatabaseState();
  const envelope = createDatabaseBackupEnvelope(originalDb, {
    createdByUserId: 'USR-SUP-01',
    note: 'Pre-migration snapshot',
  });
  const jsonString = JSON.stringify(envelope, null, 2);

  // Simulate currentDb having modified state so diff shows up in preview
  const modifiedCurrentDb = createInitialDatabaseState();
  modifiedCurrentDb.Students = modifiedCurrentDb.Students.slice(0, 60);

  const preview = parseAndPreviewBackupPayload(
    jsonString,
    modifiedCurrentDb,
    envelope.metadata.fileName
  );
  assert.equal(preview.ok, true);
  assert.equal(preview.preservesAllCoreTables, true);
  assert.equal(preview.preservesAllOptionalCollections, true);
  assert.equal(preview.totalBackupRecords, 488);
  assert.equal(preview.totalCurrentRecords, 486);

  const studentDiff = preview.tableDiffs.find((d) => d.key === 'Students');
  assert.ok(studentDiff);
  assert.equal(studentDiff.currentCount, 60);
  assert.equal(studentDiff.backupCount, 62);
  assert.equal(studentDiff.delta, 2);

  // Restore and verify all 62 students and all primary IDs are preserved
  const restoredDb = applyDatabaseBackupRestore(preview.envelope!, 'USR-SUP-01');
  const restoredCounts = computeDatabaseRecordCounts(restoredDb);
  assert.equal(restoredCounts.Students, 62);
  assert.equal(restoredDb.Students[0].StudentID, originalDb.Students[0].StudentID);
  assert.equal(restoredCounts.AuditLogs, originalDb.AuditLogs.length + 1);
  assert.equal(restoredDb.AuditLogs[0].Action, 'RESTORE_DATABASE_BACKUP');
});

test('Phase 1 Individual Table Export: exports valid UTF-8 CSV and Excel XML for any table', () => {
  const db = createInitialDatabaseState();

  const csvOut = serializeTableToCsv(db, 'Students');
  assert.equal(csvOut.rowCount, 62);
  assert.ok(csvOut.fileName.endsWith('.csv'));
  assert.ok(csvOut.csvContent.startsWith('\uFEFFStudentID,StudentCode'));

  const xlsOut = serializeTableToExcelXml(db, 'TeacherSubjectAssignments');
  assert.equal(xlsOut.rowCount, 7);
  assert.ok(xlsOut.fileName.endsWith('.xls'));
  assert.ok(xlsOut.excelXmlContent.includes('<Worksheet ss:Name="TeacherSubjectAssignments">'));
  assert.ok(xlsOut.excelXmlContent.includes('ASN-2526-01'));
});
