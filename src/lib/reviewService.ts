import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { QueryTicket } from '../types';

export interface UnifiedReviewItem {
  id: string;
  source: 'query' | 'platform';
  ticketNumber?: string;
  studentId?: string;
  studentName: string;
  studentEmail?: string;
  studentQualification: string;
  studentBoard?: string;
  studentAvatarUrl?: string;
  categoryId: string;
  categoryName: string;
  expertId?: string;
  expertName: string;
  expertRole?: string;
  expertTitle?: string;
  rating: number; // 1 to 5
  ratingFeedback: string;
  ratingTags?: string[];
  ratedAt: number;
  title?: string;
  detail?: string;
}

/**
 * Real-time subscription to ALL genuine student reviews from both consultation tickets and platform reviews.
 * Perfectly synchronized across both the public landing page and the logged-in dashboards.
 */
export function subscribeToUnifiedReviews(
  onReviews: (reviews: UnifiedReviewItem[]) => void,
  onError?: (err: any) => void
): () => void {
  let queryReviews: UnifiedReviewItem[] = [];
  let platformReviews: UnifiedReviewItem[] = [];

  const updateCombined = () => {
    // Combine and sort descending by ratedAt/creation time
    const combined = [...queryReviews, ...platformReviews];
    combined.sort((a, b) => (b.ratedAt || 0) - (a.ratedAt || 0));
    onReviews(combined);
  };

  // 1. Real-time listener for consultation queries with positive rating
  const unsubQueries = onSnapshot(
    collection(db, 'queries'),
    (snapshot) => {
      const list: UnifiedReviewItem[] = [];
      snapshot.forEach((d) => {
        const t = d.data() as QueryTicket;
        const numRating = typeof t.rating === 'number' ? t.rating : Number(t.rating);
        if (numRating && numRating >= 1 && numRating <= 5) {
          list.push({
            id: d.id,
            source: 'query',
            ticketNumber: t.ticketNumber,
            studentId: t.studentId,
            studentName: (t.studentName || 'Student').trim(),
            studentEmail: t.studentEmail || '',
            studentQualification: t.studentQualification || 'Student',
            studentBoard: t.studentBoard,
            studentAvatarUrl: t.studentAvatarUrl || '',
            categoryId: t.categoryId || 'counseling',
            categoryName: t.categoryName || 'Career Counseling',
            expertId: t.expertId,
            expertName: (t.expertName || 'Career Counselor').trim(),
            expertRole: t.expertRole,
            expertTitle: t.expertTitle || 'Admissions Counselor',
            rating: Math.min(5, Math.max(1, Math.round(numRating))),
            ratingFeedback: (t.ratingFeedback || '').trim(),
            ratingTags: Array.isArray(t.ratingTags) ? t.ratingTags : [],
            ratedAt: t.ratedAt || t.updatedAt || t.createdAt || Date.now(),
            title: t.title,
            detail: t.detail,
          });
        }
      });
      queryReviews = list;
      updateCombined();
    },
    (err) => {
      console.warn('subscribeToUnifiedReviews queries error:', err);
      if (onError) onError(err);
    }
  );

  // 2. Real-time listener for overall platform reviews
  const unsubPlatform = onSnapshot(
    collection(db, 'platform_reviews'),
    (snapshot) => {
      const list: UnifiedReviewItem[] = [];
      snapshot.forEach((d) => {
        const p = d.data();
        const numRating = typeof p.rating === 'number' ? p.rating : Number(p.rating);
        if (numRating && numRating >= 1 && numRating <= 5) {
          list.push({
            id: d.id,
            source: 'platform',
            ticketNumber: `REV-${d.id.slice(0, 6).toUpperCase()}`,
            studentId: p.studentId || 'guest',
            studentName: (p.studentName || 'Student').trim(),
            studentEmail: p.studentEmail || '',
            studentQualification: p.studentQualification || 'Student',
            studentBoard: p.studentBoard,
            studentAvatarUrl: p.studentAvatarUrl || '',
            categoryId: 'platform_overall',
            categoryName: p.categoryName || 'Career Code LMS',
            expertId: 'team_career_code',
            expertName: (p.expertName || 'Career Code Mentors').trim(),
            expertRole: 'normal_admin',
            expertTitle: 'Mentors & Counselors',
            rating: Math.min(5, Math.max(1, Math.round(numRating))),
            ratingFeedback: (p.ratingFeedback || '').trim(),
            ratingTags: Array.isArray(p.ratingTags) ? p.ratingTags : [],
            ratedAt: p.createdAt || Date.now(),
            title: 'Overall LMS Experience & Review',
            detail: p.ratingFeedback || '',
          });
        }
      });
      platformReviews = list;
      updateCombined();
    },
    (err) => {
      console.warn('subscribeToUnifiedReviews platform_reviews error:', err);
      if (onError) onError(err);
    }
  );

  return () => {
    unsubQueries();
    unsubPlatform();
  };
}

/**
 * Adapter converting UnifiedReviewItem to QueryTicket format for ReviewsAnalyticsDashboard compatibility
 */
export function unifiedReviewToTicket(item: UnifiedReviewItem): QueryTicket {
  return {
    id: item.id,
    ticketNumber: item.ticketNumber || `REV-${item.id.slice(0, 6).toUpperCase()}`,
    studentId: item.studentId || 'guest',
    studentName: item.studentName,
    studentEmail: item.studentEmail || '',
    studentQualification: item.studentQualification,
    studentBoard: item.studentBoard,
    studentAvatarUrl: item.studentAvatarUrl || '',
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    expertId: item.expertId || 'unassigned',
    expertName: item.expertName,
    expertRole: (item.expertRole as any) || 'normal_admin',
    expertTitle: item.expertTitle,
    title: item.title || 'Guidance Review',
    detail: item.detail || item.ratingFeedback || '',
    status: 'resolved',
    assignmentStatus: 'assigned',
    hasUnreadStudentReply: false,
    hasUnreadAdminReply: false,
    rating: item.rating,
    ratingFeedback: item.ratingFeedback,
    ratingTags: item.ratingTags || [],
    ratedAt: item.ratedAt,
    createdAt: item.ratedAt,
    updatedAt: item.ratedAt,
  };
}
