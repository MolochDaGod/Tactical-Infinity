/**
 * Hard verify: island editor assets are real binaries (not HTML fake-200s).
 * Run: node scripts/verify-island-editor-assets.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'client', 'public');

const checks = [
  ['textures/terrain/sand_albedo.jpg', [0xff, 0xd8], 'JPEG sand'],
  ['textures/terrain/sand_normal.jpg', [0xff, 0xd8], 'JPEG sand normal'],
  ['textures/terrain/stone_albedo.jpg', [0xff, 0xd8], 'JPEG stone'],
  ['textures/terrain/stone_normal.jpg', [0xff, 0xd8], 'JPEG stone normal'],
  ['textures/terrain/grass_albedo.jpg', [0xff, 0xd8], 'JPEG grass'],
  ['textures/terrain/soil_albedo.jpg', [0xff, 0xd8], 'JPEG soil'],
  ['models/nature/mountain/rock_mountain_with_cave_realistic_85k.glb', [0x67, 0x6c, 0x54, 0x46], 'GLB evil mountain'],
  ['models/nature/stylized/rocks/stylised_rocks.glb', [0x67, 0x6c, 0x54, 0x46], 'GLB rocks'],
  ['models/creatures/land/free_reptile.glb', [0x67, 0x6c, 0x54, 0x46], 'GLB reptile'],
  ['models/creatures/land/creature_crab.glb', [0x67, 0x6c, 0x54, 0x46], 'GLB crab'],
  ['models/creatures/land/drake.glb', [0x67, 0x6c, 0x54, 0x46], 'GLB drake'],
  ['models/creatures/land/monsters_x_free.glb', [0x67, 0x6c, 0x54, 0x46], 'GLB monsters'],
];

let fail = 0;
for (const [rel, magic, label] of checks) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.error(`FAIL missing: ${label} → ${rel}`);
    fail++;
    continue;
  }
  const buf = Buffer.alloc(magic.length);
  const fd = fs.openSync(p, 'r');
  fs.readSync(fd, buf, 0, magic.length, 0);
  fs.closeSync(fd);
  const ok = magic.every((b, i) => buf[i] === b);
  const size = fs.statSync(p).size;
  if (!ok) {
    console.error(`FAIL magic: ${label} (${buf.toString('hex')}) size=${size}`);
    fail++;
  } else {
    console.log(`OK ${label} size=${size}`);
  }
}

if (fail) {
  console.error(`\n${fail} check(s) failed`);
  process.exit(1);
}
console.log('\nAll island-editor staged assets verified.');
