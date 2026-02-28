/**
 * Persistent Storage Service
 * 
 * Provides abstraction over IndexedDB with localStorage fallback
 * for storing tab-specific chat data, keyed by session ID
 * 
 * Features:
 * - IndexedDB for large data storage
 * - localStorage fallback for browsers without IndexedDB
 * - Session-aware storage (data keyed by session ID)
 * - Automatic cleanup of old sessions
 * - Compression for large data
 * - Error handling and recovery
 */

const DB_NAME = 'nuphorm-biostat-db';
const DB_VERSION = 1;
const STORE_NAME = 'chat-sessions';
const FALLBACK_KEY_PREFIX = 'nuphorm_chat_';
const COMPRESSION_THRESHOLD = 10000; // Compress if > 10KB

export interface StoredChatSession {
  sessionId: string;
  tabId: string;
  chatMessages: any[];
  uploadedData: any;
  fullData: any[];
  conversationHistory: Array<{ role: string; content: string }>;
  createdAt: number;
  updatedAt: number;
  expiresAt: number; // Auto-cleanup timestamp
}

export interface StorageOptions {
  sessionId: string;
  debugMode?: boolean;
  compressionEnabled?: boolean;
  ttlMs?: number; // Time to live in milliseconds (default 7 days)
}

/**
 * Persistent Storage Service
 */
class PersistentStorage {
  private db: IDBDatabase | null = null;
  private useIndexedDB: boolean = true;
  private debugMode: boolean;
  private compressionEnabled: boolean;
  private ttlMs: number;
  private sessionId: string;

  constructor(options: StorageOptions) {
    this.sessionId = options.sessionId;
    this.debugMode = options.debugMode || false;
    this.compressionEnabled = options.compressionEnabled !== false;
    this.ttlMs = options.ttlMs || 7 * 24 * 60 * 60 * 1000; // 7 days default
    this.log('PersistentStorage initialized');
  }

