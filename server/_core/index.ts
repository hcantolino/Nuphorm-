import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleStripeWebhook } from "../webhooks/stripe";

// ── Biostat API proxy target ────────────────────────────────────────────────
// Override in .env.local so you never touch source code when the port changes:
//   BIOSTAT_API_URL=http://localhost:8000
// Defaults to 8001 (FastAPI default for this project).
// Use 127.0.0.1 (not localhost) to force IPv4 — macOS may resolve localhost
// to ::1 (IPv6) while uvicorn binds to 0.0.0.0 (IPv4 only), causing ECONNREFUSED.
const BIOSTAT_API_URL = process.env.BIOSTAT_API_URL ?? "http://127.0.0.1:8001";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Stripe webhook must be registered BEFORE JSON body parser
  // because it needs the raw request body for signature verification
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    handleStripeWebhook
  );
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // CORS middleware - CRITICAL for cookie transmission
  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests from any subdomain of .manus.computer (all regions)
      // Also allow localhost for development
      const allowedOriginPatterns = [
        /^https?:\/\/localhost(:\d+)?$/,
        /^https:\/\/[a-z0-9-]+\.[a-z]{2}\d+\.manus\.computer$/,
        /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/,
        /^https:\/\/(www\.)?nuphorm\.xyz$/,
      ];

      // Allow the Railway public domain if set (e.g. "myapp-production.up.railway.app")
      const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
      if (railwayDomain && origin === `https://${railwayDomain}`) {
        return callback(null, true);
      }

      const isAllowed = !origin || allowedOriginPatterns.some(pattern => pattern.test(origin));
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,  // Allow credentials (cookies)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    optionsSuccessStatus: 200,
  }));
  
  // Parse cookies for all routes (needed for demo anti-abuse + session auth)
  app.use(cookieParser());

  // Cookie debugging middleware — only log actual API calls, not Vite static assets
  app.use((req, _res, next) => {
    const isApi = req.path.startsWith('/api/');
    if (!isApi) { next(); return; }
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      console.log(`[Cookies] ${req.method} ${req.path}: ${cookieHeader.substring(0, 80)}...`);
    } else if (req.path.startsWith('/api/trpc')) {
      console.warn(`[Cookies] No cookies in ${req.path}`);
    }
    next();
  });
  
  // OAuth callback under /api/oauth/callback — skip if no server configured
  if (process.env.OAUTH_SERVER_URL) {
    registerOAuthRoutes(app);
  } else {
    console.log("[OAuth] OAUTH_SERVER_URL not set — OAuth routes disabled");
  }
  
  // DEV ONLY: LLM connectivity check — GET /dev/llm-check
  // Returns { ok, mode, model, error } so you can confirm the API key works.
  if (process.env.NODE_ENV === "development") {
    app.get("/dev/llm-check", async (_req, res) => {
      try {
        const { invokeLLM } = await import("./llm");
        const result = await invokeLLM({
          messages: [{ role: "user", content: "Reply with the single word: OK" }],
          maxTokens: 10,
        });
        const reply = result.choices[0]?.message?.content ?? "(empty)";
        res.json({
          ok: true,
          mode: process.env.ANTHROPIC_API_KEY && !process.env.BUILT_IN_FORGE_API_KEY && !process.env.OPENAI_API_KEY
            ? "anthropic"
            : "openai-compatible",
          model: result.model,
          reply,
        });
      } catch (err: any) {
        res.status(500).json({
          ok: false,
          error: err?.message ?? String(err),
          ANTHROPIC_API_KEY_set: !!process.env.ANTHROPIC_API_KEY,
          OPENAI_API_KEY_set: !!process.env.OPENAI_API_KEY,
          FORGE_KEY_set: !!process.env.BUILT_IN_FORGE_API_KEY,
        });
      }
    });
  }

  // DEV ONLY: Temporary owner login for preview testing
  if (process.env.NODE_ENV === "development") {
    app.get("/dev/login-owner", async (req, res) => {
      try {
        const { sdk } = await import("./sdk");
        const { COOKIE_NAME } = await import("@shared/const");
        const { getSessionCookieOptions } = await import("./cookies");
        const { ONE_YEAR_MS: _ONE_YEAR_MS } = await import("@shared/const");
        const ownerOpenId = process.env.OWNER_OPEN_ID || "dev-owner-id";
        const ownerName = process.env.OWNER_NAME || "Owner";
        
        const sessionToken = await sdk.createSessionToken(ownerOpenId, {
          name: ownerName,
          expiresInMs: 86400000,
        });
        
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 86400000 });
        
        console.log("[DEV] Owner login session created");
        res.redirect(302, "/biostatistics");
      } catch (error) {
        console.error("[DEV] Owner login failed:", error);
        res.status(500).json({ error: "Dev login failed", details: String(error) });
      }
    });
  }
  
  // Serve uploaded files (local filesystem storage)
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use("/uploads", express.static(uploadsDir));

  // ── Beacon endpoint for reliable last-chance save on page unload ──────────
  // sendBeacon sends a POST with Content-Type text/plain, so we parse it manually.
  app.post("/api/regulatory-save-beacon", express.text({ type: "*/*", limit: "5mb" }), (req, res) => {
    try {
      const data = JSON.parse(req.body as string);
      const stateDir = path.join(uploadsDir, ".regulatory-state");
      fs.mkdirSync(stateDir, { recursive: true });
      const filePath = path.join(stateDir, `project-${data.projectId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data.state, null, 2), "utf-8");
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[beacon] save failed:", err);
      res.status(500).json({ ok: false });
    }
  });

  // ── Demo API routes ─────────────────────────────────────────────────────
  // Anti-abuse: in-memory tracking for IP + fingerprint + global daily cap
  const DEMO_COOKIE = "nuphorm_demo_used";
  const DEMO_FP_COOKIE = "nuphorm_demo_fp";
  const demoIpLog = new Map<string, number>(); // IP → timestamp
  const demoFpLog = new Set<string>(); // fingerprint UUIDs that have been used
  let demoDailyCount = 0;
  let demoDayStart = Date.now();
  const DAY_MS = 86_400_000;
  const DEMO_DAILY_CAP = 100;

  function getDemoIp(req: express.Request): string {
    return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  }

  function resetDailyIfNeeded() {
    if (Date.now() - demoDayStart > DAY_MS) {
      demoDailyCount = 0;
      demoDayStart = Date.now();
      // Also purge IPs older than 24h
      const cutoff = Date.now() - DAY_MS;
      demoIpLog.forEach((ts, ip) => {
        if (ts < cutoff) demoIpLog.delete(ip);
      });
    }
  }

  // GET /api/demo/check-usage
  app.get("/api/demo/check-usage", (req, res) => {
    // TODO: REMOVE BEFORE PRODUCTION — reset bypass via ?reset=true
    if (req.query.reset === "true") {
      res.clearCookie(DEMO_COOKIE, { path: "/" });
      res.clearCookie(DEMO_FP_COOKIE, { path: "/" });
      const ip = getDemoIp(req);
      demoIpLog.delete(ip); // TODO: REMOVE BEFORE PRODUCTION
      return res.json({ used: false, reset: true });
    }
    const used = req.cookies?.[DEMO_COOKIE] === "true";
    res.json({ used });
  });

  // POST /api/demo/analyze
  app.post("/api/demo/analyze", express.json({ limit: "2mb" }), (req, res) => {
    // TODO: REMOVE BEFORE PRODUCTION — test_mode bypass skips all demo limits
    const testMode = req.body?.test_mode === true;

    if (!testMode) { // TODO: REMOVE BEFORE PRODUCTION — conditional wrapping
      resetDailyIfNeeded();
      const ip = getDemoIp(req);

      // Check cookie
      if (req.cookies?.[DEMO_COOKIE] === "true") {
        return res.status(403).json({ error: "Demo already used" });
      }

      // Check fingerprint cookie
      const fp = req.cookies?.[DEMO_FP_COOKIE];
      if (fp && demoFpLog.has(fp)) {
        return res.status(403).json({ error: "Demo already used" });
      }

      // Check IP rate limit (1 per 24h)
      const lastUse = demoIpLog.get(ip);
      if (lastUse && Date.now() - lastUse < DAY_MS) {
        return res.status(429).json({ error: "Demo limit reached. Please sign up for full access." });
      }

      // Global daily cap
      if (demoDailyCount >= DEMO_DAILY_CAP) {
        return res.status(503).json({ error: "Demo capacity reached for today. Please try again tomorrow or sign up for immediate access." });
      }
    } // TODO: REMOVE BEFORE PRODUCTION — end of test_mode bypass

    // All checks passed — mark as used
    if (!testMode) { // TODO: REMOVE BEFORE PRODUCTION — skip marking in test_mode
      const isProduction = process.env.NODE_ENV === "production";
      const ip = getDemoIp(req);
      const fp = req.cookies?.[DEMO_FP_COOKIE];
      res.cookie(DEMO_COOKIE, "true", {
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict",
        maxAge: 365 * DAY_MS,
        path: "/",
      });

      // Track IP + fingerprint + global count
      demoIpLog.set(ip, Date.now());
      if (fp) demoFpLog.add(fp);
      demoDailyCount++;
    } // TODO: REMOVE BEFORE PRODUCTION

    res.json({ ok: true });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ path, error }) => {
        if (error.message.includes("Missing session cookie")) {
          console.warn(`[tRPC] Auth error on ${path}: Missing session cookie`);
        }
      },
    })
  );
  
  // ── Biostat API proxy ────────────────────────────────────────────────────
  // Forward /api/v1/* → FastAPI (port configured via BIOSTAT_API_URL in .env.local).
  // Registered after tRPC (/api/trpc) and webhooks (/api/webhooks) so those
  // routes are handled by Express first and never accidentally forwarded.
  // Works in both dev (embedded Vite) and prod — Vite's server.proxy is NOT
  // used because Vite runs in middleware mode (proxy only works in server mode).
  //
  // IMPORTANT: use pathFilter (not app.use("/api/v1", ...)) so Express does NOT
  // strip the /api/v1 prefix. FastAPI expects the full path: /api/v1/clean/analyze.
  // With app.use("/api/v1", proxy), Express strips the prefix → FastAPI sees
  // /clean/analyze → 404. pathFilter matches but never rewrites the path.
  app.use(
    createProxyMiddleware({
      target: BIOSTAT_API_URL,
      pathFilter: "/api/v1",
      changeOrigin: true,
      on: {
        error: (err, _req, res) => {
          console.error(`[biostat-proxy] ECONNREFUSED or upstream error: ${err.message}`);
          console.error(`[biostat-proxy] Target was: ${BIOSTAT_API_URL}`);
          console.error(`[biostat-proxy] Is uvicorn running? Try: lsof -i :8001`);
          if (!("headersSent" in res && res.headersSent)) {
            (res as express.Response).status(502).json({
              error: "Biostat API unavailable",
              detail: err.message,
              hint: `Is FastAPI running? Check BIOSTAT_API_URL (currently: ${BIOSTAT_API_URL})`,
            });
          }
        },
        proxyReq: (proxyReq, req) => {
          console.log(`[biostat-proxy] → ${req.method} ${BIOSTAT_API_URL}${req.url}`);
          // express.json() reads the request body stream and stores it in req.body,
          // leaving the stream exhausted.  The proxy then pipes an empty stream to
          // FastAPI, which blocks waiting for Content-Length bytes that never arrive.
          // Fix: if the body was already parsed, re-write it to the proxied request.
          // Multipart/form-data is NOT affected (express.json doesn't touch it).
          // Only re-stream if the original request was application/json.
          // Multipart/form-data (file uploads) must not be touched here —
          // those streams are still live and forwarded correctly by http-proxy.
          const contentType = req.headers["content-type"] ?? "";
          const body = (req as express.Request).body;
          if (contentType.includes("application/json") && body !== undefined) {
            const bodyStr = JSON.stringify(body);
            proxyReq.setHeader("Content-Type", "application/json");
            proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyStr));
            proxyReq.write(bodyStr);
          }
        },
        proxyRes: (proxyRes, req) => {
          const sc = proxyRes.statusCode ?? "?";
          const level = typeof sc === "number" && sc >= 400 ? "error" : "log";
          console[level](`[biostat-proxy] ← ${sc} ${req.method} ${req.url}`);
        },
      },
    })
  );
  console.log(`[biostat-proxy] /api/v1 → ${BIOSTAT_API_URL}`);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Make PORT available to storage.ts so upload URLs are built correctly
  process.env.PORT = String(port);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`[CORS] Enabled for .manus.computer domains and localhost`);
    console.log(`[Cookies] SameSite=none with Secure flag enabled for cross-origin requests`);
  });
}

startServer().catch(console.error);
