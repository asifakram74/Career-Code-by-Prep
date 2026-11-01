import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { formatRoleName } from '../../types';
import {
  LayoutDashboard,
  PlusCircle,
  MessageCircle,
  MoreHorizontal,
  User,
  History,
  Bookmark,
  Bell,
  LogOut,
  X,
  Clock,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Users,
  GraduationCap,
  FolderTree,
  TrendingUp,
  Activity,
  HardDrive,
  BookOpen,
  ChevronRight,
  Star,
} from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isMore?: boolean;
  badge?: number;
}

interface MoreMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  badge?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
}) => {
  const { userProfile, requestLogout } = useAuth();
  const { unreadCount, unreadChatsCount } = useNotifications();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const role = userProfile?.role || 'student';

  // 1. Role-based 5 Primary Bottom Navigation Items (with Drive & Articles together)
  let bottomNavItems: BottomNavItem[] = [];

  if (role === 'student') {
    bottomNavItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'replies', label: 'Chats', icon: MessageCircle, badge: unreadChatsCount },
      { id: 'drive', label: 'Drive', icon: HardDrive },
      { id: 'articles', label: 'Articles', icon: BookOpen },
      { id: 'more', label: 'More', icon: MoreHorizontal, isMore: true },
    ];
  } else if (role === 'normal_admin') {
    bottomNavItems = [
      { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'assigned-queries', label: 'Chats', icon: MessageCircle, badge: unreadChatsCount },
      { id: 'drive', label: 'Drive', icon: HardDrive },
      { id: 'articles', label: 'Articles', icon: BookOpen },
      { id: 'more', label: 'More', icon: MoreHorizontal, isMore: true },
    ];
  } else if (role === 'expert_admin') {
    bottomNavItems = [
      { id: 'mentor-dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'personal-queries', label: 'Chats', icon: MessageCircle, badge: unreadChatsCount },
      { id: 'drive', label: 'Drive', icon: HardDrive },
      { id: 'articles', label: 'Articles', icon: BookOpen },
      { id: 'more', label: 'More', icon: MoreHorizontal, isMore: true },
    ];
  } else {
    // super_admin
    bottomNavItems = [
      { id: 'super-overview', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'personal-queries', label: 'Chats', icon: MessageCircle, badge: unreadChatsCount },
      { id: 'drive', label: 'Drive', icon: HardDrive },
      { id: 'articles', label: 'Articles', icon: BookOpen },
      { id: 'more', label: 'More', icon: MoreHorizontal, isMore: true },
    ];
  }

  // 2. Role-based More Menu Items (Slide-up Bottom Sheet)
  let moreMenuItems: MoreMenuItem[] = [];

  if (role === 'student') {
    moreMenuItems = [
      {
        id: 'reviews-analytics',
        label: 'Reviews & Ratings',
        icon: Star,
        description: 'Explore student reviews and counselor ratings',
      },
      {
        id: 'new-query',
        label: 'Submit Career Query',
        icon: PlusCircle,
        description: 'Ask advice from verified counselors and academic experts',
      },
      {
        id: 'history',
        label: 'History',
        icon: History,
        description: 'View your query history and responses',
      },
      {
        id: 'saved-answers',
        label: 'Saved Answers',
        icon: Bookmark,
        description: 'Bookmarked counselor and mentor replies',
      },
      {
        id: 'profile',
        label: 'My Profile',
        icon: User,
        description: 'Update qualifications, contact details & avatar',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        description: 'Counselor messages and platform alerts',
        badge: unreadCount,
      },
    ];
  } else if (role === 'normal_admin') {
    moreMenuItems = [
      {
        id: 'reviews-analytics',
        label: 'Reviews & Ratings',
        icon: Star,
        description: 'Student evaluations, feedback & counselor ratings analytics',
      },
      {
        id: 'pending-replies',
        label: 'Pending Queries',
        icon: Clock,
        description: 'Student queries waiting for a response',
      },
      {
        id: 'replied-queries',
        label: 'Replied Queries',
        icon: CheckCircle2,
        description: 'Successfully answered conversations',
      },
      {
        id: 'admin-history',
        label: 'Query History',
        icon: History,
        description: 'Complete archive of your past counseling sessions',
      },
      {
        id: 'new-queries',
        label: 'New Queries',
        icon: Sparkles,
        description: 'Unassigned queries available in your categories',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        description: 'Query assignment alerts & student messages',
        badge: unreadCount,
      },
    ];
  } else if (role === 'expert_admin') {
    moreMenuItems = [
      {
        id: 'reviews-analytics',
        label: 'Reviews & Ratings',
        icon: Star,
        description: 'Student evaluations, feedback & counselor ratings analytics',
      },
      {
        id: 'all-queries',
        label: 'Query Management & Staff Chats',
        icon: ShieldCheck,
        description: 'Supervise and audit counselor-student chats',
      },
      {
        id: 'student-management',
        label: 'Student Management',
        icon: GraduationCap,
        description: 'View all registered students and their query records',
      },
      {
        id: 'admin-management',
        label: 'Admin Management',
        icon: Users,
        description: 'Oversee and review admin roster',
      },
      {
        id: 'category-management',
        label: 'Category Management',
        icon: FolderTree,
        description: 'Review assigned faculties and academic categories',
      },
      {
        id: 'super-overview',
        label: 'Executive Analytics',
        icon: TrendingUp,
        description: 'Overall platform response times and volume',
      },
      {
        id: 'audit-logs',
        label: 'Activity & Audit Logs',
        icon: Activity,
        description: 'System actions and counseling audit logs',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        description: 'Platform updates and supervisory alerts',
        badge: unreadCount,
      },
    ];
  } else {
    // super_admin
    moreMenuItems = [
      {
        id: 'reviews-analytics',
        label: 'Reviews & Ratings',
        icon: Star,
        description: 'Student evaluations, feedback & counselor ratings analytics',
      },
      {
        id: 'admin-management',
        label: 'Admin Management',
        icon: Users,
        description: 'Create, edit, and deactivate administrators & mentors',
      },
      {
        id: 'student-management',
        label: 'Student Management',
        icon: GraduationCap,
        description: 'Full student directory, credentials & activity status',
      },
      {
        id: 'category-management',
        label: 'Category Management',
        icon: FolderTree,
        description: 'Add and organize academic fields, assign mentors',
      },
      {
        id: 'all-queries',
        label: 'Query Directory & Oversight',
        icon: ShieldCheck,
        description: 'Global access to all queries and resolution states',
      },
      {
        id: 'mentor-dashboard',
        label: 'Mentor Analytics',
        icon: TrendingUp,
        description: 'Detailed counseling performance and throughput',
      },
      {
        id: 'audit-logs',
        label: 'Activity & Audit Logs',
        icon: Activity,
        description: 'Security records, logins, and system events',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        description: 'System-wide activity and ticket notifications',
        badge: unreadCount,
      },
    ];
  }

  // Active state checker for the 4 bottom items
  const isItemActive = (item: BottomNavItem): boolean => {
    if (item.isMore) {
      if (moreMenuOpen) return true;
      const moreIds = moreMenuItems.map((m) => m.id);
      return moreIds.includes(currentTab);
    }

    if (item.id === currentTab) return true;

    // Normal admin chats tab groups all query tabs
    if (
      item.id === 'assigned-queries' &&
      ['assigned-queries', 'new-queries', 'pending-replies', 'replied-queries'].includes(currentTab)
    ) {
      return true;
    }

    // Expert/Super admin chats tab groups personal queries
    if (
      item.id === 'personal-queries' &&
      ['personal-queries'].includes(currentTab)
    ) {
      return true;
    }

    return false;
  };

  const handleTabClick = (item: BottomNavItem) => {
    if (item.isMore) {
      setMoreMenuOpen(true);
      if (typeof window !== 'undefined') {
        window.history.pushState({ level: 1, type: 'modal', modalId: 'more_menu' }, '');
      }
    } else {
      setMoreMenuOpen(false);
      onSelectTab(item.id);
    }
  };

  const handleSelectMoreOption = (id: string) => {
    setMoreMenuOpen(false);
    onSelectTab(id);
  };

  React.useEffect(() => {
    if (!moreMenuOpen) return;
    const handlePop = () => {
      setMoreMenuOpen(false);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [moreMenuOpen]);

  return (
    <>
      {/* 1. Mobile & Tablet WhatsApp-style Fixed Bottom Navigation Bar (Hidden on Desktop: xl:hidden) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-pink-100 shadow-[0_-2px_12px_rgba(236,72,153,0.08)] xl:hidden select-none"
        aria-label="Mobile Bottom Navigation"
        style={{
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="grid grid-cols-5 items-center justify-around h-15 max-w-lg mx-auto px-1 sm:px-2">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabClick(item)}
                className="flex flex-col items-center justify-center py-1 group focus-visible:outline-none"
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
              >
                {/* Icon Container with WhatsApp-style Pill Highlight */}
                <div
                  className={`relative flex items-center justify-center px-2.5 sm:px-3.5 py-1 rounded-full transition-all duration-200 ${
                    active
                      ? 'bg-pink-100 text-pink-700 shadow-2xs'
                      : 'text-slate-500 group-hover:text-slate-800'
                  }`}
                >
                  <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-105 stroke-[2.3]' : 'stroke-[1.8]'}`} />

                  {/* WhatsApp-Style Unread Chat Badge with count of students/chats */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      aria-label={`${item.badge} unread chats`}
                      className="absolute -top-1.5 -right-2 bg-[#25d366] text-white text-[10px] font-extrabold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-xs ring-2 ring-white tabular-nums"
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>

                {/* Compact Label */}
                <span
                  className={`text-[11px] tracking-tight leading-tight mt-0.5 transition-colors ${
                    active
                      ? 'font-bold text-pink-700'
                      : 'font-medium text-slate-500 group-hover:text-slate-800'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 2. Slide-up "More Options" Bottom Sheet Menu */}
      {moreMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex flex-col justify-end animate-in fade-in duration-200">
          {/* Subtle Dim Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setMoreMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-Up Sheet Container */}
          <div
            className="relative z-10 bg-white rounded-t-3xl shadow-2xl border-t border-pink-200/80 flex flex-col max-h-[85vh] animate-slide-up"
            style={{
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            }}
          >
            {/* Top Sheet Drag Indicator Handle */}
            <div className="pt-3 pb-1">
              <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto" />
            </div>

            {/* Sheet Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-pink-100">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                  More Options
                </h3>
                <p className="text-xs text-slate-500">
                  {userProfile?.displayName || 'User'} •{' '}
                  <span className="font-semibold text-pink-700">
                    {formatRoleName(role)}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMoreMenuOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close more options"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Options List */}
            <div className="overflow-y-auto px-4 py-3 space-y-1.5 flex-1 max-h-[55vh]">
              {moreMenuItems.map((menuItem) => {
                const Icon = menuItem.icon;
                const isSelected = currentTab === menuItem.id;

                return (
                  <button
                    key={menuItem.id}
                    type="button"
                    onClick={() => handleSelectMoreOption(menuItem.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
                      isSelected
                        ? 'bg-pink-50 border border-pink-200/90 text-pink-900 shadow-2xs font-semibold'
                        : 'hover:bg-slate-50 text-slate-700 border border-transparent active:bg-pink-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-pink-600 text-white shadow-xs'
                            : 'bg-pink-50 text-pink-600 border border-pink-100'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs sm:text-sm truncate ${isSelected ? 'font-bold text-pink-900' : 'font-semibold text-slate-900'}`}>
                            {menuItem.label}
                          </p>
                          {menuItem.badge !== undefined && menuItem.badge > 0 && (
                            <span className="bg-pink-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full tabular-nums">
                              {menuItem.badge}
                            </span>
                          )}
                        </div>
                        {menuItem.description && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {menuItem.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        isSelected ? 'text-pink-600 translate-x-0.5' : 'text-slate-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Separated Logout Action at Bottom */}
            <div className="px-4 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  requestLogout();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-100 transition-colors active:scale-98"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
