import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml: {
      order: "post" as const,
      handler(html: string) {
        if (process.env.NODE_ENV === "production") {
          return html;
        }
        return {
          html,
          tags: [
            {
              tag: "script",
              attrs: {
                src: "/__manus__/debug-collector.js",
                defer: true,
              },
              injectTo: "head",
            },
          ],
        };
      },
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];

export default defineConfig({
  plugins: plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  optimizeDeps: {
    // Pre-bundle react-plotly.js (CJS) together with its plotly.js/dist/plotly
    // dependency so Vite converts the whole CJS graph to ESM at startup.
    // Without this, the CJS require('plotly.js/dist/plotly') call inside
    // react-plotly.js becomes a stub __require at runtime and throws
    // "Dynamic require of plotly.js/dist/plotly is not supported".
    include: ['react-plotly.js', 'plotly.js/dist/plotly'],
  },
  server: {
    // hmr intentionally omitted here — server/_core/vite.ts overrides the entire
    // server config and sets hmr: { server } to attach Vite's WebSocket handler
    // to Express's http.Server (port 3000). No separate WS port is opened.
    host: 'localhost',
    port: 5173,
    strictPort: false,
    cors: true,
    middlewareMode: false,
    // ── Biostat API proxy (standalone Vite only) ──────────────────────────
    // Active only when you run `vite` directly (not via pnpm dev, which embeds
    // Vite in Express where server.proxy has no effect in middlewareMode).
    // In the normal pnpm dev flow the proxy lives in server/_core/index.ts.
    //
    // To change the backend port without touching code, set in .env.local:
    //   BIOSTAT_API_URL=http://localhost:8000
    proxy: {
      '/api/v1': {
        // 127.0.0.1 not localhost — macOS may resolve localhost → ::1 (IPv6)
        // while uvicorn binds to 0.0.0.0 (IPv4 only), causing ECONNREFUSED.
        target: process.env.BIOSTAT_API_URL ?? 'http://127.0.0.1:8001',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          const target = String(options.target ?? '');
          proxy.on('error', (err, _req, res) => {
            console.error(`[vite-proxy] error ${err.message} (target: ${target})`);
            // res is ServerResponse | Socket — only ServerResponse has writeHead
            if ('writeHead' in res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: 'Biostat API unavailable',
                detail: err.message,
                hint: `Is FastAPI running? Target: ${target}`,
              }));
            }
          });
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log(`[vite-proxy] → ${req.method} ${target}${req.url}`);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            const sc = proxyRes.statusCode ?? '?';
            const level = typeof sc === 'number' && sc >= 400 ? 'error' : 'log';
            console[level](`[vite-proxy] ← ${sc} ${req.method} ${req.url}`);
          });
        },
      },
    },
  },
});
