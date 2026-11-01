import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { formatRoleName } from '../../types';
import {
  LayoutDashboard,
  PlusCircle,
  MessageSquare,
  History,
  Bookmark,
  User,
  Bell,
  LogOut,
  Users,
  GraduationCap,
  FolderTree,
  Activity,
  FileCheck2,
  Clock,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  HardDrive,
  BookOpen,
  X,
  Star,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { userProfile, requestLogout } = useAuth();
  const { unreadCount, unreadChatsCount } = useNotifications();
  const role = userProfile?.role || 'student';

  const handleSelect = (tab: string) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  interface SidebarNavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    highlight?: boolean;
    badge?: number;
  }

  // Student Navigation Items
  const studentItems: SidebarNavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new-query', label: 'New Query', icon: PlusCircle, highlight: true },
    { id: 'replies', label: 'Chats', icon: MessageSquare, badge: unreadChatsCount },
    { id: 'drive', label: 'Career Drive', icon: HardDrive },
    { id: 'articles', label: 'Articles', icon: BookOpen },
    { id: 'reviews-analytics', label: 'Reviews & Ratings', icon: Star },
    { id: 'history', label: 'History', icon: History },
    { id: 'saved-answers', label: 'Saved Answers', icon: Bookmark },
    { id: 'profile', label: 'My Profile & DP', icon: User },
  ];

  // Normal Admin Navigation Items - Streamlined & clean (only their assigned queries)
  const normalAdminItems: SidebarNavItem[] = [
    { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assigned-queries', label: 'My Assigned Chats', icon: MessageSquare, badge: unreadChatsCount },
    { id: 'drive', label: 'Career Drive', icon: HardDrive },
    { id: 'articles', label: 'Articles', icon: BookOpen },
    { id: 'reviews-analytics', label: 'Reviews & Ratings', icon: Star },
    { id: 'profile', label: 'My Profile & DP', icon: User },
  ];

  // Super Admin & Expert Admin Navigation Items
  const executiveAdminItems: SidebarNavItem[] = [
    { id: 'super-overview', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'mentor-dashboard', label: 'My Mentor Dashboard', icon: TrendingUp },
    { id: 'reviews-analytics', label: 'Reviews & Ratings', icon: Star },
    { id: 'personal-queries', label: 'My Assigned Chats', icon: MessageSquare, badge: unreadChatsCount },
    { id: 'drive', label: 'Career Drive', icon: HardDrive },
    { id: 'articles', label: 'Articles', icon: BookOpen },
    { id: 'all-queries', label: 'Staff Chats (Oversight)', icon: ShieldCheck },
    { id: 'admin-management', label: 'Admin Management', icon: Users },
    { id: 'student-management', label: 'Student Management', icon: GraduationCap },
    { id: 'category-management', label: 'Category Management', icon: FolderTree },
    { id: 'audit-logs', label: 'Activity & Audit Logs', icon: Activity },
    { id: 'profile', label: 'My Profile & DP', icon: User },
  ];

  let items = studentItems;
  if (role === 'normal_admin') {
    items = normalAdminItems;
  } else if (role === 'super_admin' || role === 'expert_admin') {
    items = executiveAdminItems;
  }

  return (
    <aside className="hidden xl:flex sticky top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-white text-slate-800 flex-col border-r border-pink-100 shrink-0">

        {/* User Identity Kicker */}
        <div className="p-4 border-b border-pink-100 bg-pink-50/60">
          <p className="text-[11px] uppercase tracking-wider text-pink-900/60 font-semibold">Logged in as</p>
          <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
            {userProfile?.displayName || 'User'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-pink-700 font-semibold bg-pink-100/70 px-2 py-0.5 rounded">
              {formatRoleName(role)}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-[10px] text-emerald-600 font-medium">Online</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentTab === item.id ||
              (item.id === 'assigned-queries' &&
                ['new-queries', 'pending-replies', 'replied-queries', 'assigned-queries'].includes(currentTab));
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-pink-600 text-white shadow-xs font-semibold'
                    : item.highlight
                    ? 'text-pink-700 hover:bg-pink-100/80 bg-pink-50 font-semibold'
                    : 'text-slate-600 hover:bg-pink-50/70 hover:text-pink-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-pink-600' : 'text-slate-400'}`} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full tabular-nums shadow-2xs ${
                      isActive ? 'bg-white text-emerald-700' : 'bg-[#25d366] text-white'
                    }`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer with Sign Out */}
        <div className="p-3 border-t border-pink-100">
          <button
            onClick={() => {
              if (onCloseMobile) onCloseMobile();
              requestLogout();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
  );
};
