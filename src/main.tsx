import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register production Service Worker for background push notifications with safety guards
if (typeof window !== 'undefined') {
  try {
    if ('serviceWorker' in navigator && window.isSecureContext) {
      window.addEventListener('load', () => {
        try {
          navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then((reg) => {
              console.log('[SW] Service Worker registered successfully with scope:', reg.scope);
            })
            .catch((err) => {
              console.warn('[SW] Service Worker registration skipped/failed:', err?.message || err);
            });
        } catch (swErr) {
          console.warn('[SW] Service Worker registration exception:', swErr);
        }
      });
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
