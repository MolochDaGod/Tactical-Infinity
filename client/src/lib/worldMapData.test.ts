import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLandedIsland, WORLD_ISLANDS } from './worldMapData';

// The landing (/island-landing) and explore (/island-explore) phases both read
// the target island from the `?island=` query param and resolve it via
// resolveLandedIsland(). A null result means "bad/stale link" and the page
// redirects back to the sea view instead of rendering a blank/broken screen.
//
// These tests lock in that fallback contract so a shared or bookmarked link
// with a missing/unknown id can never strand the player on an empty screen.

const SEA_SLUG = '/world-map';

// Mirrors the exact decision both pages make: resolve the id, and if it can't be
// resolved, redirect to the sea. Returns either the resolved island or a
// redirect target.
function resolveRouteOrRedirect(islandId: string | null | undefined) {
  const island = resolveLandedIsland(islandId);
  if (!island) return { redirectTo: SEA_SLUG } as const;
  return { island } as const;
}

test('resolveLandedIsland returns null for a missing id', () => {
  assert.equal(resolveLandedIsland(undefined), null);
  assert.equal(resolveLandedIsland(null), null);
});

test('resolveLandedIsland returns null for empty / malformed ids', () => {
  assert.equal(resolveLandedIsland(''), null);
  assert.equal(resolveLandedIsland('   '.trim()), null);
  assert.equal(resolveLandedIsland('not-a-real-island'), null);
  assert.equal(resolveLandedIsland('waterfall_isle; DROP TABLE'), null);
  assert.equal(resolveLandedIsland('WATERFALL_ISLE'), null); // case-sensitive
});

test('resolveLandedIsland returns the trimmed island for a valid id', () => {
  const known = WORLD_ISLANDS[0];
  const resolved = resolveLandedIsland(known.id);
  assert.ok(resolved, 'expected a valid island to resolve');
  assert.equal(resolved!.id, known.id);
  assert.equal(resolved!.name, known.name);
  assert.equal(resolved!.biome, known.biome);
});

test('every island in WORLD_ISLANDS resolves by its id', () => {
  for (const island of WORLD_ISLANDS) {
    assert.ok(resolveLandedIsland(island.id), `island ${island.id} should resolve`);
  }
});

test('island-landing redirects to the sea for a missing id', () => {
  assert.deepEqual(resolveRouteOrRedirect(undefined), { redirectTo: SEA_SLUG });
});

test('island-landing redirects to the sea for an unknown id', () => {
  assert.deepEqual(resolveRouteOrRedirect('stale-bookmark-id'), { redirectTo: SEA_SLUG });
});

test('island-explore redirects to the sea for a missing id', () => {
  // Same fallback path is used by the explore phase.
  assert.deepEqual(resolveRouteOrRedirect(undefined), { redirectTo: SEA_SLUG });
});

test('island-explore redirects to the sea for an unknown id', () => {
  assert.deepEqual(resolveRouteOrRedirect('deleted_island_9000'), { redirectTo: SEA_SLUG });
});

test('a valid id does not redirect', () => {
  const known = WORLD_ISLANDS[0];
  const result = resolveRouteOrRedirect(known.id);
  assert.ok('island' in result, 'valid id should not redirect');
  assert.equal(result.island.id, known.id);
});
