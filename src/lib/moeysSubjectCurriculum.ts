import { DatabaseState, SubjectRecord } from '../types/database';

export type MoeysGradeNumber = '7' | '8' | '9' | '10' | '11' | '12';
export type MoeysTrackType = 'COMMON' | 'SCIENCE' | 'SOCIAL';

export interface GradeSubjectSpec {
  coefficient: number; // មេគុណ (ឧ. 1.0, 1.5, 2.0, 2.5)
  maxScore: number; // ពិន្ទុអតិបរមា (ឧ. 50, 75, 100, 125) -> 1 មេគុណ = 50 ពិន្ទុ
  passingScore: number; // ពិន្ទុជាប់មធ្យមភាគ (50% នៃពិន្ទុអតិបរមា)
  weeklyHours: number; // ចំនួនម៉ោងសិក្សាក្នុង ១ សប្ដាហ៍
}

export interface MoeysSubjectCurriculumItem {
  orderNumber: number;
  subjectId: string;
  subjectCode: string;
  shortCode: string;
  subjectNameKh: string;
  subjectNameEn: string;
  categoryKh: 'មុខវិជ្ជាគោល' | 'វិទ្យាសាស្ត្រពិត' | 'វិទ្យាសាស្ត្រសង្គម' | 'ភាសា និងបច្ចេកវិទ្យា' | 'អប់រំកាយ និងបំណិន';
  grade7: GradeSubjectSpec;
  grade8: GradeSubjectSpec;
  grade9: GradeSubjectSpec;
  grade10: GradeSubjectSpec;
  grade11Science: GradeSubjectSpec;
  grade11Social: GradeSubjectSpec;
  grade12Science: GradeSubjectSpec;
  grade12Social: GradeSubjectSpec;
}

function spec(coefficient: number, weeklyHours: number): GradeSubjectSpec {
  const maxScore = Math.round(coefficient * 50);
  return {
    coefficient,
    maxScore,
    passingScore: Number((maxScore / 2).toFixed(1)),
    weeklyHours,
  };
}

/**
 * កម្មវិធីសិក្សាផ្លូវការ មុខវិជ្ជា ពិន្ទុអតិបរមា ចំនួនម៉ោង និងមេគុណ (តួចែក)
 * សម្រាប់មធ្យមសិក្សាចំណេះទូទៅ (ថ្នាក់ទី ៧, ៨, ៩, ១០, ១១, ១២)
 * តាមការណែនាំរបស់ក្រសួងអប់រំ យុវជន និងកីឡា (MoEYS)
 * គោលការណ៍គណនា៖ ១ មេគុណ = ៥០ ពិន្ទុ (មធ្យមភាគប្រចាំខែ/ឆមាស គិតលើមាត្រដ្ឋាន ៥០ ពិន្ទុ)
 */
