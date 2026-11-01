import React from 'react';
import { ExternalLink } from 'lucide-react';
import { CareerCodeLogo } from '../common/CareerCodeLogo';

interface LandingFooterProps {
  onSignIn: () => void;
  onRegister: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({
  onSignIn,
  onRegister,
}) => {
  const currentYear = new Date().getFullYear();

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <footer className="bg-gradient-to-b from-[#1c1224] to-[#110918] text-slate-300 py-12 sm:py-14 border-t border-pink-900/40 relative overflow-hidden">
      {/* Subtle top ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-pink-500/40 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-36 bg-pink-500/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-pink-950/60">
          {/* Brand & Description */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <CareerCodeLogo size="sm" className="border-pink-500/40" />
              <div>
                <span className="font-extrabold text-base text-white">Career Code</span>
                <span className="text-xs text-slate-400 block -mt-1">By Prep Titans</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Connecting Pakistani students with experienced mentors for personalized guidance on admissions, degrees, scholarships, entry tests, and career opportunities.
            </p>
          </div>

          {/* Quick Platform Links */}
          <div className="md:col-span-3 space-y-2.5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Quick Navigation</h4>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo('hero')}
                  className="hover:text-pink-400 transition-colors cursor-pointer"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo('mentors')}
                  className="hover:text-pink-400 transition-colors cursor-pointer"
                >
                  Our Mentors
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo('about')}
                  className="hover:text-pink-400 transition-colors cursor-pointer"
                >
                  About Career Code
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="hover:text-pink-400 transition-colors cursor-pointer font-semibold text-slate-300"
                >
                  Sign In
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onRegister}
                  className="hover:text-pink-400 transition-colors cursor-pointer font-semibold text-pink-400"
                >
                  Register Account
                </button>
              </li>
            </ul>
          </div>

          {/* Verified Prep Titans Social Channels */}
          <div className="md:col-span-4 space-y-2.5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Verified Social Channels</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a
                  href="https://www.youtube.com/@preptitans"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-red-400 transition-colors"
                >
                  <span>YouTube — Prep Titans</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/preptitans"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <span>X (Twitter) — Prep Titans</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/careercode_by_preptitans"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-pink-400 transition-colors"
                >
                  <span>Instagram — Career Code by Prep Titans</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://whatsapp.com/channel/0029Vb5Ezy03gvWgtepBtW0u"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
                >
                  <span>WhatsApp Channel — Prep Titans</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar with Dynamic Year */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <p>© {currentYear} Career Code by Prep Titans. All rights reserved.</p>
          <p className="text-[11px]">Empowering Pakistani students through real mentorship.</p>
        </div>
      </div>
    </footer>
  );
};
