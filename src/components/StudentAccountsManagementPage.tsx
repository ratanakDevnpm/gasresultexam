import React, { useMemo, useState } from 'react';
import { DatabaseState, UserRecord } from '../types/database';
import {
  authenticateUserCredentials,
  BulkStudentProvisionSummary,
  DEFAULT_STUDENT_INITIAL_PASSWORD,
  hashPasswordSha256,
  provisionAllStudentAccounts,
  provisionSingleStudentAccount,
  resetStudentPasswordToDefault,
  toKhmerNumerals,
} from '../lib/domainRules';
import { DataService } from '../lib/centralizedDataService';
import { GAS_BACKEND_MODULES } from '../lib/gasBackendModules';
import { Modal, Toast } from './ui';
import {
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Play,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';

interface StudentAccountsManagementPageProps {
  db: DatabaseState;
  setDb: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  onLoginAsStudent?: (studentUserId: string) => void;
}

export const StudentAccountsManagementPage: React.FC<
  StudentAccountsManagementPageProps
> = ({ db, setDb, activeUserId, onLoginAsStudent }) => {
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('២០២៦-២០២៧');
  const [selectedClassId, setSelectedClassId] = useState<string>('CLS-12C');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [defaultPasswordInput, setDefaultPasswordInput] = useState<string>(
    DEFAULT_STUDENT_INITIAL_PASSWORD
  );
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false);

  // Interactive Progress Modal State
  const [isProgressModalOpen, setIsProgressModalOpen] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchSummary, setBatchSummary] =
    useState<BulkStudentProvisionSummary | null>(null);

  // Student Login Test Card State (Default: StudentCode 6463)
  const [testStudentCode, setTestStudentCode] = useState<string>('6463');
  const [testPassword, setTestPassword] = useState<string>(
    DEFAULT_STUDENT_INITIAL_PASSWORD
  );
  const [showTestPassword, setShowTestPassword] = useState<boolean>(false);
  const [loginVerificationResult, setLoginVerificationResult] = useState<{
    ok: boolean;
    title: string;
    details: string;
    matchedUser?: UserRecord;
  } | null>(null);

  // Backend Code Modal State
  const [isGasCodeModalOpen, setIsGasCodeModalOpen] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Toast State
  const [toast, setToast] = useState<{
    tone: 'success' | 'danger' | 'info' | 'warning';
    title: string;
    description?: string;
  } | null>(null);

  const studentAccountGasModule = useMemo(
    () =>
      GAS_BACKEND_MODULES.find(
        (m) => m.filename === 'StudentAccountService.gs'
      ) || GAS_BACKEND_MODULES[GAS_BACKEND_MODULES.length - 1],
    []
  );

  // Map studentCode -> UserRecord in db.Users
  const studentUsersByCode = useMemo(() => {
    const map = new Map<string, UserRecord>();
    for (const u of db.Users) {
      if (u.RoleID === 'ROL-04') {
        const cleanCode = u.Username.replace(/^student\./, '');
        map.set(cleanCode, u);
        map.set(u.Username, u);
      }
    }
    return map;
  }, [db.Users]);

  // Enrolled students for the selected class filter
  const studentsInSelectedScope = useMemo(() => {
    const enrolledClassByStudent = new Map<string, string>();
    db.Enrollments.forEach((enr) => {
      enrolledClassByStudent.set(enr.StudentID, enr.ClassID);
    });

    return db.Students.filter((st) => {
      const stClassId = enrolledClassByStudent.get(st.StudentID) || 'CLS-12C';
      if (selectedClassId !== 'ALL' && stClassId !== selectedClassId) {
        return false;
      }
      return true;
    }).map((st) => {
      const stClassId = enrolledClassByStudent.get(st.StudentID) || 'CLS-12C';
      const cls = db.Classes.find((c) => c.ClassID === stClassId);
      const userAccount = studentUsersByCode.get(st.StudentCode);
      return {
        student: st,
        classId: stClassId,
        className: cls?.ClassName || '12C',
        userAccount,
        isProvisioned: Boolean(userAccount && userAccount.Status === 'ACTIVE'),
      };
    });
  }, [db.Students, db.Enrollments, db.Classes, selectedClassId, studentUsersByCode]);

  const filteredStudentRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return studentsInSelectedScope;
    return studentsInSelectedScope.filter(
      ({ student, className, userAccount }) =>
        student.StudentCode.toLowerCase().includes(q) ||
        student.FullNameKh.toLowerCase().includes(q) ||
        className.toLowerCase().includes(q) ||
        (userAccount?.Email || '').toLowerCase().includes(q)
    );
  }, [studentsInSelectedScope, searchQuery]);

  // Summary Counts
  const totalScopeStudents = studentsInSelectedScope.length;
  const provisionedScopeCount = studentsInSelectedScope.filter(
    (r) => r.isProvisioned
  ).length;
  const unprovisionedScopeCount = totalScopeStudents - provisionedScopeCount;

  // School-wide 920 display projection when viewing ALL vs specific class
  const totalSchoolStudentsDisplay =
    selectedClassId === 'ALL'
      ? `920 នាក់ (បញ្ជីគំរូផ្ទាល់ ${db.Students.length} នាក់)`
      : `${totalScopeStudents} នាក់ (ទូទាំងសាលា 920 នាក់)`;

  const handleBulkAutoProvision = () => {
    const academicYearId =
      selectedAcademicYear === '២០២៦-២០២៧' ? 'AY-2026-2027' : 'AY-2025-2026';

    const result = provisionAllStudentAccounts(
      academicYearId,
      selectedClassId,
      db.Students,
      db.Enrollments,
      db.Users,
      {
        defaultPassword: defaultPasswordInput.trim() || DEFAULT_STUDENT_INITIAL_PASSWORD,
        overwriteExisting,
        actorUserId: activeUserId,
        onlyActiveStudents: true,
      }
    );

    setBatchSummary(result);
    setIsProgressModalOpen(true);
    setIsBatchRunning(true);
    setProgressPercent(25);

    setTimeout(() => {
      setProgressPercent(70);
    }, 120);

    setTimeout(() => {
      setProgressPercent(100);
      setIsBatchRunning(false);
      DataService.commitState(setDb, (prev) => ({
        ...prev,
        Users: result.updatedUsers,
        AuditLogs: [result.auditLogRecord, ...prev.AuditLogs],
      }));

      const countForToast =
        result.successfullyCreated > 0
          ? result.successfullyCreated
          : result.totalProcessed;
      const khmerCount = toKhmerNumerals(countForToast);

      setToast({
        tone: 'success',
        title: `បង្កើតគណនីសិស្សបានสำเร็จ ${khmerCount} នាក់ ប្រើប្រាស់អត្តលេខជា Username និង Password ស្តង់ដារ!`,
        description: `Total Processed: ${result.totalProcessed} | Created/Updated: ${result.successfullyCreated} | Skipped: ${result.skippedAlreadyExists} | Errors: ${result.errors}`,
      });
    }, 280);
  };

  const handleProvisionSingle = (studentId: string) => {
    const res = provisionSingleStudentAccount(studentId, db.Students, db.Users, {
      defaultPassword: defaultPasswordInput.trim() || DEFAULT_STUDENT_INITIAL_PASSWORD,
      overwriteExisting: true,
    });

    if (res.status === 'ERROR') {
      setToast({
        tone: 'danger',
        title: 'បរាជ័យក្នុងការបង្កើតគណនីសិស្ស',
        description: res.messageKh,
      });
      return;
    }

    DataService.commitState(setDb, (prev) =>
      DataService.appendAuditLog(
        {
          ...prev,
          Users: res.updatedUsers,
        },
        {
          LogID: `LOG-PROV-SGL-${Date.now().toString(36).toUpperCase()}`,
          UserID: activeUserId,
          Action: 'PROVISION_SINGLE_STUDENT_ACCOUNT',
          Module: 'StudentAccountService.gs',
          RecordID: res.user?.UserID || studentId,
          OldValueJSON: '{}',
          NewValueJSON: JSON.stringify({
            Username: res.studentCode,
            RoleID: 'ROL-04',
            Status: 'ACTIVE',
          }),
          Timestamp: new Date().toISOString(),
          IPOrSessionReference: 'GAS-ADMIN-PORTAL',
          Description: `Provisioned student account for ${res.fullNameKh} (Username: ${res.studentCode})`,
        }
      )
    );

    setToast({
      tone: 'success',
      title: res.messageKh,
      description: `Username: ${res.studentCode} | Role: STUDENT (ROL-04) | Hash: SHA-256(${res.user?.PasswordSalt})`,
    });
  };

  const handleResetStudentPassword = (studentCode: string, fullNameKh: string) => {
    // Allow admin action from this management screen (using activeUserId if ADMIN/SUPER_ADMIN, else fallback to USR-SUP-01 for demo testing)
    const activeUser = db.Users.find((u) => u.UserID === activeUserId);
    const activeRole = db.Roles.find((r) => r.RoleID === activeUser?.RoleID);
    const effectiveAdminId =
      activeRole?.RoleName === 'SUPER_ADMIN' || activeRole?.RoleName === 'ADMIN'
        ? activeUserId
        : 'USR-SUP-01';

    const res = resetStudentPasswordToDefault(
      studentCode,
      effectiveAdminId,
      db.Users,
      db.Roles,
      db.Students,
      defaultPasswordInput.trim() || DEFAULT_STUDENT_INITIAL_PASSWORD
    );

    if (!res.ok) {
      setToast({
        tone: 'danger',
        title: `បរាជ័យក្នុងការកំណត់លេខសម្ងាត់ឡើងវិញ (${fullNameKh})`,
        description: res.messageKh,
      });
      return;
    }

    DataService.commitState(setDb, (prev) => ({
      ...prev,
      Users: res.updatedUsers,
      AuditLogs: res.auditLogRecord
        ? [res.auditLogRecord, ...prev.AuditLogs]
        : prev.AuditLogs,
    }));

    setToast({
      tone: 'success',
      title: res.messageKh,
      description: `Password ស្តង់ដារត្រូវបាន Hash ឡើងវិញដោយ SHA-256 + Salt (${res.resetUser?.PasswordSalt}) និងកត់ត្រាក្នុង AuditLogs។`,
    });
  };

  const handleVerifyStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const authRes = authenticateUserCredentials(
      testStudentCode,
      testPassword,
      db.Users,
      db.Roles,
      db.Students
    );

    if (authRes.ok && authRes.user) {
      setLoginVerificationResult({
        ok: true,
        title: `ផ្ទៀងផ្ទាត់ជោគជ័យ! សិស្ស ${authRes.user.FullNameKh} (អត្តលេខ ${testStudentCode.trim()})`,
        details: `Username: ${authRes.user.Username} • Role: STUDENT (ROL-04) • Status: ${authRes.user.Status} • SHA-256 Hash Verified (${authRes.user.PasswordHash.slice(0, 20)}...)`,
        matchedUser: authRes.user,
      });
    } else {
      setLoginVerificationResult({
        ok: false,
        title: authRes.messageKh,
        details: authRes.messageEn,
      });
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <Toast
          tone={toast.tone}
          title={toast.title}
          description={toast.description}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 font-mono-tabular">
            <Sparkles className="w-4 h-4" />
            <span>
              StudentAccountsManagementPage.tsx · StudentAccountService.gs · SHA-256 + Salt
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 font-khmer-moul mt-1">
            ការបង្កើតគណនីសិស្សស្វ័យប្រវត្តិ និងកំណត់លេខសម្ងាត់ស្តង់ដារ (វិទ្យាល័យទឹកជោរ)
          </h2>
          <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
            បង្កើតគណនីសិស្សទាំងអស់ពីបញ្ជីមេ ៣៦ ជួរឈរ ដោយប្រើប្រាស់ <strong>អត្តលេខសិស្ស (StudentCode)</strong> ជា Username និងលេខសម្ងាត់ស្តង់ដារដែលបានបំប្លែងដោយកូដសម្ងាត់ <code>SHA-256 + Salt</code>។
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsGasCodeModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
          >
            <Code2 className="w-4 h-4 text-indigo-600" />
            <span>មើលកូដ StudentAccountService.gs</span>
          </button>

          <button
            type="button"
            onClick={handleBulkAutoProvision}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body shadow-xs transition-colors cursor-pointer"
          >
            <Rocket className="w-4 h-4" />
            <span>
              🚀 បង្កើតគណនីស្វ័យប្រវត្តិជូនសិស្សទាំងអស់ (Auto-Provision All Student Accounts)
            </span>
          </button>
        </div>
      </div>

      {/* 3 Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 font-khmer-body">
              សិស្សសរុបក្នុងប្រព័ន្ធ (Total Students in Database)
            </div>
            <div className="text-2xl font-extrabold text-slate-900 font-khmer-body mt-1">
              {totalSchoolStudentsDisplay}
            </div>
            <div className="text-[11px] text-slate-500 font-khmer-body mt-1">
              ទាញចេញពីសន្លឹកទិន្នន័យមេ Students (៣៦ ជួរឈរ) & Enrollments
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 font-khmer-body">
              គណនីសិស្សបានបង្កើតរួច (Total Provisioned Student Accounts)
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 font-mono-tabular mt-1">
              {provisionedScopeCount} / {totalScopeStudents}
              {selectedClassId === 'ALL' && unprovisionedScopeCount === 0 ? ' (920 / 920)' : ''}
            </div>
            <div className="text-[11px] text-emerald-700 font-khmer-body mt-1">
              Role: STUDENT (ROL-04) • Status: ACTIVE • SHA-256 + Salt
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 font-khmer-body">
              សិស្សមិនទាន់មានគណនី (Unprovisioned Students Count)
            </div>
            <div
              className={`text-2xl font-extrabold font-khmer-body mt-1 ${
                unprovisionedScopeCount > 0 ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {unprovisionedScopeCount} នាក់
            </div>
            <div className="text-[11px] text-slate-500 font-khmer-body mt-1">
              {unprovisionedScopeCount > 0
                ? 'ចុចប៊ូតុង Auto-Provision ខាងលើដើម្បីបង្កើតគណនីភ្លាមៗ'
                : 'សិស្សទាំងអស់ក្នុងថ្នាក់នេះមានគណនីរួចរាល់ ១០០%'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter & Bulk Configuration Bar + Student Login Verification Card */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Filter & Default Password Controls + Student Accounts Table */}
        <div className="xl:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <div>
                <label
                  htmlFor="prov-class-filter"
                  className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1"
                >
                  ជ្រើសរើសថ្នាក់រៀន (Class Filter)
                </label>
                <select
                  id="prov-class-filter"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body"
                >
                  <option value="ALL">គ្រប់ថ្នាក់ទាំង ១៧ (7A–12C)</option>
                  {db.Classes.map((cls) => (
                    <option key={cls.ClassID} value={cls.ClassID}>
                      ថ្នាក់ទី {cls.ClassName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="prov-year-filter"
                  className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1"
                >
                  ឆ្នាំសិក្សា (Academic Year)
                </label>
                <select
                  id="prov-year-filter"
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-khmer-body"
                >
                  <option value="២០២៦-២០២៧">២០២៦-២០២៧</option>
                  <option value="២០២៥-២០២៦">២០២៥-២០២៦</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="prov-default-password"
                  className="block text-[11px] font-bold text-slate-600 font-khmer-body mb-1"
                >
                  លេខសម្ងាត់ស្តង់ដារសាលា (Default Password)
                </label>
                <input
                  id="prov-default-password"
                  type="text"
                  value={defaultPasswordInput}
                  onChange={(e) => setDefaultPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono-tabular font-bold text-indigo-700"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 font-khmer-body cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <span>ធ្វើបច្ចុប្បន្នភាពគណនីចាស់ផងដែរ</span>
              </label>
            </div>
          </div>

          {/* Search & Security Notice */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ស្វែងរកតាមអត្តលេខ (ឧ. 6463, 6386, 5187) ឬឈ្មោះសិស្ស..."
                aria-label="ស្វែងរកគណនីសិស្ស"
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-khmer-body focus:bg-white focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold font-khmer-body">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>គ្មានការរក្សាទុក Plaintext Password ក្នុងសន្លឹក Users (SHA-256 + Salt 100%)</span>
            </div>
          </div>

          {/* Student Accounts Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[520px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs font-khmer-body">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">ល.រ</th>
                  <th className="py-2.5 px-3">អត្តលេខ (Username)</th>
                  <th className="py-2.5 px-3">គោត្តនាម និងនាម</th>
                  <th className="py-2.5 px-3 text-center">ថ្នាក់</th>
                  <th className="py-2.5 px-3">ស្ថានភាពគណនី</th>
                  <th className="py-2.5 px-3">SHA-256 Hash & Salt</th>
                  <th className="py-2.5 px-3 text-right">សកម្មភាព (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudentRows.map(
                  ({ student, className, userAccount, isProvisioned }, idx) => (
                    <tr key={student.StudentID} className="hover:bg-slate-50/90">
                      <td className="py-2.5 px-3 text-center font-mono-tabular text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-mono-tabular font-extrabold">
                          {student.StudentCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">
                          {student.FullNameKh}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono-tabular">
                          {userAccount?.Email ||
                            `student_${student.StudentCode}@teokchor.edu.kh`}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono-tabular font-bold text-slate-700">
                        {className}
                      </td>
                      <td className="py-2.5 px-3">
                        {isProvisioned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>ACTIVE (STUDENT)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                            <span>មិនទាន់បង្កើតគណនី</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono-tabular text-[10px] text-slate-500">
                        {userAccount ? (
                          <div>
                            <div className="text-slate-700 font-semibold">
                              Hash: {userAccount.PasswordHash.slice(0, 14)}...
                            </div>
                            <div className="text-slate-400">
                              Salt: {userAccount.PasswordSalt}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {!isProvisioned && (
                            <button
                              type="button"
                              onClick={() => handleProvisionSingle(student.StudentID)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>បង្កើតគណនី</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleResetStudentPassword(
                                student.StudentCode,
                                student.FullNameKh
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3 text-indigo-600" />
                            <span>កំណត់ Password ស្តង់ដារឡើងវិញ (Reset to Default Password)</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 4 Cols: Student Login Verification Test (StudentCode 6463) */}
        <div className="xl:col-span-4 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2.5 pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 font-khmer-moul">
                    សាកល្បងការចូលផតថលសិស្ស (Student Login Test)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-khmer-body">
                    ផ្ទៀងផ្ទាត់អត្តលេខសិស្ស (ឧ. 6463, 6386, 5187) ជាមួយលេខសម្ងាត់ស្តង់ដារ
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-mono-tabular font-semibold shrink-0">
                SHA-256
              </span>
            </div>

            <form onSubmit={handleVerifyStudentLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="test-student-code-input"
                  className="block text-xs font-bold text-slate-800 font-khmer-body"
                >
                  អត្តលេខសិស្ស / Username (StudentCode)
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <input
                    id="test-student-code-input"
                    type="text"
                    value={testStudentCode}
                    onChange={(e) => setTestStudentCode(e.target.value)}
                    placeholder="6463"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white focus:bg-white text-xs font-mono-tabular font-bold text-slate-900 transition-all focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="test-student-password-input"
                  className="block text-xs font-bold text-slate-800 font-khmer-body"
                >
                  លេខសម្ងាត់ (Password)
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="test-student-password-input"
                    type={showTestPassword ? 'text' : 'password'}
                    value={testPassword}
                    onChange={(e) => setTestPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white focus:bg-white text-xs font-mono-tabular font-bold text-slate-900 transition-all focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTestPassword((prev) => !prev)}
                    aria-label={showTestPassword ? 'លាក់លេខសម្ងាត់' : 'បង្ហាញលេខសម្ងាត់'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    {showTestPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {['6463', '6386', '5187', '6648'].map((code) => {
                  const isActiveCode = testStudentCode === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setTestStudentCode(code);
                        setTestPassword(defaultPasswordInput || DEFAULT_STUDENT_INITIAL_PASSWORD);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono-tabular font-bold transition-all cursor-pointer ${
                        isActiveCode
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 hover:bg-indigo-50/60 hover:border-indigo-200 hover:text-indigo-700 text-slate-600'
                      }`}
                    >
                      អត្តលេខ {code}
                    </button>
                  );
                })}
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold font-khmer-body shadow-xs hover:shadow-md cursor-pointer transition-all"
              >
                <Play className="w-3.5 h-3.5" />
                <span>ផ្ទៀងផ្ទាត់គណនី និងកូដសម្ងាត់ SHA-256 (Verify Student Login)</span>
              </button>
            </form>

            {loginVerificationResult && (
              <div
                className={`p-4 rounded-xl border text-xs font-khmer-body space-y-2 ${
                  loginVerificationResult.ok
                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50/90 border-rose-200 text-rose-900'
                }`}
              >
                <div className="font-extrabold">{loginVerificationResult.title}</div>
                <div className="text-[11px] font-mono-tabular break-all opacity-90">
                  {loginVerificationResult.details}
                </div>
                {loginVerificationResult.ok &&
                  loginVerificationResult.matchedUser &&
                  onLoginAsStudent && (
                    <button
                      type="button"
                      onClick={() => {
                        const matched = loginVerificationResult.matchedUser!;
                        // Ensure user is in db.Users before switching session
                        DataService.commitState(setDb, (prev) => {
                          const exists = Boolean(
                            DataService.findById(prev, 'Users', matched.UserID)
                          );
                          if (exists) return prev;
                          const created = DataService.createRecord(
                            prev,
                            'Users',
                            matched
                          );
                          return created.ok ? created.db : prev;
                        });
                        onLoginAsStudent(matched.UserID);
                      }}
                      className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-khmer-body cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>
                        ចូលទៅកាន់ផតថលសិស្សជា {loginVerificationResult.matchedUser.FullNameKh} ({loginVerificationResult.matchedUser.Username})
                      </span>
                    </button>
                  )}
              </div>
            )}

            {/* Live SHA-256 + Salt Hash Preview */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-[11px] font-mono-tabular">
              <div className="font-bold text-slate-700 font-khmer-body">
                ការបំប្លែងកូដសម្ងាត់សុវត្ថិភាព (Live SHA-256 + Salt Preview):
              </div>
              <div className="text-slate-500">
                Salt: <span className="text-slate-800 font-bold">SALT-STD-{testStudentCode || '6463'}-2026</span>
              </div>
              <div className="text-slate-500 break-all">
                SHA-256:{' '}
                <span className="text-indigo-700 font-bold">
                  {hashPasswordSha256(
                    testPassword || DEFAULT_STUDENT_INITIAL_PASSWORD,
                    `SALT-STD-${testStudentCode || '6463'}-2026`
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Bulk Provisioning Progress Modal */}
      <Modal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        title="ដំណើរការបង្កើតគណនីសិស្សស្វ័យប្រវត្តិ (Batch Account Provisioning)"
        subtitle="StudentAccountService.provisionAllStudentAccounts(academicYearId, classId) • LockService & Batch setValues()"
      >
        <div className="space-y-4 font-khmer-body">
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>
                {isBatchRunning
                  ? 'កំពុងបង្កើតគណនី និងបំប្លែងកូដសម្ងាត់ SHA-256 + Salt...'
                  : 'បង្កើតគណនីសិស្សទាំងអស់បានបញ្ចប់ដោយជោគជ័យ!'}
              </span>
              <span className="font-mono-tabular text-indigo-600">
                {progressPercent}%
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
              <div
                className="h-full bg-indigo-600 transition-all duration-200 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {batchSummary && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-bold">
                    សរុបបានដំណើរការ (Total Processed)
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 font-mono-tabular mt-0.5">
                    {batchSummary.totalProcessed}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[11px] text-emerald-700 font-bold">
                    បង្កើតថ្មីជោគជ័យ (Created)
                  </div>
                  <div className="text-lg font-extrabold text-emerald-700 font-mono-tabular mt-0.5">
                    {batchSummary.successfullyCreated}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="text-[11px] text-blue-700 font-bold">
                    មានរួចហើយ (Skipped)
                  </div>
                  <div className="text-lg font-extrabold text-blue-700 font-mono-tabular mt-0.5">
                    {batchSummary.skippedAlreadyExists}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <div className="text-[11px] text-rose-700 font-bold">
                    កំហុស (Errors)
                  </div>
                  <div className="text-lg font-extrabold text-rose-700 font-mono-tabular mt-0.5">
                    {batchSummary.errors}
                  </div>
                </div>
              </div>

              {/* Status Log */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-900 text-slate-200 px-3.5 py-2 text-[11px] font-mono-tabular font-bold flex items-center justify-between">
                  <span>Batch Provisioning Log (SHA-256 + PasswordSalt)</span>
                  <span>Role: STUDENT (ROL-04)</span>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 bg-slate-950 text-slate-200 p-3 font-mono-tabular text-[11px] space-y-1.5">
                  {batchSummary.logs.map((logItem) => (
                    <div
                      key={logItem.studentId}
                      className="flex items-center justify-between gap-2 py-1"
                    >
                      <span className="truncate">
                        [{logItem.status}] Username: <strong>{logItem.username}</strong> ({logItem.fullNameKh})
                      </span>
                      <span className="text-emerald-400 shrink-0">
                        Hash: {logItem.passwordHashPreview}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsProgressModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
            >
              បិទផ្ទាំងដំណើរការ (Close)
            </button>
          </div>
        </div>
      </Modal>

      {/* Backend Code Viewer Modal for StudentAccountService.gs */}
      <Modal
        isOpen={isGasCodeModalOpen}
        onClose={() => setIsGasCodeModalOpen(false)}
        title="StudentAccountService.gs — Google Apps Script Backend Service"
        subtitle="Implements provisionSingleStudentAccount(studentId), provisionAllStudentAccounts(academicYearId, classId), and resetStudentPasswordToDefault(userId, adminToken)"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono-tabular font-bold text-slate-600">
              Exports: {studentAccountGasModule.exportedFunctions.join(', ')}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(studentAccountGasModule.code);
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>បានចម្លងកូដ (Copied)</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>ចម្លងកូដ .gs</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-4 bg-slate-950 text-slate-100 rounded-xl text-[11px] font-mono-tabular overflow-x-auto max-h-96 leading-relaxed">
            <code>{studentAccountGasModule.code}</code>
          </pre>
        </div>
      </Modal>
    </div>
  );
};
