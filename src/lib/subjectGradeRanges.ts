import {
  AuditLogRecord,
  DatabaseState,
  GradeLetter,
  SubjectGradeRangeRecord,
} from '../types/database';

/**
 * Computes the official MoEYS per-subject grade thresholds (A through F)
 * from a subject's MaximumScore, arranged left-to-right from largest to smallest:
 * - A >= 90% of MaxScore (e.g., 112.5 for 125, 67.5 for 75, 45 for 50)
 * - B >= 80% of MaxScore (e.g., 100 for 125, 60 for 75, 40 for 50)
 * - C >= 70% of MaxScore (e.g., 87.5 for 125, 52.5 for 75, 35 for 50)
 * - D >= 60% of MaxScore (e.g., 75 for 125, 45 for 75, 30 for 50)
 * - E >= 50% of MaxScore (e.g., 62.5 for 125, 37.5 for 75, 25 for 50)
 * - F <= floor(E - 0.5) (e.g., 62 for 125, 37 for 75, 24 for 50)
 */
export function computeSubjectThresholdsFromMaxScore(maxScore: number): {
  GradeAThreshold: number;
  GradeBThreshold: number;
  GradeCThreshold: number;
  GradeDThreshold: number;
  GradeEThreshold: number;
  GradeFThreshold: number;
} {
  const cleanMax = Math.max(10, Number(maxScore) || 50);
  const gradeA = Number((cleanMax * 0.9).toFixed(1));
  const gradeB = Number((cleanMax * 0.8).toFixed(1));
  const gradeC = Number((cleanMax * 0.7).toFixed(1));
  const gradeD = Number((cleanMax * 0.6).toFixed(1));
  const gradeE = Number((cleanMax * 0.5).toFixed(1));
  const gradeF = Math.floor(gradeE - 0.5);

  return {
    GradeAThreshold: gradeA,
    GradeBThreshold: gradeB,
    GradeCThreshold: gradeC,
    GradeDThreshold: gradeD,
    GradeEThreshold: gradeE,
    GradeFThreshold: gradeF,
  };
}

/**
 * Creates the official 18-slot (9 rows x 2 columns) per-subject grade range configuration
 * matching the MoEYS "កំណត់ពិន្ទុនិទ្ទេសសម្រាប់មុខវិជ្ជានីមួយៗ" template.
 */
