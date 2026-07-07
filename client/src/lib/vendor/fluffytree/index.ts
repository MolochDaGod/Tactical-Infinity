/**
 * fluffytree — vendored, MIT, see ./LICENSE
 *
 * Public API:
 *   - createFluffyTreeGroup(kind, opts)     stylized THREE.Group ready to add to scene
 *   - createFluffyTreeMesh(kind, opts)      raw geometry+materials for instancing
 *   - FLUFFY_PRESETS                        per-kind tuning (read-only reference)
 *   - kindFromTreeType(treeType)            map Tethical TreeType → FluffyTreeKind
 *   - kindFromBiome(biome)                  pick a biome-appropriate kind
 */
export { createFluffyTreeGroup, createFluffyTreeMesh } from './tree';
export type { FluffyTreeOptions, FluffyTreeBuilt } from './tree';
export { FLUFFY_PRESETS } from './presets';
export type { FluffyTreeKind, FluffyTreePreset } from './presets';

import type { FluffyTreeKind } from './presets';

/** Map Tethical's existing TreeType union → FluffyTree kind. */
export function kindFromTreeType(t: string): FluffyTreeKind {
  switch (t) {
    case 'pine':   return 'pine';
    case 'palm':   return 'palm';
    case 'birch':  return 'birch';
    case 'dead':   return 'dead';
    case 'oak':    return 'oak';
    case 'jungle': return 'jungle';
    default:       return 'normal';
  }
}

/** Pick a sensible default kind for a biome. */
export function kindFromBiome(biome: string): FluffyTreeKind {
  switch (biome) {
    case 'tropical': return 'palm';
    case 'volcanic': return 'dead';
    case 'arctic':   return 'pine';
    case 'desert':   return 'palm';
    case 'temperate':
    case 'forest':   return 'oak';
    default:         return 'normal';
  }
}
