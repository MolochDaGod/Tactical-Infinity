/**
 * Bake SI Warlords interior shells to public/models/fleet/interiors/{id}.glb
 *
 *   npx tsx scripts/export-warlords-interiors.mjs
 *
 * Geometry + named materials. Runtime binds editor PBR families.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Blob as NodeBlob } from 'node:buffer';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof globalThis.Blob === 'undefined') globalThis.Blob = NodeBlob;
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    result = null;
    onload = null;
    onloadend = null;
    onerror = null;
    readAsArrayBuffer(blob) {
      Promise.resolve(blob.arrayBuffer())
        .then((buf) => {
          this.result = buf;
          this.onload?.({ target: this });
          this.onloadend?.({ target: this });
        })
        .catch((err) => this.onerror?.(err));
    }
  };
}
import { buildInteriorShell } from '../client/src/lib/buildingInteriorInstance.ts';
import { WARLORDS_INTERIORS } from '../shared/gameDefinitions/warlordsInteriorKit.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'client/public/models/fleet/interiors');
mkdirSync(outDir, { recursive: true });

function exportBinary(obj) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      obj,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(Buffer.from(result));
        else reject(new Error('expected binary glb'));
      },
      (err) => reject(err),
      { binary: true, onlyVisible: true },
    );
  });
}

for (const def of WARLORDS_INTERIORS) {
  const scene = new THREE.Scene();
  const room = buildInteriorShell(def.id);
  scene.add(room);
  const buf = await exportBinary(scene);
  const dest = join(outDir, `${def.id}.glb`);
  writeFileSync(dest, buf);
  console.log(def.id, def.w, 'x', def.l, 'x', def.h, 'm', buf.length, 'B', dest);
}
