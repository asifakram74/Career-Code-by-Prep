import React from 'react';
import { X, ShieldCheck, GraduationCap, Award, BookOpen, Sparkles } from 'lucide-react';
import { formatRoleName } from '../../types';

interface AdminProfileData {
  displayName: string;
  role?: string;
  professionalTitle?: string;
  qualification?: string;
  qualificationDetail?: string;
  shortDescription?: string;
  photoURL?: string;
}

interface AdminProfileModalProps {
  admin: AdminProfileData | null;
  onClose: () => void;
  articlesCount?: number;
}

export const AdminProfileModal: React.FC<AdminProfileModalProps> = ({
  admin,
  onClose,
  articlesCount = 1,
}) => {
  if (!admin) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-pink-100 overflow-hidden relative animate-pop-in text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner - Career Code Pink Theme */}
        <div className="h-28 bg-gradient-to-r from-pink-600 via-rose-500 to-pink-700 relative p-4 flex items-start justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Card Body */}
        <div className="px-5 sm:px-6 pb-6 pt-0 relative">
          {/* Avatar / DP Overlapping Banner */}
          <div className="-mt-14 mb-3.5 flex items-end justify-between">
            <div className="relative">
              {admin.photoURL ? (
                <img
                  src={admin.photoURL}
                  alt={admin.displayName}
                  className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-md bg-white"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white font-bold text-2xl flex items-center justify-center border-4 border-white shadow-md">
                  {admin.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-xs"
                title="Verified Mentor"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-700 bg-pink-50 border border-pink-200/80 px-2.5 py-1 rounded-full">
                <Sparkles className="w-3 h-3 text-pink-500" />
                {formatRoleName(admin.role)}
              </span>
            </div>
          </div>

          {/* Admin Name & Title */}
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight break-words whitespace-normal">
              {admin.displayName}
            </h3>
            <p className="text-xs sm:text-sm font-semibold text-pink-700 break-words whitespace-normal">
              {admin.professionalTitle || 'Academic Counselor & Career Mentor'}
            </p>
          </div>

          {/* Academic Background / Qualifications */}
          {(admin.qualification || admin.qualificationDetail) && (
            <div className="mt-3.5 p-3 rounded-2xl bg-pink-50/50 border border-pink-100 flex items-start gap-2.5">
              <GraduationCap className="w-4 h-4 text-pink-600 mt-0.5 shrink-0" />
              <div className="text-xs min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Academic Background
                </span>
                <span className="font-semibold text-slate-800 block">
                  {admin.qualification}
                  {admin.qualificationDetail ? ` (${admin.qualificationDetail})` : ''}
                </span>
              </div>
            </div>
          )}

          {/* Bio / Mentorship Description */}
          <div className="mt-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              About the Mentor
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              {admin.shortDescription ||
                'Passionate Career Code mentor dedicated to helping students discover their true professional paths, university choices, and academic excellence.'}
            </p>
          </div>

          {/* Highlights & Stats */}
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <div className="bg-white border border-pink-100 rounded-xl p-2.5 text-center shadow-2xs">
              <div className="flex items-center justify-center gap-1 text-slate-400 text-[10px] font-semibold uppercase mb-0.5">
                <BookOpen className="w-3 h-3 text-pink-600" />
                <span>Articles</span>
              </div>
              <span className="text-base font-bold text-slate-900">{articlesCount} published</span>
            </div>
            <div className="bg-white border border-pink-100 rounded-xl p-2.5 text-center shadow-2xs">
              <div className="flex items-center justify-center gap-1 text-slate-400 text-[10px] font-semibold uppercase mb-0.5">
                <Award className="w-3 h-3 text-pink-600" />
                <span>Community</span>
              </div>
              <span className="text-base font-bold text-slate-900">Career Code Team</span>
            </div>
          </div>

          {/* Notice: Privacy Guard strictly enforced */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Official Career Code Verified Mentor Profile</span>
            </p>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
