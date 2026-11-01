import React from 'react';
import { Users2, Compass, CheckCircle2 } from 'lucide-react';

export const AboutSection: React.FC = () => {
  const benefits = [
    {
      title: 'Guidance from Mentors',
      description: 'Connect with people who understand different academic fields.',
      icon: Users2,
      accent: 'from-pink-500 to-rose-600',
      badgeBg: 'bg-pink-50 text-pink-700 border-pink-200',
    },
    {
      title: 'Explore Your Options',
      description: 'Learn about degrees, admissions, entry tests, and career pathways.',
      icon: Compass,
      accent: 'from-purple-500 to-indigo-600',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    {
      title: 'Make Informed Decisions',
      description: 'Get relevant guidance instead of relying only on random online advice.',
      icon: CheckCircle2,
      accent: 'from-blue-500 to-cyan-600',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    },
  ];

  return (
    <section id="about" className="py-14 sm:py-18 lg:py-24 relative overflow-hidden bg-gradient-to-b from-pink-50/50 via-rose-50/30 to-pink-50/40 border-y border-pink-200/60">
      {/* Soft Ambient Floating Glow */}
      <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[28rem] h-[28rem] bg-gradient-to-tr from-pink-200/30 via-rose-100/20 to-purple-100/20 blur-3xl rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-700 uppercase tracking-widest bg-white/80 backdrop-blur-xs border border-pink-200/80 px-3.5 py-1 rounded-full shadow-2xs">
            <span>ABOUT THE PLATFORM</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            What Is Career Code?
          </h2>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Career Code is a career guidance and mentorship platform created to help Pakistani students make informed decisions about their education and future. It brings together mentors and students from different academic and professional backgrounds so students can ask questions and explore suitable pathways.
          </p>
        </div>

        {/* 3 Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {benefits.map((b, idx) => {
            const Icon = b.icon;
            return (
              <div
                key={idx}
                className="bg-white/85 backdrop-blur-md rounded-2xl p-6 sm:p-7 border border-pink-100/90 hover:border-pink-300 shadow-2xs hover:shadow-md shadow-pink-500/5 transition-all space-y-3 group hover:-translate-y-1"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${b.accent} text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="text-base font-bold text-slate-900">
                  {b.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {b.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
