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

storage.init();
// Start loading the word list now so the first submitted word doesn't wait for it.
dictionaryService.preload();
// Cache the game for offline play and pick up new versions on the next launch.
registerSW({ immediate: true });

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
