/**
 * Asset-definition UUID for fleet meshes (D1 / R2 index).
 * Same construction as scripts/seed-fish-d1.mjs:
 *   sha1("grudge-asset:" + key) → RFC UUID with version nibble 5.
 *
 * This is NOT a player item `grudge_uuid` and NOT a character UUID.
 * Definitions live in ObjectStore/D1; bag ownership stays Railway.
 */

function rotl(n: number, b: number): number {
  return ((n << b) | (n >>> (32 - b))) >>> 0;
}

/** SHA-1 of a UTF-8 string → 20-byte Uint8Array (browser + Node). */
export function sha1Bytes(message: string): Uint8Array {
  const bytes = new TextEncoder().encode(message);
  const ml = bytes.length;
  const bitLenHi = Math.floor((ml / 0x20000000) * 8);
  const bitLenLo = (ml << 3) >>> 0;
  const padLen = (ml % 64 < 56 ? 56 : 120) - (ml % 64);
  const total = ml + padLen + 8;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[ml] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, bitLenHi, false);
  view.setUint32(total - 4, bitLenLo, false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);

  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, h0, false);
  ov.setUint32(4, h1, false);
  ov.setUint32(8, h2, false);
  ov.setUint32(12, h3, false);
  ov.setUint32(16, h4, false);
  return out;
}

function bytesToUuid(buf: Uint8Array): string {
  const b = buf.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** D1/R2 definition UUID for a pack file (whole GLB). */
export function fleetPackUuid(urlOrR2Key: string): string {
  const key = urlOrR2Key.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
  return bytesToUuid(sha1Bytes(`grudge-asset:${key}`));
}

/** D1/R2 definition UUID for one isolated mesh inside a pack. */
export function fleetMeshUuid(urlOrR2Key: string, meshName: string): string {
  const key = urlOrR2Key.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
  return bytesToUuid(sha1Bytes(`grudge-asset:${key}#${meshName}`));
}

export function getFleetAssetUuid(url: string, isolateNode?: string, id?: string): string {
  return isolateNode ? fleetMeshUuid(url, isolateNode) : fleetPackUuid(url || id || 'unknown');
}

export function humanMeshLabel(nodeName: string): string {
  return nodeName
    .replace(/^PIRATE_PACK-/, '')
    .replace(/_Material_0$/i, '')
    .replace(/_LP$/i, '')
    .replace(/[._]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
