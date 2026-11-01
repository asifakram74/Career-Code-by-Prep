import React, { useState, useEffect } from 'react';
import { Menu, X, ArrowRight, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CareerCodeLogo } from '../common/CareerCodeLogo';

interface LandingNavbarProps {
  onSignIn: () => void;
  onGetStarted: () => void;
  onGoToDashboard?: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({
  onSignIn,
  onGetStarted,
  onGoToDashboard,
}) => {
  const { userProfile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 py-3.5 sm:py-4 ${
        isScrolled
          ? 'bg-white/85 backdrop-blur-md border-b border-pink-200/70 shadow-xs shadow-pink-500/5'
          : 'bg-white/30 backdrop-blur-xs border-b border-pink-100/40'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Left: Brand Logo & Subtitle */}
          <a
            href="#hero"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('hero');
            }}
            className="flex items-center gap-2.5 group cursor-pointer focus-visible:outline-pink-600 rounded-lg"
          >
            <CareerCodeLogo size="md" className="group-hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 group-hover:text-pink-700 transition-colors">
                Career Code
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 -mt-1 tracking-wide">
                By Prep Titans
              </span>
            </div>
          </a>

          {/* Center/Right Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => scrollToSection('hero')}
              className="hover:text-pink-700 transition-colors cursor-pointer py-1"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('mentors')}
              className="hover:text-pink-700 transition-colors cursor-pointer py-1"
            >
              Our Mentors
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('reviews')}
              className="hover:text-pink-700 transition-colors cursor-pointer py-1"
            >
              Reviews
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('about')}
              className="hover:text-pink-700 transition-colors cursor-pointer py-1"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('socials')}
              className="hover:text-pink-700 transition-colors cursor-pointer py-1"
            >
              Socials
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {userProfile ? (
              <button
                type="button"
                onClick={onGoToDashboard}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <User className="w-3.5 h-3.5" />
                <span>Go to Dashboard</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-pink-700 hover:bg-pink-50/60 rounded-xl transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-700 hover:text-pink-700 hover:bg-pink-50 rounded-xl transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 p-4 bg-white/95 backdrop-blur-xl rounded-2xl border border-pink-200/80 shadow-xl shadow-pink-500/10 space-y-3 animate-pop-in origin-top">
            <nav className="flex flex-col space-y-2 text-xs font-semibold text-slate-700">
              <button
                type="button"
                onClick={() => scrollToSection('hero')}
                className="text-left px-3 py-2 rounded-lg hover:bg-pink-50 hover:text-pink-700 transition-colors"
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('mentors')}
                className="text-left px-3 py-2 rounded-lg hover:bg-pink-50 hover:text-pink-700 transition-colors"
              >
                Our Mentors
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('reviews')}
                className="text-left px-3 py-2 rounded-lg hover:bg-pink-50 hover:text-pink-700 transition-colors"
              >
                Student Reviews
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('about')}
                className="text-left px-3 py-2 rounded-lg hover:bg-pink-50 hover:text-pink-700 transition-colors"
              >
                About
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('socials')}
                className="text-left px-3 py-2 rounded-lg hover:bg-pink-50 hover:text-pink-700 transition-colors"
              >
                Socials
              </button>
            </nav>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              {userProfile ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onGoToDashboard) onGoToDashboard();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-pink-50 text-pink-700 border border-pink-200 text-xs font-bold text-center"
                >
                  Go to Dashboard
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSignIn();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold text-center hover:bg-slate-200 transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onGetStarted();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white text-xs font-bold text-center shadow-xs"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
