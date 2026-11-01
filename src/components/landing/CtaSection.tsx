import React from 'react';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface CtaSectionProps {
  onGetStarted: () => void;
}

export const CtaSection: React.FC<CtaSectionProps> = ({ onGetStarted }) => {
  return (
    <section className="py-14 sm:py-18 lg:py-24 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative">
          {/* Soft Pink Glow Halo behind CTA banner */}
          <div className="absolute -inset-4 bg-gradient-to-r from-pink-400/30 via-rose-300/30 to-purple-400/25 blur-3xl rounded-3xl -z-10 pointer-events-none" />

          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-700 text-white p-8 sm:p-12 lg:p-14 text-center shadow-xl shadow-pink-600/20 border border-white/20">
            {/* Subtle Ambient Shapes */}
            <div className="absolute -top-12 -right-12 w-80 h-80 bg-white/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-80 h-80 bg-purple-950/25 rounded-full blur-2xl pointer-events-none" />

          <div className="relative max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-bold text-pink-100 tracking-wider uppercase border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-pink-200" />
              <span>JOIN CAREER CODE TODAY</span>
            </div>

            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Ready to Plan Your Next Step?
            </h2>

            <p className="text-sm sm:text-base text-pink-100 leading-relaxed">
              Join Career Code and connect with mentors who can help you explore your educational and career options.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={onGetStarted}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white hover:bg-pink-50 text-pink-700 font-extrabold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
              >
                <span>Get Started — It's Free</span>
                <ArrowRight className="w-4 h-4 text-pink-600" />
              </button>
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-pink-200 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-pink-300" />
                No fees or hidden charges
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-pink-300" />
                Verified Pakistani students & mentors
              </span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
};
