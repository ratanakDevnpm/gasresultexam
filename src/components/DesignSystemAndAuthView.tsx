import React, { useState } from 'react';
import {
  DatabaseState,
  GenderKh,
  TeacherSubjectAssignmentRecord,
  UserRecord,
} from '../types/database';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_DEMO_PASSWORD } from '../lib/seedData';
import { hashPasswordSha256 } from '../lib/domainRules';
import {
  Badge,
  Button,
  Card,
  ConfirmationDialog,
  DataTable,
  DatePicker,
  EmptyState,
  Input,
  LoadingState,
  Modal,
  Pagination,
  Select,
  Tabs,
  Toast,
} from './ui';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  LogOut,
  Palette,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';

interface DesignSystemAndAuthViewProps {
  db: DatabaseState;
}

export const DesignSystemAndAuthView: React.FC<DesignSystemAndAuthViewProps> = ({ db }) => {
  const {
    session,
    login,
    logout,
    setActiveUserId,
    createUserWithHashedPassword,
    toggleUserStatus,
    assignTeacherSubject,
  } = useAuth();

  const [subTab, setSubTab] = useState<'AUTH_AND_USERS' | 'DESIGN_SYSTEM'>('AUTH_AND_USERS');

  // Login Simulator State
  const [loginIdentifier, setLoginIdentifier] = useState<string>('6463');
  const [loginPassword, setLoginPassword] = useState<string>(DEFAULT_DEMO_PASSWORD);
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [authBanner, setAuthBanner] = useState<{
    tone: 'success' | 'danger' | 'info';
    title: string;
    description: string;
  } | null>({
    tone: 'info',
    title: 'ប្រព័ន្ធផ្ទៀងផ្ទាត់អត្តសញ្ញាណ (Authentication.gs & Authorization.gs)',
    description:
      'គាំទ្រការចូលប្រើប្រាស់តាមរយៈ Username / Email សម្រាប់បុគ្គលិក និង អត្តលេខសិស្ស (StudentCode ដូចជា 6463, 6386, 5187, 6426, 6648) ដោយប្រើ SHA-256(password + PasswordSalt)។',
  });

  // Create User Modal State
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState(DEFAULT_DEMO_PASSWORD);
  const [newFullNameKh, setNewFullNameKh] = useState('');
  const [newFullNameEn, setNewFullNameEn] = useState('');
  const [newGender, setNewGender] = useState<GenderKh>('ប្រុស');
  const [newPhone, setNewPhone] = useState('012 889 900');
  const [newRoleId, setNewRoleId] = useState('ROL-03');

  // Teacher Assignment State
  const [assignTeacherId, setAssignTeacherId] = useState('USR-TCH-12C');
  const [assignSubjectId, setAssignSubjectId] = useState('SUB-ICT');
  const [assignClassId, setAssignClassId] = useState('CLS-12A');

  // Design System Interactive Preview States
  const [demoDate, setDemoDate] = useState('2026-11-01');
  const [demoPage, setDemoPage] = useState(1);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isDemoConfirmOpen, setIsDemoConfirmOpen] = useState(false);
  const [showDemoLoading, setShowDemoLoading] = useState(false);
  const [demoToastMessage, setDemoToastMessage] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = login(loginIdentifier, loginPassword);
    if (res.ok) {
      setAuthBanner({
        tone: 'success',
        title: res.messageKh,
        description: `${res.messageEn} | Session Token: ${res.sessionToken}`,
      });
    } else {
      setAuthBanner({
        tone: 'danger',
        title: res.messageKh,
        description: res.messageEn,
      });
    }
  };

  const handleQuickCredentialFill = (identifier: string, label: string) => {
    setLoginIdentifier(identifier);
    setLoginPassword(DEFAULT_DEMO_PASSWORD);
    const res = login(identifier, DEFAULT_DEMO_PASSWORD);
    if (res.ok) {
      setAuthBanner({
        tone: 'success',
        title: `${res.messageKh} — [${label}]`,
        description: `${res.messageEn} | Session Token: ${res.sessionToken}`,
      });
    }
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newFullNameKh.trim()) return;
    const created = createUserWithHashedPassword({
      username: newUsername,
      email: newEmail || `${newUsername}@teokchor.edu.kh`,
      rawPassword: newPassword,
      fullNameKh: newFullNameKh,
      fullNameEn: newFullNameEn || newUsername.toUpperCase(),
      gender: newGender,
      phone: newPhone,
      roleId: newRoleId,
    });
    setIsCreateUserModalOpen(false);
    setNewUsername('');
    setNewEmail('');
    setNewFullNameKh('');
    setNewFullNameEn('');
    setAuthBanner({
      tone: 'success',
      title: `បង្កើតគណនីថ្មីជោគជ័យ៖ ${created.FullNameKh} (${created.Username})`,
      description: `SHA-256 PasswordHash=${created.PasswordHash.slice(0, 24)}... | Salt=${created.PasswordSalt}`,
    });
  };

  const handleAssignSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assigned = assignTeacherSubject({
      teacherId: assignTeacherId,
      subjectId: assignSubjectId,
      classId: assignClassId,
      academicYearId: 'AY-2025-2026',
    });
    const teacher = db.Users.find((u) => u.UserID === assigned.TeacherID);
    const subject = db.Subjects.find((s) => s.SubjectID === assigned.SubjectID);
    const cls = db.Classes.find((c) => c.ClassID === assigned.ClassID);
    setAuthBanner({
      tone: 'success',
      title: `ចាត់តាំងមុខវិជ្ជាជោគជ័យ (${assigned.AssignmentID})`,
      description: `គ្រូបង្រៀន ${teacher?.FullNameKh} ត្រូវបានចាត់តាំងឱ្យបង្រៀនមុខវិជ្ជា ${subject?.SubjectNameKh} ថ្នាក់ទី ${cls?.ClassName}`,
    });
  };

  const teacherUsers = db.Users.filter((u) => u.RoleID === 'ROL-03');

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar using Standardized Tabs component */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900 font-khmer-moul">
            ប្រព័ន្ធសុវត្ថិភាព គណនីអ្នកប្រើប្រាស់ និងស្តង់ដាររចនា (Phase 1–2 Security & Global Design System)
          </h1>
          <p className="text-xs text-slate-600 font-khmer-body mt-0.5">
            Authentication.gs · Authorization.gs · UserService.gs · TeacherAssignmentService.gs · 14 Standardized UI Components
          </p>
        </div>
        <Tabs
          items={[
            {
              id: 'AUTH_AND_USERS',
              label: 'ផ្ទៀងផ្ទាត់គណនី និងសិទ្ធិគ្រូបង្រៀន (Auth & RBAC)',
              icon: <ShieldCheck className="w-3.5 h-3.5" />,
            },
            {
              id: 'DESIGN_SYSTEM',
              label: 'ស្តង់ដារ UI ទាំង ១៤ (Global Design System)',
              icon: <Palette className="w-3.5 h-3.5" />,
              count: 14,
            },
          ]}
          activeId={subTab}
          onChange={(id) => setSubTab(id as 'AUTH_AND_USERS' | 'DESIGN_SYSTEM')}
        />
      </div>

      {authBanner && (
        <Toast
          tone={authBanner.tone}
          title={authBanner.title}
          description={authBanner.description}
          onDismiss={() => setAuthBanner(null)}
        />
      )}

      {subTab === 'AUTH_AND_USERS' ? (
        <div className="space-y-6">
          {/* Top Grid: Enterprise Login Form + Active Session & Portal Router */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 5 cols: Authentication.gs Redesigned Login Form */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all">
              {/* Institutional Top Accent Banner */}
              <div className="bg-gradient-to-r from-[#14171F] via-[#1E2433] to-[#1E3A8A] px-6 py-5 text-white relative overflow-hidden">
                <div className="w-36 h-36 rounded-full bg-indigo-500/15 blur-2xl absolute -top-12 -right-10 pointer-events-none" />
                <div className="flex items-start justify-between gap-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300 font-mono-tabular">
                        វិទ្យាល័យទឹកជោរ • Authentication.gs
                      </div>
                      <h2 className="text-base font-bold text-white font-khmer-moul mt-0.5">
                        ១. ផ្ទៀងផ្ទាត់ការចូលប្រើប្រាស់ (Sign In)
                      </h2>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[11px] font-mono-tabular font-semibold shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    SHA-256 + Salt
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-khmer-body mt-2.5 leading-relaxed relative z-10">
                  គាំទ្រឈ្មោះគណនីបុគ្គលិក (Username/Email) ឬ អត្តលេខសិស្ស (StudentCode)
                </p>
              </div>

              <div className="p-6 space-y-5">
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {/* Identifier Field */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="auth-login-identifier"
                      className="block text-xs font-bold text-slate-800 font-khmer-body"
                    >
                      ឈ្មោះគណនី / អ៊ីមែល / អត្តលេខសិស្ស (Username, Email, or StudentCode)
                    </label>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <input
                        id="auth-login-identifier"
                        type="text"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder="ឧ. chuon.lyratanak ឬ អត្តលេខ 6463, 6648"
                        autoComplete="username"
                        className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium bg-slate-50/70 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl transition-all duration-150 focus:outline-none focus:border-indigo-600 focus:ring-3 focus:ring-indigo-500/15 font-khmer-body placeholder:text-slate-400"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 font-khmer-body leading-relaxed">
                      សាកល្បងបញ្ចូលអត្តលេខសិស្សថ្នាក់ 12C (<span className="font-mono-tabular font-semibold text-slate-700">6463, 6386, 5187, 6426</span>) ឬ 7A (<span className="font-mono-tabular font-semibold text-slate-700">6648</span>)
                    </p>
                  </div>

                  {/* Password Field with Show/Hide Toggle */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="auth-login-password"
                        className="block text-xs font-bold text-slate-800 font-khmer-body"
                      >
                        លេខសម្ងាត់ (Password)
                      </label>
                      <span className="text-[11px] font-mono-tabular text-indigo-600 font-semibold">
                        Default: {DEFAULT_DEMO_PASSWORD}
                      </span>
                    </div>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        id="auth-login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        autoComplete="current-password"
                        className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm font-mono-tabular font-medium bg-slate-50/70 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl transition-all duration-150 focus:outline-none focus:border-indigo-600 focus:ring-3 focus:ring-indigo-500/15"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((prev) => !prev)}
                        aria-label={showLoginPassword ? 'លាក់លេខសម្ងាត់ (Hide password)' : 'បង្ហាញលេខសម្ងាត់ (Show password)'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        {showLoginPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 font-khmer-body">
                      លេខសម្ងាត់គំរូសម្រាប់គណនីទាំងអស់៖ <strong className="font-mono-tabular text-slate-700">{DEFAULT_DEMO_PASSWORD}</strong>
                    </p>
                  </div>

                  {/* Primary & Secondary Action Buttons */}
                  <div className="pt-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <button
                      type="submit"
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs sm:text-sm font-bold font-khmer-body shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer"
                    >
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>ផ្ទៀងផ្ទាត់ និងចូលប្រព័ន្ធ (Sign In)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginPassword('WrongPass@123');
                        const res = login(loginIdentifier, 'WrongPass@123');
                        setAuthBanner({
                          tone: 'danger',
                          title: res.messageKh,
                          description: res.messageEn,
                        });
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-bold font-khmer-body transition-all duration-150 cursor-pointer shrink-0"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>សាកល្បងលេខសម្ងាត់ខុស</span>
                    </button>
                  </div>

                  {/* Quick Credential Switcher for the required sample accounts */}
                  <div className="pt-4 border-t border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 font-khmer-body">
                        គណនីគំរូផ្លូវការនៃវិទ្យាល័យទឹកជោរ (ចុចដើម្បីប្តូរគណនីភ្លាមៗ)៖
                      </span>
                      <span className="text-[10px] font-mono-tabular font-semibold text-slate-400">
                        7 Sample Accounts
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {[
                        {
                          id: 'principal.teokchor',
                          roleLabel: 'Super Admin',
                          text: 'Super Admin (សុខ សុវណ្ណារ៉ា)',
                          badgeTone: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                        },
                        {
                          id: 'academic.admin',
                          roleLabel: 'Admin',
                          text: 'Admin (ហេង សុផល)',
                          badgeTone: 'bg-blue-50 text-blue-700 border-blue-200',
                        },
                        {
                          id: 'chuon.lyratanak',
                          roleLabel: 'Homeroom 12C & ICT',
                          text: 'គ្រូបន្ទុកថ្នាក់ 12C (ជួន លីរតនៈ)',
                          badgeTone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        },
                        {
                          id: 'teacher.math',
                          roleLabel: 'Math Teacher',
                          text: 'គ្រូគណិតវិទ្យា (សុខ ចាន់ថន)',
                          badgeTone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        },
                        {
                          id: '6463',
                          roleLabel: 'Student 12C - 6463',
                          text: 'សិស្ស 12C៖ 6463 (គុណ គិមឡាង)',
                          badgeTone: 'bg-amber-50 text-amber-800 border-amber-200',
                        },
                        {
                          id: '6386',
                          roleLabel: 'Student 12C - 6386',
                          text: 'សិស្ស 12C៖ 6386 (គួយ ឡៅកាន)',
                          badgeTone: 'bg-amber-50 text-amber-800 border-amber-200',
                        },
                        {
                          id: '6648',
                          roleLabel: 'Student 7A - 6648',
                          text: 'សិស្ស 7A៖ 6648 (កឹង កន្និកា)',
                          badgeTone: 'bg-amber-50 text-amber-800 border-amber-200',
                        },
                      ].map((acct) => {
                        const isSelected =
                          loginIdentifier === acct.id ||
                          session.user.Username === acct.id ||
                          session.user.Username === `student.${acct.id}`;
                        return (
                          <button
                            key={acct.id}
                            type="button"
                            onClick={() => handleQuickCredentialFill(acct.id, acct.roleLabel)}
                            className={`text-left px-3 py-2 rounded-xl border text-xs font-khmer-body transition-all duration-150 flex items-center justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-bold shadow-2xs'
                                : 'bg-slate-50/70 hover:bg-white border-slate-200/80 hover:border-indigo-300 text-slate-700 font-semibold'
                            }`}
                          >
                            <span className="truncate">{acct.text}</span>
                            {isSelected && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* Right 7 cols: Active Session Inspector & Role-Based Portal Routing */}
            <Card
              className="lg:col-span-7"
              title="២. ស្ថានភាពសម័យប្រើប្រាស់ និងការបែងចែក Portal តាមតួនាទី (Role-Based Portal Routing)"
              subtitle="AuthContext.tsx & Authorization.gs ត្រួតពិនិត្យសិទ្ធិមុននឹងអនុញ្ញាតឱ្យចូលកាន់មុខងារនីមួយៗ"
              headerAction={
                <div className="flex items-center gap-2">
                  <Badge tone="success">Active Session</Badge>
                  <button
                    type="button"
                    onClick={() => {
                      const prevName = session.user.FullNameKh;
                      logout();
                      setAuthBanner({
                        tone: 'info',
                        title: `បានចាកចេញពីប្រព័ន្ធជោគជ័យ (AUTH_LOGOUT)៖ ${prevName}`,
                        description:
                          'សម័យប្រើប្រាស់ត្រូវបានបិទ និងកត់ត្រាក្នុងសន្លឹក AuditLogs រួចរាល់។',
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold font-khmer-body transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>ចាកចេញ (Logout)</span>
                  </button>
                </div>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50/90 border border-slate-200/90 space-y-2.5 text-xs font-khmer-body">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                    <span className="text-slate-500">គណនីកំពុងប្រើប្រាស់៖</span>
                    <strong className="text-slate-900 text-sm">{session.user.FullNameKh}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Username / ID៖</span>
                    <span className="font-mono-tabular font-semibold text-slate-900">
                      {session.user.Username} ({session.user.UserID})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">តួនាទី (Role)៖</span>
                    <Badge tone="indigo">{session.role.RoleName}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Portal Route៖</span>
                    <Badge tone="success">{session.portalRoute}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Session Token៖</span>
                    <span className="font-mono-tabular text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {session.sessionToken}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200/90 space-y-2.5 text-xs font-khmer-body">
                  <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>ការការពារសម្ងាត់ដោយ SHA-256 + PasswordSalt (No Plaintext Passwords)</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    រាល់លេខសម្ងាត់ទាំងអស់ក្នុង Sheet ទី 1 (<strong>Users</strong>) ត្រូវបានបម្លែងជា{' '}
                    <code className="font-mono-tabular text-indigo-700 font-semibold">
                      SHA-256(password + PasswordSalt)
                    </code>
                    ។
                  </p>
                  <div className="pt-1 space-y-1 font-mono-tabular text-[11px] bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs">
                    <div className="text-slate-600">
                      Salt: <strong className="text-slate-900">{session.user.PasswordSalt}</strong>
                    </div>
                    <div className="text-slate-600 truncate">
                      Hash: <strong className="text-indigo-700">{session.user.PasswordHash}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5 Role Portal Matrix */}
              <div className="mt-5 pt-4 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-900 font-khmer-body mb-2.5">
                  តារាងបែងចែកសិទ្ធិ និង Portal ទាំង ៥ តួនាទី (5-Role Access Matrix)៖
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs font-khmer-body">
                  {[
                    {
                      role: 'SUPER_ADMIN',
                      portal: 'ADMIN_PORTAL',
                      desc: 'គ្រប់គ្រងប្រព័ន្ធទាំងមូល គណនី ឆ្នាំសិក្សា និងការកំណត់សាលា',
                    },
                    {
                      role: 'ADMIN',
                      portal: 'ADMIN_PORTAL',
                      desc: 'គ្រប់គ្រងសិស្ស ថ្នាក់ទាំង 17 មុខវិជ្ជា និងអនុម័តលទ្ធផល',
                    },
                    {
                      role: 'TEACHER',
                      portal: 'TEACHER_PORTAL',
                      desc: 'គ្រប់គ្រងតែសំណួរផ្ទាល់ខ្លួន និងបញ្ចូលពិន្ទុថ្នាក់ដែលបានចាត់តាំង',
                    },
                    {
                      role: 'STUDENT',
                      portal: 'STUDENT_PORTAL',
                      desc: 'ចូលប្រឡងអនឡាញតាមអត្តលេខ (6463, 6648) និងមើលលទ្ធផលខ្លួនឯង',
                    },
                    {
                      role: 'VIEWER',
                      portal: 'VIEWER_PORTAL',
                      desc: 'ពិនិត្យរបាយការណ៍ផ្លូវការ និងស្ថិតិសិស្ស (Read-Only)',
                    },
                  ].map((item) => {
                    const isCurrent = session.role.RoleName === item.role;
                    return (
                      <div
                        key={item.role}
                        className={`p-3 rounded-xl border transition-all ${
                          isCurrent
                            ? 'bg-indigo-50/90 border-indigo-600 text-indigo-950 shadow-2xs ring-2 ring-indigo-500/15'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-mono-tabular font-bold text-[11px]">{item.role}</div>
                        <div className="text-[11px] text-indigo-600 font-mono-tabular mt-0.5">
                          → {item.portal}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 leading-snug">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>

          {/* User Management & Teacher Subject Assignments */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Users Table (7 cols) */}
            <Card
              className="lg:col-span-7"
              noPadding
              title="៣. គ្រប់គ្រងគណនីអ្នកប្រើប្រាស់ (UserService.gs — Sheet 1: Users)"
              subtitle="គណនីបុគ្គលិក គ្រូបង្រៀន និងសិស្ស ជាមួយ PasswordHash និង PasswordSalt"
              headerAction={
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setIsCreateUserModalOpen(true)}
                >
                  បង្កើតគណនីថ្មី (New User)
                </Button>
              }
            >
              <DataTable<Record<string, unknown>>
                columns={[
                  {
                    key: 'UserID',
                    header: 'UserID',
                    khmerSubHeader: 'លេខកូដគណនី',
                    render: (row) => (
                      <span className="font-mono-tabular font-semibold text-indigo-700">
                        {String(row.UserID)}
                      </span>
                    ),
                  },
                  {
                    key: 'FullNameKh',
                    header: 'FullNameKh',
                    khmerSubHeader: 'គោត្តនាម និងនាម',
                    render: (row) => (
                      <div>
                        <div className="font-bold text-slate-900">{String(row.FullNameKh)}</div>
                        <div className="text-[11px] text-slate-600 font-mono-tabular">
                          @{String(row.Username)}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'RoleID',
                    header: 'Role',
                    khmerSubHeader: 'តួនាទី',
                    render: (row) => {
                      const r = db.Roles.find((role) => role.RoleID === row.RoleID);
                      return <Badge tone="indigo">{r?.RoleName || String(row.RoleID)}</Badge>;
                    },
                  },
                  {
                    key: 'PasswordHash',
                    header: 'SHA-256 Hash & Salt',
                    khmerSubHeader: 'កូដសម្ងាត់',
                    render: (row) => (
                      <div className="font-mono-tabular text-[11px] text-slate-600">
                        <div>Salt: {String(row.PasswordSalt)}</div>
                        <div className="text-slate-400">
                          {String(row.PasswordHash).slice(0, 16)}...
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'Status',
                    header: 'Status / Action',
                    khmerSubHeader: 'ស្ថានភាព',
                    align: 'center',
                    render: (row) => {
                      const u = row as unknown as UserRecord;
                      const isCurrent = u.UserID === session.user.UserID;
                      return (
                        <div className="flex items-center justify-center gap-1.5">
                          <Badge tone={u.Status === 'ACTIVE' ? 'success' : 'danger'}>
                            {u.Status}
                          </Badge>
                          <Button
                            size="sm"
                            variant={isCurrent ? 'secondary' : 'outline'}
                            onClick={() => setActiveUserId(u.UserID)}
                          >
                            {isCurrent ? 'កំពុងប្រើ' : 'ប្តូរប្រើ'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleUserStatus(u.UserID)}
                          >
                            {u.Status === 'ACTIVE' ? 'ផ្អាក' : 'បើក'}
                          </Button>
                        </div>
                      );
                    },
                  },
                ]}
                data={db.Users as unknown as Record<string, unknown>[]}
                rowKey={(row) => String(row.UserID)}
              />
            </Card>

            {/* Teacher Subject Assignments (5 cols) */}
            <Card
              className="lg:col-span-5"
              title="៤. ការចាត់តាំងមុខវិជ្ជាគ្រូបង្រៀន (TeacherAssignmentService.gs)"
              subtitle="កំណត់សិទ្ធិគ្រូបង្រៀនតាមមុខវិជ្ជា និងថ្នាក់រៀន (Sheet 9: TeacherSubjectAssignments)"
            >
              <form onSubmit={handleAssignSubjectSubmit} className="space-y-3 mb-4 pb-4 border-b border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <Select
                    label="គ្រូបង្រៀន (Teacher)"
                    value={assignTeacherId}
                    onChange={(e) => setAssignTeacherId(e.target.value)}
                    options={teacherUsers.map((t) => ({
                      value: t.UserID,
                      label: `${t.FullNameKh}`,
                    }))}
                  />
                  <Select
                    label="មុខវិជ្ជា (Subject)"
                    value={assignSubjectId}
                    onChange={(e) => setAssignSubjectId(e.target.value)}
                    options={db.Subjects.map((s) => ({
                      value: s.SubjectID,
                      label: `${s.SubjectNameKh} (${s.SubjectCode})`,
                    }))}
                  />
                  <Select
                    label="ថ្នាក់រៀន (Class)"
                    value={assignClassId}
                    onChange={(e) => setAssignClassId(e.target.value)}
                    options={db.Classes.map((c) => ({
                      value: c.ClassID,
                      label: `ថ្នាក់ទី ${c.ClassName}`,
                    }))}
                  />
                </div>
                <Button type="submit" size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                  បន្ថែមការចាត់តាំងមុខវិជ្ជា (Assign Teacher Subject)
                </Button>
              </form>

              <DataTable<Record<string, unknown>>
                maxHeightClass="max-h-[300px]"
                columns={[
                  {
                    key: 'AssignmentID',
                    header: 'ID',
                    render: (row) => (
                      <span className="font-mono-tabular font-semibold text-slate-700">
                        {String(row.AssignmentID)}
                      </span>
                    ),
                  },
                  {
                    key: 'TeacherID',
                    header: 'គ្រូបង្រៀន (Teacher)',
                    render: (row) => {
                      const a = row as unknown as TeacherSubjectAssignmentRecord;
                      const t = db.Users.find((u) => u.UserID === a.TeacherID);
                      return <span className="font-bold">{t?.FullNameKh || a.TeacherID}</span>;
                    },
                  },
                  {
                    key: 'SubjectID',
                    header: 'មុខវិជ្ជា (Subject)',
                    render: (row) => {
                      const a = row as unknown as TeacherSubjectAssignmentRecord;
                      const s = db.Subjects.find((sub) => sub.SubjectID === a.SubjectID);
                      return <Badge tone="indigo">{s?.SubjectNameKh || a.SubjectID}</Badge>;
                    },
                  },
                  {
                    key: 'ClassID',
                    header: 'ថ្នាក់',
                    align: 'center',
                    render: (row) => {
                      const a = row as unknown as TeacherSubjectAssignmentRecord;
                      const c = db.Classes.find((cls) => cls.ClassID === a.ClassID);
                      return <span className="font-mono-tabular font-bold">{c?.ClassName || a.ClassID}</span>;
                    },
                  },
                ]}
                data={db.TeacherSubjectAssignments as unknown as Record<string, unknown>[]}
                rowKey={(row) => String(row.AssignmentID)}
              />
            </Card>
          </div>
        </div>
      ) : (
        /* Unified Global Design System Gallery (All 14 Exported Components) */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Typography & Color Palette */}
            <Card
              title="១. អក្សរសាស្ត្រខ្មែរ និងពណ៌ស្តង់ដារ (Typography & Brand Palette)"
              subtitle="Locked Global Design System for Phases 1–14"
            >
              <div className="space-y-3 text-xs font-khmer-body">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">Official Report Header Font (Khmer OS Muol Light / Moul)</div>
                  <div className="text-base font-khmer-moul text-slate-900 mt-1">
                    វិទ្យាល័យទឹកជោរ · ព្រះរាជាណាចក្រកម្ពុជា
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">Primary Khmer / UI Font (Kantumruy Pro / Battambang)</div>
                  <div className="text-sm font-khmer-body text-slate-900 mt-1">
                    ប្រព័ន្ធប្រឡងអនឡាញ និងគ្រប់គ្រងលទ្ធផលសិស្សប្រចាំខែ ឆមាស និងប្រចាំឆ្នាំ
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-indigo-600 text-white text-center font-mono-tabular text-[11px]">
                    indigo-600
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-center font-mono-tabular text-[11px]">
                    amber-500
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-600 text-white text-center font-mono-tabular text-[11px]">
                    emerald-600
                  </div>
                  <div className="p-2 rounded-lg bg-rose-600 text-white text-center font-mono-tabular text-[11px]">
                    rose-600
                  </div>
                </div>
              </div>
            </Card>

            {/* 2. Buttons & Semantic Status Badges */}
            <Card
              title="២. ប៊ូតុង និងស្លាកស្ថានភាព (Button & Semantic Badge)"
              subtitle="Standardized variants for Grades, Student Status, and Actions"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="sm">Primary (Indigo)</Button>
                  <Button variant="secondary" size="sm">Secondary</Button>
                  <Button variant="gold" size="sm">Official Gold</Button>
                  <Button variant="outline" size="sm">Outline</Button>
                  <Button variant="danger" size="sm">Danger</Button>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="text-xs font-semibold text-slate-700 font-khmer-body">
                    Semantic Status Badges (MoEYS Grades & Roster Codes)៖
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="success">កំពុងរៀន (Studying)</Badge>
                    <Badge tone="success">និទ្ទេស A / B / C</Badge>
                    <Badge tone="warning">និទ្ទេស D / E</Badge>
                    <Badge tone="warning">ប័ណ្ណក្រីក្រ ក១ / ក២ / 5</Badge>
                    <Badge tone="danger">និទ្ទេស F / ផ្ទេរចេញ</Badge>
                    <Badge tone="neutral">មិនចាត់ថ្នាក់ (Unranked)</Badge>
                  </div>
                </div>
              </div>
            </Card>

            {/* 3. Inputs, Select, DatePicker & Interactive Dialogs */}
            <Card
              title="៣. ទម្រង់បញ្ចូលទិន្នន័យ និងផ្ទាំងជូនដំណឹង (Inputs, DatePicker & Modals)"
              subtitle="Standardized form controls & feedback overlays"
            >
              <div className="space-y-3">
                <DatePicker
                  label="កាលបរិច្ឆេទប្រឡង (DatePicker)"
                  value={demoDate}
                  onChange={(e) => setDemoDate(e.target.value)}
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setIsDemoModalOpen(true)}>
                    បើក Modal គំរូ
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setIsDemoConfirmOpen(true)}>
                    បើក ConfirmationDialog
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowDemoLoading((v) => !v)}
                  >
                    {showDemoLoading ? 'បិទ LoadingState' : 'បង្ហាញ LoadingState'}
                  </Button>
                </div>
                {demoToastMessage && (
                  <Toast
                    tone="success"
                    title={demoToastMessage}
                    onDismiss={() => setDemoToastMessage(null)}
                  />
                )}
              </div>
            </Card>
          </div>

          {/* Pagination, LoadingState, EmptyState Preview */}
          <Card
            title="៤. តារាងទិន្នន័យ ការបែងចែកទំព័រ និងស្ថានភាពទទេ (DataTable, Pagination, LoadingState & EmptyState)"
            subtitle="All 14 components exported from src/components/ui/index.tsx"
          >
            {showDemoLoading ? (
              <LoadingState />
            ) : (
              <div className="space-y-4">
                <Pagination
                  currentPage={demoPage}
                  totalPages={4}
                  totalItems={38}
                  pageSize={10}
                  onPageChange={setDemoPage}
                />
                <EmptyState
                  title="គំរូផ្ទាំងទិន្នន័យទទេ (Standardized EmptyState Component)"
                  description="ប្រើប្រាស់នៅពេលមិនទាន់មានទិន្នន័យប្រឡង ឬមិនទាន់មានសំណួរនៅក្នុងមុខវិជ្ជា។"
                  action={
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        setDemoToastMessage('បានចុចប៊ូតុងសាកល្បងនៅលើ EmptyState ដោយជោគជ័យ!')
                      }
                    >
                      សាកល្បង Toast Notification
                    </Button>
                  }
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        title="បង្កើតគណនីអ្នកប្រើប្រាស់ថ្មី (UserService.createUser)"
        subtitle="លេខសម្ងាត់នឹងត្រូវបម្លែងជា SHA-256(password + PasswordSalt) មុនរក្សាទុកក្នុង Sheet 1 (Users)"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCreateUserModalOpen(false)}>
              បោះបង់ (Cancel)
            </Button>
            <Button variant="primary" onClick={handleCreateUserSubmit}>
              រក្សាទុកគណនី (Create User)
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateUserSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            label="ឈ្មោះគណនី (Username) *"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="ឧ. teacher.physics"
            required
          />
          <Input
            label="អ៊ីមែល (Email)"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="teacher.physics@teokchor.edu.kh"
          />
          <Input
            label="គោត្តនាម និងនាម (ខ្មែរ) *"
            value={newFullNameKh}
            onChange={(e) => setNewFullNameKh(e.target.value)}
            placeholder="ឧ. ស៊ុន សុខា"
            required
          />
          <Input
            label="ឈ្មោះជាអក្សរឡាតាំង (English Name)"
            value={newFullNameEn}
            onChange={(e) => setNewFullNameEn(e.target.value)}
            placeholder="SUN SOKHA"
          />
          <Select
            label="ភេទ (Gender)"
            value={newGender}
            onChange={(e) => setNewGender(e.target.value as GenderKh)}
            options={[
              { value: 'ប្រុស', label: 'ប្រុស (Male)' },
              { value: 'ស្រី', label: 'ស្រី (Female)' },
            ]}
          />
          <Select
            label="តួនាទី (Role)"
            value={newRoleId}
            onChange={(e) => setNewRoleId(e.target.value)}
            options={db.Roles.map((r) => ({
              value: r.RoleID,
              label: `${r.RoleName} — ${r.Description}`,
            }))}
          />
          <Input
            label="លេខទូរស័ព្ទ (Phone)"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <Input
            label="លេខសម្ងាត់ (Raw Password to Hash)"
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText={`SHA-256 preview: ${hashPasswordSha256(newPassword, 'SALT-TC-2026').slice(0, 18)}...`}
          />
        </form>
      </Modal>

      {/* Demo Modal for UI Showcase */}
      <Modal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title="គំរូផ្ទាំង Modal ស្តង់ដារ (Global Design System Modal)"
        subtitle="ប្រើប្រាស់សម្រាប់គ្រប់ដំណាក់កាល (Phases 1 to 14)"
        footer={
          <Button variant="primary" onClick={() => setIsDemoModalOpen(false)}>
            យល់ព្រម (Close)
          </Button>
        }
      >
        <p className="text-xs text-slate-600 font-khmer-body leading-relaxed">
          ផ្ទាំង Modal នេះប្រើប្រាស់ពុម្ពអក្សរ Kantumruy Pro និងពណ៌ស្តង់ដារ indigo-600 របស់វិទ្យាល័យទឹកជោរ។
        </p>
      </Modal>

      {/* Demo ConfirmationDialog for UI Showcase */}
      <ConfirmationDialog
        isOpen={isDemoConfirmOpen}
        onCancel={() => setIsDemoConfirmOpen(false)}
        onConfirm={() => {
          setIsDemoConfirmOpen(false);
          setDemoToastMessage('បានបញ្ជាក់ប្រតិបត្តិការតាមរយៈ ConfirmationDialog ដោយជោគជ័យ!');
        }}
        title="បញ្ជាក់ការលុបទិន្នន័យ (ConfirmationDialog)"
        message="តើអ្នកពិតជាចង់អនុវត្តសកម្មភាពនេះមែនទេ? រាល់សកម្មភាពទាំងអស់នឹងត្រូវកត់ត្រាទុកក្នុង AuditLogs។"
      />
    </div>
  );
};
