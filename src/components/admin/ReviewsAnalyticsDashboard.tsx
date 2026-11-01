import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { useAuth } from '../../context/AuthContext';
import { QueryTicket, UserProfile } from '../../types';
import { subscribeToUnifiedReviews, unifiedReviewToTicket } from '../../lib/reviewService';
import {
  Star,
  Users,
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  TrendingUp,
  Award,
  Sparkles,
  Quote,
  Clock,
  ArrowUpDown,
  ThumbsUp,
  Tag,
  ExternalLink,
  RefreshCw,
  X,
  UserCheck,
} from 'lucide-react';

interface ReviewsAnalyticsDashboardProps {
  onOpenTicket?: (ticket: QueryTicket) => void;
  onNavigateTab?: (tab: string) => void;
}

export const ReviewsAnalyticsDashboard: React.FC<ReviewsAnalyticsDashboardProps> = ({
  onOpenTicket,
  onNavigateTab,
}) => {
  const { userProfile } = useAuth();
  const [tickets, setTickets] = useState<QueryTicket[]>([]);
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAdminId, setSelectedAdminId] = useState<string>('all');
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | 'all' | 'with_feedback'>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

  // Real-time listener for unified reviews (perfectly in sync with Landing Page)
  useEffect(() => {
    const unsubReviews = subscribeToUnifiedReviews(
      (unifiedList) => {
        setTickets(unifiedList.map(unifiedReviewToTicket));
        setLoading(false);
      },
      (error) => {
        console.warn('ReviewsAnalyticsDashboard reviews error:', error);
        setLoading(false);
      }
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const adminList: UserProfile[] = [];
        snapshot.forEach((d) => {
          const u = { uid: d.id, ...d.data() } as UserProfile;
          if (['normal_admin', 'expert_admin', 'super_admin'].includes(u.role)) {
            adminList.push(u);
          }
        });
        adminList.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        setAdmins(adminList);
      },
      (error) => {
        console.warn('Error fetching admins:', error);
      }
    );

    return () => {
      unsubReviews();
      unsubUsers();
    };
  }, []);

  // Compute Overall Platform Metrics
  const metrics = useMemo(() => {
    const totalRatings = tickets.length;
    if (totalRatings === 0) {
      return {
        totalRatings: 0,
        averageRating: 0,
        withFeedbackCount: 0,
        feedbackPercentage: 0,
        satisfactionRate: 0,
        starCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>,
        starPercentages: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>,
        topTags: [] as { tag: string; count: number }[],
      };
    }

    let sum = 0;
    let withFeedback = 0;
    let highRatings = 0; // 4 or 5 stars
    const starCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const tagMap: Record<string, number> = {};

    tickets.forEach((t) => {
      const r = Math.min(5, Math.max(1, Math.round(t.rating || 0)));
      sum += r;
      starCounts[r] = (starCounts[r] || 0) + 1;
      if (r >= 4) highRatings++;
      if (t.ratingFeedback && t.ratingFeedback.trim().length > 0) withFeedback++;

      if (Array.isArray(t.ratingTags)) {
        t.ratingTags.forEach((tag) => {
          const clean = tag.trim();
          if (clean) {
            tagMap[clean] = (tagMap[clean] || 0) + 1;
          }
        });
      }
    });

    const averageRating = Math.round((sum / totalRatings) * 10) / 10;
    const satisfactionRate = Math.round((highRatings / totalRatings) * 100);
    const feedbackPercentage = Math.round((withFeedback / totalRatings) * 100);

    const starPercentages: Record<number, number> = {
      5: Math.round(((starCounts[5] || 0) / totalRatings) * 100),
      4: Math.round(((starCounts[4] || 0) / totalRatings) * 100),
      3: Math.round(((starCounts[3] || 0) / totalRatings) * 100),
      2: Math.round(((starCounts[2] || 0) / totalRatings) * 100),
      1: Math.round(((starCounts[1] || 0) / totalRatings) * 100),
    };

    const topTags = Object.entries(tagMap)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalRatings,
      averageRating,
      withFeedbackCount: withFeedback,
      feedbackPercentage,
      satisfactionRate,
      starCounts,
      starPercentages,
      topTags,
    };
  }, [tickets]);

  // Compute Admin-Specific Analytics
  const adminStats = useMemo(() => {
    return admins.map((admin) => {
      const adminTickets = tickets.filter(
        (t) =>
          t.expertId === admin.uid ||
          t.assignedAdminId === admin.uid ||
          (t.expertEmail && admin.email && t.expertEmail.toLowerCase() === admin.email.toLowerCase())
      );

      const count = adminTickets.length;
      let sum = 0;
      let fiveStars = 0;
      let fourStars = 0;
      const tags: Record<string, number> = {};

      adminTickets.forEach((t) => {
        const r = Math.min(5, Math.max(1, Math.round(t.rating || 0)));
        sum += r;
        if (r === 5) fiveStars++;
        if (r === 4) fourStars++;
        if (Array.isArray(t.ratingTags)) {
          t.ratingTags.forEach((tag) => {
            tags[tag] = (tags[tag] || 0) + 1;
          });
        }
      });

      const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
      const topAdminTag = Object.entries(tags).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

      return {
        admin,
        reviewsCount: count,
        averageRating: avg,
        fiveStarsCount: fiveStars,
        fourStarsCount: fourStars,
        satisfactionRate: count > 0 ? Math.round(((fiveStars + fourStars) / count) * 100) : 0,
        topTag: topAdminTag,
      };
    }).sort((a, b) => {
      // Admins with reviews first, sorted by review count then rating
      if (b.reviewsCount !== a.reviewsCount) {
        return b.reviewsCount - a.reviewsCount;
      }
      return b.averageRating - a.averageRating;
    });
  }, [admins, tickets]);

  // Filtered & Sorted Review Feed
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // 1. Admin filter
      if (selectedAdminId !== 'all') {
        const matchesAdmin =
          t.expertId === selectedAdminId ||
          t.assignedAdminId === selectedAdminId ||
          (t.expertEmail &&
            admins.find((a) => a.uid === selectedAdminId)?.email?.toLowerCase() ===
              t.expertEmail.toLowerCase());
        if (!matchesAdmin) return false;
      }

      // 2. Star filter
      if (selectedStarFilter === 'with_feedback') {
        if (!t.ratingFeedback || t.ratingFeedback.trim().length === 0) return false;
      } else if (typeof selectedStarFilter === 'number') {
        if (Math.round(t.rating || 0) !== selectedStarFilter) return false;
      }

      // 3. Tag filter
      if (selectedTagFilter !== 'all') {
        if (!Array.isArray(t.ratingTags) || !t.ratingTags.includes(selectedTagFilter)) {
          return false;
        }
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const student = (t.studentName || '').toLowerCase();
        const expert = (t.expertName || '').toLowerCase();
        const feedback = (t.ratingFeedback || '').toLowerCase();
        const ticketNum = (t.ticketNumber || '').toLowerCase();
        const category = (t.categoryName || '').toLowerCase();
        const title = (t.title || '').toLowerCase();
        const tags = (t.ratingTags || []).join(' ').toLowerCase();

        return (
          student.includes(q) ||
          expert.includes(q) ||
          feedback.includes(q) ||
          ticketNum.includes(q) ||
          category.includes(q) ||
          title.includes(q) ||
          tags.includes(q)
        );
      }

      return true;
    }).sort((a, b) => {
      const timeA = a.ratedAt || a.updatedAt || a.createdAt;
      const timeB = b.ratedAt || b.updatedAt || b.createdAt;
      const ratingA = a.rating || 0;
      const ratingB = b.rating || 0;

      if (sortBy === 'newest') return timeB - timeA;
      if (sortBy === 'oldest') return timeA - timeB;
      if (sortBy === 'highest') return ratingB - ratingA || timeB - timeA;
      if (sortBy === 'lowest') return ratingA - ratingB || timeB - timeA;
      return 0;
    });
  }, [tickets, selectedAdminId, selectedStarFilter, selectedTagFilter, searchQuery, sortBy, admins]);

  const activeAdminObject = admins.find((a) => a.uid === selectedAdminId);

  const formatReviewDate = (timestamp?: number) => {
    if (!timestamp) return 'Recent';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderStars = (rating: number, size = 'w-4 h-4') => {
    const rounded = Math.min(5, Math.max(1, Math.round(rating)));
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${size} ${
              star <= rounded
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-200 fill-slate-100'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 animate-pulse p-4">
        <div className="h-28 bg-white rounded-3xl border border-slate-100 p-6 flex flex-col justify-center">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-2" />
          <div className="h-4 bg-slate-100 rounded w-1/2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-slate-100 p-4" />
          ))}
        </div>
        <div className="h-96 bg-white rounded-2xl border border-slate-100" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 select-none">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 rounded-3xl p-5 sm:p-7 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 opacity-15 pointer-events-none">
          <Award className="w-56 h-56 text-white" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white mb-2 shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {userProfile?.role === 'student'
                  ? 'Verified Student Reviews & Feedback'
                  : 'Counselor Performance & Ratings'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">
              Student Reviews & Counselor Ratings
            </h1>
            <p className="text-pink-100 text-xs sm:text-sm mt-1 max-w-2xl">
              Real-time student feedback, satisfaction scores, written evaluations, and individual counselor ratings across all academic categories.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <div className="bg-white/15 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] text-pink-200 uppercase font-bold tracking-wider">Overall Rating</p>
                <p className="text-xl font-black text-white">
                  {metrics.totalRatings > 0 ? `${metrics.averageRating} / 5.0` : 'Not yet rated'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-black shadow-md">
                <Star className="w-5 h-5 fill-slate-900" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Platform Summary Metrics & Rating Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Metric Card 1: Score & Satisfaction */}
        <div className="bg-white rounded-3xl p-6 border border-pink-100/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Overall Satisfaction
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {metrics.totalRatings > 0 ? `${metrics.satisfactionRate}% Positive` : 'No reviews yet'}
              </span>
            </div>

            {metrics.totalRatings > 0 ? (
              <div className="flex items-baseline gap-3">
                <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                  {metrics.averageRating.toFixed(1)}
                </span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    {renderStars(metrics.averageRating, 'w-5 h-5')}
                  </div>
                  <span className="text-xs text-slate-500 font-medium mt-1">
                    Based on <strong>{metrics.totalRatings}</strong> student reviews
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-2">
                <p className="text-2xl font-bold text-slate-400">Not yet rated</p>
                <p className="text-xs text-slate-400 mt-1">No student reviews submitted yet</p>
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <p className="text-[11px] text-slate-500 font-medium">With Written Text</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">
                {metrics.withFeedbackCount}{' '}
                <span className="text-xs text-slate-400 font-semibold">({metrics.feedbackPercentage}%)</span>
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <p className="text-[11px] text-slate-500 font-medium">5-Star Reviews</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">
                {metrics.starCounts[5] || 0}{' '}
                <span className="text-xs text-slate-400 font-semibold">
                  ({metrics.starPercentages[5]}%)
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Metric Card 2: Star Breakdown Progress Bars */}
        <div className="bg-white rounded-3xl p-6 border border-pink-100/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Rating Distribution
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Click bar to filter</span>
            </div>

            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = metrics.starCounts[stars] || 0;
                const percentage = metrics.starPercentages[stars] || 0;
                const isSelected = selectedStarFilter === stars;

                return (
                  <button
                    key={stars}
                    type="button"
                    onClick={() =>
                      setSelectedStarFilter(isSelected ? 'all' : (stars as any))
                    }
                    className={`w-full group flex items-center gap-3 p-1 rounded-xl transition-colors cursor-pointer ${
                      isSelected ? 'bg-pink-50 ring-1 ring-pink-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1 w-12 shrink-0">
                      <span className="text-xs font-bold text-slate-700">{stars}</span>
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    </div>

                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          stars >= 4
                            ? 'bg-emerald-500'
                            : stars === 3
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="w-16 text-right shrink-0">
                      <span className="text-xs font-bold text-slate-800">{count}</span>
                      <span className="text-[10px] text-slate-400 ml-1">({percentage}%)</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedStarFilter !== 'all' && (
            <div className="mt-3 pt-2 flex items-center justify-between">
              <span className="text-xs text-pink-700 font-semibold">
                Filter active: {selectedStarFilter} Stars
              </span>
              <button
                type="button"
                onClick={() => setSelectedStarFilter('all')}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Metric Card 3: Top Student Tags / Quality Badges */}
        <div className="bg-white rounded-3xl p-6 border border-pink-100/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Top Student Appreciations
              </span>
              <ThumbsUp className="w-4 h-4 text-pink-500" />
            </div>

            {metrics.topTags.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                No tags recorded yet from students.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {metrics.topTags.map((item) => {
                  const isSelected = selectedTagFilter === item.tag;
                  return (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() =>
                        setSelectedTagFilter(isSelected ? 'all' : item.tag)
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-pink-600 text-white shadow-xs'
                          : 'bg-pink-50 text-pink-700 hover:bg-pink-100/70 border border-pink-100'
                      }`}
                    >
                      <Tag className="w-3 h-3" />
                      <span>{item.tag}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                          isSelected ? 'bg-pink-700 text-white' : 'bg-white text-pink-800 border border-pink-200'
                        }`}
                      >
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedTagFilter !== 'all' && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-pink-700 font-semibold truncate">
                Tag: <strong>"{selectedTagFilter}"</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedTagFilter('all')}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold underline shrink-0 ml-2"
              >
                Clear Tag
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Counselor / Admin-Wise Performance Grid */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-pink-100/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-pink-600" />
              <span>Counselor Performance & Rating Scorecard</span>
            </h2>
            <p className="text-xs text-slate-500">
              Admin-wise average rating, total reviews collected, and student satisfaction breakdown.
            </p>
          </div>

          {selectedAdminId !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedAdminId('all')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-600 bg-pink-50 px-3 py-1.5 rounded-xl border border-pink-200 hover:bg-pink-100 transition-colors self-start sm:self-auto cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Showing: {activeAdminObject?.displayName || 'Selected'} (Show All)</span>
            </button>
          )}
        </div>

        {/* Horizontal Scrollable or Grid of Counselor Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 pt-1">
          {adminStats.map((item) => {
            const isSelected = selectedAdminId === item.admin.uid;
            return (
              <div
                key={item.admin.uid}
                onClick={() =>
                  setSelectedAdminId(isSelected ? 'all' : item.admin.uid)
                }
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-pink-500 bg-pink-50/60 shadow-md ring-2 ring-pink-500/20'
                    : 'border-slate-200/80 bg-white hover:border-pink-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {item.admin.photoURL ? (
                      <img
                        src={item.admin.photoURL}
                        alt={item.admin.displayName}
                        className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-2xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-pink-600 text-white font-extrabold text-base flex items-center justify-center shadow-2xs">
                        {(item.admin.displayName || 'A').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {item.admin.displayName}
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      {item.admin.professionalTitle || item.admin.email}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {item.reviewsCount > 0 ? (
                        <>
                          <div className="flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200/80 px-2 py-0.5 rounded-lg text-xs font-black">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                            <span>{item.averageRating.toFixed(1)}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            {item.reviewsCount} {item.reviewsCount === 1 ? 'review' : 'reviews'}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          Not yet rated
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub row with stats */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">
                    {item.reviewsCount > 0 ? `${item.satisfactionRate}% 4-5★` : 'No reviews'}
                  </span>
                  <span
                    className={`font-bold transition-colors ${
                      isSelected ? 'text-pink-700' : 'text-slate-400 hover:text-pink-600'
                    }`}
                  >
                    {isSelected ? '✓ Filtered' : 'View Reviews →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Detailed Reviews Feed Section */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-pink-100/80 shadow-sm space-y-5">
        {/* Feed Header & Filters Bar */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Quote className="w-5 h-5 text-pink-600" />
                <span>All Student Reviews & Feedback Feed</span>
                <span className="bg-pink-100 text-pink-800 text-xs font-extrabold px-2 py-0.5 rounded-full ml-1">
                  {filteredTickets.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Detailed reviews submitted by students upon query resolution.
              </p>
            </div>

            {/* Quick Star Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedStarFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedStarFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Stars
              </button>
              <button
                type="button"
                onClick={() => setSelectedStarFilter(5)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                  selectedStarFilter === 5
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>5★</span>
                <span>({metrics.starCounts[5] || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedStarFilter(4)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                  selectedStarFilter === 4
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>4★</span>
                <span>({metrics.starCounts[4] || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedStarFilter('with_feedback')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                  selectedStarFilter === 'with_feedback'
                    ? 'bg-pink-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                <span>Written Reviews ({metrics.withFeedbackCount})</span>
              </button>
            </div>
          </div>

          {/* Search, Counselor Dropdown & Sort Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reviews, student or counselor name, keywords..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Counselor Dropdown */}
            <div>
              <select
                value={selectedAdminId}
                onChange={(e) => setSelectedAdminId(e.target.value)}
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500"
              >
                <option value="all">All Counselors ({admins.length})</option>
                {admins.map((admin) => (
                  <option key={admin.uid} value={admin.uid}>
                    {admin.displayName} ({tickets.filter((t) => t.expertId === admin.uid).length} reviews)
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500"
              >
                <option value="newest">Sort: Most Recent</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="highest">Sort: Highest Rating</option>
                <option value="lowest">Sort: Lowest Rating</option>
              </select>
            </div>
          </div>
        </div>

        {/* Feed List */}
        {filteredTickets.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <MessageSquare className="w-8 h-8 stroke-[1.5]" />
            </div>
            <p className="font-bold text-slate-700 text-base">No reviews match your filters</p>
            <p className="text-slate-400 text-xs mt-1 max-w-sm">
              Try clearing the search query or selecting "All Counselors" and "All Stars".
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedAdminId('all');
                setSelectedStarFilter('all');
                setSelectedTagFilter('all');
              }}
              className="mt-4 px-4 py-2 bg-pink-50 text-pink-700 font-bold text-xs rounded-xl hover:bg-pink-100 transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="space-y-3.5 divide-y divide-slate-100">
            {filteredTickets.map((t) => {
              const rating = Math.min(5, Math.max(1, Math.round(t.rating || 0)));
              const hasComment = Boolean(t.ratingFeedback && t.ratingFeedback.trim());

              return (
                <div
                  key={t.id}
                  className="pt-4 first:pt-0 group transition-all"
                >
                  <div className="bg-slate-50/70 hover:bg-pink-50/30 rounded-2xl p-4 sm:p-5 border border-slate-200/70 transition-all space-y-3.5">
                    {/* Header Row: Stars, Date, and Ticket Pill */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-xl text-xs font-black shadow-2xs">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                          <span>{rating}.0</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {renderStars(rating, 'w-4 h-4')}
                        </div>
                        <span className="text-xs font-bold text-slate-700 ml-1">
                          {rating === 5
                            ? 'Excellent & Highly Recommended'
                            : rating === 4
                            ? 'Very Helpful & Detailed'
                            : rating === 3
                            ? 'Good & Helpful'
                            : rating === 2
                            ? 'Fair Guidance'
                            : 'Unsatisfactory'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatReviewDate(t.ratedAt || t.updatedAt || t.createdAt)}
                        </span>
                        <span className="text-[11px] font-bold text-pink-700 bg-pink-50 border border-pink-200 px-2 py-0.5 rounded-lg">
                          #{t.ticketNumber}
                        </span>
                      </div>
                    </div>

                    {/* Student & Counselor Meta Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                      {/* Student Cardlet */}
                      <div className="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-slate-100">
                        {t.studentAvatarUrl ? (
                          <img
                            src={t.studentAvatarUrl}
                            alt={t.studentName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs">
                            {(t.studentName || 'S').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 truncate">
                            {t.studentName || 'Student'}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {t.studentQualification || 'Student'} • {t.categoryName}
                          </p>
                        </div>
                      </div>

                      {/* Counselor Cardlet */}
                      <div className="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-slate-100">
                        {t.expertAvatarUrl ? (
                          <img
                            src={t.expertAvatarUrl}
                            alt={t.expertName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-xs">
                            {(t.expertName || 'C').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">Counselor:</span>
                            <p className="font-bold text-slate-900 truncate">{t.expertName}</p>
                          </div>
                          <p className="text-[11px] text-pink-700 font-medium truncate">
                            {t.expertTitle || 'Admissions Counselor'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Written Feedback Quote Body */}
                    {hasComment ? (
                      <div className="relative bg-white rounded-2xl p-4 border border-pink-100/90 shadow-2xs">
                        <Quote className="w-5 h-5 text-pink-300 absolute top-3 left-3 opacity-60" />
                        <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed pl-6 italic">
                          "{t.ratingFeedback}"
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white/60 rounded-xl px-3 py-2 text-[11px] text-slate-400 italic">
                        Student submitted a star rating without written feedback.
                      </div>
                    )}

                    {/* Tag Chips & Action */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {Array.isArray(t.ratingTags) && t.ratingTags.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {t.ratingTags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{tag}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div />
                      )}

                      {/* Open Conversation Button - strictly hidden for students as requested */}
                      {onOpenTicket && userProfile?.role !== 'student' && t.categoryId !== 'platform_overall' && (
                        <button
                          type="button"
                          onClick={() => onOpenTicket(t)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-700 bg-pink-50 hover:bg-pink-100 border border-pink-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-98"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>View Full Conversation</span>
                          <ExternalLink className="w-3 h-3 text-pink-500" />
                        </button>
                      )}
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
