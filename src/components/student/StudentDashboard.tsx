import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { QueryTicket } from '../../types';
import { useLiveQueries } from '../../lib/liveData';
import {
  PlusCircle,
  MessageSquare,
  Clock,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Bookmark,
  Calendar,
  HardDrive,
  BookOpen,
  Star,
} from 'lucide-react';
import { SubmitReviewModal } from '../common/SubmitReviewModal';

interface StudentDashboardProps {
  onNavigateTab: (tab: string) => void;
  onOpenTicket: (ticket: QueryTicket) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onNavigateTab,
  onOpenTicket,
}) => {
  const { userProfile } = useAuth();
  const uid = userProfile?.uid;
  const { queries: tickets } = useLiveQueries({
    enabled: Boolean(uid),
    filter: (q) => q.studentId === uid,
  });
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Active non-deleted tickets for this student
  const activeTickets = tickets.filter(
    (t) => !Array.isArray(t.deletedForUsers) || !t.deletedForUsers.includes(userProfile?.uid || '')
  );

  // Real Database Metrics based on active non-deleted tickets
  const totalQueries = activeTickets.length;
  const newReplies = activeTickets.filter((t) => t.hasUnreadStudentReply).length;
  const pendingReplies = activeTickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
  const inProgressCount = activeTickets.filter((t) => t.status === 'in_progress').length;
  const resolvedQueries = activeTickets.filter((t) => t.status === 'resolved').length;

  const recentQueries = activeTickets.slice(0, 5);
  const waitingForAnswer = activeTickets.filter((t) => t.status === 'open' || t.status === 'in_progress').slice(0, 3);
  const latestReplies = activeTickets.filter((t) => t.status === 'replied' || t.hasUnreadStudentReply).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Personalized Welcome & Quick Action Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Welcome back, {userProfile?.displayName || 'Student'}!
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Academic Track: <span className="font-semibold text-slate-700">{userProfile?.qualification}</span>
            {userProfile?.qualificationDetail && ` (${userProfile.qualificationDetail})`}
            {userProfile?.board && ` · ${userProfile.board}`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowReviewModal(true)}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 text-xs font-semibold rounded-xl shadow-2xs transition-colors shrink-0 cursor-pointer"
          >
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            Submit a Review
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('new-query')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-pink-200 transition-colors shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Submit a New Query
          </button>
        </div>
      </div>

      {/* Real Counts Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5">
        <div
          onClick={() => onNavigateTab('history')}
          className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs hover:border-pink-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Queries</span>
            <HelpCircle className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 tabular-nums">{totalQueries}</p>
        </div>

        <div
          onClick={() => onNavigateTab('replies')}
          className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs hover:border-pink-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">New Replies</span>
            <MessageSquare className="w-4 h-4 text-pink-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-pink-700 mt-2 tabular-nums">{newReplies}</p>
        </div>

        <div
          onClick={() => onNavigateTab('replies')}
          className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs hover:border-pink-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">Pending Replies</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-2 tabular-nums">{pendingReplies}</p>
        </div>

        <div
          onClick={() => onNavigateTab('replies')}
          className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs hover:border-pink-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">In Progress</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-2 tabular-nums">{inProgressCount}</p>
        </div>

        <div
          onClick={() => onNavigateTab('history')}
          className="col-span-2 sm:col-span-1 bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs hover:border-pink-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">Resolved</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-2 tabular-nums">{resolvedQueries}</p>
        </div>
      </div>

      {/* Main Grid: Recent Activity & Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Queries */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Recent Queries</h2>
            <button
              onClick={() => onNavigateTab('history')}
              className="text-xs text-pink-600 hover:text-pink-800 font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              View all history <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentQueries.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No career queries submitted yet. Click "Submit a New Query" to get expert guidance.
              </div>
            ) : (
              recentQueries.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onOpenTicket(t)}
                  className="py-3.5 px-2 hover:bg-pink-50/40 rounded-xl transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-pink-700 bg-pink-100/70 px-2 py-0.5 rounded">
                        {t.ticketNumber}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">{t.categoryName}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-500 font-medium truncate max-w-[160px]">
                        Counselor: <strong className="text-slate-700">{t.expertName}</strong>
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 truncate">{t.title}</h3>
                    {t.lastReplyPreview && (
                      <p className="text-xs text-slate-600 truncate mt-1">
                        Latest: {t.lastReplyPreview}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        t.status === 'resolved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : t.status === 'replied'
                          ? 'bg-pink-50 text-pink-700 border border-pink-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {(t.status || '').replace('_', ' ').toUpperCase()}
                    </span>
                    <p className="text-xs text-slate-400 sm:mt-1 tabular-nums">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Latest Replies & Saved Shortcuts */}
        <div className="space-y-6">
          {/* Latest Replies */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">
              Latest Counselor Replies
            </h2>
            <div className="divide-y divide-slate-100">
              {latestReplies.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No replies received yet.
                </div>
              ) : (
                latestReplies.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => onOpenTicket(r)}
                    className="py-3 hover:bg-pink-50/40 rounded-xl cursor-pointer transition-colors px-1"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-bold text-slate-800">{r.expertName}</span>
                      <span className="tabular-nums text-slate-400">
                        {r.lastReplyAt ? new Date(r.lastReplyAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p className="text-sm text-slate-900 font-semibold truncate mt-1">{r.title}</p>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                      {r.lastReplyPreview || 'Open conversation to view expert reply.'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Informative Articles Card */}
          <div className="bg-gradient-to-br from-rose-500 via-pink-600 to-rose-700 text-white rounded-2xl p-5 shadow-xs shadow-pink-200">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-pink-200" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-pink-100">
                Informative Articles & Mentorship
              </h3>
            </div>
            <p className="text-xs text-pink-100/90 leading-relaxed">
              Read in-depth guides, preparation strategies, and field insights authored directly by our counselors and admins.
            </p>
            <button
              onClick={() => onNavigateTab('articles')}
              className="mt-3 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3.5 py-2 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              Explore Articles
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Career Code Google Drive Card */}
          <div className="bg-gradient-to-br from-pink-700 via-rose-600 to-pink-800 text-white rounded-2xl p-5 shadow-xs shadow-pink-200">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-pink-200" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-pink-100">
                Career Code Drive Resources
              </h3>
            </div>
            <p className="text-xs text-pink-100/90 leading-relaxed">
              Explore field guidance syllabi, official roadmaps, past papers, and counselor audio recordings.
            </p>
            <button
              onClick={() => onNavigateTab('drive')}
              className="mt-3 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3.5 py-2 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              Open Career Drive
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Saved Answers Shortcut */}
          <div className="bg-gradient-to-br from-pink-600 to-rose-700 text-white rounded-2xl p-5 shadow-xs shadow-pink-200">
            <div className="flex items-center gap-2 mb-2">
              <Bookmark className="w-4 h-4 text-pink-200" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-pink-100">
                Knowledge Library & Saved Answers
              </h3>
            </div>
            <p className="text-xs text-pink-100/90 leading-relaxed">
              Bookmarked answers are saved here for instant access whenever you need to revisit important advice.
            </p>
            <button
              onClick={() => onNavigateTab('saved-answers')}
              className="mt-3 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3.5 py-2 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              Open Saved Answers
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Review Submission Modal */}
      <SubmitReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
      />
    </div>
  );
};
