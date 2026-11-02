import React, { useState, useEffect, useRef } from 'react';
import { api, errorMessage } from '../../lib/api';
import { useLiveQueries } from '../../lib/liveData';
import { useAuth } from '../../context/AuthContext';
import { QueryTicket, SavedAnswerItem } from '../../types';
import { ConversationView } from '../common/ConversationView';
import { navigationHistory } from '../../lib/navigationHistory';
import {
  Search,
  MessageSquare,
  CheckCheck,
  Check,
  Mic,
  X,
  Trash2,
  Bookmark,
  AlertTriangle,
  MoreVertical,
} from 'lucide-react';

interface RepliesSectionProps {
  initialSelectedTicketId?: string | null;
}

export const RepliesSection: React.FC<RepliesSectionProps> = ({
  initialSelectedTicketId,
}) => {
  const { userProfile } = useAuth();
  const uid = userProfile?.uid;
  const {
    queries: tickets,
    setQueries: setTickets,
    loading,
  } = useLiveQueries({
    enabled: Boolean(uid),
    filter: (q) => q.studentId === uid,
  });
  const [activeTicket, setActiveTicket] = useState<QueryTicket | null>(null);

  // Exact 4 categories: 'all' | 'unread' | 'resolved' | 'unresolved'
  const [filter, setFilter] = useState<'all' | 'unread' | 'resolved' | 'unresolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Delete for me state & long press tracking
  const [deleteModalTicket, setDeleteModalTicket] = useState<QueryTicket | null>(null);
  const [savedCountInTargetChat, setSavedCountInTargetChat] = useState<number>(0);
  const [checkingSaved, setCheckingSaved] = useState(false);
  const [deletingForMe, setDeletingForMe] = useState(false);

  const longPressTimerRef = useRef<any>(null);
  const isLongPressRef = useRef(false);

  const openDeleteModal = async (t: QueryTicket) => {
    setDeleteModalTicket(t);
    setCheckingSaved(true);
    setSavedCountInTargetChat(0);
    try {
      const saved = await api.get<SavedAnswerItem[]>(`/saved-answers?queryId=${encodeURIComponent(t.id)}`);
      setSavedCountInTargetChat(saved.length);
    } catch (e) {
      console.warn('Could not check saved answers:', e);
    } finally {
      setCheckingSaved(false);
    }
  };

  const handleTouchStart = (t: QueryTicket) => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(60);
        } catch {}
      }
      openDeleteModal(t);
    }, 550);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleChatClick = (t: QueryTicket) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    setActiveTicket(t);
    navigationHistory.openChat(t.id, 'replies', 'dashboard');
  };

  const handleCloseChat = () => {
    setActiveTicket(null);
    navigationHistory.closeChat();
  };

  // Sync back button / popstate with active chat
  useEffect(() => {
    const handlePopState = () => {
      if (activeTicket) {
        setActiveTicket(null);
      }
    };
    const handleCustomClose = () => {
      setActiveTicket(null);
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('app:close-chat', handleCustomClose);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('app:close-chat', handleCustomClose);
    };
  }, [activeTicket]);

  const confirmDeleteForMe = async () => {
    if (!deleteModalTicket || !userProfile) return;
    setDeletingForMe(true);
    try {
      // Server hides the chat for me and also removes my saved answers + notifications for it
      await api.post(`/queries/${deleteModalTicket.id}/hide`);
      const hiddenId = deleteModalTicket.id;
      setTickets((prev) => prev.filter((t) => t.id !== hiddenId));

      if (activeTicket?.id === deleteModalTicket.id) {
        setActiveTicket(null);
      }
      setDeleteModalTicket(null);
    } catch (e) {
      console.error('Delete for me error:', e);
      alert(errorMessage(e, 'Could not delete this chat. Please try again.'));
    } finally {
      setDeletingForMe(false);
    }
  };

  // Open the requested chat once, after the first load (or when a different chat is requested).
  // The user stays on whichever chat they pick afterwards; nothing is auto-opened.
  const appliedInitialIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!uid || loading || !initialSelectedTicketId) return;
    if (appliedInitialIdRef.current === initialSelectedTicketId) return;
    appliedInitialIdRef.current = initialSelectedTicketId;
    const match = tickets.find((t) => t.id === initialSelectedTicketId);
    if (match) setActiveTicket(match);
  }, [uid, loading, tickets, initialSelectedTicketId]);

  // Keep the open chat's ticket data current as updates arrive
  useEffect(() => {
    setActiveTicket((prev) => {
      if (!prev) return prev;
      const updated = tickets.find((t) => t.id === prev.id);
      return updated || prev;
    });
  }, [tickets]);

  // Filter out any chats deleted for this user
  const activeUserTickets = tickets.filter(
    (t) => !(Array.isArray(t.deletedForUsers) && t.deletedForUsers.includes(userProfile?.uid || ''))
  );

  // Real Counts for the 4 categories
  const unreadCount = activeUserTickets.filter((t) => t.hasUnreadStudentReply).length;
  const resolvedCount = activeUserTickets.filter((t) => t.status === 'resolved').length;
  const unresolvedCount = activeUserTickets.filter((t) => t.status !== 'resolved').length;

  const filteredTickets = activeUserTickets.filter((t) => {
    const text = `${t.title || ''} ${t.expertName || ''} ${t.categoryName || ''}`.toLowerCase();
    if (searchQuery && !text.includes(searchQuery.toLowerCase())) return false;

    if (filter === 'unread') return t.hasUnreadStudentReply;
    if (filter === 'resolved') return t.status === 'resolved';
    if (filter === 'unresolved') return t.status !== 'resolved';
    return true;
  });

  const formatWhatsAppTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full h-full min-h-[calc(100dvh-4rem)] xl:min-h-[580px] xl:h-[calc(100vh-120px)] flex flex-col bg-white xl:rounded-2xl xl:border xl:border-slate-300 xl:shadow-sm overflow-hidden select-none">
      {/* Split/Full Screen View */}
      <div className="grid grid-cols-1 xl:grid-cols-12 flex-1 h-full min-h-0 w-full">
        {/* LEFT PANEL: WHATSAPP-STYLE CHATS LIST */}
        <div
          className={`xl:col-span-5 border-r border-slate-200 flex flex-col h-full min-h-0 bg-white ${
            activeTicket ? 'hidden xl:flex' : 'flex'
          }`}
        >
          {/* WhatsApp Header Bar */}
          <div className="p-3.5 sm:p-4 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Chats
              </h1>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {activeUserTickets.length} {activeUserTickets.length === 1 ? 'chat' : 'chats'}
              </span>
            </div>

            {/* WhatsApp Oval Pill Search Input */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-8 py-2 bg-[#f0f2f5] hover:bg-[#e9edef] focus:bg-white border border-transparent focus:border-slate-300 rounded-full text-xs sm:text-sm text-slate-900 focus:outline-none transition-all placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* EXACT 4 CATEGORY PILLS: All, Unread, Resolved, Unresolved */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${
                  filter === 'all'
                    ? 'bg-pink-600 text-white shadow-2xs'
                    : 'bg-[#f0f2f5] text-slate-600 hover:bg-[#e4e8eb] hover:text-slate-900'
                }`}
              >
                All ({activeUserTickets.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                  filter === 'unread'
                    ? 'bg-pink-600 text-white shadow-2xs'
                    : 'bg-[#f0f2f5] text-slate-600 hover:bg-[#e4e8eb] hover:text-slate-900'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#25d366] text-white text-[10px] flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFilter('resolved')}
                className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${
                  filter === 'resolved'
                    ? 'bg-pink-600 text-white shadow-2xs'
                    : 'bg-[#f0f2f5] text-slate-600 hover:bg-[#e4e8eb] hover:text-slate-900'
                }`}
              >
                Resolved ({resolvedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unresolved')}
                className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${
                  filter === 'unresolved'
                    ? 'bg-pink-600 text-white shadow-2xs'
                    : 'bg-[#f0f2f5] text-slate-600 hover:bg-[#e4e8eb] hover:text-slate-900'
                }`}
              >
                Unresolved ({unresolvedCount})
              </button>
            </div>
          </div>

          {/* WhatsApp Chats List (Full Height, Avatar + Name + Snippet + Time + Badge) */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 bg-white">
            {filteredTickets.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs flex flex-col items-center">
                <MessageSquare className="w-10 h-10 text-slate-300 mb-2.5 stroke-[1.5]" />
                <p className="font-bold text-slate-700 text-sm">No chats found</p>
                <p className="text-slate-400 text-xs mt-1">
                  No conversations under the "{filter}" category.
                </p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = activeTicket?.id === t.id;
                const isUnread = t.hasUnreadStudentReply;
                const lastTime = formatWhatsAppTime(t.lastReplyAt || t.createdAt);
                const rawSnippet = t.lastReplyPreview || t.detail || '';
                // Pure clean message snippet with NO ticket number!
                const cleanSnippet = rawSnippet.replace(/^\[PT-[^\]]+\]:\s*/, '');
                const isSystemNotice = cleanSnippet.startsWith('🔄') || cleanSnippet.startsWith('📌');
                const isLastFromStudent = t.lastSenderRole === 'student' || (!t.lastSenderRole && !t.lastReplyAt);
                const counselorFirstName = t.expertName ? t.expertName.trim().split(' ')[0] : 'Counselor';
                const isSeenByAdmin = Boolean(t.isInitialQueryReadByAdmin || !t.hasUnreadAdminReply);

                return (
                  <div
                    key={t.id}
                    onClick={() => handleChatClick(t)}
                    onTouchStart={() => handleTouchStart(t)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    onMouseDown={() => handleTouchStart(t)}
                    onMouseUp={handleTouchEnd}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openDeleteModal(t);
                    }}
                    className={`group px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors border-b border-slate-50 relative select-none ${
                      isSelected
                        ? 'bg-[#f0f2f5]'
                        : 'hover:bg-[#f5f6f6] active:bg-[#e9edef]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Counselor Circular Avatar */}
                      <div className="relative shrink-0">
                        {t.expertAvatarUrl ? (
                          <img
                            src={t.expertAvatarUrl}
                            alt={t.expertName}
                            className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-2xs"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-2xs">
                            {(t.expertName || t.expertEmail || 'C').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Chat Item Content: Name on top, Snippet below */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h3 className="font-bold text-slate-900 text-sm truncate">
                            {t.expertName || t.expertEmail?.split('@')[0] || 'Counselor'}
                          </h3>
                          <span
                            className={`text-[11px] tabular-nums shrink-0 font-medium ${
                              isUnread ? 'text-[#25d366] font-bold' : 'text-slate-400'
                            }`}
                          >
                            {lastTime}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <div
                            className={`text-xs truncate flex items-center gap-1 min-w-0 ${
                              isUnread ? 'font-bold text-slate-900' : 'text-slate-500'
                            }`}
                          >
                            {isSystemNotice ? (
                              <span className="truncate">{cleanSnippet}</span>
                            ) : isLastFromStudent ? (
                              <>
                                <CheckCheck
                                  className={`w-3.5 h-3.5 shrink-0 ${isSeenByAdmin ? 'text-blue-500' : 'text-slate-400'}`}
                                />
                                {cleanSnippet.includes('🎤') ? (
                                  <span className="text-emerald-700 font-semibold inline-flex items-center gap-0.5 shrink-0">
                                    <Mic className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Voice Note</span>
                                  </span>
                                ) : (
                                  <span className="truncate">{cleanSnippet}</span>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="font-semibold text-slate-700 shrink-0">{counselorFirstName}:</span>
                                {cleanSnippet.includes('🎤') ? (
                                  <span className="text-emerald-700 font-semibold inline-flex items-center gap-0.5 shrink-0">
                                    <Mic className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Voice Note</span>
                                  </span>
                                ) : (
                                  <span className="truncate">{cleanSnippet}</span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Unread Circular WhatsApp Green Badge */}
                          {isUnread && (
                            <span className="w-5 h-5 rounded-full bg-[#25d366] text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 shadow-2xs">
                              1
                            </span>
                          )}
                        </div>

                        {/* WhatsApp-Style Tag Pills (Like STUDY / FRIENDS in screenshot) */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] font-semibold text-pink-700 bg-pink-50 border border-pink-100 px-2 py-0.2 rounded-md truncate max-w-[150px]">
                            {t.categoryName}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md tracking-wider uppercase ${
                              t.assignmentStatus === 'reassigned'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : t.status === 'resolved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {t.assignmentStatus === 'reassigned'
                              ? 'Reassigned'
                              : t.status === 'resolved'
                              ? 'Resolved'
                              : 'In Progress'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick delete button (hover or visible) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteModal(t);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shrink-0 cursor-pointer opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                      title="Long press or tap to Delete for me"
                      aria-label="Delete chat for me"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: ACTIVE FULL SCREEN CONVERSATION */}
        <div
          className={`xl:col-span-7 flex flex-col min-h-0 ${
            !activeTicket
              ? 'hidden xl:flex'
              : 'fixed top-0 left-0 right-0 z-50 xl:relative xl:top-auto xl:left-auto xl:right-auto xl:z-auto flex flex-col w-full bg-[#efeae2] animate-chat-open shadow-2xl overflow-hidden'
          }`}
          style={{
            height: typeof window !== 'undefined' && window.innerWidth < 1280 ? 'var(--chat-visual-height, 100%)' : '100%',
            maxHeight: typeof window !== 'undefined' && window.innerWidth < 1280 ? 'var(--chat-visual-height, 100%)' : '100%',
          }}
        >
          {activeTicket ? (
            <ConversationView
              ticket={activeTicket}
              onClose={handleCloseChat}
            />
          ) : (
            <div className="h-full bg-[#f0f2f5] flex flex-col items-center justify-center text-center p-8 border-l border-slate-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4 shadow-sm">
                <MessageSquare className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                Career Code Chats
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                Select a counseling conversation to view messages, voice notes, and specialist guidance.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* DELETE FOR ME CONFIRMATION MODAL WITH SAVED MESSAGES WARNING */}
      {deleteModalTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 animate-modal-pop">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Delete Chat for Me?</h3>
                <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                  {deleteModalTicket.expertName || 'Counselor'}
                </p>
              </div>
            </div>

            {checkingSaved ? (
              <div className="py-4 text-center text-xs text-slate-500">
                Checking saved bookmarks...
              </div>
            ) : (
              <div className="space-y-3">
                {savedCountInTargetChat > 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                    <Bookmark className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">⚠️ Notice: {savedCountInTargetChat} Saved Bookmark{savedCountInTargetChat > 1 ? 's' : ''}!</strong>
                      <p className="mt-0.5 text-amber-800 leading-relaxed text-[11px]">
                        Messages from this chat are bookmarked in your Saved Answers. Deleting this chat for yourself will also remove these bookmarks from your Saved Answers.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    This conversation will only be removed from your chat list. The counselor will retain their copy for counseling records.
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={deletingForMe}
                    onClick={() => setDeleteModalTicket(null)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deletingForMe}
                    onClick={confirmDeleteForMe}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deletingForMe ? 'Deleting...' : 'Delete for Me'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
