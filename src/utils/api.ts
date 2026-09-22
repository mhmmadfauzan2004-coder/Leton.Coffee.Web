/**
 * API configuration and media URL resolution for Leton Coffee CMS.
 * Supports split deployment: Frontend (Cloudflare Pages) & Backend (Express Node.js).
 */

// Explicitly define the production Express/Cloud Run backend API URL for the Leton Coffee system
export const API_BASE_URL = 'https://ais-pre-gfncvyyhq4omamytu5kgc4-866159737618.asia-southeast1.run.app';

/**
 * Returns the full API URL for a given endpoint path.
 * In development / same-domain container, returns e.g. "/api/content".
 * In production with external domain (e.g. Cloudflare Pages), routes to API_BASE_URL.
 */
export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // If running on a Cloud Run container (dev or pre) or local dev server, use relative path directly
    if (host.includes('.run.app') || host === 'localhost' || host === '127.0.0.1') {
      return normalizedPath;
    }
  }
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
