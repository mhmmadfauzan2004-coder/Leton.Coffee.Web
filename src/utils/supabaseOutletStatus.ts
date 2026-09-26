import { getSupabase, SUPABASE_TABLE_NAME, SUPABASE_ROW_ID } from './supabase';
import { getApiUrl } from './api';
import { matchesOutlet } from '../data/adminAccounts';
import { LetonData } from '../types';

export const OUTLET_AVAILABILITY_STORAGE_KEY = 'leton_outlet_availability_status';
export const OUTLET_AVAILABILITY_EVENT = 'leton_outlet_availability_updated';

/**
 * Standardize outlet ID to match 'sudirman', 'kelakap_7', or 'letgo-mpp'
 */
export function normalizeOutletKey(outletId: string): string {
  const clean = String(outletId || '').toLowerCase().trim();
  if (clean === 'sudirman' || clean.includes('sudirman') || clean === 'chapter-5') {
    return 'sudirman';
  }
  if (
    clean === 'kelakap_7' ||
    clean === 'kelakap' ||
    clean === 'ratusima' ||
    clean.includes('kelakap') ||
    clean.includes('ratusima') ||
    clean === 'chapter-6'
  ) {
    return 'kelakap_7';
  }
  if (clean.includes('letgo') || clean.includes('mpp')) {
    return 'letgo-mpp';
  }
  return clean;
}

// In-memory & local storage cache (Default all true / open)
const localStatusCache: Record<string, boolean> = {
  sudirman: true,
  kelakap_7: true,
  'letgo-mpp': true,
};

// Initialize cache from localStorage
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(OUTLET_AVAILABILITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.assign(localStatusCache, parsed);
      }
    }
  } catch {}
}

/**
 * Extract availability status map from LetonData content
 */
export function extractAvailabilityFromContent(content: any): Record<string, boolean> {
  const map: Record<string, boolean> = {
    sudirman: true,
    kelakap_7: true,
    'letgo-mpp': true,
  };

  if (!content || typeof content !== 'object') {
    return map;
  }

  // 1. Direct outletAvailability mapping object if present
  if (content.outletAvailability && typeof content.outletAvailability === 'object') {
    Object.keys(content.outletAvailability).forEach((key) => {
      const norm = normalizeOutletKey(key);
      map[norm] = content.outletAvailability[key] !== false;
    });
  }

  // 2. Extract from branches array
  if (Array.isArray(content.branches)) {
    content.branches.forEach((branch: any) => {
      if (branch && branch.id) {
        const norm = normalizeOutletKey(branch.id);
        if (branch.accepting_orders !== undefined) {
          map[norm] = branch.accepting_orders !== false;
        }
      }
    });
  }

  // 3. Extract from mobileService object
  if (content.mobileService && typeof content.mobileService === 'object') {
    if (content.mobileService.accepting_orders !== undefined) {
      map['letgo-mpp'] = content.mobileService.accepting_orders !== false;
    }
  }

  return map;
}

/**
 * Fetch all outlets availability status directly from production source (public.leton_content)
 */
export async function fetchOutletsAvailability(): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = { ...localStatusCache };

  // 1. Query production source: public.leton_content (row 'default')
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from(SUPABASE_TABLE_NAME)
      .select('content')
      .eq('id', SUPABASE_ROW_ID)
      .maybeSingle();

    if (!error && data && data.content) {
      const extracted = extractAvailabilityFromContent(data.content);
      Object.assign(result, extracted);
      Object.assign(localStatusCache, result);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(OUTLET_AVAILABILITY_STORAGE_KEY, JSON.stringify(result));
          window.dispatchEvent(new CustomEvent(OUTLET_AVAILABILITY_EVENT, { detail: result }));
        } catch {}
      }
      return result;
    }
  } catch (err) {
    console.warn('[fetchOutletsAvailability Supabase Notice]:', err);
  }

  // 2. Fallback: Query backend server API /api/outlets/status
  try {
    const isSameHost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('.run.app'));

    if (isSameHost) {
      const res = await fetch(getApiUrl('/api/outlets/status'));
      if (res.ok) {
        const parsed = await res.json().catch(() => null);
        if (parsed && parsed.success && parsed.data) {
          Object.assign(result, parsed.data);
          Object.assign(localStatusCache, result);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(OUTLET_AVAILABILITY_STORAGE_KEY, JSON.stringify(result));
              window.dispatchEvent(new CustomEvent(OUTLET_AVAILABILITY_EVENT, { detail: result }));
            } catch {}
          }
          return result;
        }
      }
    }
  } catch (apiErr) {
    console.warn('[fetchOutletsAvailability API Notice]:', apiErr);
  }

  return result;
}

/**
 * Check if a specific outlet is accepting orders (instant synchronous lookup from cache)
 */
export function isOutletAcceptingOrdersSync(outletId: string): boolean {
  const key = normalizeOutletKey(outletId);
  if (localStatusCache[key] !== undefined) {
    return localStatusCache[key];
  }
  return true; // default open
}

/**
 * Update outlet accepting orders status (Admin only)
 * Persists to public.leton_content and syncs with backend server API
 */
