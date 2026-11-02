import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { QueryTicket, SavedAnswerItem } from '../../types';
import { api, errorMessage } from '../../lib/api';
import { useLiveQueries } from '../../lib/liveData';
import { onReconnect, onSocket } from '../../lib/socket';
import { CustomSelect } from '../common/CustomSelect';
import {
  Calendar,
  Clock,
  Search,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  FileText,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

interface HistorySectionProps {
  onOpenTicket: (ticket: QueryTicket) => void;
  onNavigateTab: (tab: string) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  onOpenTicket,
  onNavigateTab,
}) => {
  const { userProfile } = useAuth();
  const uid = userProfile?.uid;
  const { queries } = useLiveQueries({
    enabled: Boolean(uid),
    filter: (q) => q.studentId === uid,
  });
  // History is ordered by submission date, newest first
  const tickets = useMemo(
    () => [...queries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [queries]
  );
  const [savedAnswers, setSavedAnswers] = useState<{ id: string; queryId: string }[]>([]);
  const savedQueryIds = useMemo(() => savedAnswers.map((s) => s.queryId), [savedAnswers]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Saved answers, to show bookmark status
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const load = () =>
      api
        .get<SavedAnswerItem[]>('/saved-answers')
        .then((items) => {
          if (!cancelled) setSavedAnswers(items.map((i) => ({ id: i.id, queryId: i.queryId })));
        })
        .catch((err) => console.error('Failed to load saved answers:', errorMessage(err)));
    load();
    const offUpsert = onSocket<SavedAnswerItem>('saved-answer:upsert', (item) => {
      setSavedAnswers((prev) => [...prev.filter((x) => x.id !== item.id), { id: item.id, queryId: item.queryId }]);
    });
    const offDeleted = onSocket<{ id: string }>('saved-answer:deleted', ({ id }) => {
      setSavedAnswers((prev) => prev.filter((x) => x.id !== id));
    });
    const offReconnect = onReconnect(load);
    return () => {
      cancelled = true;
      offUpsert();
      offDeleted();
      offReconnect();
    };
  }, [uid]);

  // Active non-deleted queries for this student (retained until student deletes them)
  const activeTickets = tickets.filter(
    (t) => !Array.isArray(t.deletedForUsers) || !t.deletedForUsers.includes(userProfile?.uid || '')
  );

  const filteredTickets = activeTickets.filter((t) => {
    const needle = searchQuery.toLowerCase();
    const matchesSearch =
      (t.title || '').toLowerCase().includes(needle) ||
      (t.ticketNumber || '').toLowerCase().includes(needle) ||
      (t.categoryName || '').toLowerCase().includes(needle) ||
      (t.expertName || '').toLowerCase().includes(needle);

    if (!matchesSearch) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  const handleSaveAnswer = async (ticket: QueryTicket, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile) return;
    try {
      const item = await api.post<SavedAnswerItem>('/saved-answers', {
        queryId: ticket.id,
        queryTitle: ticket.title || '',
        categoryName: ticket.categoryName || '',
        expertName: ticket.expertName || '',
        questionText: ticket.detail || '',
        answerText: ticket.lastReplyPreview || 'Refer to conversation history.',
      });
      setSavedAnswers((prev) => [...prev.filter((x) => x.id !== item.id), { id: item.id, queryId: item.queryId }]);
    } catch (err) {
      console.error('Failed to save answer:', errorMessage(err));
      alert(errorMessage(err, 'Could not save this answer. Please try again.'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Retention Policy Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900">
              Query History & Consultations
            </span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-100">
              Saved in Account
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            All your career guidance consultations and discussions remain safely saved in your account until you delete them.
            Use the <strong>Save Answer</strong> button to quickly bookmark key replies.
          </p>
        </div>

        <div className="text-right shrink-0 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
          <span className="text-[11px] text-slate-400 block">Total Active Queries</span>
          <span className="font-bold text-slate-700 tabular-nums">{activeTickets.length} queries</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ticket #, question title, category, or expert..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2 min-w-[140px]">
          <CustomSelect
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'replied', label: 'Replied' },
              { value: 'resolved', label: 'Resolved' },
            ]}
            size="sm"
            className="w-full"
          />
        </div>
      </div>

      {/* History Query Cards */}
      <div className="space-y-3">
        {filteredTickets.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-400">
            No queries found in your history.
          </div>
        ) : (
          filteredTickets.map((t) => {
            const isSaved = savedQueryIds.includes(t.id);

            return (
              <div
                key={t.id}
                onClick={() => onOpenTicket(t)}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-pink-200 transition-colors cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-pink-700 bg-pink-100/70 px-2 py-0.5 rounded">
                      {t.ticketNumber}
                    </span>
                    <span className="text-xs text-slate-600 font-semibold">{t.categoryName}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-500 font-normal">
                      Advisor: <strong className="font-semibold text-slate-800">{t.expertName}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        t.status === 'resolved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : t.status === 'replied'
                          ? 'bg-pink-50 text-pink-700 border border-pink-200'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {(t.status || '').replace('_', ' ').toUpperCase()}
                    </span>

                    <button
                      onClick={(e) => handleSaveAnswer(t, e)}
                      disabled={isSaved}
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        isSaved
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>Save Answer</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="text-sm font-bold text-slate-900">{t.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                    {t.detail}
                  </p>
                </div>

                {t.lastReplyPreview && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <span className="font-semibold text-slate-800 block text-[11px] mb-0.5">
                      Expert Guidance Preview:
                    </span>
                    <p className="text-slate-600 italic line-clamp-2">"{t.lastReplyPreview}"</p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>
                      Submitted: <strong className="text-slate-600 font-medium tabular-nums">{new Date(t.createdAt).toLocaleDateString()}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Last Updated: <strong className="text-slate-600 font-medium tabular-nums">{new Date(t.updatedAt || t.createdAt).toLocaleDateString()}</strong>
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-500 font-medium">
                    Category: <strong className="text-slate-700">{t.categoryName}</strong>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
