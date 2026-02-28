# Session Persistence Solution - Complete Guide

## Overview

This document describes the upgraded session persistence solution for Nuphorm that prevents frequent logouts through multiple redundant mechanisms:

1. **HttpOnly Cookies** - Secure server-side session storage
2. **localStorage Fallback** - Client-side session backup when cookies fail
3. **Client-Side Heartbeat** - Periodic session refresh (every 5 minutes)
4. **Graceful Error Handling** - User-friendly error messages and recovery
5. **Cross-Subdomain Support** - Session sharing across .us2.manus.computer subdomains

## Architecture

### Backend Components

#### 1. Enhanced Cookie Configuration (`server/_core/cookies.ts`)

**Key Features:**
- HttpOnly flag prevents JavaScript access (XSS protection)
- Secure flag enforces HTTPS transmission
- SameSite=none allows cross-domain cookies
- Automatic parent domain extraction for Manus proxy domains
- Localhost development support (non-secure cookies)

**Usage:**
```typescript
import { getEnhancedSessionCookieOptions } from "./server/_core/cookies";

const cookieOptions = getEnhancedSessionCookieOptions(req);
res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
```

**Cookie Configuration:**
```
Domain: .us2.manus.computer (shared across all subdomains)
Path: /
HttpOnly: true (prevents JavaScript access)
Secure: true (HTTPS only)
SameSite: none (cross-domain requests)
MaxAge: 1 year
```

#### 2. Session Middleware (`server/_core/sessionMiddleware.ts`)

**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/keep-alive` | POST | Refresh session without full authentication |
| `/api/logout` | POST | Securely clear session cookie |
| `/api/session/status` | GET | Get current session status and expiration |
| `/api/health` | GET | Health check (no auth required) |

**Keep-Alive Endpoint Response:**
```json
{
  "success": true,
  "expiresAt": 1707216000000,
  "message": "Session refreshed successfully"
}
```

**Session Status Response:**
```json
{
  "authenticated": true,
  "userId": "user-123",
  "userName": "John Doe",
  "userEmail": "john@example.com",
  "expiresAt": 1707216000000,
  "timeUntilExpiration": 31536000000,
  "isExpiringSoon": false
}
```

### Frontend Components

#### 1. Session Storage Service (`client/src/lib/sessionStorage.ts`)

**Features:**
- localStorage-based session backup
- Cross-tab synchronization via storage events
- Automatic session validation
- Expiration tracking
- Debug mode for troubleshooting

**Usage:**
```typescript
import { getSessionStorage } from "@/lib/sessionStorage";

const sessionStorage = getSessionStorage({ debugMode: false });

// Save session
sessionStorage.saveSession({
  userId: "user-123",
  lastRefresh: Date.now(),
  expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365,
  metadata: { name: "John Doe" }
});

// Check if session is valid
const isValid = sessionStorage.isSessionValid();

// Get time until expiration
const timeRemaining = sessionStorage.getTimeUntilExpiration();

// Listen for session changes
const unsubscribe = sessionStorage.onSessionChange((data) => {
  console.log("Session changed:", data);
});
```

#### 2. Session Heartbeat Hook (`client/src/lib/useSessionHeartbeat.ts`)

**Features:**
- Periodic heartbeat every 5 minutes
- Automatic refresh on page visibility change
- Network status detection
- Session expiration warnings
- Failure tracking and recovery

**Usage:**
```typescript
import { useSessionHeartbeat } from "@/lib/useSessionHeartbeat";

const { isAlive, lastHeartbeat, sessionStatus, timeUntilExpiration } = 
  useSessionHeartbeat({
    enabled: true,
    interval: 5 * 60 * 1000, // 5 minutes
    expirationWarningThreshold: 5 * 60 * 1000, // Warn 5 minutes before expiration
    onStatusChange: (status) => {
      console.log("Session status:", status);
    },
    onExpiringWarning: () => {
      console.log("Session expiring soon!");
    },
    debugMode: false,
  });
```

**Session Status Values:**
- `active` - Session is healthy
- `expiring-soon` - Session will expire within threshold
- `expired` - Session has expired
- `error` - Keep-alive request failed
- `offline` - Network is offline

#### 3. Enhanced useAuth Hook (`client/src/_core/hooks/useAuth.ts`)

**New Features:**
- Integrated session heartbeat
- localStorage fallback support
- Session error tracking
- Graceful recovery mechanisms
- Session refresh and recovery methods

**Usage:**
```typescript
import { useAuth } from "@/_core/hooks/useAuth";

const {
  user,
  isAuthenticated,
  loading,
  error,
  logout,
  refreshSession,
  recoverFromError,
  sessionError,
  isRecovering,
  heartbeatState,
} = useAuth({
  redirectOnUnauthenticated: true,
  enableHeartbeat: true,
  heartbeatInterval: 5 * 60 * 1000,
});

// Refresh session manually
await refreshSession();

