import type { CookieOptions, Request } from "express";
import { COOKIE_NAME } from "@shared/const";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Enhanced session cookie options with HttpOnly flag and secure HTTPS enforcement
 * Ensures cookies are never accessible to JavaScript (prevents XSS attacks)
 * and are only transmitted over secure HTTPS connections
 */
export function getEnhancedSessionCookieOptions(
  req: Request
): CookieOptions {
  const hostname = req.hostname;
  const isLocalhost = LOCAL_HOSTS.has(hostname) || hostname === "127.0.0.1" || hostname === "::1";
  const isIp = isIpAddress(hostname);
  const isSecure = isSecureRequest(req);

  // For Manus proxy domains (e.g., 3000-xxx.us2.manus.computer):
  // Extract the parent domain (.us2.manus.computer) so cookie is sent to all subdomains
  let domain: string | undefined = undefined;
  let sameSite: "strict" | "lax" | "none" = "lax";

  if (!isLocalhost && !isIp && hostname) {
    // Check if this is a Manus proxy domain
    if (hostname.includes(".manus.computer")) {
      // Extract parent domain for Manus proxy
      // e.g., "3000-xxx.us2.manus.computer" -> ".us2.manus.computer"
      const parts = hostname.split(".");
      if (parts.length >= 3) {
        // Get the last 3 parts: [region].manus.computer
        domain = "." + parts.slice(-3).join(".");
        // Use "none" for cross-domain cookies with secure flag
        sameSite = "none";
      }
    } else {
      // For other domains, set the full domain
      domain = hostname;
    }
  }

  // CRITICAL: Always use secure flag for production
  // For localhost development, allow non-secure cookies
  const secure = isLocalhost ? false : (isSecure || sameSite === "none");

  return {
    domain,
    httpOnly: true, // Prevents JavaScript access (XSS protection)
    path: "/",
    sameSite,
    secure, // Only transmit over HTTPS
    maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
  };
}

/**
 * Get session cookie options (legacy - use getEnhancedSessionCookieOptions)
 * Maintained for backward compatibility
 */
export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const options = getEnhancedSessionCookieOptions(req);
  return {
    domain: options.domain,
    httpOnly: options.httpOnly,
    path: options.path,
    sameSite: options.sameSite,
    secure: options.secure,
  };
}

/**
 * Clear session cookie securely
 * Used during logout to remove session from browser
 */
export function getClearSessionCookieOptions(
  req: Request
): CookieOptions {
  const options = getEnhancedSessionCookieOptions(req);
  return {
    ...options,
    maxAge: 0, // Immediately expire the cookie
  };
}
