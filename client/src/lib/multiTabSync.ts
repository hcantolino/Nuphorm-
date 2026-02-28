/**
 * Multi-Tab Synchronization Service
 * 
 * Synchronizes session state across multiple browser tabs
 * while keeping chat data isolated per tab
 * 
 * Features:
 * - Session sync via BroadcastChannel API
 * - Fallback to localStorage events
 * - Tab-specific chat isolation
 * - Session state broadcasting
 * - Logout detection across tabs
 * - Tab lifecycle management
 */

export interface SessionBroadcast {
  type: 'session-update' | 'session-logout' | 'session-refresh' | 'tab-close';
  sessionId: string;
  tabId: string;
  timestamp: number;
  data?: any;
}

export interface MultiTabSyncOptions {
  sessionId: string;
  tabId: string;
  debugMode?: boolean;
}

/**
 * Multi-Tab Synchronization Service
 */
class MultiTabSync {
  private sessionId: string;
  private tabId: string;
  private debugMode: boolean;
  private channel: BroadcastChannel | null = null;
  private useBroadcastChannel: boolean;
  private listeners: Map<
    string,
    Set<(broadcast: SessionBroadcast) => void>
  > = new Map();
  private isInitialized: boolean = false;

  constructor(options: MultiTabSyncOptions) {
    this.sessionId = options.sessionId;
    this.tabId = options.tabId;
    this.debugMode = options.debugMode || false;
    this.useBroadcastChannel = this.supportsBroadcastChannel();

    this.log('MultiTabSync initialized');
  }

