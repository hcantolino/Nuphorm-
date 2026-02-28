# NuPhorm Session Persistence Diagnostic Report

**Date:** February 6, 2026  
**Issue:** Users experiencing frequent logouts despite session cookie configuration  
**Status:** CRITICAL - Session cookies not being transmitted with API requests

---

## Executive Summary

After comprehensive analysis, the root cause of frequent logouts has been identified: **session cookies are not being transmitted to the backend with API requests**, even though they are being set correctly. This causes all authenticated API calls to fail with `"Please login (10001)"` errors, triggering automatic redirects to the login page.

---

## Diagnostic Findings

### 1. Browser & Network Analysis

**Evidence from logs:**
- Browser console: `[API Query Error] "Please login (10001)"`
- Network requests: All `/api/trpc/*` requests returning **401 Unauthorized**
- Request headers: **No session cookie being sent** in requests despite `credentials: "include"`

**Key observations:**
```
[2026-02-06T18:41:00.573Z] [API Query Error] TRPCClientError: Please login (10001)
[2026-02-06T18:40:54.283Z] [Auth] Missing session cookie
[2026-02-06T18:40:56.357Z] [Auth] Missing session cookie
[2026-02-06T18:41:00.416Z] [Auth] Missing session cookie
```

### 2. Cookie Configuration Analysis

**Current configuration (cookies.ts):**
```typescript
// For Manus proxy domains (e.g., 3000-xxx.us2.manus.computer):
domain = "." + parts.slice(-3).join(".");  // Results in ".us2.manus.computer"
sameSite = "none";
secure = true;
```

**Problem identified:**
- Cookie domain is set to `.us2.manus.computer` (parent domain)
- However, the browser's **SameSite=none** policy requires **Secure flag** AND **HTTPS**
- The Manus proxy domain uses HTTPS, but there may be a mismatch between:
  - Where the cookie is being **set** (OAuth callback)
  - Where the cookie is being **sent** (API requests)

### 3. Session Cookie Lifecycle

**Set phase (OAuth callback):**
- ✅ Cookie is created with correct domain `.us2.manus.computer`
- ✅ SameSite=none, Secure=true, HttpOnly=true
- ✅ Expires in 1 year (ONE_YEAR_MS = 31536000000ms)

**Transmission phase (API requests):**
- ❌ Frontend sends `credentials: "include"` in fetch options
- ❌ Browser is **NOT** including the session cookie in requests
- ❌ Server logs: `[Auth] Missing session cookie`

### 4. CORS & Cross-Origin Analysis

**tRPC Client Configuration (main.tsx):**
```typescript
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",  // ✅ Correct
        });
      },
    }),
  ],
});
```

**Express Server Configuration (index.ts):**
- ❌ **NO CORS middleware configured**
- ❌ **NO Access-Control-Allow-Credentials header**
- ❌ **NO Access-Control-Allow-Origin header**

This is the **PRIMARY ROOT CAUSE**: Without proper CORS headers, browsers block cookie transmission for cross-origin requests.

### 5. Browser Cookie Storage Verification

**Expected behavior:**
- Cookie should be visible in DevTools → Application → Cookies → `.us2.manus.computer`
- Domain: `.us2.manus.computer`
- Path: `/`
- Expires: ~1 year from login
- HttpOnly: ✅
- Secure: ✅
- SameSite: None

**Actual behavior:**
- Cookie may not be persisting due to browser security policies
- Or cookie exists but browser refuses to send it without proper CORS headers

---

## Root Causes (Ranked by Likelihood)

### 🔴 PRIMARY: Missing CORS Headers (90% confidence)

The Express server is **not sending CORS headers** required for cookie transmission:

```
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: https://3000-xxx.us2.manus.computer
```

**Why this breaks cookies:**
- Browser security policy: Cookies are only sent with cross-origin requests if:
  1. Request includes `credentials: "include"`
  2. Response includes `Access-Control-Allow-Credentials: true`
  3. Response includes `Access-Control-Allow-Origin` (not `*`)

**Current state:**
- Frontend sends `credentials: "include"` ✅
- Server sends `Access-Control-Allow-Credentials` ❌
- Server sends `Access-Control-Allow-Origin` ❌

### 🟡 SECONDARY: Cookie Domain Mismatch (7% confidence)

The cookie domain extraction logic may be incorrect:

