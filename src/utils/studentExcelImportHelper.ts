import * as XLSX from 'xlsx';
import {
  ClassRecord,
  DisabilityStatusCode,
  GenderKh,
  OrphanStatusCode,
  PovertyLevelCode,
} from '../types/database';
import { OFFICIAL_36_COLUMN_MASTER_ROSTER_HEADERS } from '../lib/schemaDefinitions';

export interface ParsedStudentImportRow {
  rowNumber: number;
  studentCode: string;
  lastNameKh: string;
  firstNameKh: string;
  familyNameEn: string;
  givenNameEn: string;
  gender: GenderKh;
  dateOfBirth: string;
  className: string;
  classId: string;
  previousClass: string;
  previousSchool: string;
  isNewTransfer: boolean;
  isRepeater: boolean;
  birthVillage: string;
  birthCommune: string;
  birthDistrict: string;
  birthProvince: string;
  fatherLastNameKh: string;
  fatherFirstNameKh: string;
  fatherOccupation: string;
  motherLastNameKh: string;
  motherFirstNameKh: string;
  motherOccupation: string;
  currentVillage: string;
  currentCommune: string;
  currentDistrict: string;
  currentProvince: string;
  orphanStatus: OrphanStatusCode;
  disabilityStatus: DisabilityStatusCode;
  povertyLevel: PovertyLevelCode;
  examRoom: string;
  deskNumber: string;
  phone: string;
  remarks: string;
  monthlyAverage: number;
  isValid: boolean;
  validationErrors: string[];
  isDuplicateInDb: boolean;
}

/**
 * Generates sample 36-column rows for the downloadable Excel (.xlsx) and CSV templates.
 */
export function getSample36ColumnTemplateRows(targetClassName = '12C'): Array<Array<string | number>> {
  const prevGrade = targetClassName.replace(/^[0-9]+/, (m) => String(Math.max(6, Number(m) - 1)));
  return [
    [
      1,
      '6801',
      'សំរិទ្ធ',
      'ចាន់ណារ៉ា',
      'សំរិទ្ធ ចាន់ណារ៉ា',
      'SAMRITH',
      'CHANNARA',
      'ស្រី',
      '2009-03-18',
      17,
      targetClassName,
      prevGrade,
      'វិទ្យាល័យទឹកជោរ',
      '',
      '',
      'ទឹកជោរ',
      'ទឹកជោរ',
      'ព្រះនេត្រព្រះ',
      'បន្ទាយមានជ័យ',
      'សំរិទ្ធ',
      'សុខា',
      'កសិករ',
      'កែវ',
      'សុខុម',
      'កសិករ',
      'ទឹកជោរ',
      'ទឹកជោរ',
      'ព្រះនេត្រព្រះ',
      'បន្ទាយមានជ័យ',
      '',
      '',
      'ក២',
      `បន្ទប់-${targetClassName}-1`,
      '1',
      '012 910 201',
      'កំពុងរៀន',
    ],
    [
      2,
      '6802',
      'ហួត',
      'ម៉េងលី',
      'ហួត ម៉េងលី',
      'HUOT',
      'MENGLY',
      'ប្រុស',
      '2009-07-22',
      17,
      targetClassName,
      prevGrade,
      'វិទ្យាល័យទឹកជោរ',
      '',
      '',
      'គោកកី',
      'ទឹកជោរ',
      'ព្រះនេត្រព្រះ',
      'បន្ទាយមានជ័យ',
      'ហួត',
      'សំណាង',
      'អាជីវករ',
      'ចាន់',
      'ម៉ាលី',
      'អាជីវករ',
      'គោកកី',
      'ទឹកជោរ',
      'ព្រះនេត្រព្រះ',
      'បន្ទាយមានជ័យ',
      '1',
      '',
      '',
      `បន្ទប់-${targetClassName}-1`,
      '2',
      '097 820 302',
      'កំពុងរៀន',
    ],
    [
      3,
      '6803',
      'លីម',
      'សុខគា',
      'លីម សុខគា',
      'LIM',
      'SOKKEA',
      'ស្រី',
      '2009-11-05',
      17,
      targetClassName,
      prevGrade,
      'វិទ្យាល័យទឹកជោរ',
      '1',
      '',
      'តាបំ',
      'ទឹកជោរ',
      'ព្រះនេត្រព្រះ',
      'បន្ទាយមានជ័យ',
      'លីម',
      'វណ្ណា',
      'គ្រូបង្រៀន',
      'ស៊ុន',
      'ធីតា',
      'មេផ្ទះ',
      'តាបំ',
      'ទឹកជោរ',
      'ព្រះនេត្រព្រះ',
      'បន្ទាយមានជ័យ',
      '',
      '',
      'ក១',
      `បន្ទប់-${targetClassName}-1`,
      '3',
      '010 554 889',
      'កំពុងរៀន',
    ],
  ];
}