// Recover from session error
await recoverFromError();
```

#### 4. Session Error Handler Component (`client/src/components/SessionErrorHandler.tsx`)

**Features:**
- User-friendly error messages
- Automatic error type detection
- Recovery action buttons (Retry, Log In Again)
- Auto-hide for non-critical errors
- Accessibility support

**Usage:**
```typescript
import { SessionErrorHandler } from "@/components/SessionErrorHandler";

<SessionErrorHandler
  errorType={sessionError}
  isRecovering={isRecovering}
  onRetry={refreshSession}
  onLogout={logout}
  onDismiss={() => setSessionError(null)}
  autoHideDuration={10000}
/>
```

**Error Types:**
- `session-expired` - Session has expired
- `session-expiring-soon` - Session expiring soon
- `network-error` - Network connection failed
- `refresh-failed` - Session refresh failed
- `offline` - Device is offline

## Implementation Guide

### Step 1: Backend Setup

1. **Update OAuth callback** to use enhanced cookie options:
```typescript
import { getEnhancedSessionCookieOptions } from "./cookies";

app.get("/api/oauth/callback", async (req, res) => {
  // ... OAuth logic ...
  const cookieOptions = getEnhancedSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
  res.redirect(302, "/");
});
```

2. **Register session routes** in your Express app:
```typescript
import { registerSessionRoutes } from "./sessionMiddleware";

registerSessionRoutes(app);
```

3. **Add middleware** for security and session validation:
```typescript
import {
  httpsEnforcementMiddleware,
  securityHeadersMiddleware,
  sessionValidationMiddleware,
} from "./sessionMiddleware";

app.use(httpsEnforcementMiddleware);
app.use(securityHeadersMiddleware);
app.use(sessionValidationMiddleware);
```

### Step 2: Frontend Setup

1. **Wrap app with Session Error Handler**:
```typescript
import { SessionErrorHandler } from "@/components/SessionErrorHandler";
import { useAuth } from "@/_core/hooks/useAuth";

function App() {
  const { sessionError, isRecovering, refreshSession, logout } = useAuth({
    enableHeartbeat: true,
  });

  return (
    <>
      <SessionErrorHandler
        errorType={sessionError}
        isRecovering={isRecovering}
        onRetry={refreshSession}
        onLogout={logout}
      />
      {/* Your app content */}
    </>
  );
}
```

2. **Use enhanced useAuth hook** in authenticated pages:
```typescript
import { useAuth } from "@/_core/hooks/useAuth";

