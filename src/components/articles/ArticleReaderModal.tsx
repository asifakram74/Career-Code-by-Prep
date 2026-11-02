import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowLeft,
  Clock,
  Heart,
  Share2,
  Calendar,
  Sparkles,
  ShieldCheck,
  Check,
  Tag,
  BookOpen,
  Bookmark,
} from 'lucide-react';
import { ArticleItem, UserProfile } from '../../types';
import { toggleLikeArticle, incrementArticleViews } from '../../lib/articleService';
import { processArticleHtmlLinks } from '../../lib/linkUtils';
import { AdminProfileModal } from './AdminProfileModal';

interface ArticleReaderModalProps {
  article: ArticleItem | null;
  onClose: () => void;
  currentUserProfile?: UserProfile | null;
  isSaved?: boolean;
  onToggleSave?: () => void;
}

export const ArticleReaderModal: React.FC<ArticleReaderModalProps> = ({
  article,
  onClose,
  currentUserProfile,
  isSaved = false,
  onToggleSave,
}) => {
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    if (!article) return;
    setLikesCount(article.likesCount || 0);
    const userId = currentUserProfile?.uid;
    setHasLiked(userId ? (article.likedBy || []).includes(userId) : false);

    // Increment view count on mount
    incrementArticleViews(article.id);
  }, [article?.id, currentUserProfile?.uid]);

  // Ensure all links in article content are formatted, clickable, and open in a new tab (called unconditionally)
  const processedContent = useMemo(() => {
    return article ? processArticleHtmlLinks(article.content) : '';
  }, [article?.content]);

  // Handle browser / mobile back button synchronization
  useEffect(() => {
    if (!article) return;

    const handlePopState = () => {
      if (showAdminProfile) {
        setShowAdminProfile(false);
        return;
      }
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [article, showAdminProfile, onClose]);

  // Early return only after all React hooks are unconditionally declared
  if (!article) return null;

  const formattedDate = article.createdAt
    ? new Date(article.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recent';

  const handleLike = async () => {
    const nextState = !hasLiked;
    setHasLiked(nextState);
    setLikesCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    if (currentUserProfile?.uid && !article.id.startsWith('starter-')) {
      try {
        await toggleLikeArticle(article.id, currentUserProfile.uid, !nextState);
      } catch (err) {
        console.warn('Like sync note:', err);
      }
    }
  };

  const handleShare = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = window.location.href;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      console.warn('Clipboard note:', e);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  // Handle any click on links inside the article to guarantee new tab opening
  const handleArticleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      e.preventDefault();
      e.stopPropagation();
      // Only open web links; ignore javascript:, data: and other schemes.
      if (anchor.protocol === 'http:' || anchor.protocol === 'https:') {
        window.open(anchor.href, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <>
      {/* 1. Full Page Immersive Reader Viewport */}
      <div className="fixed inset-0 z-50 bg-white min-h-screen flex flex-col overflow-y-auto animate-fade-in">
        {/* Full-width Top Sticky Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-pink-100 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3 shadow-2xs">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-pink-700 bg-pink-50 hover:bg-pink-100 border border-pink-200/90 rounded-xl transition-all cursor-pointer active:scale-95 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Back to Articles</span>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Save / Bookmark Button */}
            {onToggleSave && (
              <button
                type="button"
                onClick={onToggleSave}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSaved
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800 border border-transparent'
                }`}
                title={isSaved ? 'Saved in your articles (click to unsave)' : 'Save article for later'}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-emerald-600 text-emerald-600' : ''}`} />
                <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
              </button>
            )}

            {/* Like Button */}
            <button
              type="button"
              onClick={handleLike}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                hasLiked
                  ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800 border border-transparent'
              }`}
              title="Like article"
            >
              <Heart className={`w-4 h-4 ${hasLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span className="tabular-nums font-semibold">{likesCount}</span>
            </button>

            {/* Share Button */}
            <button
              type="button"
              onClick={handleShare}
              className="px-3 py-1.5 text-slate-600 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-pink-200 text-xs font-semibold inline-flex items-center gap-1.5"
              title="Share link"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Reader Full-Page Content Container */}
        <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-7">
          {/* Cover Image Banner */}
            {article.coverImage && (
              <div className="rounded-2xl sm:rounded-3xl overflow-hidden aspect-21/9 max-h-80 w-full shadow-md bg-slate-100 border border-slate-200/80">
                <img
                  src={article.coverImage}
                  alt={article.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Article Meta Bar */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-pink-700 bg-pink-50 border border-pink-200/80 px-3 py-1 rounded-full flex items-center gap-1">
                <Tag className="w-3 h-3 text-pink-500" />
                {article.category}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {article.readTimeMinutes} min read
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formattedDate}
              </span>
            </div>

            {/* Article Title & Summary */}
            <div className="space-y-3">
              <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                {article.title}
              </h1>
              <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed bg-pink-50/40 border-l-4 border-pink-500 p-3.5 sm:p-4 rounded-r-2xl">
                {article.description}
              </p>
            </div>

            {/* Author Profile Card with Clickable DP & Responsive Mobile Layout */}
            <div
              onClick={() => setShowAdminProfile(true)}
              className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-pink-200/90 hover:border-pink-400 hover:shadow-md transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 shadow-2xs"
              title="Click to view mentor profile details"
            >
              <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 w-full sm:w-auto">
                {/* Admin DP */}
                <div className="relative shrink-0">
                  {article.authorPhotoURL ? (
                    <img
                      src={article.authorPhotoURL}
                      alt={article.authorName}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-pink-200 group-hover:border-pink-500 transition-colors shadow-2xs"
                    />
                  ) : (
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 text-white font-bold text-lg sm:text-xl flex items-center justify-center shadow-2xs">
                      {article.authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-xs">
                    <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-slate-500">By</span>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base group-hover:text-pink-700 transition-colors break-words whitespace-normal leading-snug">
                      {article.authorName}
                    </h3>
                    <span className="text-[10px] font-bold text-pink-700 bg-pink-100/80 px-2 py-0.5 rounded-md shrink-0">
                      Career Code Mentor
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 break-words whitespace-normal mt-0.5 leading-snug">
                    {article.authorProfessionalTitle || 'Career Code Academic Counselor'}
                  </p>
                </div>
              </div>

              {/* View Mentor Profile Button - Complete, unbroken, full-width on mobile */}
              <div className="w-full sm:w-auto shrink-0 pt-2.5 sm:pt-0 border-t border-pink-100/70 sm:border-t-0 flex sm:block justify-end">
                <div className="w-full sm:w-auto text-center py-2.5 px-4 text-xs font-bold text-pink-700 bg-pink-50 border border-pink-200/90 rounded-xl group-hover:bg-pink-600 group-hover:text-white transition-all shadow-2xs flex items-center justify-center gap-1.5 active:scale-98">
                  <Sparkles className="w-3.5 h-3.5 text-pink-500 group-hover:text-white transition-colors" />
                  <span className="whitespace-nowrap">View Mentor Profile</span>
                  <span className="ml-0.5">→</span>
                </div>
              </div>
            </div>

            {/* Formatted Article Body */}
            <div className="pt-2 border-t border-slate-100">
              <div
                className="article-content text-slate-800 text-sm sm:text-base leading-relaxed space-y-4"
                onClick={handleArticleContentClick}
                dangerouslySetInnerHTML={{ __html: processedContent }}
              />
            </div>

            {/* Bottom Appreciation Bar */}
            <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50 p-4 sm:p-5 rounded-2xl">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Found this article insightful?</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Share it with fellow students or leave a like to support the mentor.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {onToggleSave && (
                  <button
                    type="button"
                    onClick={onToggleSave}
                    className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isSaved
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-white' : ''}`} />
                    <span>{isSaved ? 'Saved in Articles' : 'Save Article'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleLike}
                  className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    hasLiked
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-600 border border-slate-200'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${hasLiked ? 'fill-white' : ''}`} />
                  <span>{hasLiked ? 'Liked' : 'Like Article'}</span>
                  <span className="opacity-80">({likesCount})</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-pink-50 text-slate-700 hover:text-pink-700 border border-slate-200 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Share'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* Admin Profile Modal - only shown when explicitly clicked by user, never on article open */}
      {showAdminProfile && (
        <AdminProfileModal
          admin={{
            displayName: article.authorName,
            role: article.authorRole,
            professionalTitle: article.authorProfessionalTitle,
            qualification: article.authorQualification,
            shortDescription: article.authorBio,
            photoURL: article.authorPhotoURL,
          }}
          onClose={() => setShowAdminProfile(false)}
          articlesCount={1}
        />
      )}
    </>
  );
};
