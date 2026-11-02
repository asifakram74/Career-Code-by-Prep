import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { QueryTicket, UserProfile, formatRoleName } from '../../types';
import { ConversationView } from '../common/ConversationView';
import { CustomSelect } from '../common/CustomSelect';
import { api, errorMessage } from '../../lib/api';
import { useLiveQueries, useApiResource, sortByActivity } from '../../lib/liveData';
import { navigationHistory } from '../../lib/navigationHistory';
import {
  Search,
  MessageSquare,
  ArrowLeft,
  User,
  ShieldCheck,
  RefreshCw,
  Filter,
  Mic,
} from 'lucide-react';

export const AllQueriesDirectory: React.FC = () => {
  const { userProfile } = useAuth();
  const { queries, setQueries } = useLiveQueries({ scope: 'all' });
  const { data: adminList } = useApiResource<UserProfile[]>('/admins', ['users'], []);
  const admins = useMemo(
    () => [...adminList].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')),
    [adminList]
  );
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  // Directly derive activeTicket from the reactive queries state
  // This guarantees 100% synchronization between the outer list and inner chat
  const activeTicket = queries.find((t) => t.id === activeTicketId) || null;

  // Filters: Exactly unread, unresolved, resolved (+ all) & expert filter
  const [filter, setFilter] = useState<'all' | 'unread' | 'unresolved' | 'resolved'>('all');
  const [expertFilter, setExpertFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reassignment Modal
  const [reassigningTicket, setReassigningTicket] = useState<QueryTicket | null>(null);
  const [newExpertId, setNewExpertId] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignError, setReassignError] = useState('');

  const handleChatClick = (t: QueryTicket) => {
    setActiveTicketId(t.id);
    navigationHistory.openChat(t.id, 'all-queries', 'super-overview');
  };

  const handleCloseChat = () => {
    setActiveTicketId(null);
    navigationHistory.closeChat();
  };

  useEffect(() => {
    const handlePopState = () => {
      if (activeTicketId) {
        setActiveTicketId(null);
      }
    };
    const handleCustomClose = () => {
      setActiveTicketId(null);
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('app:close-chat', handleCustomClose);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('app:close-chat', handleCustomClose);
    };
  }, [activeTicketId]);

  /** Replaces tickets in the local list with fresh copies returned by the server. */
  const upsertLocal = (...tickets: QueryTicket[]) => {
    setQueries((prev) => {
      const ids = new Set(tickets.map((t) => t.id));
      return sortByActivity([...tickets, ...prev.filter((q) => !ids.has(q.id))]);
    });
  };

  const handleReassign = async () => {
    if (!reassigningTicket || !newExpertId) return;
    if (reassigningTicket.assignmentStatus === 'reassigned') {
      setReassignError('This ticket has already been reassigned.');
      return;
    }
    setReassignLoading(true);
    setReassignError('');
    try {
      const res = await api.post<{ oldTicket: QueryTicket; targetTicket: QueryTicket; merged: boolean }>(
        `/queries/${encodeURIComponent(reassigningTicket.id)}/reassign`,
        { newExpertId }
      );
      upsertLocal(res.oldTicket, res.targetTicket);
      setReassigningTicket(null);
      setNewExpertId('');
    } catch (err) {
      setReassignError(errorMessage(err, 'Failed to reassign the ticket.'));
    } finally {
      setReassignLoading(false);
    }
  };

  // Filter counts
  const unreadCount = queries.filter((q) => q.hasUnreadAdminReply || q.hasUnreadStudentReply).length;
  const unresolvedCount = queries.filter((q) => q.status !== 'resolved').length;
  const resolvedCount = queries.filter((q) => q.status === 'resolved').length;

  const filteredQueries = queries.filter((q) => {
    const text = `${q.ticketNumber} ${q.studentName} ${q.title} ${q.expertName} ${q.categoryName}`.toLowerCase();
    if (!text.includes(searchQuery.toLowerCase())) return false;

    if (expertFilter !== 'all' && q.expertId !== expertFilter) return false;

    if (filter === 'unread') return q.hasUnreadAdminReply || q.hasUnreadStudentReply;
    if (filter === 'unresolved') return q.status !== 'resolved';
    if (filter === 'resolved') return q.status === 'resolved';
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
    const isYesterday =
      date.getDate() === now.getDate() - 1 &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      {/* Executive Oversight Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Staff Chats & Queries Oversight</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              {queries.length} Total Platform Chats
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Executive section to view other counselors' student conversations, inspect replies, send guidance, or reassign tickets.
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-xl font-semibold">
            Unread: {unreadCount}
          </div>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-xl font-semibold">
            Pending: {unresolvedCount}
          </div>
          <div className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1 rounded-xl font-semibold">
            Resolved: {resolvedCount}
          </div>
        </div>
      </div>

      {/* CHATS MASTER-DETAIL CONTAINER */}
      <div className="bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 xl:grid-cols-12 h-[calc(100dvh-130px)] min-h-[500px] xl:h-[calc(100vh-180px)] xl:min-h-[580px] max-h-[850px]">
        {/* LEFT PANEL: CHATS DIRECTORY */}
        <div
          className={`xl:col-span-5 border-r border-slate-200 flex flex-col h-full min-h-0 bg-white ${
            activeTicket ? 'hidden xl:flex' : 'flex'
          }`}
        >
          {/* Header & Filter Controls */}
          <div className="p-3 sm:p-4 bg-[#f0f2f5] border-b border-slate-200 shrink-0 space-y-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student, ticket, or counselor..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs placeholder-slate-400"
              />
            </div>

            {/* Counselor Filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 shrink-0">Counselor:</span>
              <div className="flex-1 min-w-0">
                <CustomSelect
                  value={expertFilter}
                  onChange={(val) => setExpertFilter(val)}
                  options={[
                    { value: 'all', label: `All Counselors & Admins (${admins.length})` },
                    ...admins.map((a) => ({
                      value: a.uid,
                      label: a.displayName || 'Advisor',
                      sublabel: a.professionalTitle || formatRoleName(a.role),
                    })),
                  ]}
                  size="sm"
                  searchable
                />
              </div>
            </div>

            {/* EXACT 3 CATEGORY FILTER PILLS: unread, unresolved, resolved (+ all) */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-0.5">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer shrink-0 ${
                  filter === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
                }`}
              >
                All ({queries.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                  filter === 'unread'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setFilter('unresolved')}
                className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer shrink-0 ${
                  filter === 'unresolved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Unresolved ({unresolvedCount})
              </button>
              <button
                onClick={() => setFilter('resolved')}
                className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer shrink-0 ${
                  filter === 'resolved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Resolved ({resolvedCount})
              </button>
            </div>
          </div>

          {/* WhatsApp Chats Item List */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
            {filteredQueries.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center">
                <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
                <p className="font-semibold text-slate-600">No chats found</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  No conversations match the "{filter}" filter.
                </p>
              </div>
            ) : (
              filteredQueries.map((t) => {
                const isSelected = activeTicket?.id === t.id;
                const isUnread = t.hasUnreadAdminReply || t.hasUnreadStudentReply;
                const lastTime = formatWhatsAppTime(t.lastReplyAt || t.createdAt);
                const rawSnippet = (t.lastReplyPreview || t.detail || '').replace(/^\[PT-[^\]]+\]:\s*/, '');
                const isSystemNotice = rawSnippet.startsWith('🔄') || rawSnippet.startsWith('📌');

                // Determine replier name (who sent the last message)
                let replierName = '';
                if (t.lastSenderName) {
                  replierName = t.lastSenderName.trim().split(' ')[0];
                } else if (t.lastSenderRole === 'student' || (!t.lastSenderRole && !t.lastReplyAt)) {
                  replierName = t.studentName ? t.studentName.trim().split(' ')[0] : 'Student';
                } else {
                  replierName = t.expertName
                    ? t.expertName.trim().split(' ')[0]
                    : t.assignedAdminName
                    ? t.assignedAdminName.trim().split(' ')[0]
                    : 'Counselor';
                }

                const isVoice = rawSnippet.includes('🎤') || (!t.lastReplyPreview && Boolean(t.audioUrl));
                const displaySnippet = rawSnippet.replace(/^🎤\s*(Voice Note|Voice Message)?[:\s]*/i, '').trim();

                return (
                  <div
                    key={t.id}
                    onClick={() => handleChatClick(t)}
                    className={`px-3.5 py-3 flex items-center gap-3 cursor-pointer transition-colors select-none border-b border-slate-100 ${
                      isSelected
                        ? 'bg-[#f0f2f5]'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Student DP */}
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
                      {isUnread && (
                        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-300" />
                      )}
                    </div>

                    {/* Chat Item Content */}
                    <div className="flex-1 min-w-0">
                      {/* Name on top with ticket number badge */}
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="font-bold text-slate-900 text-sm truncate">
                            {t.studentName || t.studentEmail?.split('@')[0] || 'Student'}
                          </h3>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono font-medium shrink-0">
                            #{t.ticketNumber}
                          </span>
                        </div>
                        <span
                          className={`text-[11px] tabular-nums shrink-0 font-medium ${
                            isUnread ? 'text-[#25d366] font-bold' : 'text-slate-400'
                          }`}
                        >
                          {lastTime}
                        </span>
                      </div>

                      {/* Message preview: Shows who replied (replier name) with message text, NO ticket number prefix */}
                      <div className="flex items-center justify-between gap-1">
                        <div
                          className={`text-xs truncate flex items-center gap-1 min-w-0 ${
                            isUnread ? 'font-bold text-slate-900' : 'text-slate-600'
                          }`}
                        >
                          {isSystemNotice ? (
                            <span className="truncate">{rawSnippet}</span>
                          ) : (
                            <>
                              <span className="font-semibold text-slate-800 shrink-0">
                                {replierName}:
                              </span>
                              {isVoice ? (
                                <span className="text-emerald-700 font-semibold inline-flex items-center gap-1 shrink-0">
                                  <Mic className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Voice Note{displaySnippet ? ` (${displaySnippet})` : ''}</span>
                                </span>
                              ) : (
                                <span className="truncate text-slate-600">
                                  {displaySnippet || rawSnippet}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Unread badge */}
                        {isUnread && (
                          <span className="w-5 h-5 rounded-full bg-[#25d366] text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs">
                            1
                          </span>
                        )}
                      </div>

                      {/* Counselor badge & Reassign shortcut */}
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-[10px] text-slate-500 font-medium truncate">
                          Assigned: <strong className="text-slate-800">{t.expertName}</strong>
                          {t.categoryName ? ` • ${t.categoryName}` : ''}
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.assignmentStatus !== 'reassigned' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReassignError('');
                                setReassigningTicket(t);
                              }}
                              className="text-[10px] text-pink-600 hover:text-pink-800 font-bold px-1.5 py-0.5 rounded hover:bg-pink-50 cursor-pointer"
                            >
                              Reassign
                            </button>
                          )}
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                              t.assignmentStatus === 'reassigned'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : t.status === 'resolved'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {t.assignmentStatus === 'reassigned'
                              ? 'REASSIGNED'
                              : t.status === 'resolved'
                              ? 'RESOLVED'
                              : 'UNRESOLVED'}
                          </span>
                        </div>
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
              : 'fixed top-0 left-0 right-0 z-50 xl:relative xl:top-auto xl:left-auto xl:right-auto xl:z-auto flex flex-col w-full bg-[#efeae2] animate-slide-in-right shadow-2xl overflow-hidden'
          }`}
          style={{
            height: typeof window !== 'undefined' && window.innerWidth < 1280 ? 'var(--chat-visual-height, 100%)' : '100%',
            maxHeight: typeof window !== 'undefined' && window.innerWidth < 1280 ? 'var(--chat-visual-height, 100%)' : '100%',
          }}
        >
          {activeTicket ? (
            <div className="h-full min-h-0 flex flex-col">
              {/* Oversight Management Bar (Desktop view; ConversationView already has built-in mobile controls) */}
              <div className="hidden sm:flex px-3 py-1.5 bg-slate-100 border-b border-slate-200 items-center justify-between text-xs shrink-0">
                <span className="text-[11px] text-slate-600 font-medium truncate mr-2">
                  Assigned: <strong className="text-slate-800">{activeTicket.expertName}</strong> ({activeTicket.categoryName})
                </span>
                <button
                  type="button"
                  disabled={activeTicket.assignmentStatus === 'reassigned'}
                  onClick={() => {
                    setReassignError('');
                    setReassigningTicket(activeTicket);
                  }}
                  className="disabled:opacity-50 disabled:cursor-not-allowed text-xs text-pink-700 hover:text-pink-800 font-bold px-2.5 py-1 bg-white border border-pink-200 hover:bg-pink-50 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  Reassign Ticket
                </button>
              </div>

              <div className="flex-1 min-h-0">
                <ConversationView
                  ticket={activeTicket}
                  isOversight={true}
                  onClose={handleCloseChat}
                  onUpdateTicketStatus={(updated: QueryTicket) => upsertLocal(updated)}
                />
              </div>
            </div>
          ) : (
            <div className="h-full bg-[#f0f2f5] flex flex-col items-center justify-center text-center p-8 border-l border-slate-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4 shadow-sm">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                Staff Chats Oversight Directory
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                Select any student-counselor conversation to inspect messages, play voice notes, view student profile details, or reply directly.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* REASSIGN TICKET MODAL */}
      {reassigningTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Reassign Query Ticket
            </h3>
            <p className="text-slate-600 mb-3">
              Reassign ticket <strong className="text-slate-900">{reassigningTicket.ticketNumber}</strong> ({reassigningTicket.title}) to an active counselor.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Currently Assigned:</label>
                <p className="text-slate-800 font-medium p-2 bg-slate-100 rounded-lg">
                  {reassigningTicket.expertName} ({formatRoleName(reassigningTicket.expertRole)})
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select New Expert Advisor:</label>
                <CustomSelect
                  value={newExpertId}
                  onChange={(val) => setNewExpertId(val)}
                  options={[
                    { value: '', label: 'Choose active advisor' },
                    ...admins
                      .filter((a) => a.uid !== reassigningTicket.expertId && a.status === 'active')
                      .map((a) => ({
                        value: a.uid,
                        label: a.displayName || 'Advisor',
                        sublabel: a.professionalTitle || formatRoleName(a.role),
                      })),
                  ]}
                  placeholder="Choose active advisor"
                  size="sm"
                  searchable
                />
              </div>

              {reassignError && (
                <p className="text-rose-600 font-medium bg-rose-50 border border-rose-200 rounded-lg p-2">{reassignError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setReassigningTicket(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!newExpertId || reassignLoading || reassigningTicket.assignmentStatus === 'reassigned'}
                  onClick={handleReassign}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {reassignLoading ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
