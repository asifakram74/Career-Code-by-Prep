import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  Bell,
  Check,
  Globe,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import { CareerCodeLogo } from './CareerCodeLogo';

interface NavbarProps {
  onToggleSidebar?: () => void;
  onNavigateTab?: (tab: string) => void;
  currentTab?: string;
  onViewLanding?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  onNavigateTab,
  onViewLanding,
}) => {
  const { userProfile, requestLogout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'Expert Admin';
      case 'expert_admin':
        return 'Expert Admin';
      case 'normal_admin':
        return 'Admin';
      case 'student':
        return 'Student';
      default:
        return 'User';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-6">
        {/* Zone 1: Brand */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <CareerCodeLogo size="md" />
            <span className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-slate-900 truncate">
              Career Code <span className="hidden xs:inline sm:inline text-xs sm:text-sm font-medium text-slate-500">by Prep Titans</span>
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links / Breadcrumb / Quick Stats */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 shrink-0">
          <span className="text-xs text-slate-500 font-normal">
            Portal: <strong className="font-semibold text-slate-800">{getRoleLabel(userProfile?.role)}</strong>
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-xs text-slate-500 font-normal">
            Session: <span className="font-medium text-emerald-700">Authenticated</span>
          </span>
        </nav>

        {/* Zone 3: Actions & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3 relative shrink-0">
          {/* Notifications Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowProfileMenu(false);
              }}
              className="p-2 text-slate-600 hover:text-pink-600 hover:bg-pink-50 rounded-xl relative transition-colors focus:outline-none"
              aria-label="View notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-pink-600 text-[10px] font-bold text-white flex items-center justify-center tabular-nums">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Drawer - Mobile & Desktop Responsive */}
            {showNotifications && (
              <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 animate-pop-in origin-top-right">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-xs font-medium text-pink-700 bg-pink-50 px-2 py-0.5 rounded">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="text-xs text-pink-600 hover:text-pink-800 font-medium flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 py-1">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          markAsRead(item.id);
                          if (item.queryId && onNavigateTab) {
                            onNavigateTab(userProfile?.role === 'student' ? 'replies' : 'assigned');
                            setShowNotifications(false);
                          }
                        }}
                        className={`p-3 text-left transition-colors cursor-pointer rounded-lg hover:bg-slate-50 ${
                          !item.isRead
                            ? item.type === 'coffee_treat'
                              ? 'bg-amber-50/70 border-l-2 border-amber-500'
                              : 'bg-pink-50/50 border-l-2 border-pink-500'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap tabular-nums">
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.message}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Dropdown Footer: View All */}
                <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-end text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateTab) onNavigateTab('notifications');
                      setShowNotifications(false);
                    }}
                    className="text-pink-600 hover:text-pink-800 font-bold cursor-pointer transition-colors"
                  >
                    View All Notifications →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Summary & Logout */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2.5 p-1.5 text-slate-700 hover:bg-pink-50 rounded-lg transition-colors focus:outline-none"
            >
              {userProfile?.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt={userProfile.displayName}
                  className="w-8 h-8 rounded-full object-cover border border-pink-400 shadow-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-pink-600 text-white flex items-center justify-center text-xs font-semibold shadow-xs">
                  {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div className="hidden sm:block text-left text-xs leading-tight">
                <p className="font-semibold text-slate-900 truncate max-w-[120px]">
                  {userProfile?.displayName || 'User'}
                </p>
                <p className="text-slate-500 text-[11px] truncate max-w-[120px]">
                  {getRoleLabel(userProfile?.role)}
                </p>
              </div>
            </button>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2 text-xs animate-pop-in origin-top-right">
                <div className="p-2 border-b border-slate-100">
                  <p className="font-semibold text-slate-900 truncate">{userProfile?.displayName}</p>
                  <p className="text-slate-500 truncate text-[11px]">{userProfile?.email}</p>
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-pink-700 bg-pink-50 px-2 py-0.5 rounded font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {getRoleLabel(userProfile?.role)}
                  </div>
                </div>

                <div className="pt-1">
                  {onViewLanding && (
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onViewLanding();
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-pink-50 hover:text-pink-600 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Globe className="w-4 h-4 text-pink-500" />
                      View Public Site
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (onNavigateTab) onNavigateTab('profile');
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-slate-500" />
                    My Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      requestLogout();
                    }}
                    className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