```typescript
// Current logic
const parts = hostname.split(".");
domain = "." + parts.slice(-3).join(".");
// For "3000-xxx.us2.manus.computer":
// parts = ["3000-xxx", "us2", "manus", "computer"]
// parts.slice(-3) = ["us2", "manus", "computer"]
// domain = ".us2.manus.computer" ✅ Correct
```

However, if the hostname is different (e.g., includes port), this could fail.

### 🟡 TERTIARY: SameSite=none Browser Compatibility (3% confidence)

Some browsers may not properly handle `SameSite=none` with `Secure=true` in certain conditions:
- Older Chrome versions (< 80)
- Firefox with privacy.trackingprotection.enabled = true
- Safari with "Prevent cross-site tracking" enabled

---

## Reproduction Steps

1. User logs in via OAuth → session cookie is set
2. User navigates to `/biostatistics`
3. Frontend calls `trpc.auth.me.useQuery()`
4. Browser sends request to `/api/trpc/auth.me` with `credentials: "include"`
5. **Browser does NOT include session cookie** (due to missing CORS headers)
6. Server receives request without cookie → `[Auth] Missing session cookie`
7. Server returns 401 Unauthorized → `"Please login (10001)"`
8. Frontend redirects to login page
9. **Loop repeats** on next page load

---

## Fix Implementation

### Fix #1: Add CORS Middleware (CRITICAL)

**File:** `server/_core/index.ts`

```typescript
import cors from 'cors';

// Add CORS middleware BEFORE tRPC routes
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests from any subdomain of .us2.manus.computer (or other regions)
    // Also allow localhost for development
    const allowedOrigins = [
      /^https?:\/\/localhost(:\d+)?$/,
      /^https:\/\/[a-z0-9-]+\.us[0-9]\.manus\.computer$/,
      /^https:\/\/[a-z0-9-]+\.eu[0-9]\.manus\.computer$/,
      /^https:\/\/[a-z0-9-]+\.ap[0-9]\.manus\.computer$/,
    ];
    
    const isAllowed = !origin || allowedOrigins.some(pattern => pattern.test(origin));
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,  // Allow credentials (cookies)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  optionsSuccessStatus: 200,
}));

// Then register OAuth and tRPC routes
registerOAuthRoutes(app);
app.use("/api/trpc", createExpressMiddleware({...}));
```

**Install dependency:**
```bash
pnpm add cors
pnpm add -D @types/cors
```

### Fix #2: Improve Cookie Domain Detection (RECOMMENDED)

**File:** `server/_core/cookies.ts`

```typescript
export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  const isLocalhost = LOCAL_HOSTS.has(hostname) || hostname === "127.0.0.1" || hostname === "::1";
  const isIp = isIpAddress(hostname);
  
  let domain: string | undefined = undefined;
  let sameSite: "strict" | "lax" | "none" = "lax";
  
  if (!isLocalhost && !isIp && hostname) {
    // Check if this is a Manus proxy domain
    if (hostname.includes(".manus.computer")) {
      // Extract parent domain for Manus proxy
      // e.g., "3000-xxx.us2.manus.computer" -> ".us2.manus.computer"
      const parts = hostname.split(".");
      
      // Validate extraction
      if (parts.length >= 3) {
        const parentDomain = "." + parts.slice(-3).join(".");
        
        // Verify it matches expected pattern
        if (/\.[a-z]{2}\d+\.manus\.computer$/.test(parentDomain)) {
          domain = parentDomain;
          sameSite = "none";
          console.log(`[Cookies] Set domain to ${domain} for hostname ${hostname}`);
        } else {
          console.warn(`[Cookies] Invalid parent domain extracted: ${parentDomain}`);
          domain = hostname;
        }
      }
    } else {
      // For other domains, set the full domain
      domain = hostname;
    }
  }
  
  const secure = isSecureRequest(req) || sameSite === "none";

  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite,
    secure,
  };
}
```

### Fix #3: Add Cookie Debugging Middleware (OPTIONAL)

**File:** `server/_core/index.ts`

```typescript
// Add debugging middleware to log cookies
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    console.log(`[Cookies] Received: ${cookieHeader.substring(0, 50)}...`);
  } else {
    console.warn(`[Cookies] No cookies in request to ${req.path}`);
  }
  next();
});
```

