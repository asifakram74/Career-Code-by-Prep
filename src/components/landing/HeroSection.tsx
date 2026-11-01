import React from 'react';
import { ArrowRight, GraduationCap, Sparkles, CheckCircle2, BookOpen, ShieldCheck, Star } from 'lucide-react';

interface HeroSectionProps {
  onGetStarted: () => void;
  onExploreMentors: () => void;
  onSubmitReview?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onGetStarted,
  onExploreMentors,
  onSubmitReview,
}) => {
  return (
    <section id="hero" className="relative pt-6 pb-12 sm:pt-10 sm:pb-16 lg:pt-14 lg:pb-20 overflow-hidden">
      {/* Background Soft Flowing Pastel Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none -z-10">
        <div className="absolute top-6 left-1/4 w-80 sm:w-[28rem] h-80 sm:h-[28rem] bg-gradient-to-br from-pink-300/35 to-rose-200/25 rounded-full blur-3xl opacity-80 animate-float-slow" />
        <div className="absolute top-16 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-gradient-to-bl from-purple-200/30 to-pink-200/30 rounded-full blur-3xl opacity-70 animate-float-slow [animation-delay:3s]" />
        <div className="absolute bottom-2 left-1/3 w-64 h-64 bg-rose-200/25 rounded-full blur-2xl opacity-60" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Heading, Description, and CTAs */}
          <div className="lg:col-span-7 text-center lg:text-left space-y-5">
            {/* Small Label with Dot Separators */}
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-pink-700 uppercase bg-white/80 backdrop-blur-xs border border-pink-200/80 px-3.5 py-1.5 rounded-full shadow-2xs">
              <span>CAREER GUIDANCE</span>
              <span className="w-1 h-1 rounded-full bg-pink-400" aria-hidden="true" />
              <span>MENTORSHIP</span>
              <span className="w-1 h-1 rounded-full bg-pink-400" aria-hidden="true" />
              <span>OPPORTUNITIES</span>
            </div>

            {/* Main Heading with Soft Pink Glow Halo */}
            <div className="relative">
              <div className="absolute -inset-x-6 -inset-y-3 bg-gradient-to-r from-pink-300/35 via-rose-200/30 to-purple-200/20 blur-2xl rounded-3xl -z-10 pointer-events-none opacity-80" />
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
                Your Career. Your Future.{' '}
                <span className="bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 bg-clip-text text-transparent">
                  The Right Guidance.
                </span>
              </h1>
            </div>

            {/* Supporting Description */}
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Career Code connects Pakistani students with experienced students and mentors who help them explore degree options, university admissions, entry tests, scholarships, and career pathways.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
              <button
                type="button"
                onClick={onGetStarted}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onExploreMentors}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/90 hover:bg-pink-50/70 text-slate-800 border border-pink-200 hover:border-pink-300 font-bold text-sm shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              >
                <span>Meet Our Mentors</span>
              </button>

              {onSubmitReview && (
                <button
                  type="button"
                  onClick={onSubmitReview}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-rose-50 hover:from-amber-100 hover:to-rose-100 text-amber-900 border border-amber-200/90 hover:border-amber-300 font-bold text-sm shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                >
                  <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                  <span>Submit a Review</span>
                </button>
              )}
            </div>

            {/* Small Supporting Line */}
            <p className="text-xs text-slate-500 max-w-xl mx-auto lg:mx-0 pt-1">
              From choosing your field to planning your next step, get guidance from people who understand the journey.
            </p>
          </div>

          {/* Right Column: Visual Education & Mentorship Card with Soft Pink Glow Halo */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md">
              {/* Soft Pink Glow Halo behind card */}
              <div className="absolute -inset-3 bg-gradient-to-tr from-pink-400/25 via-rose-300/20 to-purple-300/20 blur-2xl rounded-3xl -z-10 pointer-events-none opacity-90" />

              <div className="relative w-full bg-white/85 backdrop-blur-md border border-pink-200/80 rounded-3xl p-6 shadow-md shadow-pink-500/5 hover:shadow-lg hover:border-pink-300 transition-all">
                {/* Card Header Badge */}
                <div className="flex items-center justify-between pb-4 border-b border-pink-100/70">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center shadow-2xs">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Career Code Ecosystem</h3>
                      <p className="text-[10px] text-slate-500">Mentorship across Pakistan</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    24+ Mentors Active
                  </span>
                </div>

                {/* Pathway Highlights */}
                <div className="py-4 space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/70 border border-pink-100/80 shadow-2xs">
                    <div className="w-7 h-7 rounded-lg bg-pink-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">University Admissions & LAT / MDCAT</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Guidance for public & private university admissions across all provinces.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/70 border border-purple-100/80 shadow-2xs">
                    <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">CA, ACCA, CS, AI & Allied Health</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Field-specific roadmaps directly from students pursuing these degrees.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/70 border border-blue-100/80 shadow-2xs">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Scholarships & Government Schemes</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Assistance with HEC, PEEF, laptop schemes, and need-based financial aid.</p>
                    </div>
                  </div>
                </div>

                {/* Card Footer Live Activity Metric */}
                <div className="pt-3 border-t border-pink-100/70 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Direct 1-on-1 Student Chats</span>
                  <span className="font-semibold text-pink-700">100% Free Mentorship</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
