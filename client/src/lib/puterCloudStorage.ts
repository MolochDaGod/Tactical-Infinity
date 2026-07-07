import { isPuterAvailable, isSignedIn } from "./puterAuth";

function canUseFs(): boolean {
  return isPuterAvailable() && isSignedIn();
}

const BASE_PATH = "/tethical";
const ISLANDS_PATH  = `${BASE_PATH}/islands`;
const SAVES_PATH    = `${BASE_PATH}/saves`;
const SCREENS_PATH  = `${BASE_PATH}/screenshots`;
const EXPORTS_PATH  = `${BASE_PATH}/exports`;

export interface IslandSaveFile {
  id: string;
  name: string;
  version: string;
  savedAt: string;
  data: unknown;
}

export interface GameExportFile {
  type: "full_save" | "island" | "roster" | "settings";
  version: string;
  exportedAt: string;
  payload: unknown;
}

// Module-level cache so repeated PuterAuthContext mounts (Strict Mode, route
// changes, sign-in churn) do not re-spam the Puter mkdir endpoint. Each path
// is attempted at most once per session; existence checks avoid the noisy
// 404s that the Puter API logs to the browser console for already-present
// directories.
const ensuredDirs = new Set<string>();
let initPromise: Promise<boolean> | null = null;

async function ensureDir(path: string): Promise<void> {
  if (!canUseFs()) return;
  if (ensuredDirs.has(path)) return;
  try {
    const exists = await window.puter.fs.exists(path);
    if (exists) {
      ensuredDirs.add(path);
      return;
    }
    await window.puter.fs.mkdir(path);
    ensuredDirs.add(path);
  } catch {
    // Fall back: assume it now exists (mkdir on an existing path can 404).
    ensuredDirs.add(path);
  }
}

export async function initCloudFolders(): Promise<boolean> {
  if (!canUseFs()) return false;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await ensureDir(BASE_PATH);
      await Promise.all([
        ensureDir(ISLANDS_PATH),
        ensureDir(SAVES_PATH),
        ensureDir(SCREENS_PATH),
        ensureDir(EXPORTS_PATH),
      ]);
      console.log("[PuterCloud] Folders initialised:", BASE_PATH);
      return true;
    } catch (err) {
      console.error("[PuterCloud] Failed to init folders:", err);
      initPromise = null; // allow retry on next call
      return false;
    }
  })();
  return initPromise;
}

export async function saveIslandFile(islandId: string, name: string, data: unknown): Promise<boolean> {
  if (!canUseFs()) return false;
  try {
    await ensureDir(ISLANDS_PATH);
    const file: IslandSaveFile = {
      id: islandId,
      name,
      version: "1.0.0",
      savedAt: new Date().toISOString(),
      data,
    };
    const json = JSON.stringify(file, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    await window.puter.fs.write(`${ISLANDS_PATH}/${islandId}.json`, blob);
    console.log("[PuterCloud] Island saved:", islandId);
    return true;
  } catch (err) {
    console.error("[PuterCloud] Failed to save island:", err);
    return false;
  }
}

export async function loadIslandFile(islandId: string): Promise<IslandSaveFile | null> {
  if (!canUseFs()) return null;
  try {
    const blob = await window.puter.fs.read(`${ISLANDS_PATH}/${islandId}.json`);
    const text = await blob.text();
    return JSON.parse(text) as IslandSaveFile;
  } catch (err) {
    console.error("[PuterCloud] Failed to load island:", err);
    return null;
  }
}

export async function listIslandFiles(): Promise<{ id: string; name: string; savedAt: string }[]> {
  if (!canUseFs()) return [];
  try {
    const entries = await window.puter.fs.readdir(ISLANDS_PATH);
    const results: { id: string; name: string; savedAt: string }[] = [];
    for (const entry of entries) {
      if (!entry.is_dir && entry.name.endsWith(".json")) {
        try {
          const blob = await window.puter.fs.read(`${ISLANDS_PATH}/${entry.name}`);
          const text = await blob.text();
          const file = JSON.parse(text) as IslandSaveFile;
          results.push({ id: file.id, name: file.name, savedAt: file.savedAt });
        } catch { /* skip corrupt files */ }
      }
    }
    return results;
  } catch {
    return [];
  }
}

export async function deleteIslandFile(islandId: string): Promise<boolean> {
  if (!canUseFs()) return false;
  try {
    await window.puter.fs.delete(`${ISLANDS_PATH}/${islandId}.json`);
    return true;
  } catch {
    return false;
  }
}

export async function saveScreenshot(label: string, canvas: HTMLCanvasElement): Promise<string | null> {
  if (!canUseFs()) return null;
  try {
    await ensureDir(SCREENS_PATH);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (!blob) return null;
    const ts = Date.now();
    const filename = `${label.replace(/\s+/g, "_")}_${ts}.png`;
    const path = `${SCREENS_PATH}/${filename}`;
    await window.puter.fs.write(path, blob);
    console.log("[PuterCloud] Screenshot saved:", path);
    return path;
  } catch (err) {
    console.error("[PuterCloud] Screenshot failed:", err);
    return null;
  }
}

export async function exportGameFile(type: GameExportFile["type"], payload: unknown): Promise<string | null> {
  if (!canUseFs()) return null;
  try {
    await ensureDir(EXPORTS_PATH);
    const file: GameExportFile = {
      type,
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      payload,
    };
    const json = JSON.stringify(file, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const ts = Date.now();
    const path = `${EXPORTS_PATH}/${type}_${ts}.json`;
    await window.puter.fs.write(path, blob);
    console.log("[PuterCloud] Export saved:", path);
    return path;
  } catch (err) {
    console.error("[PuterCloud] Export failed:", err);
    return null;
  }
}

export async function listExports(): Promise<{ path: string; type: string; exportedAt: string }[]> {
  if (!canUseFs()) return [];
  try {
    const entries = await window.puter.fs.readdir(EXPORTS_PATH);
    const results: { path: string; type: string; exportedAt: string }[] = [];
    for (const entry of entries) {
      if (!entry.is_dir && entry.name.endsWith(".json")) {
        try {
          const blob = await window.puter.fs.read(`${EXPORTS_PATH}/${entry.name}`);
          const text = await blob.text();
          const file = JSON.parse(text) as GameExportFile;
          results.push({
            path: `${EXPORTS_PATH}/${entry.name}`,
            type: file.type,
            exportedAt: file.exportedAt,
          });
        } catch { /* skip */ }
      }
    }
    return results.sort((a, b) => b.exportedAt.localeCompare(a.exportedAt));
  } catch {
    return [];
  }
}
