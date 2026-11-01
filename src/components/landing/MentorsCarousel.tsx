import React, { useRef } from 'react';
import { User, ChevronLeft, ChevronRight, Sparkles, Star } from 'lucide-react';
import { PublicMentor } from '../../types/landing';

interface MentorsCarouselProps {
  mentors: PublicMentor[];
  loading?: boolean;
  onGetStarted: () => void;
}

export const MentorsCarousel: React.FC<MentorsCarouselProps> = ({
  mentors,
  loading = false,
  onGetStarted,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleManualScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 360;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Duplicate items for the infinite loop animation track
  // Each set is padded to at least 8 items so translateX(-50%) never leaves blank space on any screen
  const displayMentors = React.useMemo(() => {
    if (mentors.length === 0) return [];
    let setA = [...mentors];
    while (setA.length < 8) {
      setA = [...setA, ...mentors];
    }
    return [...setA, ...setA];
  }, [mentors]);

  return (
    <div className="relative py-4">
      {/* Carousel Controls (Arrows for manual override & touch) */}
      <div className="flex items-center justify-between mb-4 px-2">
        <span className="text-xs font-semibold text-slate-500">
          Showing {mentors.length} Verified Mentors
        </span>

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
      </div>

      {/* Overflow wrapper */}
      <div
        ref={scrollContainerRef}
        className="w-full overflow-x-auto no-scrollbar py-2"
      >
        {loading ? (
          /* Loading Skeletons */
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-80 sm:w-88 md:w-96 min-w-[320px] sm:min-w-[350px] h-72 rounded-2xl bg-white border border-slate-200 p-5 shrink-0 animate-pulse space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-200" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-200 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-16 bg-slate-100 rounded-xl" />
                <div className="h-4 bg-slate-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : mentors.length === 0 ? (
          <div className="text-center p-8 bg-white border border-slate-200 rounded-2xl text-slate-500 text-xs">
            No active mentors loaded.
          </div>
        ) : (
          /* Continuous Moving Carousel Track */
          <div className="animate-marquee flex gap-4 hover:[animation-play-state:paused]">
            {displayMentors.map((mentor, index) => {
              const initials = mentor.displayName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'M';

              return (
                <div
                  key={`${mentor.uid}-${index}`}
                  onClick={onGetStarted}
                  className="w-80 sm:w-88 md:w-96 min-w-[320px] sm:min-w-[350px] rounded-2xl bg-white/90 backdrop-blur-md border border-pink-100/90 hover:border-pink-300 p-5 shrink-0 shadow-2xs hover:shadow-md shadow-pink-500/5 transition-all duration-200 flex flex-col justify-between cursor-pointer group hover:-translate-y-1"
                >
                  {/* Top: Avatar, Full Name & Title */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3.5">
                      {mentor.photoURL ? (
                        <img
                          src={mentor.photoURL}
                          alt={mentor.displayName}
                          className="w-12 h-12 rounded-full object-cover border-2 border-pink-200 shadow-2xs shrink-0 group-hover:border-pink-400 transition-colors"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 to-rose-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                          {initials}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        {/* Full Name & Founder Badge (Never truncated) */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 break-words whitespace-normal group-hover:text-pink-700 transition-colors leading-snug">
                            {mentor.displayName}
                          </h4>
                          {mentor.isFounder && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-pink-100 text-pink-800 uppercase tracking-wider shrink-0 border border-pink-200">
                              Founder
                            </span>
                          )}
                        </div>

                        {/* Professional Title (Full, wraps cleanly) */}
                        <p className="text-xs font-semibold text-pink-700 break-words whitespace-normal mt-0.5 leading-snug">
                          {mentor.professionalTitle}
                        </p>

                        {/* Star Rating Badge on Dedicated Row */}
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          {Number(mentor.ratingCount) > 0 ? (
                            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50/90 border border-amber-200/90 px-2 py-0.5 rounded-full shadow-2xs">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                              <span>{(mentor.averageRating || 5.0).toFixed(1)}</span>
                              <span className="text-[10px] text-amber-600 font-normal">
                                ({mentor.ratingCount} {mentor.ratingCount === 1 ? 'review' : 'reviews'})
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center text-[10px] font-medium text-slate-500 bg-slate-100/90 border border-slate-200/80 px-2 py-0.5 rounded-full">
                              <span>Not yet rated</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 min-h-[48px]">
                      {mentor.shortDescription}
                    </p>
                  </div>

                  {/* Bottom: Category Tags & Action */}
                  <div className="pt-3 border-t border-pink-100/70 mt-3 space-y-2">
                    {mentor.categories && mentor.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-14 overflow-hidden">
                        {mentor.categories.slice(0, 3).map((cat) => (
                          <span
                            key={cat.id}
                            className="text-[10px] font-semibold text-slate-700 bg-white/90 border border-pink-100/90 px-2 py-0.5 rounded-md break-words whitespace-normal shadow-2xs"
                          >
                            {cat.name}
                          </span>
                        ))}
                        {mentor.categories.length > 3 && (
                          <span className="text-[10px] font-semibold text-pink-600 self-center">
                            +{mentor.categories.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 block">General Career Counseling</span>
                    )}

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      {Number(mentor.ratingCount) > 0 ? (
                        <span className="text-slate-700 font-semibold flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                          <span>
                            {(mentor.averageRating || 5.0).toFixed(1)} ({mentor.ratingCount} {mentor.ratingCount === 1 ? 'review' : 'reviews'})
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-medium">
                          Not yet rated
                        </span>
                      )}
                      <span className="font-bold text-pink-600 group-hover:text-pink-700 transition-colors">
                        Connect →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