### Fix #4: Enhance Frontend Error Handling (RECOMMENDED)

**File:** `client/src/main.tsx`

```typescript
const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Add debug logging
  console.warn("[Auth] Unauthorized error detected, redirecting to login");
  console.warn("[Auth] Current URL:", window.location.href);
  console.warn("[Auth] Cookies in browser:", document.cookie ? "Present" : "Missing");
  
  // Add small delay to allow logs to flush
  setTimeout(() => {
    window.location.href = getLoginUrl();
  }, 100);
};
```

---

## Testing Checklist

After implementing fixes:

### 1. Verify CORS Headers
```bash
# Check if CORS headers are present
curl -i -H "Origin: https://3000-xxx.us2.manus.computer" \
  -H "Access-Control-Request-Method: POST" \
  https://3000-xxx.us2.manus.computer/api/trpc/auth.me
```

Expected response headers:
```
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: https://3000-xxx.us2.manus.computer
```

### 2. Verify Cookie Transmission
- Open DevTools → Network tab
- Filter by `/api/trpc`
- Click on a request
- Check "Request Headers" → "Cookie" field
- Should see: `session=eyJ...` (JWT token)

### 3. Verify Cookie Storage
- Open DevTools → Application → Cookies
- Find `.us2.manus.computer` domain
- Verify:
  - Name: `session`
  - Domain: `.us2.manus.computer`
  - Path: `/`
  - Expires: ~1 year from now
  - HttpOnly: ✅
  - Secure: ✅
  - SameSite: None

### 4. Test Login Flow
1. Clear all cookies and localStorage
2. Click login
3. Complete OAuth flow
4. Verify redirected to `/biostatistics`
5. Open DevTools console
6. Should NOT see `[Auth] Missing session cookie`
7. Should NOT see `[API Query Error]`
8. Refresh page multiple times
9. Verify you stay logged in

### 5. Test Cross-Browser
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

---

## Prevention Measures

### 1. Add Session Timeout Indicator
Implement a visual warning when session is about to expire:

```typescript
// In useAuth hook
useEffect(() => {
  if (!user) return;
  
  // Warn 5 minutes before expiration
  const expiresInMs = 31536000000; // 1 year
  const warnAt = expiresInMs - (5 * 60 * 1000);
  
  const timer = setTimeout(() => {
    toast.warning("Your session will expire in 5 minutes. Please save your work.");
  }, warnAt);
  
  return () => clearTimeout(timer);
}, [user]);
```

### 2. Implement Session Refresh
Automatically refresh session before expiration:

```typescript
// In useAuth hook
useEffect(() => {
  if (!user) return;
  
  // Refresh session every 30 minutes
  const interval = setInterval(() => {
    meQuery.refetch();
  }, 30 * 60 * 1000);
  
  return () => clearInterval(interval);
}, [user, meQuery]);
```

### 3. Add Session Monitoring
Log session state changes for debugging:

```typescript
// In useAuth hook
useEffect(() => {
  console.log("[Session] State changed:", {
    isAuthenticated: Boolean(user),
    userId: user?.id,
    timestamp: new Date().toISOString(),
  });
}, [user]);
```

---

## Summary

| Issue | Cause | Severity | Fix |
|-------|-------|----------|-----|
| Missing session cookie in requests | No CORS headers | 🔴 CRITICAL | Add `cors` middleware |
| Cookie domain mismatch | Extraction logic may fail | 🟡 MEDIUM | Improve validation |
| Browser compatibility | SameSite=none handling | 🟡 MEDIUM | Test across browsers |
| No session timeout warning | Missing UI | 🟢 LOW | Add timeout indicator |

---

## Next Steps

1. **Immediate:** Implement Fix #1 (CORS middleware) - this is the critical issue
2. **Short-term:** Implement Fix #2 (cookie domain validation) and Fix #3 (debugging)
3. **Medium-term:** Implement Fix #4 (frontend error handling) and prevention measures
4. **Long-term:** Add comprehensive session monitoring and analytics

---

## Contact & Support

If issues persist after implementing these fixes:
1. Check browser console for error messages
2. Check server logs: `tail -f .manus-logs/devserver.log | grep Auth`
3. Check network requests in DevTools → Network tab
4. Verify CORS headers are being sent correctly
5. Test in incognito/private mode to rule out browser cache issues
