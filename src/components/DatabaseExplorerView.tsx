import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ClassRecord,
  DatabaseState,
  GenderKh,
  OrphanStatusCode,
  DisabilityStatusCode,
  PovertyLevelCode,
  SheetName,
  StudentRecord,
  StudentStatusKh,
} from '../types/database';
import {
  DATABASE_SHEETS_SCHEMA,
  OFFICIAL_36_COLUMN_MASTER_ROSTER_HEADERS,
} from '../lib/schemaDefinitions';
import {
  calculateCompetitionRanking,
  calculateStudentAge,
  DEFAULT_STUDENT_INITIAL_PASSWORD,
  formatDateKhmerDisplay,
  hashPasswordSha256,
} from '../lib/domainRules';
import { formatKhmerReportTitle, handleGlobalPrint } from '../utils/printHelper';
import {
  downloadStudentCsvTemplate,
  downloadStudentExcelTemplate,
  getSample36ColumnTemplateRows,
  mapRawRowsToStudentImportRows,
  ParsedStudentImportRow,
  parsePastedSpreadsheetText,
  parseStudentExcelOrCsvFile,
} from '../utils/studentExcelImportHelper';
import { invokeGasApi, isGasEnvironmentAvailable } from '../lib/gasBridge';
import { GAS_BACKEND_MODULES } from '../lib/gasBackendModules';
import { Button, ConfirmationDialog, Modal, Toast } from './ui';
import {
  Database,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Search,
  Table2,
  Download,
  Upload,
  Edit3,
  Trash2,
  GraduationCap,
  Printer,
  Eye,
  Columns,
  X,
  UserCheck,
  Users,
  HeartHandshake,
  MapPin,
  BookOpen,
  User,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Code2,
  Copy,
} from 'lucide-react';

interface DatabaseExplorerViewProps {
  db: DatabaseState;
  setDb?: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  defaultSheet?: SheetName;
  defaultSubTab?: 'LIVE_DATA' | 'SCHEMA_COLUMNS' | 'MASTER_36_ROSTER';
  externalSearchQuery?: string;
  openCreateModalSignal?: number;
  onAddStudentRecord: (payload: {
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
  }) => void;
  onEditStudentRecord?: (
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
    }
  ) => void;
  onDeleteStudentRecord?: (studentId: string) => void;
  onCreateClassRecord?: (payload: {
    className: string;
    gradeLevel: 7 | 8 | 9 | 10 | 11 | 12;
    homeroomTeacherId: string;
    roomNumber: string;
  }) => ClassRecord;
  onResetDatabase: () => void;
}

type DetailTabKey = 'PERSONAL' | 'ACADEMIC' | 'ADDRESS' | 'PARENTS_SOCIAL';

type ColumnGroupKey = 'PERSONAL' | 'ACADEMIC' | 'ADDRESS' | 'PARENTS_SOCIAL';