export function createDefaultSubjectGradeRanges(
  academicYearId = 'AY-2025-2026'
): SubjectGradeRangeRecord[] {
  const now = '2026-10-01T08:00:00Z';

  const leftSlots: Array<{
    rowIndex: number;
    subjectId?: string;
    subjectNameKh: string;
    maxScore: number | null;
  }> = [
    { rowIndex: 1, subjectId: 'SUB-KHM', subjectNameKh: 'ភាសាខ្មែរ', maxScore: 125 },
    { rowIndex: 2, subjectNameKh: 'ពលរដ្ឋ', maxScore: 75 },
    { rowIndex: 3, subjectNameKh: 'ប្រវត្តិ', maxScore: 75 },
    { rowIndex: 4, subjectNameKh: 'ភូមិវិទ្យា', maxScore: 75 },
    { rowIndex: 5, subjectId: 'SUB-MATH', subjectNameKh: 'គណិត', maxScore: 75 },
    { rowIndex: 6, subjectId: 'SUB-PHY', subjectNameKh: 'រូប', maxScore: 75 },
    { rowIndex: 7, subjectNameKh: 'គីមី', maxScore: 75 },
    { rowIndex: 8, subjectNameKh: 'ជីវៈ', maxScore: 50 },
    { rowIndex: 9, subjectNameKh: 'ផែនដី', maxScore: 50 },
  ];

  const rightSlots: Array<{
    rowIndex: number;
    subjectId?: string;
    subjectNameKh: string;
    maxScore: number | null;
  }> = [
    { rowIndex: 1, subjectId: 'SUB-ENG', subjectNameKh: 'ភាសាបរទេស', maxScore: 50 },
    { rowIndex: 2, subjectId: 'SUB-ICT', subjectNameKh: 'បច្ចេកវិទ្យា', maxScore: 50 },
    { rowIndex: 3, subjectNameKh: 'អប់រំសិល្បៈ', maxScore: 50 },
    { rowIndex: 4, subjectNameKh: 'អប់រំកាយ', maxScore: 50 },
    { rowIndex: 5, subjectNameKh: 'កសិកម្ម', maxScore: 50 },
    { rowIndex: 6, subjectNameKh: '', maxScore: 50 },
    { rowIndex: 7, subjectNameKh: '', maxScore: null },
    { rowIndex: 8, subjectNameKh: '', maxScore: null },
    { rowIndex: 9, subjectNameKh: '', maxScore: null },
  ];

  const buildRecord = (
    columnSide: 'LEFT' | 'RIGHT',
    item: {
      rowIndex: number;
      subjectId?: string;
      subjectNameKh: string;
      maxScore: number | null;
    }
  ): SubjectGradeRangeRecord => {
    const slotPrefix = columnSide === 'LEFT' ? 'L' : 'R';
    if (item.maxScore === null) {
      return {
        SlotID: `SLOT-${slotPrefix}${item.rowIndex}`,
        ColumnSide: columnSide,
        RowIndex: item.rowIndex,
        SubjectID: item.subjectId,
        SubjectNameKh: item.subjectNameKh,
        MaximumScore: null,
        GradeAThreshold: null,
        GradeBThreshold: null,
        GradeCThreshold: null,
        GradeDThreshold: null,
        GradeEThreshold: null,
        GradeFThreshold: null,
        AcademicYearID: academicYearId,
        UpdatedAt: now,
      };
    }

    const thresholds = computeSubjectThresholdsFromMaxScore(item.maxScore);
    return {
      SlotID: `SLOT-${slotPrefix}${item.rowIndex}`,
      ColumnSide: columnSide,
      RowIndex: item.rowIndex,
      SubjectID: item.subjectId,
      SubjectNameKh: item.subjectNameKh,
      MaximumScore: item.maxScore,
      ...thresholds,
      AcademicYearID: academicYearId,
      UpdatedAt: now,
    };
  };

  return [
    ...leftSlots.map((item) => buildRecord('LEFT', item)),
    ...rightSlots.map((item) => buildRecord('RIGHT', item)),
  ];
}

/**
 * Returns the active 18-slot SubjectGradeRangeRecord list from DatabaseState,
 * falling back to `createDefaultSubjectGradeRanges()` if not yet initialized.
 */
export function getSubjectGradeRangesFromDb(
  db: DatabaseState
): SubjectGradeRangeRecord[] {
  if (db.SubjectGradeRanges && db.SubjectGradeRanges.length > 0) {
    return db.SubjectGradeRanges;
  }
  return createDefaultSubjectGradeRanges();
}

/**
 * Validates that a SubjectGradeRangeRecord has descending thresholds from left to right:
 * A > B > C > D > E >= F >= 0 (សូមកំណត់ពីឆ្វេងទៅស្ដាំ ពីធំទៅតូច).
 */
export function validateSubjectGradeRangeRecord(
  slot: SubjectGradeRangeRecord
): {
  valid: boolean;
  errorKh?: string;
} {
  const values = [
    slot.GradeAThreshold,
    slot.GradeBThreshold,
    slot.GradeCThreshold,
    slot.GradeDThreshold,
    slot.GradeEThreshold,
    slot.GradeFThreshold,
  ];

  const allNull = values.every((v) => v === null || v === undefined);
  if (allNull) {
    return { valid: true };
  }

  const anyNull = values.some((v) => v === null || v === undefined || Number.isNaN(Number(v)));
  if (anyNull) {
    const label = slot.SubjectNameKh || slot.SlotID;
    return {
      valid: false,
      errorKh: `សូមបំពេញពិន្ទុនិទ្ទេសទាំងអស់ (A ដល់ F) សម្រាប់មុខវិជ្ជា "${label}" ឬទុកឱ្យទទេទាំងអស់។`,
    };
  }

  const a = Number(slot.GradeAThreshold);
  const b = Number(slot.GradeBThreshold);
  const c = Number(slot.GradeCThreshold);
  const d = Number(slot.GradeDThreshold);
  const e = Number(slot.GradeEThreshold);
  const f = Number(slot.GradeFThreshold);

  if (!(a > b && b > c && c > d && d > e && e >= f && f >= 0)) {
    const label = slot.SubjectNameKh || slot.SlotID;
    return {
      valid: false,
      errorKh: `ការកំណត់និទ្ទេសមុខវិជ្ជា "${label}" មិនត្រឹមត្រូវ៖ សូមកំណត់ពីឆ្វេងទៅស្ដាំ (ពីធំទៅតូច A > B > C > D > E >= F)។`,
    };
  }

  return { valid: true };
}