export const MOEYS_GRADES_7_TO_12_CURRICULUM: MoeysSubjectCurriculumItem[] = [
  {
    orderNumber: 1,
    subjectId: 'SUB-KHM',
    subjectCode: 'KHM',
    shortCode: 'K',
    subjectNameKh: 'អក្សរសាស្ត្រខ្មែរ',
    subjectNameEn: 'Khmer Literature',
    categoryKh: 'មុខវិជ្ជាគោល',
    grade7: spec(2.0, 6), // 100 ពិន្ទុ (មេគុណ 2.0)
    grade8: spec(2.0, 6), // 100 ពិន្ទុ (មេគុណ 2.0)
    grade9: spec(2.0, 6), // 100 ពិន្ទុ (មេគុណ 2.0)
    grade10: spec(2.5, 5), // 125 ពិន្ទុ (មេគុណ 2.5)
    grade11Science: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade11Social: spec(2.5, 6), // 125 ពិន្ទុ (មេគុណ 2.5)
    grade12Science: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade12Social: spec(2.5, 6), // 125 ពិន្ទុ (មេគុណ 2.5)
  },
  {
    orderNumber: 2,
    subjectId: 'SUB-MATH',
    subjectCode: 'MATH',
    shortCode: 'M',
    subjectNameKh: 'គណិតវិទ្យា',
    subjectNameEn: 'Mathematics',
    categoryKh: 'មុខវិជ្ជាគោល',
    grade7: spec(2.0, 6), // 100 ពិន្ទុ (មេគុណ 2.0)
    grade8: spec(2.0, 6), // 100 ពិន្ទុ (មេគុណ 2.0)
    grade9: spec(2.0, 6), // 100 ពិន្ទុ (មេគុណ 2.0)
    grade10: spec(2.5, 6), // 125 ពិន្ទុ (មេគុណ 2.5)
    grade11Science: spec(2.5, 6), // 125 ពិន្ទុ (មេគុណ 2.5)
    grade11Social: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade12Science: spec(2.5, 6), // 125 ពិន្ទុ (មេគុណ 2.5)
    grade12Social: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
  },
  {
    orderNumber: 3,
    subjectId: 'SUB-ENG',
    subjectCode: 'ENG',
    shortCode: 'E',
    subjectNameKh: 'ភាសាអង់គ្លេស',
    subjectNameEn: 'English Language',
    categoryKh: 'ភាសា និងបច្ចេកវិទ្យា',
    grade7: spec(1.0, 4), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade8: spec(1.0, 4),
    grade9: spec(1.0, 4),
    grade10: spec(1.0, 4),
    grade11Science: spec(1.0, 4),
    grade11Social: spec(1.0, 4),
    grade12Science: spec(1.0, 4),
    grade12Social: spec(1.0, 4),
  },
  {
    orderNumber: 4,
    subjectId: 'SUB-PHY',
    subjectCode: 'PHY',
    shortCode: 'P',
    subjectNameKh: 'រូបវិទ្យា',
    subjectNameEn: 'Physics',
    categoryKh: 'វិទ្យាសាស្ត្រពិត',
    grade7: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade8: spec(1.0, 2),
    grade9: spec(1.0, 2),
    grade10: spec(1.5, 3), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade11Science: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade11Social: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade12Science: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade12Social: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
  },
  {
    orderNumber: 5,
    subjectId: 'SUB-CHM',
    subjectCode: 'CHM',
    shortCode: 'C',
    subjectNameKh: 'គីមីវិទ្យា',
    subjectNameEn: 'Chemistry',
    categoryKh: 'វិទ្យាសាស្ត្រពិត',
    grade7: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade8: spec(1.0, 2),
    grade9: spec(1.0, 2),
    grade10: spec(1.5, 2), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade11Science: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade11Social: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade12Science: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade12Social: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
  },
  {
    orderNumber: 6,
    subjectId: 'SUB-BIO',
    subjectCode: 'BIO',
    shortCode: 'B',
    subjectNameKh: 'ជីវវិទ្យា',
    subjectNameEn: 'Biology',
    categoryKh: 'វិទ្យាសាស្ត្រពិត',
    grade7: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade8: spec(1.0, 2),
    grade9: spec(1.0, 2),
    grade10: spec(1.5, 3), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade11Science: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade11Social: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade12Science: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade12Social: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
  },
  {
    orderNumber: 7,
    subjectId: 'SUB-ESS',
    subjectCode: 'ESS',
    shortCode: 'ES',
    subjectNameKh: 'ផែនដី និងបរិស្ថានវិទ្យា',
    subjectNameEn: 'Earth & Environmental Science',
    categoryKh: 'វិទ្យាសាស្ត្រពិត',
    grade7: spec(1.0, 1), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade8: spec(1.0, 1),
    grade9: spec(1.0, 1),
    grade10: spec(1.0, 2),
    grade11Science: spec(1.0, 2),
    grade11Social: spec(1.0, 2),
    grade12Science: spec(1.0, 2),
    grade12Social: spec(1.0, 2),
  },
  {
    orderNumber: 8,
    subjectId: 'SUB-MOR',
    subjectCode: 'MOR',
    shortCode: 'MC',
    subjectNameKh: 'សីលធម៌-ពលរដ្ឋវិជ្ជា',
    subjectNameEn: 'Moral & Civics Education',
    categoryKh: 'វិទ្យាសាស្ត្រសង្គម',
    grade7: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade8: spec(1.0, 2),
    grade9: spec(1.0, 2),
    grade10: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade11Science: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade11Social: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade12Science: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade12Social: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
  },
  {
    orderNumber: 9,
    subjectId: 'SUB-HIS',
    subjectCode: 'HIS',
    shortCode: 'H',
    subjectNameKh: 'ប្រវត្តិវិទ្យា',
    subjectNameEn: 'History',
    categoryKh: 'វិទ្យាសាស្ត្រសង្គម',
    grade7: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade8: spec(1.0, 2),
    grade9: spec(1.0, 2),
    grade10: spec(1.0, 2),
    grade11Science: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade11Social: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade12Science: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade12Social: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
  },
  {
    orderNumber: 10,
    subjectId: 'SUB-GEO',
    subjectCode: 'GEO',
    shortCode: 'G',
    subjectNameKh: 'ភូមិវិទ្យា',
    subjectNameEn: 'Geography',
    categoryKh: 'វិទ្យាសាស្ត្រសង្គម',
    grade7: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade8: spec(1.0, 2),
    grade9: spec(1.0, 2),
    grade10: spec(1.0, 2),
    grade11Science: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade11Social: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
    grade12Science: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade12Social: spec(1.5, 4), // 75 ពិន្ទុ (មេគុណ 1.5)
  },
  {
    orderNumber: 11,
    subjectId: 'SUB-ICT',
    subjectCode: 'ICT',
    shortCode: 'ICT',
    subjectNameKh: 'ព័ត៌មានវិទ្យា (ICT)',
    subjectNameEn: 'Information & Communication Technology',
    categoryKh: 'ភាសា និងបច្ចេកវិទ្យា',
    grade7: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade8: spec(1.0, 2),
    grade9: spec(1.0, 2),
    grade10: spec(1.0, 2),
    grade11Science: spec(1.0, 2),
    grade11Social: spec(1.0, 2),
    grade12Science: spec(1.0, 2),
    grade12Social: spec(1.0, 2),
  },
  {
    orderNumber: 12,
    subjectId: 'SUB-PE',
    subjectCode: 'PE',
    shortCode: 'S',
    subjectNameKh: 'អប់រំកាយ និងកីឡា',
    subjectNameEn: 'Physical Education & Sports',
    categoryKh: 'អប់រំកាយ និងបំណិន',
    grade7: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade8: spec(1.0, 2),
    grade9: spec(1.0, 2),
    grade10: spec(1.0, 2),
    grade11Science: spec(1.0, 2),
    grade11Social: spec(1.0, 2),
    grade12Science: spec(1.0, 2),
    grade12Social: spec(1.0, 2),
  },
  {
    orderNumber: 13,
    subjectId: 'SUB-HEC',
    subjectCode: 'HEC',
    shortCode: 'HE',
    subjectNameKh: 'គេហវិទ្យា / អប់រំសិល្បៈ',
    subjectNameEn: 'Home Economics & Arts Education',
    categoryKh: 'អប់រំកាយ និងបំណិន',
    grade7: spec(1.0, 2), // 50 ពិន្ទុ (មេគុណ 1.0)
    grade8: spec(1.0, 2),
    grade9: spec(1.0, 2),
    grade10: spec(1.0, 1),
    grade11Science: spec(1.0, 1),
    grade11Social: spec(1.0, 1),
    grade12Science: spec(1.0, 1),
    grade12Social: spec(1.0, 1),
  },
];

