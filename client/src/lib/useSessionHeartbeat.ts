/**
 * Session Heartbeat Hook
 * 
 * Implements a client-side heartbeat mechanism that:
 * - Periodically pings the backend to keep sessions alive
 * - Automatically refreshes session tokens before expiration
 * - Handles network failures gracefully
 * - Provides real-time session status monitoring
 * - Triggers warnings when session is about to expire
 * 
 * Usage:
 * ```tsx
 * const { isAlive, lastHeartbeat, sessionStatus } = useSessionHeartbeat();
 * ```
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { trpc } from "./trpc";
import { getSessionStorage } from "./sessionStorage";

export type SessionStatus = "active" | "expiring-soon" | "expired" | "error" | "offline";

export interface SessionHeartbeatState {
  isAlive: boolean;
  lastHeartbeat: Date | null;
  sessionStatus: SessionStatus;
  timeUntilExpiration: number;
  heartbeatCount: number;
  failureCount: number;
}

export interface UseSessionHeartbeatOptions {
  enabled?: boolean;
  interval?: number; // milliseconds between heartbeats
  expirationWarningThreshold?: number; // milliseconds before expiration to warn
  maxFailures?: number; // max failures before stopping heartbeat
  onStatusChange?: (status: SessionStatus) => void;
  onExpiringWarning?: () => void;
  debugMode?: boolean;
}

const DEFAULT_HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_EXPIRATION_WARNING = 5 * 60 * 1000; // 5 minutes before expiration
const DEFAULT_MAX_FAILURES = 3;

/**
 * Hook for managing session heartbeat and keeping sessions alive
 */
export function useSessionHeartbeat(
  options: UseSessionHeartbeatOptions = {}
): SessionHeartbeatState {
  const {
    enabled = true,
    interval = DEFAULT_HEARTBEAT_INTERVAL,
    expirationWarningThreshold = DEFAULT_EXPIRATION_WARNING,
    maxFailures = DEFAULT_MAX_FAILURES,
    onStatusChange,
    onExpiringWarning,
    debugMode = false,
  } = options;

  // State management
  const [state, setState] = useState<SessionHeartbeatState>({
    isAlive: true,
    lastHeartbeat: null,
    sessionStatus: "active",
    timeUntilExpiration: 0,
    heartbeatCount: 0,
    failureCount: 0,
  });

  // Refs for tracking
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<SessionStatus>("active");
  const sessionStorageRef = useRef(getSessionStorage({ debugMode }));
  const isComponentMountedRef = useRef(true);

  // tRPC utilities
  const utils = trpc.useUtils();

  /**
   * Log debug messages
   */
  const log = useCallback(
    (message: string, data?: any) => {
      if (debugMode) {
        console.log(`[SessionHeartbeat] ${message}`, data || "");
      }
    },
    [debugMode]
  );

  /**
   * Update session status and notify listeners
   */
  const updateSessionStatus = useCallback(
    (newStatus: SessionStatus) => {
      if (lastStatusRef.current !== newStatus) {
        log(`Session status changed: ${lastStatusRef.current} -> ${newStatus}`);
        lastStatusRef.current = newStatus;
        onStatusChange?.(newStatus);
      }
    },
    [log, onStatusChange]
  );

  /**
   * Perform heartbeat - ping server to keep session alive
   */
  const performHeartbeat = useCallback(async () => {
    if (!isComponentMountedRef.current) return;

    try {
      log("Performing heartbeat...");

      // Call keep-alive endpoint
      const response = await fetch("/api/keep-alive", {
        method: "POST",
        credentials: "include", // Include cookies
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.status}`);
      }

      const data = (await response.json()) as {
        success: boolean;
        expiresAt?: number;
      };

      if (!data.success) {
        throw new Error("Heartbeat returned success: false");
      }

      // Update session expiration if provided
      if (data.expiresAt) {
        sessionStorageRef.current.updateSessionExpiration(data.expiresAt);
      }

      // Update state
      if (isComponentMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isAlive: true,
          lastHeartbeat: new Date(),
          heartbeatCount: prev.heartbeatCount + 1,
          failureCount: 0,
          timeUntilExpiration: sessionStorageRef.current.getTimeUntilExpiration(),
        }));

        updateSessionStatus("active");
      }

      log("Heartbeat successful", {
        expiresAt: data.expiresAt,
        nextHeartbeat: new Date(Date.now() + interval),
      });
    } catch (error) {
      log("Heartbeat failed", error);

      if (isComponentMountedRef.current) {
        setState((prev) => {
          const newFailureCount = prev.failureCount + 1;
          const isOffline =
            error instanceof TypeError && error.message.includes("fetch");

          return {
            ...prev,
            isAlive: false,
            failureCount: newFailureCount,
            sessionStatus: isOffline ? "offline" : "error",
          };
        });

        const newStatus = error instanceof TypeError ? "offline" : "error";
        updateSessionStatus(newStatus);
      }
    }
  }, [log, interval, updateSessionStatus]);

  /**
   * Check if session is expiring soon and warn
   */
  const checkExpirationWarning = useCallback(() => {
    const isExpiringSoon = sessionStorageRef.current.isSessionExpiringSoon(
      expirationWarningThreshold
    );

    if (isExpiringSoon) {
      log("Session expiring soon warning triggered");
      updateSessionStatus("expiring-soon");
      onExpiringWarning?.();
    }
  }, [expirationWarningThreshold, log, updateSessionStatus, onExpiringWarning]);

  /**
   * Initialize and manage heartbeat timer
   */
  useEffect(() => {
    if (!enabled) {
      log("Heartbeat disabled");
      return;
    }

    log(`Starting heartbeat with interval: ${interval}ms`);

    // Perform initial heartbeat immediately
    performHeartbeat();
    checkExpirationWarning();

    // Set up recurring heartbeat
    heartbeatTimerRef.current = setInterval(() => {
      if (isComponentMountedRef.current) {
        performHeartbeat();
        checkExpirationWarning();
      }
    }, interval);

    // Cleanup on unmount
    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [enabled, interval, performHeartbeat, checkExpirationWarning, log]);

  /**
   * Handle page visibility changes
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        log("Page hidden");
        return;
      }

      log("Page visible, performing immediate heartbeat");
      performHeartbeat();
      checkExpirationWarning();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [performHeartbeat, checkExpirationWarning, log]);

  /**
   * Handle online/offline events
   */
  useEffect(() => {
    const handleOnline = () => {
      log("Network online, performing heartbeat");
      performHeartbeat();
    };

    const handleOffline = () => {
      log("Network offline");
      updateSessionStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [performHeartbeat, updateSessionStatus, log]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, []);

  return state;
}

export default useSessionHeartbeat;
