import React from 'react';
import { ExternalLink, Play, MessageCircle, Instagram } from 'lucide-react';
import { SocialChannel } from '../../types/landing';

export const SocialsSection: React.FC = () => {
  const socials: SocialChannel[] = [
    {
      name: 'YouTube',
      subtitle: 'Video lectures, entry-test guides & webinars',
      handle: 'Prep Titans',
      url: 'https://www.youtube.com/@preptitans',
      icon: 'youtube',
      badge: 'Video Channel',
      color: 'hover:border-red-400 group-hover:text-red-600',
      accentBg: 'bg-red-50 text-red-600 border-red-200',
    },
    {
      name: 'X (Twitter)',
      subtitle: 'Official announcements, alerts & scholarship news',
      handle: 'Prep Titans',
      url: 'https://x.com/preptitans',
      icon: 'x',
      badge: 'Official Updates',
      color: 'hover:border-slate-800 group-hover:text-slate-900',
      accentBg: 'bg-slate-100 text-slate-800 border-slate-300',
    },
    {
      name: 'Instagram',
      subtitle: 'Career tips, admission deadlines & student stories',
      handle: 'Career Code by Prep Titans',
      url: 'https://www.instagram.com/careercode_by_preptitans',
      icon: 'instagram',
      badge: 'Student Community',
      color: 'hover:border-pink-400 group-hover:text-pink-600',
      accentBg: 'bg-pink-50 text-pink-600 border-pink-200',
    },
    {
      name: 'WhatsApp Channel',
      subtitle: 'Direct daily career broadcasts, schemes & opportunities',
      handle: 'Prep Titans',
      url: 'https://whatsapp.com/channel/0029Vb5Ezy03gvWgtepBtW0u',
      icon: 'whatsapp',
      badge: 'Broadcast Channel',
      color: 'hover:border-emerald-400 group-hover:text-emerald-600',
      accentBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
  ];

  return (
    <section id="socials" className="py-14 sm:py-18 lg:py-24 relative overflow-hidden">
      {/* Soft Ambient Floating Glow */}
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-80 h-80 bg-gradient-to-tl from-pink-200/30 via-rose-100/25 to-transparent blur-3xl rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-700 uppercase tracking-widest bg-white/80 backdrop-blur-xs border border-pink-200/80 px-3.5 py-1 rounded-full shadow-2xs">
            <span>OFFICIAL CHANNELS</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Stay Connected with Prep Titans
          </h2>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Follow our channels for educational updates, career guidance, entry-test resources, scholarships, and new opportunities.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {socials.map((s, idx) => (
            <a
              key={idx}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`bg-white/85 backdrop-blur-md rounded-2xl p-6 border border-pink-100/90 shadow-2xs hover:shadow-md shadow-pink-500/5 hover:border-pink-300 transition-all duration-200 flex flex-col justify-between group cursor-pointer hover:-translate-y-1 ${s.color}`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-xl bg-white/90 flex items-center justify-center border border-pink-100/80 group-hover:scale-105 transition-transform shadow-2xs">
                    {s.icon === 'youtube' && (
                      <span className="font-black text-red-600 text-lg">▶</span>
                    )}
                    {s.icon === 'x' && (
                      <span className="font-extrabold text-slate-900 text-lg">𝕏</span>
                    )}
                    {s.icon === 'instagram' && (
                      <Instagram className="w-5 h-5 text-pink-600" />
                    )}
                    {s.icon === 'whatsapp' && (
                      <MessageCircle className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${s.accentBg}`}>
                    {s.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-pink-700 transition-colors">
                    {s.name}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    {s.handle}
                  </p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {s.subtitle}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-bold text-slate-700 group-hover:text-pink-600 transition-colors">
                <span>Visit Channel</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};
