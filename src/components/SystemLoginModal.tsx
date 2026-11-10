import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_DEMO_PASSWORD, HONOR_PORTRAIT_URLS } from '../lib/seedData';
import { StudentRecord } from '../types/database';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  HelpCircle,
  IdCard,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';

interface SystemLoginModalProps {
  isOpen: boolean;
  isLoggedOutLock: boolean;
  onClose: () => void;
  onLoginSuccess: (roleName: string) => void;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30000;

export const SystemLoginModal: React.FC<SystemLoginModalProps> = ({
  isOpen,
  isLoggedOutLock,
  onClose,
  onLoginSuccess,
}) => {
  const { db, session, login, loginStudentById } = useAuth();

  // User Type Switcher: 'TEACHER' (គ្រូបង្រៀន) | 'STUDENT' (សិស្ស)
  const [loginMode, setLoginMode] = useState<'TEACHER' | 'STUDENT'>('TEACHER');

  // Teacher Login Form State
  const [teacherUsername, setTeacherUsername] = useState<string>('chuon.lyratanak');
  const [teacherPassword, setTeacherPassword] = useState<string>(DEFAULT_DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showForgotHelp, setShowForgotHelp] = useState<boolean>(false);

  // Student Login Form State (Student ID-only)
  const [studentIdInput, setStudentIdInput] = useState<string>('6463');
  const [verifiedStudentProfile, setVerifiedStudentProfile] = useState<StudentRecord | null>(null);

  // Interaction, Loading & Rate-Limiting Safeguards
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    title: string;
    detail: string;
  } | null>(null);

  // Dynamically read school branding from db.SystemSettings (never hardcode if stored in DB)
  const schoolBranding = useMemo(() => {
    const getSetting = (key: string, fallback: string) =>
      db.SystemSettings.find((s) => s.SettingKey === key)?.SettingValue || fallback;

    return {
      schoolNameKh: getSetting('SCHOOL_NAME_KH', 'វិទ្យាល័យទឹកជោរ'),
      provincialDeptKh: getSetting(
        'PROVINCIAL_DEPT_KH',
        'មន្ទីរអប់រំ យុវជន និងកីឡា ខេត្តបន្ទាយមានជ័យ'
      ),
      districtOfficeKh: getSetting(
        'DISTRICT_OFFICE_KH',
        'ការិយាល័យអប់រំ យុវជន និងកីឡា ស្រុកព្រះនេត្រព្រះ'
      ),
      kingdomMottoKh: getSetting(
        'KINGDOM_MOTTO_KH',
        'ព្រះរាជាណាចក្រកម្ពុជា ជាតិ សាសនា ព្រះមហាក្សត្រ'
      ),
      systemNameKh: 'ប្រព័ន្ធគ្រប់គ្រងការសិក្សា និងប្រឡងអនឡាញ',
      systemNameEn: 'School Management System',
      systemVersion: 'v2.5 • Growly LMS Architecture',
    };
  }, [db.SystemSettings]);

  const teacherQuickAccounts = useMemo(
    () => [
      {
        username: 'chuon.lyratanak',
        nameKh: 'ជួន លីរតនៈ',
        roleLabel: 'គ្រូបន្ទុកថ្នាក់ 12C & ICT',
      },
      {
        username: 'teacher.math',
        nameKh: 'សុខ ចាន់ថន',
        roleLabel: 'គ្រូគណិតវិទ្យា',
      },
      {
        username: 'academic.admin',
        nameKh: 'ហេង សុផល',
        roleLabel: 'ការិយាល័យសិក្សា (ADMIN)',
      },
      {
        username: 'principal.teokchor',
        nameKh: 'សុខ សុវណ្ណារ៉ា',
        roleLabel: 'នាយកសាលា (SUPER_ADMIN)',
      },
    ],
    []
  );

  const studentQuickAccounts = useMemo(
    () => [
      { studentCode: '6463', nameKh: 'ក. គុណ គិមឡាង', classLabel: 'ថ្នាក់ទី 12C' },
      { studentCode: '5187', nameKh: 'ក. រឺ យូរៀន', classLabel: 'ថ្នាក់ទី 12C (លេខ ១)' },
      { studentCode: '6386', nameKh: 'គួយ ឡៅកាន', classLabel: 'ថ្នាក់ទី 12C' },
      { studentCode: '6648', nameKh: 'ក. កឹង កន្និកា', classLabel: 'ថ្នាក់ទី 7A' },
    ],
    []
  );

