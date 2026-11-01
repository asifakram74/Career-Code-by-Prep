/**
 * Safe Local Storage Utility with JSON serialization and storage quota resilience.
 * Enables instant offline loading for chats, messages, and query tickets.
 */

// Test data cache epoch - bumping this purges local offline test chat caches across all devices
const CACHE_EPOCH = 'cc_clean_test_epoch_20261027';

if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const currentEpoch = window.localStorage.getItem('cc_cache_epoch');
    if (currentEpoch !== CACHE_EPOCH) {
      // Purge all old cached query/chat keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (
          k &&
          (k.startsWith('cc_student_queries_') ||
            k.startsWith('cc_admin_queries_') ||
            k.startsWith('cc_chat_msgs_') ||
            k === 'cc_all_queries_dir')
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      window.localStorage.setItem('cc_cache_epoch', CACHE_EPOCH);
    }
  } catch (err) {
    console.warn('[offlineStorage] Epoch sync error:', err);
  }
}

export const offlineStorage = {
  get<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined' || !window.localStorage) {
      return defaultValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item) as T;
    } catch (e) {
      console.warn(`[offlineStorage] Failed to read ${key}:`, e);
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // If quota exceeded, clean up old chat message caches
      console.warn(`[offlineStorage] Failed to write ${key}:`, e);
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith('cc_chat_msgs_') && k !== key) {
            keysToRemove.push(k);
          }
        }
        // Remove oldest 5 cached chats
        keysToRemove.slice(0, 5).forEach((k) => window.localStorage.removeItem(k));
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    }
  },

  remove(key: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
};
