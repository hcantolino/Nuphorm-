/**
 * Session Error Handler Component
 * 
 * Displays user-friendly error messages and recovery options when session issues occur.
 * Handles:
 * - Session expiration
 * - Network errors
 * - Session refresh failures
 * - Graceful logout and re-login flow
 */

import React, { useEffect, useState } from "react";
import { AlertCircle, Loader2, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

export type SessionErrorType =
  | "session-expired"
  | "session-expiring-soon"
  | "network-error"
  | "refresh-failed"
  | "offline";

export interface SessionErrorHandlerProps {
  errorType: SessionErrorType | null;
  isRecovering?: boolean;
  onRetry?: () => Promise<void>;
  onLogout?: () => Promise<void>;
  onDismiss?: () => void;
  autoHideDuration?: number; // milliseconds, 0 = never auto-hide
}

interface ErrorConfig {
  title: string;
  message: string;
  icon: React.ReactNode;
  severity: "warning" | "error" | "info";
  showRetry: boolean;
  showLogout: boolean;
  autoHide: boolean;
}

const ERROR_CONFIGS: Record<SessionErrorType, ErrorConfig> = {
  "session-expired": {
    title: "Session Expired",
    message:
      "Your session has expired. Please log in again to continue. Your work will be preserved.",
    icon: <AlertCircle className="w-5 h-5" />,
    severity: "error",
    showRetry: false,
    showLogout: true,
    autoHide: false,
  },
  "session-expiring-soon": {
    title: "Session Expiring Soon",
    message:
      "Your session will expire in a few minutes. Click refresh to extend your session.",
    icon: <AlertCircle className="w-5 h-5" />,
    severity: "warning",
    showRetry: true,
    showLogout: false,
    autoHide: true,
  },
  "network-error": {
    title: "Network Error",
    message:
      "Unable to connect to the server. Please check your internet connection and try again.",
    icon: <AlertCircle className="w-5 h-5" />,
    severity: "error",
    showRetry: true,
    showLogout: false,
    autoHide: false,
  },
  "refresh-failed": {
    title: "Session Refresh Failed",
    message:
      "Failed to refresh your session. Please try again or log in again.",
    icon: <AlertCircle className="w-5 h-5" />,
    severity: "error",
    showRetry: true,
    showLogout: true,
    autoHide: false,
  },
  offline: {
    title: "You are Offline",
    message:
      "You have lost your internet connection. Your session will be restored when you reconnect.",
    icon: <AlertCircle className="w-5 h-5" />,
    severity: "warning",
    showRetry: false,
    showLogout: false,
    autoHide: true,
  },
};

/**
 * Session Error Handler Component
 */
export const SessionErrorHandler: React.FC<SessionErrorHandlerProps> = ({
  errorType,
  isRecovering = false,
  onRetry,
  onLogout,
  onDismiss,
  autoHideDuration = 10000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Show/hide based on errorType
  useEffect(() => {
    if (errorType) {
      setIsVisible(true);
    }
  }, [errorType]);

  // Auto-hide if configured
  useEffect(() => {
    if (!isVisible || !errorType || autoHideDuration === 0) return;

    const config = ERROR_CONFIGS[errorType];
    if (!config || !config.autoHide) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, autoHideDuration);

    return () => clearTimeout(timer);
  }, [isVisible, errorType, autoHideDuration, onDismiss]);

  if (!isVisible || !errorType) return null;

  const config = ERROR_CONFIGS[errorType];
  if (!config) return null;

  /**
   * Handle retry button click
   */
  const handleRetry = async () => {
    if (!onRetry) return;

    setIsRetrying(true);
    try {
      await onRetry();
      setIsVisible(false);
      onDismiss?.();
      toast.success("Session refreshed successfully");
    } catch (error) {
      console.error("Retry failed:", error);
      toast.error("Failed to refresh session. Please try again.");
    } finally {
      setIsRetrying(false);
    }
  };

  /**
   * Handle logout button click
   */
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (onLogout) {
        await onLogout();
      }
      // Redirect to login
      window.location.href = getLoginUrl();
    } catch (error) {
      console.error("Logout failed:", error);
      // Force redirect to login anyway
      window.location.href = getLoginUrl();
    } finally {
      setIsLoggingOut(false);
    }
  };

  /**
   * Determine background color based on severity
   */
  const getBgColor = () => {
    if (!config?.severity) return 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800';
    switch (config.severity) {
      case "error":
        return "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800";
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800";
      case "info":
        return "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800";
      default:
        return "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800";
    }
  };

  /**
   * Determine icon color based on severity
   */
  const getIconColor = () => {
    if (!config?.severity) return 'text-gray-600 dark:text-gray-400';
    switch (config.severity) {
      case "error":
        return "text-red-600 dark:text-red-400";
      case "warning":
        return "text-yellow-600 dark:text-yellow-400";
      case "info":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  /**
   * Determine title color based on severity
   */
  const getTitleColor = () => {
    if (!config?.severity) return 'text-gray-900 dark:text-gray-100';
    switch (config.severity) {
      case "error":
        return "text-red-900 dark:text-red-100";
      case "warning":
        return "text-yellow-900 dark:text-yellow-100";
      case "info":
        return "text-blue-900 dark:text-blue-100";
      default:
        return "text-gray-900 dark:text-gray-100";
    }
  };

  /**
   * Determine message color based on severity
   */
  const getMessageColor = () => {
    if (!config?.severity) return 'text-gray-800 dark:text-gray-200';
    switch (config.severity) {
      case "error":
        return "text-red-800 dark:text-red-200";
      case "warning":
        return "text-yellow-800 dark:text-yellow-200";
      case "info":
        return "text-blue-800 dark:text-blue-200";
      default:
        return "text-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 max-w-md border rounded-lg shadow-lg p-4 z-50 ${getBgColor()} animate-in fade-in slide-in-from-top-2 duration-300`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 mt-0.5 ${getIconColor()}`}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className={`font-semibold text-sm ${getTitleColor()}`}>
            {config.title}
          </h3>
          <p className={`text-sm mt-1 ${getMessageColor()}`}>
            {config.message}
          </p>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            {config.showRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                disabled={isRetrying || isLoggingOut || isRecovering}
                className="gap-2"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Refresh Session
                  </>
                )}
              </Button>
            )}

            {config.showLogout && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleLogout}
                disabled={isLoggingOut || isRetrying || isRecovering}
                className="gap-2"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Logging out...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    Log In Again
                  </>
                )}
              </Button>
            )}

            {/* Dismiss button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsVisible(false);
                onDismiss?.();
              }}
              disabled={isRetrying || isLoggingOut || isRecovering}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionErrorHandler;
