/**
 * Seed pirate pack 1 isolates + gameplay prefabs into D1 asset_registry.
 *
 *   node scripts/seed-pirate-pack-d1.mjs
 *   node scripts/seed-pirate-pack-d1.mjs --remote
 *
 * Definitions only (sha1 grudge-asset keys). Not player bag / Railway.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PIRATE_MESH, PIRATE_PACK_CATALOG, PIRATE_PACK_R2_KEY, PIRATE_PREFABS } from '../shared/camp/piratePack.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function d1Uuid(key) {
  const buf = createHash('sha1').update(`grudge-asset:${key}`).digest();
  buf[6] = (buf[6] & 0x0f) | 0x50;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const h = buf.subarray(0, 16).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function catalogId(s) {
  return String(s).replace(/\//g, '_').replace(/[^A-Za-z0-9_\-.]/g, '_').replace(/_+/g, '_').toLowerCase();
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

const rows = [];

const packMeta = JSON.stringify({
  grudgeUuid: d1Uuid(PIRATE_PACK_R2_KEY),
  kind: 'pack',
  layer: 'fleet_props',
  meshNames: Object.values(PIRATE_MESH),
  playHull: false,
  source: 'low_poly_pirate_pack_1',
});
rows.push({
  id: catalogId(PIRATE_PACK_R2_KEY),
  name: 'Low Poly Pirate Pack 1',
  category: 'mesh',
  r2Key: PIRATE_PACK_R2_KEY,
  packs: packMeta,
});

for (const e of PIRATE_PACK_CATALOG) {
  const key = `${PIRATE_PACK_R2_KEY}#${e.meshName}`;
  rows.push({
    id: catalogId(e.id),
    name: e.name,
    category: e.role === 'tool' || e.role === 'buildable' ? 'item' : 'mesh',
    r2Key: PIRATE_PACK_R2_KEY,
    packs: JSON.stringify({
      grudgeUuid: d1Uuid(key),
      isolateNode: e.meshName,
      role: e.role,
      catalogIds: e.catalogIds ?? [],
      targetHeightM: e.targetHeightM,
      layer: 'fleet_props',
      playBoatId: e.id === 'pirate.dinghy' ? null : undefined,
    }),
  });
}

for (const p of PIRATE_PREFABS) {
  rows.push({
    id: catalogId(p.id),
    name: p.name,
    category: p.role === 'cannon' ? 'weapon' : 'mesh',
    r2Key: PIRATE_PACK_R2_KEY,
    packs: JSON.stringify({
      grudgeUuid: d1Uuid(p.d1Key),
      prefabId: p.id,
      role: p.role,
      stationKind: p.stationKind ?? null,
      parts: p.parts,
      notes: p.notes,
      layer: 'fleet_prefab',
      playHull: p.role !== 'dinghy',
    }),
  });
}

function toSql(batch) {
  return batch
    .map(
      (r) =>
        `INSERT OR REPLACE INTO asset_registry (id, name, category, r2_key, animation_packs, updated_at)\n` +
        `VALUES ('${esc(r.id)}', '${esc(r.name)}', '${esc(r.category)}', '${esc(r.r2Key)}', '${esc(r.packs)}', unixepoch() * 1000);`,
    )
    .join('\n');
}

const outDir = join(root, 'tmp');
mkdirSync(outDir, { recursive: true });
const sqlPath = join(outDir, 'pirate-pack-d1-seed.sql');
writeFileSync(sqlPath, `-- pirate pack 1 isolates + prefabs\n-- ${rows.length} rows\n${toSql(rows)}\n`);
console.log(`wrote ${sqlPath} (${rows.length} rows)`);

if (process.argv.includes('--remote')) {
  const wranglerCwd = process.env.D1_WRANGLER_CWD || 'F:\\GitHub\\RTS-Grudge';
  const db = process.env.D1_DATABASE_NAME || 'grudge-assets-db';
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', db, '--remote', `--file=${sqlPath}`],
    { cwd: wranglerCwd, stdio: 'inherit', shell: true },
  );
  process.exit(result.status ?? 1);
}