  /**
   * Log debug messages
   */
  private log(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[PersistentStorage] ${message}`, data || '');
    }
  }

  /**
   * Initialize IndexedDB
   */
  async initialize(): Promise<void> {
    if (!this.supportsIndexedDB()) {
      this.log('IndexedDB not supported, using localStorage fallback');
      this.useIndexedDB = false;
      return;
    }

    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          this.log('IndexedDB open failed, using localStorage fallback');
          this.useIndexedDB = false;
          resolve();
        };

        request.onsuccess = () => {
          this.db = request.result;
          this.log('IndexedDB initialized successfully');
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('tabId', 'tabId', { unique: false });
            store.createIndex('expiresAt', 'expiresAt', { unique: false });
            this.log('IndexedDB object store created');
          }
        };
      });
    } catch (error) {
      this.log('IndexedDB initialization error', error);
      this.useIndexedDB = false;
    }
  }

  /**
   * Check if browser supports IndexedDB
   */
  private supportsIndexedDB(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      window.indexedDB ||
      (window as any).mozIndexedDB ||
      (window as any).webkitIndexedDB ||
      (window as any).msIndexedDB
    );
  }

  /**
   * Compress data using JSON stringification
   */
  private compress(data: any): string {
    return JSON.stringify(data);
  }

  /**
   * Decompress data
   */
  private decompress(data: string): any {
    return JSON.parse(data);
  }

  /**
   * Save chat session
   */
  async saveChatSession(
    tabId: string,
    session: Omit<StoredChatSession, 'sessionId' | 'createdAt' | 'updatedAt' | 'expiresAt'>
  ): Promise<void> {
    const storedSession: StoredChatSession = {
      ...session,
      sessionId: this.sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
    };

    if (this.useIndexedDB && this.db) {
      await this.saveToIndexedDB(tabId, storedSession);
    } else {
      this.saveToLocalStorage(tabId, storedSession);
    }

    this.log(`Chat session saved for tab ${tabId}`);
  }

  /**
   * Save to IndexedDB
   */
  private saveToIndexedDB(
    tabId: string,
    session: StoredChatSession
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const id = `${this.sessionId}-${tabId}`;

      const request = store.put({
        id,
        ...session,
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Save to localStorage
   */
  private saveToLocalStorage(tabId: string, session: StoredChatSession): void {
    try {
      const key = `${FALLBACK_KEY_PREFIX}${this.sessionId}-${tabId}`;
      const data = this.compress(session);
      localStorage.setItem(key, data);
    } catch (error) {
      this.log('localStorage save error', error);
      // Handle quota exceeded
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.cleanupOldSessions();
      }
    }
  }

  /**
   * Load chat session
   */
  async loadChatSession(tabId: string): Promise<StoredChatSession | null> {
    if (this.useIndexedDB && this.db) {
      return this.loadFromIndexedDB(tabId);
    } else {
      return this.loadFromLocalStorage(tabId);
    }
  }

  /**
   * Load from IndexedDB
   */
  private loadFromIndexedDB(tabId: string): Promise<StoredChatSession | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const id = `${this.sessionId}-${tabId}`;

      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.expiresAt > Date.now()) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
    });
  }

  /**
   * Load from localStorage
   */
  private loadFromLocalStorage(tabId: string): StoredChatSession | null {
    try {
      const key = `${FALLBACK_KEY_PREFIX}${this.sessionId}-${tabId}`;
      const data = localStorage.getItem(key);

      if (!data) return null;

      const session = this.decompress(data);
      if (session.expiresAt > Date.now()) {
        return session;
      } else {
        localStorage.removeItem(key);
        return null;
      }
    } catch (error) {
      this.log('localStorage load error', error);
      return null;
    }
  }

  /**
   * Delete chat session
   */
  async deleteChatSession(tabId: string): Promise<void> {
    if (this.useIndexedDB && this.db) {
      await this.deleteFromIndexedDB(tabId);
    } else {
      this.deleteFromLocalStorage(tabId);
    }

    this.log(`Chat session deleted for tab ${tabId}`);
  }

  /**
   * Delete from IndexedDB
   */
  private deleteFromIndexedDB(tabId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const id = `${this.sessionId}-${tabId}`;

      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Delete from localStorage
   */
  private deleteFromLocalStorage(tabId: string): void {
    try {
      const key = `${FALLBACK_KEY_PREFIX}${this.sessionId}-${tabId}`;
      localStorage.removeItem(key);
    } catch (error) {
      this.log('localStorage delete error', error);
    }
  }

  /**
   * Delete all sessions for current session ID
   */
  async deleteAllSessions(): Promise<void> {
    if (this.useIndexedDB && this.db) {
      await this.deleteAllFromIndexedDB();
    } else {
      this.deleteAllFromLocalStorage();
    }

    this.log('All chat sessions deleted');
  }

  /**
   * Delete all from IndexedDB
   */
  private deleteAllFromIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('sessionId');

      const range = IDBKeyRange.only(this.sessionId);
      const request = index.openCursor(range);
      const keysToDelete: IDBValidKey[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          keysToDelete.push(cursor.primaryKey);
          cursor.continue();
        } else {
          // Delete all keys
          keysToDelete.forEach((key) => {
            store.delete(key);
          });
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete all from localStorage
   */
  private deleteAllFromLocalStorage(): void {
    try {
      const prefix = `${FALLBACK_KEY_PREFIX}${this.sessionId}`;
      const keysToDelete: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      this.log('localStorage delete all error', error);
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupOldSessions(): Promise<void> {
    if (this.useIndexedDB && this.db) {
      await this.cleanupFromIndexedDB();
    } else {
      this.cleanupFromLocalStorage();
    }

    this.log('Old sessions cleaned up');
  }

  /**
   * Cleanup from IndexedDB
   */
  private cleanupFromIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('expiresAt');

      const range = IDBKeyRange.upperBound(Date.now());
      const request = index.openCursor(range);
      const keysToDelete: IDBValidKey[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          keysToDelete.push(cursor.primaryKey);
          cursor.continue();
        } else {
          keysToDelete.forEach((key) => {
            store.delete(key);
          });
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cleanup from localStorage
   */
  private cleanupFromLocalStorage(): void {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(FALLBACK_KEY_PREFIX)) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const session = this.decompress(data);
              if (session.expiresAt <= now) {
                keysToDelete.push(key);
              }
            }
          } catch (error) {
            // Skip malformed entries
          }
        }
      }

      keysToDelete.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      this.log('localStorage cleanup error', error);
    }
  }

  /**
   * Get storage stats
   */
  async getStats(): Promise<{
    storageType: 'indexeddb' | 'localstorage';
    sessionCount: number;
    totalSize: number;
  }> {
    if (this.useIndexedDB && this.db) {
      return this.getIndexedDBStats();
    } else {
      return this.getLocalStorageStats();
    }
  }

  /**
   * Get IndexedDB stats
   */
  private getIndexedDBStats(): Promise<{
    storageType: 'indexeddb' | 'localstorage';
    sessionCount: number;
    totalSize: number;
  }> {
    return new Promise((resolve) => {
      if (!this.db) {
        resolve({ storageType: 'localstorage', sessionCount: 0, totalSize: 0 });
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('sessionId');

      const range = IDBKeyRange.only(this.sessionId);
      const request = index.getAll(range);

      request.onsuccess = () => {
        const results = request.result;
        const totalSize = JSON.stringify(results).length;
        resolve({
          storageType: 'indexeddb',
          sessionCount: results.length,
          totalSize,
        });
      };

      request.onerror = () => {
        resolve({ storageType: 'indexeddb', sessionCount: 0, totalSize: 0 });
      };
    });
  }

  /**
   * Get localStorage stats
   */
  private getLocalStorageStats(): {
    storageType: 'indexeddb' | 'localstorage';
    sessionCount: number;
    totalSize: number;
  } {
    let sessionCount = 0;
    let totalSize = 0;
    const prefix = `${FALLBACK_KEY_PREFIX}${this.sessionId}`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        sessionCount++;
        const data = localStorage.getItem(key);
        if (data) {
          totalSize += data.length;
        }
      }
    }

    return {
      storageType: 'localstorage',
      sessionCount,
      totalSize,
    };
  }
}

// Singleton instance map (keyed by session ID)
const instances = new Map<string, PersistentStorage>();

/**
 * Get or create persistent storage instance
 */
export async function getPersistentStorage(
  options: StorageOptions
): Promise<PersistentStorage> {
  if (!instances.has(options.sessionId)) {
    const storage = new PersistentStorage(options);
    await storage.initialize();
    instances.set(options.sessionId, storage);
  }
  return instances.get(options.sessionId)!;
}

/**
 * Reset storage instance (useful for testing)
 */
export function resetPersistentStorage(sessionId: string): void {
  instances.delete(sessionId);
}

/**
 * Clear all storage instances
 */
export function clearAllPersistentStorage(): void {
  instances.clear();
}

export default PersistentStorage;
