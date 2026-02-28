/**
 * useSessionEvents Hook
 * 
 * Handles session lifecycle events:
 * - Logout detection
 * - Session refresh
 * - Tab close
 * - Multi-tab synchronization
 * 
 * Integrates with:
 * - SessionAwareStorageManager for auto-save
 * - MultiTabSync for cross-tab coordination
 */

import { useEffect, useRef, useCallback } from 'react';
import { getSessionAwareStorageManager, removeSessionAwareStorageManager } from './sessionAwareStorage';
import { getMultiTabSync, removeMultiTabSync } from './multiTabSync';

export interface UseSessionEventsOptions {
  sessionId: string;
  tabId: string;
  onLogout?: () => void;
  onSessionRefresh?: () => void;
  onTabClose?: () => void;
  onRemoteLogout?: () => void; // Called when another tab logs out
  onRemoteSessionRefresh?: () => void; // Called when another tab refreshes session
  debugMode?: boolean;
}

/**
 * Hook for managing session lifecycle events
 */
export function useSessionEvents(options: UseSessionEventsOptions): void {
  const {
    sessionId,
    tabId,
    onLogout,
    onSessionRefresh,
    onTabClose,
    onRemoteLogout,
    onRemoteSessionRefresh,
    debugMode = false,
  } = options;

  const storageManagerRef = useRef(getSessionAwareStorageManager({
    sessionId,
    tabId,
    debugMode,
  }));

  const multiTabSyncRef = useRef<any>(null);
  const isCleaningUpRef = useRef(false);

  /**
   * Log debug messages
   */
  const log = useCallback(
    (message: string, data?: any) => {
      if (debugMode) {
        console.log(`[useSessionEvents] ${message}`, data || '');
      }
    },
    [debugMode]
  );

  /**
   * Initialize multi-tab sync
   */
  useEffect(() => {
    const initializeSync = async () => {
      try {
        const sync = await getMultiTabSync({ sessionId, tabId, debugMode });
        multiTabSyncRef.current = sync;

        // Listen for remote logout
        sync.onBroadcast('session-logout', (broadcast) => {
          log('Remote logout detected', broadcast);
          onRemoteLogout?.();
        });

        // Listen for remote session refresh
        sync.onBroadcast('session-refresh', (broadcast) => {
          log('Remote session refresh detected', broadcast);
          onRemoteSessionRefresh?.();
        });

        // Listen for remote tab close
        sync.onBroadcast('tab-close', (broadcast) => {
          log('Remote tab closed', broadcast);
        });

        log('Multi-tab sync initialized');
      } catch (error) {
        log('Error initializing multi-tab sync', error);
      }
    };

    initializeSync();

    return () => {
      if (multiTabSyncRef.current) {
        multiTabSyncRef.current.cleanup();
      }
    };
  }, [sessionId, tabId, debugMode, log, onRemoteLogout, onRemoteSessionRefresh]);

  /**
   * Handle logout
   */
  const handleLogout = useCallback(async () => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    try {
      log('Logout handler called');

      // Notify other tabs
      if (multiTabSyncRef.current) {
        multiTabSyncRef.current.broadcastSessionLogout();
      }

      // Save final state
      const storageManager = storageManagerRef.current;
      await storageManager.onLogout();

      // Call user callback
      onLogout?.();

      log('Logout completed');
    } catch (error) {
      log('Error during logout', error);
    } finally {
      isCleaningUpRef.current = false;
    }
  }, [log, onLogout]);

  /**
   * Handle session refresh
   */
  const handleSessionRefresh = useCallback(async () => {
    try {
      log('Session refresh handler called');

      // Notify other tabs
      if (multiTabSyncRef.current) {
        multiTabSyncRef.current.broadcastSessionRefresh();
      }

      // Save state before refresh
      const storageManager = storageManagerRef.current;
      await storageManager.onSessionRefresh();

      // Call user callback
      onSessionRefresh?.();

      log('Session refresh completed');
    } catch (error) {
      log('Error during session refresh', error);
    }
  }, [log, onSessionRefresh]);

  /**
   * Handle tab close
   */
  const handleTabClose = useCallback(async () => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    try {
      log('Tab close handler called');

      // Notify other tabs
      if (multiTabSyncRef.current) {
        multiTabSyncRef.current.broadcastTabClose();
      }

      // Save final state
      const storageManager = storageManagerRef.current;
      await storageManager.forceSave({
        chatMessages: [],
        uploadedData: null,
        fullData: [],
        conversationHistory: [],
      });

      // Call user callback
      onTabClose?.();

      log('Tab close completed');
    } catch (error) {
      log('Error during tab close', error);
    } finally {
      isCleaningUpRef.current = false;
    }
  }, [log, onTabClose]);

  /**
   * Setup beforeunload listener for tab close
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = () => {
      handleTabClose();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleTabClose]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (storageManagerRef.current) {
        storageManagerRef.current.cleanup();
      }

      if (multiTabSyncRef.current) {
        multiTabSyncRef.current.cleanup();
      }

      removeSessionAwareStorageManager(sessionId, tabId);
      removeMultiTabSync(sessionId);

      log('useSessionEvents cleanup completed');
    };
  }, [sessionId, tabId, log]);

  // Expose handlers for external use
  useEffect(() => {
    // Store handlers on window for external access if needed
    if (typeof window !== 'undefined') {
      (window as any).__sessionEventHandlers = {
        handleLogout,
        handleSessionRefresh,
        handleTabClose,
      };
    }
  }, [handleLogout, handleSessionRefresh, handleTabClose]);
}

export default useSessionEvents;
