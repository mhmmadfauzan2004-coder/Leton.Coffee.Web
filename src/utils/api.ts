/**
 * API configuration and media URL resolution for Leton Coffee CMS.
 * Supports split deployment: Frontend (Cloudflare Pages) & Backend (Express Node.js).
 */

// Base API URL from environment variable, e.g. "https://leton-backend.onrender.com"
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/**
 * Returns the full API URL for a given endpoint path.
 * In development / same-domain, returns e.g. "/api/content".
 * In production with VITE_API_URL set, returns e.g. "https://api.leton.com/api/content".
 */
export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) {
    return normalizedPath;
  }
  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Resolves an image URL so uploaded assets hosted on the backend server
 * are correctly displayed when the frontend is hosted on a separate domain (e.g. Cloudflare Pages).
 */
export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Handle uploaded server media paths like "/uploads/xxx.jpg" or "uploads/xxx.jpg"
  if (trimmed.startsWith('/uploads') || trimmed.startsWith('uploads') || trimmed.startsWith('/public/uploads')) {
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (API_BASE_URL) {
      return `${API_BASE_URL}${cleanPath}`;
    }
    return cleanPath;
  }

  return trimmed;
}
