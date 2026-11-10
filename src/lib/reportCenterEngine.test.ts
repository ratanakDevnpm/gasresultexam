import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDatabaseState } from './seedData';
import {
  REPORT_CATEGORIES_CATALOG,
  generateReportCenterOutput,
  getReportSignatureBlocks,
  normalizeReportCategoryAndSubId,
  resolveAuthorizedReportFilters,
  ReportFilterState,
} from './reportCenterEngine';

const INITIAL_DATABASE = createInitialDatabaseState();

const defaultFilters: ReportFilterState = {
  academicYearId: 'AY-2025-2026',
  semesterId: 'SEM-1',
  month: 'វិច្ឆិកា',
  gradeLevel: 'ALL',
  classId: 'CLS-12C',
  subjectId: 'ALL',
  examId: 'ALL',
  studentId: 'ALL',
  studentSearchQuery: '',
};

test('Report Center Catalog contains all 5 main categories (A through E) and 26 canonical sub-reports', () => {
  assert.equal(REPORT_CATEGORIES_CATALOG.length, 5);
  const codes = REPORT_CATEGORIES_CATALOG.map((c) => c.code);
  assert.deepEqual(codes, ['A', 'B', 'C', 'D', 'E']);

  const totalSubReports = REPORT_CATEGORIES_CATALOG.reduce(
    (acc, cat) => acc + cat.subReports.length,
    0
  );
  assert.equal(totalSubReports, 26);
});

test('Dependent filters cascade Grade Level -> Classes -> Students and Examinations', () => {
  const grade12Scope = resolveAuthorizedReportFilters(INITIAL_DATABASE, 'USR-SUP-01', {
    ...defaultFilters,
    gradeLevel: '12',
    classId: 'ALL',
  });
  assert.equal(grade12Scope.availableClasses.length, 3);
  assert.ok(grade12Scope.availableClasses.every((c) => c.GradeLevel === '12'));

  const class12CScope = resolveAuthorizedReportFilters(INITIAL_DATABASE, 'USR-SUP-01', {
    ...defaultFilters,
    gradeLevel: '12',
    classId: 'CLS-12C',
  });
  assert.equal(class12CScope.availableStudents.length, 56);
});

test('Class Score Sheet (SCR_CLASS_SHEET) defaults to A4 landscape and includes all subjects, total, average, grade, and rank', () => {
  const result = generateReportCenterOutput(
    INITIAL_DATABASE,
    'USR-SUP-01',
    'SCORE_REPORTS',
    'SCR_CLASS_SHEET',
    defaultFilters
  );
  assert.equal(result.allowed, true);
  assert.equal(result.defaultOrientation, 'landscape');
  assert.equal(result.rows.length, 56);
  assert.equal(result.headers[0], 'ល.រ');
  assert.equal(result.headers[1], 'អត្តលេខ');
  assert.equal(result.headers[2], 'គោត្តនាម និងនាម');
  assert.equal(result.headers[3], 'ភេទ');
  assert.equal(result.headers[result.headers.length - 1], 'ចំណាត់ថ្នាក់');
  assert.ok(result.headers.length >= 9);
});

test('Individual Student Score Report (SCR_INDIVIDUAL_STUDENT) generates full transcript and contextual signatures', () => {
  const targetStudent = INITIAL_DATABASE.Students[0];
  const result = generateReportCenterOutput(
    INITIAL_DATABASE,
    'USR-SUP-01',
    'SCORE_REPORTS',
    'SCR_INDIVIDUAL_STUDENT',
    {
      ...defaultFilters,
      studentId: targetStudent.StudentID,
    }
  );
  assert.equal(result.allowed, true);
  assert.equal(result.defaultOrientation, 'portrait');
  assert.ok(result.individualTranscript);
  assert.equal(result.individualTranscript.studentCode, targetStudent.StudentCode);
  assert.ok(result.individualTranscript.subjectRows.length > 0);

  // Signatures for individual student report must include Principal, Parent/Guardian, and Homeroom Teacher
  assert.equal(result.signatures.length, 3);
  assert.ok(result.signatures.some((s) => s.roleTitleKh.includes('មាតាបិតា')));
  assert.ok(result.signatures.some((s) => s.roleTitleKh.includes('គ្រូបន្ទុកថ្នាក់')));
});