export type MoeysCurriculumColumnKey =
  | 'G7'
  | 'G8'
  | 'G9'
  | 'G10'
  | 'G11_SCI'
  | 'G11_SOC'
  | 'G12_SCI'
  | 'G12_SOC';

export const MOEYS_CURRICULUM_COLUMNS: Array<{
  key: MoeysCurriculumColumnKey;
  gradeLevelLabelKh: string;
  shortLabelKh: string;
  gradeValue: string;
  trackLabelKh: string;
}> = [
  {
    key: 'G7',
    gradeLevelLabelKh: 'ថ្នាក់ទី ៧',
    shortLabelKh: 'ទី៧',
    gradeValue: '7',
    trackLabelKh: 'បឋមភូមិ',
  },
  {
    key: 'G8',
    gradeLevelLabelKh: 'ថ្នាក់ទី ៨',
    shortLabelKh: 'ទី៨',
    gradeValue: '8',
    trackLabelKh: 'បឋមភូមិ',
  },
  {
    key: 'G9',
    gradeLevelLabelKh: 'ថ្នាក់ទី ៩',
    shortLabelKh: 'ទី៩',
    gradeValue: '9',
    trackLabelKh: 'បឋមភូមិ',
  },
  {
    key: 'G10',
    gradeLevelLabelKh: 'ថ្នាក់ទី ១០',
    shortLabelKh: 'ទី១០',
    gradeValue: '10',
    trackLabelKh: 'ទុតិយភូមិ (រួម)',
  },
  {
    key: 'G11_SCI',
    gradeLevelLabelKh: 'ថ្នាក់ទី ១១ (វិទ្យាសាស្ត្រ)',
    shortLabelKh: 'ទី១១ (វិទ្យាសាស្ត្រ)',
    gradeValue: '11',
    trackLabelKh: 'វិទ្យាសាស្ត្រ',
  },
  {
    key: 'G11_SOC',
    gradeLevelLabelKh: 'ថ្នាក់ទី ១១ (សង្គម)',
    shortLabelKh: 'ទី១១ (សង្គម)',
    gradeValue: '11',
    trackLabelKh: 'វិទ្យាសាស្ត្រសង្គម',
  },
  {
    key: 'G12_SCI',
    gradeLevelLabelKh: 'ថ្នាក់ទី ១២ (វិទ្យាសាស្ត្រ)',
    shortLabelKh: 'ទី១២ (វិទ្យាសាស្ត្រ)',
    gradeValue: '12',
    trackLabelKh: 'វិទ្យាសាស្ត្រ',
  },
  {
    key: 'G12_SOC',
    gradeLevelLabelKh: 'ថ្នាក់ទី ១២ (សង្គម)',
    shortLabelKh: 'ទី១២ (សង្គម)',
    gradeValue: '12',
    trackLabelKh: 'វិទ្យាសាស្ត្រសង្គម',
  },
];

