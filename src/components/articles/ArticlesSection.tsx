import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  PlusCircle,
  Search,
  Clock,
  Heart,
  Eye,
  Calendar,
  Sparkles,
  Edit2,
  Trash2,
  Tag,
  ShieldCheck,
  RefreshCw,
  X,
  User as UserIcon,
  ChevronRight,
  Bookmark,
} from 'lucide-react';
import { ArticleItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeToArticles,
  deleteArticle,
  toggleLikeArticle,
  toggleSaveArticle,
  subscribeToSavedArticleIds,
} from '../../lib/articleService';
import { ArticleEditorModal } from './ArticleEditorModal';
import { ArticleReaderModal } from './ArticleReaderModal';
import { AdminProfileModal } from './AdminProfileModal';

interface ArticlesSectionProps {
  onNavigateTab?: (tab: string) => void;
}

export const ArticlesSection: React.FC<ArticlesSectionProps> = () => {
  const { userProfile } = useAuth();
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [savedArticleIds, setSavedArticleIds] = useState<string[]>([]);
  const [showOnlySaved, setShowOnlySaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modals state
  const [selectedArticle, setSelectedArticle] = useState<ArticleItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticleItem | null>(null);
  const [articleToDelete, setArticleToDelete] = useState<ArticleItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [profileAdmin, setProfileAdmin] = useState<{
    displayName: string;
    role?: string;
    professionalTitle?: string;
    qualification?: string;
    qualificationDetail?: string;
    shortDescription?: string;
    photoURL?: string;
  } | null>(null);

  const isAdmin =
    userProfile?.role === 'normal_admin' ||
    userProfile?.role === 'expert_admin' ||
    userProfile?.role === 'super_admin';

  // Real-time subscription to articles
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToArticles(
      (items) => {
        setArticles(items);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to subscribe to articles:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time subscription to user's saved articles
  useEffect(() => {
    if (!userProfile?.uid) {
      setSavedArticleIds([]);
      return;
    }
    const unsub = subscribeToSavedArticleIds(userProfile.uid, setSavedArticleIds);
    return () => unsub();
  }, [userProfile?.uid]);

  // Filter categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return ['All', ...Array.from(set)];
  }, [articles]);

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      if (showOnlySaved && !savedArticleIds.includes(a.id)) {
        return false;
      }
      const matchesCategory = selectedCategory === 'All' || a.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.authorName.toLowerCase().includes(q) ||
        (a.tags || []).some((t) => t.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [articles, selectedCategory, searchQuery, showOnlySaved, savedArticleIds]);

  // Handle open reader with history state
  const handleOpenReader = (article: ArticleItem) => {
    setSelectedArticle(article);
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState(
        {
          level: 2,
          type: 'modal',
          modalId: `article_${article.id}`,
          tab: 'articles',
        },
        ''
      );
    }
  };

  const handleCloseReader = () => {
    setSelectedArticle(null);
    if (
      typeof window !== 'undefined' &&
      window.history?.state?.modalId?.startsWith('article_')
    ) {
      window.history.back();
    }
  };

  const handleDeleteArticle = (e: React.MouseEvent, article: ArticleItem) => {
    e.stopPropagation();
    setArticleToDelete(article);
  };

  const handleConfirmDelete = async () => {
    if (!articleToDelete) return;
    setIsDeleting(true);
    try {
      await deleteArticle(articleToDelete.id);
      setArticleToDelete(null);
    } catch (err) {
      console.error('Failed to delete article:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleCardLike = async (e: React.MouseEvent, article: ArticleItem) => {
    e.stopPropagation();
    if (!userProfile?.uid) return;
    const hasLiked = (article.likedBy || []).includes(userProfile.uid);
    try {
      await toggleLikeArticle(article.id, userProfile.uid, hasLiked);
    } catch (err) {
      console.warn('Like toggle error:', err);
    }
  };

  const handleToggleSaveArticle = async (e: React.MouseEvent | undefined, article: ArticleItem) => {
    if (e) e.stopPropagation();
    if (!userProfile?.uid) return;
    const isCurrentlySaved = savedArticleIds.includes(article.id);
    // Optimistic UI update
    setSavedArticleIds((prev) =>
      isCurrentlySaved ? prev.filter((id) => id !== article.id) : [...prev, article.id]
    );
    try {
      await toggleSaveArticle(article.id, userProfile.uid, isCurrentlySaved, article.title);
    } catch (err) {
      console.warn('Toggle save article error:', err);
    }
  };

  const handleEditArticle = (e: React.MouseEvent, article: ArticleItem) => {
    e.stopPropagation();
    setEditingArticle(article);
    setEditorOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 pb-12 px-1 sm:px-0">
      {/* Top Header Card - Career Code Theme */}
      <div className="bg-white border border-pink-100/80 rounded-3xl p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-pink-700 text-white flex items-center justify-center shadow-xs shadow-pink-200 shrink-0">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                Informative Articles
              </h1>
              <span className="text-[10px] font-bold text-pink-700 bg-pink-50 border border-pink-200 px-2.5 py-0.5 rounded-full">
                Mentorship Hub
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 break-words">
              Academic strategies, career roadmaps, university guidance, and life skills posted by Career Code mentors.
            </p>
          </div>
        </div>

        {/* Admin Post Button */}
        {isAdmin && (
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingArticle(null);
                setEditorOpen(true);
              }}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-xs font-bold rounded-2xl transition-all shadow-md shadow-pink-200 hover:shadow-lg hover:shadow-pink-300 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>Post New Article</span>
            </button>
          </div>
        )}
      </div>

      {/* Search & Category Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-3 sm:p-5 shadow-xs space-y-3">
        {/* Search Input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles by title, topic, author name, or keyword..."
            className="w-full text-xs sm:text-sm pl-10 pr-9 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all bg-slate-50/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills & Saved Filter (Directly in articles section, no extra tab) */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none text-xs flex-nowrap">
          {/* Saved Articles Toggle Pill */}
          <button
            type="button"
            onClick={() => setShowOnlySaved((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer text-xs inline-flex items-center gap-1.5 shrink-0 ${
              showOnlySaved
                ? 'bg-pink-600 text-white shadow-xs'
                : 'bg-pink-50 text-pink-700 hover:bg-pink-100/90 border border-pink-200/70'
            }`}
            title="View your saved articles"
          >
            <Bookmark className={`w-3.5 h-3.5 ${showOnlySaved ? 'fill-white text-white' : 'fill-pink-500 text-pink-500'}`} />
            <span>Saved Articles</span>
            {savedArticleIds.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  showOnlySaved ? 'bg-white/25 text-white' : 'bg-pink-200/80 text-pink-800'
                }`}
              >
                {savedArticleIds.length}
              </span>
            )}
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setShowOnlySaved(false);
                setSelectedCategory(cat);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer text-xs ${
                !showOnlySaved && selectedCategory === cat
                  ? 'bg-pink-600 text-white shadow-xs'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-pink-50 hover:text-pink-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Articles Grid View */}
      {loading ? (
        <div className="py-24 text-center text-xs text-slate-400 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin text-pink-600 mb-2" />
          <span>Loading informative articles...</span>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-white rounded-3xl border border-slate-200 p-8">
          {showOnlySaved ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Bookmark className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-800 text-sm">No Saved Articles Yet</p>
              <p className="text-slate-400 mt-1 max-w-sm mx-auto text-xs">
                You haven't bookmarked any articles yet. Click the bookmark icon on any article to save it here for quick access anytime.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowOnlySaved(false);
                  setSelectedCategory('All');
                }}
                className="mt-4 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <BookOpen className="w-4 h-4" />
                <span>Browse All Articles</span>
              </button>
            </>
          ) : (
            <>
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-800 text-sm">No articles found</p>
              <p className="text-slate-400 mt-1 max-w-sm mx-auto text-xs">
                {searchQuery
                  ? `No articles matched "${searchQuery}". Try a different keyword.`
                  : 'There are currently no articles published in this category.'}
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingArticle(null);
                    setEditorOpen(true);
                  }}
                  className="mt-4 px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 hover:bg-pink-700 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create First Article</span>
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredArticles.map((article) => {
            const isAuthor = userProfile?.uid === article.authorId;
            const canManage = isAuthor || userProfile?.role === 'super_admin' || userProfile?.role === 'expert_admin';

            return (
              <div
                key={article.id}
                onClick={() => handleOpenReader(article)}
                className="group bg-white border border-slate-200 hover:border-pink-300 rounded-3xl overflow-hidden shadow-xs hover:shadow-lg transition-all cursor-pointer flex flex-col active:scale-[0.99]"
              >
                {/* 1. Mandatory Cover Image with Category Tag */}
                <div className="relative aspect-16/9 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={article.coverImage}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-40 group-hover:opacity-60 transition-opacity" />

                  {/* Category Pill */}
                  <div className="absolute top-3 left-3">
                    <span className="text-[10px] font-bold text-slate-900 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-xs border border-white/50">
                      {article.category}
                    </span>
                  </div>

                  {/* Read Time Pill */}
                  <div className="absolute bottom-2.5 right-3 flex items-center gap-1 text-[10px] font-bold text-white bg-slate-900/70 backdrop-blur-md px-2 py-0.5 rounded-lg">
                    <Clock className="w-3 h-3" />
                    <span>{article.readTimeMinutes} min read</span>
                  </div>
                </div>

                {/* 2. Card Content Body */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    {/* Title: Wraps completely without dots as requested */}
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug group-hover:text-pink-700 transition-colors break-words whitespace-normal">
                      {article.title}
                    </h3>

                    {/* Short Description */}
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {article.description}
                    </p>
                  </div>

                  {/* 3. Author Section: DP + "By (Admin Name)" */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setProfileAdmin({
                          displayName: article.authorName,
                          role: article.authorRole,
                          professionalTitle: article.authorProfessionalTitle,
                          qualification: article.authorQualification,
                          shortDescription: article.authorBio,
                          photoURL: article.authorPhotoURL,
                        });
                      }}
                      className="flex items-center gap-2 min-w-0 flex-1 group/author hover:opacity-85 transition-opacity cursor-pointer"
                      title="Click to view mentor info"
                    >
                      {/* Admin DP */}
                      {article.authorPhotoURL ? (
                        <img
                          src={article.authorPhotoURL}
                          alt={article.authorName}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-pink-200 shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-pink-600 to-rose-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                          {article.authorName.charAt(0)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] text-slate-600 break-words whitespace-normal leading-tight block">
                          By <strong className="text-slate-900 font-bold group-hover/author:text-pink-700">{article.authorName}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Interactive Bookmark / Save Button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleSaveArticle(e, article)}
                        className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-xs transition-all cursor-pointer ${
                          savedArticleIds.includes(article.id)
                            ? 'text-pink-700 bg-pink-50 border border-pink-200/90 font-bold'
                            : 'text-slate-400 hover:text-pink-600 hover:bg-pink-50/60 border border-transparent'
                        }`}
                        title={savedArticleIds.includes(article.id) ? 'Saved in your list (click to remove)' : 'Save article'}
                      >
                        <Bookmark
                          className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                            savedArticleIds.includes(article.id)
                              ? 'fill-pink-600 text-pink-600'
                              : 'text-slate-400'
                          }`}
                        />
                      </button>

                      {/* Interactive Likes Button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleCardLike(e, article)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs transition-all cursor-pointer ${
                          (article.likedBy || []).includes(userProfile?.uid || '')
                            ? 'text-rose-600 bg-rose-50 border border-rose-200/90 font-bold'
                            : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50/60 border border-transparent'
                        }`}
                        title="Like this article"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                            (article.likedBy || []).includes(userProfile?.uid || '')
                              ? 'fill-rose-500 text-rose-500'
                              : 'text-slate-400'
                          }`}
                        />
                        <span className="tabular-nums font-semibold">
                          {article.likesCount || 0}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Admin Manage Actions */}
                  {canManage && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="pt-2 border-t border-slate-50 flex items-center justify-end gap-1.5 text-xs"
                    >
                      <button
                        type="button"
                        onClick={(e) => handleEditArticle(e, article)}
                        className="px-2.5 py-1 text-slate-600 hover:text-pink-700 hover:bg-pink-50 rounded-lg font-semibold inline-flex items-center gap-1 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteArticle(e, article)}
                        className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold inline-flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal for Admins */}
      {userProfile && (
        <ArticleEditorModal
          isOpen={editorOpen}
          onClose={() => {
            setEditorOpen(false);
            setEditingArticle(null);
          }}
          currentUserProfile={userProfile}
          initialArticle={editingArticle}
          onSaved={() => {
            setEditorOpen(false);
            setEditingArticle(null);
          }}
        />
      )}

      {/* Full Article Reader Modal */}
      {selectedArticle && (
        <ArticleReaderModal
          article={selectedArticle}
          onClose={handleCloseReader}
          currentUserProfile={userProfile}
          isSaved={savedArticleIds.includes(selectedArticle.id)}
          onToggleSave={() => handleToggleSaveArticle(undefined, selectedArticle)}
        />
      )}

      {/* Admin Profile Modal - Contacts strictly omitted */}
      <AdminProfileModal
        admin={profileAdmin}
        onClose={() => setProfileAdmin(null)}
      />

      {/* In-App Delete Confirmation Modal (Guaranteed to work inside iframes) */}
      {articleToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => !isDeleting && setArticleToDelete(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-rose-100 text-center animate-pop-in space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Article?</h3>
              <p className="text-xs text-slate-500 mt-1.5 break-words">
                Are you sure you want to delete <strong className="text-slate-800 font-semibold">"{articleToDelete.title}"</strong>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setArticleToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-rose-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
