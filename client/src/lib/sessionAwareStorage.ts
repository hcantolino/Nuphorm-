/**
 * Session-Aware Storage Manager
 * 
 * Manages auto-save/restore of chat data with session lifecycle integration
 * 
 * Features:
 * - Auto-save chat state at intervals
 * - Restore chat state on mount
 * - Session refresh/logout detection
 * - Graceful cleanup on logout
 * - Debounced saves to prevent excessive writes
 * - Error recovery
 */

import { getPersistentStorage, StoredChatSession } from './persistentStorage';

export interface ChatState {
  chatMessages: any[];
  uploadedData: any;
  fullData: any[];
  conversationHistory: Array<{ role: string; content: string }>;
}

export interface SessionAwareStorageOptions {
  sessionId: string;
  tabId: string;
  autoSaveIntervalMs?: number; // default 5 seconds
  debugMode?: boolean;
}

/**
 * Session-Aware Storage Manager
 */
class SessionAwareStorageManager {
  private sessionId: string;
  private tabId: string;
  private autoSaveIntervalMs: number;
  private debugMode: boolean;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private pendingChanges: Partial<ChatState> | null = null;
  private lastSaveTime: number = 0;
  private listeners: Set<(state: ChatState | null) => void> = new Set();
  private isOnline: boolean = navigator.onLine;

  constructor(options: SessionAwareStorageOptions) {
    this.sessionId = options.sessionId;
    this.tabId = options.tabId;
    this.autoSaveIntervalMs = options.autoSaveIntervalMs || 5000; // 5 seconds
    this.debugMode = options.debugMode || false;

    this.log('SessionAwareStorageManager initialized');
    this.setupNetworkListeners();
  }

