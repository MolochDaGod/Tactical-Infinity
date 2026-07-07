/**
 * CDN fallback middleware.
 *
 * In production we strip heavy assets (GLB/FBX/textures/audio/video) out of
 * the deployment image via .dockerignore. When the express.static handlers
 * for /, /attached_assets, /avatars miss (because the file isn't present in
 * the image) this middleware streams the bytes out of Replit Object Storage
 * using the manifest produced by `scripts/uploadAssetsToBucket.ts`.
 *
 * In development the static handlers serve from disk and this middleware is
 * effectively a no-op.
 */
import type { Request, Response, NextFunction } from "express";
import { Client } from "@replit/object-storage";
import path from "path";
import { existsSync, readFileSync } from "fs";

import { statSync } from "fs";
let MANIFEST: Record<string, string> = {};
const MANIFEST_PATH = path.resolve(process.cwd(), "shared", "cdnManifest.json");
let lastMtimeMs = 0;
function loadManifestIfChanged() {
  try {
    if (!existsSync(MANIFEST_PATH)) return;
    const m = statSync(MANIFEST_PATH).mtimeMs;
    if (m === lastMtimeMs) return;
    MANIFEST = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    lastMtimeMs = m;
    console.log(`[cdn] manifest reloaded — ${Object.keys(MANIFEST).length} entries`);
  } catch (e) {
    console.error("[cdn] failed to load manifest", e);
  }
}
loadManifestIfChanged();
// Re-check the manifest file every 10 s so the running server picks up new
// entries written by the asset uploader without needing a restart.
setInterval(loadManifestIfChanged, 10_000).unref();

let _client: Client | null = null;
function client() {
  if (!_client) _client = new Client();
  return _client;
}

const MIME: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".fbx": "application/octet-stream",
  ".obj": "text/plain",
  ".bin": "application/octet-stream",
  ".tga": "image/x-tga",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".hdr": "image/vnd.radiance",
  ".exr": "image/x-exr",
  ".ktx2": "image/ktx2",
  ".dds": "image/vnd.ms-dds",
  ".zip": "application/zip",
};

/** Express middleware: 404-fallback that streams from object storage. */
export function cdnFallback() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    // Strip leading slash; manifest keys are repo-relative
    let key = decodeURIComponent(req.path.replace(/^\/+/, ""));
    // Some routes mount sub-paths (e.g. /avatars/x.png served from public/avatars)
    // Try direct hit, then prefix with `public/`
    let mappedKey = MANIFEST[key] ? key : MANIFEST[`public/${key}`] ? `public/${key}` : null;
    if (!mappedKey) return next();

    try {
      const ext = path.extname(mappedKey).toLowerCase();
      res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      const stream = client().downloadAsStream(MANIFEST[mappedKey]);
      stream.on("error", (err: Error) => {
        console.error(`[cdn] stream error for ${mappedKey}`, err.message);
        if (!res.headersSent) res.status(502).end();
      });
      stream.pipe(res);
    } catch (err) {
      console.error(`[cdn] handler error for ${key}`, err);
      next();
    }
  };
}

export function getManifest() {
  return MANIFEST;
}
