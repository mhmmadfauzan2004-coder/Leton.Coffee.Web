/**
 * Native IndexedDB storage wrapper for Leton Coffee
 * Provides high-capacity (hundreds of megabytes) persistent offline storage
 * that never hits the 5MB localStorage quota limit.
 */

const DB_NAME = 'LetonCoffeeDB';
const DB_VERSION = 1;
const STORE_NAME = 'leton_store';
const DATA_KEY = 'current_content';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function setIdbData(key: string, value: any): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[IndexedDB] Set error:', err);
    return false;
  }
}

export async function getIdbData<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] Get error:', err);
    return null;
  }
}

export async function saveGlobalDataToIdb(data: any): Promise<boolean> {
  return setIdbData(DATA_KEY, data);
}

export async function loadGlobalDataFromIdb(): Promise<any | null> {
  return getIdbData(DATA_KEY);
}