/**
 * Downloads an official 36-Column Excel (.xlsx) workbook with a pre-formatted template sheet
 * and an instructions sheet for Teok Chor High School.
 */
export function downloadStudentExcelTemplate(targetClassName = '12C'): string {
  const khmerHeaders = OFFICIAL_36_COLUMN_MASTER_ROSTER_HEADERS.map((h) => h.khmerHeader);
  const sampleRows = getSample36ColumnTemplateRows(targetClassName);

  const worksheetData = [khmerHeaders, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Configure readable column widths for all 36 columns
  ws['!cols'] = OFFICIAL_36_COLUMN_MASTER_ROSTER_HEADERS.map((h) => {
    if (h.colNumber === 1) return { wch: 6 };
    if (h.colNumber === 2) return { wch: 12 };
    if (h.colNumber === 5) return { wch: 22 };
    if (h.colNumber === 9) return { wch: 15 };
    if (h.colNumber === 35) return { wch: 15 };
    return { wch: 16 };
  });

  // Create a second sheet with Khmer instructions & column dictionary
  const instructionRows = [
    ['សេចក្តីណែនាំសម្រាប់ការបំពេញតារាងទិន្នន័យសិស្ស ៣៦ ជួរឈរ (វិទ្យាល័យទឹកជោរ)'],
    [''],
    ['ជួរឈរទី', 'ឈ្មោះជួរឈរ (Khmer Header)', 'វាលទិន្នន័យក្នុងប្រព័ន្ធ (Database Field)', 'ការណែនាំ និងឧទាហរណ៍'],
    ...OFFICIAL_36_COLUMN_MASTER_ROSTER_HEADERS.map((h) => [
      h.colNumber,
      h.khmerHeader,
      `${h.sheetOrigin}.${h.mappedField}`,
      h.colNumber === 2
        ? 'ចាំបាច់ (Required) - អត្តលេខសិស្សមិនអាចស្ទួនគ្នា (ឧ. 6801)'
        : h.colNumber === 3
          ? 'ចាំបាច់ (Required) - គោត្តនាម ឬត្រកូលសិស្សជាអក្សរខ្មែរ'
          : h.colNumber === 4
            ? 'ចាំបាច់ (Required) - នាមខ្លួនសិស្សជាអក្សរខ្មែរ'
            : h.colNumber === 8
              ? 'ចាំបាច់ (Required) - បំពេញ "ស្រី" ឬ "ប្រុស"'
              : h.colNumber === 9
                ? 'ថ្ងៃខែឆ្នាំកំណើត ទម្រង់ YYYY-MM-DD (ឧ. 2009-03-18) ឬ DD/MM/YYYY'
                : h.colNumber === 11
                  ? 'ឈ្មោះថ្នាក់រៀន ឧ. 7A, 7B, 8A, ..., 12C'
                  : h.colNumber === 30
                    ? 'ស្ថានភាពកំព្រា៖ 1 = កំព្រាឪពុក, 2 = កំព្រាម្តាយ, 3 = កំព្រាទាំងពីរ, ទទេ = ធម្មតា'
                    : h.colNumber === 31
                      ? 'ពិការភាព៖ 4 ឬ ✓ = ពិការ, ទទេ = ធម្មតា'
                      : h.colNumber === 32
                        ? 'កម្រិតក្រីក្រ៖ ក១, ក២, 5, ទទេ = ធម្មតា'
                        : 'បំពេញតាមទិន្នន័យជាក់ស្តែងរបស់សិស្ស',
    ]),
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionRows);
  wsInstructions['!cols'] = [{ wch: 10 }, { wch: 28 }, { wch: 34 }, { wch: 55 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'បញ្ជីសិស្សសរុប_36_ជួរឈរ');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'សេចក្តីណែនាំ_Instructions');

  const filename = `គម្រូតារាងបញ្ជីសិស្ស_36_ជួរឈរ_ថ្នាក់_${targetClassName}_2025_2026.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * Downloads a UTF-8 BOM CSV template of the 36-Column Master Student Roster.
 */
export function downloadStudentCsvTemplate(targetClassName = '12C'): string {
  const khmerHeaders = OFFICIAL_36_COLUMN_MASTER_ROSTER_HEADERS.map((h) => h.khmerHeader);
  const sampleRows = getSample36ColumnTemplateRows(targetClassName);

  const csvLines = [khmerHeaders, ...sampleRows].map((row) =>
    row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
  );

  const csvContent = '\uFEFF' + csvLines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = `គម្រូតារាងបញ្ជីសិស្ស_36_ជួរឈរ_ថ្នាក់_${targetClassName}_2025_2026.csv`;
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}

function normalizeDateString(raw: unknown): string {
  if (!raw) return '2009-01-01';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  const str = String(raw).trim();
  if (!str) return '2009-01-01';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Excel serial number
  const num = Number(str);
  if (!Number.isNaN(num) && num > 20000 && num < 60000) {
    const utcDays = Math.floor(num - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  return '2009-01-01';
}

function normalizeGender(raw: unknown): GenderKh {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'ស្រី' || s === 'ក.' || s === 'f' || s === 'female' || s === 'girl') {
    return 'ស្រី';
  }
  return 'ប្រុស';
}

function normalizeOrphanStatus(raw: unknown): OrphanStatusCode {
  const s = String(raw ?? '').trim();
  if (s === '1' || s.includes('ឪពុក')) return '1';
  if (s === '2' || s.includes('ម្តាយ')) return '2';
  if (s === '3' || s.includes('ទាំងពីរ')) return '3';
  return 'NONE';
}

function normalizeDisabilityStatus(raw: unknown): DisabilityStatusCode {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === '4' || s === '✓' || s === 'true' || s === '1' || s.includes('ពិការ')) {
    return '4';
  }
  return 'NONE';
}

function normalizePovertyLevel(raw: unknown): PovertyLevelCode {
  const s = String(raw ?? '').trim();
  if (s === 'ក១' || s.toUpperCase() === 'K1' || s.includes('កម្រិត១')) return 'ក១';
  if (s === 'ក២' || s.toUpperCase() === 'K2' || s.includes('កម្រិត២')) return 'ក២';
  if (s === '5' || s.includes('ងាយរងគ្រោះ')) return '5';
  return 'NONE';
}

/**
 * Converts a 2D array of rows (from Excel worksheet or pasted TSV/CSV) into validated ParsedStudentImportRow items.
 */
export function mapRawRowsToStudentImportRows(
  rawRows: unknown[][],
  defaultClassId: string,
  existingStudentCodes: Set<string>,
  classes: ClassRecord[]
): ParsedStudentImportRow[] {
  if (!rawRows || rawRows.length === 0) return [];

  const defaultClassObj =
    classes.find((c) => c.ClassID === defaultClassId) || classes[0] || ({ ClassID: 'CLS-12C', ClassName: '12C' } as ClassRecord);

  // Detect if row 0 is a header row
  const firstRowStr = rawRows[0].map((c) => String(c ?? '').trim());
  const isHeaderRow = firstRowStr.some(
    (cell) =>
      cell.includes('អត្តលេខ') ||
      cell.includes('គោត្តនាម') ||
      cell.toLowerCase() === 'studentcode' ||
      cell === 'ល.រ'
  );

  const dataRows = isHeaderRow ? rawRows.slice(1) : rawRows;
  const headerIndexMap: Record<string, number> = {};

  if (isHeaderRow) {
    firstRowStr.forEach((h, idx) => {
      headerIndexMap[h] = idx;
      headerIndexMap[h.toLowerCase()] = idx;
    });
  }

  const getCell = (row: unknown[], colNum1Based: number, aliases: string[]): string => {
    for (const alias of aliases) {
      const mappedIdx = headerIndexMap[alias] ?? headerIndexMap[alias.toLowerCase()];
      if (mappedIdx !== undefined && row[mappedIdx] !== undefined && row[mappedIdx] !== null) {
        return String(row[mappedIdx]).trim();
      }
    }
    const fallbackVal = row[colNum1Based - 1];
    return fallbackVal !== undefined && fallbackVal !== null ? String(fallbackVal).trim() : '';
  };

  const seenCodesInBatch = new Set<string>();
  const results: ParsedStudentImportRow[] = [];

  dataRows.forEach((row, idx) => {
    if (!row || row.every((c) => String(c ?? '').trim() === '')) {
      return;
    }

    const rowNumber = idx + 1;
    let studentCode = getCell(row, 2, ['អត្តលេខ', 'StudentCode', 'Code', 'ID']);
    let lastNameKh = getCell(row, 3, ['គោត្តនាម', 'LastNameKh', 'ត្រកូល']);
    let firstNameKh = getCell(row, 4, ['នាមខ្លួន', 'FirstNameKh', 'ឈ្មោះ']);
    const fullNameCell = getCell(row, 5, ['គោត្តនាម និងនាម', 'FullNameKh', 'ឈ្មោះពេញ']);

    // Support compact 4-8 column pastes if row only has a few columns
    if (row.length <= 8 && !isHeaderRow) {
      studentCode = String(row[0] ?? '').trim();
      lastNameKh = String(row[1] ?? '').trim();
      firstNameKh = String(row[2] ?? '').trim();
    }

    // If LastNameKh / FirstNameKh are empty but FullNameKh is provided, split FullNameKh
    if ((!lastNameKh || !firstNameKh) && fullNameCell) {
      const cleanedFull = fullNameCell.replace(/^ក\.\s*/, '').trim();
      const parts = cleanedFull.split(/\s+/);
      if (!lastNameKh && parts.length >= 1) lastNameKh = parts[0];
      if (!firstNameKh && parts.length >= 2) firstNameKh = parts.slice(1).join(' ');
    }

    const familyNameEn =
      getCell(row, 6, ['ត្រកូលអង់គ្លេស', 'FamilyNameEn']) || lastNameKh.toUpperCase() || 'STUDENT';
    const givenNameEn =
      getCell(row, 7, ['ឈ្មោះអង់គ្លេស', 'GivenNameEn']) || firstNameKh.toUpperCase() || 'IMPORT';
    const genderRaw =
      row.length <= 8 && !isHeaderRow
        ? row[3]
        : getCell(row, 8, ['ភេទ', 'Gender', 'Sex']);
    const gender = normalizeGender(genderRaw);

    const dobRaw =
      row.length <= 8 && !isHeaderRow
        ? row[4]
        : getCell(row, 9, ['ថ្ងៃខែឆ្នាំកំណើត', 'DateOfBirth', 'DOB']);
    const dateOfBirth = normalizeDateString(dobRaw);

    const rawClassName =
      (row.length <= 8 && !isHeaderRow ? String(row[5] ?? '').trim() : '') ||
      getCell(row, 11, ['ថ្នាក់ទី', 'ClassName', 'Class', 'ថ្នាក់']) ||
      defaultClassObj.ClassName;

    const matchedClass = classes.find(
      (c) =>
        c.ClassName.toLowerCase() === rawClassName.toLowerCase() ||
        c.ClassID.toLowerCase() === rawClassName.toLowerCase() ||
        `cls-${rawClassName.toLowerCase()}` === c.ClassID.toLowerCase()
    );
    const classId = matchedClass ? matchedClass.ClassID : defaultClassObj.ClassID;
    const className = matchedClass ? matchedClass.ClassName : rawClassName || defaultClassObj.ClassName;

    const previousClass = getCell(row, 12, ['ថ្នាក់ឆ្នាំមុន', 'PreviousClass']) || '11C';
    const previousSchool = getCell(row, 13, ['មកពីសាលា', 'PreviousSchool']) || 'វិទ្យាល័យទឹកជោរ';
    const isNewTransfer = Boolean(getCell(row, 14, ['សិស្សថ្មី/ផ្ទេរចូល', 'IsNewTransfer']));
    const isRepeater = Boolean(getCell(row, 15, ['ត្រួតថ្នាក់', 'IsRepeater']));

    const birthVillage = getCell(row, 16, ['ភូមិកំណើត', 'BirthVillage']) || 'ទឹកជោរ';
    const birthCommune = getCell(row, 17, ['ឃុំ/សង្កាត់កំណើត', 'BirthCommune']) || 'ទឹកជោរ';
    const birthDistrict = getCell(row, 18, ['ស្រុក/ក្រុងកំណើត', 'BirthDistrict']) || 'ព្រះនេត្រព្រះ';
    const birthProvince = getCell(row, 19, ['ខេត្ត/រាជធានីកំណើត', 'BirthProvince']) || 'បន្ទាយមានជ័យ';

    const fatherLastNameKh = getCell(row, 20, ['ត្រកូលឪពុក', 'FatherLastNameKh']) || lastNameKh;
    const fatherFirstNameKh = getCell(row, 21, ['ឈ្មោះឪពុក', 'FatherFirstNameKh']) || 'សុខា';
    const fatherOccupation = getCell(row, 22, ['មុខរបរឪពុក', 'FatherOccupation']) || 'កសិករ';
    const motherLastNameKh = getCell(row, 23, ['ត្រកូលម្តាយ', 'MotherLastNameKh']) || 'ស៊ឹម';
    const motherFirstNameKh = getCell(row, 24, ['ឈ្មោះម្តាយ', 'MotherFirstNameKh']) || 'សុភា';
    const motherOccupation = getCell(row, 25, ['មុខរបរម្តាយ', 'MotherOccupation']) || 'កសិករ';

    const currentVillage = getCell(row, 26, ['ភូមិបច្ចុប្បន្ន', 'CurrentVillage']) || birthVillage;
    const currentCommune = getCell(row, 27, ['ឃុំបច្ចុប្បន្ន', 'CurrentCommune']) || birthCommune;
    const currentDistrict = getCell(row, 28, ['ស្រុកបច្ចុប្បន្ន', 'CurrentDistrict']) || birthDistrict;
    const currentProvince = getCell(row, 29, ['ខេត្តបច្ចុប្បន្ន', 'CurrentProvince']) || birthProvince;

    const orphanStatus = normalizeOrphanStatus(getCell(row, 30, ['កំព្រា (១,២,៣)', 'OrphanStatus']));
    const disabilityStatus = normalizeDisabilityStatus(getCell(row, 31, ['ពិការ (៤)', 'DisabilityStatus']));
    const povertyLevel = normalizePovertyLevel(getCell(row, 32, ['ក្រីក្រ (ក១/ក២)', 'PovertyLevel']));

    const examRoom = getCell(row, 33, ['បន្ទប់ប្រឡង', 'ExamRoom']) || `បន្ទប់-${className}-1`;
    const deskNumber = getCell(row, 34, ['លេខតុ', 'DeskNumber']) || String(rowNumber);
    const phone =
      (row.length <= 8 && !isHeaderRow ? String(row[6] ?? '').trim() : '') ||
      getCell(row, 35, ['លេខទូរសព្ទ', 'Phone']) ||
      '012 000 000';
    const remarks = getCell(row, 36, ['ផ្សេងៗ', 'Remarks']) || 'កំពុងរៀន';

    const validationErrors: string[] = [];
    if (!studentCode) {
      validationErrors.push('ខ្វះអត្តលេខ (Missing StudentCode)');
    }
    if (!lastNameKh && !firstNameKh) {
      validationErrors.push('ខ្វះគោត្តនាម និងនាមខ្លួន (Missing Name)');
    }
    if (studentCode && seenCodesInBatch.has(studentCode)) {
      validationErrors.push(`អត្តលេខ ${studentCode} ស្ទួនក្នុងឯកសារតែមួយ`);
    }
    if (studentCode) {
      seenCodesInBatch.add(studentCode);
    }

    const isDuplicateInDb = Boolean(studentCode && existingStudentCodes.has(studentCode));

    results.push({
      rowNumber,
      studentCode,
      lastNameKh,
      firstNameKh,
      familyNameEn,
      givenNameEn,
      gender,
      dateOfBirth,
      className,
      classId,
      previousClass,
      previousSchool,
      isNewTransfer,
      isRepeater,
      birthVillage,
      birthCommune,
      birthDistrict,
      birthProvince,
      fatherLastNameKh,
      fatherFirstNameKh,
      fatherOccupation,
      motherLastNameKh,
      motherFirstNameKh,
      motherOccupation,
      currentVillage,
      currentCommune,
      currentDistrict,
      currentProvince,
      orphanStatus,
      disabilityStatus,
      povertyLevel,
      examRoom,
      deskNumber,
      phone,
      remarks,
      monthlyAverage: 38.5,
      isValid: validationErrors.length === 0,
      validationErrors,
      isDuplicateInDb,
    });
  });

  return results;
}

/**
 * Reads an uploaded Excel (.xlsx, .xls) or CSV (.csv) file and parses all student rows.
 */
export async function parseStudentExcelOrCsvFile(
  file: File,
  defaultClassId: string,
  existingStudentCodes: Set<string>,
  classes: ClassRecord[]
): Promise<ParsedStudentImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    raw: false,
  });
  return mapRawRowsToStudentImportRows(rawRows, defaultClassId, existingStudentCodes, classes);
}

/**
 * Parses tab-separated or comma-separated text pasted directly from Excel or Google Sheets.
 */
export function parsePastedSpreadsheetText(
  rawText: string,
  defaultClassId: string,
  existingStudentCodes: Set<string>,
  classes: ClassRecord[]
): ParsedStudentImportRow[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];
  const wb = XLSX.read(trimmed, { type: 'string', raw: false });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[firstSheet], {
    header: 1,
    defval: '',
    raw: false,
  });
  return mapRawRowsToStudentImportRows(rawRows, defaultClassId, existingStudentCodes, classes);
}
