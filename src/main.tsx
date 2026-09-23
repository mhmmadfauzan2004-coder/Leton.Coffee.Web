import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register production OneSignal Service Worker for background push notifications with safety guards
if (typeof window !== 'undefined') {
  try {
    if ('serviceWorker' in navigator && window.isSecureContext) {
      const registerServiceWorker = () => {
        try {
          navigator.serviceWorker.register('/OneSignalSDKWorker.js', { scope: '/' })
            .then((reg) => {
              console.log('[SW] OneSignal Service Worker registered successfully with scope:', reg.scope);
            })
            .catch((err) => {
              console.warn('[SW] OneSignal Service Worker registration skipped/failed:', err?.message || err);
            });
        } catch (swErr) {
          console.warn('[SW] Service Worker registration exception:', swErr);
        }
      };

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        registerServiceWorker();
      } else {
        window.addEventListener('load', registerServiceWorker);
      }
    }
  } catch (envErr) {
    console.warn('[SW] Service worker feature detection note:', envErr);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
