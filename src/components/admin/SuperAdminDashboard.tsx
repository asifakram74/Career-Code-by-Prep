import React, { useMemo } from 'react';
import { useApiResource, useLiveQueries } from '../../lib/liveData';
import { useAuth } from '../../context/AuthContext';
import { UserProfile, QueryTicket, CategoryItem, formatRoleName } from '../../types';
import { sortCategoriesGeneralFirst } from '../../constants/officialCategories';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FolderTree,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';

interface SuperAdminDashboardProps {
  onNavigateTab: (tab: string) => void;
  onOpenTicket: (ticket: QueryTicket) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onNavigateTab,
  onOpenTicket,
}) => {
  const { userProfile } = useAuth();
  const { data: users } = useApiResource<UserProfile[]>('/admin/users', ['users'], []);
  const { queries } = useLiveQueries({ scope: 'all' });
  const { data: rawCategories } = useApiResource<CategoryItem[]>('/categories', ['categories'], []);
  const categories = useMemo(() => sortCategoriesGeneralFirst(rawCategories), [rawCategories]);

  // Real Database Metrics Calculations
  const totalStudents = users.filter((u) => u.role === 'student').length;
  const totalNormalAdmins = users.filter((u) => u.role === 'normal_admin').length;
  const totalExpertAdmins = users.filter((u) => u.role === 'expert_admin').length;
  const totalCategoriesCount = categories.length;

  const totalQueries = queries.length;
  const newQueriesCount = queries.filter((q) => q.status === 'open').length;
  const pendingRepliesCount = queries.filter((q) => q.status === 'open' || q.status === 'in_progress').length;
  const resolvedQueriesCount = queries.filter((q) => q.status === 'resolved').length;
  const unassignedQueriesCount = queries.filter((q) => q.assignmentStatus === 'unassigned' || q.expertId === 'unassigned').length;

  // New Students This Month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const newStudentsThisMonth = users.filter(
    (u) => u.role === 'student' && u.createdAt >= startOfMonth.getTime()
  ).length;

  // Admins Inactive for More Than 24 Hours
  const allAdmins = users.filter((u) => ['normal_admin', 'expert_admin', 'super_admin'].includes(u.role));
  const now = Date.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const inactiveAdminsOver24h = allAdmins.filter(
    (a) => !a.lastActiveAt || now - a.lastActiveAt > TWENTY_FOUR_HOURS_MS
  );

  // Category Popularity Distribution
  const categoryStats = categories.map((cat) => {
    const count = queries.filter((q) => q.categoryId === cat.id).length;
    return { name: cat.name, count };
  });
  categoryStats.sort((a, b) => b.count - a.count);

  // Admin Workload Distribution
  const adminWorkload = allAdmins.map((admin) => {
    const assigned = queries.filter((q) => q.expertId === admin.uid && q.status !== 'resolved').length;
    return { name: admin.displayName, count: assigned, role: admin.role };
  });
  adminWorkload.sort((a, b) => b.count - a.count);

  // Recent Unassigned / New Queries
  // Oldest waiting first, so the longest-unanswered tickets surface at the top.
  const highPriorityQueries = queries
    .filter((q) => q.status === 'open' || q.assignmentStatus === 'unassigned')
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Executive Welcome & Status */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Executive Platform Console
            </h1>
            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
              Expert Admin Authority
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time telemetry across students, expert counseling queues, category distribution, and admin activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigateTab('mentor-dashboard')}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-emerald-200 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>My Mentor Dashboard</span>
          </button>
          <button
            onClick={() => onNavigateTab('all-queries')}
            className="px-3.5 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-pink-200 transition-colors cursor-pointer"
          >
            Manage All Queries
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (All 11 Requested Invariants) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div
          onClick={() => onNavigateTab('student-management')}
          className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-pink-300 transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
            Total Students
          </span>
          <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{totalStudents}</p>
          <span className="text-[10px] text-emerald-600 font-medium">+{newStudentsThisMonth} this month</span>
        </div>

        <div
          onClick={() => onNavigateTab('admin-management')}
          className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-pink-300 transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
            Admins
          </span>
          <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{totalNormalAdmins}</p>
          <span className="text-[10px] text-slate-400">Counselors</span>
        </div>

        <div
          onClick={() => onNavigateTab('admin-management')}
          className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-pink-300 transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
            Expert Admins
          </span>
          <p className="text-xl font-bold text-pink-700 mt-1 tabular-nums">{totalExpertAdmins}</p>
          <span className="text-[10px] text-slate-400">Lead Advisors</span>
        </div>

        <div
          onClick={() => onNavigateTab('category-management')}
          className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-pink-300 transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
            Categories
          </span>
          <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{totalCategoriesCount}</p>
          <span className="text-[10px] text-slate-400">Disciplines</span>
        </div>

        <div
          onClick={() => onNavigateTab('all-queries')}
          className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-pink-300 transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
            Total Queries
          </span>
          <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{totalQueries}</p>
          <span className="text-[10px] text-slate-400">Lifetime</span>
        </div>

        <div
          onClick={() => onNavigateTab('all-queries')}
          className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-amber-400 transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
            Unassigned
          </span>
          <p className="text-xl font-bold text-amber-600 mt-1 tabular-nums">{unassignedQueriesCount}</p>
          <span className="text-[10px] text-amber-600">Pending routing</span>
        </div>
      </div>

      {/* Secondary Status Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
            New Queries
          </span>
          <p className="text-lg font-bold text-pink-700 mt-1 tabular-nums">{newQueriesCount}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
            Pending Replies
          </span>
          <p className="text-lg font-bold text-amber-600 mt-1 tabular-nums">{pendingRepliesCount}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
            Resolved Queries
          </span>
          <p className="text-lg font-bold text-emerald-600 mt-1 tabular-nums">{resolvedQueriesCount}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
            Admins Inactive &gt; 24h
          </span>
          <p className={`text-lg font-bold mt-1 tabular-nums ${inactiveAdminsOver24h.length > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {inactiveAdminsOver24h.length}
          </p>
        </div>
      </div>

      {/* Activity Warning Alert Banner if Admins Inactive > 24 Hours */}
      {inactiveAdminsOver24h.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {inactiveAdminsOver24h.length} Administrator{inactiveAdminsOver24h.length > 1 ? 's' : ''} Inactive for Over 24 Hours
              </p>
              <p className="mt-0.5 text-amber-800">
                The following advisors have not recorded application activity in the last 24 hours:{' '}
                {inactiveAdminsOver24h.map((a) => a.displayName).join(', ')}. Review their assigned queries to prevent student delays.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('admin-management')}
            className="px-3 py-1.5 bg-amber-900 text-white rounded-lg font-semibold shrink-0 hover:bg-amber-950 transition-colors self-start sm:self-auto"
          >
            Review Admins
          </button>
        </div>
      )}

      {/* Real Charts & Distribution Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Popularity Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Category Popularity & Volume</h2>
            <span className="text-[11px] text-slate-400">Total Queries by Field</span>
          </div>

          <div className="mt-4 space-y-3">
            {categoryStats.slice(0, 6).map((cat, i) => {
              const maxCount = Math.max(1, ...categoryStats.map((c) => c.count));
              const pct = Math.round((cat.count / maxCount) * 100);

              return (
                <div key={i} className="text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-800 truncate max-w-[220px]">
                      {cat.name}
                    </span>
                    <span className="font-semibold text-slate-700 tabular-nums">
                      {cat.count} {cat.count === 1 ? 'query' : 'queries'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-pink-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(5, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Admin Pending Workload Distribution */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Counselor Active Workload</h2>
            <span className="text-[11px] text-slate-400">Open Tickets Per Admin</span>
          </div>

          <div className="mt-4 space-y-3">
            {adminWorkload.slice(0, 6).map((adm, i) => {
              const maxAssigned = Math.max(1, ...adminWorkload.map((a) => a.count));
              const pct = Math.round((adm.count / maxAssigned) * 100);

              return (
                <div key={i} className="text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800 truncate max-w-[180px]">
                        {adm.name}
                      </span>
                      <span className="text-[10px] text-slate-400">({formatRoleName(adm.role)})</span>
                    </div>
                    <span className="font-semibold text-slate-700 tabular-nums">
                      {adm.count} open
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-rose-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(5, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* High Priority / Unassigned Queries Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Priority & Unassigned Queue</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Queries requiring initial expert assignment or urgent intervention.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('all-queries')}
            className="text-xs text-pink-600 hover:text-pink-800 font-semibold cursor-pointer"
          >
            View All ({queries.length}) →
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {highPriorityQueries.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No unassigned or open queries currently require attention.
            </div>
          ) : (
            highPriorityQueries.map((t) => (
              <div
                key={t.id}
                onClick={() => onOpenTicket(t)}
                className="py-3 px-2 hover:bg-pink-50/40 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-4 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] font-bold text-pink-700 bg-pink-100/70 px-1.5 py-0.5 rounded">
                      {t.ticketNumber}
                    </span>
                    <span className="font-medium text-slate-600">{t.categoryName}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500">Student: {t.studentName} ({t.studentQualification})</span>
                  </div>
                  <h4 className="font-semibold text-slate-900 truncate">{t.title}</h4>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                      t.assignmentStatus === 'unassigned'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-pink-50 text-pink-700 border border-pink-200'
                    }`}
                  >
                    {t.assignmentStatus === 'unassigned' ? 'UNASSIGNED' : (t.status || 'open').toUpperCase()}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
