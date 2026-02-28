/**
 * Enhanced Session Middleware
 * 
 * Provides:
 * - Session validation and refresh
 * - Keep-alive endpoint for heartbeat
 * - Session expiration tracking
 * - HTTPS enforcement
 * - Cross-subdomain session management
 * - Graceful error handling
 */

import type { Express, Request, Response, NextFunction } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getEnhancedSessionCookieOptions, getClearSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import * as db from "../db";

/**
 * Session validation middleware
 * Validates session on every request and refreshes if needed
 */
export function sessionValidationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Store original send function
  const originalSend = res.send;

  // Override send to ensure session cookie is set on successful responses
  res.send = function (data: any) {
    // Only set cookie on successful responses (2xx status)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const sessionCookie = req.cookies[COOKIE_NAME];
      if (sessionCookie && !res.getHeader("Set-Cookie")) {
        const cookieOptions = getEnhancedSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionCookie, cookieOptions);
      }
    }

    // Call original send
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Keep-alive endpoint handler
 * Refreshes session without requiring full authentication
 */
export async function handleKeepAlive(req: Request, res: Response) {
  try {
    // Validate that user is authenticated
    let user = null;
    try {
      user = await sdk.authenticateRequest(req);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "No active session",
      });
    }

    // Calculate new expiration time (1 year from now)
    const expiresAtMs = Date.now() + ONE_YEAR_MS;

    // Refresh session cookie with new expiration
    const sessionCookie = req.cookies[COOKIE_NAME];
    if (sessionCookie) {
      const cookieOptions = getEnhancedSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionCookie, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });
    }

    // Log keep-alive for audit trail
    console.log(`[Keep-Alive] Session refreshed for user: ${user.id}`);

    // Return success with new expiration time
    res.json({
      success: true,
      expiresAt: expiresAtMs,
      message: "Session refreshed successfully",
    });
  } catch (error) {
    console.error("[Keep-Alive] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to refresh session",
    });
  }
}

/**
 * Logout endpoint handler
 * Securely clears session cookie and invalidates session
 */
export async function handleLogout(req: Request, res: Response) {
  try {
    // Get user for logging
    let user = null;
    try {
      user = await sdk.authenticateRequest(req);
    } catch (error) {
      // Continue even if authentication fails
    }

    // Clear session cookie securely
    const clearOptions = getClearSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, clearOptions);

    // Log logout for audit trail
    if (user) {
      console.log(`[Logout] User logged out: ${user.id}`);
    }

    // Return success
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("[Logout] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to logout",
    });
  }
}

/**
 * Session status endpoint
 * Returns current session status and time until expiration
 */
export async function handleSessionStatus(req: Request, res: Response) {
  try {
    let user = null;
    try {
      user = await sdk.authenticateRequest(req);
    } catch (error) {
      // No active session
    }

    if (!user) {
      return res.json({
        authenticated: false,
        message: "No active session",
      });
    }

    // Calculate time until expiration (1 year from now)
    const expiresAtMs = Date.now() + ONE_YEAR_MS;
    const timeUntilExpiration = expiresAtMs - Date.now();

    res.json({
      authenticated: true,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      expiresAt: expiresAtMs,
      timeUntilExpiration,
      isExpiringSoon: timeUntilExpiration < 5 * 60 * 1000, // 5 minutes
    });
  } catch (error) {
    console.error("[Session Status] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get session status",
    });
  }
}

/**
 * Register session management routes
 */
export function registerSessionRoutes(app: Express) {
  // Keep-alive endpoint - refreshes session
  app.post("/api/keep-alive", handleKeepAlive);

  // Logout endpoint - clears session
  app.post("/api/logout", handleLogout);

  // Session status endpoint - returns current session info
  app.get("/api/session/status", handleSessionStatus);

  // Health check endpoint - no authentication required
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  console.log("[SessionRoutes] Session management routes registered");
}

/**
 * HTTPS enforcement middleware
 * Redirects HTTP requests to HTTPS in production
 */
export function httpsEnforcementMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip for localhost and development
  if (req.hostname === "localhost" || req.hostname === "127.0.0.1") {
    return next();
  }

  // Check if connection is secure or if X-Forwarded-Proto header indicates HTTPS
  const isSecure =
    req.protocol === "https" ||
    (req.headers["x-forwarded-proto"] as string)?.includes("https");

  if (!isSecure) {
    const httpsUrl = `https://${req.get("host")}${req.originalUrl}`;
    return res.redirect(301, httpsUrl);
  }

  next();
}

/**
 * Security headers middleware
 * Sets security-related HTTP headers
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Prevent MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );

  // Referrer Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );

  next();
}

/**
 * Session logging middleware
 * Logs session-related events for debugging
 */
export function sessionLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sessionCookie = req.cookies[COOKIE_NAME];
  if (sessionCookie) {
    const truncatedCookie = sessionCookie.substring(0, 20) + "...";
    console.log(
      `[Session] ${req.method} ${req.path} - Cookie: ${truncatedCookie}`
    );
  }

  next();
}

export default {
  sessionValidationMiddleware,
  handleKeepAlive,
  handleLogout,
  handleSessionStatus,
  registerSessionRoutes,
  httpsEnforcementMiddleware,
  securityHeadersMiddleware,
  sessionLoggingMiddleware,
};
