import { useEffect, useState, useCallback, useMemo } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

/**
 * Simple session warning banner - shows when session is within 5 minutes of expiration
 * No circular dependencies, no infinite loops
 */
export default function SessionWarningBanner() {
  const { user } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isExtending, setIsExtending] = useState(false);

  // Session config - 1 hour total, warn at 5 minutes remaining
  const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour
  const WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  const sessionStartTime = useMemo(() => {
    const stored = localStorage.getItem('manus-session-start');
    return stored ? parseInt(stored, 10) : Date.now();
  }, [user?.id]); // Reset when user changes

  // Store session start time when user logs in
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem('manus-session-start', Date.now().toString());
    }
  }, [user?.id]);

  // Calculate time remaining - only runs every second
  useEffect(() => {
    if (!user?.id || dismissed) {
      setShowWarning(false);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - sessionStartTime;
      const remaining = Math.max(0, SESSION_DURATION_MS - elapsed);
      setTimeRemaining(remaining);

      // Show warning only if within threshold and not dismissed
      setShowWarning(remaining > 0 && remaining < WARNING_THRESHOLD_MS && !dismissed);
    }, 1000);

    return () => clearInterval(interval);
  }, [user?.id, sessionStartTime, dismissed]);

  // Format time display
  const formattedTime = useMemo(() => {
    if (!timeRemaining) return '0:00';
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timeRemaining]);

  // Extend session handler
  const handleExtendSession = useCallback(async () => {
    try {
      setIsExtending(true);
      // Reset session start time
      localStorage.setItem('manus-session-start', Date.now().toString());
      setShowWarning(false);
      setDismissed(false);
    } catch (error) {
      console.error('Failed to extend session:', error);
    } finally {
      setIsExtending(false);
    }
  }, []);

  // Dismiss handler
  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setShowWarning(false);
  }, []);

  if (!showWarning || !user?.id) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 w-full">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              Session expiring soon
            </p>
            <p className="text-xs text-amber-700">
              Your session will expire in {formattedTime}. Click extend to continue working.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={handleExtendSession}
            disabled={isExtending}
            className="bg-amber-600 text-white hover:bg-amber-700 px-4 py-1.5 rounded text-sm font-medium"
            size="sm"
          >
            {isExtending ? 'Extending...' : 'Extend Session'}
          </Button>
          <button
            onClick={handleDismiss}
            className="text-amber-600 hover:text-amber-800 transition p-1 hover:bg-amber-100 rounded"
            aria-label="Dismiss session warning"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
