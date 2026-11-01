import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { QUALIFICATION_OPTIONS } from '../../types';
import {
  Star,
  X,
  Sparkles,
  CheckCircle2,
  Heart,
  MessageSquare,
  GraduationCap,
  Send,
  AlertCircle,
  Loader2,
  ArrowUp,
} from 'lucide-react';

interface SubmitReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const APPRECIATION_TAGS = [
  'Helpful Mentors',
  'Clear Career Direction',
  'Quick Guidance',
  'Admission Clarity',
  'Entry Test Tips',
  'Scholarship Info',
  '100% Free Support',
  'Courteous Team',
];

const RATING_DESCRIPTIONS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Fair Experience',
  3: 'Good & Helpful',
  4: 'Very Good Guidance',
  5: 'Exceptional & Life-Changing!',
};

export const SubmitReviewModal: React.FC<SubmitReviewModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { userProfile } = useAuth();

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [name, setName] = useState<string>(userProfile?.displayName || '');
  const [qualification, setQualification] = useState<string>(
    userProfile?.qualification || 'Intermediate / FSc'
  );
  const [boardOrCity, setBoardOrCity] = useState<string>(
    userProfile?.board || ''
  );
  const [feedback, setFeedback] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([
    'Helpful Mentors',
    'Clear Career Direction',
  ]);

  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [submittedSuccessfully, setSubmittedSuccessfully] = useState(false);

  // References for scrolling and focus
  const formScrollRef = useRef<HTMLDivElement>(null);
  const topBannerRef = useRef<HTMLDivElement>(null);
  const ratingSectionRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const qualificationSelectRef = useRef<HTMLSelectElement>(null);
  const feedbackTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Synchronize user profile values if modal opens
  useEffect(() => {
    if (isOpen) {
      if (!name && userProfile?.displayName) {
        setName(userProfile.displayName);
      }
      if (!qualification && userProfile?.qualification) {
        setQualification(userProfile.qualification);
      }
      if (!boardOrCity && userProfile?.board) {
        setBoardOrCity(userProfile.board);
      }
      setAttemptedSubmit(false);
      setError('');
    }
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  // Validation checks for mandatory fields
  const isRatingValid = typeof rating === 'number' && rating >= 1 && rating <= 5;
  const isNameValid = name.trim().length > 0;
  const isQualificationValid = qualification.trim().length > 0;
  const isFeedbackValid = feedback.trim().length >= 10;
  const isFormComplete = isRatingValid && isNameValid && isQualificationValid && isFeedbackValid;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const scrollToFirstMissingField = () => {
    // Scroll container to the top smoothly
    if (formScrollRef.current) {
      formScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Focus the first invalid input element
    setTimeout(() => {
      if (!isRatingValid && ratingSectionRef.current) {
        ratingSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (!isNameValid && nameInputRef.current) {
        nameInputRef.current.focus();
        nameInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (!isQualificationValid && qualificationSelectRef.current) {
        qualificationSelectRef.current.focus();
        qualificationSelectRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (!isFeedbackValid && feedbackTextareaRef.current) {
        feedbackTextareaRef.current.focus();
        feedbackTextareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);

    const trimmedName = name.trim();
    const trimmedFeedback = feedback.trim();

    // Verify all mandatory fields
    if (!isRatingValid) {
      setError('Please select a star rating from 1 to 5.');
      scrollToFirstMissingField();
      return;
    }

    if (!isNameValid) {
      setError('Please enter your full name (Mandatory *).');
      scrollToFirstMissingField();
      return;
    }

    if (!isQualificationValid) {
      setError('Please select your qualification / class (Mandatory *).');
      scrollToFirstMissingField();
      return;
    }

    if (!trimmedFeedback) {
      setError('Please write your review feedback (Mandatory *).');
      scrollToFirstMissingField();
      return;
    }

    if (trimmedFeedback.length < 10) {
      setError(
        `Feedback must be at least 10 characters long. (Currently ${trimmedFeedback.length} characters)`
      );
      scrollToFirstMissingField();
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const now = Date.now();

      // 1. Create record in platform_reviews without any undefined fields
      await addDoc(collection(db, 'platform_reviews'), {
        studentId: userProfile?.uid || 'guest_visitor',
        studentName: trimmedName,
        studentEmail: userProfile?.email || '',
        studentQualification: qualification,
        studentBoard: boardOrCity.trim() || '',
        studentAvatarUrl: userProfile?.photoURL || '',
        rating,
        ratingFeedback: trimmedFeedback,
        ratingTags: selectedTags,
        categoryName: 'Career Code LMS',
        expertName: 'Career Code Mentors',
        status: 'active',
        createdAt: now,
      });

      // 2. Notify Super Admin (Hamza Saif) in real time
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const notifiedUserIds = new Set<string>();

        usersSnap.forEach((uDoc) => {
          const u = uDoc.data();
          const isSuperAdmin = u.role === 'super_admin';
          const isHamzaSaif =
            uDoc.id === 'admin_hamza_saif' ||
            (u.displayName || '').toLowerCase().includes('hamza saif') ||
            u.email === 'mentoflux@gmail.com';

          if ((isSuperAdmin || isHamzaSaif) && !notifiedUserIds.has(uDoc.id)) {
            notifiedUserIds.add(uDoc.id);
          }
        });

        if (notifiedUserIds.size === 0) {
          notifiedUserIds.add('admin_hamza_saif');
        }

        for (const adminUid of notifiedUserIds) {
          await addDoc(collection(db, 'notifications'), {
            userId: adminUid,
            title: `⭐ New Review for Career Code!`,
            message: `${trimmedName} (${qualification}) submitted a ${rating}-star review: "${trimmedFeedback.slice(0, 100)}${trimmedFeedback.length > 100 ? '...' : ''}"`,
            type: 'platform_review',
            isRead: false,
            createdAt: now,
          });
        }
      } catch (notifErr) {
        console.warn('Super admin notification error:', notifErr);
      }

      setSubmittedSuccessfully(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error submitting platform review:', err);
      setError(err?.message || 'Failed to submit review. Please try again.');
      scrollToFirstMissingField();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submittedSuccessfully) {
      setSubmittedSuccessfully(false);
      setFeedback('');
    }
    setAttemptedSubmit(false);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Header */}
        <div className="relative px-6 py-4.5 bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-xs">
              <Star className="w-5 h-5 fill-amber-300 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight leading-tight">
                Submit a Review
              </h2>
              <p className="text-xs text-pink-100 font-medium">
                Share your overall experience with Career Code LMS
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submittedSuccessfully ? (
          /* Thank You Celebration Screen */
          <div className="p-8 text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200 shadow-sm animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-slate-900">
                Thank You for Your Feedback!
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                Your genuine review has been recorded and will inspire thousands of students seeking reliable career guidance across Pakistan.
              </p>
            </div>

            <div className="flex items-center justify-center gap-1 text-amber-500 pt-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-5 h-5 ${
                    s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                  }`}
                />
              ))}
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Close & Return
              </button>
            </div>
          </div>
        ) : (
          /* Submission Form */
          <form
            onSubmit={handleSubmit}
            className="flex flex-col flex-1 overflow-hidden"
            noValidate
          >
            {/* Scrollable Form Body */}
            <div
              ref={formScrollRef}
              className="p-5 sm:p-6 overflow-y-auto space-y-4 text-left flex-1"
            >
              {/* Mandatory fields legend */}
              <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">
                  Fields marked with <span className="text-rose-500 font-extrabold text-xs">*</span> are mandatory
                </span>
                {isFormComplete ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    All required fields filled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80">
                    Required fields pending
                  </span>
                )}
              </div>

              {/* Error Alert Box: Visible on top when submit attempted with incomplete fields */}
              {(error || (attemptedSubmit && !isFormComplete)) && (
                <div
                  ref={topBannerRef}
                  className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 shadow-xs animate-in fade-in duration-200"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1 space-y-0.5">
                    <p className="font-bold">
                      {error ? error : 'Please fill all mandatory fields marked with *'}
                    </p>
                    <p className="text-[11px] text-rose-700">
                      Please complete all required fields marked with an asterisk (*) to submit your review.
                    </p>
                  </div>
                </div>
              )}

              {/* 1. Star Rating Selection (Mandatory *) */}
              <div
                ref={ratingSectionRef}
                className={`border rounded-2xl p-4 text-center space-y-2 transition-all ${
                  attemptedSubmit && !isRatingValid
                    ? 'bg-rose-50/50 border-rose-300 ring-2 ring-rose-200'
                    : 'bg-gradient-to-b from-pink-50/60 to-rose-50/30 border-pink-100'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    How would you rate your experience?
                  </label>
                  <span className="text-rose-500 font-bold text-sm" title="Mandatory Field">
                    *
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const isFilled = (hoverRating || rating) >= starValue;
                    return (
                      <button
                        key={starValue}
                        type="button"
                        onMouseEnter={() => setHoverRating(starValue)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => {
                          setRating(starValue);
                          setError('');
                        }}
                        className="p-1 hover:scale-115 active:scale-95 transition-transform cursor-pointer focus:outline-none"
                        aria-label={`${starValue} star`}
                      >
                        <Star
                          className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                            isFilled
                              ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                              : 'text-slate-300 fill-slate-100'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs font-semibold text-pink-700 min-h-[18px]">
                  {RATING_DESCRIPTIONS[hoverRating || rating] || ''}
                </p>

                {attemptedSubmit && !isRatingValid && (
                  <p className="text-[11px] font-semibold text-rose-600 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Please select a rating (1 to 5 stars).
                  </p>
                )}
              </div>

              {/* 2. Written Feedback Text (Mandatory *) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <span>Your Review / Feedback</span>
                    <span className="text-rose-500 font-bold text-sm" title="Mandatory Field">
                      *
                    </span>
                  </label>
                  <span
                    className={`text-[10px] font-medium ${
                      isFeedbackValid ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {feedback.trim().length}/10 min chars
                  </span>
                </div>

                <textarea
                  ref={feedbackTextareaRef}
                  value={feedback}
                  onChange={(e) => {
                    setFeedback(e.target.value);
                    if (e.target.value.trim().length >= 10 && error) {
                      setError('');
                    }
                  }}
                  rows={3}
                  placeholder="Share how Career Code helped you with career choices, admissions, or mentors..."
                  className={`w-full text-xs text-slate-800 placeholder-slate-400 bg-white border rounded-xl p-3 focus:outline-none transition-all resize-none ${
                    attemptedSubmit && !isFeedbackValid
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 bg-rose-50/20'
                      : 'border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20'
                  }`}
                />

                {attemptedSubmit && !isFeedbackValid && (
                  <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {feedback.trim().length === 0
                        ? 'Please write your review feedback (Mandatory).'
                        : 'Review must be at least 10 characters.'}
                    </span>
                  </p>
                )}
              </div>

              {/* 3. Student Name & Qualification (Both Mandatory *) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <span>Your Full Name</span>
                    <span className="text-rose-500 font-bold text-sm" title="Mandatory Field">
                      *
                    </span>
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (e.target.value.trim().length > 0 && error) {
                        setError('');
                      }
                    }}
                    placeholder="e.g. Ayesha Malik"
                    className={`w-full text-xs text-slate-800 bg-white border rounded-xl px-3 py-2.5 focus:outline-none transition-all ${
                      attemptedSubmit && !isNameValid
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 bg-rose-50/20'
                        : 'border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20'
                    }`}
                  />
                  {attemptedSubmit && !isNameValid && (
                    <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 pt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Name is required (Mandatory).</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <span>Qualification / Class</span>
                    <span className="text-rose-500 font-bold text-sm" title="Mandatory Field">
                      *
                    </span>
                  </label>
                  <select
                    ref={qualificationSelectRef}
                    value={qualification}
                    onChange={(e) => {
                      setQualification(e.target.value);
                      if (e.target.value.trim().length > 0 && error) {
                        setError('');
                      }
                    }}
                    className={`w-full text-xs text-slate-800 bg-white border rounded-xl px-3 py-2.5 focus:outline-none transition-all cursor-pointer ${
                      attemptedSubmit && !isQualificationValid
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 bg-rose-50/20'
                        : 'border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20'
                    }`}
                  >
                    <option value="">Select Qualification</option>
                    {QUALIFICATION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {attemptedSubmit && !isQualificationValid && (
                    <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 pt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Qualification is required (Mandatory).</span>
                    </p>
                  )}
                </div>
              </div>

              {/* 4. Quick Appreciation Tags (Optional) */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Highlights <span className="text-[10px] text-slate-400 font-normal">(Optional tags)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {APPRECIATION_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-pink-600 text-white border-pink-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-pink-300 hover:bg-pink-50/50'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Optional Board / City */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Board / City / Institution <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={boardOrCity}
                  onChange={(e) => setBoardOrCity(e.target.value)}
                  placeholder="e.g. Lahore Board / FAST-NUCES / Rawalpindi"
                  className="w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                />
              </div>
            </div>

            {/* Action Buttons Footer (Always docked at bottom of modal) */}
            <div className="p-4 sm:px-6 bg-slate-50/90 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-[11px] text-slate-500 text-center sm:text-left">
                {!isFormComplete && attemptedSubmit ? (
                  <span className="text-rose-600 font-semibold inline-flex items-center gap-1">
                    <ArrowUp className="w-3.5 h-3.5" />
                    Please fill in the required fields (*) above
                  </span>
                ) : (
                  <span>All reviews are verified by Career Code team</span>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer ${
                    isFormComplete
                      ? 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white shadow-pink-200 hover:shadow-md active:scale-98'
                      : attemptedSubmit
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                      : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {isFormComplete
                          ? 'Submit Review'
                          : attemptedSubmit
                          ? 'Check Required Fields Above'
                          : 'Submit Review'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
