import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { PublicMentor } from '../../types/landing';
import { LandingNavbar } from './LandingNavbar';
import { HeroSection } from './HeroSection';
import { FounderHighlight } from './FounderHighlight';
import { MentorsCarousel } from './MentorsCarousel';
import { ReviewsCarousel } from './ReviewsCarousel';
import { AboutSection } from './AboutSection';
import { SocialsSection } from './SocialsSection';
import { CtaSection } from './CtaSection';
import { LandingFooter } from './LandingFooter';
import { SubmitReviewModal } from '../common/SubmitReviewModal';
import { Sparkles, Users, Star } from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  onGetStarted: () => void;
  onGoToDashboard?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  onGetStarted,
  onGoToDashboard,
}) => {
  const [mentors, setMentors] = useState<PublicMentor[]>([]);
  const [founder, setFounder] = useState<PublicMentor | null>(null);
  const [loadingMentors, setLoadingMentors] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPublicMentors() {
      try {
        // 1. Try secure public backend endpoint first
        const res = await fetch('/api/public/mentors');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.mentors) && data.mentors.length > 0) {
            if (!isMounted) return;
            const fetched: PublicMentor[] = data.mentors;
            const f = fetched.find((m) => m.isFounder) || null;
            setFounder(f);
            setMentors(fetched);
            setLoadingMentors(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Backend /api/public/mentors check failed, falling back to direct sanitized Firestore fetch', e);
      }

      // 2. Direct Firestore fallback (Always sanitized, never exposing passwords or sensitive fields)
      try {
        const usersSnap = await getDocs(
          query(collection(db, 'users'), where('role', 'in', ['normal_admin', 'expert_admin', 'super_admin']))
        );
        const categoriesSnap = await getDocs(collection(db, 'categories'));

        const categoryMap: Record<string, string> = {};
        categoriesSnap.docs.forEach((d) => {
          categoryMap[d.id] = d.data().name || d.id;
        });

        const list: PublicMentor[] = [];
        usersSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.status === 'deactivated' || data.isDeactivated === true) return;

          const isFounder =
            (data.displayName || '').toLowerCase().includes('huzaifa') || d.id === 'admin_huzaifa_khalil';

          const catIds = Array.isArray(data.assignedCategories) ? data.assignedCategories : [];
          const categories = catIds
            .filter((cId: string) => cId !== 'cat-admissions' && cId !== 'cat-general-guidance' && Boolean(categoryMap[cId]))
            .map((cId: string) => ({
              id: cId,
              name: categoryMap[cId],
            }));

          list.push({
            uid: d.id,
            displayName: data.displayName || 'Career Mentor',
            professionalTitle: isFounder
              ? 'Founder, Career Code'
              : data.professionalTitle || 'Academic & Career Mentor',
            shortDescription:
              data.shortDescription ||
              data.bio ||
              'Experienced mentor helping Pakistani students explore university admissions and degrees.',
            photoURL: data.photoURL || '',
            role: data.role || 'normal_admin',
            categories,
            isFounder,
            averageRating: typeof data.averageRating === 'number' ? data.averageRating : undefined,
            ratingCount: typeof data.ratingCount === 'number' ? data.ratingCount : 0,
          });
        });

        // Deduplicate by name, keeping founder / complete profiles
        const seen = new Set<string>();
        const deduped: PublicMentor[] = [];
        list.sort((a, b) => {
          if (a.isFounder && !b.isFounder) return -1;
          if (!a.isFounder && b.isFounder) return 1;
          if (a.photoURL && !b.photoURL) return -1;
          if (!a.photoURL && b.photoURL) return 1;
          return (a.displayName || '').localeCompare(b.displayName || '');
        });

        for (const item of list) {
          const key = (item.displayName || '').trim().toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(item);
          }
        }

        if (!isMounted) return;
        const f = deduped.find((m) => m.isFounder) || null;
        setFounder(f);
        setMentors(deduped);
      } catch (err) {
        console.error('Error fetching mentors from Firestore:', err);
      } finally {
        if (isMounted) setLoadingMentors(false);
      }
    }

    loadPublicMentors();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdf2f5] via-[#fff5f8] via-35% via-[#fef7f9] via-70% to-[#fcedf1] text-slate-900 font-sans antialiased selection:bg-pink-100 selection:text-pink-900 overflow-x-hidden relative">
      {/* Ambient Soft Pink Gradient Canvas & Flowing Pastel Color Orbs */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
        {/* Top-left blush-rose flowing orb */}
        <div className="absolute -top-24 -left-20 w-[30rem] sm:w-[42rem] h-[30rem] sm:h-[42rem] rounded-full bg-gradient-to-br from-pink-300/40 via-rose-200/30 to-transparent blur-3xl opacity-80 animate-float-slow" />

        {/* Top-right subtle lavender & soft pink orb */}
        <div className="absolute top-10 -right-24 w-[32rem] sm:w-[44rem] h-[32rem] sm:h-[44rem] rounded-full bg-gradient-to-bl from-purple-200/35 via-pink-200/40 to-rose-100/25 blur-3xl opacity-75 animate-float-slow [animation-delay:4s]" />

        {/* Center ambient glow behind hero & mentors */}
        <div className="absolute top-[25%] left-1/2 -translate-x-1/2 w-[45rem] sm:w-[65rem] h-[32rem] rounded-full bg-gradient-to-r from-pink-200/30 via-rose-100/45 to-purple-100/25 blur-[140px] opacity-70" />

        {/* Mid-page ambient rose/peach orb near About section */}
        <div className="absolute top-[55%] -left-24 w-[28rem] sm:w-[38rem] h-[28rem] rounded-full bg-gradient-to-tr from-pink-300/30 via-rose-200/25 to-transparent blur-3xl opacity-65 animate-float-slow [animation-delay:2s]" />

        {/* Bottom ambient glow near CTA & Socials */}
        <div className="absolute bottom-6 right-0 w-[32rem] sm:w-[46rem] h-[32rem] rounded-full bg-gradient-to-tl from-pink-300/35 via-rose-200/30 to-purple-200/25 blur-[130px] opacity-75" />

        {/* Ultra-delicate micro-dot texture */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(#db2777 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* 1. Public Sticky Navigation Header */}
      <LandingNavbar
        onSignIn={onSignIn}
        onGetStarted={onGetStarted}
        onGoToDashboard={onGoToDashboard}
      />

      {/* 2. Hero Section */}
      <HeroSection
        onGetStarted={onGetStarted}
        onExploreMentors={() => {
          const el = document.getElementById('mentors');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        onSubmitReview={() => setShowReviewModal(true)}
      />

      {/* 3. Our Mentors Section (Founder Highlight + Infinite Moving Horizontal Carousel) */}
      <section id="mentors" className="py-14 sm:py-18 lg:py-22 relative">
        {/* Soft background glow backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pink-100/35 to-transparent -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-700 uppercase tracking-widest bg-white/80 backdrop-blur-xs border border-pink-200/80 px-3.5 py-1 rounded-full shadow-2xs">
              <Users className="w-3.5 h-3.5 text-pink-600" />
              <span>EXPERIENCED MENTORSHIP</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Meet the People Behind Career Code
            </h2>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Real students, experienced mentors, and passionate individuals helping you make more informed educational and career decisions.
            </p>
          </div>

          {/* Founder Highlight: Huzaifa Khalil Ahmed */}
          <div className="max-w-4xl mx-auto">
            <FounderHighlight founder={founder} onGetStarted={onGetStarted} />
          </div>

          {/* Animated Horizontal Mentor Carousel */}
          <MentorsCarousel
            mentors={mentors}
            loading={loadingMentors}
            onGetStarted={onGetStarted}
          />
        </div>
      </section>

      {/* 4. Student Reviews & Ratings Carousel Section */}
      <section id="reviews" className="py-12 sm:py-16 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center max-w-3xl mx-auto space-y-2.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-widest bg-amber-50/90 border border-amber-200/90 px-3.5 py-1 rounded-full shadow-2xs">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span>GENUINE STUDENT FEEDBACK</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              What Students Say About Career Code
            </h2>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Real guidance reviews, ratings, and genuine feedback from students who resolved their career & university admission queries with our verified counselors.
            </p>
          </div>

          <ReviewsCarousel onGetStarted={onGetStarted} />
        </div>
      </section>

      {/* 5. About Career Code Section */}
      <AboutSection />

      {/* 5. Follow & Subscribe (4 Verified Prep Titans Channels) */}
      <SocialsSection />

      {/* 6. Final Call to Action */}
      <CtaSection onGetStarted={onGetStarted} />

      {/* 7. Footer */}
      <LandingFooter onSignIn={onSignIn} onRegister={onGetStarted} />

      {/* Review Submission Modal */}
      <SubmitReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
      />
    </div>
  );
};
