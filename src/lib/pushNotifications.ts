// Push Notification and Sound chime utility for Career Code by Prep Titans
// Fully optimized for mobile phone status bar (Android/iOS PWA) & desktop notifications

let cachedRegistration: ServiceWorkerRegistration | null = null;

// Initialize and register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    cachedRegistration = registration;
    return registration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

// Get the active and ready service worker registration
export async function getActiveSWRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    // 1. If we already have a cached active registration
    if (cachedRegistration && cachedRegistration.active) {
      return cachedRegistration;
    }

    // 2. Wait for navigator.serviceWorker.ready (guaranteed to be active)
    const readyReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((res) => setTimeout(() => res(null), 2500)),
    ]);

    if (readyReg) {
      cachedRegistration = readyReg;
      return readyReg;
    }

    // 3. Fallback to getRegistration
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      cachedRegistration = reg;
      return reg;
    }

    // 4. Fallback to register
    return await registerServiceWorker();
  } catch (err) {
    console.warn('Could not acquire ready SW registration:', err);
    return null;
  }
}

// Detect if current environment is a mobile device (Android, iPhone, iPad)
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || !navigator) return false;
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

// Get current permission status
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

// Request permission from the user for mobile phone notification bar & desktop
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    // Always register SW beforehand so it's ready as soon as permission is granted
    await registerServiceWorker();

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Fire a confirmation alert directly to the mobile phone's notification bar
      const reg = await getActiveSWRegistration();
      if (reg) {
        const origin = window.location.origin;
        try {
          await reg.showNotification('🔔 Career Code Alerts Enabled!', {
            body: 'You will now receive alerts in your mobile phone\'s top notification bar.',
            icon: new URL('/icon-192.png', origin).href,
            badge: new URL('/badge-72.png', origin).href,
            // @ts-ignore
            vibrate: [250, 100, 250, 100, 250],
            tag: 'system-bar-confirmed',
            renotify: true,
          } as any);
        } catch (e) {
          console.warn('Initial bar notification test warning:', e);
        }
      }
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Notification permission request error:', err);
    return false;
  }
}

// Modern 2-tone melodic notification chime using Web Audio API synthesis
export function playNotificationChime() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Tone 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2: A5 (880 Hz) - higher pleasant note
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.09);

    gain2.gain.setValueAtTime(0, now + 0.09);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.09);
    osc2.stop(now + 0.46);
  } catch (e) {
    // Audio autoplay restrictions or unsupported
  }
}

export interface PushNotificationOptions {
  body?: string;
  queryId?: string;
  type?: string;
  tag?: string;
  url?: string;
}

// Trigger system push notification directly in Mobile Status Bar (Android/iOS) and Desktop
export async function sendPushNotification(
  title: string,
  options: PushNotificationOptions = {}
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Always play the subtle chime and mobile vibration
  playNotificationChime();
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([250, 100, 250, 100, 250]);
    } catch {}
  }

  // Check if browser notifications are supported & permitted
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  // Android & Mobile OS requirement: Absolute URLs for icons and status bar badges
  const origin = window.location.origin;
  const iconUrl = new URL('/icon-192.png', origin).href;
  const badgeUrl = new URL('/badge-72.png', origin).href;

  const notificationOptions = {
    body: options.body || 'New message or query update',
    icon: iconUrl,
    badge: badgeUrl,
    tag: options.tag || (options.queryId ? `query-${options.queryId}` : `cc-${Date.now()}`),
    renotify: true,
    requireInteraction: true,
    vibrate: [250, 100, 250, 100, 250],
    data: {
      url: options.url || '/',
      queryId: options.queryId,
      type: options.type,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open_chat', title: 'Open Chat' }
    ]
  };

  try {
    // Primary & Mandatory Strategy for Mobile: ServiceWorkerRegistration.showNotification()
    // On Android Chrome, 'new Notification()' is strictly forbidden and throws Illegal Constructor.
    // Service Worker registration is the ONLY way notifications appear in the mobile phone's top notification bar.
    if ('serviceWorker' in navigator) {
      const registration = await getActiveSWRegistration();
      if (registration) {
        await registration.showNotification(title, notificationOptions as any);
        return true;
      }
    }

    // Secondary Strategy for Desktop ONLY (never execute 'new Notification' on mobile)
    if (!isMobileDevice() && 'Notification' in window) {
      const notification = new Notification(title, notificationOptions);
      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.queryId && (window as any).__onPushNotificationClick) {
          (window as any).__onPushNotificationClick(options.queryId);
        }
      };
      return true;
    }
  } catch (err) {
    console.error('Could not display system push notification in notification bar:', err);
    return false;
  }

  return false;
}
