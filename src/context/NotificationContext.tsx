import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { useAuth } from './AuthContext';
import { NotificationItem } from '../types';
import { offlineStorage } from '../lib/offlineStorage';
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
  const { currentUser, userProfile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadChatsCount, setUnreadChatsCount] = useState<number>(0);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [activePushBanner, setActivePushBanner] = useState<NotificationItem | null>(null);

  // Track initial load so we don't trigger push alerts for already existing historical notifications
  const isInitialSnapshotRef = useRef(true);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const bannerTimerRef = useRef<any>(null);

  // Initialize service worker and check permission on mount
  useEffect(() => {
    registerServiceWorker();
    setPermission(getNotificationPermission());

    // Listen to service worker postMessage when user taps a push notification
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleMessage = (e: MessageEvent) => {
        if (e.data && e.data.type === 'PUSH_NOTIFICATION_CLICKED') {
          // If a queryId is provided, dispatch a custom event
          window.dispatchEvent(
            new CustomEvent('app:open-query-notification', {
              detail: { queryId: e.data.queryId },
            })
          );
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  // Listen to Firestore notifications for the logged-in user in real-time
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      isInitialSnapshotRef.current = true;
      seenNotificationIdsRef.current.clear();
      return;
    }

    // Load initial cached notifications to provide instant offline/quota resilience
    const cached = offlineStorage.get<NotificationItem[]>(`cc_notifications_${currentUser.uid}`, []);
    if (cached && cached.length > 0) {
      setNotifications(cached);
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: NotificationItem[] = [];
        const newlyAddedItems: NotificationItem[] = [];

        snapshot.forEach((d) => {
          const item = { id: d.id, ...d.data() } as NotificationItem;
          items.push(item);
        });

        if (isInitialSnapshotRef.current) {
          // Mark all existing historical notifications as already seen
          items.forEach((item) => seenNotificationIdsRef.current.add(item.id));
          isInitialSnapshotRef.current = false;
        } else {
          // Check for genuine new notifications added in real-time
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const item = { id: change.doc.id, ...change.doc.data() } as NotificationItem;
              if (!seenNotificationIdsRef.current.has(item.id)) {
                seenNotificationIdsRef.current.add(item.id);
                newlyAddedItems.push(item);
              }
            }
          });

          // If browser has notification permission, send native OS status bar push notification quietly
          if (newlyAddedItems.length > 0) {
            newlyAddedItems.forEach(async (newNotice) => {
              await sendPushNotification(newNotice.title, {
                body: newNotice.message,
                queryId: newNotice.queryId,
                type: newNotice.type,
              });
            });
          }
        }

        setNotifications(items);
        offlineStorage.set(`cc_notifications_${currentUser.uid}`, items);
      },
      (error) => {
        const cachedFallback = offlineStorage.get<NotificationItem[]>(`cc_notifications_${currentUser.uid}`, []);
        if (cachedFallback && cachedFallback.length > 0) {
          setNotifications(cachedFallback);
        }
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }
    );

    return () => {
      unsubscribe();
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [currentUser]);

  // Real-time unread chats listener for WhatsApp-style tab badge counter
  useEffect(() => {
    if (!currentUser?.uid || !userProfile?.role) {
      setUnreadChatsCount(0);
      return;
    }

    const isStudent = userProfile.role === 'student';
    const q = isStudent
      ? query(collection(db, 'queries'), where('studentId', '==', currentUser.uid))
      : query(collection(db, 'queries'), where('expertId', '==', currentUser.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let count = 0;
        snapshot.forEach((d) => {
          const t = d.data();
          const isDeleted =
            Array.isArray(t.deletedForUsers) && t.deletedForUsers.includes(currentUser.uid);
          if (!isDeleted) {
            if (isStudent) {
              if (t.hasUnreadStudentReply) count++;
            } else {
              if (t.hasUnreadAdminReply) count++;
            }
          }
        });
        setUnreadChatsCount(count);
      },
      (error) => {
        console.warn('Error listening to unread chats count:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid, userProfile?.role]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const requestPermission = async (): Promise<boolean> => {
    const granted = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    return granted;
  };

  const triggerTestPushNotification = async () => {
    const perm = getNotificationPermission();
    if (perm !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        // Notification permission was not granted by user or browser
        playNotificationChime();
        const demoNotice: NotificationItem = {
          id: `demo-${Date.now()}`,
          userId: currentUser?.uid || '',
          title: '⚠️ Allow Notification Bar Alerts',
          message: 'Top notification bar alerts require permission. Please tap "Allow" in your browser prompt or Chrome address bar lock icon!',
          type: 'new_reply',
          isRead: false,
          createdAt: Date.now(),
        };
        setActivePushBanner(demoNotice);
        return;
      }
    }

    const isMobile = typeof window !== 'undefined' && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768);
    const testTitle = isMobile
      ? '📲 Career Code Mobile Alert'
      : '💻 Career Code Desktop Alert';
    const testMessage = isMobile
      ? 'Check your phone\'s top notification bar (status bar) — alerts now show up just like WhatsApp!'
      : 'Notification delivered to your desktop notification center!';

    // Send the system push notification directly into the Mobile Phone Status Bar!
    await sendPushNotification(testTitle, {
      body: testMessage,
    });

    // Provide in-app visual confirmation as well
    const notice: NotificationItem = {
      id: `test-${Date.now()}`,
      userId: currentUser?.uid || '',
      title: testTitle,
      message: testMessage,
      type: 'new_reply',
      isRead: false,
      createdAt: Date.now(),
    };
    setActivePushBanner(notice);
  };

  const clearActivePushBanner = () => {
    setActivePushBanner(null);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
  };

  const markAsRead = async (id: string) => {
    try {
      const ref = doc(db, 'notifications', id);
      await updateDoc(ref, { isRead: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach((item) => {
        const ref = doc(db, 'notifications', item.id);
        batch.update(ref, { isRead: true });
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'notifications');
    }
  };

  const markNotificationsForQueryAsRead = async (queryId: string) => {
    if (!queryId) return;
    const unreadForQuery = notifications.filter((n) => !n.isRead && n.queryId === queryId);
    if (unreadForQuery.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadForQuery.forEach((item) => {
        const ref = doc(db, 'notifications', item.id);
        batch.update(ref, { isRead: true });
      });
      await batch.commit();
    } catch (err) {
      console.warn('Failed to auto-mark query notifications as read:', err);
    }
  };

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
