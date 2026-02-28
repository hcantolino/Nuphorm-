# Session Timeout Indicator System - Complete Guide

## Overview

The session timeout indicator system provides enterprise-grade session management with visual warnings, activity-based reset, and graceful error handling to prevent surprise logouts in Nuphorm.

**Key Features:**
- Visual warning modal 5 minutes before session expiration
- Activity-based timeout reset (mouse, keyboard, touch)
- Configurable timeout durations and warning thresholds
- Comprehensive event logging and analytics
- Graceful error handling with user-friendly messages
- Cross-browser compatibility
- Full accessibility support (WCAG 2.1 AA)

---

## Architecture

### Components

#### 1. **Activity Tracker Service** (`client/src/lib/activityTracker.ts`)
Monitors user interactions and tracks activity for session timeout management.

**Tracks:**
- Mouse movements and clicks
- Keyboard input
- Touch events
- Focus changes
- Scroll events

**Features:**
- Debounced event recording (1 second by default)
- Idle time calculation
- Activity event listeners
- Debug mode for troubleshooting

**Usage:**
```typescript
import { getActivityTracker } from '@/lib/activityTracker';

const tracker = getActivityTracker({ debugMode: true });
tracker.start();

// Listen for activity
const unsubscribe = tracker.onActivity((event) => {
  console.log('Activity detected:', event.type);
});

// Check idle time
const idleTime = tracker.getIdleTime();
const isIdle = tracker.isIdle(300000); // 5 minutes

// Cleanup
unsubscribe();
tracker.stop();
```

#### 2. **Session Timeout Indicator Component** (`client/src/components/SessionTimeoutIndicator.tsx`)
Displays warning modal with countdown timer and action buttons.

**Features:**
- Animated modal with countdown timer
- MM:SS time format
- Color-coded timer (yellow → orange → red)
- "Extend Session" button
- "Logout Now" button
- Accessibility labels and keyboard navigation
- Auto-hide on action

**Props:**
```typescript
interface SessionTimeoutIndicatorProps {
  timeUntilExpiration: number; // milliseconds
  warningThreshold?: number; // default 5 minutes
  onExtendSession?: () => Promise<void>;
  onLogout?: () => Promise<void>;
  debugMode?: boolean;
}
```

**Usage:**
```typescript
import SessionTimeoutIndicator from '@/components/SessionTimeoutIndicator';

<SessionTimeoutIndicator
  timeUntilExpiration={sessionTimeoutState.timeUntilExpiration}
  warningThreshold={5 * 60 * 1000}
  onExtendSession={async () => {
    await refreshSession();
  }}
  onLogout={async () => {
    await logout();
  }}
/>
```

#### 3. **Timeout Logger Service** (`client/src/lib/timeoutLogger.ts`)
Logs and analyzes session timeout events for debugging and analytics.

**Tracks:**
- Session timeout warnings
- Session extensions
- Actual timeouts/logouts
- Activity patterns
- Idle time statistics

**Features:**
- Event filtering by type and time range
- Statistical analysis
- Pattern recognition
- JSON export
- Event listeners

**Usage:**
```typescript
import { getTimeoutLogger } from '@/lib/timeoutLogger';

const logger = getTimeoutLogger(true); // debug mode

// Log events
logger.logWarning(timeRemaining, idleTime);
logger.logExtension(previousTime, newTime);
logger.logTimeout('inactivity');

// Get statistics
const stats = logger.getStats();
console.log(`Total warnings: ${stats.totalWarnings}`);
console.log(`Extension rate: ${stats.extensionRate}%`);

// Analyze patterns
const pattern = logger.analyzePattern();
console.log(`Warnings per hour: ${pattern.warningsPerHour}`);

// Export for analysis
const json = logger.exportAsJSON();
```

#### 4. **useSessionTimeout Hook** (`client/src/lib/useSessionTimeout.ts`)
React hook managing session timeout with activity tracking.

**Features:**
- Activity-based reset
- Configurable timeouts
- Warning and timeout callbacks
- Idle time tracking
- Debug mode

**Props:**
```typescript
interface UseSessionTimeoutOptions {
  enabled?: boolean;
  timeoutDurationMs?: number; // default 1 hour
  warningThresholdMs?: number; // default 5 minutes
  resetOnActivity?: boolean; // default true
  onWarning?: () => void;
  onTimeout?: () => void;
  onActivityDetected?: () => void;
  debugMode?: boolean;
}
```

