import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import { mountOpenWorldWebSocket } from "./openWorld";
import { ensureBiomeTextures, getTextureManifest } from "./polyhavenAssets";
import { cdnFallback } from "./cdnFallback";

const app = express();
const httpServer = createServer(app);

// Mount the Open World WebSocket on the same HTTP server (single port).
mountOpenWorldWebSocket(httpServer);

// Serve public/ static assets (3D models, textures, animations) before Vite catch-all
app.use(express.static(path.resolve(import.meta.dirname, '..', 'public'), {
  index: false,
}));

// ── ROYGBIV Engine Editor Proxy ──────────────────────────────────────────────
// Proxies /roygbiv/* → localhost:8080 so the ROYGBIV editor is accessible
// from the main app URL at /roygbiv/ without needing a separate Replit port.
const ROYGBIV_PORT = process.env.ROYGBIV_PORT || '8080';
app.use('/roygbiv', createProxyMiddleware({
  target: `http://localhost:${ROYGBIV_PORT}`,
  changeOrigin: true,
  pathRewrite: { '^/roygbiv': '' },
  on: {
    error: (err, req, res) => {
      (res as Response).status(503).json({ error: 'ROYGBIV editor offline — start the ROYGBIV Editor workflow' });
    },
  },
}));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Serve generated avatar images so Meshy can fetch them by URL.
app.use('/avatars', express.static(path.resolve(import.meta.dirname, '..', 'public', 'avatars'), {
  index: false,
  maxAge: '1h',
}));

app.use(express.urlencoded({ extended: false }));

const corsOrigins = (process.env.CORS_ORIGINS ||
  "http://localhost:5000,http://localhost:5173,https://tactical-infinity.vercel.app,https://tethical.grudge-studio.com")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (
    origin &&
    (corsOrigins.includes(origin) || /\.vercel\.app$/.test(origin) || /\.grudge-studio\.com$/.test(origin))
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Grudge-Token");
    return res.sendStatus(204);
  }
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // Poly Haven texture endpoints — MUST be registered before setupVite() so
  // they aren't swallowed by Vite's SPA catch-all.
  app.get("/api/textures/biomes", async (_req, res) => {
    try { res.json(await getTextureManifest()); }
    catch (e: any) { res.status(500).json({ error: e?.message ?? "manifest failed" }); }
  });
  app.post("/api/textures/biomes/sync", async (_req, res) => {
    try { await ensureBiomeTextures(); res.json({ ok: true }); }
    catch (e: any) { res.status(500).json({ error: e?.message ?? "sync failed" }); }
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // CDN fallback: when a static asset isn't on disk (heavy assets stripped
  // from the deployment image), stream it from Replit Object Storage.
  app.use(cdnFallback());

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      // Kick off Poly Haven biome texture sync (non-blocking, idempotent).
      ensureBiomeTextures().catch((e) => log(`biome texture sync error: ${e?.message ?? e}`, "polyhaven"));
    },
  );
})();
