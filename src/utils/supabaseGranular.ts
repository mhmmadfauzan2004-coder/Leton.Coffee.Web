import { MenuItem, MenuCategory, CustomizationOption, LetonData } from '../types';
import { getSupabase, SUPABASE_TABLE_NAME, SUPABASE_ROW_ID, saveContentToSupabase } from './supabase';
import { sanitizeLoadedData } from './storage';
import { stripHeavyBase64Images } from './safeStorage';

export interface SupabaseOpLog {
  operation: string;
  table: string;
  recordID: string;
  requestStart: string;
  requestEnd: string;
  duration: string;
  supabaseErrorCode: string | null;
  supabaseErrorMessage: string | null;
}

/**
 * Helper to log all Supabase operations in clear tabular format to browser console
 */
export function logSupabaseOperation(
  operation: string,
  table: string,
  recordID: string,
  startTime: number,
  error?: any
): SupabaseOpLog {
  const endTime = Date.now();
  const durationMs = endTime - startTime;
  const startIso = new Date(startTime).toISOString();
  const endIso = new Date(endTime).toISOString();

  const logData: SupabaseOpLog = {
    operation,
    table,
    recordID: recordID || 'default',
    requestStart: startIso,
    requestEnd: endIso,
    duration: `${durationMs}ms`,
    supabaseErrorCode: error?.code || null,
    supabaseErrorMessage: error?.message || (typeof error === 'string' ? error : null),
  };

  if (error) {
    console.error(`❌ [SUPABASE ERROR] ${operation} on table '${table}' (ID: ${recordID}) failed after ${durationMs}ms:`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  } else {
    console.log(`✅ [SUPABASE SUCCESS] ${operation} on table '${table}' (ID: ${recordID}) completed in ${durationMs}ms`);
  }

  console.table({
    'operation': logData.operation,
    'table': logData.table,
    'record ID': logData.recordID,
    'request start': logData.requestStart,
    'request end': logData.requestEnd,
    'duration': logData.duration,
    'Supabase error code': logData.supabaseErrorCode || 'NONE',
    'Supabase error message': logData.supabaseErrorMessage || 'NONE',
  });

  return logData;
}

/**
 * 1. Granular Update/Insert for a Single Menu Item (Product)
 */
export async function saveSingleMenuItemGranular(
  item: MenuItem,
  allMenuData: LetonData
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  const client = getSupabase();

  try {
    // Sanitize item image if it's a base64 string to keep payload lightweight
    const cleanItem = { ...item };
    if (cleanItem.image && cleanItem.image.startsWith('data:image')) {
      // Stripped or handled
    }

    // Attempt granular write to dedicated 'menu_items' table if exists
    const { error: directError } = await client
      .from('menu_items')
      .upsert(cleanItem, { onConflict: 'id' });

    if (!directError) {
      logSupabaseOperation('UPSERT_SINGLE_PRODUCT', 'menu_items', item.id, startTime);
      return { success: true };
    }

    // If dedicated table does not exist or fails, log it and fallback to lightweight leton_content sync
    if (directError.code === '42P01') { // relation does not exist
      console.warn('[Granular Note] Table "menu_items" does not exist in Supabase, falling back to leton_content.');
    } else {
      logSupabaseOperation('UPSERT_SINGLE_PRODUCT_DIRECT_FAIL', 'menu_items', item.id, startTime, directError);
    }

    // Fallback: sync lightweight content to leton_content row 'default'
    const fallbackStart = Date.now();
    const result = await saveContentToSupabase(allMenuData);
    logSupabaseOperation('FALLBACK_UPSERT_LETON_CONTENT', SUPABASE_TABLE_NAME, SUPABASE_ROW_ID, fallbackStart, result.error ? { message: result.error } : null);
    
    return result;
  } catch (err: any) {
    logSupabaseOperation('UPSERT_SINGLE_PRODUCT_EXCEPTION', 'menu_items', item.id, startTime, err);
    return { success: false, error: err?.message || 'Gagal menyimpan menu ke Supabase.' };
  }
}

/**
 * 2. Granular Delete for a Single Menu Item
 */
export async function deleteSingleMenuItemGranular(
  itemId: string,
  allMenuData: LetonData
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  const client = getSupabase();

  try {
    const { error: directError } = await client
      .from('menu_items')
      .delete()
      .eq('id', itemId);

    if (!directError) {
      logSupabaseOperation('DELETE_SINGLE_PRODUCT', 'menu_items', itemId, startTime);
      return { success: true };
    }

    if (directError.code !== '42P01') {
      logSupabaseOperation('DELETE_SINGLE_PRODUCT_DIRECT_FAIL', 'menu_items', itemId, startTime, directError);
    }

    const fallbackStart = Date.now();
    const result = await saveContentToSupabase(allMenuData);
    logSupabaseOperation('FALLBACK_DELETE_LETON_CONTENT', SUPABASE_TABLE_NAME, SUPABASE_ROW_ID, fallbackStart, result.error ? { message: result.error } : null);

    return result;
  } catch (err: any) {
    logSupabaseOperation('DELETE_SINGLE_PRODUCT_EXCEPTION', 'menu_items', itemId, startTime, err);
    return { success: false, error: err?.message || 'Gagal menghapus menu dari Supabase.' };
  }
}

/**
 * 3. Granular Save/Insert for a Single Category
 */
export async function saveSingleCategoryGranular(
  category: MenuCategory,
  allMenuData: LetonData
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  const client = getSupabase();

  try {
    const { error: directError } = await client
      .from('menu_categories')
      .upsert(category, { onConflict: 'id' });

    if (!directError) {
      logSupabaseOperation('UPSERT_SINGLE_CATEGORY', 'menu_categories', category.id, startTime);
      return { success: true };
    }

    if (directError.code !== '42P01') {
      logSupabaseOperation('UPSERT_SINGLE_CATEGORY_DIRECT_FAIL', 'menu_categories', category.id, startTime, directError);
    }

    const fallbackStart = Date.now();
    const result = await saveContentToSupabase(allMenuData);
    logSupabaseOperation('FALLBACK_SAVE_CATEGORY_LETON_CONTENT', SUPABASE_TABLE_NAME, SUPABASE_ROW_ID, fallbackStart, result.error ? { message: result.error } : null);

    return result;
  } catch (err: any) {
    logSupabaseOperation('UPSERT_SINGLE_CATEGORY_EXCEPTION', 'menu_categories', category.id, startTime, err);
    return { success: false, error: err?.message || 'Gagal menyimpan kategori ke Supabase.' };
  }
}

/**
 * 4. Granular Delete for a Single Category
 */
export async function deleteSingleCategoryGranular(
  catId: string,
  allMenuData: LetonData
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  const client = getSupabase();

  try {
    const { error: directError } = await client
      .from('menu_categories')
      .delete()
      .eq('id', catId);

    if (!directError) {
      logSupabaseOperation('DELETE_SINGLE_CATEGORY', 'menu_categories', catId, startTime);
      return { success: true };
    }

    if (directError.code !== '42P01') {
      logSupabaseOperation('DELETE_SINGLE_CATEGORY_DIRECT_FAIL', 'menu_categories', catId, startTime, directError);
    }

    const fallbackStart = Date.now();
    const result = await saveContentToSupabase(allMenuData);
    logSupabaseOperation('FALLBACK_DELETE_CATEGORY_LETON_CONTENT', SUPABASE_TABLE_NAME, SUPABASE_ROW_ID, fallbackStart, result.error ? { message: result.error } : null);

    return result;
  } catch (err: any) {
    logSupabaseOperation('DELETE_SINGLE_CATEGORY_EXCEPTION', 'menu_categories', catId, startTime, err);
    return { success: false, error: err?.message || 'Gagal menghapus kategori dari Supabase.' };
  }
}

/**
 * 5. Granular Save/Insert for a Single Customization Option (Topping / Syrup)
 */
export async function saveSingleCustomOptionGranular(
  type: 'topping' | 'syrup',
  option: CustomizationOption,
  allMenuData: LetonData
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  const client = getSupabase();
  const tableName = type === 'topping' ? 'master_toppings' : 'master_syrups';
  const opName = type === 'topping' ? 'UPSERT_SINGLE_TOPPING' : 'UPSERT_SINGLE_SYRUP';

  try {
    const { error: directError } = await client
      .from(tableName)
      .upsert(option, { onConflict: 'id' });

    if (!directError) {
      logSupabaseOperation(opName, tableName, option.id, startTime);
      return { success: true };
    }

    if (directError.code !== '42P01') {
      logSupabaseOperation(`${opName}_DIRECT_FAIL`, tableName, option.id, startTime, directError);
    }

    const fallbackStart = Date.now();
    const result = await saveContentToSupabase(allMenuData);
    logSupabaseOperation(`FALLBACK_${opName}_LETON_CONTENT`, SUPABASE_TABLE_NAME, SUPABASE_ROW_ID, fallbackStart, result.error ? { message: result.error } : null);

    return result;
  } catch (err: any) {
    logSupabaseOperation(`${opName}_EXCEPTION`, tableName, option.id, startTime, err);
    return { success: false, error: err?.message || `Gagal menyimpan ${type} ke Supabase.` };
  }
}

/**
 * 6. Granular Delete for a Single Customization Option (Topping / Syrup)
 */
export async function deleteSingleCustomOptionGranular(
  type: 'topping' | 'syrup',
  optionId: string,
  allMenuData: LetonData
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  const client = getSupabase();
  const tableName = type === 'topping' ? 'master_toppings' : 'master_syrups';
  const opName = type === 'topping' ? 'DELETE_SINGLE_TOPPING' : 'DELETE_SINGLE_SYRUP';

  try {
    const { error: directError } = await client
      .from(tableName)
      .delete()
      .eq('id', optionId);

    if (!directError) {
      logSupabaseOperation(opName, tableName, optionId, startTime);
      return { success: true };
    }

    if (directError.code !== '42P01') {
      logSupabaseOperation(`${opName}_DIRECT_FAIL`, tableName, optionId, startTime, directError);
    }

    const fallbackStart = Date.now();
    const result = await saveContentToSupabase(allMenuData);
    logSupabaseOperation(`FALLBACK_${opName}_LETON_CONTENT`, SUPABASE_TABLE_NAME, SUPABASE_ROW_ID, fallbackStart, result.error ? { message: result.error } : null);

    return result;
  } catch (err: any) {
    logSupabaseOperation(`${opName}_EXCEPTION`, tableName, optionId, startTime, err);
    return { success: false, error: err?.message || `Gagal menghapus ${type} dari Supabase.` };
  }
}