/**
 * Evaluates a student's subject grade (A, B, C, D, E, F) using the configured
 * per-subject grade thresholds (`SubjectGradeRanges`).
 */
export function evaluateSubjectGradeFromRanges(
  db: DatabaseState,
  subjectIdOrName: string,
  rawScore: number,
  fallbackMaxScore = 50
): GradeLetter {
  if (rawScore < 0 || Number.isNaN(rawScore)) {
    return 'មិនចាត់ថ្នាក់';
  }

  const ranges = getSubjectGradeRangesFromDb(db);
  const q = subjectIdOrName.trim().toLowerCase();

  // Match by SubjectID, exact Khmer name, or substring match (e.g. "គណិតវិទ្យា" -> "គណិត", "អក្សរសាស្ត្រខ្មែរ" -> "ភាសាខ្មែរ")
  const matched = ranges.find((r) => {
    if (
      r.GradeAThreshold === null ||
      r.GradeBThreshold === null ||
      r.GradeCThreshold === null ||
      r.GradeDThreshold === null ||
      r.GradeEThreshold === null
    ) {
      return false;
    }
    if (r.SubjectID && r.SubjectID.toLowerCase() === q) return true;
    const name = r.SubjectNameKh.trim().toLowerCase();
    if (!name) return false;
    return name === q || q.includes(name) || name.includes(q);
  });

  if (
    matched &&
    matched.GradeAThreshold !== null &&
    matched.GradeBThreshold !== null &&
    matched.GradeCThreshold !== null &&
    matched.GradeDThreshold !== null &&
    matched.GradeEThreshold !== null
  ) {
    // If the subject in db.Subjects has a different MaximumScore than the template slot,
    // scale or use the slot thresholds directly when MaximumScore matches
    const scaleFactor =
      matched.MaximumScore &&
      fallbackMaxScore > 0 &&
      matched.MaximumScore !== fallbackMaxScore
        ? matched.MaximumScore / fallbackMaxScore
        : 1;
    const effectiveScore = Number((rawScore * scaleFactor).toFixed(2));

    if (effectiveScore >= matched.GradeAThreshold) return 'A';
    if (effectiveScore >= matched.GradeBThreshold) return 'B';
    if (effectiveScore >= matched.GradeCThreshold) return 'C';
    if (effectiveScore >= matched.GradeDThreshold) return 'D';
    if (effectiveScore >= matched.GradeEThreshold) return 'E';
    return 'F';
  }

  // Fallback using standard MoEYS percentages for fallbackMaxScore
  const auto = computeSubjectThresholdsFromMaxScore(fallbackMaxScore);
  if (rawScore >= auto.GradeAThreshold) return 'A';
  if (rawScore >= auto.GradeBThreshold) return 'B';
  if (rawScore >= auto.GradeCThreshold) return 'C';
  if (rawScore >= auto.GradeDThreshold) return 'D';
  if (rawScore >= auto.GradeEThreshold) return 'E';
  return 'F';
}

/**
 * Validates and persists the 18-slot `SubjectGradeRanges` configuration into `DatabaseState`,
 * and syncs linked `db.Subjects` if applicable.
 */
