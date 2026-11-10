import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDatabaseState } from './seedData';
import {
  buildClassSubjectGradesAndRankingsSheet,
  computeSubjectThresholdsFromMaxScore,
  createDefaultSubjectGradeRanges,
  evaluateSubjectGradeFromRanges,
  saveSubjectGradeRangesConfiguration,
  validateSubjectGradeRangeRecord,
} from './subjectGradeRanges';

test('createDefaultSubjectGradeRanges builds exact 18-slot MoEYS per-subject grade sheet (9 Left + 9 Right)', () => {
  const ranges = createDefaultSubjectGradeRanges('AY-2025-2026');
  assert.equal(ranges.length, 18);

  const leftSlots = ranges.filter((r) => r.ColumnSide === 'LEFT');
  const rightSlots = ranges.filter((r) => r.ColumnSide === 'RIGHT');
  assert.equal(leftSlots.length, 9);
  assert.equal(rightSlots.length, 9);

  // Verify Row 1 Left: ភាសាខ្មែរ (112.5 >=, 100 >=, 87.5 >=, 75 >=, 62.5 >=, 62 <=)
  const khmer = leftSlots[0];
  assert.equal(khmer.SubjectNameKh, 'ភាសាខ្មែរ');
  assert.equal(khmer.GradeAThreshold, 112.5);
  assert.equal(khmer.GradeBThreshold, 100);
  assert.equal(khmer.GradeCThreshold, 87.5);
  assert.equal(khmer.GradeDThreshold, 75);
  assert.equal(khmer.GradeEThreshold, 62.5);
  assert.equal(khmer.GradeFThreshold, 62);

  // Verify Row 2..7 Left: ពលរដ្ឋ, ប្រវត្តិ, ភូមិវិទ្យា, គណិត, រូប, គីមី (67.5 >=, 60 >=, 52.5 >=, 45 >=, 37.5 >=, 37 <=)
  const expected75Subjects = ['ពលរដ្ឋ', 'ប្រវត្តិ', 'ភូមិវិទ្យា', 'គណិត', 'រូប', 'គីមី'];
  expected75Subjects.forEach((name, idx) => {
    const slot = leftSlots[idx + 1];
    assert.equal(slot.SubjectNameKh, name);
    assert.equal(slot.GradeAThreshold, 67.5);
    assert.equal(slot.GradeBThreshold, 60);
    assert.equal(slot.GradeCThreshold, 52.5);
    assert.equal(slot.GradeDThreshold, 45);
    assert.equal(slot.GradeEThreshold, 37.5);
    assert.equal(slot.GradeFThreshold, 37);
  });

  // Verify Row 8..9 Left: ជីវៈ, ផែនដី (45 >=, 40 >=, 35 >=, 30 >=, 25 >=, 24 <=)
  assert.equal(leftSlots[7].SubjectNameKh, 'ជីវៈ');
  assert.equal(leftSlots[7].GradeAThreshold, 45);
  assert.equal(leftSlots[7].GradeFThreshold, 24);
  assert.equal(leftSlots[8].SubjectNameKh, 'ផែនដី');
  assert.equal(leftSlots[8].GradeAThreshold, 45);
  assert.equal(leftSlots[8].GradeFThreshold, 24);

  // Verify Right Column: ភាសាបរទេស, បច្ចេកវិទ្យា, អប់រំសិល្បៈ, អប់រំកាយ, កសិកម្ម
  const expectedRight50 = ['ភាសាបរទេស', 'បច្ចេកវិទ្យា', 'អប់រំសិល្បៈ', 'អប់រំកាយ', 'កសិកម្ម'];
  expectedRight50.forEach((name, idx) => {
    const slot = rightSlots[idx];
    assert.equal(slot.SubjectNameKh, name);
    assert.equal(slot.GradeAThreshold, 45);
    assert.equal(slot.GradeBThreshold, 40);
    assert.equal(slot.GradeCThreshold, 35);
    assert.equal(slot.GradeDThreshold, 30);
    assert.equal(slot.GradeEThreshold, 25);
    assert.equal(slot.GradeFThreshold, 24);
  });
});

test('computeSubjectThresholdsFromMaxScore and validateSubjectGradeRangeRecord enforce left-to-right descending order', () => {
  const t125 = computeSubjectThresholdsFromMaxScore(125);
  assert.deepEqual(t125, {
    GradeAThreshold: 112.5,
    GradeBThreshold: 100,
    GradeCThreshold: 87.5,
    GradeDThreshold: 75,
    GradeEThreshold: 62.5,
    GradeFThreshold: 62,
  });

  const ranges = createDefaultSubjectGradeRanges();
  assert.equal(validateSubjectGradeRangeRecord(ranges[0]).valid, true);

  // Invalid order where B >= A should fail validation
  const brokenSlot = {
    ...ranges[0],
    GradeAThreshold: 90,
    GradeBThreshold: 100,
  };
  const check = validateSubjectGradeRangeRecord(brokenSlot);
  assert.equal(check.valid, false);
  assert.ok(check.errorKh?.includes('ពីធំទៅតូច'));
});

