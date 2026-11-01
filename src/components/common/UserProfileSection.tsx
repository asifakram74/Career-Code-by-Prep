import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { useAuth } from '../../context/AuthContext';
import { QUALIFICATION_OPTIONS, BOARD_OPTIONS, formatRoleName } from '../../types';
import { CustomSelect } from './CustomSelect';
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';

export const UserProfileSection: React.FC = () => {
  const { userProfile, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || '');
  const [qualification, setQualification] = useState(userProfile?.qualification || QUALIFICATION_OPTIONS[0]);
  const [qualificationDetail, setQualificationDetail] = useState(userProfile?.qualificationDetail || '');
  const [board, setBoard] = useState(userProfile?.board || '');
  const [professionalTitle, setProfessionalTitle] = useState(userProfile?.professionalTitle || '');
  const [shortDescription, setShortDescription] = useState(userProfile?.shortDescription || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStudent = userProfile?.role === 'student';

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 300;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setPhotoURL(compressedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const userRef = doc(db, 'users', userProfile.uid);
      const payload: any = {
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim(),
        photoURL: photoURL || '',
        lastActiveAt: Date.now(),
      };

      if (isStudent) {
        payload.qualification = qualification;
        payload.qualificationDetail = qualificationDetail.trim();
        payload.board = board;
      } else {
        payload.professionalTitle = professionalTitle.trim();
        payload.shortDescription = shortDescription.trim();
      }

      await updateDoc(userRef, payload);
      await refreshProfile();
      setSuccess(true);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
      <div className="pb-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative group">
            {photoURL ? (
              <img
                src={photoURL}
                alt="Profile DP"
                className="w-16 h-16 rounded-full object-cover border-2 border-pink-500 shadow-xs"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-xl shadow-xs shadow-pink-200">
                {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <label className="absolute bottom-0 right-0 p-1.5 bg-slate-900 hover:bg-pink-600 text-white rounded-full cursor-pointer shadow-md transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">My Profile & DP</h1>
            <p className="text-xs text-slate-500">
              Role: <strong className="text-pink-700 font-semibold">{formatRoleName(userProfile?.role)}</strong>
            </p>
            <p className="text-[11px] text-pink-600 mt-0.5">Click camera icon on avatar to upload Profile DP</p>
          </div>
        </div>

        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
          ACCOUNT ACTIVE
        </span>
      </div>

      {success && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Profile changes saved successfully.
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="mt-6 space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
          <input
            type="email"
            disabled
            value={userProfile?.email || ''}
            className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-500 font-medium cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500 font-medium"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+92 300 1234567"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500 font-medium"
          />
        </div>

        {isStudent ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Latest Qualification</label>
                <CustomSelect
                  value={qualification}
                  onChange={(val) => setQualification(val)}
                  options={QUALIFICATION_OPTIONS.map((q) => ({ value: q, label: q }))}
                  placeholder="Select Qualification"
                  size="sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Major / Detail</label>
                <input
                  type="text"
                  value={qualificationDetail}
                  onChange={(e) => setQualificationDetail(e.target.value)}
                  placeholder="e.g. Pre-Medical, ICS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Board (Optional)</label>
              <CustomSelect
                value={board}
                onChange={(val) => setBoard(val)}
                options={[
                  { value: '', label: 'Select Board (Optional)' },
                  ...BOARD_OPTIONS.map((b) => ({ value: b, label: b })),
                ]}
                placeholder="Select Board (Optional)"
                size="sm"
                searchable
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Professional Title</label>
              <input
                type="text"
                value={professionalTitle}
                onChange={(e) => setProfessionalTitle(e.target.value)}
                placeholder="e.g. Senior Medical Counselor"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bio / Expertise Intro</label>
              <textarea
                rows={3}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Displayed to students when choosing a mentor..."
                className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </>
        )}

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-semibold inline-flex items-center justify-center gap-1.5 shadow-xs shadow-pink-200 transition-colors disabled:opacity-50 cursor-pointer text-xs"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Changes...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};