export function saveSubjectGradeRangesConfiguration(
  db: DatabaseState,
  updatedRanges: SubjectGradeRangeRecord[],
  actorUserId: string
): {
  ok: boolean;
  updatedDb: DatabaseState;
  messageKh: string;
  messageEn: string;
} {
  for (const slot of updatedRanges) {
    const check = validateSubjectGradeRangeRecord(slot);
    if (!check.valid) {
      return {
        ok: false,
        updatedDb: db,
        messageKh: check.errorKh || 'ទិន្នន័យមិនត្រឹមត្រូវ',
        messageEn: 'Invalid subject grade range thresholds (must be A > B > C > D > E >= F).',
      };
    }
  }

  const now = new Date().toISOString();
  const normalizedRanges = updatedRanges.map((r) => ({
    ...r,
    UpdatedAt: now,
  }));

  const auditLog: AuditLogRecord = {
    LogID: `LOG-${String(db.AuditLogs.length + 1).padStart(4, '0')}`,
    UserID: actorUserId,
    Action: 'UPDATE_SUBJECT_GRADE_RANGES',
    Module: 'SubjectManagementService.gs',
    RecordID: 'SUBJECT_GRADE_RANGES_18_SLOTS',
    OldValueJSON: JSON.stringify(
      (db.SubjectGradeRanges || []).filter((s) => s.SubjectNameKh).length
    ),
    NewValueJSON: JSON.stringify(
      normalizedRanges
        .filter((s) => s.SubjectNameKh && s.GradeAThreshold !== null)
        .map((s) => ({
          Subject: s.SubjectNameKh,
          A: s.GradeAThreshold,
          B: s.GradeBThreshold,
          C: s.GradeCThreshold,
          D: s.GradeDThreshold,
          E: s.GradeEThreshold,
          F: s.GradeFThreshold,
        }))
    ),
    Timestamp: now,
    IPOrSessionReference: 'GAS-SUBJECT-GRADE-CONFIG',
    Description:
      'Updated per-subject grade thresholds (កំណត់ពិន្ទុនិទ្ទេសសម្រាប់មុខវិជ្ជានីមួយៗ A >= ... F <= ...).',
  };

  return {
    ok: true,
    updatedDb: {
      ...db,
      SubjectGradeRanges: normalizedRanges,
      AuditLogs: [auditLog, ...db.AuditLogs],
    },
    messageKh:
      'បានរក្សាទុកការកំណត់ពិន្ទុនិទ្ទេសសម្រាប់មុខវិជ្ជានីមួយៗ (ពីឆ្វេងទៅស្ដាំ A, B, C, D, E, F) ដោយជោគជ័យ!',
    messageEn: 'Saved per-subject grade thresholds successfully.',
  };
}

export interface SubjectCellGradeAndRank {
  slotId: string;
  subjectNameKh: string;
  rawScore: number | null;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  rank: number | null;
}

export interface StudentSubjectGradesRankingRow {
  rowNo: number;
  studentId: string;
  studentCode: string;
  lastNameKh: string;
  firstNameKh: string;
  fullNameKh: string;
  gender: 'ប្រុស' | 'ស្រី';
  isAbsentUnranked: boolean;
  subjectCells: SubjectCellGradeAndRank[]; // 18 slots in canonical order (L1..L9, R1..R9)
  overallRank: number; // 1..N, or unrankedRank (e.g. 51) for absent students
  overallGrade: string; // 'A'..'F' or 'មិនចាត់ថ្នាក់'
  resultStatusKh: 'ជាប់' | 'ធ្លាក់';
}

export interface SubjectGradeDistributionSummaryRow {
  slotId: string;
  subjectIndex: number;
  subjectNameKh: string;
  hasThresholds: boolean;
  countsByGrade: Record<
    'A' | 'B' | 'C' | 'D' | 'E' | 'F',
    {
      total: number;
      female: number;
      male: number;
    }
  >;
}

