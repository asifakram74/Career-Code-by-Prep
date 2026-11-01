import React from 'react';
import { Award, Sparkles, CheckCircle2, Star } from 'lucide-react';
import { PublicMentor } from '../../types/landing';

interface FounderHighlightProps {
  founder?: PublicMentor | null;
  onGetStarted: () => void;
}

export const FounderHighlight: React.FC<FounderHighlightProps> = ({
  founder,
  onGetStarted,
}) => {
  const name = founder?.displayName || 'Huzaifa Khalil Ahmed';
  const role = 'Founder, Career Code';
  const description =
    'Building a student-focused platform that connects Pakistani students with relevant educational guidance, career insights, and mentorship.';
  const photoURL = founder?.photoURL;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white/85 backdrop-blur-md border border-pink-200/90 p-6 sm:p-8 shadow-sm shadow-pink-500/5 hover:shadow-md hover:border-pink-300 transition-all">
      {/* Decorative ambient corner glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-pink-300/30 via-purple-200/20 to-transparent rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-6 w-48 h-48 bg-gradient-to-tr from-rose-200/25 to-transparent rounded-full blur-xl pointer-events-none" />

      <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6">
        {/* Founder Avatar with Founder Badge */}
        <div className="relative shrink-0">
          {photoURL ? (
            <img
              src={photoURL}
              alt={name}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-pink-300 shadow-md"
            />
          ) : (
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-600 to-purple-700 text-white flex items-center justify-center font-extrabold text-2xl sm:text-3xl shadow-md border-2 border-pink-200">
              HK
            </div>
          )}

          {/* Verified Founder Badge Pin */}
          <div
            className="absolute -bottom-2 -right-2 bg-pink-600 text-white p-1.5 rounded-xl shadow-sm border border-white"
            title="Founder of Career Code"
          >
            <Award className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Founder Content */}
        <div className="flex-1 text-center md:text-left space-y-2.5">
          <div className="flex flex-col md:flex-row md:items-center gap-2 justify-between">
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-pink-700 bg-pink-100/70 border border-pink-200/80 px-2.5 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3 text-pink-600" />
                  <span>Leadership</span>
                </div>
                {founder && Number(founder.ratingCount) > 0 ? (
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full shadow-2xs">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                    <span>
                      {(founder.averageRating || 5.0).toFixed(1)} ({founder.ratingCount} {founder.ratingCount === 1 ? 'review' : 'reviews'})
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-full">
                    <span>Not yet rated</span>
                  </div>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight break-words">
                {name}
              </h3>
              <p className="text-xs sm:text-sm font-bold text-pink-700 break-words">
                {role}
              </p>
            </div>

            <button
              type="button"
              onClick={onGetStarted}
              className="self-center md:self-auto px-4 py-2 bg-white hover:bg-pink-50 text-pink-700 border border-pink-200 hover:border-pink-300 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              Ask Huzaifa a Query
            </button>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
            {description}
          </p>

          {/* Mentor Categories */}
          {founder?.categories && founder.categories.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-1.5">
              <span className="text-[11px] font-medium text-slate-400 mr-1">Mentoring in:</span>
              {founder.categories.map((c) => (
                <span
                  key={c.id}
                  className="text-[10px] font-semibold text-slate-700 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs"
                >
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
