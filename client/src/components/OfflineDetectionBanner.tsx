import { useEffect, useState, useCallback, useRef } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * Non-intrusive offline detection banner
 * Detects offline via navigator.onLine + periodic ping to /api/health
 * Shows countdown + "Reconnecting..." message
 * Uses useEffect with proper cleanup, no circular state updates
 */
export default function OfflineDetectionBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [reconnectCountdown, setReconnectCountdown] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Refs for tracking (don't cause re-renders)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPingRef = useRef<number>(Date.now());

  // Ping endpoint to check connectivity
  const checkConnectivity = useCallback(async () => {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }, []);

  // Handle online event
  const handleOnline = useCallback(async () => {
    setIsReconnecting(true);
    setReconnectCountdown(3);
    
    // Verify with ping
    const isConnected = await checkConnectivity();
    if (isConnected) {
      setIsOffline(false);
      setIsReconnecting(false);
      setReconnectCountdown(0);
    } else {
      // Still offline, will retry on next interval
      setIsReconnecting(false);
    }
  }, [checkConnectivity]);

  // Handle offline event
  const handleOffline = useCallback(() => {
    setIsOffline(true);
    setIsReconnecting(false);
  }, []);

  // Setup online/offline listeners
  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Periodic connectivity check
  useEffect(() => {
    if (!isOffline) {
      // Clear ping interval if online
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      return;
    }

    // Check connectivity every 5 seconds when offline
    const checkAndUpdate = async () => {
      lastPingRef.current = Date.now();
      const isConnected = await checkConnectivity();
      
      if (isConnected) {
        setIsOffline(false);
        setIsReconnecting(false);
        setReconnectCountdown(0);
      }
    };

    // Initial check
    checkAndUpdate();

    // Setup interval
    pingIntervalRef.current = setInterval(checkAndUpdate, 5000);

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [isOffline, checkConnectivity]);

  // Countdown timer when reconnecting
  useEffect(() => {
    if (!isReconnecting || reconnectCountdown <= 0) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      setReconnectCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [isReconnecting, reconnectCountdown]);

  if (!isOffline) return null;

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-3 w-full">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <WifiOff className="w-5 h-5 text-red-600 flex-shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900">
              {isReconnecting ? 'Reconnecting...' : 'No internet connection'}
            </p>
            <p className="text-xs text-red-700">
              {isReconnecting 
                ? `Attempting to reconnect in ${reconnectCountdown}s...`
                : 'Your connection has been lost. Attempting to reconnect automatically.'}
            </p>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 rounded-full">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span className="text-xs font-medium text-red-700">Offline</span>
          </div>
        </div>
      </div>
    </div>
  );
}