export function getSpecForColumn(
  item: MoeysSubjectCurriculumItem,
  colKey: MoeysCurriculumColumnKey
): GradeSubjectSpec {
  switch (colKey) {
    case 'G7':
      return item.grade7;
    case 'G8':
      return item.grade8;
    case 'G9':
      return item.grade9;
    case 'G10':
      return item.grade10;
    case 'G11_SCI':
      return item.grade11Science;
    case 'G11_SOC':
      return item.grade11Social;
    case 'G12_SCI':
      return item.grade12Science;
    case 'G12_SOC':
      return item.grade12Social;
  }
}

/**
 * អនុវត្តមុខវិជ្ជា ពិន្ទុអតិបរមា និងមេគុណតាមស្តង់ដារក្រសួងអប់រំ យុវជន និងកីឡា
 * សម្រាប់កម្រិតថ្នាក់ដែលបានជ្រើសរើស ទៅក្នុង `db.Subjects`។
 */
export function applyMoeysCurriculumPresetToDatabase(
  db: DatabaseState,
  colKey: MoeysCurriculumColumnKey
): {
  updatedDb: DatabaseState;
  messageKh: string;
} {
  const colMeta =
    MOEYS_CURRICULUM_COLUMNS.find((c) => c.key === colKey) || MOEYS_CURRICULUM_COLUMNS[0];
  const now = new Date().toISOString();

  const existingById = new Map<string, SubjectRecord>(
    db.Subjects.map((s) => [s.SubjectID, s])
  );

  const nextSubjects: SubjectRecord[] = [...db.Subjects];

  MOEYS_GRADES_7_TO_12_CURRICULUM.forEach((item) => {
    const gradeSpec = getSpecForColumn(item, colKey);
    const existing = existingById.get(item.subjectId);
    if (existing) {
      const idx = nextSubjects.findIndex((s) => s.SubjectID === item.subjectId);
      if (idx !== -1) {
        nextSubjects[idx] = {
          ...existing,
          GradeLevel: colMeta.gradeValue,
          Coefficient: gradeSpec.coefficient,
          MaximumScore: gradeSpec.maxScore,
          PassingScore: gradeSpec.passingScore,
          Status: 'ACTIVE',
        };
      }
    } else {
      nextSubjects.push({
        SubjectID: item.subjectId,
        SubjectCode: `${item.subjectCode}-${colMeta.gradeValue}`,
        SubjectNameKh: item.subjectNameKh,
        SubjectNameEn: item.subjectNameEn,
        GradeLevel: colMeta.gradeValue,
        Coefficient: gradeSpec.coefficient,
        MaximumScore: gradeSpec.maxScore,
        PassingScore: gradeSpec.passingScore,
        AcademicYearID: 'AY-2025-2026',
        SemesterIDs: ['SEM-2526-1', 'SEM-2526-2'],
        Status: 'ACTIVE',
        CreatedAt: now,
      });
    }
  });

  return {
    updatedDb: {
      ...db,
      Subjects: nextSubjects,
    },
    messageKh: `បានរៀបចំ និងធ្វើបច្ចុប្បន្នភាពមុខវិជ្ជាទាំង ${MOEYS_GRADES_7_TO_12_CURRICULUM.length} មុខវិជ្ជា និងមេគុណសម្រាប់ "${colMeta.gradeLevelLabelKh}" តាមការណែនាំរបស់ក្រសួងអប់រំ យុវជន និងកីឡា ដោយជោគជ័យ!`,
  };
}
