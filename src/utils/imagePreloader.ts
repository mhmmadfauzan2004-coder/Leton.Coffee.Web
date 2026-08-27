import { resolveMediaUrl } from './api';

/**
 * Preload an image URL into browser cache and wait until it is fully decoded.
 * Resolves safely within timeout (default 2500ms) so slow networks don't freeze the app.
 */
export function preloadImage(rawUrl: string | null | undefined, timeoutMs: number = 2500): Promise<boolean> {
  return new Promise((resolve) => {
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
      resolve(true);
      return;
    }

    const url = resolveMediaUrl(rawUrl);
    if (!url) {
      resolve(true);
      return;
    }

    let isDone = false;
    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        resolve(false);
      }
    }, timeoutMs);

    const img = new Image();
    img.src = url;

    if (img.complete && img.naturalWidth > 0) {
      clearTimeout(timer);
      isDone = true;
      resolve(true);
      return;
    }

    if (typeof img.decode === 'function') {
      img
        .decode()
        .then(() => {
          if (!isDone) {
            clearTimeout(timer);
            isDone = true;
            resolve(true);
          }
        })
        .catch(() => {
          // If decode fails, fallback to onload/onerror
          img.onload = () => {
            if (!isDone) {
              clearTimeout(timer);
              isDone = true;
              resolve(true);
            }
          };
          img.onerror = () => {
            if (!isDone) {
              clearTimeout(timer);
              isDone = true;
              resolve(false);
            }
          };
        });
    } else {
      img.onload = () => {
        if (!isDone) {
          clearTimeout(timer);
          isDone = true;
          resolve(true);
        }
      };
      img.onerror = () => {
        if (!isDone) {
          clearTimeout(timer);
          isDone = true;
          resolve(false);
        }
      };
    }
  });
}