  /**
   * Log debug messages
   */
  private log(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[MultiTabSync] ${message}`, data || '');
    }
  }

  /**
   * Check if browser supports BroadcastChannel
   */
  private supportsBroadcastChannel(): boolean {
    if (typeof window === 'undefined') return false;
    return typeof BroadcastChannel !== 'undefined';
  }

  /**
   * Initialize multi-tab sync
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.log('Already initialized');
      return;
    }

    try {
      if (this.useBroadcastChannel) {
        this.initializeBroadcastChannel();
      } else {
        this.initializeStorageEvents();
      }

      this.isInitialized = true;
      this.log('Multi-tab sync initialized successfully');
    } catch (error) {
      this.log('Error initializing multi-tab sync', error);
      // Fallback to storage events
      this.useBroadcastChannel = false;
      this.initializeStorageEvents();
      this.isInitialized = true;
    }
  }

  /**
   * Initialize BroadcastChannel
   */
  private initializeBroadcastChannel(): void {
    try {
      this.channel = new BroadcastChannel(`nuphorm-session-${this.sessionId}`);

      this.channel.onmessage = (event) => {
        const broadcast = event.data as SessionBroadcast;
        this.log('Received broadcast', broadcast);

        // Don't process own messages
        if (broadcast.tabId === this.tabId) {
          return;
        }

        this.notifyListeners(broadcast.type, broadcast);
      };

      this.log('BroadcastChannel initialized');
    } catch (error) {
      this.log('BroadcastChannel error', error);
      this.useBroadcastChannel = false;
      this.initializeStorageEvents();
    }
  }

  /**
   * Initialize storage events (fallback)
   */
  private initializeStorageEvents(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('storage', (event) => {
      if (!event.key || !event.key.startsWith(`nuphorm-sync-${this.sessionId}`)) {
        return;
      }

      try {
        const broadcast = JSON.parse(event.newValue || '{}') as SessionBroadcast;

        // Don't process own messages
        if (broadcast.tabId === this.tabId) {
          return;
        }

        this.log('Received storage event', broadcast);
        this.notifyListeners(broadcast.type, broadcast);
      } catch (error) {
        this.log('Error parsing storage event', error);
      }
    });

    this.log('Storage events initialized');
  }

  /**
   * Broadcast session update
   */
  broadcastSessionUpdate(data?: any): void {
    const broadcast: SessionBroadcast = {
      type: 'session-update',
      sessionId: this.sessionId,
      tabId: this.tabId,
      timestamp: Date.now(),
      data,
    };

    this.sendBroadcast(broadcast);
  }

  /**
   * Broadcast session logout
   */
  broadcastSessionLogout(): void {
    const broadcast: SessionBroadcast = {
      type: 'session-logout',
      sessionId: this.sessionId,
      tabId: this.tabId,
      timestamp: Date.now(),
    };

    this.sendBroadcast(broadcast);
  }

  /**
   * Broadcast session refresh
   */
  broadcastSessionRefresh(): void {
    const broadcast: SessionBroadcast = {
      type: 'session-refresh',
      sessionId: this.sessionId,
      tabId: this.tabId,
      timestamp: Date.now(),
    };

    this.sendBroadcast(broadcast);
  }

  /**
   * Broadcast tab close
   */
  broadcastTabClose(): void {
    const broadcast: SessionBroadcast = {
      type: 'tab-close',
      sessionId: this.sessionId,
      tabId: this.tabId,
      timestamp: Date.now(),
    };

    this.sendBroadcast(broadcast);
  }

  /**
   * Send broadcast
   */
  private sendBroadcast(broadcast: SessionBroadcast): void {
    this.log('Sending broadcast', broadcast);

    if (this.useBroadcastChannel && this.channel) {
      try {
        this.channel.postMessage(broadcast);
      } catch (error) {
        this.log('BroadcastChannel send error', error);
        this.sendViaStorage(broadcast);
      }
    } else {
      this.sendViaStorage(broadcast);
    }
  }

  /**
   * Send broadcast via localStorage
   */
  private sendViaStorage(broadcast: SessionBroadcast): void {
    try {
      const key = `nuphorm-sync-${this.sessionId}-${Date.now()}`;
      localStorage.setItem(key, JSON.stringify(broadcast));

      // Clean up old keys
      setTimeout(() => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 1000);
    } catch (error) {
      this.log('Storage send error', error);
    }
  }

  /**
   * Register listener for broadcast type
   */
  onBroadcast(
    type: SessionBroadcast['type'],
    callback: (broadcast: SessionBroadcast) => void
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(callback);
    this.log(`Listener registered for ${type}`);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(callback);
      this.log(`Listener unregistered for ${type}`);
    };
  }

  /**
   * Notify listeners
   */
  private notifyListeners(
    type: SessionBroadcast['type'],
    broadcast: SessionBroadcast
  ): void {
    const callbacks = this.listeners.get(type);
    if (!callbacks) return;

    callbacks.forEach((callback) => {
      try {
        callback(broadcast);
      } catch (error) {
        this.log('Error in broadcast listener', error);
      }
    });
  }

  /**
   * Get active tabs count
   */
  async getActiveTabsCount(): Promise<number> {
    // This is a best-effort estimate
    // In a real app, you might want to track this more precisely
    try {
      let count = 1; // Current tab

      if (this.useBroadcastChannel && this.channel) {
        // BroadcastChannel doesn't provide tab count directly
        // We'd need to implement a heartbeat system for accurate count
      } else {
        // Estimate from localStorage keys
        const prefix = `nuphorm-tab-${this.sessionId}`;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            count++;
          }
        }
      }

      return count;
    } catch (error) {
      this.log('Error getting active tabs count', error);
      return 1;
    }
  }

  /**
   * Get sync stats
   */
  getStats(): {
    sessionId: string;
    tabId: string;
    syncMethod: 'broadcastchannel' | 'storage';
    isInitialized: boolean;
    listenerCount: number;
  } {
    let listenerCount = 0;
    this.listeners.forEach((callbacks) => {
      listenerCount += callbacks.size;
    });

    return {
      sessionId: this.sessionId,
      tabId: this.tabId,
      syncMethod: this.useBroadcastChannel ? 'broadcastchannel' : 'storage',
      isInitialized: this.isInitialized,
      listenerCount,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.channel) {
      try {
        this.channel.close();
      } catch (error) {
        this.log('Error closing BroadcastChannel', error);
      }
      this.channel = null;
    }

    this.listeners.clear();
    this.log('MultiTabSync cleaned up');
  }
}

// Instance map (keyed by sessionId)
const instances = new Map<string, MultiTabSync>();

/**
 * Get or create multi-tab sync instance
 */
export async function getMultiTabSync(
  options: MultiTabSyncOptions
): Promise<MultiTabSync> {
  if (!instances.has(options.sessionId)) {
    const sync = new MultiTabSync(options);
    await sync.initialize();
    instances.set(options.sessionId, sync);
  }

  return instances.get(options.sessionId)!;
}

/**
 * Remove multi-tab sync instance
 */
export function removeMultiTabSync(sessionId: string): void {
  const sync = instances.get(sessionId);
  if (sync) {
    sync.cleanup();
    instances.delete(sessionId);
  }
}

/**
 * Clear all multi-tab sync instances
 */
export function clearAllMultiTabSync(): void {
  instances.forEach((sync) => sync.cleanup());
  instances.clear();
}

export default MultiTabSync;
