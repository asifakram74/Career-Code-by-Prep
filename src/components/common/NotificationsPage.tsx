import React, { useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import {
  Bell,
  Check,
  MessageSquare,
  ArrowRight,
  Coffee,
} from 'lucide-react';

interface NotificationsPageProps {
  onOpenQuery?: (queryId: string) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onOpenQuery }) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    markNotificationsForQueryAsRead,
  } = useNotifications();

  // Automatically mark all notifications as read once user opens/views notifications page
  useEffect(() => {
    if (unreadCount > 0) {
      const timer = setTimeout(() => {
        markAllAsRead();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [unreadCount, markAllAsRead]);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-600 text-white flex items-center justify-center shadow-xs shadow-pink-200 shrink-0">
            <Bell className="w-5 h-5 text-pink-100" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Notifications</h1>
            <p className="text-xs text-slate-500">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All caught up!'}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead()}
            className="px-3 py-1.5 bg-pink-50 text-pink-700 hover:bg-pink-100 font-semibold rounded-xl text-xs transition-colors inline-flex items-center gap-1.5 border border-pink-200 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs divide-y divide-slate-100 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No notifications available.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                markAsRead(n.id);
                if (n.queryId) {
                  markNotificationsForQueryAsRead(n.queryId);
                  if (onOpenQuery) onOpenQuery(n.queryId);
                }
              }}
              className={`p-4 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                !n.isRead ? 'bg-pink-50/40 hover:bg-pink-50/60' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  n.type === 'coffee_treat'
                    ? 'bg-amber-500 text-white shadow-xs shadow-amber-200'
                    : !n.isRead
                    ? 'bg-pink-600 text-white shadow-xs shadow-pink-200'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {n.type === 'coffee_treat' ? (
                    <Coffee className="w-4 h-4 fill-white/20" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold ${!n.isRead ? 'text-pink-950 font-bold' : 'text-slate-900'}`}>
                      {n.title}
                    </h3>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-pink-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                  <span className="text-[10px] text-slate-400 tabular-nums mt-1 block">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {n.queryId && (
                <button
                  type="button"
                  className="text-xs font-semibold text-pink-600 hover:text-pink-800 whitespace-nowrap inline-flex items-center gap-1 self-end sm:self-center cursor-pointer"
                >
                  View <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
