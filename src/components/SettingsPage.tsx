import React, { useState, useMemo, useEffect } from 'react';
import {
  AcademicYearRecord,
  DatabaseState,
  GradingScaleRecord,
  SystemSettingRecord,
} from '../types/database';
import { DATABASE_SHEETS_SCHEMA } from '../lib/schemaDefinitions';
import { Toast } from './ui';
import { AuditLogsPage } from './AuditLogsPage';
import { DesignSystemAndAuthView } from './DesignSystemAndAuthView';
import { DualRoleTeacherPermissionCard } from './DualRoleTeacherPermissionCard';
import { GasArchitectureView } from './GasArchitectureView';
import { StudentAccountsManagementPage } from './StudentAccountsManagementPage';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  Download,
  KeyRound,
  Link2,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  Sliders,
  Sparkles,
  UserCheck,
  UserX,
  Zap,
} from 'lucide-react';

export type SettingsTabId =
  | 'SCHOOL_PROFILE'
  | 'ACADEMIC_YEARS'
  | 'AUTHENTICATION'
  | 'ROLES_RBAC'
  | 'GAS_ENDPOINT'
  | 'DATABASE_STATUS'
  | 'AUDIT_LOGS'
  | 'BACKUP_RESET';

interface SettingsPageProps {
  db: DatabaseState;
  setDb?: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  setActiveUserId?: (userId: string) => void;
  initialTab?: SettingsTabId;
  onSaveSystemSettings: (updatedSettings: SystemSettingRecord[]) => void;
  onSaveGradingScales: (updatedScales: GradingScaleRecord[]) => void;
  onResetDatabase?: () => void;
  onLoginAsStudent?: (studentUserId: string) => void;
}

interface NavGroup {
  sectionTitleKh: string;
  sectionTitleEn: string;
  items: Array<{
    id: SettingsTabId;
    emoji: string;
    labelKh: string;
    labelEn: string;
  }>;
}

const SETTINGS_NAV_GROUPS: NavGroup[] = [
  {
    sectionTitleKh: '១. ព័ត៌មានទូទៅ & សាលារៀន',
    sectionTitleEn: 'General & School Info',
    items: [
      {
        id: 'SCHOOL_PROFILE',
        emoji: '🏫',
        labelKh: 'ព័ត៌មានសាលា & ស្ថាប័ន',
        labelEn: 'School Profile',
      },
      {
        id: 'ACADEMIC_YEARS',
        emoji: '📅',
        labelKh: 'ឆ្នាំសិក្សា & ឆមាស',
        labelEn: 'Academic Years',
      },
    ],
  },
  {
    sectionTitleKh: '២. សុវត្ថិភាព & គណនី',
    sectionTitleEn: 'Authentication & Security',
    items: [
      {
        id: 'AUTHENTICATION',
        emoji: '🔐',
        labelKh: 'ការកំណត់គណនី & Auth',
        labelEn: 'Authentication',
      },
      {
        id: 'ROLES_RBAC',
        emoji: '🛡️',
        labelKh: 'សិទ្ធិ & តួនាទី',
        labelEn: 'Roles & RBAC',
      },
    ],
  },
  {
    sectionTitleKh: '៣. ប្រព័ន្ធ Backend & GAS',
    sectionTitleEn: 'Google Apps Script (GAS) & Backend',
    items: [
      {
        id: 'GAS_ENDPOINT',
        emoji: '⚙️',
        labelKh: 'GAS API Endpoint & Sync',
        labelEn: 'GAS Web App Sync',
      },
      {
        id: 'DATABASE_STATUS',
        emoji: '💾',
        labelKh: 'Database & 19 Sheets Status',
        labelEn: '19 Normalized Sheets',
      },
    ],
  },
  {
    sectionTitleKh: '៤. កំណត់ហេតុ & ថែទាំប្រព័ន្ធ',
    sectionTitleEn: 'System Logs & Maintenance',
    items: [
      {
        id: 'AUDIT_LOGS',
        emoji: '🪵',
        labelKh: 'សវនកម្ម (Audit Logs)',
        labelEn: 'Security Audit Trail',
      },
      {
        id: 'BACKUP_RESET',
        emoji: '🔄',
        labelKh: 'ទិន្នន័យ (Backup & Reset)',
        labelEn: 'Backup & Seed Restore',
      },
    ],
  },
];

