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
