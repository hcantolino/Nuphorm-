/**
 * Session Storage Service
 * 
 * Provides a robust session persistence layer with:
 * - localStorage fallback when cookies are blocked or restricted
 * - Cross-tab synchronization using storage events
 * - Automatic session refresh on tab focus
 * - Graceful error handling and recovery
 * 
 * This service bridges the gap between HttpOnly cookies (secure but not accessible to JS)
 * and localStorage (accessible but provides fallback when cookies fail).
 */

import { COOKIE_NAME } from "@shared/const";

export interface SessionData {
  userId: string;
  sessionToken?: string;
  lastRefresh: number;
  expiresAt: number;
  metadata?: Record<string, any>;
}

export interface SessionStorageOptions {
  storageKey?: string;
  syncInterval?: number;
  debugMode?: boolean;
}

const DEFAULT_SESSION_KEY = "nuphorm_session_backup";
const DEFAULT_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * SessionStorage class manages session persistence with fallback mechanisms
 */
class SessionStorageService {
  private storageKey: string;
  private syncInterval: number;
  private debugMode: boolean;
  private syncTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(data: SessionData | null) => void> = new Set();
  private lastSyncTime: number = 0;

  constructor(options: SessionStorageOptions = {}) {
    this.storageKey = options.storageKey || DEFAULT_SESSION_KEY;
    this.syncInterval = options.syncInterval || DEFAULT_SYNC_INTERVAL;
    this.debugMode = options.debugMode || false;

    this.log("SessionStorageService initialized");
    this.setupStorageListener();
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[SessionStorage] ${message}`, data || "");
    }
  }

  /**
   * Setup listener for storage events (cross-tab synchronization)
   */
  private setupStorageListener(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("storage", (event) => {
      if (event.key === this.storageKey && event.newValue) {
        try {
          const sessionData = JSON.parse(event.newValue) as SessionData;
          this.log("Session updated from another tab", sessionData);
          this.notifyListeners(sessionData);
        } catch (error) {
          this.log("Failed to parse session from storage event", error);
        }
      }
    });

    // Listen for visibility changes to refresh session when tab comes into focus
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      this.log("Tab became visible, checking session");
      this.checkSessionValidity();
    });
  }

  /**
   * Save session data to localStorage
   */
  saveSession(sessionData: SessionData): void {
    if (typeof window === "undefined" || !window.localStorage) {
      this.log("localStorage not available");
      return;
    }

    try {
      const dataToStore = {
        ...sessionData,
        lastRefresh: Date.now(),
      };
      window.localStorage.setItem(this.storageKey, JSON.stringify(dataToStore));
      this.log("Session saved to localStorage", dataToStore);
      this.notifyListeners(dataToStore);
    } catch (error) {
      this.log("Failed to save session to localStorage", error);
      // Handle quota exceeded or other storage errors
      if (error instanceof Error && error.name === "QuotaExceededError") {
        this.clearSession();
      }
    }
  }

  /**
   * Retrieve session data from localStorage
   */
  getSession(): SessionData | null {
    if (typeof window === "undefined" || !window.localStorage) {
      this.log("localStorage not available");
      return null;
    }

    try {
      const stored = window.localStorage.getItem(this.storageKey);
      if (!stored) {
        this.log("No session found in localStorage");
        return null;
      }

      const sessionData = JSON.parse(stored) as SessionData;
      this.log("Session retrieved from localStorage", sessionData);

      // Check if session is expired
      if (sessionData.expiresAt < Date.now()) {
        this.log("Session has expired");
        this.clearSession();
        return null;
      }

      return sessionData;
    } catch (error) {
      this.log("Failed to retrieve session from localStorage", error);
      return null;
    }
  }

  /**
   * Clear session data from localStorage
   */
  clearSession(): void {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    try {
      window.localStorage.removeItem(this.storageKey);
      this.log("Session cleared from localStorage");
      this.notifyListeners(null);
    } catch (error) {
      this.log("Failed to clear session from localStorage", error);
    }
  }

  /**
   * Check if session is still valid
   */
  isSessionValid(): boolean {
    const session = this.getSession();
    if (!session) return false;

    const isExpired = session.expiresAt < Date.now();
    if (isExpired) {
      this.log("Session validation failed: expired");
      this.clearSession();
      return false;
    }

    this.log("Session validation passed");
    return true;
  }

  /**
   * Check session validity and notify listeners
   */
  private checkSessionValidity(): void {
    const isValid = this.isSessionValid();
    if (!isValid) {
      this.notifyListeners(null);
    }
  }

  /**
   * Update session expiration time
   */
  updateSessionExpiration(expiresAtMs: number): void {
    const session = this.getSession();
    if (session) {
      session.expiresAt = expiresAtMs;
      this.saveSession(session);
      this.log("Session expiration updated", { expiresAt: expiresAtMs });
    }
  }

  /**
   * Get time until session expires (in milliseconds)
   */
  getTimeUntilExpiration(): number {
    const session = this.getSession();
    if (!session) return 0;

    const timeRemaining = session.expiresAt - Date.now();
    return Math.max(0, timeRemaining);
  }

  /**
   * Check if session is about to expire (within threshold)
   */
  isSessionExpiringSoon(thresholdMs: number = 5 * 60 * 1000): boolean {
    const timeRemaining = this.getTimeUntilExpiration();
    const isExpiring = timeRemaining > 0 && timeRemaining < thresholdMs;
    
    if (isExpiring) {
      this.log(`Session expiring soon: ${timeRemaining}ms remaining`);
    }

    return isExpiring;
  }

  /**
   * Register listener for session changes
   */
  onSessionChange(callback: (data: SessionData | null) => void): () => void {
    this.listeners.add(callback);
    this.log("Session change listener registered");

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
      this.log("Session change listener unregistered");
    };
  }

  /**
   * Notify all listeners of session changes
   */
  private notifyListeners(data: SessionData | null): void {
    this.listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        this.log("Error in session change listener", error);
      }
    });
  }

  /**
   * Start automatic session synchronization
   */
  startAutoSync(onSync?: () => Promise<void>): void {
    if (this.syncTimer) {
      this.log("Auto sync already started");
      return;
    }

    this.log(`Starting auto sync with interval: ${this.syncInterval}ms`);

    this.syncTimer = setInterval(async () => {
      const now = Date.now();
      const timeSinceLastSync = now - this.lastSyncTime;

      // Prevent sync spam
      if (timeSinceLastSync < 1000) {
        return;
      }

      this.lastSyncTime = now;

      try {
        if (onSync) {
          await onSync();
        }
        this.log("Auto sync completed");
      } catch (error) {
        this.log("Auto sync failed", error);
      }
    }, this.syncInterval);
  }

  /**
   * Stop automatic session synchronization
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      this.log("Auto sync stopped");
    }
  }

  /**
   * Get session storage statistics
   */
  getStats(): {
    hasSession: boolean;
    isValid: boolean;
    timeUntilExpiration: number;
    isExpiringSoon: boolean;
    storageSize: number;
  } {
    const session = this.getSession();
    const stored = window.localStorage?.getItem(this.storageKey) || "";

    return {
      hasSession: !!session,
      isValid: this.isSessionValid(),
      timeUntilExpiration: this.getTimeUntilExpiration(),
      isExpiringSoon: this.isSessionExpiringSoon(),
      storageSize: stored.length,
    };
  }
}

// Create singleton instance
let sessionStorageInstance: SessionStorageService | null = null;

/**
 * Get or create the session storage service instance
 */
export function getSessionStorage(
  options?: SessionStorageOptions
): SessionStorageService {
  if (!sessionStorageInstance) {
    sessionStorageInstance = new SessionStorageService(options);
  }
  return sessionStorageInstance;
}

/**
 * Reset the session storage service (useful for testing)
 */
export function resetSessionStorage(): void {
  if (sessionStorageInstance) {
    sessionStorageInstance.stopAutoSync();
    sessionStorageInstance = null;
  }
}

export default SessionStorageService;
