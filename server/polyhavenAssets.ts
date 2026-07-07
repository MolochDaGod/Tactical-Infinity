/**
 * Poly Haven biome texture sourcing.
 *
 * On boot the server checks `public/textures/ground/<biome>/` for the curated
 * Poly Haven (CC0) PBR pack used by `SplatGroundMaterial`. Anything missing is
 * downloaded asynchronously without blocking the listen() handler.
 *
 * Layout written to disk:
 *   public/textures/ground/<biome>/<layer>_diff.jpg  ← albedo  (sRGB)
 *   public/textures/ground/<biome>/<layer>_nor.jpg   ← normal  (linear, OpenGL)
 *   public/textures/ground/<biome>/<layer>_rough.jpg ← roughness (linear)
 *   public/textures/ground/<biome>/<layer>_ao.jpg    ← AO (linear)
 *
 * License: every asset below is verified CC0 from polyhaven.com — bundling +
 * redistribution is permitted with no attribution requirement.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import https from "node:https";

export type BiomeId = "tropical" | "grassland" | "volcano" | "tundra" | "desert";
export type LayerId = "sand" | "grass" | "rock" | "layer4";
export type MapKind = "diff" | "nor" | "rough" | "ao";

interface BiomePack {
  sand: string; grass: string; rock: string; layer4: string;
}

/** Curated biome → Poly Haven asset-id pack (all verified CC0, all expose 1K JPG). */
export const BIOME_TEXTURE_PACK: Record<BiomeId, BiomePack> = {
  tropical:  { sand: "aerial_beach_01",   grass: "aerial_grass_rock",   rock: "rocks_ground_06",   layer4: "brown_mud_leaves_01" },
  grassland: { sand: "coast_sand_03",     grass: "grass_medium_01",     rock: "rock_boulder_dry",  layer4: "dirt_floor"          },
  volcano:   { sand: "sand_02",           grass: "forest_floor",        rock: "dry_riverbed_rock", layer4: "rock_face_03"        },
  tundra:    { sand: "sand_01",           grass: "aerial_rocks_02",     rock: "rock_face",         layer4: "snow_02"             },
  desert:    { sand: "sand_03",           grass: "coast_sand_rocks_02", rock: "rock_pitted_mossy", layer4: "mossy_rock"          },
};

/** Map of MapKind → Poly Haven JSON top-level key. */
const PH_MAP_KEY: Record<MapKind, string[]> = {
  diff:  ["Diffuse"],
  nor:   ["nor_gl", "nor_dx"],     // prefer OpenGL convention
  rough: ["Rough"],
  ao:    ["AO"],
};

const RESOLUTION = "1k"; // 1K JPG: ~600KB-1.4MB per file
const PUBLIC_DIR = path.resolve(import.meta.dirname, "..", "public", "textures", "ground");

interface PHFile { url: string; size: number; md5: string }
interface PHFilesResponse { [k: string]: any }

function fetchJSON(url: string, timeoutMs = 12_000): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch (e) { reject(e); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error("timeout")); });
    req.on("error", reject);
  });
}

function downloadFile(url: string, dest: string, timeoutMs = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // follow redirect
        res.resume();
        return downloadFile(res.headers.location, dest, timeoutMs).then(resolve, reject);
      }
      if (res.statusCode && res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const tmp = dest + ".tmp";
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on("finish", () => {
        out.close(() => fs.rename(tmp, dest, (err) => err ? reject(err) : resolve()));
      });
      out.on("error", reject);
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error("timeout")); });
    req.on("error", reject);
  });
}

function pickFileNode(filesJson: PHFilesResponse, kind: MapKind): PHFile | null {
  for (const key of PH_MAP_KEY[kind]) {
    const node = filesJson[key];
    if (!node) continue;
    const res = node[RESOLUTION];
    if (!res?.jpg?.url) continue;
    return res.jpg as PHFile;
  }
  return null;
}

async function ensureLayer(biome: BiomeId, layer: LayerId, assetId: string): Promise<void> {
  const dir = path.join(PUBLIC_DIR, biome);
  await fsp.mkdir(dir, { recursive: true });

  // Skip entirely if all 4 maps already present
  const targets: Array<[MapKind, string]> = (["diff", "nor", "rough", "ao"] as MapKind[])
    .map((k) => [k, path.join(dir, `${layer}_${k}.jpg`)]);
  const allPresent = (await Promise.all(targets.map(([, p]) => fsp.stat(p).then(() => true).catch(() => false))))
    .every(Boolean);
  if (allPresent) return;

  let filesJson: PHFilesResponse;
  try {
    filesJson = await fetchJSON(`https://api.polyhaven.com/files/${assetId}`);
  } catch (e) {
    console.warn(`[polyhaven] file-list fetch failed for ${assetId}:`, (e as Error).message);
    return;
  }

  for (const [kind, dest] of targets) {
    if (await fsp.stat(dest).then(() => true).catch(() => false)) continue;
    const pick = pickFileNode(filesJson, kind);
    if (!pick) {
      // Some assets lack AO/Rough — fine, layer falls back gracefully.
      continue;
    }
    try {
      await downloadFile(pick.url, dest);
      console.log(`[polyhaven] ✓ ${biome}/${layer}_${kind}.jpg  (${(pick.size / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.warn(`[polyhaven] failed ${biome}/${layer}_${kind}: ${(e as Error).message}`);
    }
  }
}

let inFlight: Promise<void> | null = null;

/** Idempotent: download every missing biome layer texture in parallel-per-biome. */
export function ensureBiomeTextures(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const biomes = Object.keys(BIOME_TEXTURE_PACK) as BiomeId[];
    const layers: LayerId[] = ["sand", "grass", "rock", "layer4"];
    const tasks: Promise<void>[] = [];
    for (const biome of biomes) {
      for (const layer of layers) {
        tasks.push(ensureLayer(biome, layer, BIOME_TEXTURE_PACK[biome][layer]));
      }
    }
    const t0 = Date.now();
    await Promise.all(tasks);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[polyhaven] biome texture sync complete in ${dt}s`);
  })();
  return inFlight;
}

/** Express handler: report which biome layers are present locally. */
export async function getTextureManifest(): Promise<Record<BiomeId, Record<LayerId, Record<MapKind, boolean>>>> {
  const out: any = {};
  for (const biome of Object.keys(BIOME_TEXTURE_PACK) as BiomeId[]) {
    out[biome] = {};
    for (const layer of ["sand", "grass", "rock", "layer4"] as LayerId[]) {
      out[biome][layer] = {};
      for (const kind of ["diff", "nor", "rough", "ao"] as MapKind[]) {
        const p = path.join(PUBLIC_DIR, biome, `${layer}_${kind}.jpg`);
        out[biome][layer][kind] = await fsp.stat(p).then(() => true).catch(() => false);
      }
    }
  }
  return out;
}