function Dashboard() {
  const { user, isAuthenticated, sessionError } = useAuth({
    redirectOnUnauthenticated: true,
    enableHeartbeat: true,
  });

  if (!isAuthenticated) return <div>Loading...</div>;

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      {sessionError && <p>Session issue: {sessionError}</p>}
    </div>
  );
}
```

## Testing

### Unit Tests

Run the comprehensive test suite:
```bash
pnpm test sessionPersistence.test.ts
```

**Test Coverage:**
- HttpOnly cookie configuration
- localStorage fallback system
- Session heartbeat mechanism
- Keep-alive endpoint
- Error handling and recovery
- Cross-subdomain persistence
- Security features
- Performance metrics
- Integration scenarios

### Manual Testing Checklist

#### Session Persistence
- [ ] Log in and verify session cookie is set
- [ ] Navigate to different pages and verify session persists
- [ ] Refresh page and verify session is maintained
- [ ] Close and reopen browser tab and verify session is restored

#### Heartbeat Mechanism
- [ ] Monitor Network tab in DevTools
- [ ] Verify `/api/keep-alive` requests every 5 minutes
- [ ] Verify heartbeat continues when tab is in background
- [ ] Verify heartbeat triggers immediately when tab becomes visible

#### Error Handling
- [ ] Simulate network error and verify error message appears
- [ ] Verify "Retry" button attempts to refresh session
- [ ] Verify "Log In Again" button redirects to login
- [ ] Verify error auto-hides after 10 seconds (for non-critical errors)

#### Cross-Subdomain Persistence
- [ ] Log in on `app.us2.manus.computer`
- [ ] Navigate to `api.us2.manus.computer` in new tab
- [ ] Verify session is shared (no re-login required)
- [ ] Verify session cookie domain is `.us2.manus.computer`

#### localStorage Fallback
- [ ] Disable cookies in browser DevTools
- [ ] Verify session data is stored in localStorage
- [ ] Verify session is restored from localStorage
- [ ] Verify cross-tab sync via storage events

#### Security
- [ ] Verify session cookie has HttpOnly flag (not accessible via JS)
- [ ] Verify session cookie has Secure flag (HTTPS only)
- [ ] Verify session cookie has SameSite=none
- [ ] Verify HTTPS redirect in production

### Browser Compatibility Testing

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✓ Supported |
| Firefox | 88+ | ✓ Supported |
| Safari | 14+ | ✓ Supported |
| Edge | 90+ | ✓ Supported |

## Troubleshooting

### Session Not Persisting

**Problem:** User gets logged out frequently

**Solutions:**
1. Verify HttpOnly cookie is being set:
   - Open DevTools → Application → Cookies
   - Check for `app_session_id` cookie
   - Verify domain is `.us2.manus.computer`

2. Check HTTPS enforcement:
   - Verify all requests use HTTPS
   - Check `X-Forwarded-Proto` header in production

3. Verify heartbeat is running:
   - Open DevTools → Network tab
   - Filter for `/api/keep-alive` requests
   - Should see requests every 5 minutes

### localStorage Not Working

**Problem:** Session not restored from localStorage

**Solutions:**
1. Check browser privacy settings:
   - Verify localStorage is enabled
   - Check if third-party cookies are blocked

2. Check storage quota:
   - Verify localStorage has available space
   - Clear old data if quota exceeded

3. Enable debug mode:
   ```typescript
   const sessionStorage = getSessionStorage({ debugMode: true });
   ```

### Cross-Subdomain Session Not Sharing

**Problem:** Session not shared between subdomains

**Solutions:**
1. Verify cookie domain:
   - Should be `.us2.manus.computer` (with leading dot)
   - Not just `us2.manus.computer`

2. Verify SameSite setting:
   - Should be `none` for cross-domain
   - Must have `secure: true`

3. Check subdomain format:
   - Must be under `.us2.manus.computer`
   - Examples: `app.us2.manus.computer`, `api.us2.manus.computer`

## Performance Optimization

### Heartbeat Optimization

- **Interval:** 5 minutes (300,000 ms) - balance between freshness and load
- **Debouncing:** Prevents rapid successive requests (1 second minimum)
- **Page Visibility:** Skips heartbeat when tab is hidden
- **Network Status:** Detects offline status and pauses heartbeat

### localStorage Optimization

- **Minimal Writes:** Only writes on significant changes
- **Compression:** Session data is JSON stringified (small payload)
- **Cleanup:** Automatic removal of expired sessions
- **Quota Management:** Handles quota exceeded errors gracefully

## Security Best Practices

### Cookie Security

✓ **HttpOnly Flag** - Prevents XSS attacks by blocking JavaScript access
✓ **Secure Flag** - Enforces HTTPS transmission
✓ **SameSite=none** - Allows cross-domain requests (with secure flag)
✓ **Domain Scoping** - Limited to `.us2.manus.computer`
✓ **Path Scoping** - Limited to `/`

### HTTPS Enforcement

✓ **Production** - All requests must use HTTPS
✓ **Redirect** - HTTP requests redirected to HTTPS
✓ **Localhost** - Development allows non-secure cookies

### Session Validation

✓ **Every Request** - Session validated on each API call
✓ **Token Expiration** - Sessions expire after 1 year
✓ **Refresh Mechanism** - Heartbeat keeps session fresh
✓ **Logout Clearing** - Session immediately cleared on logout

## Monitoring & Logging

### Session Events to Monitor

```typescript
// Keep-alive success
[Keep-Alive] Session refreshed for user: user-123

// Keep-alive failure
[Keep-Alive] Error: Failed to refresh session

// Logout
[Logout] User logged out: user-123

// Session validation
[Session] POST /api/trpc - Cookie: abc123...
```

### Debug Mode

Enable debug logging:
```typescript
const sessionStorage = getSessionStorage({ debugMode: true });
const heartbeat = useSessionHeartbeat({ debugMode: true });
```

## Future Enhancements

1. **Session Binding** - Bind session to device fingerprint
2. **Concurrent Sessions** - Support multiple concurrent sessions
3. **Session Analytics** - Track session duration and patterns
4. **Adaptive Heartbeat** - Adjust interval based on user activity
5. **Device Trust** - Remember trusted devices for faster re-auth
6. **Biometric Auth** - Support fingerprint/face recognition for re-auth

## Support & Documentation

For issues or questions:
1. Check the Troubleshooting section above
2. Enable debug mode to see detailed logs
3. Review test cases in `sessionPersistence.test.ts`
4. Check browser console for error messages

## Summary

This session persistence solution provides:

✓ **Reliability** - Multiple fallback mechanisms ensure sessions persist
✓ **Security** - HttpOnly cookies, HTTPS enforcement, XSS protection
✓ **Performance** - Efficient heartbeat (5 minutes), minimal overhead
✓ **User Experience** - Graceful error handling, friendly messages
✓ **Cross-Domain** - Seamless session sharing across subdomains
✓ **Offline Support** - localStorage fallback when cookies fail

The combination of HttpOnly cookies, localStorage fallback, periodic heartbeat, and graceful error handling creates a robust session persistence system suitable for enterprise SaaS applications.

---

**Last Updated:** February 6, 2026
**Version:** 1.0.0
**Status:** Production Ready