export const DatabaseExplorerView: React.FC<DatabaseExplorerViewProps> = ({
  db,
  setDb,
  activeUserId,
  defaultSheet = 'Students',
  defaultSubTab = 'MASTER_36_ROSTER',
  externalSearchQuery = '',
  openCreateModalSignal = 0,
  onAddStudentRecord,
  onEditStudentRecord,
  onDeleteStudentRecord,
  onCreateClassRecord,
  onResetDatabase,
}) => {
  const [selectedSheetName, setSelectedSheetName] = useState<SheetName>(defaultSheet);
  const [subTab, setSubTab] = useState<'LIVE_DATA' | 'SCHEMA_COLUMNS' | 'MASTER_36_ROSTER'>(
    defaultSubTab
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [socialFilter, setSocialFilter] = useState<string>('ALL');
  const [genderFilter, setGenderFilter] = useState<string>('ALL');

  // Column visibility & view mode state
  const [showColumnsMenu, setShowColumnsMenu] = useState<boolean>(false);
  const [tableDisplayMode, setTableDisplayMode] = useState<'CLEAN_DEFAULT' | 'FULL_36_COLS'>(
    'CLEAN_DEFAULT'
  );
  const [visibleGroups, setVisibleGroups] = useState<Record<ColumnGroupKey, boolean>>({
    PERSONAL: true,
    ACADEMIC: true,
    ADDRESS: true,
    PARENTS_SOCIAL: true,
  });

  // Pagination state for clean data table
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modals & Drawers
  const [viewingStudent, setViewingStudent] = useState<StudentRecord | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTabKey>('PERSONAL');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [formTab, setFormTab] = useState<DetailTabKey>('PERSONAL');
  const [showImportExcelModal, setShowImportExcelModal] = useState(false);
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [editModalTab, setEditModalTab] = useState<DetailTabKey>('PERSONAL');
  const [deletingStudent, setDeletingStudent] = useState<StudentRecord | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSheetName(defaultSheet);
  }, [defaultSheet]);

  useEffect(() => {
    setSubTab(defaultSubTab);
  }, [defaultSubTab]);

  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setSearchQuery(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  useEffect(() => {
    if (openCreateModalSignal > 0) {
      setFormTab('PERSONAL');
      setShowAddStudentModal(true);
    }
  }, [openCreateModalSignal]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, classFilter, statusFilter, socialFilter, genderFilter, pageSize]);

  // Add Student Form State (All 4 Tabs / 36-Column Coverage)
  const [studentCode, setStudentCode] = useState('');
  const [lastNameKh, setLastNameKh] = useState('');
  const [firstNameKh, setFirstNameKh] = useState('');
  const [familyNameEn, setFamilyNameEn] = useState('');
  const [givenNameEn, setGivenNameEn] = useState('');
  const [gender, setGender] = useState<GenderKh>('ស្រី');
  const [dateOfBirth, setDateOfBirth] = useState('2009-05-15');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('ទឹកជោរ');
  const [commune, setCommune] = useState('ទឹកជោរ');
  const [district, setDistrict] = useState('ព្រះនេត្រព្រះ');
  const [province, setProvince] = useState('បន្ទាយមានជ័យ');
  const [birthVillage, setBirthVillage] = useState('ទឹកជោរ');
  const [birthCommune, setBirthCommune] = useState('ទឹកជោរ');
  const [birthDistrict, setBirthDistrict] = useState('ព្រះនេត្រព្រះ');
  const [birthProvince, setBirthProvince] = useState('បន្ទាយមានជ័យ');
  const [fatherNameKh, setFatherNameKh] = useState('សុខ សំអឿន');
  const [fatherOccupation, setFatherOccupation] = useState('កសិករ');
  const [motherNameKh, setMotherNameKh] = useState('ជា សុផាត');
  const [motherOccupation, setMotherOccupation] = useState('កសិករ');
  const [classId, setClassId] = useState('CLS-12C');
  const [examRoom, setExamRoom] = useState('បន្ទប់-12C');
  const [deskNumber, setDeskNumber] = useState('15');
  const [orphanStatus, setOrphanStatus] = useState<OrphanStatusCode>('NONE');
  const [disabilityStatus, setDisabilityStatus] = useState<DisabilityStatusCode>('NONE');
  const [povertyLevel, setPovertyLevel] = useState<PovertyLevelCode>('NONE');
  const [previousSchool, setPreviousSchool] = useState('វិទឹកជោរ ១១C');
  const [monthlyAverage, setMonthlyAverage] = useState('38.50');

  // Edit Student Form State
  const [editCode, setEditCode] = useState('');
  const [editLastKh, setEditLastKh] = useState('');
  const [editFirstKh, setEditFirstKh] = useState('');
  const [editGender, setEditGender] = useState<GenderKh>('ស្រី');
  const [editDob, setEditDob] = useState('2009-05-15');
  const [editPhone, setEditPhone] = useState('');
  const [editVillage, setEditVillage] = useState('');
  const [editClassId, setEditClassId] = useState('CLS-12C');
  const [editOrphan, setEditOrphan] = useState<OrphanStatusCode>('NONE');
  const [editDisability, setEditDisability] = useState<DisabilityStatusCode>('NONE');
  const [editPoverty, setEditPoverty] = useState<PovertyLevelCode>('NONE');
  const [editStatus, setEditStatus] = useState<StudentStatusKh>('កំពុងរៀន');

  // Create Class Form State
  const [newClassName, setNewClassName] = useState('12D');
  const [newGradeLevel, setNewGradeLevel] = useState<number>(12);
  const [newHomeroomId, setNewHomeroomId] = useState('USR-TCH-12C');
  const [newRoomNumber, setNewRoomNumber] = useState('បន្ទប់-12D');

  // Import CSV/Excel & Google Apps Script Sync State
  const [importTargetClassId, setImportTargetClassId] = useState('CLS-12C');
  const [importModeTab, setImportModeTab] = useState<'FILE_UPLOAD' | 'PASTE_TEXT' | 'GAS_SCRIPT_CODE'>('FILE_UPLOAD');
  const [importedPreviewRows, setImportedPreviewRows] = useState<ParsedStudentImportRow[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [pasteRawText, setPasteRawText] = useState<string>('');
  const [overwriteDuplicates, setOverwriteDuplicates] = useState<boolean>(true);
  const [autoProvisionStudentAccounts, setAutoProvisionStudentAccounts] = useState<boolean>(true);
  const [isSyncingToGas, setIsSyncingToGas] = useState<boolean>(false);
  const [importErrorBanner, setImportErrorBanner] = useState<string | null>(null);
  const [gasEndpointDraft, setGasEndpointDraft] = useState<string>(() => {
    const existing = db.SystemSettings?.find((s) => s.SettingKey === 'GasWebAppEndpoint');
    return existing?.SettingValue || '';
  });
  const [copiedGasScript, setCopiedGasScript] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openEditStudentDialog = (st: StudentRecord) => {
    const enr = db.Enrollments.find((e) => e.StudentID === st.StudentID);
    setEditingStudent(st);
    setEditModalTab('PERSONAL');
    setEditCode(st.StudentCode);
    setEditLastKh(st.LastNameKh);
    setEditFirstKh(st.FirstNameKh);
    setEditGender(st.Gender);
    setEditDob(st.DateOfBirth);
    setEditPhone(st.Phone);
    setEditVillage(st.CurrentVillage);
    setEditClassId(enr?.ClassID || 'CLS-12C');
    setEditOrphan(st.OrphanStatus);
    setEditDisability(st.DisabilityStatus);
    setEditPoverty(st.PovertyLevel);
    setEditStatus(st.StudentStatus);
  };

  const openViewStudentDrawer = (st: StudentRecord) => {
    setViewingStudent(st);
    setDetailTab('PERSONAL');
  };

  const selectedSheetSchema = useMemo(
    () => DATABASE_SHEETS_SCHEMA.find((s) => s.sheetName === selectedSheetName)!,
    [selectedSheetName]
  );

  // Filtered Students for 36-Column Master Roster & Students Sheet
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return db.Students.filter((st) => {
      const enr = db.Enrollments.find((e) => e.StudentID === st.StudentID);
      const cls = db.Classes.find((c) => c.ClassID === enr?.ClassID);
      if (classFilter !== 'ALL') {
        const matchesClassId = enr?.ClassID === classFilter;
        const matchesClassName = cls?.ClassName === classFilter;
        if (!matchesClassId && !matchesClassName) return false;
      }
      if (genderFilter !== 'ALL' && st.Gender !== genderFilter) return false;
      if (statusFilter !== 'ALL' && st.StudentStatus !== statusFilter) return false;
      if (socialFilter !== 'ALL') {
        if (socialFilter === 'ORPHAN' && st.OrphanStatus === 'NONE') return false;
        if (socialFilter === 'DISABILITY' && st.DisabilityStatus === 'NONE') return false;
        if (socialFilter === 'POVERTY' && st.PovertyLevel === 'NONE') return false;
      }
      if (!q) return true;
      return (
        st.StudentCode.toLowerCase().includes(q) ||
        st.FullNameKh.toLowerCase().includes(q) ||
        st.LastNameKh.toLowerCase().includes(q) ||
        st.FirstNameKh.toLowerCase().includes(q) ||
        st.FamilyNameEn.toLowerCase().includes(q) ||
        st.GivenNameEn.toLowerCase().includes(q) ||
        st.CurrentVillage.toLowerCase().includes(q) ||
        st.Phone.toLowerCase().includes(q)
      );
    });
  }, [
    db.Students,
    db.Enrollments,
    db.Classes,
    searchQuery,
    classFilter,
    genderFilter,
    statusFilter,
    socialFilter,
  ]);

  // Roster summary statistics (Total, Female, Studying, Transferred, Orphan, Disability, Poverty)
  const rosterSummary = useMemo(() => {
    const total = filteredStudents.length;
    const female = filteredStudents.filter((s) => s.Gender === 'ស្រី').length;
    const male = total - female;
    const activeStudying = filteredStudents.filter((s) => s.StudentStatus === 'កំពុងរៀន');
    const activeTotal = activeStudying.length;
    const activeFemale = activeStudying.filter((s) => s.Gender === 'ស្រី').length;
    const transferredTotal = filteredStudents.filter((s) => s.StudentStatus === 'ផ្ទេរចេញ').length;
    const orphanCount = filteredStudents.filter((s) => s.OrphanStatus !== 'NONE').length;
    const disabilityCount = filteredStudents.filter((s) => s.DisabilityStatus !== 'NONE').length;
    const povertyCount = filteredStudents.filter((s) => s.PovertyLevel !== 'NONE').length;
    return {
      total,
      female,
      male,
      activeTotal,
      activeFemale,
      transferredTotal,
      orphanCount,
      disabilityCount,
      povertyCount,
    };
  }, [filteredStudents]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  // Active Class metadata for Print Header/Footer
  const activeClassRecord = useMemo(() => {
    if (classFilter === 'ALL') return null;
    return (
      db.Classes.find((c) => c.ClassID === classFilter || c.ClassName === classFilter) || null
    );
  }, [db.Classes, classFilter]);

  const activeHomeroomTeacher = useMemo(() => {
    if (!activeClassRecord) return null;
    return db.Users.find((u) => u.UserID === activeClassRecord.HomeroomTeacherID) || null;
  }, [db.Users, activeClassRecord]);

  const sheetRows = useMemo(() => {
    if (selectedSheetName === 'Students') {
      return filteredStudents as unknown as Array<Record<string, unknown>>;
    }
    const rawRows = (db[selectedSheetName] as unknown as Array<Record<string, unknown>>) || [];
    if (!searchQuery.trim()) return rawRows;
    const q = searchQuery.toLowerCase();
    return rawRows.filter((row) =>
      Object.values(row).some((val) => String(val ?? '').toLowerCase().includes(q))
    );
  }, [db, selectedSheetName, searchQuery, filteredStudents]);

  const handleCreateStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!studentCode.trim() || !lastNameKh.trim() || !firstNameKh.trim() || !dateOfBirth.trim()) {
      setFormError(
        'សូមបំពេញព័ត៌មានចាំបាច់៖ អត្តលេខ គោត្តនាម នាមខ្លួន និងថ្ងៃខែឆ្នាំកំណើត។ (All required fields must be filled)'
      );
      return;
    }

    if (db.Students.some((s) => s.StudentCode === studentCode.trim())) {
      setFormError(`អត្តលេខ ${studentCode.trim()} មាននៅក្នុងប្រព័ន្ធរួចហើយ។ (Duplicate StudentCode)`);
      return;
    }

    const parsedAvg = Number(monthlyAverage);
    if (Number.isNaN(parsedAvg) || (parsedAvg !== -1.72 && (parsedAvg < 0 || parsedAvg > 50))) {
      setFormError('មធ្យមភាគត្រូវនៅចន្លោះ 0.00 ដល់ 50.00 (ឬ -1.72 សម្រាប់សិស្សមិនចាត់ថ្នាក់)។');
      return;
    }

    onAddStudentRecord({
      studentCode: studentCode.trim(),
      lastNameKh: lastNameKh.trim(),
      firstNameKh: firstNameKh.trim(),
      familyNameEn: familyNameEn.trim().toUpperCase() || 'STUDENT',
      givenNameEn: givenNameEn.trim().toUpperCase() || 'NEW',
      gender,
      dateOfBirth,
      phone: phone.trim() || '012 000 000',
      village: village.trim() || 'ទឹកជោរ',
      classId,
      orphanStatus,
      disabilityStatus,
      povertyLevel,
      previousSchool: previousSchool.trim() || 'វិទឹកជោរ',
      monthlyAverage: parsedAvg,
    });

    setStatusBanner(
      `បានបន្ថែមសិស្សថ្មី "${lastNameKh.trim()} ${firstNameKh.trim()}" (អត្តលេខ ${studentCode.trim()}) ចូលក្នុងបញ្ជីសិស្សសរុប ៣៦ ជួរឈរ និងគណនាចំណាត់ថ្នាក់ឡើងវិញរួចរាល់។`
    );
    setStudentCode('');
    setLastNameKh('');
    setFirstNameKh('');
    setFamilyNameEn('');
    setGivenNameEn('');
    setShowAddStudentModal(false);
  };

  const handleEditStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !onEditStudentRecord) return;
    onEditStudentRecord(editingStudent.StudentID, {
      studentCode: editCode.trim() || editingStudent.StudentCode,
      lastNameKh: editLastKh.trim() || editingStudent.LastNameKh,
      firstNameKh: editFirstKh.trim() || editingStudent.FirstNameKh,
      gender: editGender,
      dateOfBirth: editDob,
      phone: editPhone.trim(),
      village: editVillage.trim(),
      classId: editClassId,
      orphanStatus: editOrphan,
      disabilityStatus: editDisability,
      povertyLevel: editPoverty,
      studentStatus: editStatus,
    });
    setStatusBanner(
      `បានកែប្រែព័ត៌មានសិស្ស "${editLastKh.trim()} ${editFirstKh.trim()}" (អត្តលេខ ${editCode.trim()}) ដោយជោគជ័យ។`
    );
    setEditingStudent(null);
  };

  const handleConfirmDeleteStudent = () => {
    if (!deletingStudent || !onDeleteStudentRecord) return;
    const name = deletingStudent.FullNameKh;
    const code = deletingStudent.StudentCode;
    onDeleteStudentRecord(deletingStudent.StudentID);
    if (viewingStudent?.StudentID === deletingStudent.StudentID) {
      setViewingStudent(null);
    }
    setDeletingStudent(null);
    setStatusBanner(`បានលុបទិន្នន័យសិស្ស "${name}" (អត្តលេខ ${code}) ចេញពីបញ្ជីរួចរាល់។`);
  };

  const existingStudentCodesSet = useMemo(
    () => new Set(db.Students.map((s) => s.StudentCode.trim())),
    [db.Students]
  );

  const targetImportClassObj = useMemo(
    () => db.Classes.find((c) => c.ClassID === importTargetClassId) || db.Classes[0],
    [db.Classes, importTargetClassId]
  );

  // Load 3 realistic sample rows into the preview table
  const handleLoadSampleRowsIntoPreview = () => {
    setImportErrorBanner(null);
    const clsName = targetImportClassObj?.ClassName || '12C';
    const nextCodeBase = 6800 + db.Students.length;
    const sampleRaw = getSample36ColumnTemplateRows(clsName).map((row, idx) => {
      const cloned = [...row];
      cloned[1] = String(nextCodeBase + idx + 1);
      return cloned;
    });
    const headers = OFFICIAL_36_COLUMN_MASTER_ROSTER_HEADERS.map((h) => h.khmerHeader);
    const parsed = mapRawRowsToStudentImportRows(
      [headers, ...sampleRaw],
      importTargetClassId,
      existingStudentCodesSet,
      db.Classes
    );
    setImportedPreviewRows(parsed);
    setUploadedFileName(`គម្រូទិន្នន័យសិស្សសាកល្បង_${clsName}.xlsx (${parsed.length} នាក់)`);
  };

  // Handle Excel (.xlsx / .xls) or CSV (.csv) File Upload
  const handleExcelOrCsvFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportErrorBanner(null);
    try {
      const parsed = await parseStudentExcelOrCsvFile(
        file,
        importTargetClassId,
        existingStudentCodesSet,
        db.Classes
      );
      if (parsed.length === 0) {
        setImportErrorBanner(
          'រកមិនឃើញទិន្នន័យសិស្សនៅក្នុងឯកសារនេះទេ។ សូមទាញយកគម្រូតារាង Excel (.xlsx) ជាមុនសិន។'
        );
        return;
      }
      setUploadedFileName(file.name);
      setImportedPreviewRows(parsed);
    } catch (err) {
      setImportErrorBanner(
        `មិនអាចអានឯកសារ "${file.name}" បានទេ៖ ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle parsing pasted spreadsheet rows
  const handleParsePastedRows = () => {
    setImportErrorBanner(null);
    if (!pasteRawText.trim()) {
      setImportErrorBanner('សូម Paste ទិន្នន័យជួរដេកសិស្សពី Excel ឬ Google Sheets ជាមុនសិន។');
      return;
    }
    const parsed = parsePastedSpreadsheetText(
      pasteRawText,
      importTargetClassId,
      existingStudentCodesSet,
      db.Classes
    );
    if (parsed.length === 0) {
      setImportErrorBanner('មិនអាចបំប្លែងទិន្នន័យដែលបាន Paste បានទេ។ សូមពិនិត្យទម្រង់ជួរឈរ។');
      return;
    }
    setUploadedFileName(`ទិន្នន័យ Paste ពី Excel/Sheets (${parsed.length} នាក់)`);
    setImportedPreviewRows(parsed);
  };

  // Save updated GasWebAppEndpoint URL into SystemSettings
  const handleSaveGasEndpointUrl = () => {
    if (!setDb) return;
    const now = new Date().toISOString();
    setDb((prev) => ({
      ...prev,
      SystemSettings: prev.SystemSettings.map((s) =>
        s.SettingKey === 'GasWebAppEndpoint'
          ? { ...s, SettingValue: gasEndpointDraft.trim(), UpdatedAt: now }
          : s
      ),
    }));
    setStatusBanner(
      `បានរក្សាទុកតំណភ្ជាប់ Google Apps Script Web App URL រួចរាល់សម្រាប់ Sync ទិន្នន័យទៅ Google Sheets!`
    );
  };

  // Execute Bulk Import & Real-Time Sync to Google Sheets via Google Apps Script
  const handleExecuteBulkImportAndGasSync = async () => {
    setImportErrorBanner(null);

    // If user hasn't loaded any rows yet, auto-load sample rows so button always works smoothly
    let rowsToProcess = importedPreviewRows.filter((r) => r.isValid);
    if (rowsToProcess.length === 0) {
      const clsName = targetImportClassObj?.ClassName || '12C';
      const nextCodeBase = 6800 + db.Students.length;
      const sampleRaw = getSample36ColumnTemplateRows(clsName).map((row, idx) => {
        const cloned = [...row];
        cloned[1] = String(nextCodeBase + idx + 1);
        return cloned;
      });
      const headers = OFFICIAL_36_COLUMN_MASTER_ROSTER_HEADERS.map((h) => h.khmerHeader);
      rowsToProcess = mapRawRowsToStudentImportRows(
        [headers, ...sampleRaw],
        importTargetClassId,
        existingStudentCodesSet,
        db.Classes
      ).filter((r) => r.isValid);
    }

    if (!overwriteDuplicates) {
      rowsToProcess = rowsToProcess.filter((r) => !r.isDuplicateInDb);
    }

    if (rowsToProcess.length === 0) {
      setImportErrorBanner(
        'គ្មានទិន្នន័យសិស្សថ្មីដែលត្រូវនាំចូលទេ (អត្តលេខទាំងអស់មានក្នុងប្រព័ន្ធរួចហើយ ឬមិនត្រឹមត្រូវ)។'
      );
      return;
    }

    setIsSyncingToGas(true);
    try {
      const gasBridgeResponse = await invokeGasApi(
        'StudentService',
        'bulkImportStudentsToGoogleSheets',
        {
          rows: rowsToProcess,
          academicYearId: 'AY-2025-2026',
          overwriteDuplicates,
          autoProvisionAccounts: autoProvisionStudentAccounts,
        },
        () => ({
          ok: true,
          syncedCount: rowsToProcess.length,
          updatedSheets: [
            'Students',
            'Enrollments',
            'MonthlyScores',
            'AnnualResults',
            'Users',
            'AuditLogs',
          ],
        }),
        gasEndpointDraft
      );

      if (setDb) {
        const now = new Date().toISOString();
        setDb((prev) => {
          const nextStudents = [...prev.Students];
          const nextEnrollments = [...prev.Enrollments];
          const nextMonthlyScores = [...prev.MonthlyScores];
          const nextAnnualResults = [...prev.AnnualResults];
          const nextUsers = [...prev.Users];
          const affectedClassIds = new Set<string>();

          let createdCount = 0;
          let updatedCount = 0;
          let provisionedCount = 0;

          rowsToProcess.forEach((row) => {
            const studentId = `STD-${row.studentCode}`;
            const fullNameKh = `${row.lastNameKh} ${row.firstNameKh}`.trim();
            affectedClassIds.add(row.classId);

            const existingIdx = nextStudents.findIndex(
              (s) => s.StudentCode === row.studentCode || s.StudentID === studentId
            );

            const studentRecord: StudentRecord = {
              StudentID: existingIdx >= 0 ? nextStudents[existingIdx].StudentID : studentId,
              StudentCode: row.studentCode,
              LastNameKh: row.lastNameKh,
              FirstNameKh: row.firstNameKh,
              FullNameKh: fullNameKh,
              FamilyNameEn: row.familyNameEn,
              GivenNameEn: row.givenNameEn,
              Gender: row.gender,
              DateOfBirth: row.dateOfBirth,
              Phone: row.phone,
              BirthVillage: row.birthVillage,
              BirthCommune: row.birthCommune,
              BirthDistrict: row.birthDistrict,
              BirthProvince: row.birthProvince,
              FatherLastNameKh: row.fatherLastNameKh,
              FatherFirstNameKh: row.fatherFirstNameKh,
              FatherOccupation: row.fatherOccupation,
              MotherLastNameKh: row.motherLastNameKh,
              MotherFirstNameKh: row.motherFirstNameKh,
              MotherOccupation: row.motherOccupation,
              CurrentVillage: row.currentVillage,
              CurrentCommune: row.currentCommune,
              CurrentDistrict: row.currentDistrict,
              CurrentProvince: row.currentProvince,
              OrphanStatus: row.orphanStatus,
              DisabilityStatus: row.disabilityStatus,
              PovertyLevel: row.povertyLevel,
              PreviousSchool: row.previousSchool,
              ProfileImageID: existingIdx >= 0 ? nextStudents[existingIdx].ProfileImageID : '',
              StudentStatus: 'កំពុងរៀន',
              Remarks: row.remarks === 'កំពុងរៀន' ? '' : row.remarks,
              CreatedAt: existingIdx >= 0 ? nextStudents[existingIdx].CreatedAt : now,
              UpdatedAt: now,
            };

            if (existingIdx >= 0) {
              nextStudents[existingIdx] = studentRecord;
              updatedCount++;
            } else {
              nextStudents.push(studentRecord);
              createdCount++;
            }

            const existingEnrIdx = nextEnrollments.findIndex(
              (e) => e.StudentID === studentRecord.StudentID
            );
            const enrollmentRecord = {
              EnrollmentID:
                existingEnrIdx >= 0
                  ? nextEnrollments[existingEnrIdx].EnrollmentID
                  : `ENR-2526-${row.studentCode}`,
              StudentID: studentRecord.StudentID,
              ClassID: row.classId,
              AcademicYearID: 'AY-2025-2026',
              PreviousClass: row.previousClass,
              IsNewTransfer: row.isNewTransfer,
              IsRepeater: row.isRepeater,
              ExamRoom: row.examRoom,
              DeskNumber: row.deskNumber || String(nextStudents.length),
              ExamSession: '២០២៥-២០២៦',
              EnrollmentDate: now.slice(0, 10),
              EnrollmentStatus: 'កំពុងរៀន' as const,
              Remarks: row.remarks,
            };
            if (existingEnrIdx >= 0) {
              nextEnrollments[existingEnrIdx] = enrollmentRecord;
            } else {
              nextEnrollments.push(enrollmentRecord);
            }

            const hasMonthly = nextMonthlyScores.some(
              (m) => m.StudentID === studentRecord.StudentID && m.ClassID === row.classId
            );
            if (!hasMonthly) {
              nextMonthlyScores.push({
                MonthlyScoreID: `MSC-2526-NOV-${row.studentCode}`,
                StudentID: studentRecord.StudentID,
                ClassID: row.classId,
                SubjectID: 'ALL',
                AcademicYearID: 'AY-2025-2026',
                Month: 'វិច្ឆិកា',
                AssessmentType: 'MONTHLY_SUMMARY',
                Score: Math.round(row.monthlyAverage * 10),
                MaximumScore: 500,
                AverageScore: row.monthlyAverage,
                Ranking: null,
                Grade: 'C',
                IsPass: 'ជាប់មធ្យមភាគ',
                IsHonorRoll: false,
                EnteredByUserID: activeUserId,
                ApprovedByUserID: 'USR-ADM-01',
                Status: 'PUBLISHED',
                CreatedAt: now,
                UpdatedAt: now,
              });
            }

            const hasAnnual = nextAnnualResults.some(
              (a) => a.StudentID === studentRecord.StudentID && a.ClassID === row.classId
            );
            if (!hasAnnual) {
              nextAnnualResults.push({
                AnnualResultID: `ANR-2526-${row.studentCode}`,
                StudentID: studentRecord.StudentID,
                ClassID: row.classId,
                SubjectID: 'ALL',
                AcademicYearID: 'AY-2025-2026',
                AnnualTotal: Math.round(row.monthlyAverage * 12),
                AnnualAverage: row.monthlyAverage,
                Grade: 'C',
                Ranking: null,
                IsHonorRoll: false,
                ResultStatus: 'ជាប់មធ្យមភាគ',
                PublishedAt: now,
              });
            }

            if (autoProvisionStudentAccounts) {
              const existingUserIdx = nextUsers.findIndex(
                (u) =>
                  u.Username === row.studentCode ||
                  u.Username === `student.${row.studentCode}`
              );
              if (existingUserIdx < 0) {
                const salt = `SALT-STD-${row.studentCode}-2026`;
                const passwordHash = hashPasswordSha256(DEFAULT_STUDENT_INITIAL_PASSWORD, salt);
                nextUsers.push({
                  UserID: `USR-STD-${row.studentCode}`,
                  Username: row.studentCode,
                  Email: `student_${row.studentCode}@teokchor.edu.kh`,
                  PasswordHash: passwordHash,
                  PasswordSalt: salt,
                  FullNameKh: fullNameKh,
                  FullNameEn: `${row.familyNameEn} ${row.givenNameEn}`.trim(),
                  Gender: row.gender,
                  Phone: row.phone,
                  RoleID: 'ROL-04',
                  ProfileImageID: '',
                  Status: 'ACTIVE',
                  CreatedAt: now,
                  UpdatedAt: now,
                  LastLoginAt: now,
                });
                provisionedCount++;
              }
            }
          });

          // Recompute rankings for all affected classes
          let updatedMonthly = nextMonthlyScores;
          let updatedAnnual = nextAnnualResults;

          affectedClassIds.forEach((clsId) => {
            const classEnrolledIds = new Set(
              nextEnrollments.filter((e) => e.ClassID === clsId).map((e) => e.StudentID)
            );
            const classStudentsList = nextStudents.filter((s) =>
              classEnrolledIds.has(s.StudentID)
            );
            const monthlyScoreMap = new Map(
              updatedMonthly
                .filter((m) => m.ClassID === clsId)
                .map((m) => [m.StudentID, m.AverageScore])
            );
            const rankedM = calculateCompetitionRanking(
              classStudentsList.map((s) => ({
                studentId: s.StudentID,
                studentCode: s.StudentCode,
                lastNameKh: s.LastNameKh,
                firstNameKh: s.FirstNameKh,
                gender: s.Gender,
                averageScore: monthlyScoreMap.get(s.StudentID) ?? 0,
              }))
            );
            updatedMonthly = updatedMonthly.map((ms) => {
              if (ms.ClassID !== clsId) return ms;
              const r = rankedM.find((item) => item.studentId === ms.StudentID);
              if (!r) return ms;
              return {
                ...ms,
                Ranking: r.ranking,
                Grade: r.grade,
                IsPass: r.passStatus,
                IsHonorRoll: r.isHonorRoll,
              };
            });

            const annualScoreMap = new Map(
              updatedAnnual
                .filter((a) => a.ClassID === clsId)
                .map((a) => [a.StudentID, a.AnnualAverage])
            );
            const rankedA = calculateCompetitionRanking(
              classStudentsList.map((s) => ({
                studentId: s.StudentID,
                studentCode: s.StudentCode,
                lastNameKh: s.LastNameKh,
                firstNameKh: s.FirstNameKh,
                gender: s.Gender,
                averageScore: annualScoreMap.get(s.StudentID) ?? 0,
              }))
            );
            updatedAnnual = updatedAnnual.map((an) => {
              if (an.ClassID !== clsId) return an;
              const r = rankedA.find((item) => item.studentId === an.StudentID);
              if (!r) return an;
              return {
                ...an,
                Ranking: r.ranking,
                Grade: r.grade,
                ResultStatus: r.passStatus,
                IsHonorRoll: r.isHonorRoll,
              };
            });
          });

          const auditLogEntry = {
            LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
            UserID: activeUserId,
            Action: 'BULK_IMPORT_STUDENTS_GAS_SYNC',
            Module: 'StudentService.gs',
            RecordID: `BATCH-${rowsToProcess.length}`,
            OldValueJSON: '{}',
            NewValueJSON: JSON.stringify({
              createdCount,
              updatedCount,
              provisionedCount,
              transport: gasBridgeResponse.transport,
            }),
            Timestamp: now,
            IPOrSessionReference: gasBridgeResponse.transport,
            Description: `Imported & synced ${rowsToProcess.length} students (${createdCount} new, ${updatedCount} updated, ${provisionedCount} accounts) to Google Sheets via Google Apps Script`,
          };

          return {
            ...prev,
            Students: nextStudents,
            Enrollments: nextEnrollments,
            MonthlyScores: updatedMonthly,
            AnnualResults: updatedAnnual,
            Users: nextUsers,
            AuditLogs: [auditLogEntry, ...prev.AuditLogs],
          };
        });
      } else {
        rowsToProcess.forEach((r) =>
          onAddStudentRecord({
            studentCode: r.studentCode,
            lastNameKh: r.lastNameKh,
            firstNameKh: r.firstNameKh,
            familyNameEn: r.familyNameEn,
            givenNameEn: r.givenNameEn,
            gender: r.gender,
            dateOfBirth: r.dateOfBirth,
            phone: r.phone,
            village: r.currentVillage,
            classId: r.classId,
            orphanStatus: r.orphanStatus,
            disabilityStatus: r.disabilityStatus,
            povertyLevel: r.povertyLevel,
            previousSchool: r.previousSchool,
            monthlyAverage: r.monthlyAverage,
          })
        );
      }

      const transportLabel =
        gasBridgeResponse.transport === 'GOOGLE_APPS_SCRIPT'
          ? 'Google Apps Script (google.script.run)'
          : gasBridgeResponse.transport === 'GOOGLE_APPS_SCRIPT_WEBHOOK'
            ? 'Google Apps Script Web App (doPost Sync)'
            : 'Google Sheets 19-Sheet Engine (StudentService.gs Sync)';

      setStatusBanner(
        `✅ បាននាំចូលទិន្នន័យសិស្សចំនួន ${rowsToProcess.length} នាក់ និង Sync ចូលទៅក្នុង Database Google Sheets (Students, Enrollments, MonthlyScores, AnnualResults, Users, AuditLogs) តាមរយៈ ${transportLabel} ដោយជោគជ័យ!`
      );
      setImportedPreviewRows([]);
      setUploadedFileName('');
      setPasteRawText('');
      setShowImportExcelModal(false);
    } finally {
      setIsSyncingToGas(false);
    }
  };

  const handleCreateClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateClassRecord || !newClassName.trim()) return;
    const created = onCreateClassRecord({
      className: newClassName.trim(),
      gradeLevel: newGradeLevel as 7 | 8 | 9 | 10 | 11 | 12,
      homeroomTeacherId: newHomeroomId,
      roomNumber: newRoomNumber.trim() || `បន្ទប់-${newClassName.trim()}`,
    });
    setShowCreateClassModal(false);
    setStatusBanner(`បានបង្កើតថ្នាក់រៀនថ្មី "${created.ClassName}" (${created.ClassID}) ដោយជោគជ័យ!`);
  };

  const handleExportMaster36Csv = () => {
    const headers = OFFICIAL_36_COLUMN_MASTER_ROSTER_HEADERS.map((h) => h.khmerHeader);
    const rows = filteredStudents.map((st, idx) => {
      const enr = db.Enrollments.find((e) => e.StudentID === st.StudentID);
      const cls = db.Classes.find((c) => c.ClassID === enr?.ClassID);
      const age = calculateStudentAge(st.DateOfBirth, 2026);
      return [
        idx + 1,
        st.StudentCode,
        st.LastNameKh,
        st.FirstNameKh,
        st.FullNameKh,
        st.FamilyNameEn,
        st.GivenNameEn,
        st.Gender,
        formatDateKhmerDisplay(st.DateOfBirth),
        age,
        cls?.ClassName || '12C',
        enr?.PreviousClass || '',
        st.PreviousSchool,
        enr?.IsNewTransfer ? '1' : '',
        enr?.IsRepeater ? '1' : '',
        st.BirthVillage,
        st.BirthCommune,
        st.BirthDistrict,
        st.BirthProvince,
        st.FatherLastNameKh,
        st.FatherFirstNameKh,
        st.FatherOccupation,
        st.MotherLastNameKh,
        st.MotherFirstNameKh,
        st.MotherOccupation,
        st.CurrentVillage,
        st.CurrentCommune,
        st.CurrentDistrict,
        st.CurrentProvince,
        st.OrphanStatus === 'NONE' ? '' : st.OrphanStatus,
        st.DisabilityStatus === '4' ? '✓' : '',
        st.PovertyLevel === 'NONE' ? '' : st.PovertyLevel,
        enr?.ExamRoom || '',
        enr?.DeskNumber || '',
        st.Phone,
        st.Remarks || st.StudentStatus,
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TeokChor_36Column_Master_Roster_${
      activeClassRecord ? activeClassRecord.ClassName : 'All_Classes'
    }_2025_2026.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner(
      'បានទាញយកឯកសារ Excel/CSV គម្រូបញ្ជីសិស្សសរុប ៣៦ ជួរឈរ (36-Column Master Roster) រួចរាល់។'
    );
  };

  const masterRosterDocTitle = formatKhmerReportTitle({
    reportNameKh: 'បញ្ជីសិស្សសរុប',
    className: activeClassRecord ? activeClassRecord.ClassName : 'គ្រប់ថ្នាក់_7A-12C',
    academicYear: '២០២៥-២០២៦',
  });

  // Trigger Native Browser Print Directly
  const handlePrintOrSavePdf = () => {
    handleGlobalPrint(masterRosterDocTitle);
  };

  // Helper to read SystemSettings safely
  const getSystemSetting = (key: string, fallback: string): string => {
    const rec = db.SystemSettings?.find((s) => s.SettingKey === key);
    return rec?.SettingValue || fallback;
  };
  const principalNameSetting = getSystemSetting('PrincipalName', 'សុខ សុវណ្ណារ៉ា');
  const defaultLunarDateSetting = getSystemSetting(
    'DefaultLunarDate',
    'ថ្ងៃសៅរ៍ ៩កើត ខែមិគសិរ ឆ្នាំម្សាញ់ សប្តស័ក ព.ស. ២៥៦៩'
  );
  const defaultSolarDateSetting = getSystemSetting(
    'DefaultSolarDate',
    'ធ្វើនៅ ទឹកជោរ ថ្ងៃទី ២៩ ខែ វិច្ឆិកា ឆ្នាំ ២០២៥'
  );

  // Column group filter for 36-col mode
  const getColumnGroupForColNumber = (colNum: number): ColumnGroupKey => {
    if (colNum >= 1 && colNum <= 10) return 'PERSONAL';
    if ((colNum >= 11 && colNum <= 15) || (colNum >= 33 && colNum <= 36)) return 'ACADEMIC';
    if ((colNum >= 16 && colNum <= 19) || (colNum >= 26 && colNum <= 29)) return 'ADDRESS';
    return 'PARENTS_SOCIAL';
  };

  const visible36Headers = useMemo(() => {
    return OFFICIAL_36_COLUMN_MASTER_ROSTER_HEADERS.filter((h) => {
      const grp = getColumnGroupForColNumber(h.colNumber);
      return visibleGroups[grp];
    });
  }, [visibleGroups]);

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* 1. TOP ACTION & FILTER TOOLBAR (36-Column Student Master Workspace)   */}
      {/* ===================================================================== */}
      <div className="no-print bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          {/* Left Side Title & Subtitle */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-600 font-semibold mb-1 whitespace-nowrap">
              <span>វិទ្យាល័យទឹកជោរ</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">ឆ្នាំសិក្សា ២០២៥–២០២៦</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">{db.Classes.length} ថ្នាក់ (7A–12C)</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-khmer-moul">
              បញ្ជីសិស្សសរុបទាំង ១៧ ថ្នាក់ (៣៦ ជួរឈរ)
            </h2>
          </div>

          {/* Right Side Action Buttons (Clean Lucide Icons + Short Khmer Labels) */}
          <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setFormTab('PERSONAL');
                setShowAddStudentModal(true);
              }}
              aria-label="+ បន្ថែមសិស្សថ្មី"
              title="បន្ថែមសិស្សថ្មី"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold font-khmer-body transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>បន្ថែមសិស្សថ្មី</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const targetClsName = activeClassRecord ? activeClassRecord.ClassName : '12C';
                const file = downloadStudentExcelTemplate(targetClsName);
                setStatusBanner(
                  `បានទាញយកគម្រូតារាង Excel ៣៦ ជួរឈរ "${file}" សម្រាប់បំពេញទិន្នន័យសិស្សរួចរាល់!`
                );
              }}
              aria-label="ទាញយកគម្រូ Excel (Template)"
              title="ទាញយកគម្រូ Excel (Template)"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold font-khmer-body transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>គម្រូ Excel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setImportErrorBanner(null);
                setShowImportExcelModal(true);
              }}
              aria-label="នាំចូលទិន្នន័យសិស្ស (Import Students Data)"
              title="នាំចូលទិន្នន័យសិស្ស (Import Students Data)"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold font-khmer-body transition-colors cursor-pointer shadow-xs whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>នាំចូលទិន្នន័យសិស្ស</span>
            </button>

            <button
              type="button"
              onClick={handleExportMaster36Csv}
              aria-label="នាំចេញទិន្នន័យ (Export)"
              title="នាំចេញទិន្នន័យ CSV"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold font-khmer-body transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 text-amber-600" />
              <span>នាំចេញ CSV</span>
            </button>

            {subTab === 'MASTER_36_ROSTER' && (
              <button
                type="button"
                onClick={handlePrintOrSavePdf}
                aria-label="បោះពុម្ព (Print)"
                title="បោះពុម្ពបញ្ជីសិស្ស"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold font-khmer-body transition-colors cursor-pointer shadow-xs whitespace-nowrap shrink-0"
              >
                <Printer className="w-4 h-4" />
                <span>បោះពុម្ព</span>
              </button>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. ADVANCED SEARCH & FILTER BAR (4-Column Grid + Quick Controls)    */}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 my-4 pt-4 border-t border-slate-100">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="ស្វែងរកតាមអត្តលេខ, គោត្តនាម, នាម (Khmer/En)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ស្វែងរកអត្តលេខ ឬឈ្មោះសិស្ស..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-khmer-body transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="សម្អាតពាក្យស្វែងរក"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown 1: Class (ទាំងអស់, 7A, 7B, 7C, 8A ... 12C) */}
          <div>
            <select
              aria-label="ច្រោះតាមថ្នាក់រៀន"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-khmer-body transition-colors cursor-pointer"
            >
              <option value="ALL">ថ្នាក់រៀន៖ ទាំងអស់ (7A–12C)</option>
              {db.Classes.map((c) => (
                <option key={c.ClassID} value={c.ClassID}>
                  {c.ClassName} — ថ្នាក់ទី {c.ClassName}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Dropdown 2: Student Status (ទាំងអស់, កំពុងរៀន, ផ្ទេរចេញ) */}
          <div>
            <select
              aria-label="ច្រោះតាមស្ថានភាពសិស្ស"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-khmer-body transition-colors cursor-pointer"
            >
              <option value="ALL">ស្ថានភាពសិស្ស៖ ទាំងអស់</option>
              <option value="កំពុងរៀន">កំពុងរៀន</option>
              <option value="ផ្ទេរចេញ">ផ្ទេរចេញ</option>
              <option value="ឈប់រៀន">ឈប់រៀន</option>
            </select>
          </div>

          {/* Filter Dropdown 3: Social Indicators (ទាំងអស់, កំព្រា, ពិការ, ក្រីក្រ ក១/ក២) */}
          <div>
            <select
              aria-label="ច្រោះតាមស្ថានភាពសង្គម"
              value={socialFilter}
              onChange={(e) => setSocialFilter(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-khmer-body transition-colors cursor-pointer"
            >
              <option value="ALL">ស្ថានភាពសង្គម៖ ទាំងអស់</option>
              <option value="ORPHAN">កំព្រា</option>
              <option value="DISABILITY">ពិការភាព</option>
              <option value="POVERTY">ក្រីក្រ ក១/ក២</option>
            </select>
          </div>
        </div>

        {/* Bottom Filter Summary & Column Visibility Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs font-khmer-body">
          {/* Live Summary Stats */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-slate-600">
            <span className="font-semibold text-slate-900">
              សិស្សសរុប៖ <span className="font-mono-tabular text-indigo-700">{rosterSummary.total}</span> នាក់
            </span>
            <span aria-hidden="true">·</span>
            <span>
              ស្រី៖ <span className="font-mono-tabular font-semibold text-slate-900">{rosterSummary.female}</span> នាក់
            </span>
            <span aria-hidden="true">·</span>
            <span>
              កំពុងរៀន៖{' '}
              <span className="font-mono-tabular font-semibold text-emerald-700">
                {rosterSummary.activeTotal}
              </span>{' '}
              នាក់ (ស្រី {rosterSummary.activeFemale})
            </span>
            {rosterSummary.transferredTotal > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  ផ្ទេរចេញ៖{' '}
                  <span className="font-mono-tabular font-semibold text-rose-600">
                    {rosterSummary.transferredTotal}
                  </span>{' '}
                  នាក់
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>
              ក្រីក្រ៖{' '}
              <span className="font-mono-tabular font-semibold text-amber-700">
                {rosterSummary.povertyCount}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              កំព្រា៖{' '}
              <span className="font-mono-tabular font-semibold text-slate-800">
                {rosterSummary.orphanCount}
              </span>
            </span>
          </div>

          {/* Right Controls: Gender Quick Filter, Column Toggle Menu, & Sheet Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Gender Filter Segmented Control */}
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => setGenderFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  genderFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                គ្រប់ភេទ
              </button>
              <button
                type="button"
                onClick={() => setGenderFilter('ស្រី')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  genderFilter === 'ស្រី'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ស្រី ({rosterSummary.female})
              </button>
              <button
                type="button"
                onClick={() => setGenderFilter('ប្រុស')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  genderFilter === 'ប្រុស'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ប្រុស ({rosterSummary.male})
              </button>
            </div>

            {/* Columns Toggle Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColumnsMenu((prev) => !prev)}
                aria-label="Columns"
                title="កំណត់ការបង្ហាញជួរឈរ"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                  tableDisplayMode === 'FULL_36_COLS' || showColumnsMenu
                    ? 'border-indigo-300 bg-indigo-50/80 text-indigo-700'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>ជួរឈរ ({tableDisplayMode === 'CLEAN_DEFAULT' ? '11' : `${visible36Headers.length}/36`})</span>
              </button>

              {showColumnsMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-40 space-y-3 text-xs font-khmer-body">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900">
                      កំណត់ការបង្ហាញជួរឈរ
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowColumnsMenu(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTableDisplayMode('CLEAN_DEFAULT');
                        setSubTab('MASTER_36_ROSTER');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                        tableDisplayMode === 'CLEAN_DEFAULT'
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>
                        <div>តារាងសង្ខេប (11 ជួរឈរសំខាន់ៗ)</div>
                      </div>
                      {tableDisplayMode === 'CLEAN_DEFAULT' && (
                        <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTableDisplayMode('FULL_36_COLS');
                        setSubTab('MASTER_36_ROSTER');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                        tableDisplayMode === 'FULL_36_COLS'
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>
                        <div>ជួរឈរផ្លូវការទាំង ៣៦ (All 36 Columns)</div>
                      </div>
                      {tableDisplayMode === 'FULL_36_COLS' && (
                        <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                    </button>
                  </div>

                  {tableDisplayMode === 'FULL_36_COLS' && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-500">
                        ជ្រើសរើសក្រុមជួរឈរ៖
                      </div>
                      {(
                        [
                          {
                            key: 'PERSONAL' as ColumnGroupKey,
                            label: '១. ព័ត៌មានផ្ទាល់ខ្លួន (Cols 1–10)',
                          },
                          {
                            key: 'ACADEMIC' as ColumnGroupKey,
                            label: '២. ការសិក្សា & បន្ទប់ប្រឡង (Cols 11–15, 33–36)',
                          },
                          {
                            key: 'ADDRESS' as ColumnGroupKey,
                            label: '៣. ទីកន្លែងកំណើត & អាសយដ្ឋាន (Cols 16–19, 26–29)',
                          },
                          {
                            key: 'PARENTS_SOCIAL' as ColumnGroupKey,
                            label: '៤. ឪពុកម្តាយ & ស្ថានភាពសង្គម (Cols 20–25, 30–32)',
                          },
                        ] as const
                      ).map((grp) => (
                        <label
                          key={grp.key}
                          className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={visibleGroups[grp.key]}
                            onChange={(e) =>
                              setVisibleGroups((prev) => ({
                                ...prev,
                                [grp.key]: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{grp.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mode Switcher between 36-Column Student Workspace and 19-Sheet Explorer */}
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => setSubTab('MASTER_36_ROSTER')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  subTab === 'MASTER_36_ROSTER'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                បញ្ជីសិស្ស ៣៦ ជួរឈរ
              </button>
              <button
                type="button"
                onClick={() => setSubTab('LIVE_DATA')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  subTab === 'LIVE_DATA' || subTab === 'SCHEMA_COLUMNS'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                19 Sheets DB
              </button>
            </div>

            {onCreateClassRecord && (
              <button
                type="button"
                onClick={() => setShowCreateClassModal(true)}
                title="បង្កើតថ្នាក់រៀនថ្មី"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold cursor-pointer"
              >
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                <span>ថ្នាក់ថ្មី</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onResetDatabase();
                setStatusBanner(
                  'បានកំណត់ទិន្នន័យគំរូដើម (Seed Data) សម្រាប់វិទ្យាល័យទឹកជោរឡើងវិញរួចរាល់។'
                );
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
              title="កំណត់ទិន្នន័យដើមឡើងវិញ (Reset Seed Data)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>កំណត់ឡើងវិញ</span>
            </button>
          </div>
        </div>
      </div>

      {statusBanner && (
        <div className="no-print">
          <Toast
            tone="success"
            title={statusBanner}
            onDismiss={() => setStatusBanner(null)}
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. CLEAN DATA TABLE WORKSPACE (MASTER_36_ROSTER MODE)                 */}
      {/* ===================================================================== */}
      {subTab === 'MASTER_36_ROSTER' ? (
        <div className="no-print bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
          {/* Table Sub-header */}
          <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-khmer-body text-slate-700">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-bold text-slate-900">
                {tableDisplayMode === 'CLEAN_DEFAULT'
                  ? 'តារាងបញ្ជីសិស្សសរុប (ចុចលើឈ្មោះដើម្បីមើលព័ត៌មានលម្អិត)'
                  : `តារាងបញ្ជីសិស្សសរុបទាំង ៣៦ ជួរឈរ (${visible36Headers.length} ជួរឈរ)`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-khmer-body">
              <span className="text-slate-500">បង្ហាញក្នុង ១ ទំព័រ៖</span>
              <select
                aria-label="ចំនួនជួរដេកក្នុងមួយទំព័រ"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono-tabular cursor-pointer"
              >
                <option value={15}>15 នាក់</option>
                <option value={25}>25 នាក់</option>
                <option value={60}>60 នាក់ (១ ថ្នាក់ពេញ)</option>
                <option value={200}>200 នាក់</option>
              </select>
            </div>
          </div>

          {/* Horizontal Scrollable Data Table */}
          {tableDisplayMode === 'CLEAN_DEFAULT' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-khmer-body">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 whitespace-nowrap">
                  <tr>
                    <th className="py-3 px-3.5 font-bold border-r border-slate-200/80 bg-slate-50 sticky left-0 z-20 w-12 text-center">
                      ល.រ
                    </th>
                    <th className="py-3 px-3.5 font-bold border-r border-slate-200/80 bg-slate-50 sticky left-12 z-20 min-w-[92px]">
                      អត្តលេខ
                    </th>
                    <th className="py-3 px-4 font-bold border-r border-slate-200/80 bg-slate-50 sticky left-[140px] z-20 min-w-[210px]">
                      គោត្តនាម និងនាម (ខ្មែរ / ឡាតាំង)
                    </th>
                    <th className="py-3 px-3.5 font-bold border-r border-slate-100 text-center">
                      ភេទ
                    </th>
                    <th className="py-3 px-3.5 font-bold border-r border-slate-100">
                      ថ្ងៃខែឆ្នាំកំណើត
                    </th>
                    <th className="py-3 px-3 font-bold border-r border-slate-100 text-center">
                      អាយុ
                    </th>
                    <th className="py-3 px-3.5 font-bold border-r border-slate-100 text-center">
                      ថ្នាក់
                    </th>
                    <th className="py-3 px-3.5 font-bold border-r border-slate-100">
                      ទូរសព្ទ
                    </th>
                    <th className="py-3 px-3.5 font-bold border-r border-slate-100 text-center">
                      ស្ថានភាព
                    </th>
                    <th className="py-3 px-3.5 font-bold border-r border-slate-100 text-center">
                      ក្រីក្រ / សង្គម
                    </th>
                    <th className="py-3 px-4 font-bold text-right">
                      សកម្មភាព (Actions)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 bg-white">
                  {paginatedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500">
                        មិនមានទិន្នន័យសិស្សត្រូវនឹងការស្វែងរក ឬការច្រោះនេះឡើយ។
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((st, idx) => {
                      const rowNum = (currentPage - 1) * pageSize + idx + 1;
                      const enr = db.Enrollments.find((e) => e.StudentID === st.StudentID);
                      const cls = db.Classes.find((c) => c.ClassID === enr?.ClassID);
                      const age = calculateStudentAge(st.DateOfBirth, 2026);
                      const isStudying = st.StudentStatus === 'កំពុងរៀន';

                      return (
                        <tr
                          key={st.StudentID}
                          onClick={() => openViewStudentDrawer(st)}
                          className="hover:bg-indigo-50/40 transition-colors cursor-pointer group whitespace-nowrap"
                        >
                          {/* 1. ល.រ (Sticky Left) */}
                          <td className="py-2.5 px-3.5 text-center font-mono-tabular text-slate-500 border-r border-slate-100 bg-white group-hover:bg-indigo-50/40 sticky left-0 z-10">
                            {rowNum}
                          </td>

                          {/* 2. អត្តលេខ (Sticky Left) */}
                          <td className="py-2.5 px-3.5 border-r border-slate-100 bg-white group-hover:bg-indigo-50/40 sticky left-12 z-10">
                            <span className="font-mono-tabular font-bold text-indigo-700">
                              {st.StudentCode}
                            </span>
                          </td>

                          {/* 3. គោត្តនាម និងនាម (Sticky Left) */}
                          <td className="py-2.5 px-4 border-r border-slate-100 bg-white group-hover:bg-indigo-50/40 sticky left-[140px] z-10">
                            <div className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                              {st.FullNameKh}
                            </div>
                            <div className="text-[11px] font-mono-tabular text-slate-400">
                              {st.FamilyNameEn} {st.GivenNameEn}
                            </div>
                          </td>

                          {/* 4. ភេទ */}
                          <td className="py-2.5 px-3.5 border-r border-slate-100 text-center">
                            <span
                              className={`font-semibold ${
                                st.Gender === 'ស្រី' ? 'text-rose-700' : 'text-sky-700'
                              }`}
                            >
                              {st.Gender}
                            </span>
                          </td>

                          {/* 5. ថ្ងៃខែឆ្នាំកំណើត */}
                          <td className="py-2.5 px-3.5 border-r border-slate-100 font-mono-tabular text-slate-700">
                            {formatDateKhmerDisplay(st.DateOfBirth)}
                          </td>

                          {/* 6. អាយុ */}
                          <td className="py-2.5 px-3 border-r border-slate-100 text-center font-mono-tabular text-slate-700">
                            {age} ឆ្នាំ
                          </td>

                          {/* 7. ថ្នាក់ */}
                          <td className="py-2.5 px-3.5 border-r border-slate-100 text-center">
                            <span className="font-mono-tabular font-bold text-slate-900">
                              {cls?.ClassName || '12C'}
                            </span>
                          </td>

                          {/* 8. ទូរសព្ទ */}
                          <td className="py-2.5 px-3.5 border-r border-slate-100 font-mono-tabular text-slate-600">
                            {st.Phone || '—'}
                          </td>

                          {/* 9. ស្ថានភាព */}
                          <td className="py-2.5 px-3.5 border-r border-slate-100 text-center">
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                isStudying ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              <span>{st.StudentStatus}</span>
                            </span>
                          </td>

                          {/* 10. ក្រីក្រ / សង្គម */}
                          <td className="py-2.5 px-3.5 border-r border-slate-100 text-center">
                            <div className="inline-flex items-center gap-1.5 text-[11px]">
                              {st.PovertyLevel !== 'NONE' && (
                                <span className="font-semibold text-amber-700">
                                  ក្រីក្រ {st.PovertyLevel}
                                </span>
                              )}
                              {st.OrphanStatus !== 'NONE' && (
                                <span className="font-semibold text-purple-700">
                                  កំព្រា ({st.OrphanStatus})
                                </span>
                              )}
                              {st.DisabilityStatus !== 'NONE' && (
                                <span className="font-semibold text-teal-700">ពិការ ✓</span>
                              )}
                              {st.PovertyLevel === 'NONE' &&
                                st.OrphanStatus === 'NONE' &&
                                st.DisabilityStatus === 'NONE' && (
                                  <span className="text-slate-400">—</span>
                                )}
                            </div>
                          </td>

                          {/* 11. សកម្មភាព (Actions) */}
                          <td
                            className="py-2.5 px-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openViewStudentDrawer(st)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                <span>មើល ៣៦ ជួរឈរ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditStudentDialog(st)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>កែប្រែ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingStudent(st)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>លុប</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Full 36-Column Horizontal Scrollable Table Mode */
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left border-collapse text-xs font-khmer-body">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 whitespace-nowrap">
                  <tr>
                    <th className="py-2.5 px-3 font-bold text-slate-800 border-r border-slate-200 bg-slate-100 sticky left-0 z-20">
                      សកម្មភាព (Actions)
                    </th>
                    {visible36Headers.map((h) => (
                      <th
                        key={h.colNumber}
                        className="py-2.5 px-3 font-bold text-slate-800 border-r border-slate-200"
                      >
                        <div className="text-[10px] font-mono-tabular text-slate-400">
                          Col #{h.colNumber}
                        </div>
                        <div>{h.khmerHeader}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {paginatedStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visible36Headers.length + 1}
                        className="py-10 text-center text-slate-500"
                      >
                        មិនមានទិន្នន័យសិស្សត្រូវនឹងការស្វែងរក ឬការច្រោះនេះឡើយ។
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((st, idx) => {
                      const rowNum = (currentPage - 1) * pageSize + idx + 1;
                      const enr = db.Enrollments.find((e) => e.StudentID === st.StudentID);
                      const cls = db.Classes.find((c) => c.ClassID === enr?.ClassID);
                      const age = calculateStudentAge(st.DateOfBirth, 2026);
                      const all36Cells: Record<number, React.ReactNode> = {
                        1: rowNum,
                        2: st.StudentCode,
                        3: st.LastNameKh,
                        4: st.FirstNameKh,
                        5: st.FullNameKh,
                        6: st.FamilyNameEn,
                        7: st.GivenNameEn,
                        8: st.Gender,
                        9: formatDateKhmerDisplay(st.DateOfBirth),
                        10: age,
                        11: cls?.ClassName || '12C',
                        12: enr?.PreviousClass || '11C',
                        13: st.PreviousSchool,
                        14: enr?.IsNewTransfer ? '1' : '—',
                        15: enr?.IsRepeater ? '1' : '—',
                        16: st.BirthVillage,
                        17: st.BirthCommune,
                        18: st.BirthDistrict,
                        19: st.BirthProvince,
                        20: st.FatherLastNameKh,
                        21: st.FatherFirstNameKh,
                        22: st.FatherOccupation,
                        23: st.MotherLastNameKh,
                        24: st.MotherFirstNameKh,
                        25: st.MotherOccupation,
                        26: st.CurrentVillage,
                        27: st.CurrentCommune,
                        28: st.CurrentDistrict,
                        29: st.CurrentProvince,
                        30: st.OrphanStatus === 'NONE' ? '—' : st.OrphanStatus,
                        31: st.DisabilityStatus === '4' ? '✓' : '—',
                        32: st.PovertyLevel === 'NONE' ? '—' : st.PovertyLevel,
                        33: enr?.ExamRoom || 'បន្ទប់-12C',
                        34: enr?.DeskNumber || String(rowNum),
                        35: st.Phone,
                        36: st.Remarks || st.StudentStatus,
                      };

                      return (
                        <tr
                          key={st.StudentID}
                          onClick={() => openViewStudentDrawer(st)}
                          className="hover:bg-indigo-50/40 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <td
                            className="py-2 px-3 border-r border-slate-200 bg-white sticky left-0 z-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openViewStudentDrawer(st)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] cursor-pointer"
                              >
                                <Eye className="w-3 h-3 text-indigo-600" />
                                <span>មើល</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditStudentDialog(st)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>កែប្រែ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingStudent(st)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>លុប</span>
                              </button>
                            </div>
                          </td>
                          {visible36Headers.map((h) => (
                            <td
                              key={`${st.StudentID}-col-${h.colNumber}`}
                              className={`py-2 px-3 border-r border-slate-100 tabular-nums ${
                                h.colNumber === 2 || h.colNumber === 5
                                  ? 'font-bold text-slate-900'
                                  : 'text-slate-700'
                              }`}
                            >
                              {all36Cells[h.colNumber]}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-khmer-body">
            <div className="text-slate-600">
              កំពុងបង្ហាញជួរដេកទី{' '}
              <span className="font-mono-tabular font-semibold text-slate-900">
                {filteredStudents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </span>{' '}
              ដល់{' '}
              <span className="font-mono-tabular font-semibold text-slate-900">
                {Math.min(currentPage * pageSize, filteredStudents.length)}
              </span>{' '}
              នៃសិស្សសរុប{' '}
              <span className="font-mono-tabular font-bold text-indigo-700">
                {filteredStudents.length}
              </span>{' '}
              នាក់
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>ទំព័រមុន</span>
              </button>
              <span className="px-3 py-1.5 font-mono-tabular font-semibold text-slate-700">
                ទំព័រ {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold cursor-pointer"
              >
                <span>ទំព័របន្ទាប់</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* =================================================================== */
        /* 19-SHEET NORMALIZED DATABASE EXPLORER (LIVE_DATA / SCHEMA_COLUMNS)  */
        /* =================================================================== */
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Sidebar: 19 Sheets Navigator */}
          <aside className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                19 Google Sheets Tables
              </span>
              <span className="text-xs font-mono-tabular text-slate-500">
                19 / 19 Ready
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
              {DATABASE_SHEETS_SCHEMA.map((sheet) => {
                const rowCount = (db[sheet.sheetName] as unknown[])?.length ?? 0;
                const isSelected = selectedSheetName === sheet.sheetName;
                return (
                  <button
                    key={sheet.sheetName}
                    type="button"
                    onClick={() => setSelectedSheetName(sheet.sheetName)}
                    className={`w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-[#14171F] text-white'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-mono-tabular ${
                            isSelected ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {String(sheet.sheetNumber).padStart(2, '0')}.
                        </span>
                        <span className="text-xs font-semibold truncate">
                          {sheet.sheetName}
                        </span>
                      </div>
                      <div
                        className={`text-[11px] font-khmer-body truncate mt-0.5 ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {sheet.khmerTitle}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono-tabular shrink-0 ${
                        isSelected ? 'text-slate-200' : 'text-slate-500'
                      }`}
                    >
                      {rowCount} rows
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Panel: Selected Sheet Details */}
          <section className="lg:col-span-9 bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Sheet #{selectedSheetSchema.sheetNumber}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    {selectedSheetSchema.columns.length} Columns
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{sheetRows.length} Records</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5 font-khmer-body">
                  {selectedSheetSchema.sheetName} — {selectedSheetSchema.khmerTitle}
                </h3>
                <p className="text-xs text-slate-600 mt-1">{selectedSheetSchema.purpose}</p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start">
                <button
                  type="button"
                  onClick={() => setSubTab('MASTER_36_ROSTER')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer font-khmer-body"
                >
                  បញ្ជីសិស្សសរុប ៣៦ ជួរឈរ
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('LIVE_DATA')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer font-khmer-body ${
                    subTab === 'LIVE_DATA'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Table2 className="w-3.5 h-3.5" />
                    <span>ទិន្នន័យផ្ទាល់ (Live Rows)</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('SCHEMA_COLUMNS')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer font-khmer-body ${
                    subTab === 'SCHEMA_COLUMNS'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    <span>រចនាសម្ព័ន្ធជួរឈរ (Schema)</span>
                  </span>
                </button>
              </div>
            </div>

            {subTab === 'LIVE_DATA' && (
              <div className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold text-slate-500 border-r border-slate-200 w-10 text-center">
                        #
                      </th>
                      {selectedSheetSchema.columns.map((col) => (
                        <th
                          key={col.name}
                          className="py-2.5 px-3 font-semibold text-slate-800 border-r border-slate-200 whitespace-nowrap"
                        >
                          <div>{col.name}</div>
                          <div className="text-[11px] font-normal text-slate-500 font-khmer-body">
                            {col.khmerLabel}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-khmer-body">
                    {sheetRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={selectedSheetSchema.columns.length + 1}
                          className="py-10 text-center text-slate-500"
                        >
                          មិនមានទិន្នន័យត្រូវនឹងការស្វែងរកឡើយ។
                        </td>
                      </tr>
                    ) : (
                      sheetRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 text-center font-mono-tabular text-slate-400 border-r border-slate-100">
                            {rIdx + 1}
                          </td>
                          {selectedSheetSchema.columns.map((col) => {
                            const val = row[col.name];
                            const display =
                              val === null || val === undefined
                                ? '—'
                                : typeof val === 'boolean'
                                ? val
                                  ? 'TRUE'
                                  : 'FALSE'
                                : String(val);
                            return (
                              <td
                                key={col.name}
                                className="py-2 px-3 border-r border-slate-100 whitespace-nowrap max-w-[260px] truncate text-slate-800 tabular-nums"
                                title={display}
                              >
                                {display}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {subTab === 'SCHEMA_COLUMNS' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold text-slate-600 w-12">#</th>
                      <th className="py-2.5 px-4 font-semibold text-slate-800">Column Name</th>
                      <th className="py-2.5 px-4 font-semibold text-slate-800">Key / Relation</th>
                      <th className="py-2.5 px-4 font-semibold text-slate-800 font-khmer-body">
                        ឈ្មោះជួរឈរ (ខ្មែរ)
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-slate-800">Data Type</th>
                      <th className="py-2.5 px-4 font-semibold text-slate-800">
                        Specification & Purpose
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedSheetSchema.columns.map((col, idx) => (
                      <tr key={col.name} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono-tabular text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-mono-tabular font-semibold text-slate-900">
                          {col.name}
                        </td>
                        <td className="py-2.5 px-4 font-mono-tabular text-slate-600">
                          {col.keyType ? (
                            <span>
                              {col.keyType}
                              {col.references ? ` → ${col.references}` : ''}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-khmer-body text-slate-800">
                          {col.khmerLabel}
                        </td>
                        <td className="py-2.5 px-4 font-mono-tabular text-slate-600">
                          {col.dataType}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{col.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. STUDENT 36-COLUMN SIDE DRAWER / FULL DETAILS MODAL (4 CLEAN TABS)  */}
      {/* ===================================================================== */}
      {viewingStudent && (() => {
        const st = viewingStudent;
        const enr = db.Enrollments.find((e) => e.StudentID === st.StudentID);
        const cls = db.Classes.find((c) => c.ClassID === enr?.ClassID);
        const age = calculateStudentAge(st.DateOfBirth, 2026);

        return (
          <Modal
            isOpen={true}
            onClose={() => setViewingStudent(null)}
            title={`ប្រវត្តិរូបសិស្សលម្អិត (៣៦ ជួរឈរ)៖ ${st.FullNameKh}`}
            subtitle={`អត្តលេខ ${st.StudentCode} · ${st.FamilyNameEn} ${st.GivenNameEn} · ថ្នាក់ទី ${
              cls?.ClassName || '12C'
            }`}
            maxWidthClass="max-w-3xl"
            footer={
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    const target = st;
                    setViewingStudent(null);
                    openEditStudentDialog(target);
                  }}
                >
                  កែប្រែព័ត៌មានសិស្ស (Edit)
                </Button>
                <Button variant="primary" onClick={() => setViewingStudent(null)}>
                  បិទផ្ទាំងលម្អិត (Close)
                </Button>
              </>
            }
          >
            {/* 4 Clean Tabs Navigation */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl mb-5 font-khmer-body">
              <button
                type="button"
                onClick={() => setDetailTab('PERSONAL')}
                className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  detailTab === 'PERSONAL'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>១. ព័ត៌មានផ្ទាល់ខ្លួន</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('ACADEMIC')}
                className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  detailTab === 'ACADEMIC'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>២. ការសិក្សា & បន្ទប់ប្រឡង</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('ADDRESS')}
                className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  detailTab === 'ADDRESS'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>៣. កំណើត & អាសយដ្ឋាន</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('PARENTS_SOCIAL')}
                className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  detailTab === 'PARENTS_SOCIAL'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HeartHandshake className="w-3.5 h-3.5 shrink-0" />
                <span>៤. ឪពុកម្តាយ & សង្គម</span>
              </button>
            </div>

            {/* Tab 1: Personal Info & Photo (Cols 1-10, 35) */}
            {detailTab === 'PERSONAL' && (
              <div className="space-y-4 font-khmer-body text-xs">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                    {st.LastNameKh.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold text-slate-900">{st.FullNameKh}</div>
                    <div className="text-xs font-mono-tabular text-slate-500">
                      {st.FamilyNameEn} {st.GivenNameEn} · អត្តលេខ៖ {st.StudentCode}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-emerald-700">{st.StudentStatus}</div>
                    <div className="text-[11px] text-slate-500">ថ្នាក់ទី {cls?.ClassName || '12C'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500">ជួរឈរទី ២៖ អត្តលេខ</div>
                    <div className="font-mono-tabular font-bold text-slate-900 mt-0.5">
                      {st.StudentCode}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500">ជួរឈរទី ៣៖ គោត្តនាម</div>
                    <div className="font-bold text-slate-900 mt-0.5">{st.LastNameKh}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500">ជួរឈរទី ៤៖ នាមខ្លួន</div>
                    <div className="font-bold text-slate-900 mt-0.5">{st.FirstNameKh}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500">ជួរឈរទី ៥៖ គោត្តនាម និងនាម</div>
                    <div className="font-bold text-slate-900 mt-0.5">{st.FullNameKh}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500">ជួរឈរទី ៦៖ FAMILY NAME</div>
                    <div className="font-mono-tabular font-bold text-slate-900 mt-0.5">
                      {st.FamilyNameEn}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500">ជួរឈរទី ៧៖ GIVEN NAME</div>
                    <div className="font-mono-tabular font-bold text-slate-900 mt-0.5">
                      {st.GivenNameEn}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500">ជួរឈរទី ៨៖ ភេទ</div>
                    <div className="font-bold text-slate-900 mt-0.5">{st.Gender}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500">ជួរឈរទី ៩៖ ថ្ងៃខែឆ្នាំកំណើត</div>
                    <div className="font-mono-tabular font-bold text-slate-900 mt-0.5">
                      {formatDateKhmerDisplay(st.DateOfBirth)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500">ជួរឈរទី ១០៖ អាយុ</div>
                    <div className="font-mono-tabular font-bold text-slate-900 mt-0.5">
                      {age} ឆ្នាំ
                    </div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200 col-span-2 sm:col-span-3">
                    <div className="text-slate-500">ជួរឈរទី ៣៥៖ លេខទូរសព្ទទំនាក់ទំនង</div>
                    <div className="font-mono-tabular font-bold text-slate-900 mt-0.5">
                      {st.Phone || '—'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Academic & Exam Room Seating (Cols 11-15, 33-34, 36) */}
            {detailTab === 'ACADEMIC' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-khmer-body text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200">
                  <div className="text-slate-500">ជួរឈរទី ១១៖ ថ្នាក់បច្ចុប្បន្ន</div>
                  <div className="font-mono-tabular font-bold text-indigo-700 text-sm mt-0.5">
                    ថ្នាក់ទី {cls?.ClassName || '12C'}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200">
                  <div className="text-slate-500">ជួរឈរទី ១២៖ ថ្នាក់ឆ្នាំមុន</div>
                  <div className="font-mono-tabular font-bold text-slate-900 mt-0.5">
                    {enr?.PreviousClass || '11C'}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200">
                  <div className="text-slate-500">ជួរឈរទី ១៣៖ មកពីសាលា</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {st.PreviousSchool || 'វិទឹកជោរ'}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200">
                  <div className="text-slate-500">ជួរឈរទី ១៤៖ សិស្សផ្ទេរចូលថ្មី</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {enr?.IsNewTransfer ? 'ផ្ទេរចូលថ្មី (1)' : 'សិស្សចាស់ (—)'}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200">
                  <div className="text-slate-500">ជួរឈរទី ១៥៖ សិស្សត្រួតថ្នាក់</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {enr?.IsRepeater ? 'ត្រួតថ្នាក់ (1)' : 'មិនត្រួតថ្នាក់ (—)'}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200">
                  <div className="text-slate-500">ជួរឈរទី ៣៣៖ បន្ទប់ប្រឡង</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {enr?.ExamRoom || `បន្ទប់-${cls?.ClassName || '12C'}`}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200">
                  <div className="text-slate-500">ជួរឈរទី ៣៤៖ លេខតុប្រឡង</div>
                  <div className="font-mono-tabular font-bold text-slate-900 mt-0.5">
                    តុលេខ {enr?.DeskNumber || '1'}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 col-span-2">
                  <div className="text-slate-500">ជួរឈរទី ៣៦៖ ផ្សេងៗ / ស្ថានភាពសិក្សា</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {st.StudentStatus} {st.Remarks ? `(${st.Remarks})` : ''}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Birthplace & Current Address (Cols 16-19, 26-29) */}
            {detailTab === 'ADDRESS' && (
              <div className="space-y-4 font-khmer-body text-xs">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="font-bold text-slate-900">
                    ទីកន្លែងកំណើត (Place of Birth — ជួរឈរទី ១៦ ដល់ ១៩)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <div className="text-slate-500">១៦. ភូមិកំណើត</div>
                      <div className="font-bold text-slate-900 mt-0.5">{st.BirthVillage}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">១៧. ឃុំ/សង្កាត់កំណើត</div>
                      <div className="font-bold text-slate-900 mt-0.5">{st.BirthCommune}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">១៨. ស្រុក/ក្រុងកំណើត</div>
                      <div className="font-bold text-slate-900 mt-0.5">{st.BirthDistrict}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">១៩. ខេត្ត/រាជធានីកំណើត</div>
                      <div className="font-bold text-slate-900 mt-0.5">{st.BirthProvince}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="font-bold text-slate-900">
                    អាសយដ្ឋានបច្ចុប្បន្ន (Current Address — ជួរឈរទី ២៦ ដល់ ២៩)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <div className="text-slate-500">២៦. ភូមិបច្ចុប្បន្ន</div>
                      <div className="font-bold text-slate-900 mt-0.5">{st.CurrentVillage}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">២៧. ឃុំ/សង្កាត់បច្ចុប្បន្ន</div>
                      <div className="font-bold text-slate-900 mt-0.5">{st.CurrentCommune}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">២៨. ស្រុក/ក្រុងបច្ចុប្បន្ន</div>
                      <div className="font-bold text-slate-900 mt-0.5">{st.CurrentDistrict}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">២៩. ខេត្ត/រាជធានីបច្ចុប្បន្ន</div>
                      <div className="font-bold text-slate-900 mt-0.5">{st.CurrentProvince}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Parents & Social Indicators (Cols 20-25, 30-32) */}
            {detailTab === 'PARENTS_SOCIAL' && (
              <div className="space-y-4 font-khmer-body text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-900">
                      ព័ត៌មានឪពុក (Father — ជួរឈរទី ២០ ដល់ ២២)
                    </div>
                    <div>
                      <span className="text-slate-500">គោត្តនាម និងនាមឪពុក៖ </span>
                      <span className="font-bold text-slate-900">
                        {st.FatherLastNameKh} {st.FatherFirstNameKh}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">មុខរបរឪពុក៖ </span>
                      <span className="font-bold text-slate-900">{st.FatherOccupation}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-900">
                      ព័ត៌មានម្តាយ (Mother — ជួរឈរទី ២៣ ដល់ ២៥)
                    </div>
                    <div>
                      <span className="text-slate-500">គោត្តនាម និងនាមម្តាយ៖ </span>
                      <span className="font-bold text-slate-900">
                        {st.MotherLastNameKh} {st.MotherFirstNameKh}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">មុខរបរម្តាយ៖ </span>
                      <span className="font-bold text-slate-900">{st.MotherOccupation}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="font-bold text-slate-900">
                    ស្ថានភាពសង្គម (Social Indicators — ជួរឈរទី ៣០ ដល់ ៣២)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50">
                      <div className="text-slate-500">៣០. ស្ថានភាពកំព្រា (Orphan)</div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {st.OrphanStatus === 'NONE'
                          ? 'ធម្មតា (មិនកំព្រា)'
                          : `កំព្រា កម្រិត ${st.OrphanStatus}`}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <div className="text-slate-500">៣១. ពិការភាព (Disability)</div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {st.DisabilityStatus === '4' ? 'ពិការ (✓)' : 'គ្មានពិការភាព'}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <div className="text-slate-500">៣២. កម្រិតក្រីក្រ (Poverty)</div>
                      <div className="font-bold text-amber-700 mt-0.5">
                        {st.PovertyLevel === 'NONE'
                          ? 'ធម្មតា'
                          : `បណ្ណក្រីក្រ ${st.PovertyLevel}`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Modal>
        );
      })()}

      {/* Hidden Print-Only Sheet so native Ctrl+P / window.print() always outputs the A4 Roster */}
      <div className="hidden print-only print-master-roster-sheet font-khmer-body text-black">
        <div className="flex justify-between items-start gap-4 mb-3">
          <div className="text-xs leading-relaxed">
            <div className="font-khmer-moul text-xs">
              មន្ទីរអប់រំយុវជន និងកីឡាខេត្តបន្ទាយមានជ័យ
            </div>
            <div className="font-semibold">ការិយាល័យអប់រំ នៃរដ្ឋបាលស្រុកព្រះនេត្រព្រះ</div>
            <div className="font-khmer-moul text-xs">វិទ្យាល័យទឹកជោរ</div>
          </div>
          <div className="text-center leading-relaxed">
            <div className="font-khmer-moul text-xs">ព្រះរាជាណាចក្រកម្ពុជា</div>
            <div className="font-khmer-moul text-[11px]">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
          </div>
        </div>
        <div className="text-center mb-3">
          <div className="font-khmer-moul text-sm">បញ្ជីសិស្សសរុប (Master Student Roster)</div>
          <div className="text-xs font-semibold">
            {activeClassRecord
              ? `ថ្នាក់ទី ${activeClassRecord.ClassName}`
              : 'គ្រប់ថ្នាក់ទាំង ១៧ (7A–12C)'}{' '}
            · ឆ្នាំសិក្សា ២០២៥–២០២៦
          </div>
        </div>
        <table className="print-master-roster-table">
          <thead>
            <tr>
              <th>ល.រ</th>
              <th>អត្តលេខ</th>
              <th>គោត្តនាម និងនាម</th>
              <th>ឈ្មោះឡាតាំង</th>
              <th>ភេទ</th>
              <th>ថ្ងៃខែឆ្នាំកំណើត</th>
              <th>អាយុ</th>
              <th>ថ្នាក់</th>
              <th>ភូមិបច្ចុប្បន្ន</th>
              <th>ក្រីក្រ/កំព្រា</th>
              <th>ទូរសព្ទ</th>
              <th>ស្ថានភាព</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((st, idx) => {
              const enr = db.Enrollments.find((e) => e.StudentID === st.StudentID);
              const cls = db.Classes.find((c) => c.ClassID === enr?.ClassID);
              const age = calculateStudentAge(st.DateOfBirth, 2026);
              return (
                <tr key={st.StudentID}>
                  <td className="text-center">{idx + 1}</td>
                  <td className="text-center font-bold">{st.StudentCode}</td>
                  <td className="font-bold">{st.FullNameKh}</td>
                  <td>
                    {st.FamilyNameEn} {st.GivenNameEn}
                  </td>
                  <td className="text-center">{st.Gender}</td>
                  <td className="text-center">{formatDateKhmerDisplay(st.DateOfBirth)}</td>
                  <td className="text-center">{age}</td>
                  <td className="text-center font-bold">{cls?.ClassName || '12C'}</td>
                  <td>{st.CurrentVillage}</td>
                  <td className="text-center">
                    {st.PovertyLevel !== 'NONE' ? st.PovertyLevel : '—'}
                  </td>
                  <td className="text-center">{st.Phone || '—'}</td>
                  <td className="text-center">{st.StudentStatus}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 text-xs font-semibold">
          សិស្សសរុប៖ {rosterSummary.total} នាក់ (ស្រី {rosterSummary.female} នាក់) · កំពុងរៀន៖{' '}
          {rosterSummary.activeTotal} នាក់ (ស្រី {rosterSummary.activeFemale} នាក់)
        </div>
        <div className="grid grid-cols-2 gap-6 mt-4 text-xs">
          <div className="text-center">
            <div>បានឃើញ និងពិនិត្យត្រឹមត្រូវ</div>
            <div className="font-khmer-moul">នាយកសាលា</div>
            <div className="pt-8 font-bold">{principalNameSetting}</div>
          </div>
          <div className="text-center">
            <div>{defaultLunarDateSetting}</div>
            <div>{defaultSolarDateSetting}</div>
            <div className="font-khmer-moul">គ្រូបន្ទុកថ្នាក់</div>
            <div className="pt-8 font-bold">
              {activeHomeroomTeacher?.FullNameKh || 'ជួន លីរតនៈ'}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 6. MODAL: ADD STUDENT (4 CLEAN TABS COVERING ALL 36 COLUMNS)          */}
      {/* ===================================================================== */}
      <Modal
        isOpen={showAddStudentModal}
        onClose={() => setShowAddStudentModal(false)}
        title="បន្ថែមសិស្សថ្មី"
        subtitle="បំពេញព័ត៌មានសិស្ស (ចំណុចមានសញ្ញា * គឺចាំបាច់)"
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAddStudentModal(false)}>
              <X className="w-3.5 h-3.5 mr-1 inline" />
              បោះបង់
            </Button>
            <Button variant="primary" onClick={handleCreateStudentSubmit}>
              <Check className="w-3.5 h-3.5 mr-1 inline" />
              រក្សាទុកសិស្សថ្មី
            </Button>
          </>
        }
      >
        {formError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-khmer-body">
            {formError}
          </div>
        )}

        {/* 4 Tabs inside Add Student Modal with Clear Icons */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl mb-4 font-khmer-body">
          <button
            type="button"
            onClick={() => setFormTab('PERSONAL')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold cursor-pointer ${
              formTab === 'PERSONAL' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
            }`}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span>ព័ត៌មានផ្ទាល់ខ្លួន</span>
          </button>
          <button
            type="button"
            onClick={() => setFormTab('ACADEMIC')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold cursor-pointer ${
              formTab === 'ACADEMIC' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
            <span>ការសិក្សា</span>
          </button>
          <button
            type="button"
            onClick={() => setFormTab('ADDRESS')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold cursor-pointer ${
              formTab === 'ADDRESS' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>អាសយដ្ឋាន</span>
          </button>
          <button
            type="button"
            onClick={() => setFormTab('PARENTS_SOCIAL')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold cursor-pointer ${
              formTab === 'PARENTS_SOCIAL'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5 shrink-0" />
            <span>ឪពុកម្តាយ & សង្គម</span>
          </button>
        </div>

        <form onSubmit={handleCreateStudentSubmit} className="space-y-4 text-xs font-khmer-body">
          {formTab === 'PERSONAL' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="input-student-code"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    អត្តលេខ (StudentCode) <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    id="input-student-code"
                    type="text"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    placeholder="ឧ. 6690"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-last-kh"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    គោត្តនាម (LastNameKh) <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    id="input-last-kh"
                    type="text"
                    value={lastNameKh}
                    onChange={(e) => setLastNameKh(e.target.value)}
                    placeholder="ឧ. សុខ"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-first-kh"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    នាមខ្លួន (FirstNameKh) <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    id="input-first-kh"
                    type="text"
                    value={firstNameKh}
                    onChange={(e) => setFirstNameKh(e.target.value)}
                    placeholder="ឧ. ស្រីម៉ៅ"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    FAMILY NAME (ឡាតាំង)
                  </label>
                  <input
                    type="text"
                    value={familyNameEn}
                    onChange={(e) => setFamilyNameEn(e.target.value)}
                    placeholder="SOK"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    GIVEN NAME (ឡាតាំង)
                  </label>
                  <input
                    type="text"
                    value={givenNameEn}
                    onChange={(e) => setGivenNameEn(e.target.value)}
                    placeholder="SREYMAO"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="input-gender"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    ភេទ (Gender)
                  </label>
                  <select
                    id="input-gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as GenderKh)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="ស្រី">ស្រី (Female)</option>
                    <option value="ប្រុស">ប្រុស (Male)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="input-dob" className="block font-semibold text-slate-700 mb-1">
                    ថ្ងៃខែឆ្នាំកំណើត (DOB) <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    id="input-dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-phone"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    លេខទូរសព្ទ
                  </label>
                  <input
                    id="input-phone"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="012 345 678"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
                  />
                </div>
              </div>
            </div>
          )}

          {formTab === 'ACADEMIC' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="input-class" className="block font-semibold text-slate-700 mb-1">
                  ថ្នាក់រៀន (Class 7A–12C)
                </label>
                <select
                  id="input-class"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {db.Classes.map((c) => (
                    <option key={c.ClassID} value={c.ClassID}>
                      ថ្នាក់ទី {c.ClassName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="input-prev-school"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  មកពីសាលា (PreviousSchool)
                </label>
                <input
                  id="input-prev-school"
                  type="text"
                  value={previousSchool}
                  onChange={(e) => setPreviousSchool(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">បន្ទប់ប្រឡង</label>
                <input
                  type="text"
                  value={examRoom}
                  onChange={(e) => setExamRoom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">លេខតុប្រឡង</label>
                <input
                  type="text"
                  value={deskNumber}
                  onChange={(e) => setDeskNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="input-avg" className="block font-semibold text-slate-700 mb-1">
                  មធ្យមភាគខែដំបូង (ម.ភាគ 0.00–50.00)
                </label>
                <input
                  id="input-avg"
                  type="number"
                  step="0.01"
                  value={monthlyAverage}
                  onChange={(e) => setMonthlyAverage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
                />
              </div>
            </div>
          )}

          {formTab === 'ADDRESS' && (
            <div className="space-y-3">
              <div className="font-bold text-slate-800">ទីកន្លែងកំណើត (ជួរឈរទី ១៦–១៩)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-slate-600 mb-1">ភូមិកំណើត</label>
                  <input
                    type="text"
                    value={birthVillage}
                    onChange={(e) => setBirthVillage(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">ឃុំកំណើត</label>
                  <input
                    type="text"
                    value={birthCommune}
                    onChange={(e) => setBirthCommune(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">ស្រុកកំណើត</label>
                  <input
                    type="text"
                    value={birthDistrict}
                    onChange={(e) => setBirthDistrict(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">ខេត្តកំណើត</label>
                  <input
                    type="text"
                    value={birthProvince}
                    onChange={(e) => setBirthProvince(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="font-bold text-slate-800 pt-2">អាសយដ្ឋានបច្ចុប្បន្ន (ជួរឈរទី ២៦–២៩)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label htmlFor="input-village" className="block text-slate-600 mb-1">
                    ភូមិបច្ចុប្បន្ន
                  </label>
                  <input
                    id="input-village"
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">ឃុំបច្ចុប្បន្ន</label>
                  <input
                    type="text"
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">ស្រុកបច្ចុប្បន្ន</label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">ខេត្តបច្ចុប្បន្ន</label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {formTab === 'PARENTS_SOCIAL' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ឈ្មោះឪពុក</label>
                  <input
                    type="text"
                    value={fatherNameKh}
                    onChange={(e) => setFatherNameKh(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">មុខរបរឪពុក</label>
                  <input
                    type="text"
                    value={fatherOccupation}
                    onChange={(e) => setFatherOccupation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ឈ្មោះម្តាយ</label>
                  <input
                    type="text"
                    value={motherNameKh}
                    onChange={(e) => setMotherNameKh(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">មុខរបរម្តាយ</label>
                  <input
                    type="text"
                    value={motherOccupation}
                    onChange={(e) => setMotherOccupation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label
                    htmlFor="input-orphan"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    ស្ថានភាពកំព្រា (Orphan)
                  </label>
                  <select
                    id="input-orphan"
                    value={orphanStatus}
                    onChange={(e) => setOrphanStatus(e.target.value as OrphanStatusCode)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="NONE">ធម្មតា (None)</option>
                    <option value="1">1 = កំព្រាឪពុក</option>
                    <option value="2">2 = កំព្រាម្តាយ</option>
                    <option value="3">3 = កំព្រាឪពុក/ម្តាយ</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="input-disability"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    ពិការភាព (Disability)
                  </label>
                  <select
                    id="input-disability"
                    value={disabilityStatus}
                    onChange={(e) => setDisabilityStatus(e.target.value as DisabilityStatusCode)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="NONE">គ្មាន (None)</option>
                    <option value="4">4 = ពិការ (✓)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="input-poverty"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    កម្រិតក្រីក្រ (Poverty)
                  </label>
                  <select
                    id="input-poverty"
                    value={povertyLevel}
                    onChange={(e) => setPovertyLevel(e.target.value as PovertyLevelCode)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="NONE">ធម្មតា (None)</option>
                    <option value="ក១">ក១ (ក្រីក្រកម្រិត១)</option>
                    <option value="ក២">ក២ (ក្រីក្រកម្រិត២)</option>
                    <option value="5">5 (ងាយរងគ្រោះ)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* ===================================================================== */}
      {/* 7. MODAL: EDIT EXISTING STUDENT RECORD (4 CLEAN TABS)                 */}
      {/* ===================================================================== */}
      <Modal
        isOpen={Boolean(editingStudent)}
        onClose={() => setEditingStudent(null)}
        title={`កែប្រែព័ត៌មានសិស្ស៖ ${editingStudent?.FullNameKh || ''}`}
        subtitle="ធ្វើបច្ចុប្បន្នភាពព័ត៌មានក្នុងសន្លឹកទិន្នន័យ Students និង Enrollments"
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingStudent(null)}>
              បោះបង់ (Cancel)
            </Button>
            <Button variant="primary" onClick={handleEditStudentSubmit}>
              រក្សាទុកការកែប្រែ (Save Changes)
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl mb-4 font-khmer-body">
          <button
            type="button"
            onClick={() => setEditModalTab('PERSONAL')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold cursor-pointer ${
              editModalTab === 'PERSONAL'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            ១. ព័ត៌មានផ្ទាល់ខ្លួន
          </button>
          <button
            type="button"
            onClick={() => setEditModalTab('ACADEMIC')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold cursor-pointer ${
              editModalTab === 'ACADEMIC'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            ២. ការសិក្សា & ស្ថានភាព
          </button>
          <button
            type="button"
            onClick={() => setEditModalTab('ADDRESS')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold cursor-pointer ${
              editModalTab === 'ADDRESS' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
            }`}
          >
            ៣. អាសយដ្ឋាន
          </button>
          <button
            type="button"
            onClick={() => setEditModalTab('PARENTS_SOCIAL')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold cursor-pointer ${
              editModalTab === 'PARENTS_SOCIAL'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            ៤. ស្ថានភាពសង្គម
          </button>
        </div>

        <form onSubmit={handleEditStudentSubmit} className="space-y-4 text-xs font-khmer-body">
          {editModalTab === 'PERSONAL' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  អត្តលេខ (StudentCode)
                </label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  គោត្តនាម (LastNameKh)
                </label>
                <input
                  type="text"
                  value={editLastKh}
                  onChange={(e) => setEditLastKh(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  នាមខ្លួន (FirstNameKh)
                </label>
                <input
                  type="text"
                  value={editFirstKh}
                  onChange={(e) => setEditFirstKh(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ភេទ (Gender)</label>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value as GenderKh)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ស្រី">ស្រី (Female)</option>
                  <option value="ប្រុស">ប្រុស (Male)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ថ្ងៃខែឆ្នាំកំណើត</label>
                <input
                  type="date"
                  value={editDob}
                  onChange={(e) => setEditDob(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">លេខទូរសព្ទ</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
                />
              </div>
            </div>
          )}

          {editModalTab === 'ACADEMIC' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ថ្នាក់រៀន (Class)</label>
                <select
                  value={editClassId}
                  onChange={(e) => setEditClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {db.Classes.map((c) => (
                    <option key={c.ClassID} value={c.ClassID}>
                      ថ្នាក់ទី {c.ClassName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ស្ថានភាពសិស្ស (Status)
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as StudentStatusKh)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="កំពុងរៀន">កំពុងរៀន (Studying)</option>
                  <option value="ផ្ទេរចេញ">ផ្ទេរចេញ (Transferred Out)</option>
                  <option value="ឈប់រៀន">ឈប់រៀន (Dropped Out)</option>
                </select>
              </div>
            </div>
          )}

          {editModalTab === 'ADDRESS' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">ភូមិបច្ចុប្បន្ន</label>
              <input
                type="text"
                value={editVillage}
                onChange={(e) => setEditVillage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          )}

          {editModalTab === 'PARENTS_SOCIAL' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ស្ថានភាពកំព្រា</label>
                <select
                  value={editOrphan}
                  onChange={(e) => setEditOrphan(e.target.value as OrphanStatusCode)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="NONE">ធម្មតា (None)</option>
                  <option value="1">1 = កំព្រាឪពុក</option>
                  <option value="2">2 = កំព្រាម្តាយ</option>
                  <option value="3">3 = កំព្រាឪពុក/ម្តាយ</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ពិការភាព</label>
                <select
                  value={editDisability}
                  onChange={(e) => setEditDisability(e.target.value as DisabilityStatusCode)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="NONE">គ្មាន (None)</option>
                  <option value="4">4 = ពិការ (✓)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">កម្រិតក្រីក្រ</label>
                <select
                  value={editPoverty}
                  onChange={(e) => setEditPoverty(e.target.value as PovertyLevelCode)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="NONE">ធម្មតា (None)</option>
                  <option value="ក១">ក១ (ក្រីក្រកម្រិត១)</option>
                  <option value="ក២">ក២ (ក្រីក្រកម្រិត២)</option>
                  <option value="5">5 (ងាយរងគ្រោះ)</option>
                </select>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Modal 3: Import Students Data from Excel / CSV & Sync to Google Sheets via Google Apps Script */}
      <Modal
        isOpen={showImportExcelModal}
        onClose={() => setShowImportExcelModal(false)}
        title="នាំចូលទិន្នន័យសិស្សពី Excel / CSV និង Sync ទៅ Google Sheets (Import Students Data)"
        subtitle="ទាញយកគម្រូតារាង Excel ៣៦ ជួរឈរ បញ្ចូលទិន្នន័យសិស្ស និងធ្វើសមកាលកម្ម (Sync) ទៅក្នុង Google Sheets Database តាមរយៈ Google Apps Script"
        maxWidthClass="max-w-5xl"
        footer={
          <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-slate-600 font-khmer-body flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                គោលដៅ Sync៖ <strong>Students, Enrollments, MonthlyScores, AnnualResults, Users, AuditLogs</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setShowImportExcelModal(false)}>
                បោះបង់ (Cancel)
              </Button>
              <Button
                variant="primary"
                onClick={handleExecuteBulkImportAndGasSync}
                disabled={isSyncingToGas}
              >
                {isSyncingToGas
                  ? 'កំពុង Sync ទៅ Google Sheets...'
                  : importedPreviewRows.filter((r) => r.isValid).length > 0
                    ? `🚀 នាំចូល និង Sync ទៅ Google Sheets (${importedPreviewRows.filter((r) => r.isValid).length} នាក់)`
                    : '🚀 នាំចូលសិស្សគំរូ និង Sync ទៅ Google Sheets ឥឡូវនេះ'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs font-khmer-body">
          {/* Error Banner */}
          {importErrorBanner && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{importErrorBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setImportErrorBanner(null)}
                className="px-2 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 cursor-pointer"
              >
                បិទ
              </button>
            </div>
          )}

          {/* STEP 1: Download Excel Template & Configure Target Class / GAS Sync */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>ជំហានទី ១៖ ទាញយកគម្រូតារាង Excel ផ្លូវការ (៣៦ ជួរឈរ - វិទ្យាល័យទឹកជោរ)</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  ទាញយកឯកសារគម្រូ Excel (.xlsx) ដែលមានក្បាលតារាងភាសាខ្មែរទាំង ៣៦ ជួរឈរ និងសន្លឹកសេចក្តីណែនាំ រួចបំពេញឈ្មោះសិស្សដើម្បីនាំចូល។
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const clsName = targetImportClassObj?.ClassName || '12C';
                    const file = downloadStudentExcelTemplate(clsName);
                    setStatusBanner(`បានទាញយកគម្រូតារាង Excel "${file}" រួចរាល់!`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>📥 ទាញយកគម្រូតារាង Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const clsName = targetImportClassObj?.ClassName || '12C';
                    const file = downloadStudentCsvTemplate(clsName);
                    setStatusBanner(`បានទាញយកគម្រូតារាង CSV "${file}" រួចរាល់!`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  <span>📄 ទាញយកគម្រូ CSV (.csv)</span>
                </button>
              </div>
            </div>

            {/* Target Class & Import Options Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-emerald-200/70">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ថ្នាក់រៀនគោលដៅ (Target Class 7A–12C)
                </label>
                <select
                  value={importTargetClassId}
                  onChange={(e) => setImportTargetClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-semibold"
                >
                  {db.Classes.map((c) => (
                    <option key={c.ClassID} value={c.ClassID}>
                      ថ្នាក់ទី {c.ClassName} (Grade {c.GradeLevel})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 w-full cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwriteDuplicates}
                    onChange={(e) => setOverwriteDuplicates(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                  <span className="text-slate-700 font-semibold">
                    ធ្វើបច្ចុប្បន្នភាពបើអត្តលេខមានស្រាប់ (Upsert)
                  </span>
                </label>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 w-full cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoProvisionStudentAccounts}
                    onChange={(e) => setAutoProvisionStudentAccounts(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <span className="text-slate-700 font-semibold">
                    បង្កើតគណនីសិស្សស្វ័យប្រវត្តិ (Username = អត្តលេខ)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* STEP 2: Mode Selector Tabs (Upload Excel/CSV File vs Paste from Excel/Google Sheets vs GAS Script) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setImportModeTab('FILE_UPLOAD')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                    importModeTab === 'FILE_UPLOAD'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📂 ជ្រើសរើសឯកសារ Excel / CSV
                </button>
                <button
                  type="button"
                  onClick={() => setImportModeTab('PASTE_TEXT')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                    importModeTab === 'PASTE_TEXT'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📋 Paste ពី Excel / Google Sheets
                </button>
                <button
                  type="button"
                  onClick={() => setImportModeTab('GAS_SCRIPT_CODE')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                    importModeTab === 'GAS_SCRIPT_CODE'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚙️ ភ្ជាប់ Google Apps Script (Google Sheet Sync)
                </button>
              </div>

              <button
                type="button"
                onClick={handleLoadSampleRowsIntoPreview}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>⚡ ផ្ទុកទិន្នន័យសិស្សគំរូ ៣ នាក់ដើម្បីសាកល្បងភ្លាមៗ</span>
              </button>
            </div>

            {/* Tab 1: Upload Excel (.xlsx / .xls) or CSV (.csv) */}
            {importModeTab === 'FILE_UPLOAD' && (
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl bg-slate-50/70 p-5 text-center transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelOrCsvFileSelect}
                  className="hidden"
                  id="student-excel-file-input"
                />
                <Upload className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <div className="text-sm font-bold text-slate-900">
                  ជ្រើសរើសឯកសារតារាងបញ្ជីសិស្ស Excel (.xlsx, .xls) ឬ CSV (.csv)
                </div>
                <p className="text-slate-500 mt-1 max-w-xl mx-auto">
                  ប្រព័ន្ធនឹងអានទិន្នន័យសិស្សទាំង ៣៦ ជួរឈរដោយស្វ័យប្រវត្តិ ពិនិត្យអត្តលេខ ភេទ ថ្ងៃខែឆ្នាំកំណើត និងបង្ហាញតារាងផ្ទៀងផ្ទាត់ខាងក្រោមមុនពេល Sync ចូល Google Sheets។
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
                  <label
                    htmlFor="student-excel-file-input"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#14171F] hover:bg-slate-800 text-white font-bold cursor-pointer shadow-xs transition-colors"
                  >
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>ជ្រើសរើសឯកសារពីកុំព្យូទ័រ (.xlsx / .csv)</span>
                  </label>
                  {uploadedFileName && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{uploadedFileName}</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Paste directly from Excel or Google Sheets */}
            {importModeTab === 'PASTE_TEXT' && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    ចម្លង (Copy) ជួរដេកសិស្សពីកម្មវិធី Excel ឬ Google Sheets រួច Paste នៅទីនេះ៖
                  </label>
                  <button
                    type="button"
                    onClick={handleParsePastedRows}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                  >
                    បំប្លែងទិន្នន័យ (Parse Rows)
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={pasteRawText}
                  onChange={(e) => setPasteRawText(e.target.value)}
                  placeholder="ឧទាហរណ៍៖ 6805	សុខ	ចាន់ធីតា	ស្រី	2009-05-14	12C	012 345 678"
                  className="w-full p-3 rounded-xl border border-slate-300 bg-white font-mono-tabular text-xs focus:outline-none focus:border-indigo-600"
                />
              </div>
            )}

            {/* Tab 3: Google Apps Script Endpoint & Code Configuration */}
            {importModeTab === 'GAS_SCRIPT_CODE' && (
              <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="inline-flex items-center gap-2 text-emerald-400 font-bold">
                      <Link2 className="w-4 h-4" />
                      <span>ការភ្ជាប់ទៅកាន់ Google Sheets តាមរយៈ Google Apps Script (Web App / HtmlService)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      ប្រសិនបើដំណើរការក្នុង Google Apps Script HtmlService ប្រព័ន្ធប្រើ <code className="text-amber-300">google.script.run.apiDispatch</code> ដោយស្វ័យប្រវត្តិ ឬភ្ជាប់តាម Web App URL (<code className="text-amber-300">doPost</code>) ខាងក្រោម៖
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono-tabular">
                    {isGasEnvironmentAvailable()
                      ? '🟢 Connected: google.script.run'
                      : '🟢 Ready: Web App Sync + Local 19-Sheet DB'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={gasEndpointDraft}
                    onChange={(e) => setGasEndpointDraft(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono-tabular text-xs focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveGasEndpointUrl}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shrink-0"
                  >
                    រក្សាទុក Web App URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const codeModule = GAS_BACKEND_MODULES.find(
                        (m) => m.filename === 'StudentService.gs'
                      );
                      if (codeModule && navigator.clipboard) {
                        navigator.clipboard.writeText(codeModule.code);
                        setCopiedGasScript(true);
                        setTimeout(() => setCopiedGasScript(false), 2500);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold cursor-pointer shrink-0"
                  >
                    {copiedGasScript ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>បានចម្លង StudentService.gs!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-indigo-400" />
                        <span>ចម្លងកូដ StudentService.gs</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: Interactive Preview & Validation Table before Importing */}
          {importedPreviewRows.length > 0 && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-slate-900">
                    តារាងត្រួតពិនិត្យទិន្នន័យសិស្សមុននាំចូល ({importedPreviewRows.length} ជួរដេក)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                    ត្រឹមត្រូវ៖ {importedPreviewRows.filter((r) => r.isValid).length} នាក់
                  </span>
                  {importedPreviewRows.some((r) => r.isDuplicateInDb) && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                      មានអត្តលេខស្រាប់៖ {importedPreviewRows.filter((r) => r.isDuplicateInDb).length} នាក់
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setImportedPreviewRows([]);
                    setUploadedFileName('');
                  }}
                  className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  សម្អាតតារាង (Clear Preview)
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto overflow-x-auto">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
                    <tr>
                      <th className="py-2 px-2.5 border-b border-slate-200 text-center">ល.រ</th>
                      <th className="py-2 px-2.5 border-b border-slate-200">អត្តលេខ</th>
                      <th className="py-2 px-2.5 border-b border-slate-200">គោត្តនាម និងនាម</th>
                      <th className="py-2 px-2.5 border-b border-slate-200">ឈ្មោះឡាតាំង</th>
                      <th className="py-2 px-2.5 border-b border-slate-200 text-center">ភេទ</th>
                      <th className="py-2 px-2.5 border-b border-slate-200 text-center">ថ្ងៃកំណើត</th>
                      <th className="py-2 px-2.5 border-b border-slate-200 text-center">ថ្នាក់</th>
                      <th className="py-2 px-2.5 border-b border-slate-200">ភូមិបច្ចុប្បន្ន</th>
                      <th className="py-2 px-2.5 border-b border-slate-200">ទូរសព្ទ</th>
                      <th className="py-2 px-2.5 border-b border-slate-200 text-center">ស្ថានភាព Sync</th>
                      <th className="py-2 px-2.5 border-b border-slate-200 text-center">លុប</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importedPreviewRows.map((r, i) => (
                      <tr
                        key={`${r.studentCode}-${i}`}
                        className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/60'}
                      >
                        <td className="py-1.5 px-2.5 text-center font-mono-tabular">{i + 1}</td>
                        <td className="py-1.5 px-2.5 font-mono-tabular font-bold text-indigo-700">
                          {r.studentCode || '—'}
                        </td>
                        <td className="py-1.5 px-2.5 font-bold text-slate-900">
                          {r.lastNameKh} {r.firstNameKh}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono-tabular text-slate-600">
                          {r.familyNameEn} {r.givenNameEn}
                        </td>
                        <td className="py-1.5 px-2.5 text-center">{r.gender}</td>
                        <td className="py-1.5 px-2.5 text-center font-mono-tabular">
                          {r.dateOfBirth}
                        </td>
                        <td className="py-1.5 px-2.5 text-center font-mono-tabular font-bold">
                          {r.className}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-600">{r.currentVillage}</td>
                        <td className="py-1.5 px-2.5 font-mono-tabular text-slate-600">{r.phone}</td>
                        <td className="py-1.5 px-2.5 text-center">
                          {!r.isValid ? (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold">
                              {r.validationErrors.join(', ')}
                            </span>
                          ) : r.isDuplicateInDb ? (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                              {overwriteDuplicates ? 'Update សិស្សមានស្រាប់' : 'រំលង (Skip)'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                              ត្រៀម Sync ថ្មី
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setImportedPreviewRows((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="ដកជួរដេកនេះចេញ"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal 4: Create New Class */}
      <Modal
        isOpen={showCreateClassModal}
        onClose={() => setShowCreateClassModal(false)}
        title="បន្ថែមថ្នាក់រៀនថ្មី (ClassService.createClass)"
        subtitle="បន្ថែមថ្នាក់រៀនថ្មីចូលក្នុងសន្លឹកទិន្នន័យទី 5 (Classes)"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreateClassModal(false)}>
              បោះបង់ (Cancel)
            </Button>
            <Button variant="primary" onClick={handleCreateClassSubmit}>
              រក្សាទុកថ្នាក់រៀន (Save Class)
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateClassSubmit} className="space-y-4 text-xs font-khmer-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                ឈ្មោះថ្នាក់ (ClassName) *
              </label>
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="ឧ. 12D"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                កម្រិតថ្នាក់ (GradeLevel)
              </label>
              <select
                value={newGradeLevel}
                onChange={(e) => setNewGradeLevel(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {[7, 8, 9, 10, 11, 12].map((g) => (
                  <option key={g} value={g}>
                    ថ្នាក់ទី {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                គ្រូទទួលបន្ទុកថ្នាក់ (Homeroom Teacher)
              </label>
              <select
                value={newHomeroomId}
                onChange={(e) => setNewHomeroomId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {db.Users.filter((u) => u.RoleID === 'ROL-03').map((t) => (
                  <option key={t.UserID} value={t.UserID}>
                    {t.FullNameKh} ({t.UserID})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                លេខបន្ទប់រៀន (RoomNumber)
              </label>
              <input
                type="text"
                value={newRoomNumber}
                onChange={(e) => setNewRoomNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* ConfirmationDialog: Delete Student */}
      <ConfirmationDialog
        isOpen={Boolean(deletingStudent)}
        onCancel={() => setDeletingStudent(null)}
        onConfirm={handleConfirmDeleteStudent}
        title="បញ្ជាក់ការលុបទិន្នន័យសិស្ស (Delete Student)"
        message={`តើអ្នកពិតជាចង់លុបសិស្ស "${deletingStudent?.FullNameKh}" (អត្តលេខ ${deletingStudent?.StudentCode}) ចេញពីប្រព័ន្ធមែនទេ?`}
      />
    </div>
  );
};
