import { MenuItem, LetonData } from '../types';
import { getSupabase, SUPABASE_TABLE_NAME, SUPABASE_ROW_ID, saveContentToSupabase, fetchContentFromSupabase } from './supabase';
import { sanitizeLoadedData } from './storage';
import { matchesOutlet } from '../data/adminAccounts';

export const STOCK_STREAM_CHANNEL = 'leton_stock_stream';
export const STOCK_EVENT_NAME = 'STOCK_UPDATED';

/**
 * Standardize outlet ID to match either 'sudirman' or 'kelakap_7'
 */
export function normalizeOutletStockId(outletId?: string | null): string {
  if (!outletId) return 'sudirman';
  const clean = outletId.toLowerCase().trim();
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
  return clean;
}

/**
 * Check if a menu item is available for a specific outlet
 * If outletId is provided, ONLY checks availability for that specific outlet.
 * Outlets NEVER share availability state!
 */
export function isMenuItemAvailableForOutlet(
  item: MenuItem | null | undefined,
  outletId?: string | null
): boolean {
  if (!item) return false;
  if (!outletId) {
    return item.isAvailable !== false;
  }

  const norm = normalizeOutletStockId(outletId);

  // 1. Specific outlet stock object
  if (item.outletStock && item.outletStock[norm] !== undefined) {
    return Boolean(item.outletStock[norm]?.isAvailable);
  }

  // 2. Specific outlet availability boolean map
  if (item.outletAvailability && item.outletAvailability[norm] !== undefined) {
    return Boolean(item.outletAvailability[norm]);
  }

  // 3. Fallback: default item availability if not yet explicitly customized per outlet
  return item.isAvailable !== false;
}

/**
 * Update stock and availability for a single menu item in a specific outlet
 */
export async function updateMenuItemOutletStock(
  menuId: string,
  targetOutletId: string,
  isAvailable: boolean,
  currentAllData: LetonData,
  stockQuantity?: number
): Promise<{ success: boolean; error?: string; updatedData?: LetonData }> {
  const normOutlet = normalizeOutletStockId(targetOutletId);
  const startTime = Date.now();

  try {
    // 1. Prepare updated menuItems array
    const updatedMenuItems = (currentAllData.menuItems || []).map((item) => {
      if (item.id !== menuId) return item;

      const currentOutletAvailability = { ...(item.outletAvailability || {}) };
      const currentOutletStock = { ...(item.outletStock || {}) };

      currentOutletAvailability[normOutlet] = isAvailable;
      currentOutletStock[normOutlet] = {
        isAvailable,
        stock: stockQuantity !== undefined ? stockQuantity : (isAvailable ? 99 : 0),
      };

      return {
        ...item,
        outletAvailability: currentOutletAvailability,
        outletStock: currentOutletStock,
      };
    });

    const updatedData: LetonData = {
      ...currentAllData,
      menuItems: updatedMenuItems,
    };

    // 2. Save directly to Supabase production source of truth
    const client = getSupabase();
    const saveRes = await saveContentToSupabase(updatedData);

    // 3. Granular write attempt to dedicated table if configured
    try {
      await client
        .from('menu_outlet_stock')
        .upsert(
          {
            menu_id: menuId,
            outlet_id: normOutlet,
            is_available: isAvailable,
            stock: stockQuantity !== undefined ? stockQuantity : (isAvailable ? 99 : 0),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'menu_id,outlet_id' }
        );
    } catch {
      // Non-blocking fallback
    }

    // 4. Instant Multi-Client Broadcast via Supabase Channel
    try {
      const broadcastChannel = client.channel(STOCK_STREAM_CHANNEL);
      broadcastChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          broadcastChannel.send({
            type: 'broadcast',
            event: STOCK_EVENT_NAME,
            payload: {
              menuId,
              outletId: normOutlet,
              isAvailable,
              stock: stockQuantity,
              timestamp: Date.now(),
            },
          });
        }
      });
    } catch (bErr) {
      console.warn('[Stock Broadcast Warning]:', bErr);
    }

    console.log(`[Outlet Stock Updated]: Menu "${menuId}" on Outlet "${normOutlet}" -> isAvailable: ${isAvailable} in ${Date.now() - startTime}ms`);
    return { success: true, updatedData };
  } catch (err: any) {
    console.error('[Outlet Stock Update Error]:', err);
    return { success: false, error: err?.message || 'Gagal mengubah stok outlet.' };
  }
}

/**
 * Bulk set all items or category items availability for a specific outlet
 */
export async function bulkSetOutletStock(
  targetOutletId: string,
  isAvailable: boolean,
  categoryId: string, // 'all' or specific category ID
  currentAllData: LetonData
): Promise<{ success: boolean; error?: string; updatedData?: LetonData }> {
  const normOutlet = normalizeOutletStockId(targetOutletId);

  try {
    const updatedMenuItems = (currentAllData.menuItems || []).map((item) => {
      if (categoryId !== 'all' && item.categoryId !== categoryId) {
        return item;
      }

      const currentOutletAvailability = { ...(item.outletAvailability || {}) };
      const currentOutletStock = { ...(item.outletStock || {}) };

      currentOutletAvailability[normOutlet] = isAvailable;
      currentOutletStock[normOutlet] = {
        isAvailable,
        stock: isAvailable ? 99 : 0,
      };

      return {
        ...item,
        outletAvailability: currentOutletAvailability,
        outletStock: currentOutletStock,
      };
    });

    const updatedData: LetonData = {
      ...currentAllData,
      menuItems: updatedMenuItems,
    };

    const saveRes = await saveContentToSupabase(updatedData);

    // Broadcast
    try {
      const client = getSupabase();
      const broadcastChannel = client.channel(STOCK_STREAM_CHANNEL);
      broadcastChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          broadcastChannel.send({
            type: 'broadcast',
            event: STOCK_EVENT_NAME,
            payload: {
              bulk: true,
              categoryId,
              outletId: normOutlet,
              isAvailable,
              timestamp: Date.now(),
            },
          });
        }
      });
    } catch {}

    return { success: true, updatedData };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal mengubah stok masal.' };
  }
}

/**
 * Realtime stock listener for customer catalog and admin views
 */
export function subscribeToOutletStockRealtime(
  onStockChange: (payload: {
    menuId?: string;
    outletId: string;
    isAvailable: boolean;
    stock?: number;
    bulk?: boolean;
    categoryId?: string;
  }) => void
): () => void {
  try {
    const client = getSupabase();
    const channel = client
      .channel('stock_listener_' + Math.random().toString(36).substring(2, 9))
      .on('broadcast', { event: STOCK_EVENT_NAME }, (eventPayload: any) => {
        if (eventPayload?.payload) {
          onStockChange(eventPayload.payload);
        }
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[Realtime Stock Subscribe Notice]:', err);
    return () => {};
  }
}
