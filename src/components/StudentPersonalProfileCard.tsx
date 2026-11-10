import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DatabaseState } from '../types/database';
import { HONOR_PORTRAIT_URLS } from '../lib/seedData';
import { isStudentRole, toKhmerNumerals } from '../lib/domainRules';
import {
  buildStudentPersonalProfileSummary,
  resolveStudentProfilePhotoUrl,
  STUDENT_PRESET_AVATARS,
  updateStudentSelfProfile,
} from '../lib/studentProfileRules';
import {
  Award,
  BookOpen,
  Calendar,
  Camera,
  CheckCircle2,
  Edit3,
  FileCheck2,
  GraduationCap,
  HeartHandshake,
  Home,
  ImagePlus,
  Link2,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  UserCheck,
  Users,
} from 'lucide-react';

interface StudentPersonalProfileCardProps {
  db: DatabaseState;
  setDb?: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  onNavigateExams?: () => void;
  onNavigateResults?: () => void;
}

export const StudentPersonalProfileCard: React.FC<
  StudentPersonalProfileCardProps
> = ({
  db,
  setDb,
  activeUserId,
  onNavigateExams,
  onNavigateResults,
}) => {
  const activeUser =
    db.Users.find((u) => u.UserID === activeUserId) || db.Users[0];
  const activeRole = db.Roles.find((r) => r.RoleID === activeUser?.RoleID);
  const isLoggedInAsStudent = isStudentRole(activeRole?.RoleName);

  const [selectedStudentIdOverride, setSelectedStudentIdOverride] =
    useState<string>('');

  const profile = useMemo(
    () =>
      buildStudentPersonalProfileSummary(
        db,
        activeUserId,
        HONOR_PORTRAIT_URLS,
        isLoggedInAsStudent ? undefined : selectedStudentIdOverride || undefined
      ),
    [db, activeUserId, isLoggedInAsStudent, selectedStudentIdOverride]
  );

  // Photo Upload & Customization State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draftPhotoValue, setDraftPhotoValue] = useState<string>(
    profile.profileImageId
  );
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isPhotoEditorOpen, setIsPhotoEditorOpen] = useState<boolean>(false);
  const [isEditingContact, setIsEditingContact] = useState<boolean>(false);

  // Contact & Personal Editable Fields
  const [phoneInput, setPhoneInput] = useState<string>(
    profile.student.Phone || ''
  );
  const [familyNameEnInput, setFamilyNameEnInput] = useState<string>(
    profile.familyNameEn
  );
  const [givenNameEnInput, setGivenNameEnInput] = useState<string>(
    profile.givenNameEn
  );
  const [currentVillageInput, setCurrentVillageInput] = useState<string>(
    profile.currentVillage
  );
  const [currentCommuneInput, setCurrentCommuneInput] = useState<string>(
    profile.currentCommune
  );
  const [currentDistrictInput, setCurrentDistrictInput] = useState<string>(
    profile.currentDistrict
  );
  const [currentProvinceInput, setCurrentProvinceInput] = useState<string>(
    profile.currentProvince
  );

  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    messageKh: string;
  } | null>(null);

  // Sync draft state when student changes
  useEffect(() => {
    setDraftPhotoValue(profile.profileImageId);
    setPhoneInput(profile.student.Phone || '');
    setFamilyNameEnInput(profile.familyNameEn);
    setGivenNameEnInput(profile.givenNameEn);
    setCurrentVillageInput(profile.currentVillage);
    setCurrentCommuneInput(profile.currentCommune);
    setCurrentDistrictInput(profile.currentDistrict);
    setCurrentProvinceInput(profile.currentProvince);
  }, [
    profile.studentId,
    profile.profileImageId,
    profile.student.Phone,
    profile.familyNameEn,
    profile.givenNameEn,
    profile.currentVillage,
    profile.currentCommune,
    profile.currentDistrict,
    profile.currentProvince,
  ]);

  const previewPhotoUrl = useMemo(() => {
    if (draftPhotoValue && draftPhotoValue.trim() !== '') {
      return resolveStudentProfilePhotoUrl(
        draftPhotoValue,
        HONOR_PORTRAIT_URLS,
        0
      );
    }
    return profile.profilePhotoUrl;
  }, [draftPhotoValue, profile.profilePhotoUrl]);

  // Handle File Upload from Student's Device (converts to compressed Data URL)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedbackBanner({
        type: 'error',
        messageKh: 'សូមជ្រើសរើសឯកសាររូបភាពតែប៉ុណ្ណោះ (JPG, PNG, WEBP, GIF)។',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = typeof reader.result === 'string' ? reader.result : '';
      if (!resultStr) return;

      // Immediately apply and save to database so the student sees their new profile photo right away
      setDraftPhotoValue(resultStr);
      setIsPhotoEditorOpen(true);
      if (setDb) {
        const res = updateStudentSelfProfile(db, {
          actorUserId: activeUserId,
          studentId: profile.studentId,
          profileImageId: resultStr,
        });
        if (res.ok) {
          setDb(res.nextDb);
          setFeedbackBanner({
            type: 'success',
            messageKh:
              'បានបង្ហោះ និងរក្សាទុករូបថត Profile ថ្មីរបស់អ្នកដោយជោគជ័យ!',
          });
        } else {
          setFeedbackBanner({
            type: 'error',
            messageKh: res.messageKh,
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhotoChoice = (newPhotoValue: string) => {
    setDraftPhotoValue(newPhotoValue);
    if (!setDb) return;

    const res = updateStudentSelfProfile(db, {
      actorUserId: activeUserId,
      studentId: profile.studentId,
      profileImageId: newPhotoValue,
    });

    if (res.ok) {
      setDb(res.nextDb);
      setFeedbackBanner({
        type: 'success',
        messageKh: res.messageKh,
      });
    } else {
      setFeedbackBanner({
        type: 'error',
        messageKh: res.messageKh,
      });
    }
  };

  const handleApplyCustomUrl = () => {
    const trimmed = customUrlInput.trim();
    if (!trimmed) {
      setFeedbackBanner({
        type: 'error',
        messageKh: 'សូមបញ្ចូលតំណភ្ជាប់រូបភាព (URL) មុននឹងចុចរក្សាទុក។',
      });
      return;
    }
    handleSavePhotoChoice(trimmed);
    setCustomUrlInput('');
  };

  const handleSavePersonalContactInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setDb) return;

    const res = updateStudentSelfProfile(db, {
      actorUserId: activeUserId,
      studentId: profile.studentId,
      profileImageId: draftPhotoValue,
      phone: phoneInput,
      familyNameEn: familyNameEnInput,
      givenNameEn: givenNameEnInput,
      currentVillage: currentVillageInput,
      currentCommune: currentCommuneInput,
      currentDistrict: currentDistrictInput,
      currentProvince: currentProvinceInput,
    });

    if (res.ok) {
      setDb(res.nextDb);
      setIsEditingContact(false);
      setFeedbackBanner({
        type: 'success',
        messageKh: res.messageKh,
      });
    } else {
      setFeedbackBanner({
        type: 'error',
        messageKh: res.messageKh,
      });
    }
  };

  return (
    <div
      className="space-y-6"
      data-testid="student-personal-profile-view"
    >
      {/* Hidden File Input for Self-Service Photo Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        data-testid="student-profile-file-input"
      />

      {/* Optional Teacher/Admin Student Switcher Bar (Hidden when logged in as Student) */}
      {!isLoggedInAsStudent && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-extrabold text-slate-900 font-khmer-moul">
                ទម្រង់ព័ត៌មានផ្ទាល់ខ្លួនរបស់សិស្ស (Student Profile Preview & Photo Setting)
              </div>
              <div className="text-[11px] text-slate-500 font-khmer-body">
                សិស្សអាចមើលព័ត៌មានផ្ទាល់ខ្លួន និងដាក់រូប Profile ដោយខ្លួនឯងបានគ្រប់ពេល
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="select-student-profile-preview"
              className="text-xs font-bold text-slate-600 font-khmer-body whitespace-nowrap"
            >
              ជ្រើសរើសសិស្ស៖
            </label>
            <select
              id="select-student-profile-preview"
              value={profile.studentId}
              onChange={(e) => setSelectedStudentIdOverride(e.target.value)}
              data-testid="select-student-profile-switcher"
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 font-khmer-body cursor-pointer"
            >
              {db.Students.slice(0, 60).map((st) => (
                <option key={st.StudentID} value={st.StudentID}>
                  #{st.StudentCode} - {st.FullNameKh} ({st.Gender})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Feedback Notification Banner */}
      {feedbackBanner && (
        <div
          role="status"
          data-testid="student-profile-feedback-banner"
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-bold font-khmer-body ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2
              className={`w-5 h-5 shrink-0 ${
                feedbackBanner.type === 'success'
                  ? 'text-emerald-600'
                  : 'text-rose-600'
              }`}
            />
            <span>{feedbackBanner.messageKh}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white border border-slate-200 text-xs text-slate-700 cursor-pointer"
          >
            បិទ
          </button>
        </div>
      )}

      {/* =====================================================================
          HERO PROFILE BANNER & SELF-SERVICE AVATAR UPLOADER
         ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Top Gradient Cover */}
        <div className="bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#312E81] px-6 py-6 sm:px-8 sm:py-7 text-white relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Left: Interactive Student Avatar + Core Identity */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {/* Profile Photo Frame with Upload Overlay */}
              <div className="relative group shrink-0 mx-auto sm:mx-0">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl p-1 bg-white/20 backdrop-blur-xs border-2 border-amber-300/80 shadow-lg overflow-hidden">
                  <img
                    src={previewPhotoUrl}
                    alt={profile.fullNameKh}
                    referrerPolicy="no-referrer"
                    data-testid="student-profile-avatar-img"
                    className="w-full h-full object-cover rounded-xl bg-slate-800"
                  />
                </div>

                {/* Floating Camera Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="បង្ហោះរូបថត Profile ថ្មីពីឧបករណ៍របស់អ្នក"
                  data-testid="btn-trigger-upload-profile-photo"
                  className="absolute -bottom-2 -right-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] font-khmer-body shadow-md cursor-pointer transition-transform active:scale-95"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>ដាក់រូប Profile</span>
                </button>
              </div>

              {/* Student Name, Code & Badges */}
              <div className="space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-400/20 border border-emerald-300/30 text-emerald-200 text-xs font-bold font-khmer-body">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>បណ្ណព័ត៌មានសិស្សផ្លូវការ • {profile.studentStatus}</span>
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-md bg-white/15 text-amber-300 text-xs font-mono-tabular font-extrabold"
                    data-testid="student-profile-code-badge"
                  >
                    អត្តលេខ៖ #{profile.studentCode}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-blue-100 text-xs font-bold font-khmer-body">
                    ភេទ៖ {profile.gender}
                  </span>
                </div>

                <div>
                  <h2
                    className="text-2xl sm:text-3xl font-bold font-khmer-moul tracking-wide text-white"
                    data-testid="student-profile-fullname-kh"
                  >
                    {profile.fullNameKh}
                  </h2>
                  <p className="text-xs sm:text-sm font-mono-tabular font-bold text-blue-200 tracking-wider uppercase mt-0.5">
                    {profile.fullNameEn} • STUDENT ID: {profile.studentId}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs sm:text-sm text-blue-100 font-khmer-body pt-0.5">
                  <span>
                    ថ្នាក់ទី៖{' '}
                    <strong className="text-white font-extrabold">
                      {profile.className} (កម្រិតទី {profile.gradeLevel})
                    </strong>
                  </span>
                  <span className="text-blue-300/50">•</span>
                  <span>
                    ឆ្នាំសិក្សា៖{' '}
                    <strong className="text-white font-extrabold">
                      {profile.academicYearName}
                    </strong>
                  </span>
                  <span className="text-blue-300/50">•</span>
                  <span>
                    គ្រូបន្ទុកថ្នាក់៖{' '}
                    <strong className="text-amber-300 font-extrabold">
                      {profile.homeroomTeacherNameKh}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Self-Service Profile Actions */}
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                data-testid="btn-upload-device-photo"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold font-khmer-body shadow-xs cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>ជ្រើសរើសរូបពីទូរស័ព្ទ/កុំព្យូទ័រ</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPhotoEditorOpen((prev) => !prev)}
                data-testid="btn-toggle-photo-gallery"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold font-khmer-body cursor-pointer transition-colors"
              >
                <ImagePlus className="w-4 h-4 text-amber-300" />
                <span>
                  {isPhotoEditorOpen
                    ? 'បិទផ្ទាំងកំណត់រូបថត'
                    : 'កំណត់រូប Profile / ជ្រើសរើសរូបគំរូ'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditingContact((prev) => !prev)}
                data-testid="btn-toggle-edit-personal-info"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold font-khmer-body cursor-pointer transition-colors"
              >
                <Edit3 className="w-4 h-4 text-sky-300" />
                <span>
                  {isEditingContact
                    ? 'បិទការកែប្រែ'
                    : 'កែប្រែព័ត៌មានទំនាក់ទំនង'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ===================================================================
            EXPANDABLE SELF-SERVICE PROFILE PHOTO STUDIO
           =================================================================== */}
        {isPhotoEditorOpen && (
          <div
            className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200/90 space-y-5"
            data-testid="student-photo-customizer-panel"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 font-khmer-moul flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>ការកំណត់រូបថត Profile ផ្ទាល់ខ្លួនរបស់សិស្ស (Self-Service Profile Photo)</span>
                </h3>
                <p className="text-xs text-slate-600 font-khmer-body mt-0.5">
                  ប្អូនសិស្សអាចបង្ហោះរូបថតផ្ទាល់ខ្លួនពីឧបករណ៍ ជ្រើសរើសរូបគំរូ ឬបញ្ចូលតំណភ្ជាប់រូបភាព (URL) ដើម្បីបង្ហាញលើបណ្ណសិស្ស និងតារាងកិត្តិយស។
                </p>
              </div>

              {profile.hasCustomPhoto && (
                <button
                  type="button"
                  onClick={() => handleSavePhotoChoice('')}
                  data-testid="btn-reset-default-photo"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 font-khmer-body cursor-pointer self-start"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>កំណត់រូបដើមឡើងវិញ</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Option 1: Upload from Device */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-extrabold text-slate-900 font-khmer-body flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>១. បង្ហោះរូបថតពីឧបករណ៍ផ្ទាល់ខ្លួន</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-khmer-body leading-relaxed">
                    គាំទ្រឯកសាររូបភាព JPG, PNG, WEBP ពីទូរស័ព្ទដៃ ឬកុំព្យូទ័ររបស់អ្នក។
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-khmer-body inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <span>ជ្រើសរើសរូបភាពពីឧបករណ៍...</span>
                </button>
              </div>

              {/* Option 2: Choose Preset Portrait */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-2.5">
                <div className="text-xs font-extrabold text-slate-900 font-khmer-body flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-600" />
                  <span>២. ជ្រើសរើសរូបគំរូសិស្ស (Preset Avatars)</span>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap pt-1">
                  {STUDENT_PRESET_AVATARS.map((preset) => {
                    const isSelected = draftPhotoValue === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSavePhotoChoice(preset.id)}
                        title={preset.labelKh}
                        data-testid={`preset-avatar-${preset.id}`}
                        className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-500/30 scale-105'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.labelKh}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Option 3: Custom Image URL */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 flex flex-col justify-between gap-2.5">
                <div className="space-y-1">
                  <div className="text-xs font-extrabold text-slate-900 font-khmer-body flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-emerald-600" />
                    <span>៣. ដាក់តំណភ្ជាប់រូបភាព (Image URL)</span>
                  </div>
                  <input
                    type="url"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="https://example.com/my-photo.jpg"
                    data-testid="input-custom-profile-photo-url"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono-tabular text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyCustomUrl}
                  data-testid="btn-save-custom-photo-url"
                  className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-khmer-body inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>ប្រើតំណភ្ជាប់រូបភាពនេះ</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SELF-SERVICE CONTACT & ADDRESS EDIT FORM (OPTIONAL)
           =================================================================== */}
        {isEditingContact && (
          <form
            onSubmit={handleSavePersonalContactInfo}
            className="p-5 sm:p-6 bg-blue-50/50 border-b border-blue-200/80 space-y-4"
            data-testid="student-contact-edit-form"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 font-khmer-moul flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <span>កែប្រែព័ត៌មានទំនាក់ទំនង និងទីលំនៅបច្ចុប្បន្ន</span>
              </h3>
              <span className="text-[11px] font-bold text-slate-500 font-khmer-body">
                អត្តលេខ #{profile.studentCode} • {profile.fullNameKh}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-khmer-body">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  លេខទូរស័ព្ទទំនាក់ទំនងផ្ទាល់ខ្លួន
                </label>
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="012 345 678"
                  data-testid="input-student-self-phone"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  នាមត្រកូលអក្សរឡាតាំង (Family Name)
                </label>
                <input
                  type="text"
                  value={familyNameEnInput}
                  onChange={(e) => setFamilyNameEnInput(e.target.value)}
                  placeholder="MEY"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono-tabular font-bold text-slate-900 uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  នាមខ្លួនអក្សរឡាតាំង (Given Name)
                </label>
                <input
                  type="text"
                  value={givenNameEnInput}
                  onChange={(e) => setGivenNameEnInput(e.target.value)}
                  placeholder="LIHAK"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono-tabular font-bold text-slate-900 uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  ភូមិបច្ចុប្បន្ន
                </label>
                <input
                  type="text"
                  value={currentVillageInput}
                  onChange={(e) => setCurrentVillageInput(e.target.value)}
                  placeholder="ភូមិ..."
                  data-testid="input-student-self-village"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  ឃុំ / សង្កាត់បច្ចុប្បន្ន
                </label>
                <input
                  type="text"
                  value={currentCommuneInput}
                  onChange={(e) => setCurrentCommuneInput(e.target.value)}
                  placeholder="ឃុំ/សង្កាត់..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  ស្រុក / ក្រុងបច្ចុប្បន្ន
                </label>
                <input
                  type="text"
                  value={currentDistrictInput}
                  onChange={(e) => setCurrentDistrictInput(e.target.value)}
                  placeholder="ស្រុក/ក្រុង..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  ខេត្ត / រាជធានីបច្ចុប្បន្ន
                </label>
                <input
                  type="text"
                  value={currentProvinceInput}
                  onChange={(e) => setCurrentProvinceInput(e.target.value)}
                  placeholder="ខេត្ត..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900"
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  data-testid="btn-save-student-self-profile"
                  className="w-full py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>រក្សាទុកព័ត៌មាន</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Quick Academic Standing Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 bg-slate-50/70">
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-500 font-khmer-body">
                មធ្យមភាគប្រចាំខែ
              </div>
              <div className="text-2xl font-extrabold text-blue-700 font-mono-tabular mt-0.5">
                {profile.monthlyAverage.toFixed(2)}{' '}
                <span className="text-xs font-bold font-khmer-body text-slate-500">
                  / 50
                </span>
              </div>
            </div>
            <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </span>
          </div>

          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-500 font-khmer-body">
                ចំណាត់ថ្នាក់ក្នុងថ្នាក់ {profile.className}
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 font-khmer-moul mt-0.5">
                {profile.monthlyRank
                  ? `លេខ ${toKhmerNumerals(profile.monthlyRank)}`
                  : 'មិនចាត់ថ្នាក់'}{' '}
                <span className="text-xs font-bold font-khmer-body text-slate-500">
                  / {toKhmerNumerals(profile.totalClassStudents)} នាក់
                </span>
              </div>
            </div>
            <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </span>
          </div>

          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-500 font-khmer-body">
                និទ្ទេសប្រចាំខែ
              </div>
              <div className="text-2xl font-extrabold text-indigo-700 font-mono-tabular mt-0.5">
                និទ្ទេស {profile.monthlyGrade}
              </div>
            </div>
            <span className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </span>
          </div>

          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-500 font-khmer-body">
                មធ្យមភាគប្រចាំឆ្នាំ
              </div>
              <div className="text-2xl font-extrabold text-amber-700 font-mono-tabular mt-0.5">
                {profile.annualAverage.toFixed(2)}{' '}
                <span className="text-xs font-bold font-khmer-body text-slate-500">
                  / 50
                </span>
              </div>
            </div>
            <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          DETAILED PERSONAL INFORMATION SECTIONS (4 STRUCTURED CARDS)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Personal Identity & Birth Information */}
        <div
          className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4"
          data-testid="profile-card-identity"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <User className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 font-khmer-moul">
                  ១. ព័ត៌មានអត្តសញ្ញាណផ្ទាល់ខ្លួន
                </h3>
                <p className="text-[11px] text-slate-500 font-khmer-body">
                  Personal Identity & Biographical Information
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-mono-tabular text-xs font-extrabold">
              #{profile.studentCode}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs font-khmer-body">
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px]">គោត្តនាម និងនាម (ខ្មែរ)</div>
              <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                {profile.fullNameKh}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px]">ឈ្មោះអក្សរឡាតាំង (Latin Name)</div>
              <div className="font-mono-tabular font-extrabold text-slate-900 text-sm mt-0.5 uppercase">
                {profile.fullNameEn}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px]">អត្តលេខសិស្ស (Student ID)</div>
              <div className="font-mono-tabular font-extrabold text-rose-600 text-sm mt-0.5">
                {profile.studentCode} ({profile.studentId})
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px]">ភេទ និងអាយុ</div>
              <div className="font-bold text-slate-900 text-sm mt-0.5">
                {profile.gender} • អាយុ {profile.ageYears} ឆ្នាំ
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>ថ្ងៃខែឆ្នាំកំណើត</span>
              </div>
              <div className="font-bold text-slate-900 mt-0.5">
                {profile.dateOfBirthKh} ({profile.dateOfBirthIso})
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px] flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>លេខទូរស័ព្ទទំនាក់ទំនង</span>
              </div>
              <div
                className="font-mono-tabular font-extrabold text-blue-700 mt-0.5"
                data-testid="profile-display-phone"
              >
                {profile.phone}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Class, Enrollment & Examination Room Info */}
        <div
          className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4"
          data-testid="profile-card-academic"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 font-khmer-moul">
                  ២. ព័ត៌មានថ្នាក់រៀន និងការចុះឈ្មោះសិក្សា
                </h3>
                <p className="text-[11px] text-slate-500 font-khmer-body">
                  Class Enrollment & Examination Seat Assignment
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold font-khmer-body">
              {profile.studentStatus}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs font-khmer-body">
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px]">ថ្នាក់រៀនបច្ចុប្បន្ន</div>
              <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                ថ្នាក់ទី {profile.className} (កម្រិតថ្នាក់ទី {profile.gradeLevel})
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px]">ឆ្នាំសិក្សា</div>
              <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                {profile.academicYearName}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px]">គ្រូទទួលបន្ទុកថ្នាក់</div>
              <div className="font-extrabold text-indigo-700 text-sm mt-0.5">
                {profile.homeroomTeacherNameKh} ({profile.homeroomTeacherPhone})
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px]">បន្ទប់ប្រឡង • លេខតុ • វេន</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {profile.examRoom} • តុលេខ {profile.deskNumber} ({profile.examSession})
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px]">ថ្នាក់រៀនឆ្នាំមុន / សាលាពីមុន</div>
              <div className="font-bold text-slate-900 mt-0.5">
                ថ្នាក់ទី {profile.previousClass} • {profile.previousSchool}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px]">កាលបរិច្ឆេទចូលរៀន</div>
              <div className="font-mono-tabular font-bold text-slate-900 mt-0.5">
                {profile.enrollmentDate}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Place of Birth & Current Residence */}
        <div
          className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4"
          data-testid="profile-card-address"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 font-khmer-moul">
                  ៣. ទីកន្លែងកំណើត និងទីលំនៅបច្ចុប្បន្ន
                </h3>
                <p className="text-[11px] text-slate-500 font-khmer-body">
                  Place of Birth & Current Residential Address
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-xs font-khmer-body">
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>ទីកន្លែងកំណើត (Place of Birth)</span>
              </div>
              <div className="font-bold text-slate-900 leading-relaxed">
                {profile.birthAddressFullKh}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-600">
                <div>ភូមិ៖ <strong>{profile.birthVillage || '—'}</strong></div>
                <div>ឃុំ/សង្កាត់៖ <strong>{profile.birthCommune || '—'}</strong></div>
                <div>ស្រុក/ក្រុង៖ <strong>{profile.birthDistrict || '—'}</strong></div>
                <div>ខេត្ត៖ <strong>{profile.birthProvince || '—'}</strong></div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-blue-600" />
                <span>ទីលំនៅបច្ចុប្បន្ន (Current Address)</span>
              </div>
              <div
                className="font-bold text-slate-900 leading-relaxed"
                data-testid="profile-display-current-address"
              >
                {profile.currentAddressFullKh}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-600">
                <div>ភូមិ៖ <strong>{profile.currentVillage || '—'}</strong></div>
                <div>ឃុំ/សង្កាត់៖ <strong>{profile.currentCommune || '—'}</strong></div>
                <div>ស្រុក/ក្រុង៖ <strong>{profile.currentDistrict || '—'}</strong></div>
                <div>ខេត្ត៖ <strong>{profile.currentProvince || '—'}</strong></div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Parents / Guardians & Social Status */}
        <div
          className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4"
          data-testid="profile-card-family"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <HeartHandshake className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 font-khmer-moul">
                  ៤. ព័ត៌មានឪពុកម្តាយ និងស្ថានភាពសង្គម
                </h3>
                <p className="text-[11px] text-slate-500 font-khmer-body">
                  Parents / Guardians & Social Welfare Information
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs font-khmer-body">
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px] flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>គោត្តនាម និងនាមឪពុក</span>
              </div>
              <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                {profile.fatherFullNameKh}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                មុខរបរ៖ <strong>{profile.fatherOccupation}</strong>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px] flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>គោត្តនាម និងនាមម្តាយ</span>
              </div>
              <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                {profile.motherFullNameKh}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                មុខរបរ៖ <strong>{profile.motherOccupation}</strong>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px]">ស្ថានភាពកំព្រា / ពិការភាព</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {profile.orphanStatusLabelKh} • {profile.disabilityStatusLabelKh}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="text-slate-500 text-[11px]">កម្រិតជីវភាព / បណ្ណសមធម៌</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {profile.povertyLevelLabelKh}
              </div>
            </div>
          </div>

          {/* Quick Navigation Footer Buttons */}
          {(onNavigateExams || onNavigateResults) && (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5">
              {onNavigateExams && (
                <button
                  type="button"
                  onClick={onNavigateExams}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold font-khmer-body cursor-pointer transition-colors"
                >
                  <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>ទៅកាន់ការចូលប្រឡង</span>
                </button>
              )}
              {onNavigateResults && (
                <button
                  type="button"
                  onClick={onNavigateResults}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-khmer-body cursor-pointer transition-colors"
                >
                  <Award className="w-3.5 h-3.5 text-amber-300" />
                  <span>មើលលទ្ធផលប្រឡងរបស់ខ្ញុំ</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
