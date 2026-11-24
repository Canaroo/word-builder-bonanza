import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/poppins/latin-800.css';
import '@fontsource/roboto-mono/latin-700.css';
import '@fontsource/bungee/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import './index.css';
import App from './App';
import { storage } from './services/storage';
import { dictionaryService } from './services/dictionaryService';
import { initAppUpdates } from './services/appUpdate';

storage.init();
// Start loading the word list now so the first submitted word doesn't wait for it.
dictionaryService.preload();
// Cache the game for offline play. New versions download in the background and switch in on the
// start screen (services/appUpdate.ts, v7.63.0).
initAppUpdates(registerSW);

// v7.84.2: the app's height is measured, not trusted to CSS. On Android, tapping Play switches a browser
// tab to fullscreen; Chrome sometimes keeps the old 100dvh afterwards, so the board was one row too tall
// and the SHUFFLE / SUBMIT / STUCK? row sat below the screen until a pinch made it lay out again. Every
// change of the visible screen (fullscreen, rotation, the address bar) re-measures, then once more after
// the change settles. A zoomed-in view is skipped so a pinch can't shrink the app.
const setAppHeight = () => {
  const vv = window.visualViewport;
  if (vv && Math.abs(vv.scale - 1) > 0.01) return;
  const h = Math.round(vv?.height ?? window.innerHeight);
  if (h > 0) document.documentElement.style.setProperty('--app-h', `${h}px`);
};
const remeasure = () => { setAppHeight(); requestAnimationFrame(setAppHeight); setTimeout(setAppHeight, 250); setTimeout(setAppHeight, 700); };
setAppHeight();
window.addEventListener('resize', remeasure);
window.addEventListener('orientationchange', remeasure);
window.addEventListener('pageshow', remeasure);
document.addEventListener('fullscreenchange', remeasure);
document.addEventListener('webkitfullscreenchange', remeasure);
document.addEventListener('visibilitychange', () => { if (!document.hidden) remeasure(); });
window.visualViewport?.addEventListener('resize', remeasure);

// v7.83.0: no pinch zoom. iPhone Safari ignores user-scalable=no in the viewport tag, so its pinch
// gesture is blocked here; two fingers landing on tiles at once used to zoom the board.
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