**Return Value:**
```typescript
interface SessionTimeoutState {
  timeUntilExpiration: number;
  isWarning: boolean;
  isExpired: boolean;
  idleTime: number;
  lastActivityTime: number;
}
```

**Usage:**
```typescript
import useSessionTimeout from '@/lib/useSessionTimeout';

const sessionState = useSessionTimeout({
  enabled: isAuthenticated,
  timeoutDurationMs: 60 * 60 * 1000, // 1 hour
  warningThresholdMs: 5 * 60 * 1000, // 5 minutes
  resetOnActivity: true,
  onWarning: () => console.log('Warning!'),
  onTimeout: () => logout(),
  debugMode: false,
});

console.log(`Time remaining: ${sessionState.timeUntilExpiration}ms`);
console.log(`Is warning: ${sessionState.isWarning}`);
console.log(`Idle time: ${sessionState.idleTime}ms`);
```

#### 5. **Session Error Handler Component** (`client/src/components/SessionErrorHandler.tsx`)
Displays user-friendly error messages and recovery options.

**Error Types:**
- `session-expired` - Session has expired
- `session-expiring-soon` - Session expiring soon
- `network-error` - Network connectivity issue
- `refresh-failed` - Session refresh failed
- `offline` - User is offline

**Usage:**
```typescript
import SessionErrorHandler from '@/components/SessionErrorHandler';

<SessionErrorHandler
  errorType={sessionError}
  onRetry={refreshSession}
  onLogout={logout}
  autoHideDuration={5000}
/>
```

---

## Integration Guide

### Step 1: Update App.tsx

```typescript
import SessionTimeoutIndicator from '@/components/SessionTimeoutIndicator';
import SessionErrorHandler from '@/components/SessionErrorHandler';
import useSessionTimeout from '@/lib/useSessionTimeout';

function App() {
  const { isAuthenticated, logout, refreshSession, sessionError } = useAuth();

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          <SidebarProvider>
            <Toaster />
            
            {/* Session Error Handler */}
            <SessionErrorHandler
              errorType={sessionError === 'active' ? null : sessionError}
              onRetry={refreshSession}
              onLogout={logout}
            />
            
            <Router />
          </SidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
```

### Step 2: Add Session Timeout to Router

```typescript
function Router() {
  const { isAuthenticated, logout, refreshSession } = useAuth();

  // Session timeout tracking
  const sessionTimeoutState = useSessionTimeout({
    enabled: isAuthenticated,
    timeoutDurationMs: 60 * 60 * 1000, // 1 hour
    warningThresholdMs: 5 * 60 * 1000, // 5 minutes
    resetOnActivity: true,
    onWarning: () => console.log('Session warning'),
    onTimeout: async () => {
      await logout();
    },
    debugMode: false,
  });

  return (
    <Switch>
      {/* ... routes ... */}
      {isAuthenticated && (
        <SessionTimeoutIndicator
          timeUntilExpiration={sessionTimeoutState.timeUntilExpiration}
          warningThreshold={5 * 60 * 1000}
          onExtendSession={refreshSession}
          onLogout={logout}
        />
      )}
    </Switch>
  );
}
```

---

## Configuration

### Timeout Duration
Default: 1 hour (3,600,000 ms)

```typescript
const sessionState = useSessionTimeout({
  timeoutDurationMs: 30 * 60 * 1000, // 30 minutes
});
```

### Warning Threshold
Default: 5 minutes (300,000 ms) before expiration

```typescript
const sessionState = useSessionTimeout({
  warningThresholdMs: 10 * 60 * 1000, // 10 minutes
});
```

### Activity-Based Reset
Default: Enabled

```typescript
const sessionState = useSessionTimeout({
  resetOnActivity: true, // Reset on any user activity
});
```

### Debug Mode
Enable console logging for troubleshooting:

```typescript
const tracker = getActivityTracker({ debugMode: true });
const logger = getTimeoutLogger(true);
const sessionState = useSessionTimeout({ debugMode: true });
```

---

## Testing

### Run Tests
```bash
pnpm test sessionTimeout
```

### Test Coverage
- ✅ 65 comprehensive tests
- ✅ Activity tracking tests
- ✅ Timeout indicator tests
- ✅ Logger tests
- ✅ Hook tests
- ✅ Integration tests
- ✅ Edge case tests

