console.log("main.tsx - starting");
(window as any).__DEBUG_BOOT = true;

// ── Proxy / API mode indicator ────────────────────────────────────────────────
// Biostat API calls use relative /api/v1/... paths.
// In dev (pnpm dev):   Express proxy at localhost:3000 forwards to BIOSTAT_API_URL
// In standalone Vite:  vite.config.ts proxy forwards to BIOSTAT_API_URL
// In production:       Real server/nginx should reverse-proxy /api/v1
if (import.meta.env.DEV) {
  console.info(
    '[proxy] Dev mode active — /api/v1/* → Express proxy → ' +
    (import.meta.env.VITE_BIOSTAT_API_URL ?? 'http://localhost:8001') +
    '  (change via BIOSTAT_API_URL in .env.local)'
  );
} else {
  console.info('[proxy] Production mode — /api/v1/* routed by server/nginx');
}

import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

console.log("main.tsx - about to createRoot");
const rootEl = document.getElementById("root");
console.log("main.tsx - root element:", rootEl);

try {
  console.log("main.tsx - calling root.render()");
  createRoot(rootEl!).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
  console.log("main.tsx - root.render() call completed");
} catch (err) {
  console.error("CRASH during root.render()", err);
  rootEl!.innerHTML = `
    <div style="color:red;padding:40px;font-family:sans-serif;background:#fff;min-height:100vh">
      <h1>React root render crashed</h1>
      <pre style="white-space:pre-wrap;font-size:13px">${err instanceof Error ? err.stack : String(err)}</pre>
    </div>`;
}