  /**
   * Log debug messages
   */
  private log(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[SessionAwareStorageManager] ${message}`, data || '');
    }
  }

  /**
   * Setup network event listeners
   */
  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.log('Network online');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.log('Network offline');
    });
  }

  /**
   * Initialize and restore chat state
   */
  async initialize(): Promise<ChatState | null> {
    try {
      const storage = await getPersistentStorage({
        sessionId: this.sessionId,
        debugMode: this.debugMode,
      });

      const savedSession = await storage.loadChatSession(this.tabId);

      if (savedSession) {
        this.log('Chat state restored from storage', {
          messagesCount: savedSession.chatMessages.length,
          tabId: this.tabId,
        });

        return {
          chatMessages: savedSession.chatMessages,
          uploadedData: savedSession.uploadedData,
          fullData: savedSession.fullData,
          conversationHistory: savedSession.conversationHistory,
        };
      }

      this.log('No saved chat state found');
      return null;
    } catch (error) {
      this.log('Error restoring chat state', error);
      return null;
    }
  }

  /**
   * Mark changes for auto-save
   */
  markDirty(changes: Partial<ChatState>): void {
    this.pendingChanges = {
      ...this.pendingChanges,
      ...changes,
    };

    this.scheduleAutoSave();
  }

  /**
   * Schedule auto-save with debouncing
   */
  private scheduleAutoSave(): void {
    // Clear existing timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    // Schedule new save
    this.autoSaveTimer = setTimeout(() => {
      this.autoSave();
    }, this.autoSaveIntervalMs);
  }

  /**
   * Auto-save chat state
   */
  private async autoSave(): Promise<void> {
    if (!this.pendingChanges) {
      return;
    }

    if (!this.isOnline) {
      this.log('Offline - deferring auto-save');
      return;
    }

    try {
      const storage = await getPersistentStorage({
        sessionId: this.sessionId,
        debugMode: this.debugMode,
      });

      await storage.saveChatSession(this.tabId, {
        tabId: this.tabId,
        chatMessages: this.pendingChanges.chatMessages || [],
        uploadedData: this.pendingChanges.uploadedData,
        fullData: this.pendingChanges.fullData || [],
        conversationHistory: this.pendingChanges.conversationHistory || [],
      });

      this.lastSaveTime = Date.now();
      this.pendingChanges = null;

      this.log('Chat state auto-saved', {
        tabId: this.tabId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.log('Auto-save error', error);
      // Keep pending changes for retry
    }
  }

  /**
   * Force immediate save
   */
  async forceSave(state: ChatState): Promise<void> {
    try {
      const storage = await getPersistentStorage({
        sessionId: this.sessionId,
        debugMode: this.debugMode,
      });

      await storage.saveChatSession(this.tabId, {
        tabId: this.tabId,
        chatMessages: state.chatMessages,
        uploadedData: state.uploadedData,
        fullData: state.fullData,
        conversationHistory: state.conversationHistory,
      });

      this.lastSaveTime = Date.now();
      this.pendingChanges = null;

      this.log('Chat state force-saved', {
        tabId: this.tabId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.log('Force-save error', error);
      throw error;
    }
  }

  /**
   * Handle session refresh
   */
  async onSessionRefresh(): Promise<void> {
    this.log('Session refresh detected');

    try {
      // Force save any pending changes
      if (this.pendingChanges) {
        const storage = await getPersistentStorage({
          sessionId: this.sessionId,
          debugMode: this.debugMode,
        });

        await storage.saveChatSession(this.tabId, {
          tabId: this.tabId,
          chatMessages: this.pendingChanges.chatMessages || [],
          uploadedData: this.pendingChanges.uploadedData,
          fullData: this.pendingChanges.fullData || [],
          conversationHistory: this.pendingChanges.conversationHistory || [],
        });

        this.pendingChanges = null;
      }

      this.log('Chat state saved before session refresh');
    } catch (error) {
      this.log('Error saving before session refresh', error);
    }
  }

  /**
   * Handle logout
   */
  async onLogout(): Promise<void> {
    this.log('Logout detected');

    try {
      // Stop auto-save
      if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = null;
      }

      // Save final state if needed
      if (this.pendingChanges) {
        const storage = await getPersistentStorage({
          sessionId: this.sessionId,
          debugMode: this.debugMode,
        });

        await storage.saveChatSession(this.tabId, {
          tabId: this.tabId,
          chatMessages: this.pendingChanges.chatMessages || [],
          uploadedData: this.pendingChanges.uploadedData,
          fullData: this.pendingChanges.fullData || [],
          conversationHistory: this.pendingChanges.conversationHistory || [],
        });
      }

      this.log('Chat state saved before logout');
    } catch (error) {
      this.log('Error saving before logout', error);
    }
  }

  /**
   * Clear chat data for this tab
   */
  async clearChatData(): Promise<void> {
    try {
      const storage = await getPersistentStorage({
        sessionId: this.sessionId,
        debugMode: this.debugMode,
      });

      await storage.deleteChatSession(this.tabId);
      this.pendingChanges = null;

      this.log('Chat data cleared for tab', { tabId: this.tabId });
    } catch (error) {
      this.log('Error clearing chat data', error);
    }
  }

  /**
   * Clear all chat data for session
   */
  async clearAllChatData(): Promise<void> {
    try {
      const storage = await getPersistentStorage({
        sessionId: this.sessionId,
        debugMode: this.debugMode,
      });

      await storage.deleteAllSessions();
      this.pendingChanges = null;

      this.log('All chat data cleared for session');
    } catch (error) {
      this.log('Error clearing all chat data', error);
    }
  }

  /**
   * Register listener for state changes
   */
  onStateChange(callback: (state: ChatState | null) => void): () => void {
    this.listeners.add(callback);
    this.log('State change listener registered');

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
      this.log('State change listener unregistered');
    };
  }

  /**
   * Notify listeners of state changes
   */
  private notifyListeners(state: ChatState | null): void {
    this.listeners.forEach((callback) => {
      try {
        callback(state);
      } catch (error) {
        this.log('Error in state change listener', error);
      }
    });
  }

  /**
   * Get storage stats
   */
  async getStats(): Promise<{
    sessionId: string;
    tabId: string;
    lastSaveTime: number;
    hasPendingChanges: boolean;
    isOnline: boolean;
    storageStats?: {
      storageType: 'indexeddb' | 'localstorage';
      sessionCount: number;
      totalSize: number;
    };
  }> {
    try {
      const storage = await getPersistentStorage({
        sessionId: this.sessionId,
        debugMode: this.debugMode,
      });

      const storageStats = await storage.getStats();

      return {
        sessionId: this.sessionId,
        tabId: this.tabId,
        lastSaveTime: this.lastSaveTime,
        hasPendingChanges: this.pendingChanges !== null,
        isOnline: this.isOnline,
        storageStats,
      };
    } catch (error) {
      this.log('Error getting stats', error);
      return {
        sessionId: this.sessionId,
        tabId: this.tabId,
        lastSaveTime: this.lastSaveTime,
        hasPendingChanges: this.pendingChanges !== null,
        isOnline: this.isOnline,
      };
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    this.listeners.clear();
    this.log('SessionAwareStorageManager cleaned up');
  }
}

// Instance map (keyed by sessionId-tabId)
const instances = new Map<string, SessionAwareStorageManager>();

/**
 * Get or create session-aware storage manager
 */
export function getSessionAwareStorageManager(
  options: SessionAwareStorageOptions
): SessionAwareStorageManager {
  const key = `${options.sessionId}-${options.tabId}`;

  if (!instances.has(key)) {
    const manager = new SessionAwareStorageManager(options);
    instances.set(key, manager);
  }

  return instances.get(key)!;
}

/**
 * Remove storage manager instance
 */
export function removeSessionAwareStorageManager(
  sessionId: string,
  tabId: string
): void {
  const key = `${sessionId}-${tabId}`;
  const manager = instances.get(key);
  if (manager) {
    manager.cleanup();
    instances.delete(key);
  }
}

/**
 * Clear all storage manager instances
 */
export function clearAllSessionAwareStorageManagers(): void {
  instances.forEach((manager) => manager.cleanup());
  instances.clear();
}

export default SessionAwareStorageManager;
