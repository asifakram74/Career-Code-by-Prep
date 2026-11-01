import React, { useRef, useState, useEffect, useMemo } from 'react';
import { subscribeToUnifiedReviews, UnifiedReviewItem } from '../../lib/reviewService';
import { Star, ChevronLeft, ChevronRight, Quote, CheckCircle2 } from 'lucide-react';

interface ReviewsCarouselProps {
  onGetStarted: () => void;
}

export const ReviewsCarousel: React.FC<ReviewsCarouselProps> = ({ onGetStarted }) => {
  const [reviews, setReviews] = useState<UnifiedReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToUnifiedReviews(
      (items) => {
        setReviews(items);
        setLoading(false);
      },
      (err) => {
        console.warn('Reviews carousel error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleManualScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 380;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const formatReviewDate = (timestamp?: number) => {
    if (!timestamp) return 'Recent';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Pure authentic state: If no student has submitted a rating yet, display honest message
  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-hidden py-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-80 sm:w-92 h-64 rounded-3xl bg-white border border-slate-200 p-5 shrink-0 animate-pulse space-y-4"
          >
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-16 bg-slate-100 rounded-xl" />
            <div className="h-4 bg-slate-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-10 px-4 rounded-3xl bg-white/80 backdrop-blur-md border border-pink-100/90 max-w-lg mx-auto shadow-2xs space-y-2">
        <div className="w-12 h-12 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center mx-auto mb-2 shadow-2xs">
          <Star className="w-6 h-6 stroke-[1.5]" />
        </div>
        <h3 className="text-base font-bold text-slate-800">No Student Reviews Yet</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          Real student ratings and written feedback will automatically appear here once students complete their guidance consultations.
        </p>
      </div>
    );
  }

  // Calculate real average rating from genuine student submissions
  const sumRatings = reviews.reduce((acc, r) => acc + r.rating, 0);
  const realAverage = (sumRatings / reviews.length).toFixed(1);

  // Build a perpetual, seamless track that NEVER goes blank regardless of screen width.
  // Each set (setA and setB) is duplicated to contain at least 8 items.
  const displayReviews = useMemo(() => {
    if (reviews.length === 0) return [];
    let setA: UnifiedReviewItem[] = [];
    while (setA.length < 8) {
      setA = [...setA, ...reviews];
    }
    // setB is an exact mirror of setA so translateX(-50%) creates a seamless, mathematically identical loop
    return [...setA, ...setA];
  }, [reviews]);

  return (
    <div className="relative py-4 select-none">
      {/* Top Controls Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200/90 px-2.5 py-1 rounded-full text-xs font-black shadow-2xs">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
            <span>{realAverage} / 5.0</span>
          </div>
          <span className="text-xs font-semibold text-slate-600">
            Based on {reviews.length} real student {reviews.length === 1 ? 'review' : 'reviews'}
          </span>
        </div>

        {reviews.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleManualScroll('left')}
              className="p-2 rounded-xl bg-white/90 hover:bg-pink-50 text-slate-700 border border-pink-200/80 shadow-2xs hover:border-pink-300 transition-colors cursor-pointer active:scale-95"
              title="Scroll left"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleManualScroll('right')}
              className="p-2 rounded-xl bg-white/90 hover:bg-pink-50 text-slate-700 border border-pink-200/80 shadow-2xs hover:border-pink-300 transition-colors cursor-pointer active:scale-95"
              title="Scroll right"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Overflow wrapper */}
      <div
        ref={scrollContainerRef}
        className="w-full overflow-x-auto no-scrollbar py-2"
      >
        <div className="animate-marquee-reviews flex gap-4 hover:[animation-play-state:paused]">
          {displayReviews.map((item, idx) => {
            const studentInitial = item.studentName.charAt(0).toUpperCase() || 'S';

            return (
              <div
                key={`${item.id}-${idx}`}
                onClick={onGetStarted}
                className="w-80 sm:w-92 md:w-[380px] min-w-[320px] sm:min-w-[360px] rounded-3xl bg-white/95 backdrop-blur-md border border-pink-100/90 hover:border-pink-300 p-5 shrink-0 shadow-2xs hover:shadow-lg shadow-pink-500/5 transition-all duration-200 flex flex-col justify-between cursor-pointer group hover:-translate-y-1 relative overflow-hidden"
              >
                {/* Top ambient color bar */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-400 opacity-80" />

                {/* Top Section: Stars, Date, and Category */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= item.rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-200 fill-slate-100'
                          }`}
                        />
                      ))}
                    </div>

                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{formatReviewDate(item.ratedAt)}</span>
                    </span>
                  </div>

                  {/* Feedback Quote */}
                  <div className="relative pt-1">
                    <Quote className="w-5 h-5 text-pink-300 opacity-70 absolute -top-1 -left-1 pointer-events-none" />
                    <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed italic pl-5 line-clamp-4 min-h-[56px]">
                      {item.ratingFeedback ? `"${item.ratingFeedback}"` : 'Student provided a 5-star rating for their consultation session.'}
                    </p>
                  </div>

                  {/* Appreciation Tag Badges */}
                  {item.ratingTags && item.ratingTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.ratingTags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-bold text-pink-700 bg-pink-50/90 border border-pink-100 px-2 py-0.5 rounded-md"
                        >
                          ✓ {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Section: Student Info & Advised By Counselor */}
                <div className="pt-3 border-t border-pink-100/80 mt-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    {/* Student Info */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.studentAvatarUrl ? (
                        <img
                          src={item.studentAvatarUrl}
                          alt={item.studentName}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-white font-bold text-xs flex items-center justify-center font-bold shrink-0 shadow-2xs">
                          {studentInitial}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {item.studentName}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {item.studentQualification}
                        </p>
                      </div>
                    </div>

                    {/* Category pill */}
                    <span className="text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md truncate max-w-[130px] shrink-0">
                      {item.categoryName}
                    </span>
                  </div>

                  {/* Counselor / Platform Callout */}
                  <div className="bg-pink-50/60 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px] text-pink-900/80">
                    <span className="text-[10px] font-medium text-slate-500 truncate">
                      {item.categoryName === 'Career Code LMS' ? (
                        <>Overall: <strong className="text-pink-950 font-bold">Career Code LMS</strong></>
                      ) : (
                        <>Advised by: <strong className="text-pink-950 font-bold">{item.expertName}</strong></>
                      )}
                    </span>
                    <span className="text-[10px] font-bold text-pink-600 group-hover:underline shrink-0 ml-2">
                      {item.categoryName === 'Career Code LMS' ? 'Get Started →' : 'Ask Advice →'}
                    </span>
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