export async function updateOutletAvailability(
  outletId: string,
  accepting_orders: boolean,
  adminRole?: string,
  adminOutletId?: string
): Promise<{ success: boolean; error?: string }> {
  const normKey = normalizeOutletKey(outletId);

  // 1. Client-side RBAC validation check
  if (adminRole === 'outlet_admin') {
    if (!adminOutletId || !matchesOutlet(outletId, adminOutletId)) {
      return {
        success: false,
        error: 'Akses Ditolak: Anda hanya memiliki wewenang untuk mengubah status outlet Anda sendiri.',
      };
    }
  }

  // 2. Update local state immediately for snappy UI
  localStatusCache[normKey] = accepting_orders;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(OUTLET_AVAILABILITY_STORAGE_KEY, JSON.stringify(localStatusCache));
      window.dispatchEvent(
        new CustomEvent(OUTLET_AVAILABILITY_EVENT, {
          detail: { ...localStatusCache, [normKey]: accepting_orders },
        })
      );
    } catch {}
  }

  // 3. Persist to Backend API with Session Authentication
  let backendSuccess = false;
  let backendError: string | undefined;

  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('leton_admin_token') || '' : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (adminRole) headers['x-admin-role'] = adminRole;
    if (adminOutletId) headers['x-outlet-id'] = adminOutletId;

    const res = await fetch(getApiUrl(`/api/admin/outlets/${normKey}/availability`), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        accepting_orders,
        outletId: normKey,
      }),
    });

    const parsed = await res.json().catch(() => null);
    if (res.ok && parsed && parsed.success) {
      backendSuccess = true;
    } else {
      backendError = parsed?.error || `Server responded with status ${res.status}`;
    }
  } catch (apiErr: any) {
    backendError = apiErr?.message || 'Gagal menghubungi server.';
  }

  // 4. Also persist directly to production Supabase table public.leton_content
  try {
    const client = getSupabase(adminRole, adminOutletId);
    const { data: existingRow } = await client
      .from(SUPABASE_TABLE_NAME)
      .select('content')
      .eq('id', SUPABASE_ROW_ID)
      .maybeSingle();

    if (existingRow && existingRow.content) {
      const updatedContent = { ...existingRow.content };

      // Update outletAvailability map
      updatedContent.outletAvailability = {
        ...(updatedContent.outletAvailability || {}),
        [normKey]: accepting_orders,
      };

      // Update in branches array if matching
      if (Array.isArray(updatedContent.branches)) {
        updatedContent.branches = updatedContent.branches.map((b: any) => {
          if (normalizeOutletKey(b.id) === normKey) {
            return { ...b, accepting_orders };
          }
          return b;
        });
      }

      // Update in mobileService if matching letgo-mpp
      if (normKey === 'letgo-mpp' && updatedContent.mobileService) {
        updatedContent.mobileService = {
          ...updatedContent.mobileService,
          accepting_orders,
        };
      }

      await client
        .from(SUPABASE_TABLE_NAME)
        .update({
          content: updatedContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', SUPABASE_ROW_ID);
    }
  } catch (sbErr) {
    console.warn('[updateOutletAvailability Supabase Notice]:', sbErr);
  }

  if (backendSuccess) {
    return { success: true };
  }

  return {
    success: true, // Local cache updated, return success with warning if backend non-fatal
    error: backendError,
  };
}

/**
 * Subscribe to realtime outlet availability changes from public.leton_content
 */
export function subscribeToOutletAvailabilityRealtime(
  onUpdate: (statusMap: Record<string, boolean>) => void
): () => void {
  let isSubscribed = true;

  // 1. Initial trigger with cache
  onUpdate({ ...localStatusCache });

  // 2. Fetch fresh data
  fetchOutletsAvailability().then((fresh) => {
    if (isSubscribed) {
      onUpdate(fresh);
    }
  });

  // 3. Custom window event listener (in-tab & cross-component)
  const handleCustomEvent = (e: any) => {
    if (e.detail && typeof e.detail === 'object' && isSubscribed) {
      onUpdate(e.detail);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(OUTLET_AVAILABILITY_EVENT, handleCustomEvent);
    window.addEventListener('storage', (e) => {
      if (e.key === OUTLET_AVAILABILITY_STORAGE_KEY && e.newValue && isSubscribed) {
        try {
          const parsed = JSON.parse(e.newValue);
          Object.assign(localStatusCache, parsed);
          onUpdate(parsed);
        } catch {}
      }
    });
  }

  // 4. Fallback Polling Control (Only active when Realtime channel is NOT healthy/subscribed)
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  const startFallbackPolling = () => {
    if (!isSubscribed || pollInterval !== null) return;
    pollInterval = setInterval(() => {
      if (isSubscribed) {
        fetchOutletsAvailability().then((latest) => {
          if (isSubscribed) {
            onUpdate(latest);
          }
        });
      }
    }, 8000);
  };
  const stopFallbackPolling = () => {
    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  // 5. Supabase Realtime channel subscription on 'leton_content' table
  let supabaseChannel: any = null;
  try {
    const client = getSupabase();
    supabaseChannel = client
      .channel('leton_content_outlet_availability_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: SUPABASE_TABLE_NAME,
        },
        (payload: any) => {
          if (payload.new && payload.new.content && isSubscribed) {
            const extracted = extractAvailabilityFromContent(payload.new.content);
            Object.assign(localStatusCache, extracted);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(OUTLET_AVAILABILITY_STORAGE_KEY, JSON.stringify(localStatusCache));
              } catch {}
            }
            onUpdate({ ...localStatusCache });
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          stopFallbackPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          startFallbackPolling();
        }
      });
  } catch (rtErr) {
    console.warn('[subscribeToOutletAvailabilityRealtime Notice]:', rtErr);
    startFallbackPolling();
  }

  return () => {
    isSubscribed = false;
    stopFallbackPolling();
    if (typeof window !== 'undefined') {
      window.removeEventListener(OUTLET_AVAILABILITY_EVENT, handleCustomEvent);
    }
    if (supabaseChannel) {
      try {
        const client = getSupabase();
        client.removeChannel(supabaseChannel);
      } catch {}
    }
  };
}
