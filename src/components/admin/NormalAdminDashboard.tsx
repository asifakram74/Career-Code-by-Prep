import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { QueryTicket } from '../../types';
import { ConversationView } from '../common/ConversationView';
import { api, errorMessage } from '../../lib/api';
import { useLiveQueries, sortByActivity } from '../../lib/liveData';
import { navigationHistory } from '../../lib/navigationHistory';
import {
  Search,
  MessageSquare,
  CheckCheck,
  Check,
  Mic,
  X,
  Trash2,
} from 'lucide-react';

interface NormalAdminDashboardProps {
  currentTab: string;
  onNavigateTab: (tab: string) => void;
}

export const NormalAdminDashboard: React.FC<NormalAdminDashboardProps> = ({
  currentTab,
  onNavigateTab,
}) => {
  const { userProfile } = useAuth();
  const { queries: assignedTickets, setQueries: setAssignedTickets, loading } = useLiveQueries({
    enabled: Boolean(userProfile),
  });
  const [activeTicket, setActiveTicket] = useState<QueryTicket | null>(null);

  // Exact 4 categories: 'all' | 'unread' | 'resolved' | 'unresolved'
  const [filter, setFilter] = useState<'all' | 'unread' | 'resolved' | 'unresolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // "Delete for me" states & saved bookmark warning
  const [deleteModalTicket, setDeleteModalTicket] = useState<QueryTicket | null>(null);
  const [deletingForMe, setDeletingForMe] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState('');

  // Long-press timer references
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef<boolean>(false);

  const openDeleteModal = (t: QueryTicket) => {
    if (!userProfile) return;
    setDeleteError('');
    setDeleteModalTicket(t);
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
    navigationHistory.openChat(t.id, currentTab || 'assigned-queries', 'admin-dashboard');
  };

  const handleCloseChat = () => {
    setActiveTicket(null);
    navigationHistory.closeChat();
  };

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
    setDeleteError('');
    try {
      // The server hides the chat for me and removes my saved answers and notifications for it.
      await api.post(`/queries/${encodeURIComponent(deleteModalTicket.id)}/hide`);
      const hiddenId = deleteModalTicket.id;
      setAssignedTickets((prev) => prev.filter((t) => t.id !== hiddenId));
      if (activeTicket?.id === hiddenId) {
        setActiveTicket(null);
      }
      setDeleteModalTicket(null);
    } catch (e) {
      setDeleteError(errorMessage(e, 'Could not delete this chat. Please try again.'));
    } finally {
      setDeletingForMe(false);
    }
  };

  // Sync sub-tab from parent if navigated from elsewhere
  useEffect(() => {
    if (currentTab === 'pending-replies') setFilter('unresolved');
    else if (currentTab === 'replied-queries') setFilter('resolved');
    else if (currentTab === 'assigned-queries') setFilter('all');
  }, [currentTab]);

  // Keep the open chat in sync with the live list (and preselect the newest on desktop).
  useEffect(() => {
    if (loading) return;
    setActiveTicket((prev) => {
      const visible = assignedTickets.filter(
        (t) => !Array.isArray(t.deletedForUsers) || !t.deletedForUsers.includes(userProfile?.uid || '')
      );
      if (!prev) {
        return typeof window !== 'undefined' && window.innerWidth >= 1280 && visible.length > 0 ? visible[0] : null;
      }
      return assignedTickets.find((t) => t.id === prev.id) || prev;
    });
  }, [assignedTickets, loading, userProfile?.uid]);

  // Active tickets visible to this admin (not deleted for me)
  const activeUserTickets = assignedTickets.filter(
    (t) => !Array.isArray(t.deletedForUsers) || !t.deletedForUsers.includes(userProfile?.uid || '')
  );

  // Statistics for the 4 categories
  const totalAssigned = activeUserTickets.length;
  const unreadCount = activeUserTickets.filter((t) => t.hasUnreadAdminReply).length;
  const resolvedCount = activeUserTickets.filter((t) => t.status === 'resolved').length;
  const unresolvedCount = activeUserTickets.filter((t) => t.status !== 'resolved').length;

  // Filter logic
  const filteredTickets = activeUserTickets.filter((t) => {
    const text = `${t.studentName} ${t.title} ${t.categoryName} ${t.studentQualification}`.toLowerCase();
    if (searchQuery && !text.includes(searchQuery.toLowerCase())) return false;

    if (filter === 'unread') return t.hasUnreadAdminReply;
    if (filter === 'resolved') return t.status === 'resolved';
    if (filter === 'unresolved') return t.status !== 'resolved';
    return true;
  });

  /** ConversationView has already saved the status; just sync local state. */
  const handleTicketUpdated = (updated: QueryTicket) => {
    setActiveTicket((prev) => (prev && prev.id === updated.id ? updated : prev));
    setAssignedTickets((prev) => sortByActivity([updated, ...prev.filter((t) => t.id !== updated.id)]));
  };

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
    const isYesterday =
      date.getDate() === now.getDate() - 1 &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full h-full min-h-[calc(100dvh-4rem)] xl:min-h-[580px] xl:h-[calc(100vh-120px)] flex flex-col bg-white xl:rounded-2xl xl:border xl:border-slate-300 xl:shadow-sm overflow-hidden select-none">
      {/* CHATS MASTER-DETAIL CONTAINER */}
      <div className="grid grid-cols-1 xl:grid-cols-12 flex-1 h-full min-h-0 w-full">
        {/* LEFT PANEL: WHATSAPP-STYLE CHATS LIST */}
        <div
          className={`xl:col-span-5 border-r border-slate-200 flex flex-col h-full min-h-0 bg-white ${
            activeTicket ? 'hidden xl:flex' : 'flex'
          }`}
        >
          {/* Header & Filter Tools */}
          <div className="p-3.5 sm:p-4 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Chats
              </h1>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {totalAssigned} assigned
              </span>
            </div>

            {/* Search Pill */}
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

            {/* EXACT 4 CATEGORY FILTERS: All, Unread, Resolved, Unresolved */}
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
                All ({totalAssigned})
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

          {/* WhatsApp Chats Item List */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 bg-white">
            {filteredTickets.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs flex flex-col items-center">
                <MessageSquare className="w-10 h-10 text-slate-300 mb-2.5 stroke-[1.5]" />
                <p className="font-bold text-slate-700 text-sm">No chats assigned</p>
                <p className="text-slate-400 text-xs mt-1">
                  No conversations under the "{filter}" category.
                </p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = activeTicket?.id === t.id;
                const isUnread = t.hasUnreadAdminReply;
                const lastTime = formatWhatsAppTime(t.lastReplyAt || t.createdAt);
                const rawSnippet = t.lastReplyPreview || t.detail;
                // Pure message snippet with NO ticket number!
                const cleanSnippet = rawSnippet.replace(/^\[PT-[^\]]+\]:\s*/, '');
                const isSystemNotice = cleanSnippet.startsWith('🔄') || cleanSnippet.startsWith('📌');
                const isLastFromAdmin = t.lastSenderRole !== 'student' && Boolean(t.lastReplyAt);
                const studentFirstName = t.studentName ? t.studentName.trim().split(' ')[0] : 'Student';
                const isSeenByStudent = !t.hasUnreadStudentReply;

                return (
                  <div
                    key={t.id}
                    onTouchStart={() => handleTouchStart(t)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    onMouseDown={() => handleTouchStart(t)}
                    onMouseUp={handleTouchEnd}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openDeleteModal(t);
                    }}
                    onClick={() => handleChatClick(t)}
                    className={`group relative px-4 py-3.5 flex items-center gap-3 cursor-pointer transition-colors border-b border-slate-50 select-none ${
                      isSelected
                        ? 'bg-[#f0f2f5]'
                        : 'hover:bg-[#f5f6f6] active:bg-[#e9edef]'
                    }`}
                  >
                    {/* Student DP (Avatar) */}
                    <div className="relative shrink-0">
                      {t.studentAvatarUrl ? (
                        <img
                          src={t.studentAvatarUrl}
                          alt={t.studentName}
                          className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-2xs"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-base shadow-2xs">
                          {(t.studentName || t.studentEmail || 'S').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Chat Item Metadata: Name on top, Snippet below */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h3 className="font-bold text-slate-900 text-sm truncate">
                          {t.studentName || t.studentEmail?.split('@')[0] || 'Student'}
                        </h3>
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-[11px] tabular-nums shrink-0 font-medium ${
                              isUnread ? 'text-[#25d366] font-bold' : 'text-slate-400'
                            }`}
                          >
                            {lastTime}
                          </span>
                          {/* Quick Delete for Me action button on desktop hover / long-press hint */}
                          <button
                            type="button"
                            title="Delete chat for me (Long press or click)"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteModal(t);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 text-slate-400 hover:text-rose-600 rounded transition-opacity cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <div
                          className={`text-xs truncate flex items-center gap-1 min-w-0 ${
                            isUnread ? 'font-bold text-slate-900' : 'text-slate-500'
                          }`}
                        >
                          {isSystemNotice ? (
                            <span className="truncate">{cleanSnippet}</span>
                          ) : isLastFromAdmin ? (
                            <>
                              <CheckCheck
                                className={`w-3.5 h-3.5 shrink-0 ${isSeenByStudent ? 'text-blue-500' : 'text-slate-400'}`}
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
                              <span className="font-semibold text-slate-700 shrink-0">{studentFirstName}:</span>
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

                        {/* Unread Circular Green Badge */}
                        {isUnread && (
                          <span className="w-5 h-5 rounded-full bg-[#25d366] text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 shadow-2xs">
                            1
                          </span>
                        )}
                      </div>

                      {/* Subtle qualification and category tag */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] font-semibold text-pink-700 bg-pink-50 border border-pink-100 px-2 py-0.2 rounded-md truncate max-w-[150px]">
                          {t.categoryName}
                        </span>
                        {t.studentQualification && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-md truncate max-w-[120px]">
                            {t.studentQualification}
                          </span>
                        )}
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
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: CONVERSATION & STUDENT PROFILE */}
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
              onUpdateTicketStatus={handleTicketUpdated}
              onClose={handleCloseChat}
            />
          ) : (
            <div className="h-full bg-[#f0f2f5] flex flex-col items-center justify-center text-center p-8 border-l border-slate-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4 shadow-sm">
                <MessageSquare className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                Assigned Chats
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                Select a student chat from the list to view their query, send text or voice notes, and tap their name to see profile details.
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
                  {deleteModalTicket.studentName || 'Student'} ({deleteModalTicket.ticketNumber})
                </p>
              </div>
            </div>

            <div className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  This conversation will only be removed from your view. The student will retain their copy for counseling records.
                </p>

                {deleteError && (
                  <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{deleteError}</p>
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
          </div>
        </div>
      )}
    </div>
  );
};