  if (!isOpen) return null;

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  const recordFailedAttempt = () => {
    const nextCount = failedAttempts + 1;
    setFailedAttempts(nextCount);
    if (nextCount >= MAX_FAILED_ATTEMPTS) {
      setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
    }
  };

  const handleSwitchMode = (nextMode: 'TEACHER' | 'STUDENT') => {
    if (isSubmitting) return;
    setLoginMode(nextMode);
    setFeedback(null);
    setVerifiedStudentProfile(null);
  };

  // Teacher Login Submission Handler
  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (isLockedOut) {
      setFeedback({
        ok: false,
        title: 'គណនីត្រូវបានផ្អាកបណ្ដោះអាសន្ន (Rate Limit Safeguard)',
        detail:
          'អ្នកបានព្យាយាមចូលប្រព័ន្ធខុសច្រើនដងពេក។ សូមរង់ចាំ ៣០ វិនាទីមុនពេលព្យាយាមម្ដងទៀត។',
      });
      return;
    }

    const cleanUsername = teacherUsername.trim();
    const cleanPassword = teacherPassword;

    if (!cleanUsername && !cleanPassword) {
      setFeedback({
        ok: false,
        title: 'សូមបំពេញព័ត៌មានចូលប្រព័ន្ធ',
        detail: 'សូមបញ្ចូលឈ្មោះអ្នកប្រើប្រាស់ (Username) និងពាក្យសម្ងាត់ (Password)។',
      });
      return;
    }

    if (!cleanUsername) {
      setFeedback({
        ok: false,
        title: 'ខ្វះឈ្មោះអ្នកប្រើប្រាស់ (Username Required)',
        detail: 'សូមបញ្ចូលឈ្មោះអ្នកប្រើប្រាស់របស់គ្រូបង្រៀន ឬបុគ្គលិក។',
      });
      return;
    }

    if (!cleanPassword) {
      setFeedback({
        ok: false,
        title: 'ខ្វះពាក្យសម្ងាត់ (Password Required)',
        detail: 'សូមបញ្ចូលពាក្យសម្ងាត់ (Password) ដើម្បីផ្ទៀងផ្ទាត់អត្តសញ្ញាណ។',
      });
      return;
    }