test('evaluateSubjectGradeFromRanges and saveSubjectGradeRangesConfiguration persist and evaluate subject grades', () => {
  const db = createInitialDatabaseState();

  assert.equal(evaluateSubjectGradeFromRanges(db, 'ភាសាខ្មែរ', 115, 125), 'A');
  assert.equal(evaluateSubjectGradeFromRanges(db, 'ភាសាខ្មែរ', 102, 125), 'B');
  assert.equal(evaluateSubjectGradeFromRanges(db, 'ភាសាខ្មែរ', 88, 125), 'C');
  assert.equal(evaluateSubjectGradeFromRanges(db, 'ភាសាខ្មែរ', 75, 125), 'D');
  assert.equal(evaluateSubjectGradeFromRanges(db, 'ភាសាខ្មែរ', 62.5, 125), 'E');
  assert.equal(evaluateSubjectGradeFromRanges(db, 'ភាសាខ្មែរ', 62, 125), 'F');

  const updated = db.SubjectGradeRanges!.map((slot) =>
    slot.SlotID === 'SLOT-L1'
      ? { ...slot, GradeAThreshold: 115 }
      : slot
  );
  const saveRes = saveSubjectGradeRangesConfiguration(db, updated, 'USR-SUP-01');
  assert.equal(saveRes.ok, true);
  assert.equal(
    evaluateSubjectGradeFromRanges(saveRes.updatedDb, 'ភាសាខ្មែរ', 113, 125),
    'B'
  );
});

test('buildClassSubjectGradesAndRankingsSheet generates 56 student rows, 18 subject columns, and 18 A-F summary rows', () => {
  const db = createInitialDatabaseState();
  const sheet = buildClassSubjectGradesAndRankingsSheet(db, {
    classId: 'CLS-12C',
    academicYearName: '២០២៥-២០២៦',
    monthName: 'វិច្ឆិកា',
    periodMode: 'MONTHLY',
  });

  assert.equal(sheet.className, '12C');
  assert.equal(sheet.totalStudents, 56);
  assert.equal(sheet.femaleStudents, 26);
  assert.equal(sheet.maleStudents, 30);
  assert.equal(sheet.subjectSlots.length, 18);
  assert.equal(sheet.studentRows.length, 56);
  assert.equal(sheet.summaryRows.length, 18);

  // Top ranked student (5187 រឺ យូរៀន) should be overallRank 1, Pass 'ជាប់', and have 18 subjectCells
  const topStudent = sheet.studentRows.find((r) => r.studentCode === '5187');
  assert.ok(topStudent);
  assert.equal(topStudent.overallRank, 1);
  assert.equal(topStudent.resultStatusKh, 'ជាប់');
  assert.equal(topStudent.subjectCells.length, 18);
  assert.ok(topStudent.subjectCells[0].rank !== null);

  // Absent student (6628) should have overallRank 51, overallGrade 'មិនចាត់ថ្នាក់', resultStatusKh 'ធ្លាក់'
  const absentStudent = sheet.studentRows.find((r) => r.studentCode === '6628');
  assert.ok(absentStudent);
  assert.equal(absentStudent.isAbsentUnranked, true);
  assert.equal(absentStudent.overallRank, 51);
  assert.equal(absentStudent.overallGrade, 'មិនចាត់ថ្នាក់');
  assert.equal(absentStudent.resultStatusKh, 'ធ្លាក់');
  assert.equal(absentStudent.subjectCells[0].grade, 'F');
  assert.equal(absentStudent.subjectCells[0].rank, null);
  assert.equal(absentStudent.subjectCells[15].grade, 'A');

  // Every summary row's total across A..F must equal 56 (totalStudents), and female + male = total
  sheet.summaryRows.forEach((sRow) => {
    const grades: ('A' | 'B' | 'C' | 'D' | 'E' | 'F')[] = ['A', 'B', 'C', 'D', 'E', 'F'];
    let sumTotal = 0;
    grades.forEach((g) => {
      const c = sRow.countsByGrade[g];
      assert.equal(c.female + c.male, c.total);
      sumTotal += c.total;
    });
    assert.equal(sumTotal, 56);
  });
});

