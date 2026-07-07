/**
 * ids — UUIDs and deterministic ID generation utilities.
 *
 * Two flavours, picked by intent (see SKILL.md "UUIDs & generation best
 * practices" for the decision tree):
 *
 *   • randomId()         — `crypto.randomUUID()` v4. Use for runtime / session
 *                          entities (player sockets, in-memory caches, ephemeral
 *                          UI state). NOT reproducible.
 *
 *   • deterministicId()  — FNV-1a 32-bit hash of a namespaced key. Use for
 *                          procedurally generated content (islands, harbours,
 *                          resource nodes, NPC spawns). REPRODUCIBLE — same
 *                          input always yields the same id.
 *
 * Procgen content MUST use deterministicId so save/reload replays the world.
 * Runtime ephemera SHOULD use randomId so collisions across sessions are
 * impossible.
 */

/** Generate a v4 UUID. Browser + Node 18+. */
export function randomId(): string {
  // crypto.randomUUID is available on all WebGL2-capable browsers and Node 18+.
  // Fallback path is a SECURE manual v4 — we never reach for Math.random.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Node <18 / very old browsers: build a v4 from getRandomValues.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    throw new Error('No secure RNG available — refusing to use Math.random for IDs.');
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') + '-' +
    hex.slice(4, 6).join('') + '-' +
    hex.slice(6, 8).join('') + '-' +
    hex.slice(8, 10).join('') + '-' +
    hex.slice(10, 16).join('')
  );
}

/**
 * FNV-1a 32-bit hash. Non-cryptographic; great for stable bucket / id keys.
 * Returns an unsigned 32-bit integer.
 */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Build a deterministic ID from a hierarchical namespace and component parts.
 * The result is `<namespace>:<part>:<part>:…:<8-char-hash>` — human-readable
 * AND collision-resistant for the cardinalities we care about (≤ 1M entities
 * per namespace gives ≈ 0.01% chance of one collision).
 *
 *   deterministicId('island', 12345)
 *     // → 'island:12345:5b3d9f01'
 *   deterministicId('island', 12345, 'harbour', 3)
 *     // → 'island:12345:harbour:3:9c0e7d12'
 *
 * Because the hash is stable, calling this twice with the same arguments
 * yields the same id — so save/load roundtrips work without storing every id.
 */
export function deterministicId(...parts: (string | number)[]): string {
  const key = parts.map(p => String(p)).join(':');
  const hash = fnv1a(key).toString(16).padStart(8, '0');
  return `${key}:${hash}`;
}

/**
 * Mulberry32 — small, fast, seedable PRNG. Use this whenever you need
 * pseudo-random numbers inside procgen code. NEVER use `Math.random()` in
 * procgen — it makes worlds non-reproducible.
 *
 *   const rng = mulberry32(islandSeed);
 *   const x = rng();           // [0, 1)
 *   const y = rng() * 100;     // [0, 100)
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derive a child seed from a parent seed and a string label. Useful for
 * giving each subsystem its own RNG stream without them clobbering each
 * other:
 *
 *   const islandSeed   = 12345;
 *   const treeSeed     = childSeed(islandSeed, 'trees');
 *   const harbourSeed  = childSeed(islandSeed, 'harbours');
 *   const enemySeed    = childSeed(islandSeed, 'enemies');
 *
 * Same parent + label always returns the same child seed.
 */
export function childSeed(parentSeed: number, label: string): number {
  return fnv1a(`${parentSeed}:${label}`);
}