    // Prevent student codes from logging in via Teacher Login tab
    const isStudentRecordMatch = db.Students.some(
      (s) =>
        s.StudentCode.toLowerCase() === cleanUsername.toLowerCase() ||
        `student.${s.StudentCode.toLowerCase()}` === cleanUsername.toLowerCase()
    );
    if (isStudentRecordMatch) {
      setFeedback({
        ok: false,
        title: 'មិនអាចចូលប្រើតាមទម្រង់គ្រូបង្រៀនបានទេ',
        detail:
          'អត្តលេខសិស្សមិនអាចប្រើក្នុងទម្រង់គ្រូបង្រៀនបានទេ។ សូមប្តូរទៅផ្ទាំង «សិស្ស (Student Login)»។',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = login(cleanUsername, cleanPassword);
      if (res.ok && res.role) {
        setFailedAttempts(0);
        setLockoutUntil(null);
        setFeedback({
          ok: true,
          title: res.messageKh,
          detail: `${res.messageEn} • Session: ${res.sessionToken}`,
        });
        window.setTimeout(() => {
          setIsSubmitting(false);
          onLoginSuccess(res.role!.RoleName);
        }, 220);
      } else {
        setIsSubmitting(false);
        recordFailedAttempt();
        setFeedback({
          ok: false,
          title: res.messageKh,
          detail: res.messageEn,
        });
      }
    } catch {
      setIsSubmitting(false);
      setFeedback({
        ok: false,
        title: 'មានបញ្ហាក្នុងការតភ្ជាប់ប្រព័ន្ធ',
        detail: 'មិនអាចផ្ទៀងផ្ទាត់ទិន្នន័យបានទេ សូមព្យាយាមម្ដងទៀត។',
      });
    }
  };

  // Student ID-Only Login Submission Handler
  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (isLockedOut) {
      setFeedback({
        ok: false,
        title: 'ផ្អាកការព្យាយាមបណ្ដោះអាសន្ន (Rate Limit Active)',
        detail:
          'អ្នកបានបញ្ចូលអត្តលេខសិស្សខុសច្រើនដងពេក។ សូមរង់ចាំ ៣០ វិនាទីមុនពេលព្យាយាមម្ដងទៀត។',
      });
      return;
    }

    const cleanStudentId = studentIdInput.trim();
    if (!cleanStudentId) {
      setFeedback({
        ok: false,
        title: 'ខ្វះអត្តលេខសិស្ស (Student ID Required)',
        detail: 'សូមបញ្ចូលអត្តលេខសិស្ស (ឧ. 6463, 5187, 6386, 6648) មុនពេលចុចចូលប្រព័ន្ធ។',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = loginStudentById(cleanStudentId);
      if (res.ok && res.role && res.studentProfile) {
        setFailedAttempts(0);
        setLockoutUntil(null);
        setVerifiedStudentProfile(res.studentProfile);
        setFeedback({
          ok: true,
          title: res.messageKh,
          detail: `${res.messageEn} • Session: ${res.sessionToken}`,
        });
        window.setTimeout(() => {
          setIsSubmitting(false);
          onLoginSuccess(res.role!.RoleName);
        }, 250);
      } else {
        setIsSubmitting(false);
        setVerifiedStudentProfile(null);
        recordFailedAttempt();
        setFeedback({
          ok: false,
          title: res.messageKh,
          detail: res.messageEn,
        });
      }
    } catch {
      setIsSubmitting(false);
      setFeedback({
        ok: false,
        title: 'មានបញ្ហាក្នុងការផ្ទៀងផ្ទាត់អត្តលេខសិស្ស',
        detail: 'សូមពិនិត្យការតភ្ជាប់ ហើយព្យាយាមម្ដងទៀត។',
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`ទម្រង់ចូលប្រព័ន្ធ ${schoolBranding.schoolNameKh} (System Login)`}
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto relative transition-all">
        {/* Top Accent Strip */}
        <div className="h-2 bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#4F46E5] w-full" />

        {/* Optional Close Button when not locked out */}
        {!isLoggedOutLock && (
          <button
            type="button"
            onClick={onClose}
            aria-label="បិទផ្ទាំង Login"
            className="absolute top-5 right-5 p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="p-6 sm:p-8 space-y-6">
          {/* =============================================================== */}
          {/* 1. SCHOOL BRANDING HEADER (Dynamic from db.SystemSettings)      */}
          {/* =============================================================== */}
          <div className="text-center space-y-2.5">
            {/* School Logo */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-white/10 backdrop-blur-xs flex flex-col items-center justify-center text-white border border-white/20">
                <GraduationCap className="w-8 h-8 text-amber-300" />
              </div>
            </div>

            {/* Department & National Context */}
            <div className="text-[11px] font-semibold text-slate-500 font-khmer-body">
              {schoolBranding.provincialDeptKh} · {schoolBranding.districtOfficeKh}
            </div>

            {/* School Name (ឈ្មោះសាលា) */}
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-khmer-moul tracking-wide">
              {schoolBranding.schoolNameKh}
            </h2>

            {/* System Name (ឈ្មោះប្រព័ន្ធគ្រប់គ្រង) */}
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-bold text-blue-700 font-khmer-body">
                {schoolBranding.systemNameKh}
              </p>
              <p className="text-[11px] font-medium text-slate-400 font-mono-tabular">
                {schoolBranding.systemNameEn}
              </p>
            </div>
          </div>

          {/* =============================================================== */}
          {/* 2. USER TYPE SWITCHER: Teacher Login vs Student Login           */}
          {/* =============================================================== */}
          <div
            role="tablist"
            aria-label="ជ្រើសរើសប្រភេទអ្នកប្រើប្រាស់ (User Type Switcher)"
            className="grid grid-cols-2 gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200/80"
          >
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === 'TEACHER'}
              onClick={() => handleSwitchMode('TEACHER')}
              className={`py-2.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold font-khmer-body transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                loginMode === 'TEACHER'
                  ? 'bg-[#1E3A8A] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>
                គ្រូបង្រៀន (Teacher<span className="hidden sm:inline"> Login</span>)
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={loginMode === 'STUDENT'}
              onClick={() => handleSwitchMode('STUDENT')}
              className={`py-2.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold font-khmer-body transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                loginMode === 'STUDENT'
                  ? 'bg-[#1E3A8A] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>
                សិស្ស (Student<span className="hidden sm:inline"> Login</span>)
              </span>
            </button>
          </div>

          {/* =============================================================== */}
          {/* FEEDBACK BANNER (Validation, Error, or Success)                 */}
          {/* =============================================================== */}
          {feedback && (
            <div
              role="alert"
              className={`p-3.5 rounded-2xl border text-xs font-khmer-body flex items-start gap-3 transition-all ${
                feedback.ok
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/90 border-rose-200 text-rose-900'
              }`}
            >
              {feedback.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-bold">{feedback.title}</div>
                <div className="text-[11px] opacity-90 mt-0.5 break-words">{feedback.detail}</div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* 3. TEACHER LOGIN FORM (Username + Password + Show/Hide)         */}
          {/* =============================================================== */}
          {loginMode === 'TEACHER' && (
            <form onSubmit={handleTeacherSubmit} noValidate className="space-y-4">
              {/* Username Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="teacher-login-username"
                  className="block text-xs font-bold text-slate-800 font-khmer-body"
                >
                  ឈ្មោះអ្នកប្រើប្រាស់ (Username) <span className="text-rose-500">*</span>
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-700 transition-colors pointer-events-none">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <input
                    id="teacher-login-username"
                    type="text"
                    value={teacherUsername}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      setTeacherUsername(e.target.value);
                      if (feedback) setFeedback(null);
                    }}
                    placeholder="បញ្ចូលឈ្មោះអ្នកប្រើប្រាស់ (ឧ. chuon.lyratanak)"
                    autoComplete="username"
                    className="w-full pl-10 pr-9 py-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white text-sm font-medium text-slate-900 transition-all focus:outline-none focus:border-blue-700 focus:ring-3 focus:ring-blue-600/15 font-khmer-body"
                  />
                  {teacherUsername && !isSubmitting && (
                    <button
                      type="button"
                      onClick={() => setTeacherUsername('')}
                      aria-label="សម្អាតឈ្មោះអ្នកប្រើប្រាស់"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Password Field with Show/Hide Icon */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="teacher-login-password"
                    className="block text-xs font-bold text-slate-800 font-khmer-body"
                  >
                    ពាក្យសម្ងាត់ (Password) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-mono-tabular text-slate-500">
                    SHA-256 + Salt
                  </span>
                </div>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-700 transition-colors pointer-events-none">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="teacher-login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={teacherPassword}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      setTeacherPassword(e.target.value);
                      if (feedback) setFeedback(null);
                    }}
                    placeholder="បញ្ចូលពាក្យសម្ងាត់..."
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white text-sm font-mono-tabular font-semibold text-slate-900 transition-all focus:outline-none focus:border-blue-700 focus:ring-3 focus:ring-blue-600/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'លាក់ពាក្យសម្ងាត់' : 'បង្ហាញពាក្យសម្ងាត់'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 font-khmer-body cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  <span>ចងចាំគណនី (Remember me)</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowForgotHelp((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline font-khmer-body cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>ភ្លេចពាក្យសម្ងាត់?</span>
                </button>
              </div>

              {showForgotHelp && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-khmer-body">
                  សូមទាក់ទងគណៈគ្រប់គ្រងសាលា (SUPER_ADMIN / ADMIN) ដើម្បីកំណត់ពាក្យសម្ងាត់ឡើងវិញតាមរយៈប្រព័ន្ធគ្រប់គ្រងគណនី។
                </div>
              )}

              {/* Submit Button: ចូលប្រព័ន្ធ (Login) */}
              <button
                type="submit"
                disabled={isSubmitting || isLockedOut}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 active:bg-slate-900 disabled:opacity-60 text-white text-sm font-bold font-khmer-body shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>កំពុងផ្ទៀងផ្ទាត់...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>ចូលប្រព័ន្ធ (Login)</span>
                  </>
                )}
              </button>

              {/* Quick Teacher Account Selector for Authorized Testing */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-khmer-body">
                  <span>គណនីគ្រូបង្រៀន និងបុគ្គលិកក្នុងប្រព័ន្ធ៖</span>
                  <span className="font-mono-tabular">Password: {DEFAULT_DEMO_PASSWORD}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {teacherQuickAccounts.map((acc) => {
                    const isSelected = teacherUsername === acc.username;
                    return (
                      <button
                        key={acc.username}
                        type="button"
                        onClick={() => {
                          setTeacherUsername(acc.username);
                          setTeacherPassword(DEFAULT_DEMO_PASSWORD);
                          setFeedback(null);
                        }}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-300 text-blue-950'
                            : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold font-khmer-body truncate">
                          {acc.nameKh}
                        </div>
                        <div className="text-[10px] text-slate-500 font-khmer-body truncate">
                          {acc.roleLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </form>
          )}

          {/* =============================================================== */}
          {/* 4. STUDENT LOGIN FORM (Student ID ONLY - No Username/Password)  */}
          {/* =============================================================== */}
          {loginMode === 'STUDENT' && (
            <form onSubmit={handleStudentSubmit} noValidate className="space-y-4">
              {/* Student ID Input Field ONLY */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="student-login-id"
                    className="block text-xs font-bold text-slate-800 font-khmer-body"
                  >
                    អត្តលេខសិស្ស (Student ID) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-khmer-body">
                    ផ្ទៀងផ្ទាត់ជាមួយបញ្ជីសិស្សផ្លូវការ
                  </span>
                </div>

                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-700 transition-colors pointer-events-none">
                    <IdCard className="w-4 h-4" />
                  </div>
                  <input
                    id="student-login-id"
                    type="text"
                    value={studentIdInput}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      setStudentIdInput(e.target.value);
                      if (feedback) setFeedback(null);
                    }}
                    placeholder="បញ្ចូលអត្តលេខសិស្ស (ឧ. 6463, 5187, 6386, 6648)"
                    autoComplete="off"
                    className="w-full pl-10 pr-9 py-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white text-sm font-mono-tabular font-bold text-slate-900 transition-all focus:outline-none focus:border-blue-700 focus:ring-3 focus:ring-blue-600/15"
                  />
                  {studentIdInput && !isSubmitting && (
                    <button
                      type="button"
                      onClick={() => {
                        setStudentIdInput('');
                        setVerifiedStudentProfile(null);
                      }}
                      aria-label="សម្អាតអត្តលេខសិស្ស"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 font-khmer-body">
                  សូមវាយបញ្ចូលតែអត្តលេខសិស្សរបស់អ្នក (មិនចាំបាច់បញ្ចូលឈ្មោះគណនី ឬពាក្យសម្ងាត់ទេ)។
                </p>
              </div>

              {/* Verified Student Profile Preview (if matched) */}
              {verifiedStudentProfile && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between gap-3 text-xs font-khmer-body">
                  <div>
                    <div className="font-bold text-emerald-950">
                      {verifiedStudentProfile.FullNameKh} (#{verifiedStudentProfile.StudentCode})
                    </div>
                    <div className="text-[11px] text-emerald-700">
                      ភេទ៖ {verifiedStudentProfile.Gender} · ស្ថានភាព៖{' '}
                      {verifiedStudentProfile.StudentStatus}
                    </div>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                </div>
              )}

              {/* Submit Button: ចូលប្រព័ន្ធ (Login) */}
              <button
                type="submit"
                disabled={isSubmitting || isLockedOut}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 active:bg-slate-900 disabled:opacity-60 text-white text-sm font-bold font-khmer-body shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>កំពុងផ្ទៀងផ្ទាត់អត្តលេខសិស្ស...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>ចូលប្រព័ន្ធ (Login)</span>
                  </>
                )}
              </button>

              {/* Active Student IDs in Database for Verification */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-khmer-body">
                  <span>អត្តលេខសិស្សកំពុងរៀនក្នុងប្រព័ន្ធ (ចុចដើម្បីជ្រើសរើស)៖</span>
                  <span className="font-mono-tabular">Active Roster</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {studentQuickAccounts.map((st) => {
                    const isSelected = studentIdInput === st.studentCode;
                    return (
                      <button
                        key={st.studentCode}
                        type="button"
                        onClick={() => {
                          setStudentIdInput(st.studentCode);
                          setFeedback(null);
                        }}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-300 text-blue-950'
                            : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold font-khmer-body truncate">
                            {st.nameKh}
                          </span>
                          <span className="text-[11px] font-mono-tabular font-bold text-blue-700">
                            #{st.studentCode}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-khmer-body truncate">
                          {st.classLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </form>
          )}

          {/* =============================================================== */}
          {/* 5. FOOTER: SCHOOL COPYRIGHT & SYSTEM VERSION                    */}
          {/* =============================================================== */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-[11px] text-slate-500 font-khmer-body">
            <div className="whitespace-nowrap">
              © ២០២៦ {schoolBranding.schoolNameKh} • រក្សាសិទ្ធិគ្រប់យ៉ាង
            </div>
            <div className="flex items-center gap-2.5 whitespace-nowrap">
              <span className="font-mono-tabular text-slate-400">
                v2.5 • Growly LMS
              </span>
              {!isLoggedOutLock && (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs font-bold text-slate-600 hover:text-blue-700 font-khmer-body cursor-pointer"
                >
                  បិទផ្ទាំងនេះ
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SystemLogoutModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirmLogout: () => void;
  onOpenSwitchAccount: () => void;
}

export const SystemLogoutModal: React.FC<SystemLogoutModalProps> = ({
  isOpen,
  onCancel,
  onConfirmLogout,
  onOpenSwitchAccount,
}) => {
  const { session } = useAuth();

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ផ្ទាំងបញ្ជាក់ការចាកចេញពីប្រព័ន្ធ (System Logout)"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Banner */}
        <div className="bg-[#14171F] text-white p-6 relative overflow-hidden">
          <div className="w-32 h-32 rounded-full bg-rose-500/20 blur-2xl absolute -top-10 -right-10 pointer-events-none" />
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-400/30 text-rose-300 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-mono-tabular text-rose-300 font-semibold">
                  Authentication.gs • Session Termination
                </div>
                <h3 className="text-base font-bold font-khmer-moul text-white mt-0.5">
                  ចាកចេញពីប្រព័ន្ធ (System Logout)
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="បិទផ្ទាំង"
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active User Session Summary */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center gap-3.5">
            <img
              src={HONOR_PORTRAIT_URLS['DRV-PHOTO-RANK2']}
              alt={session.user.FullNameKh}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-slate-900 font-khmer-body truncate">
                {session.user.FullNameKh}
              </div>
              <div className="text-xs text-slate-500 font-mono-tabular truncate">
                @{session.user.Username} • {session.role.RoleName}
              </div>
              <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-mono-tabular font-semibold text-emerald-700">
                <Lock className="w-3 h-3" />
                <span>Token: {session.sessionToken}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 font-khmer-body leading-relaxed">
            តើអ្នកពិតជាចង់ចាកចេញពីសម័យប្រើប្រាស់បច្ចុប្បន្នមែនទេ? រាល់សកម្មភាពចាកចេញនឹងត្រូវកត់ត្រាទុកក្នុងសន្លឹក{' '}
            <strong className="text-slate-900">AuditLogs (AUTH_LOGOUT)</strong> ហើយប្រព័ន្ធនឹងត្រឡប់ទៅកាន់ទម្រង់{' '}
            <strong className="text-slate-900">ចូលប្រព័ន្ធ (Login)</strong> វិញ។
          </p>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={onConfirmLogout}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs sm:text-sm font-bold font-khmer-body shadow-sm transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>បញ្ជាក់ការចាកចេញពីប្រព័ន្ធ (Confirm Logout)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onOpenSwitchAccount}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>ប្តូរគណនី (Login)</span>
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold font-khmer-body transition-colors cursor-pointer"
              >
                <span>បោះបង់ (Cancel)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
