/**
 * API configuration and media URL resolution for Leton Coffee CMS.
 * Supports split deployment: Frontend (Cloudflare Pages) & Backend (Express Node.js).
 */

const rawEnvApiUrl = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_API_URL || '') : '';
const cleanEnvApiUrl = typeof rawEnvApiUrl === 'string' ? rawEnvApiUrl.trim().replace(/\/+$/, '') : '';

/**
 * Checks whether the current runtime is an external production host (e.g. Cloudflare Pages).
 */
export function isProductionExternalHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'leton-coffee-web.pages.dev' || (!host.includes('.run.app') && host !== 'localhost' && host !== '127.0.0.1');
}

/**
 * Resolves the active base API URL.
 * - Prioritizes VITE_API_URL from environment variables.
 * - In production external host, VITE_API_URL is REQUIRED. Fallback to ais-pre-*.run.app is strictly blocked.
 * - Fallback to AI Studio preview is only allowed in local/development environment.
 */
export function getApiBaseUrl(): string {
  if (cleanEnvApiUrl) {
    return cleanEnvApiUrl;
  }

  // On production external host without custom external backend, use same-domain Pages Functions
  if (isProductionExternalHost()) {
    // Relative path routes directly to Cloudflare Pages Functions (/functions/api/[[path]].ts)
    return '';
  }

  // Development / local fallback only
  return 'https://ais-pre-gfncvyyhq4omamytu5kgc4-866159737618.asia-southeast1.run.app';
}

export const API_BASE_URL = getApiBaseUrl();

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

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return normalizedPath;
  }
  return `${baseUrl}${normalizedPath}`;
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
    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      return `${baseUrl}${cleanPath}`;
    }
    return cleanPath;
  }

  return trimmed;
}
