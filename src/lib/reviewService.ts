import { api } from './api';
import { onDataChanged } from './socket';

export interface UnifiedReviewItem {
  id: string;
  source: 'query' | 'platform';
  ticketNumber?: string;
  studentId?: string;
  studentName: string;
  /** Only returned to expert/super admins. */
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
  /** Only returned to expert/super admins. */
  title?: string;
  detail?: string;
}

/**
 * Reviews from rated tickets and approved platform reviews, newest first.
 * The server decides how much detail the viewer may see; the list refreshes when
 * a new rating or review arrives (signed-in users) or every 2 minutes (landing page).
 */
export function subscribeToUnifiedReviews(
  onReviews: (reviews: UnifiedReviewItem[]) => void,
  onError?: (err: unknown) => void
): () => void {
  let cancelled = false;
  const load = () =>
    api
      .get<UnifiedReviewItem[]>('/reviews')
      .then((list) => !cancelled && onReviews(list))
      .catch((err) => onError?.(err));
  load();
  const offChanged = onDataChanged(['reviews'], load);
  const timer = window.setInterval(load, 2 * 60 * 1000);
  return () => {
    cancelled = true;
    offChanged();
    window.clearInterval(timer);
  };
}