### Test Results
```
✓ server/sessionTimeout.test.ts (65 tests) 22ms
Test Files  1 passed (1)
     Tests  65 passed (65)
```

---

## Troubleshooting

### Session Timeout Not Triggering

**Check:**
1. Verify `enabled: true` in useSessionTimeout options
2. Confirm `isAuthenticated` is true
3. Check browser console for errors
4. Enable debug mode: `debugMode: true`

**Debug:**
```typescript
const sessionState = useSessionTimeout({
  enabled: true,
  debugMode: true, // Enable console logging
});

// Check state
console.log('Session state:', sessionState);
```

### Activity Not Being Detected

**Check:**
1. Verify activity tracker is started: `tracker.start()`
2. Check if events are being debounced (1 second default)
3. Verify event listeners are registered

**Debug:**
```typescript
const tracker = getActivityTracker({ debugMode: true });
tracker.start();

// Monitor activity
const unsubscribe = tracker.onActivity((event) => {
  console.log('Activity:', event);
});
```

### Warning Not Displaying

**Check:**
1. Verify `timeUntilExpiration < warningThreshold`
2. Check component is mounted and visible
3. Verify modal CSS is not hidden

**Debug:**
```typescript
console.log('Time until expiration:', sessionTimeoutState.timeUntilExpiration);
console.log('Is warning:', sessionTimeoutState.isWarning);
console.log('Warning threshold:', 5 * 60 * 1000);
```

### Session Not Extending

**Check:**
1. Verify `onExtendSession` callback is provided
2. Confirm `refreshSession` is working
3. Check network requests in DevTools

**Debug:**
```typescript
const handleExtend = async () => {
  try {
    await refreshSession();
    console.log('Session extended');
  } catch (error) {
    console.error('Extension failed:', error);
  }
};
```

---

## Analytics & Monitoring

### Track Session Events

```typescript
const logger = getTimeoutLogger();

// Get statistics
const stats = logger.getStats();
console.log('Session Statistics:', {
  warnings: stats.totalWarnings,
  extensions: stats.totalExtensions,
  timeouts: stats.totalTimeouts,
  extensionRate: stats.extensionRate,
});

// Analyze patterns
const pattern = logger.analyzePattern();
console.log('Session Patterns:', {
  warningsPerHour: pattern.warningsPerHour,
  extensionRate: pattern.extensionRate,
  timeoutRate: pattern.timeoutRate,
});

// Export for analysis
const json = logger.exportAsJSON();
console.log('Full data:', json);
```

### Send to Analytics Service

```typescript
// In timeoutLogger.ts sendToAnalytics method
if (typeof window !== 'undefined' && (window as any).gtag) {
  (window as any).gtag('event', `session_${event.type}`, {
    timestamp: event.timestamp,
    timeUntilExpiration: event.timeUntilExpiration,
    idleTime: event.idleTime,
  });
}
```

---

## Security Considerations

1. **HttpOnly Cookies:** Session ID stored in HttpOnly cookies (cannot be accessed via JavaScript)
2. **Secure Flag:** Cookies only transmitted over HTTPS
3. **SameSite=None:** Allows cross-domain requests with credentials
4. **Activity Tracking:** Client-side only, no sensitive data logged
5. **Timeout Enforcement:** Server-side validation of session expiration

---

## Performance Optimization

### Activity Debouncing
Default: 1 second debounce to prevent excessive event processing

```typescript
const tracker = getActivityTracker({
  debounceMs: 1000, // Adjust as needed
});
```

### Update Interval
Session timeout state updates every 1 second (configurable via hook)

### Memory Management
- Activity tracker cleans up listeners on stop
- Timeout logger keeps last 1000 events
- Components cleanup on unmount

---

## Browser Compatibility

- ✅ Chrome/Chromium (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

## Next Steps

1. **Monitor Session Events:** Track extension rates and timeout patterns
2. **Adjust Timeouts:** Based on user behavior, adjust timeout duration
3. **Customize Messages:** Tailor error messages for your user base
4. **Add Analytics:** Integrate with your analytics platform
5. **User Education:** Inform users about session timeout feature

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Enable debug mode for detailed logging
3. Review test cases for usage examples
4. Check browser console for error messages

---

## Version History

- **v1.0.0** - Initial release with activity tracking, timeout indicator, logging, and error handling
