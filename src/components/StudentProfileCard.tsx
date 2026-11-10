import React, { useState } from 'react';
import { Award, BookOpen, CheckCircle2, Sparkles, Star, Trophy } from 'lucide-react';
import { HONOR_PORTRAIT_URLS } from '../lib/seedData';
import { StudentRecord } from '../types/database';

export interface StudentProfileSubjectScore {
  id: string;
  subjectNameKh: string;
  subjectNameEn: string;
  score: number;
  maxScore: number;
  badgeLabel: string;
  accentColor: string;
  progressColor: string;
  iconBg: string;
}

export interface FeaturedStudentProfile {
  studentCode: string;
  displayNameKh: string;
  classLabel: string;
  averageScore: string;
  rankLabel: string;
  gradeLetter: string;
  progressPercent: number;
  photoUrl: string;
  subjects: StudentProfileSubjectScore[];
}

export const FEATURED_STUDENT_PROFILES: FeaturedStudentProfile[] = [
  {
    studentCode: '5187',
    displayNameKh: 'ក. រឺ យូរៀន',
    classLabel: 'ថ្នាក់ទី 12C • អត្តលេខ 5187',
    averageScore: '39.31',
    rankLabel: 'លេខ ១',
    gradeLetter: 'C',
    progressPercent: 86,
    photoUrl: HONOR_PORTRAIT_URLS['DRV-PHOTO-RANK3'],
    subjects: [
      {
        id: 'ict',
        subjectNameKh: 'ព័ត៌មានវិទ្យា (ICT)',
        subjectNameEn: 'Information & Communication Technology',
        score: 48,
        maxScore: 50,
        badgeLabel: 'មេដាយមាសប្រចាំខែ',
        accentColor: 'text-emerald-600',
        progressColor: 'bg-emerald-500',
        iconBg: 'from-amber-400 to-orange-500',
      },
      {
        id: 'math',
        subjectNameKh: 'គណិតវិទ្យា',
        subjectNameEn: 'Advanced Mathematics (Grade 12)',
        score: 92,
        maxScore: 100,
        badgeLabel: 'ពិន្ទុខ្ពស់បំផុត',
        accentColor: 'text-blue-600',
        progressColor: 'bg-blue-500',
        iconBg: 'from-blue-500 to-indigo-600',
      },
      {
        id: 'eng',
        subjectNameKh: 'ភាសាអង់គ្លេស',
        subjectNameEn: 'English Literature & Grammar',
        score: 45,
        maxScore: 50,
        badgeLabel: 'និទ្ទេសល្អប្រសើរ',
        accentColor: 'text-orange-600',
        progressColor: 'bg-orange-500',
        iconBg: 'from-emerald-400 to-teal-600',
      },
      {
        id: 'khm',
        subjectNameKh: 'អក្សរសាស្ត្រខ្មែរ',
        subjectNameEn: 'Khmer Literature & Composition',
        score: 86,
        maxScore: 100,
        badgeLabel: 'តារាងកិត្តិយស Top 5',
        accentColor: 'text-amber-600',
        progressColor: 'bg-amber-500',
        iconBg: 'from-rose-400 to-pink-600',
      },
    ],
  },
  {
    studentCode: '6463',
    displayNameKh: 'ក. គុណ គិមឡាង',
    classLabel: 'ថ្នាក់ទី 12C • អត្តលេខ 6463',
    averageScore: '46.85',
    rankLabel: 'លេខ ១',
    gradeLetter: 'A',
    progressPercent: 94,
    photoUrl: HONOR_PORTRAIT_URLS['DRV-PHOTO-RANK1'],
    subjects: [
      {
        id: 'ict',
        subjectNameKh: 'ព័ត៌មានវិទ្យា (ICT)',
        subjectNameEn: 'Information & Communication Technology',
        score: 49,
        maxScore: 50,
        badgeLabel: 'ចំណាត់ថ្នាក់លេខ ១',
        accentColor: 'text-emerald-600',
        progressColor: 'bg-emerald-500',
        iconBg: 'from-amber-400 to-orange-500',
      },
      {
        id: 'math',
        subjectNameKh: 'គណិតវិទ្យា',
        subjectNameEn: 'Advanced Mathematics (Grade 12)',
        score: 96,
        maxScore: 100,
        badgeLabel: 'និទ្ទេស A',
        accentColor: 'text-blue-600',
        progressColor: 'bg-blue-500',
        iconBg: 'from-blue-500 to-indigo-600',
      },
      {
        id: 'eng',
        subjectNameKh: 'ភាសាអង់គ្លេស',
        subjectNameEn: 'English Literature & Grammar',
        score: 47,
        maxScore: 50,
        badgeLabel: 'និទ្ទេស A',
        accentColor: 'text-orange-600',
        progressColor: 'bg-orange-500',
        iconBg: 'from-emerald-400 to-teal-600',
      },
      {
        id: 'phy',
        subjectNameKh: 'រូបវិទ្យា',
        subjectNameEn: 'Physics & Mechanics',
        score: 46,
        maxScore: 50,
        badgeLabel: 'សិស្សពូកែប្រចាំសាលា',
        accentColor: 'text-amber-600',
        progressColor: 'bg-amber-500',
        iconBg: 'from-rose-400 to-pink-600',
      },
    ],
  },
  {
    studentCode: '6386',
    displayNameKh: 'គួយ ឡៅកាន',
    classLabel: 'ថ្នាក់ទី 12C • អត្តលេខ 6386',
    averageScore: '45.40',
    rankLabel: 'លេខ ២',
    gradeLetter: 'A',
    progressPercent: 91,
    photoUrl: HONOR_PORTRAIT_URLS['DRV-PHOTO-RANK2'],
    subjects: [
      {
        id: 'ict',
        subjectNameKh: 'ព័ត៌មានវិទ្យា (ICT)',
        subjectNameEn: 'Information & Communication Technology',
        score: 48,
        maxScore: 50,
        badgeLabel: 'មេដាយប្រាក់',
        accentColor: 'text-emerald-600',
        progressColor: 'bg-emerald-500',
        iconBg: 'from-amber-400 to-orange-500',
      },
      {
        id: 'math',
        subjectNameKh: 'គណិតវិទ្យា',
        subjectNameEn: 'Advanced Mathematics (Grade 12)',
        score: 94,
        maxScore: 100,
        badgeLabel: 'និទ្ទេស A',
        accentColor: 'text-blue-600',
        progressColor: 'bg-blue-500',
        iconBg: 'from-blue-500 to-indigo-600',
      },
      {
        id: 'eng',
        subjectNameKh: 'ភាសាអង់គ្លេស',
        subjectNameEn: 'English Literature & Grammar',
        score: 45,
        maxScore: 50,
        badgeLabel: 'និទ្ទេស A',
        accentColor: 'text-orange-600',
        progressColor: 'bg-orange-500',
        iconBg: 'from-emerald-400 to-teal-600',
      },
    ],
  },
  {
    studentCode: '6648',
    displayNameKh: 'ក. កឹង កន្និកា',
    classLabel: 'ថ្នាក់ទី 7A • អត្តលេខ 6648',
    averageScore: '45.80',
    rankLabel: 'លេខ ១',
    gradeLetter: 'A',
    progressPercent: 92,
    photoUrl: HONOR_PORTRAIT_URLS['DRV-PHOTO-RANK5'],
    subjects: [
      {
        id: 'ict',
        subjectNameKh: 'ព័ត៌មានវិទ្យា (ICT)',
        subjectNameEn: 'Foundations of Computing',
        score: 48,
        maxScore: 50,
        badgeLabel: 'លេខ ១ ប្រចាំថ្នាក់ 7A',
        accentColor: 'text-emerald-600',
        progressColor: 'bg-emerald-500',
        iconBg: 'from-amber-400 to-orange-500',
      },
      {
        id: 'math',
        subjectNameKh: 'គណិតវិទ្យា',
        subjectNameEn: 'Grade 7 Mathematics',
        score: 93,
        maxScore: 100,
        badgeLabel: 'និទ្ទេស A',
        accentColor: 'text-blue-600',
        progressColor: 'bg-blue-500',
        iconBg: 'from-blue-500 to-indigo-600',
      },
      {
        id: 'eng',
        subjectNameKh: 'ភាសាអង់គ្លេស',
        subjectNameEn: 'Grade 7 English',
        score: 46,
        maxScore: 50,
        badgeLabel: 'និទ្ទេស A',
        accentColor: 'text-orange-600',
        progressColor: 'bg-orange-500',
        iconBg: 'from-emerald-400 to-teal-600',
      },
    ],
  },
];