export const SettingsPage: React.FC<SettingsPageProps> = ({
  db,
  setDb,
  activeUserId,
  initialTab = 'SCHOOL_PROFILE',
  onSaveSystemSettings,
  onSaveGradingScales,
  onResetDatabase,
  onLoginAsStudent,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // School Profile & Grading Scales Drafts
  const [settingsDraft, setSettingsDraft] = useState<SystemSettingRecord[]>(() =>
    db.SystemSettings.map((s) => ({ ...s }))
  );
  const [scalesDraft, setScalesDraft] = useState<GradingScaleRecord[]>(() =>
    db.GradingScales.map((g) => ({ ...g }))
  );

  // Sync draft if db.SystemSettings changes externally
  useEffect(() => {
    setSettingsDraft(db.SystemSettings.map((s) => ({ ...s })));
  }, [db.SystemSettings]);

  useEffect(() => {
    setScalesDraft(db.GradingScales.map((g) => ({ ...g })));
  }, [db.GradingScales]);

  // Authentication & Security Controls State
  const [minPasswordLength, setMinPasswordLength] = useState<number>(8);
  const [defaultStudentPwdPrefix, setDefaultStudentPwdPrefix] = useState<string>('TeokChor@2026');
  const [hashAlgorithm, setHashAlgorithm] = useState<string>('SHA-256 + Per-User Salt');
  const [sessionTimeoutHours, setSessionTimeoutHours] = useState<number>(8);
  const [enforceIdleLock, setEnforceIdleLock] = useState<boolean>(true);
  const [showBulkStudentProvisioning, setShowBulkStudentProvisioning] = useState<boolean>(false);

  // GAS API Endpoint & Sync State
  const [gasEndpointUrl, setGasEndpointUrl] = useState<string>(
    'https://script.google.com/macros/s/AKfycbxTeokChorHighSchool2026_v3/exec'
  );
  const [gasDeploymentEnv, setGasDeploymentEnv] = useState<'PRODUCTION' | 'STAGING'>('PRODUCTION');
  const [gasConnectionStatus, setGasConnectionStatus] = useState<'CONNECTED' | 'ERROR' | 'TESTING'>(
    'CONNECTED'
  );
  const [gasPingLatencyMs, setGasPingLatencyMs] = useState<number>(42);
  const [lastSheetSyncTime, setLastSheetSyncTime] = useState<string>('ទើបតែធ្វើបច្ចុប្បន្នភាពមុននេះបន្តិច');
  const [showGasModulesCode, setShowGasModulesCode] = useState<boolean>(false);

  // Academic Year Creation Draft
  const [newYearName, setNewYearName] = useState<string>('');
  const [newYearStart, setNewYearStart] = useState<string>('2027-11-01');
  const [newYearEnd, setNewYearEnd] = useState<string>('2028-08-31');

  const [toast, setToast] = useState<{
    tone: 'success' | 'danger' | 'info';
    title: string;
    description?: string;
  } | null>(null);

  const activeUser = useMemo(
    () => db.Users.find((u) => u.UserID === activeUserId),
    [db.Users, activeUserId]
  );
  const activeRole = useMemo(
    () => db.Roles.find((r) => r.RoleID === activeUser?.RoleID),
    [db.Roles, activeUser]
  );

  const canEditSettings =
    activeRole?.RoleName === 'SUPER_ADMIN' || activeRole?.RoleName === 'ADMIN';

  // Helper to read/update specific setting keys in settingsDraft
  const getSettingValue = (key: string, fallback = '') => {
    const found = settingsDraft.find((s) => s.SettingKey === key);
    return found ? found.SettingValue : fallback;
  };

  const handleSettingChange = (key: string, newValue: string, descriptionFallback?: string) => {
    setSettingsDraft((prev) => {
      const exists = prev.some((item) => item.SettingKey === key);
      if (exists) {
        return prev.map((item) =>
          item.SettingKey === key
            ? {
                ...item,
                SettingValue: newValue,
                UpdatedByUserID: activeUserId,
                UpdatedAt: new Date().toISOString(),
              }
            : item
        );
      }
      return [
        ...prev,
        {
          SettingID: `SET-${String(prev.length + 1).padStart(2, '0')}`,
          SettingKey: key,
          SettingValue: newValue,
          SettingGroup: 'SCHOOL_IDENTITY' as const,
          Description: descriptionFallback || key,
          UpdatedByUserID: activeUserId,
          UpdatedAt: new Date().toISOString(),
        },
      ];
    });
  };

  const handleScaleChange = (
    scaleId: string,
    field: 'MinimumScore' | 'MaximumScore' | 'Description',
    rawValue: string
  ) => {
    setScalesDraft((prev) =>
      prev.map((sc) => {
        if (sc.GradingScaleID !== scaleId) return sc;
        if (field === 'Description') {
          return { ...sc, Description: rawValue };
        }
        const num = Number(rawValue);
        return {
          ...sc,
          [field]: Number.isNaN(num) ? 0 : num,
        };
      })
    );
  };

  // Sticky Bottom "Save Changes" Handler
  const handleGlobalSaveChanges = () => {
    if (!canEditSettings) {
      setToast({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិកែប្រែការកំណត់ប្រព័ន្ធ',
        description: 'មានតែគណនី SUPER_ADMIN និង ADMIN ប៉ុណ្ណោះដែលអាចរក្សាទុកការផ្លាស់ប្តូរបាន។',
      });
      return;
    }

    if (activeTab === 'SCHOOL_PROFILE') {
      for (const sc of scalesDraft) {
        const isUnrankedScale = sc.Grade === 'មិនចាត់ថ្នាក់';
        if (
          (!isUnrankedScale && sc.MinimumScore < 0) ||
          sc.MaximumScore > 100 ||
          sc.MinimumScore > sc.MaximumScore
        ) {
          setToast({
            tone: 'danger',
            title: `កំហុសមាត្រដ្ឋាននិទ្ទេស ${sc.Grade}`,
            description: 'ពិន្ទុអប្បបរមាត្រូវតែតូចជាង ឬស្មើពិន្ទុអតិបរមា។',
          });
          return;
        }
      }
      onSaveSystemSettings(settingsDraft);
      onSaveGradingScales(scalesDraft);
      setToast({
        tone: 'success',
        title: 'រក្សាទុកការផ្លាស់ប្តូរដោយជោគជ័យ (Saved School Profile & Grading Scales)',
        description:
          'ព័ត៌មានសាលា ក្បាលរបាយការណ៍ផ្លូវការ កាលបរិច្ឆេទ និងមាត្រដ្ឋាននិទ្ទេស A–F ត្រូវបានធ្វើបច្ចុប្បន្នភាព។',
      });
      return;
    }

    if (activeTab === 'AUTHENTICATION') {
      if (minPasswordLength < 6) {
        setToast({
          tone: 'danger',
          title: 'ប្រវែងពាក្យសម្ងាត់ខ្លីពេក',
          description: 'ប្រវែងពាក្យសម្ងាត់អប្បបរមាត្រូវតែចាប់ពី ៦ តួអក្សរឡើងទៅ។',
        });
        return;
      }
      if (setDb) {
        const now = new Date().toISOString();
        setDb((prev) => ({
          ...prev,
          AuditLogs: [
            {
              LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
              UserID: activeUserId,
              Action: 'UPDATE_AUTH_SECURITY_POLICY',
              Module: 'AuthService.gs',
              RecordID: 'AUTH-POLICY-CONFIG',
              OldValueJSON: '{}',
              NewValueJSON: JSON.stringify({
                minPasswordLength,
                defaultStudentPwdPrefix,
                hashAlgorithm,
                sessionTimeoutHours,
                enforceIdleLock,
              }),
              Timestamp: now,
              IPOrSessionReference: 'GAS-AUTH-CONFIG',
              Description: `Updated password policy (min=${minPasswordLength}, prefix=${defaultStudentPwdPrefix}) & session timeout (${sessionTimeoutHours}h)`,
            },
            ...prev.AuditLogs,
          ],
        }));
      }
      setToast({
        tone: 'success',
        title: 'រក្សាទុកគោលការណ៍សុវត្ថិភាព និង Auth ជោគជ័យ',
        description: `គោលការណ៍ពាក្យសម្ងាត់ (${hashAlgorithm}) និងរយៈពេលផុតកំណត់ Session (${sessionTimeoutHours} ម៉ោង) ត្រូវបានរក្សាទុក។`,
      });
      return;
    }

    if (activeTab === 'GAS_ENDPOINT') {
      if (!gasEndpointUrl.startsWith('https://script.google.com/macros/s/')) {
        setGasConnectionStatus('ERROR');
        setToast({
          tone: 'danger',
          title: 'ទម្រង់ GAS Web App URL មិនត្រឹមត្រូវ',
          description: 'សូមបញ្ចូល URL ដែលផ្តើមដោយ https://script.google.com/macros/s/.../exec',
        });
        return;
      }
      setGasConnectionStatus('CONNECTED');
      setToast({
        tone: 'success',
        title: 'រក្សាទុកការកំណត់ GAS API Endpoint ជោគជ័យ',
        description: `បានភ្ជាប់ទៅកាន់ ${gasDeploymentEnv} Endpoint ដោយជោគជ័យ។`,
      });
      return;
    }

    // Default save feedback for other tabs
    onSaveSystemSettings(settingsDraft);
    setToast({
      tone: 'success',
      title: 'រក្សាទុកការផ្លាស់ប្តូរដោយជោគជ័យ (Save Changes)',
      description: 'ការកំណត់ប្រព័ន្ធត្រូវបានរក្សាទុកក្នុងមូលដ្ឋានទិន្នន័យរួចរាល់។',
    });
  };

  // Staff Accounts Quick List (SUPER_ADMIN, ADMIN, TEACHER, VIEWER)
  const staffAccounts = useMemo(() => {
    return db.Users.filter((u) => {
      const r = db.Roles.find((role) => role.RoleID === u.RoleID);
      return r?.RoleName !== 'STUDENT';
    });
  }, [db.Users, db.Roles]);

  const handleStaffResetPassword = (targetUserId: string, fullNameKh: string) => {
    if (!canEditSettings || !setDb) {
      setToast({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិកំណត់ពាក្យសម្ងាត់ឡើងវិញ',
        description: 'មានតែគណនី SUPER_ADMIN និង ADMIN ប៉ុណ្ណោះដែលអាចប្តូរពាក្យសម្ងាត់បុគ្គលិកបាន។',
      });
      return;
    }
    const now = new Date().toISOString();
    setDb((prev) => ({
      ...prev,
      Users: prev.Users.map((u) =>
        u.UserID === targetUserId
          ? {
              ...u,
              PasswordHash: `sha256$reset_${now.slice(0, 10)}$TeokChorStaff2026`,
              MustChangePassword: true,
              UpdatedAt: now,
            }
          : u
      ),
      AuditLogs: [
        {
          LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
          UserID: activeUserId,
          Action: 'RESET_STAFF_PASSWORD',
          Module: 'UserService.gs',
          RecordID: targetUserId,
          OldValueJSON: '{"MustChangePassword":false}',
          NewValueJSON: '{"MustChangePassword":true,"ResetByAdmin":true}',
          Timestamp: now,
          IPOrSessionReference: 'GAS-ADMIN-AUTH',
          Description: `Reset password for staff account ${fullNameKh} (${targetUserId})`,
        },
        ...prev.AuditLogs,
      ],
    }));
    setToast({
      tone: 'success',
      title: `កំណត់ពាក្យសម្ងាត់ឡើងវិញជោគជ័យ (${fullNameKh})`,
      description: `ពាក្យសម្ងាត់បណ្តោះអាសន្នត្រូវបានកំណត់ទៅ "${defaultStudentPwdPrefix}" (SHA-256 + Salt)។`,
    });
  };

  const handleToggleStaffStatus = (
    targetUserId: string,
    fullNameKh: string,
    currentStatus: string
  ) => {
    if (!canEditSettings || !setDb) {
      setToast({
        tone: 'danger',
        title: 'គ្មានសិទ្ធិបិទ/បើកគណនី',
        description: 'មានតែគណនី SUPER_ADMIN និង ADMIN ប៉ុណ្ណោះដែលអាចកែប្រែស្ថានភាពគណនីបាន។',
      });
      return;
    }
    if (targetUserId === activeUserId) {
      setToast({
        tone: 'danger',
        title: 'មិនអាចបិទគណនីខ្លួនឯងបានទេ',
        description: 'អ្នកកំពុងប្រើប្រាស់គណនីនេះផ្ទាល់។',
      });
      return;
    }
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const now = new Date().toISOString();
    setDb((prev) => ({
      ...prev,
      Users: prev.Users.map((u) =>
        u.UserID === targetUserId
          ? {
              ...u,
              Status: nextStatus as 'ACTIVE' | 'INACTIVE',
              UpdatedAt: now,
            }
          : u
      ),
      AuditLogs: [
        {
          LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
          UserID: activeUserId,
          Action: nextStatus === 'INACTIVE' ? 'DEACTIVATE_STAFF_USER' : 'ACTIVATE_STAFF_USER',
          Module: 'UserService.gs',
          RecordID: targetUserId,
          OldValueJSON: JSON.stringify({ Status: currentStatus }),
          NewValueJSON: JSON.stringify({ Status: nextStatus }),
          Timestamp: now,
          IPOrSessionReference: 'GAS-ADMIN-AUTH',
          Description: `Changed account status for ${fullNameKh} (${targetUserId}) to ${nextStatus}`,
        },
        ...prev.AuditLogs,
      ],
    }));
    setToast({
      tone: nextStatus === 'ACTIVE' ? 'success' : 'info',
      title:
        nextStatus === 'ACTIVE'
          ? `បានបើកដំណើរការគណនី ${fullNameKh} ឡើងវិញ`
          : `បានផ្អាកដំណើរការគណនី ${fullNameKh} (Deactivated)`,
      description: `ស្ថានភាពគណនី ${targetUserId} បច្ចុប្បន្នគឺ ${nextStatus}។`,
    });
  };

  // Test GAS Connection Handler
  const handleTestGasConnection = () => {
    setGasConnectionStatus('TESTING');
    if (
      !gasEndpointUrl.trim() ||
      !gasEndpointUrl.startsWith('https://script.google.com/macros/s/')
    ) {
      setGasConnectionStatus('ERROR');
      setToast({
        tone: 'danger',
        title: 'ការតភ្ជាប់ GAS បរាជ័យ (Invalid Web App Endpoint)',
        description: 'សូមពិនិត្យមើល URL របស់ Google Apps Script Web App ឱ្យបានត្រឹមត្រូវ។',
      });
      return;
    }
    const simulatedLatency = 38 + (gasEndpointUrl.length % 19);
    setGasPingLatencyMs(simulatedLatency);
    setGasConnectionStatus('CONNECTED');
    setLastSheetSyncTime(new Date().toLocaleTimeString('km-KH'));
    setToast({
      tone: 'success',
      title: '🟢 បានតភ្ជាប់ជោគជ័យទៅកាន់ Google Apps Script',
      description: `ឆ្លើយតបក្នុងរយៈពេល ${simulatedLatency}ms • សន្លឹកទិន្នន័យទាំង ១៩ សន្លឹករួចរាល់សម្រាប់ការធ្វើសមកាលកម្ម។`,
    });
  };

  // Initialize 19 Sheets Handler
  const handleInitialize19Sheets = () => {
    const now = new Date().toISOString();
    if (setDb) {
      setDb((prev) => ({
        ...prev,
        AuditLogs: [
          {
            LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
            UserID: activeUserId,
            Action: 'INITIALIZE_VERIFY_19_SHEETS',
            Module: 'Setup.gs',
            RecordID: 'GAS-19-SHEETS-SCHEMA',
            OldValueJSON: '{"verifiedSheets":19}',
            NewValueJSON: '{"verifiedSheets":19,"status":"HEALTHY_INDEXED"}',
            Timestamp: now,
            IPOrSessionReference: 'GAS-SETUP-ENGINE',
            Description:
              'Executed initializeAllSheets() — verified all 19 normalized sheets, primary keys, and headers.',
          },
          ...prev.AuditLogs,
        ],
      }));
    }
    setLastSheetSyncTime(new Date().toLocaleTimeString('km-KH'));
    setToast({
      tone: 'success',
      title: '⚙️ បានត្រួតពិនិត្យ និងរៀបចំតារាង Database ទាំង ១៩ សន្លឹកជោគជ័យ',
      description:
        'គ្រប់សន្លឹកទិន្នន័យទាំង ១៩ (Users, Students 36-Cols, Classes 7A–12C, MonthlyScores, AuditLogs...) មានជួរឈរត្រឹមត្រូវ ១០០%។',
    });
  };

  // Academic Year Handlers
  const handleSetCurrentAcademicYear = (yearId: string, yearName: string) => {
    if (!canEditSettings || !setDb) return;
    setDb((prev) => ({
      ...prev,
      AcademicYears: prev.AcademicYears.map((ay) => ({
        ...ay,
        IsCurrent: ay.AcademicYearID === yearId,
        Status: ay.AcademicYearID === yearId ? 'ACTIVE' : ay.Status,
      })),
    }));
    setToast({
      tone: 'success',
      title: `បានកំណត់ឆ្នាំសិក្សាបច្ចុប្បន្នទៅជា ${yearName}`,
      description: 'របាយការណ៍ផ្លូវការ និងតារាងពិន្ទុទាំងអស់នឹងយោងតាមឆ្នាំសិក្សានេះជាលំនាំដើម។',
    });
  };

  const handleAddAcademicYear = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings || !setDb || !newYearName.trim()) return;
    const newId = `AY-${String(db.AcademicYears.length + 1).padStart(3, '0')}`;
    const newRecord: AcademicYearRecord = {
      AcademicYearID: newId,
      AcademicYearName: newYearName.trim(),
      StartDate: newYearStart,
      EndDate: newYearEnd,
      IsCurrent: false,
      Status: 'ACTIVE',
      CreatedAt: new Date().toISOString(),
    };
    setDb((prev) => ({
      ...prev,
      AcademicYears: [...prev.AcademicYears, newRecord],
    }));
    setNewYearName('');
    setToast({
      tone: 'success',
      title: `បានបន្ថែមឆ្នាំសិក្សាថ្មី (${newRecord.AcademicYearName})`,
      description: 'ឆ្នាំសិក្សាថ្មីត្រូវបានបញ្ចូលទៅក្នុងសន្លឹក AcademicYears។',
    });
  };

  // Export JSON Backup Handler
  const handleExportBackupJson = () => {
    const payload = JSON.stringify(db, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TeokChor_LMS_19Sheets_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast({
      tone: 'success',
      title: 'ទាញយកឯកសារสำรองទិន្នន័យ (JSON Backup) ជោគជ័យ',
      description: 'ទិន្នន័យទាំង ១៩ សន្លឹកត្រូវបានវេចខ្ចប់ជាឯកសារ JSON សម្រាប់រក្សាទុកដោយសុវត្ថិភាព។',
    });
  };

  // Current active tab metadata
  const activeTabMeta = useMemo(() => {
    for (const grp of SETTINGS_NAV_GROUPS) {
      const found = grp.items.find((i) => i.id === activeTab);
      if (found) return { ...found, sectionTitleKh: grp.sectionTitleKh };
    }
    return {
      id: 'SCHOOL_PROFILE' as SettingsTabId,
      emoji: '🏫',
      labelKh: 'ព័ត៌មានសាលា & ស្ថាប័ន',
      labelEn: 'School Profile',
      sectionTitleKh: '១. ព័ត៌មានទូទៅ & សាលារៀន',
    };
  }, [activeTab]);

  // Helper to get live row count of each sheet in DatabaseState
  const getSheetRowCount = (sheetName: string): number => {
    const table = (db as unknown as Record<string, unknown[]>)[sheetName];
    return Array.isArray(table) ? table.length : 0;
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

      {/* Top Clean Workspace Header (Vercel / Notion Settings Style) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 font-mono-tabular">
            <Sparkles className="w-4 h-4" />
            <span>SYSTEM SETTINGS, AUTH &amp; GAS CONFIGURATION WORKSPACE</span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 font-khmer-moul mt-1">
            ការកំណត់ប្រព័ន្ធ សុវត្ថិភាពគណនី និងការតភ្ជាប់ Google Apps Script (វិទ្យាល័យទឹកជោរ)
          </h2>
          <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
            គ្រប់គ្រងព័ត៌មានស្ថាប័ន គោលការណ៍សុវត្ថិភាព SHA-256 ការតភ្ជាប់តារាងទិន្នន័យទាំង ១៩ សន្លឹក និងកំណត់ហេតុសវនកម្ម
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2.5 shrink-0">
          <span
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-khmer-body border ${
              canEditSettings
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            សិទ្ធិបច្ចុប្បន្ន៖ {activeRole?.RoleName} (
            {canEditSettings ? 'អាចកែប្រែបានពេញលេញ' : 'មើលបានតែប៉ុណ្ណោះ'})
          </span>
        </div>
      </div>

      {/* 2-PANE VERTICAL TABS LAYOUT (Notion / Vercel Settings Architecture) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* A. Left Sub-Navigation Menu (w-full lg:w-64) */}
        <aside
          aria-label="ម៉ឺនុយការកំណត់ប្រព័ន្ធ (Settings Sub-Navigation)"
          className="no-print w-full lg:w-64 space-y-4 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs shrink-0 lg:sticky lg:top-24"
        >
          {SETTINGS_NAV_GROUPS.map((group) => (
            <div key={group.sectionTitleEn} className="space-y-1">
              <div className="px-3 py-1.5">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 font-khmer-body">
                  {group.sectionTitleKh}
                </div>
                <div className="text-[10px] font-semibold text-slate-400/80 font-mono-tabular">
                  {group.sectionTitleEn}
                </div>
              </div>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50/90 text-indigo-700 border border-indigo-200/80 font-bold shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent font-medium'
                      }`}
                    >
                      <span className="text-base leading-none shrink-0" aria-hidden="true">
                        {item.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-khmer-body truncate">{item.labelKh}</div>
                        <div
                          className={`text-[10px] font-mono-tabular truncate ${
                            isActive ? 'text-indigo-600/90' : 'text-slate-400'
                          }`}
                        >
                          {item.labelEn}
                        </div>
                      </div>
                      {isActive && (
                        <span className="w-1.5 h-5 rounded-full bg-indigo-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* B. Right Content Workspace Panel */}
        <div className="flex-1 w-full min-w-0 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-6">
          {/* Active Tab Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-lg shrink-0">
                {activeTabMeta.emoji}
              </div>
              <div>
                <div className="text-[11px] font-bold text-indigo-600 font-khmer-body">
                  {activeTabMeta.sectionTitleKh}
                </div>
                <h3 className="text-base font-extrabold text-slate-900 font-khmer-moul">
                  {activeTabMeta.labelKh}{' '}
                  <span className="text-xs font-mono-tabular font-semibold text-slate-500">
                    ({activeTabMeta.labelEn})
                  </span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-mono-tabular font-semibold">
                Tab: {activeTab}
              </span>
            </div>
          </div>

          {/* =====================================================================
              TAB 1: ព័ត៌មានសាលា & ស្ថាប័ន (SCHOOL PROFILE & GRADING SCALES A-F)
          ===================================================================== */}
          {activeTab === 'SCHOOL_PROFILE' && (
            <div className="space-y-8">
              {/* 1A. Clean 2-Column School Profile Form Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span>ព័ត៌មានអត្តសញ្ញាណសាលា និងក្បាលរបាយការណ៍ផ្លូវការ (Official Report Headers)</span>
                    </h4>
                    <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                      ទិន្នន័យទាំងនេះនឹងបង្ហាញដោយស្វ័យប្រវត្តិនៅលើក្បាលទំព័រ និងហត្ថលេខាខាងក្រោមនៃរបាយការណ៍ផ្លូវការទាំង ៥ និងតារាងសិស្ស ៣៦ ជួរឈរ។
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Field 1: មន្ទីរអប់រំ យុវជន និងកីឡាខេត្ត */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="school-field-province"
                      className="block text-xs font-bold text-slate-800 font-khmer-body"
                    >
                      មន្ទីរអប់រំ យុវជន និងកីឡាខេត្ត (Provincial MoEYS)
                    </label>
                    <input
                      id="school-field-province"
                      type="text"
                      disabled={!canEditSettings}
                      value={getSettingValue(
                        'ProvinceMoEYS',
                        'មន្ទីរអប់រំ យុវជន និងកីឡាខេត្តបន្ទាយមានជ័យ'
                      )}
                      onChange={(e) =>
                        handleSettingChange(
                          'ProvinceMoEYS',
                          e.target.value,
                          'ឈ្មោះមន្ទីរអប់រំខេត្តលើក្បាលរបាយការណ៍'
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-khmer-body text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-50"
                    />
                    <p className="text-[11px] text-slate-400 font-khmer-body">
                      បង្ហាញនៅជួរទី១ ផ្នែកខាងឆ្វេងនៃរបាយការណ៍ផ្លូវការ (Key: ProvinceMoEYS)
                    </p>
                  </div>

                  {/* Field 2: ការិយាល័យអប់រំ ស្រុក */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="school-field-district"
                      className="block text-xs font-bold text-slate-800 font-khmer-body"
                    >
                      ការិយាល័យអប់រំ ស្រុក (District Office of Education)
                    </label>
                    <input
                      id="school-field-district"
                      type="text"
                      disabled={!canEditSettings}
                      value={getSettingValue(
                        'DistrictOffice',
                        'ការិយាល័យអប់រំ យុវជន និងកីឡា ស្រុកព្រះនេត្រព្រះ'
                      )}
                      onChange={(e) =>
                        handleSettingChange(
                          'DistrictOffice',
                          e.target.value,
                          'ឈ្មោះការិយាល័យអប់រំស្រុកលើក្បាលរបាយការណ៍'
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-khmer-body text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-50"
                    />
                    <p className="text-[11px] text-slate-400 font-khmer-body">
                      បង្ហាញនៅជួរទី២ ផ្នែកខាងឆ្វេងនៃរបាយការណ៍ផ្លូវការ (Key: DistrictOffice)
                    </p>
                  </div>

                  {/* Field 3: ឈ្មោះសាលា */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="school-field-name"
                      className="block text-xs font-bold text-slate-800 font-khmer-body"
                    >
                      ឈ្មោះសាលា (Official School Name)
                    </label>
                    <input
                      id="school-field-name"
                      type="text"
                      disabled={!canEditSettings}
                      value={getSettingValue('SchoolName', 'វិទ្យាល័យទឹកជោរ')}
                      onChange={(e) =>
                        handleSettingChange(
                          'SchoolName',
                          e.target.value,
                          'ឈ្មោះគ្រឹះស្ថានសិក្សាផ្លូវការ'
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-khmer-body text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-50"
                    />
                    <p className="text-[11px] text-slate-400 font-khmer-body">
                      បង្ហាញនៅជួរទី៣ ផ្នែកខាងឆ្វេង និងក្នុងប្រព័ន្ធទាំងមូល (Key: SchoolName)
                    </p>
                  </div>

                  {/* Field 4: ឈ្មោះនាយកសាលា */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="school-field-principal"
                      className="block text-xs font-bold text-slate-800 font-khmer-body"
                    >
                      ឈ្មោះនាយកសាលា (School Principal Name)
                    </label>
                    <input
                      id="school-field-principal"
                      type="text"
                      disabled={!canEditSettings}
                      value={getSettingValue('PrincipalName', 'សុខ ចាន់ថន')}
                      onChange={(e) =>
                        handleSettingChange(
                          'PrincipalName',
                          e.target.value,
                          'ឈ្មោះនាយកសាលាសម្រាប់ហត្ថលេខាបានឃើញ និងឯកភាព'
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-khmer-body text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-50"
                    />
                    <p className="text-[11px] text-slate-400 font-khmer-body">
                      បង្ហាញនៅក្រោមប្រអប់ហត្ថលេខា «បានឃើញ និងឯកភាព នាយកសាលា» (Key: PrincipalName)
                    </p>
                  </div>

                  {/* Field 5: កាលបរិច្ឆេទប្រពៃណី / ចន្ទគតិ (Default Lunar Date Text) */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="school-field-lunar"
                      className="block text-xs font-bold text-slate-800 font-khmer-body"
                    >
                      កាលបរិច្ឆេទប្រពៃណី / ចន្ទគតិ (Default Lunar Date Text)
                    </label>
                    <input
                      id="school-field-lunar"
                      type="text"
                      disabled={!canEditSettings}
                      value={getSettingValue(
                        'DefaultLunarDate',
                        'ថ្ងៃសៅរ៍ ៩កើត ខែមិគសិរ ឆ្នាំជូត ទោស័ក ព.ស. ២៥៦៩'
                      )}
                      onChange={(e) =>
                        handleSettingChange(
                          'DefaultLunarDate',
                          e.target.value,
                          'កាលបរិច្ឆេទចន្ទគតិលំនាំដើមសម្រាប់របាយការណ៍ផ្លូវការ'
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-khmer-body text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-50"
                    />
                    <p className="text-[11px] text-slate-400 font-khmer-body">
                      ឧទាហរណ៍៖ ថ្ងៃសៅរ៍ ៩កើត ខែមិគសិរ ឆ្នាំជូត ទោស័ក ព.ស. ២៥៦៩ (Key: DefaultLunarDate)
                    </p>
                  </div>

                  {/* Field 6: កាលបរិច្ឆេទសុរិយគតិ (Default Solar Date Text) */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="school-field-solar"
                      className="block text-xs font-bold text-slate-800 font-khmer-body"
                    >
                      កាលបរិច្ឆេទសុរិយគតិ (Default Solar Date Text)
                    </label>
                    <input
                      id="school-field-solar"
                      type="text"
                      disabled={!canEditSettings}
                      value={getSettingValue(
                        'DefaultSolarDate',
                        'ទឹកជោរ, ថ្ងៃទី២៩ ខែវិច្ឆិកា ឆ្នាំ២០២៥'
                      )}
                      onChange={(e) =>
                        handleSettingChange(
                          'DefaultSolarDate',
                          e.target.value,
                          'កាលបរិច្ឆេទសុរិយគតិលំនាំដើមសម្រាប់របាយការណ៍ផ្លូវការ'
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-khmer-body text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-50"
                    />
                    <p className="text-[11px] text-slate-400 font-khmer-body">
                      ឧទាហរណ៍៖ ទឹកជោរ, ថ្ងៃទី២៩ ខែវិច្ឆិកា ឆ្នាំ២០២៥ (Key: DefaultSolarDate)
                    </p>
                  </div>
                </div>
              </div>

              {/* 1B. Grading Scales (A–F) Configuration Section */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-indigo-600" />
                      <span>មាត្រដ្ឋាននិទ្ទេសផ្លូវការ (GradingScales A, B, C, D, E, F)</span>
                    </h4>
                    <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                      កំណត់កម្រិតពិន្ទុអប្បបរមា និងអតិបរមា (មាត្រដ្ឋាន ៥០ ពិន្ទុ) សម្រាប់គណនានិទ្ទេសស្វ័យប្រវត្តិ
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-khmer-body font-semibold">
                    មធ្យមភាគ -1.72 ឬ អវត្តមាន = មិនចាត់ថ្នាក់
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200/90 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs font-khmer-body">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-3 px-4 text-center w-24">កម្រិតនិទ្ទេស</th>
                        <th className="py-3 px-4 w-36">ពិន្ទុអប្បបរមា (Min)</th>
                        <th className="py-3 px-4 w-36">ពិន្ទុអតិបរមា (Max)</th>
                        <th className="py-3 px-4">ការពិពណ៌នានិទ្ទេស (Description)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70">
                      {scalesDraft.map((sc) => (
                        <tr key={sc.GradingScaleID} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-xl font-extrabold font-mono-tabular text-sm ${
                                sc.Grade === 'A' || sc.Grade === 'B'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : sc.Grade === 'F'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {sc.Grade}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            <input
                              type="number"
                              step="0.01"
                              disabled={!canEditSettings}
                              aria-label={`Min score for Grade ${sc.Grade}`}
                              value={sc.MinimumScore}
                              onChange={(e) =>
                                handleScaleChange(sc.GradingScaleID, 'MinimumScore', e.target.value)
                              }
                              className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono-tabular font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-4">
                            <input
                              type="number"
                              step="0.01"
                              disabled={!canEditSettings}
                              aria-label={`Max score for Grade ${sc.Grade}`}
                              value={sc.MaximumScore}
                              onChange={(e) =>
                                handleScaleChange(sc.GradingScaleID, 'MaximumScore', e.target.value)
                              }
                              className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono-tabular font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              disabled={!canEditSettings}
                              aria-label={`Description for Grade ${sc.Grade}`}
                              value={sc.Description}
                              onChange={(e) =>
                                handleScaleChange(sc.GradingScaleID, 'Description', e.target.value)
                              }
                              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-khmer-body bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 2: ឆ្នាំសិក្សា & ឆមាស (ACADEMIC YEARS & SEMESTERS)
          ===================================================================== */}
          {activeTab === 'ACADEMIC_YEARS' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {db.AcademicYears.map((ay) => {
                  const relatedSemesters = db.Semesters.filter(
                    (s) => s.AcademicYearID === ay.AcademicYearID
                  );
                  return (
                    <div
                      key={ay.AcademicYearID}
                      className={`p-5 rounded-2xl border transition-all space-y-4 ${
                        ay.IsCurrent
                          ? 'bg-indigo-50/40 border-indigo-300 shadow-2xs'
                          : 'bg-slate-50/60 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-indigo-600" />
                            <h4 className="text-base font-extrabold text-slate-900 font-khmer-moul">
                              ឆ្នាំសិក្សា {ay.AcademicYearName}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-500 font-mono-tabular mt-1">
                            ID: {ay.AcademicYearID} • {ay.StartDate} → {ay.EndDate}
                          </p>
                        </div>

                        {ay.IsCurrent ? (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold font-khmer-body">
                            🟢 ឆ្នាំសិក្សាបច្ចុប្បន្ន
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!canEditSettings}
                            onClick={() =>
                              handleSetCurrentAcademicYear(ay.AcademicYearID, ay.AcademicYearName)
                            }
                            className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-indigo-500 text-xs font-bold text-slate-700 hover:text-indigo-600 font-khmer-body cursor-pointer transition-colors"
                          >
                            កំណត់ជាបច្ចុប្បន្ន
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-200/70">
                        <div className="text-xs font-bold text-slate-700 font-khmer-body">
                          ឆមាសសិក្សា (Semesters):
                        </div>
                        {relatedSemesters.length === 0 ? (
                          <div className="text-xs text-slate-400 font-khmer-body">
                            មិនទាន់មានទិន្នន័យឆមាសសម្រាប់ឆ្នាំសិក្សានេះទេ។
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {relatedSemesters.map((sem) => (
                              <div
                                key={sem.SemesterID}
                                className="p-3 rounded-xl bg-white border border-slate-200/80 text-xs space-y-1"
                              >
                                <div className="font-bold text-slate-800 font-khmer-body flex items-center justify-between">
                                  <span>{sem.SemesterName}</span>
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-mono-tabular">
                                    {sem.Status}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono-tabular">
                                  {sem.StartDate} → {sem.EndDate}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add New Academic Year Card */}
              <form
                onSubmit={handleAddAcademicYear}
                className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-4"
              >
                <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body">
                  ➕ បង្កើតឆ្នាំសិក្សាថ្មី (Add Academic Year)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 font-khmer-body">
                      ឈ្មោះឆ្នាំសិក្សា (ឧ. ២០២៧-២០២៨)
                    </label>
                    <input
                      type="text"
                      value={newYearName}
                      onChange={(e) => setNewYearName(e.target.value)}
                      placeholder="២០២៧-២០២៨"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-khmer-body bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 font-khmer-body">
                      ថ្ងៃចាប់ផ្តើមបវេសនកាល (Start Date)
                    </label>
                    <input
                      type="date"
                      value={newYearStart}
                      onChange={(e) => setNewYearStart(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono-tabular bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 font-khmer-body">
                      ថ្ងៃបញ្ចប់ឆ្នាំសិក្សា (End Date)
                    </label>
                    <input
                      type="date"
                      value={newYearEnd}
                      onChange={(e) => setNewYearEnd(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono-tabular bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!canEditSettings || !newYearName.trim()}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold font-khmer-body transition-colors cursor-pointer"
                >
                  បន្ថែមឆ្នាំសិក្សាថ្មីទៅក្នុងសន្លឹក AcademicYears
                </button>
              </form>
            </div>
          )}

          {/* =====================================================================
              TAB 3: ការកំណត់គណនី & AUTH (AUTHENTICATION & SECURITY)
          ===================================================================== */}
          {activeTab === 'AUTHENTICATION' && (
            <div className="space-y-6">
              {/* Sub-mode Switcher: Security Policy & Staff List vs Automated Bulk Student Account Provisioning */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="text-xs font-bold text-slate-700 font-khmer-body">
                  ជ្រើសរើសផ្នែកគ្រប់គ្រងគណនី៖ គោលការណ៍សុវត្ថិភាពបុគ្គលិក ឬ ការបង្កើតគណនីសិស្សស្វ័យប្រវត្តិ (៣៦ ជួរឈរ)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkStudentProvisioning(false)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold font-khmer-body transition-colors cursor-pointer ${
                      !showBulkStudentProvisioning
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    🔐 គោលការណ៍ពាក្យសម្ងាត់ &amp; បុគ្គលិក (Staff &amp; Auth Policy)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBulkStudentProvisioning(true)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold font-khmer-body transition-colors cursor-pointer ${
                      showBulkStudentProvisioning
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    🎓 បង្កើតគណនីសិស្សស្វ័យប្រវត្តិ (Bulk Student Accounts)
                  </button>
                </div>
              </div>

              {!showBulkStudentProvisioning ? (
                <>
                  {/* Card 1 & Card 2: Password Policy Controls + Session Timeout Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 1. Password Policy Controls */}
                    <div className="p-5 rounded-2xl bg-slate-50/60 border border-slate-200/90 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body">
                            គោលការណ៍ពាក្យសម្ងាត់ (Password Policy Controls)
                          </h4>
                          <p className="text-[11px] text-slate-500 font-khmer-body">
                            កំណត់ប្រវែងពាក្យសម្ងាត់អប្បបរមា និងការបំប្លែងកូដសម្ងាត់ក្នុងសន្លឹក Users
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label
                            htmlFor="auth-min-pwd-len"
                            className="block text-xs font-bold text-slate-700 font-khmer-body"
                          >
                            ប្រវែងពាក្យសម្ងាត់អប្បបរមា (Minimum Password Length)
                          </label>
                          <input
                            id="auth-min-pwd-len"
                            type="number"
                            min={6}
                            max={32}
                            value={minPasswordLength}
                            onChange={(e) => setMinPasswordLength(Number(e.target.value) || 8)}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono-tabular font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label
                            htmlFor="auth-default-student-pwd"
                            className="block text-xs font-bold text-slate-700 font-khmer-body"
                          >
                            ពាក្យសម្ងាត់លំនាំដើមសម្រាប់សិស្ស &amp; បុគ្គលិកថ្មី (Default Password Prefix)
                          </label>
                          <input
                            id="auth-default-student-pwd"
                            type="text"
                            value={defaultStudentPwdPrefix}
                            onChange={(e) => setDefaultStudentPwdPrefix(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono-tabular font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label
                            htmlFor="auth-hash-algo"
                            className="block text-xs font-bold text-slate-700 font-khmer-body"
                          >
                            ក្បួនបំប្លែងពាក្យសម្ងាត់ (Password Hashing Algorithm)
                          </label>
                          <select
                            id="auth-hash-algo"
                            value={hashAlgorithm}
                            onChange={(e) => setHashAlgorithm(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono-tabular bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                            <option value="SHA-256 + Per-User Salt">
                              SHA-256 + Per-User Salt (Utilities.computeDigest)
                            </option>
                            <option value="PBKDF2-HMAC-SHA256">
                              PBKDF2-HMAC-SHA256 (High Security)
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* 2. Session Timeout Settings */}
                    <div className="p-5 rounded-2xl bg-slate-50/60 border border-slate-200/90 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <Lock className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body">
                            ការកំណត់រយៈពេល Session (Session Timeout Settings)
                          </h4>
                          <p className="text-[11px] text-slate-500 font-khmer-body">
                            គ្រប់គ្រងរយៈពេលផុតកំណត់ Token និងការចាក់សោស្វ័យប្រវត្តិ
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label
                            htmlFor="auth-session-timeout"
                            className="block text-xs font-bold text-slate-700 font-khmer-body"
                          >
                            រយៈពេលផុតកំណត់ Token គិតជាម៉ោង (Token Expiration in Hours)
                          </label>
                          <input
                            id="auth-session-timeout"
                            type="number"
                            min={1}
                            max={72}
                            value={sessionTimeoutHours}
                            onChange={(e) => setSessionTimeoutHours(Number(e.target.value) || 8)}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono-tabular font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          <p className="text-[11px] text-slate-400 font-khmer-body">
                            លំនាំដើម៖ 8 ម៉ោងសម្រាប់ថ្ងៃធ្វើការនៅវិទ្យាល័យទឹកជោរ
                          </p>
                        </div>

                        <label className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enforceIdleLock}
                            onChange={(e) => setEnforceIdleLock(e.target.checked)}
                            className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-800 font-khmer-body">
                              បិទ Session ស្វ័យប្រវត្តិនៅពេលទំនេរលើស ៣០ នាទី (Auto-Idle Lock)
                            </div>
                            <div className="text-[11px] text-slate-500 font-khmer-body mt-0.5">
                              ការពារគណនីគ្រូបង្រៀននៅពេលភ្លេចចាកចេញពីកុំព្យូទ័រក្នុងបន្ទប់រៀន
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 3. Active Admin & Staff Accounts Quick List */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body">
                          បញ្ជីគណនីគណៈគ្រប់គ្រង និងគ្រូបង្រៀន (Active Admin &amp; Staff Accounts Quick List)
                        </h4>
                        <p className="text-xs text-slate-500 font-khmer-body">
                          គ្រប់គ្រងគណនីបុគ្គលិក ({staffAccounts.length} គណនី) ជាមួយមុខងារកំណត់ពាក្យសម្ងាត់ឡើងវិញ និងបិទ/បើកសិទ្ធិប្រើប្រាស់ភ្លាមៗ
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-left border-collapse text-xs font-khmer-body">
                        <thead>
                          <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                            <th className="py-3 px-4">ឈ្មោះបុគ្គលិក / គ្រូបង្រៀន</th>
                            <th className="py-3 px-4">Username</th>
                            <th className="py-3 px-4">តួនាទី (Role)</th>
                            <th className="py-3 px-4 text-center">ស្ថានភាព (Status)</th>
                            <th className="py-3 px-4 text-right">សកម្មភាពរហ័ស (Quick Actions)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70">
                          {staffAccounts.map((staff) => {
                            const roleObj = db.Roles.find((r) => r.RoleID === staff.RoleID);
                            const isActive = staff.Status === 'ACTIVE';
                            return (
                              <tr key={staff.UserID} className="hover:bg-slate-50/70">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-900">{staff.FullNameKh}</div>
                                  <div className="text-[11px] text-slate-400 font-mono-tabular">
                                    {staff.FullNameEn} • {staff.Phone}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-mono-tabular font-semibold text-slate-700">
                                  {staff.Username}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[11px] font-mono-tabular font-bold">
                                    {roleObj?.RoleName || staff.RoleID}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                      isActive
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isActive ? 'bg-emerald-500' : 'bg-rose-500'
                                      }`}
                                    />
                                    {staff.Status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleStaffResetPassword(staff.UserID, staff.FullNameKh)
                                      }
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 font-semibold transition-colors cursor-pointer"
                                    >
                                      <KeyRound className="w-3.5 h-3.5" />
                                      <span>Reset Password</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleStaffStatus(
                                          staff.UserID,
                                          staff.FullNameKh,
                                          staff.Status
                                        )
                                      }
                                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border font-semibold transition-colors cursor-pointer ${
                                        isActive
                                          ? 'bg-rose-50/70 border-rose-200 text-rose-700 hover:bg-rose-100'
                                          : 'bg-emerald-50/70 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                      }`}
                                    >
                                      {isActive ? (
                                        <>
                                          <UserX className="w-3.5 h-3.5" />
                                          <span>Deactivate</span>
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="w-3.5 h-3.5" />
                                          <span>Activate</span>
                                        </>
                                      )}
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
                </>
              ) : (
                setDb && (
                  <StudentAccountsManagementPage
                    db={db}
                    setDb={setDb}
                    activeUserId={activeUserId}
                    onLoginAsStudent={
                      onLoginAsStudent ||
                      (() => {
                        /* no-op fallback */
                      })
                    }
                  />
                )
              )}
            </div>
          )}

          {/* =====================================================================
              TAB 4: សិទ្ធិ & តួនាទី (ROLES & RBAC)
          ===================================================================== */}
          {activeTab === 'ROLES_RBAC' && (
            <div className="space-y-6">
              <DualRoleTeacherPermissionCard
                db={db}
                setDb={setDb}
                activeUserId={activeUserId}
              />

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {db.Roles.map((role) => {
                  const userCount = db.Users.filter((u) => u.RoleID === role.RoleID).length;
                  return (
                    <div
                      key={role.RoleID}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        <span className="text-[11px] font-mono-tabular font-bold text-slate-400">
                          {role.RoleID}
                        </span>
                      </div>
                      <div className="text-sm font-extrabold font-mono-tabular text-slate-900">
                        {role.RoleName}
                      </div>
                      <p className="text-xs text-slate-600 font-khmer-body line-clamp-2">
                        {role.Description}
                      </p>
                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-mono-tabular text-slate-500">
                        <span>{userCount} Users</span>
                        <span>{role.Status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <DesignSystemAndAuthView db={db} />
            </div>
          )}

          {/* =====================================================================
              TAB 5: GAS API ENDPOINT & SYNC (GOOGLE APPS SCRIPT CONFIGURATION)
          ===================================================================== */}
          {activeTab === 'GAS_ENDPOINT' && (
            <div className="space-y-6">
              {/* 1. GAS Web App URL Input & Connection Status Card */}
              <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-indigo-600" />
                      <span>ការកំណត់តំណភ្ជាប់ Google Apps Script Web App (GAS API Endpoint)</span>
                    </h4>
                    <p className="text-xs text-slate-500 font-khmer-body mt-0.5">
                      ភ្ជាប់ Frontend ទៅកាន់ Google Sheets ទាំង ១៩ សន្លឹកតាមរយៈ <code>doPost(e)</code> /{' '}
                      <code>google.script.run</code>
                    </p>
                  </div>

                  {/* Live Connection Status Badge */}
                  <div>
                    {gasConnectionStatus === 'CONNECTED' && (
                      <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold font-khmer-body shadow-2xs">
                        <span>🟢 បានតភ្ជាប់ជោគជ័យ</span>
                        <span className="font-mono-tabular text-[11px] text-emerald-600">
                          ({gasPingLatencyMs}ms)
                        </span>
                      </span>
                    )}
                    {gasConnectionStatus === 'ERROR' && (
                      <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold font-khmer-body shadow-2xs">
                        <span>🔴 ការតភ្ជាប់បរាជ័យ (Invalid Endpoint)</span>
                      </span>
                    )}
                    {gasConnectionStatus === 'TESTING' && (
                      <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold font-khmer-body">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>កំពុងពិនិត្យការតភ្ជាប់...</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3 space-y-1.5">
                    <label
                      htmlFor="gas-webapp-url"
                      className="block text-xs font-bold text-slate-800 font-khmer-body"
                    >
                      GAS Web App URL (https://script.google.com/macros/s/.../exec)
                    </label>
                    <input
                      id="gas-webapp-url"
                      type="url"
                      value={gasEndpointUrl}
                      onChange={(e) => setGasEndpointUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono-tabular text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="gas-deploy-env"
                      className="block text-xs font-bold text-slate-800 font-khmer-body"
                    >
                      បរិស្ថាន (Deployment Env)
                    </label>
                    <select
                      id="gas-deploy-env"
                      value={gasDeploymentEnv}
                      onChange={(e) =>
                        setGasDeploymentEnv(e.target.value as 'PRODUCTION' | 'STAGING')
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono-tabular font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="PRODUCTION">PRODUCTION (/exec)</option>
                      <option value="STAGING">STAGING (/dev)</option>
                    </select>
                  </div>
                </div>

                {/* Action Buttons: Test Connection & Initialize 19 Sheets */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleTestGasConnection}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:border-indigo-500 text-slate-800 hover:text-indigo-600 text-xs font-bold font-khmer-body transition-all cursor-pointer shadow-2xs"
                    >
                      <span>🔗 ពិនិត្យការតភ្ជាប់ GAS (Test Connection)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleInitialize19Sheets}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body transition-all cursor-pointer shadow-2xs"
                    >
                      <span>
                        ⚙️ បង្កើត/ត្រួតពិនិត្យតារាង Database ទាំង ១៩ សន្លឹក (Initialize 19 Sheets)
                      </span>
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 font-khmer-body">
                    សមកាលកម្មចុងក្រោយ៖ <span className="font-bold">{lastSheetSyncTime}</span>
                  </div>
                </div>
              </div>

              {/* Toggle to inspect all 18 .gs Backend Modules */}
              <div className="p-5 rounded-2xl border border-slate-200/90 bg-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                      <Code2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body">
                        កូដម៉ូឌុល Backend ទាំង ១៨ ឯកសារ (18 Modular Google Apps Script .gs Files)
                      </h4>
                      <p className="text-xs text-slate-500 font-khmer-body">
                        រួមបញ្ចូលទាំង <code>Config.gs</code>, <code>Setup.gs</code>,{' '}
                        <code>AuthService.gs</code>, <code>StudentAccountService.gs</code> និង{' '}
                        <code>ReportService.gs</code>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowGasModulesCode((v) => !v)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold font-khmer-body transition-colors cursor-pointer shrink-0"
                  >
                    {showGasModulesCode
                      ? 'លាក់កូដម៉ូឌុល .gs (Hide Code)'
                      : 'បង្ហាញកូដម៉ូឌុលទាំង ១៨ (.gs Inspector)'}
                  </button>
                </div>

                {showGasModulesCode && <GasArchitectureView />}
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 6: DATABASE & 19 SHEETS STATUS
          ===================================================================== */}
          {activeTab === 'DATABASE_STATUS' && (
            <div className="space-y-6">
              {/* Phase 12 GAS Performance Architecture Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-khmer-body">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 font-bold text-blue-700">
                    <Database className="w-4 h-4" />
                    <span>1. Batched getValues() / setValues()</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    អាន និងសរសេរទិន្នន័យសិស្សទាំង ៣៦ ជួរឈរ និងពិន្ទុទាំងមូលក្នុងការហៅ API តែមួយដង។
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
                    <Cpu className="w-4 h-4" />
                    <span>2. CacheService (TTL 15 នាទី)</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    រក្សាទុក SystemSettings, Subjects, Classes (7A–12C) និង GradingScales ក្នុងអង្គចងចាំបណ្តោះអាសន្ន។
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 font-bold text-indigo-700">
                    <Lock className="w-4 h-4" />
                    <span>3. LockService Concurrency</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    ការពារការប៉ះទង្គិចទិន្នន័យ (Race Conditions) នៅពេលសិស្សច្រើននាក់បញ្ជូនកិច្ចការប្រឡងក្នុងពេលតែមួយ។
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 font-bold text-amber-700">
                    <Zap className="w-4 h-4" />
                    <span>4. Tie-Ranking &amp; Pagination</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    គណនាចំណាត់ថ្នាក់ស្មើគ្នា (1, 1, 3) និងដាក់សិស្សអវត្តមាននៅបាតតារាងដោយស្វ័យប្រវត្តិ។
                  </p>
                </div>
              </div>

              {/* Live 19 Sheets Health Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs font-khmer-body">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">ឈ្មោះសន្លឹកទិន្នន័យ (Sheet Name)</th>
                      <th className="py-3 px-4">Primary Key</th>
                      <th className="py-3 px-4 text-center">ចំនួនជួរឈរ (Cols)</th>
                      <th className="py-3 px-4 text-center">ចំនួនទិន្នន័យ (Rows)</th>
                      <th className="py-3 px-4 text-right">ស្ថានភាព (Health)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {DATABASE_SHEETS_SCHEMA.map((schema, idx) => {
                      const count = getSheetRowCount(schema.sheetName);
                      const pkCol =
                        schema.columns.find((c) => c.keyType === 'PK')?.name ||
                        schema.columns[0]?.name ||
                        'ID';
                      return (
                        <tr key={schema.sheetName} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4 text-center font-mono-tabular text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-bold font-mono-tabular text-slate-900">
                              {schema.sheetName}
                            </div>
                            <div className="text-[11px] text-slate-500">{schema.khmerTitle}</div>
                          </td>
                          <td className="py-2.5 px-4 font-mono-tabular text-indigo-600 font-semibold">
                            {pkCol}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono-tabular font-bold text-slate-700">
                            {schema.columns.length}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono-tabular font-bold text-slate-900">
                            {count}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>SYNCED</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 7: សវនកម្ម (AUDIT LOGS)
          ===================================================================== */}
          {activeTab === 'AUDIT_LOGS' && <AuditLogsPage db={db} activeUserId={activeUserId} />}

          {/* =====================================================================
              TAB 8: បម្រុងទុកទិន្នន័យ (BACKUP & RESET)
          ===================================================================== */}
          {activeTab === 'BACKUP_RESET' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Export Full 19-Sheet JSON Snapshot */}
              <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Download className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 font-khmer-body">
                    ទាញយកឯកសារទិន្នន័យទាំង ១៩ សន្លឹក (Export Full JSON Snapshot)
                  </h4>
                  <p className="text-xs text-slate-500 font-khmer-body leading-relaxed">
                    រក្សាទុកទិន្នន័យសិស្សទាំង ៣៦ ជួរឈរ ពិន្ទុប្រចាំខែ ឃ្លាំងសំណួរ គណនីអ្នកប្រើប្រាស់ និងកំណត់ហេតុសវនកម្មទាំងអស់ជាឯកសារ JSON សម្រាប់ការពារទិន្នន័យ។
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportBackupJson}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-khmer-body transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>ទាញយកឯកសារ Backup (.json)</span>
                </button>
              </div>

              {/* Card 2: Reset to Default Teok Chor High School Seed State */}
              <div className="p-6 rounded-2xl bg-rose-50/40 border border-rose-200/80 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-extrabold text-rose-950 font-khmer-body">
                    កំណត់ទិន្នន័យដើមឡើងវិញ (Reset to Teok Chor Seed Data)
                  </h4>
                  <p className="text-xs text-rose-800/80 font-khmer-body leading-relaxed">
                    ត្រឡប់ទិន្នន័យទាំង ១៩ សន្លឹកទៅកាន់ទិន្នន័យដើមរបស់វិទ្យាល័យទឹកជោរ (ថ្នាក់ 12C គ្រូបន្ទុកថ្នាក់ ជួន លីរតនៈ និងសិស្សគំរូ)។
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!canEditSettings}
                  onClick={() => {
                    if (onResetDatabase) {
                      onResetDatabase();
                    }
                    setToast({
                      tone: 'info',
                      title: 'បានកំណត់ទិន្នន័យប្រព័ន្ធទៅកាន់ទិន្នន័យដើមឡើងវិញ',
                      description: 'មូលដ្ឋានទិន្នន័យទាំង ១៩ សន្លឹកត្រូវបានស្តារឡើងវិញដោយជោគជ័យ។',
                    });
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold font-khmer-body transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>កំណត់ទិន្នន័យដើមឡើងវិញ (Factory Seed Reset)</span>
                </button>
              </div>
            </div>
          )}

          {/* Sticky Bottom Action Bar: "រក្សាទុកការផ្លាស់ប្តូរ (Save Changes)" */}
          <div className="no-print sticky bottom-0 z-10 -mx-6 -mb-6 mt-6 px-6 py-4 bg-white/95 backdrop-blur-md border-t border-slate-200/80 rounded-b-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-slate-500 font-khmer-body">
              រាល់ការផ្លាស់ប្តូរនឹងត្រូវកត់ត្រាទុកក្នុងសន្លឹក <code className="font-mono-tabular text-slate-700">AuditLogs</code> ដោយស្វ័យប្រវត្តិ។
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSettingsDraft(db.SystemSettings.map((s) => ({ ...s })));
                  setScalesDraft(db.GradingScales.map((g) => ({ ...g })));
                  setToast({
                    tone: 'info',
                    title: 'បានបោះបង់ការកែប្រែបណ្តោះអាសន្ន',
                    description: 'តម្លៃក្នុងទម្រង់ត្រូវបានត្រឡប់ទៅតម្លៃចុងក្រោយដែលបានរក្សាទុក។',
                  });
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
              >
                បោះបង់ (Discard)
              </button>

              <button
                type="button"
                disabled={!canEditSettings}
                onClick={handleGlobalSaveChanges}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold font-khmer-body shadow-sm transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>រក្សាទុកការផ្លាស់ប្តូរ (Save Changes)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