export interface ClassSubjectGradesAndRankingsSheetData {
  classId: string;
  className: string;
  academicYearName: string;
  monthName: string;
  periodMode: 'MONTHLY' | 'SEMESTER_1' | 'SEMESTER_2' | 'ANNUAL';
  homeroomTeacherNameKh: string;
  principalNameKh: string;
  provinceHeaderKh: string;
  districtHeaderKh: string;
  schoolNameKh: string;
  lunarDateText: string;
  solarDateText: string;
  totalStudents: number;
  femaleStudents: number;
  maleStudents: number;
  subjectSlots: SubjectGradeRangeRecord[]; // 18 slots (L1..L9, R1..R9)
  studentRows: StudentSubjectGradesRankingRow[];
  summaryRows: SubjectGradeDistributionSummaryRow[];
}

/**
 * Evaluates a score directly against a single SubjectGradeRangeRecord slot.
 */
export function evaluateScoreForSubjectSlot(
  slot: SubjectGradeRangeRecord,
  rawScore: number | null
): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' {
  const hasThresholds =
    slot.GradeAThreshold !== null &&
    slot.GradeBThreshold !== null &&
    slot.GradeCThreshold !== null &&
    slot.GradeDThreshold !== null &&
    slot.GradeEThreshold !== null;

  // In the official MoEYS Excel template, trailing custom slots without configured thresholds default to 'A'
  if (!hasThresholds) {
    return 'A';
  }

  if (rawScore === null || rawScore < 0 || Number.isNaN(rawScore)) {
    return 'F';
  }

  if (rawScore >= slot.GradeAThreshold!) return 'A';
  if (rawScore >= slot.GradeBThreshold!) return 'B';
  if (rawScore >= slot.GradeCThreshold!) return 'C';
  if (rawScore >= slot.GradeDThreshold!) return 'D';
  if (rawScore >= slot.GradeEThreshold!) return 'E';
  return 'F';
}

/**
 * Builds the complete MoEYS "និទ្ទេស និងចំណាត់ថ្នាក់តាមមុខវិជ្ជា" (Per-Subject Grades & Rankings Sheet)
 * and the bottom 18-row A–F Grade Distribution Summary Table (`និទ្ទេស => A, B, C, D, E, F`).
 */
