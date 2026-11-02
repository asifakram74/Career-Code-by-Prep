import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { NotificationItem } from '../types';
import { api } from '../lib/api';
import { onReconnect, onSocket } from '../lib/socket';
import { useLiveQueries } from '../lib/liveData';
import {
  registerServiceWorker,
  getNotificationPermission,
  requestNotificationPermission,
  sendPushNotification,
  playNotificationChime,
} from '../lib/pushNotifications';

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  unreadChatsCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markNotificationsForQueryAsRead: (queryId: string) => Promise<void>;
  permission: NotificationPermission | 'unsupported';
  requestPermission: () => Promise<boolean>;
  triggerTestPushNotification: () => Promise<void>;
  activePushBanner: NotificationItem | null;
  clearActivePushBanner: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const uid = userProfile?.uid;
  const isStudent = userProfile?.role === 'student';
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [activePushBanner, setActivePushBanner] = useState<NotificationItem | null>(null);

  // Service worker + taps on OS notifications.
  useEffect(() => {
    registerServiceWorker();
    setPermission(getNotificationPermission());
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'PUSH_NOTIFICATION_CLICKED') {
        window.dispatchEvent(new CustomEvent('app:open-query-notification', { detail: { queryId: e.data.queryId } }));
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  // Notification list: fetched once, then new ones are pushed over the socket.
  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      return;
    }
    let cancelled = false;
    const load = () =>
      api
        .get<NotificationItem[]>('/notifications')
        .then((items) => !cancelled && setNotifications(items))
        .catch(() => {});
    load();

    const offNew = onSocket<NotificationItem>('notification:new', (item) => {
      setNotifications((prev) => (prev.some((n) => n.id === item.id) ? prev : [item, ...prev]));
      sendPushNotification(item.title, { body: item.message, queryId: item.queryId, type: item.type });
    });
    const offRead = onSocket<{ ids?: string[]; all?: boolean; queryId?: string }>('notification:read', (r) => {
      setNotifications((prev) =>
        prev.map((n) =>
          r.all || (r.ids && r.ids.includes(n.id)) || (r.queryId && n.queryId === r.queryId) ? { ...n, isRead: true } : n
        )
      );
    });
    const offReconnect = onReconnect(load);
    return () => {
      cancelled = true;
      offNew();
      offRead();
      offReconnect();
    };
  }, [uid]);

  // Unread-chats badge: the user's own chats (not oversight of everyone else's).
  const { queries } = useLiveQueries({
    enabled: Boolean(uid),
    filter: (q) => (isStudent ? q.studentId === uid : q.expertId === uid),
  });
  const unreadChatsCount = useMemo(
    () =>
      queries.filter((q) => {
        if (q.deletedForUsers?.includes(uid ?? '')) return false;
        if (isStudent) return q.studentId === uid && q.hasUnreadStudentReply;
        return q.expertId === uid && q.hasUnreadAdminReply;
      }).length,
    [queries, uid, isStudent]
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    return granted;
  }, []);

  const triggerTestPushNotification = useCallback(async () => {
    if (getNotificationPermission() !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        playNotificationChime();
        setActivePushBanner({
          id: `demo-${Date.now()}`,
          userId: uid || '',
          title: '⚠️ Allow Notification Bar Alerts',
          message:
            'Top notification bar alerts require permission. Please tap "Allow" in your browser prompt or Chrome address bar lock icon!',
          type: 'new_reply',
          isRead: false,
          createdAt: Date.now(),
        });
        return;
      }
    }
    const isMobile =
      typeof window !== 'undefined' && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768);
    const title = isMobile ? '📲 Career Code Mobile Alert' : '💻 Career Code Desktop Alert';
    const message = isMobile
      ? "Check your phone's top notification bar (status bar) — alerts now show up just like WhatsApp!"
      : 'Notification delivered to your desktop notification center!';
    await sendPushNotification(title, { body: message });
    setActivePushBanner({
      id: `test-${Date.now()}`,
      userId: uid || '',
      title,
      message,
      type: 'new_reply',
      isRead: false,
      createdAt: Date.now(),
    });
  }, [requestPermission, uid]);

  const clearActivePushBanner = useCallback(() => setActivePushBanner(null), []);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await api.patch(`/notifications/${id}/read`).catch(() => {});
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => (prev.some((n) => !n.isRead) ? prev.map((n) => ({ ...n, isRead: true })) : prev));
    await api.post('/notifications/read-all').catch(() => {});
  }, []);

  const markNotificationsForQueryAsRead = useCallback(async (queryId: string) => {
    if (!queryId) return;
    setNotifications((prev) =>
      prev.some((n) => !n.isRead && n.queryId === queryId)
        ? prev.map((n) => (n.queryId === queryId ? { ...n, isRead: true } : n))
        : prev
    );
    await api.post('/notifications/read-by-query', { queryId }).catch(() => {});
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        unreadChatsCount,
        markAsRead,
        markAllAsRead,
        markNotificationsForQueryAsRead,
        permission,
        requestPermission,
        triggerTestPushNotification,
        activePushBanner,
        clearActivePushBanner,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
