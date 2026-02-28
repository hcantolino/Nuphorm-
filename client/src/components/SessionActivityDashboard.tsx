import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Clock, Activity } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';

/**
 * Lightweight session activity dashboard for header
 * Shows: remaining time, last activity, active status
 * Updates only on user interaction or 1-second interval
 * Zero circular dependencies, zero infinite loops
 */
export default function SessionActivityDashboard() {
  const { user } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [lastActivityTime, setLastActivityTime] = useState<Date | null>(null);
  const [isActive, setIsActive] = useState(true);
  
  // Constants
  const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour
  const ACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes idle = inactive
  
  // Refs for tracking (don't cause re-renders)
  const sessionStartRef = useRef<number>(Date.now());
  const lastActivityRef = useRef<number>(Date.now());
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize session start time on user login
  useEffect(() => {
    if (user?.id) {
      sessionStartRef.current = Date.now();
      lastActivityRef.current = Date.now();
      setLastActivityTime(new Date());
      setIsActive(true);
    }
  }, [user?.id]);

  // Handle user activity (mouse/keyboard)
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setLastActivityTime(new Date());
    setIsActive(true);

    // Clear existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    // Set new timeout for inactive state
    activityTimeoutRef.current = setTimeout(() => {
      setIsActive(false);
    }, ACTIVITY_TIMEOUT_MS);
  }, [ACTIVITY_TIMEOUT_MS]);

  // Attach activity listeners
  useEffect(() => {
    if (!user?.id) return;

    const events = ['mousedown', 'keydown', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial activity
    handleActivity();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [user?.id, handleActivity]);

  // Update time remaining every second
  useEffect(() => {
    if (!user?.id) {
      setTimeRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - sessionStartRef.current;
      const remaining = Math.max(0, SESSION_DURATION_MS - elapsed);
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [user?.id, SESSION_DURATION_MS]);

  // Format time display
  const formattedTime = useMemo(() => {
    if (timeRemaining === null) return '--:--';
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timeRemaining]);

  // Format last activity time
  const formattedLastActivity = useMemo(() => {
    if (!lastActivityTime) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - lastActivityTime.getTime();
    
    if (diffMs < 60000) return 'Just now';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  }, [lastActivityTime]);

  // Determine status color
  const statusColor = useMemo(() => {
    if (!user?.id) return 'text-gray-400';
    if (!isActive) return 'text-yellow-600';
    if (timeRemaining && timeRemaining < 5 * 60 * 1000) return 'text-red-600';
    return 'text-green-600';
  }, [user?.id, isActive, timeRemaining]);

  const statusText = useMemo(() => {
    if (!user?.id) return 'Offline';
    if (!isActive) return 'Idle';
    if (timeRemaining && timeRemaining < 5 * 60 * 1000) return 'Expiring';
    return 'Active';
  }, [user?.id, isActive, timeRemaining]);

  if (!user?.id) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusColor.replace('text-', 'bg-')}`} />
        <span className={`font-medium ${statusColor}`}>{statusText}</span>
      </div>

      {/* Time remaining */}
      <div className="flex items-center gap-1.5 text-gray-700">
        <Clock className="w-3.5 h-3.5" />
        <span className="font-mono">{formattedTime}</span>
      </div>

      {/* Last activity */}
      <div className="flex items-center gap-1.5 text-gray-600">
        <Activity className="w-3.5 h-3.5" />
        <span>{formattedLastActivity}</span>
      </div>

      {/* User info */}
      <div className="ml-auto text-gray-600">
        <span className="text-xs">{user.email || user.name || 'User'}</span>
      </div>
    </div>
  );
}