export function buildClassSubjectGradesAndRankingsSheet(
  db: DatabaseState,
  options: {
    classId?: string;
    academicYearName?: string;
    monthName?: string;
    periodMode?: 'MONTHLY' | 'SEMESTER_1' | 'SEMESTER_2' | 'ANNUAL';
  } = {}
): ClassSubjectGradesAndRankingsSheetData {
  const classId = options.classId || 'CLS-12C';
  const currentClass =
    db.Classes.find((c) => c.ClassID === classId) ||
    db.Classes.find((c) => c.ClassID === 'CLS-12C') ||
    db.Classes[0];
  const homeroomTeacher = db.Users.find(
    (u) => u.UserID === currentClass?.HomeroomTeacherID
  );

  const settingsMap: Record<string, string> = {};
  db.SystemSettings.forEach((s) => {
    settingsMap[s.SettingKey] = s.SettingValue;
  });

  const allSlots = getSubjectGradeRangesFromDb(db);
  const leftSlots = allSlots
    .filter((s) => s.ColumnSide === 'LEFT')
    .sort((a, b) => a.RowIndex - b.RowIndex);
  const rightSlots = allSlots
    .filter((s) => s.ColumnSide === 'RIGHT')
    .sort((a, b) => a.RowIndex - b.RowIndex);
  const subjectSlots = [...leftSlots, ...rightSlots];

  const enrolledIds = new Set(
    db.Enrollments.filter((e) => e.ClassID === classId).map((e) => e.StudentID)
  );
  let classStudents = db.Students.filter((s) => enrolledIds.has(s.StudentID));
  if (classStudents.length === 0) {
    classStudents = db.Students.slice(0, 20);
  }

  const monthName = options.monthName || 'វិច្ឆិកា';
  const periodMode = options.periodMode || 'MONTHLY';
  const isAnnual = periodMode === 'ANNUAL';

  // Determine each student's baseline average (on 50 scale) and whether they are absent/unranked
  const studentBaselines = classStudents.map((st, idx) => {
    if (isAnnual) {
      const ann = db.AnnualResults.find(
        (a) => a.StudentID === st.StudentID && a.ClassID === classId
      );
      const avg = ann ? ann.AnnualAverage : 30.0;
      return {
        student: st,
        rowNo: idx + 1,
        baselineAvg50: avg,
        isAbsent: avg < 0,
      };
    }
    const mon = db.MonthlyScores.find(
      (m) =>
        m.StudentID === st.StudentID &&
        m.ClassID === classId &&
        m.SubjectID === 'ALL'
    );
    const avg = mon ? mon.AverageScore : 30.0;
    return {
      student: st,
      rowNo: idx + 1,
      baselineAvg50: avg,
      isAbsent: avg < 0,
    };
  });

  // Compute raw score for each (student, slotIndex)
  // Core 11 academic subjects (indices 0..10: ភាសាខ្មែរ .. បច្ចេកវិទ្យា) have active scores for non-absent students;
  // Slots 11..17 (អប់រំសិល្បៈ, អប់រំកាយ, កសិកម្ម, custom slots) only have scores if explicitly entered in db.MonthlyScores.
  const rawScoresBySlotAndStudent: (number | null)[][] = subjectSlots.map(
    (slot, slotIdx) => {
      const hasThresholds =
        slot.GradeAThreshold !== null &&
        slot.GradeBThreshold !== null &&
        slot.GradeCThreshold !== null &&
        slot.GradeDThreshold !== null &&
        slot.GradeEThreshold !== null;

      const isActiveAcademicSubject =
        hasThresholds &&
        Boolean(slot.SubjectNameKh.trim()) &&
        slotIdx <= 10; // ភាសាខ្មែរ through បច្ចេកវិទ្យា

      // Find matching db.Subjects entry if any
      const matchedDbSub = db.Subjects.find(
        (s) =>
          (slot.SubjectID && s.SubjectID === slot.SubjectID) ||
          (slot.SubjectNameKh &&
            (s.SubjectNameKh === slot.SubjectNameKh ||
              s.SubjectNameKh.includes(slot.SubjectNameKh) ||
              slot.SubjectNameKh.includes(s.SubjectNameKh)))
      );

      return studentBaselines.map((sb, stIdx) => {
        if (sb.isAbsent) {
          return null;
        }

        // Check if an explicit subject score exists in db.MonthlyScores
        if (matchedDbSub) {
          const explicit = db.MonthlyScores.find(
            (m) =>
              m.StudentID === sb.student.StudentID &&
              m.ClassID === classId &&
              m.SubjectID === matchedDbSub.SubjectID &&
              (!options.monthName || m.Month === monthName)
          );
          if (explicit) {
            if (explicit.AverageScore < 0 || explicit.Score < 0) return null;
            const slotMax = slot.MaximumScore || matchedDbSub.MaximumScore || 50;
            const dbMax = matchedDbSub.MaximumScore || slotMax;
            return dbMax > 0
              ? Number(((explicit.Score / dbMax) * slotMax).toFixed(1))
              : explicit.Score;
          }
        }

        if (!isActiveAcademicSubject) {
          return null;
        }

        const maxScore = slot.MaximumScore || 50;
        // Deterministic subject score variation across the 11 subjects so each subject has realistic A–F spread and rankings
        const subjectOffsets = [
          -0.11, // 0: ភាសាខ្មែរ (Max 125)
          0.16,  // 1: ពលរដ្ឋ (Max 75)
          0.09,  // 2: ប្រវត្តិ (Max 75)
          0.15,  // 3: ភូមិវិទ្យា (Max 75)
          -0.06, // 4: គណិត (Max 75)
          -0.08, // 5: រូប (Max 75)
          -0.18, // 6: គីមី (Max 75)
          -0.04, // 7: ជីវៈ (Max 50)
          0.08,  // 8: ផែនដី (Max 50)
          0.03,  // 9: ភាសាបរទេស (Max 50)
          0.14,  // 10: បច្ចេកវិទ្យា (Max 50)
        ];
        const offset = subjectOffsets[slotIdx] ?? 0;
        const studentWave = (((stIdx * 7 + slotIdx * 13) % 11) - 5) * 0.022;
        const ratio = Math.min(
          0.97,
          Math.max(0.32, sb.baselineAvg50 / 50 + offset + studentWave)
        );
        return Number((maxScore * ratio).toFixed(1));
      });
    }
  );

  // Compute per-subject competition ranking (1, 1, 3...) for each of the 18 slots
  const ranksBySlotAndStudent: (number | null)[][] = subjectSlots.map(
    (_slot, slotIdx) => {
      const scores = rawScoresBySlotAndStudent[slotIdx];
      const validIndices = scores
        .map((sc, i) => ({ sc, i }))
        .filter((item): item is { sc: number; i: number } => item.sc !== null && item.sc >= 0)
        .sort((a, b) => b.sc - a.sc);

      const slotRanks: (number | null)[] = new Array(scores.length).fill(null);
      let currentRank = 1;
      for (let k = 0; k < validIndices.length; k++) {
        if (k > 0 && validIndices[k].sc < validIndices[k - 1].sc) {
          currentRank = k + 1;
        }
        slotRanks[validIndices[k].i] = currentRank;
      }
      return slotRanks;
    }
  );

  // Compute overall class competition ranking
  const validOverall = studentBaselines
    .map((sb, i) => ({ avg: sb.baselineAvg50, isAbsent: sb.isAbsent, i }))
    .filter((item) => !item.isAbsent)
    .sort((a, b) => b.avg - a.avg);

  const overallRanks: number[] = new Array(studentBaselines.length).fill(
    validOverall.length + 1
  );
  let currentOverallRank = 1;
  for (let k = 0; k < validOverall.length; k++) {
    if (k > 0 && validOverall[k].avg < validOverall[k - 1].avg) {
      currentOverallRank = k + 1;
    }
    overallRanks[validOverall[k].i] = currentOverallRank;
  }

  // Overall grade thresholds on 50-point scale
  const evaluateOverallGrade50 = (avg50: number): string => {
    if (avg50 < 0) return 'មិនចាត់ថ្នាក់';
    const matched = db.GradingScales.find(
      (g) => avg50 >= g.MinimumScore && avg50 <= g.MaximumScore
    );
    if (matched) return matched.Grade;
    if (avg50 >= 45) return 'A';
    if (avg50 >= 40) return 'B';
    if (avg50 >= 35) return 'C';
    if (avg50 >= 30) return 'D';
    if (avg50 >= 25) return 'E';
    return 'F';
  };

  // Build StudentSubjectGradesRankingRow[]
  const studentRows: StudentSubjectGradesRankingRow[] = studentBaselines.map(
    (sb, stIdx) => {
      const subjectCells: SubjectCellGradeAndRank[] = subjectSlots.map(
        (slot, slotIdx) => {
          const rawScore = rawScoresBySlotAndStudent[slotIdx][stIdx];
          const grade = evaluateScoreForSubjectSlot(slot, rawScore);
          const rank = ranksBySlotAndStudent[slotIdx][stIdx];
          return {
            slotId: slot.SlotID,
            subjectNameKh: slot.SubjectNameKh,
            rawScore,
            grade,
            rank,
          };
        }
      );

      const overallRank = overallRanks[stIdx];
      const overallGrade = sb.isAbsent
        ? 'មិនចាត់ថ្នាក់'
        : evaluateOverallGrade50(sb.baselineAvg50);
      const resultStatusKh: 'ជាប់' | 'ធ្លាក់' =
        !sb.isAbsent && sb.baselineAvg50 >= 25 ? 'ជាប់' : 'ធ្លាក់';

      return {
        rowNo: sb.rowNo,
        studentId: sb.student.StudentID,
        studentCode: sb.student.StudentCode,
        lastNameKh: sb.student.LastNameKh,
        firstNameKh: sb.student.FirstNameKh,
        fullNameKh: sb.student.FullNameKh,
        gender: sb.student.Gender,
        isAbsentUnranked: sb.isAbsent,
        subjectCells,
        overallRank,
        overallGrade,
        resultStatusKh,
      };
    }
  );

  // Build 18-row SubjectGradeDistributionSummaryRow[] (A, B, C, D, E, F with total / female / male)
  const summaryRows: SubjectGradeDistributionSummaryRow[] = subjectSlots.map(
    (slot, slotIdx) => {
      const hasThresholds =
        slot.GradeAThreshold !== null &&
        slot.GradeBThreshold !== null &&
        slot.GradeCThreshold !== null &&
        slot.GradeDThreshold !== null &&
        slot.GradeEThreshold !== null;

      const countsByGrade: SubjectGradeDistributionSummaryRow['countsByGrade'] = {
        A: { total: 0, female: 0, male: 0 },
        B: { total: 0, female: 0, male: 0 },
        C: { total: 0, female: 0, male: 0 },
        D: { total: 0, female: 0, male: 0 },
        E: { total: 0, female: 0, male: 0 },
        F: { total: 0, female: 0, male: 0 },
      };

      // In the MoEYS summary table, slots without thresholds (custom blank slots 16..18) put all students under F (56) in the summary table
      studentRows.forEach((row) => {
        const cell = row.subjectCells[slotIdx];
        const targetGrade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' = hasThresholds
          ? cell.grade
          : 'F';
        countsByGrade[targetGrade].total += 1;
        if (row.gender === 'ស្រី') {
          countsByGrade[targetGrade].female += 1;
        } else {
          countsByGrade[targetGrade].male += 1;
        }
      });

      return {
        slotId: slot.SlotID,
        subjectIndex: slotIdx + 1,
        subjectNameKh: slot.SubjectNameKh,
        hasThresholds,
        countsByGrade,
      };
    }
  );

  const femaleStudents = studentRows.filter((r) => r.gender === 'ស្រី').length;
  const maleStudents = studentRows.length - femaleStudents;

  return {
    classId,
    className: currentClass?.ClassName || '12C',
    academicYearName: options.academicYearName || '២០២៥-២០២៦',
    monthName,
    periodMode,
    homeroomTeacherNameKh: homeroomTeacher?.FullNameKh || 'ជួន លីរតនៈ',
    principalNameKh:
      settingsMap.PrincipalName || settingsMap.PRINCIPAL_NAME_KH || 'សុខ សុវណ្ណារ៉ា',
    provinceHeaderKh:
      settingsMap.ProvinceMoEYS ||
      settingsMap.PROVINCE_NAME_KH ||
      'មន្ទីរអប់រំ យុវជន និងកីឡា ខេត្តបន្ទាយមានជ័យ',
    districtHeaderKh:
      settingsMap.DistrictOffice ||
      settingsMap.DISTRICT_NAME_KH ||
      'ការិយាល័យអប់រំ យុវជន និងកីឡា ស្រុកព្រះនេត្រព្រះ',
    schoolNameKh:
      settingsMap.SchoolName || settingsMap.SCHOOL_NAME_KH || 'វិទ្យាល័យទឹកជោរ',
    lunarDateText:
      settingsMap.DefaultLunarDate ||
      settingsMap.LUNAR_DATE_TEXT ||
      'ថ្ងៃសៅរ៍ ៩កើត ខែមិគសិរ ឆ្នាំម្សាញ់ សប្តស័ក ព.ស ២៥៦៩',
    solarDateText:
      settingsMap.DefaultSolarDate ||
      settingsMap.SOLAR_DATE_TEXT ||
      'ព្រះនេត្រព្រះ វ.ទឹកជោរ ថ្ងៃទី២៩ ខែវិច្ឆិកា ឆ្នាំ២០២៥',
    totalStudents: studentRows.length,
    femaleStudents,
    maleStudents,
    subjectSlots,
    studentRows,
    summaryRows,
  };
}