interface StudentProfileCardProps {
  students?: StudentRecord[];
  defaultStudentCode?: string;
  compact?: boolean;
}

export const StudentProfileCard: React.FC<StudentProfileCardProps> = ({
  defaultStudentCode = '5187',
  compact = false,
}) => {
  const [selectedCode, setSelectedCode] = useState<string>(defaultStudentCode);

  const profile =
    FEATURED_STUDENT_PROFILES.find((p) => p.studentCode === selectedCode) ||
    FEATURED_STUDENT_PROFILES[0];

  // SVG circular arc math
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (profile.progressPercent / 100) * circumference;

  // Calculate glowing dot coordinates on the circle
  const angleRad = ((profile.progressPercent / 100) * 360 - 90) * (Math.PI / 180);
  const dotX = 72 + radius * Math.cos(angleRad);
  const dotY = 72 + radius * Math.sin(angleRad);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_8px_30px_rgb(15,23,42,0.06)] p-4 sm:p-5 flex flex-col justify-between">
      {/* Student Switcher Pills */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[11px] font-bold text-slate-700 font-khmer-body">
            ទម្រង់សិស្ស និងតារាងកិត្តិយស
          </span>
        </div>
        <div className="flex items-center gap-1">
          {FEATURED_STUDENT_PROFILES.map((item) => (
            <button
              key={item.studentCode}
              type="button"
              onClick={() => setSelectedCode(item.studentCode)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono-tabular font-semibold transition-colors cursor-pointer ${
                profile.studentCode === item.studentCode
                  ? 'bg-[#1E62D0] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              #{item.studentCode}
            </button>
          ))}
        </div>
      </div>

      {/* Top Royal-Blue Profile Hero Card */}
      <div className="bg-gradient-to-b from-[#1E62D0] to-[#15489E] rounded-3xl p-6 text-white text-center relative overflow-hidden shadow-md">
        {/* Decorative subtle glow rings */}
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-sky-400/15 blur-xl pointer-events-none" />

        {/* Student Name & Class/Code */}
        <div className="relative z-10">
          <h3 className="text-lg font-bold tracking-tight font-khmer-moul text-white">
            {profile.displayNameKh}
          </h3>
          <p className="text-xs text-blue-100/90 font-khmer-body mt-1">
            {profile.classLabel}
          </p>
        </div>

        {/* Center Circular Student Photo framed by Animated Progress Arc with Glowing Dot */}
        <div className="relative w-36 h-36 mx-auto my-4 flex items-center justify-center">
          <svg
            className="w-36 h-36 -rotate-90 transform absolute inset-0 pointer-events-none"
            viewBox="0 0 144 144"
          >
            {/* Background track circle */}
            <circle
              cx="72"
              cy="72"
              r={radius}
              fill="transparent"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="6"
            />
            {/* Animated progress arc */}
            <circle
              cx="72"
              cy="72"
              r={radius}
              fill="transparent"
              stroke="#60A5FA"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          {/* Glowing endpoint dot (unrotated coordinate space) */}
          <svg className="w-36 h-36 absolute inset-0 pointer-events-none" viewBox="0 0 144 144">
            <circle
              cx={dotX}
              cy={dotY}
              r="6"
              fill="#FFFFFF"
              stroke="#3B82F6"
              strokeWidth="3"
            />
          </svg>

          {/* Circular Student Portrait Centered Inside the Progress Ring */}
          <div className="relative z-10 w-24 h-24 rounded-full overflow-hidden border-2 border-white/90 shadow-inner bg-blue-900">
            <img
              src={profile.photoUrl}
              alt={profile.displayNameKh}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Floating Rank Pill */}
          <div className="z-20 absolute -bottom-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] shadow-xs flex items-center gap-1 font-khmer-body">
            <Star className="w-3 h-3 fill-slate-950" />
            <span>សិស្សពូកែ Top 5</span>
          </div>
        </div>

        {/* 3 Bottom Columns inside the Royal-Blue Card */}
        <div className="relative z-10 grid grid-cols-3 gap-2 pt-4 mt-2 border-t border-white/15">
          <div className="text-center">
            <div className="text-[11px] text-blue-100/80 font-khmer-body">មធ្យមភាគ</div>
            <div className="text-base font-extrabold font-mono-tabular text-white mt-0.5">
              {profile.averageScore}
            </div>
          </div>
          <div className="text-center border-x border-white/15 px-1">
            <div className="text-[11px] text-blue-100/80 font-khmer-body">ចំណាត់ថ្នាក់</div>
            <div className="text-base font-extrabold font-khmer-body text-amber-300 mt-0.5">
              {profile.rankLabel}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[11px] text-blue-100/80 font-khmer-body">និទ្ទេស</div>
            <div className="text-base font-extrabold font-mono-tabular text-emerald-300 mt-0.5">
              {profile.gradeLetter}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Achievements & Subject Scores List */}
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-900 font-khmer-body flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>តារាងកិត្តិយស និងមុខវិជ្ជា</span>
          </h4>
          <span className="text-[11px] text-slate-400 font-mono-tabular">
            {profile.subjects.length} មុខវិជ្ជា
          </span>
        </div>

        <div className="space-y-2.5">
          {(compact ? profile.subjects.slice(0, 3) : profile.subjects).map((sub, idx) => {
            const pct = Math.round((sub.score / sub.maxScore) * 100);
            return (
              <div
                key={sub.id}
                className="p-3 rounded-2xl bg-slate-50/90 hover:bg-slate-100/80 border border-slate-200/70 transition-colors flex items-center gap-3"
              >
                {/* 3D-style Medal / Trophy Icon */}
                <div
                  className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${sub.iconBg} text-white flex items-center justify-center shadow-xs shrink-0`}
                >
                  {idx === 0 ? (
                    <Trophy className="w-5 h-5" />
                  ) : idx === 1 ? (
                    <Award className="w-5 h-5" />
                  ) : idx === 2 ? (
                    <BookOpen className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>

                {/* Subject Info + Progress Bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-slate-900 font-khmer-body truncate">
                      {sub.subjectNameKh}
                    </div>
                    <div className="text-xs font-extrabold font-mono-tabular text-slate-900 shrink-0">
                      {sub.score}
                      <span className="text-slate-400 font-normal">/{sub.maxScore}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 font-khmer-body mt-0.5 flex items-center justify-between">
                    <span>{sub.badgeLabel}</span>
                    <span className="font-mono-tabular font-semibold">{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full ${sub.progressColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
