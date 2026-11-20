// App updates (v7.63.0). An installed Android app resumes instead of relaunching, and the browser
// only looks for a new service worker on a fresh launch, so new versions took several open/close
// cycles to arrive. Now the game:
//   1. checks for a new version when it comes back to the foreground, when the network returns,
//      and every UPDATE_CHECK_MINUTES while open (one tiny request for sw.js, never cached);
//   2. downloads it in the background (the new service worker installs and waits);
//   3. switches to it only at a safe moment, on the start screen (never mid-run), with a quick
//      reload, then says "Updated to vX" (takeUpdatedNote).
// The service worker is in 'prompt' mode (vite.config.ts), so nothing reloads on its own.
// index.tsx passes in registerSW, so this file has no virtual-module import (tests can load it).

type RegisterSW = (options: {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
}) => (reloadPage?: boolean) => Promise<void>;

export const UPDATE_CHECK_MINUTES = 30;
/** Don't check more often than this, however often the app is switched to. */
const MIN_CHECK_GAP_MS = 60_000;
const UPDATED_FROM_KEY = 'wordNerdUpdatedFrom';

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let ready = false;
let applying = false;
let lastCheck = 0;
const listeners = new Set<() => void>();

export const initAppUpdates = (registerSW: RegisterSW): void => {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
      listeners.forEach(fn => fn());
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = (force = false) => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
        const now = Date.now();
        if (!force && now - lastCheck < MIN_CHECK_GAP_MS) return;
        lastCheck = now;
        registration.update().catch(() => { /* offline or server hiccup: try again later */ });
      };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      window.addEventListener('online', () => check(true));
      setInterval(() => check(true), UPDATE_CHECK_MINUTES * 60_000);
    },
  });
};

/** A newer version is downloaded and waiting. */
export const isUpdateReady = (): boolean => ready;

/** Calls `fn` when a newer version finishes downloading. Returns an unsubscribe function. */
export const onUpdateReady = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/**
 * Switches to the waiting version (a quick reload). Only call this where a reload loses nothing
 * (the start screen). Returns true when a reload is on its way.
 */
export const applyUpdate = (currentVersion: string): boolean => {
  if (!ready || !updateSW || applying) return false;
  applying = true;
  try { localStorage.setItem(UPDATED_FROM_KEY, currentVersion); } catch { /* private mode: no toast */ }
  updateSW(true).catch(() => { applying = false; });
  return true;
};

/** After an update's reload: the version it came from (once), or null. */
export const takeUpdatedNote = (): string | null => {
  try {
    const from = localStorage.getItem(UPDATED_FROM_KEY);
    if (from) localStorage.removeItem(UPDATED_FROM_KEY);
    return from;
  } catch {
    return null;
  }
};