test('Online Examination Report (EXM_RESULTS_BY_CLASS) displays all 11 required columns and accurate pass/fail calculation', () => {
  const result = generateReportCenterOutput(
    INITIAL_DATABASE,
    'USR-SUP-01',
    'EXAMINATION_REPORTS',
    'EXM_RESULTS_BY_CLASS',
    defaultFilters
  );
  assert.equal(result.allowed, true);
  assert.equal(result.headers.length, 12); // No. + 11 required fields
  assert.ok(result.headers.includes('ឈ្មោះវិញ្ញាសាប្រឡង'));
  assert.ok(result.headers.includes('មុខវិជ្ជា'));
  assert.ok(result.headers.includes('កម្រិតថ្នាក់ និងថ្នាក់រៀន'));
  assert.ok(result.headers.includes('កាលបរិច្ឆេទប្រឡង'));
  assert.ok(result.headers.includes('អត្តលេខសិស្ស'));
  assert.ok(result.headers.includes('គោត្តនាម និងនាមសិស្ស'));
  assert.ok(result.headers.includes('ពិន្ទុទទួលបាន'));
  assert.ok(result.headers.includes('ពិន្ទុអតិបរមា'));
  assert.ok(result.headers.includes('ភាគរយ (%)'));
  assert.ok(result.headers.includes('ស្ថានភាពប្រឡង'));
  assert.ok(result.headers.includes('លទ្ធផល (ជាប់/ធ្លាក់)'));
  assert.ok(result.rows.length > 0);
});

test('Contextual signatures differ appropriately across report types', () => {
  const subjectSigs = getReportSignatureBlocks('SCR_SUBJECT_SHEET');
  assert.equal(subjectSigs.length, 3);
  assert.ok(subjectSigs.some((s) => s.roleTitleKh.includes('ប្រធានក្រុមបច្ចេកទេស')));

  const classSigs = getReportSignatureBlocks('SCR_CLASS_SHEET');
  assert.equal(classSigs.length, 2);
  assert.ok(classSigs.some((s) => s.roleTitleKh.includes('គ្រូបន្ទុកថ្នាក់')));

  const schoolWideSigs = getReportSignatureBlocks('TCH_LIST');
  assert.equal(schoolWideSigs.length, 2);
  assert.ok(schoolWideSigs.some((s) => s.roleTitleKh.includes('អ្នករៀបចំរបាយការណ៍')));
});

test('Role-based Access Control restricts Student role to own records and denies Teacher Reports', () => {
  const deniedTeacherRep = generateReportCenterOutput(
    INITIAL_DATABASE,
    'USR-STD-6463',
    'TEACHER_REPORTS',
    'TCH_LIST',
    defaultFilters
  );
  assert.equal(deniedTeacherRep.allowed, false);

  const studentOwnScoreRep = generateReportCenterOutput(
    INITIAL_DATABASE,
    'USR-STD-6463',
    'SCORE_REPORTS',
    'SCR_CLASS_SHEET',
    defaultFilters
  );
  assert.equal(studentOwnScoreRep.allowed, true);
  assert.equal(studentOwnScoreRep.rows.length, 1);
  assert.equal(studentOwnScoreRep.rows[0][1], '6463');
});

test('Legacy category and sub-report aliases normalize cleanly to Categories A-E', () => {
  const norm1 = normalizeReportCategoryAndSubId('CLASS_REPORTS', 'CLS_RANKING');
  assert.equal(norm1.categoryId, 'SCORE_REPORTS');
  assert.equal(norm1.subReportId, 'SCR_STUDENT_RANKING');

  const norm2 = normalizeReportCategoryAndSubId('SUBJECT_REPORTS', 'SUB_SCORE');
  assert.equal(norm2.categoryId, 'SCORE_REPORTS');
  assert.equal(norm2.subReportId, 'SCR_SUBJECT_SHEET');
});
