import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { QueryTicket, CategoryItem, formatRoleName } from '../../types';
import { useLiveQueries, useApiResource } from '../../lib/liveData';
import { sortCategoriesGeneralFirst } from '../../constants/officialCategories';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  CheckCircle2,
  Clock,
  FolderTree,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Award,
  Star,
} from 'lucide-react';

interface AdminAnalyticsDashboardProps {
  onNavigateTab: (tab: string) => void;
  onOpenTicket?: (ticket: QueryTicket) => void;
}

export const AdminAnalyticsDashboard: React.FC<AdminAnalyticsDashboardProps> = ({
  onNavigateTab,
  onOpenTicket,
}) => {
  const { userProfile } = useAuth();
  // userProfile is kept live by the socket (profile:update), so newly allotted
  // categories show up without a separate listener.
  const liveProfile = userProfile;
  // Normal admins: assigned + claimable tickets in their categories; managers: assigned to them.
  const myUidForFilter = userProfile?.uid || '';
  const isManager = userProfile?.role === 'expert_admin' || userProfile?.role === 'super_admin';
  const { queries: assignedTickets } = useLiveQueries({
    enabled: Boolean(myUidForFilter),
    // Managers receive pushes for every ticket; keep only the ones assigned to them.
    filter: isManager ? (t) => t.expertId === myUidForFilter : undefined,
  });
  const { data: categoryList } = useApiResource<CategoryItem[]>('/categories', ['categories'], []);
  const allCategories = useMemo(() => sortCategoriesGeneralFirst(categoryList), [categoryList]);

  // Analytics Computations
  // 1. Unique students this admin has counseled / dealt with
  const uniqueStudentIds = new Set(
    assignedTickets.map((t) => t.studentId).filter(Boolean)
  );
  const studentsDealtCount = uniqueStudentIds.size;

  // 2. Replied queries
  const repliedCount = assignedTickets.filter(
    (t) => t.status === 'replied' || (t.lastReplyAt && t.lastSenderRole !== 'student')
  ).length;

  // 3. Pending / Unresolved queries (open or in progress)
  const unresolvedCount = assignedTickets.filter(
    (t) => t.status !== 'resolved'
  ).length;

  // 4. Resolved queries successfully completed
  const resolvedCount = assignedTickets.filter(
    (t) => t.status === 'resolved'
  ).length;

  // Total active or closed student dealing tickets
  const totalHandled = assignedTickets.length;

  // Resolution Rate Percentage
  const resolutionRate =
    totalHandled > 0 ? Math.round((resolvedCount / totalHandled) * 100) : 0;

  // Categories allotted to this admin by Super Admin / Expert Admin (matching UID, email, and profile array)
  const activeProfile = liveProfile || userProfile;
  const myUid = (activeProfile?.uid || '').toLowerCase().trim();
  const myEmail = (activeProfile?.email || '').toLowerCase().trim();
  const myCategories = Array.isArray(activeProfile?.assignedCategories) ? activeProfile.assignedCategories : [];

  const allottedCategories = allCategories.filter((cat) => {
    const adminIds = Array.isArray(cat.assignedAdminIds)
      ? cat.assignedAdminIds.map((id) => (id || '').toLowerCase().trim())
      : [];

    const isAssignedInCat =
      adminIds.includes(myUid) ||
      adminIds.includes(myEmail) ||
      (cat.primaryAdminId && (cat.primaryAdminId.toLowerCase() === myUid || cat.primaryAdminId.toLowerCase() === myEmail));

    const isAssignedInProfile =
      myCategories.includes(cat.id) ||
      myCategories.some((cId) => cId.toLowerCase() === cat.id.toLowerCase() || cId.toLowerCase() === cat.name.toLowerCase());

    return isAssignedInCat || isAssignedInProfile;
  });

  // Recent 4 active tickets for quick access
  const pendingAttentionTickets = assignedTickets
    .filter((t) => t.status !== 'resolved')
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* 1. WELCOME & PERFORMANCE SUMMARY HEADER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Welcome back, {activeProfile?.displayName || 'Advisor'}!
            </h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Active Counselor
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {activeProfile?.professionalTitle || 'Educational Guidance Mentor'}
            {activeProfile?.shortDescription && (
              <span className="text-slate-400 font-normal block sm:inline sm:ml-2 line-clamp-1">
                · {activeProfile.shortDescription}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-700">Online & Active Mentor</span>
        </div>
      </div>

      {/* 2. ANALYTICS & KEY PERFORMANCE INDICATORS GRID (4 EXACT CARDS) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Counseling Analytics & Student Dealings</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            Resolution Rate: <strong className="text-emerald-700">{resolutionRate}%</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Students Dealt With */}
          <div
            className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 shadow-xs transition-colors"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Students Dealt</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
              {studentsDealtCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Unique students guided</p>
          </div>

          {/* Card 2: Replied Queries */}
          <div
            className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 shadow-xs transition-colors"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Replied</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-blue-700 tabular-nums">
              {repliedCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Answered student queries
            </p>
          </div>

          {/* Card 3: Unresolved / In Progress */}
          <div
            className="bg-white border border-slate-200 hover:border-amber-300 rounded-2xl p-4 shadow-xs transition-colors"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Unresolved</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 tabular-nums">
              {unresolvedCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Awaiting completion / in progress</p>
          </div>

          {/* Card 4: Resolved Queries */}
          <div
            className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 shadow-xs transition-colors"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Resolved</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tabular-nums">
              {resolvedCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Closed successfully</p>
          </div>
        </div>
      </div>

      {/* 3. ALLOTTED DISCIPLINES & CATEGORIES SECTION */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-pink-600" />
              <span>My Allotted Guidance Disciplines & Categories</span>
              <span className="text-xs bg-pink-50 text-pink-700 font-bold px-2 py-0.5 rounded-full border border-pink-200">
                {allottedCategories.length} Allotted
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Super Admin and Expert Admins have assigned you to mentor students asking queries under these disciplines:
            </p>
          </div>

          <span className="text-xs text-slate-400 self-start sm:self-auto font-medium">
            Managed by Executive Admins
          </span>
        </div>

        {allottedCategories.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center">
            <FolderTree className="w-8 h-8 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">No Specific Categories Restricted</p>
            <p className="text-slate-400 text-[11px] max-w-sm mt-1">
              You currently have unrestricted access or an executive has not locked specific disciplines to your profile. You can receive general student queries.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {allottedCategories.map((cat, idx) => {
              const isPrimary = cat.primaryAdminId === userProfile?.uid;
              const catQueriesCount = assignedTickets.filter(
                (t) => t.categoryId === cat.id
              ).length;
              const catUnresolved = assignedTickets.filter(
                (t) => t.categoryId === cat.id && t.status !== 'resolved'
              ).length;

              return (
                <div
                  key={cat.id}
                  className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200 hover:border-pink-300 rounded-xl p-4 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold text-slate-400">
                        #{idx + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isPrimary && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200">
                            <ShieldCheck className="w-3 h-3 text-pink-600" />
                            Primary Lead
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900">{cat.name}</h3>
                    {cat.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {cat.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Assigned: <strong className="text-slate-800">{catQueriesCount}</strong> ({catUnresolved} pending)
                    </span>

                    <button
                      type="button"
                      onClick={() => onNavigateTab('assigned-queries')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                    >
                      <span>View Chats</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. ACTIVE CONVERSATIONS QUEUE & QUICK ASSISTANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pending Student Chats Needing Attention */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Active Queries Requiring Response</span>
                {unresolvedCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-800">
                    {unresolvedCount} Pending
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Students waiting for career guidance or recent questions</p>
            </div>

            <button
              onClick={() => onNavigateTab('assigned-queries')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              View All →
            </button>
          </div>

          {pendingAttentionTickets.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
              <p className="font-semibold text-slate-700">All assigned queries are resolved!</p>
              <p className="text-slate-400 text-[11px] mt-0.5">Great job staying on top of your student messages.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingAttentionTickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    if (onOpenTicket) onOpenTicket(t);
                    else onNavigateTab('assigned-queries');
                  }}
                  className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-50/80 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {(t.studentName || t.studentEmail || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {t.studentName || t.studentEmail?.split('@')[0] || 'Student'}
                        </h4>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium truncate">
                          {t.categoryName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        <span className="font-semibold text-slate-700 mr-1">[{t.ticketNumber}]:</span>
                        {t.lastReplyPreview || t.detail}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        t.hasUnreadAdminReply
                          ? 'bg-[#25d366] text-white'
                          : t.status === 'in_progress'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {t.hasUnreadAdminReply ? 'NEW MESSAGE' : t.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-emerald-700 transition-colors"
                      title="Open Chat"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Counselor Best Practices & Quality Standards */}
        <div className="bg-gradient-to-br from-emerald-50/60 to-pink-50/40 border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-5 h-5 text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">Counselor Quality Standards</h3>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span>
                  <strong>24-Hour SLA</strong>: Please respond to all newly allotted queries within 24 hours to prevent backlog.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span>
                  <strong>Voice Notes</strong>: For complex roadmaps (e.g. aggregate criteria, CAF, syllabus), students love 1–2 min voice notes.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span>
                  <strong>Marking Resolved</strong>: Once the student's academic doubt is completely answered, change the status dropdown to <em>Resolved</em>.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Prep Titans Counseling Network
            </span>
            <span className="text-[11px] font-medium bg-white border border-emerald-200 text-emerald-700 px-2.5 py-0.5 rounded-full">
              Verified Mentor
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
