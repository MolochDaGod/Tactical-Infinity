import * as THREE from 'three';

export type FluffyTreeKind = 'normal' | 'pine' | 'palm' | 'birch' | 'dead' | 'jungle' | 'oak';

export interface FluffyTreePreset {
  trunkHeight:    [number, number];
  trunkRadiusTop: [number, number];
  trunkRadiusBot: [number, number];
  trunkSegments:  number;
  trunkColor:     THREE.ColorRepresentation;

  puffCount:      [number, number];
  puffRadius:     [number, number];
  puffSpread:     [number, number];
  puffYStart:     number;
  puffYSpread:    [number, number];
  puffSegments:   number;
  leafColors:     THREE.ColorRepresentation[];

  hasLeaves:      boolean;
  hasBranches:    boolean;
  branchCount:    [number, number];
  conical:        boolean;
}

export const FLUFFY_PRESETS: Record<FluffyTreeKind, FluffyTreePreset> = {
  normal: {
    trunkHeight:    [3.5, 5.5],
    trunkRadiusTop: [0.10, 0.16],
    trunkRadiusBot: [0.18, 0.28],
    trunkSegments:  6,
    trunkColor:     0x6b4423,
    puffCount:      [5, 8],
    puffRadius:     [0.9, 1.6],
    puffSpread:     [0.6, 1.4],
    puffYStart:     0.85,
    puffYSpread:    [0.0, 1.6],
    puffSegments:   1,
    leafColors:     [0x2d6b1e, 0x3c8a2a, 0x4ea03a, 0x57a849],
    hasLeaves:      true,
    hasBranches:    false,
    branchCount:    [0, 0],
    conical:        false,
  },

  pine: {
    trunkHeight:    [5.0, 8.0],
    trunkRadiusTop: [0.06, 0.10],
    trunkRadiusBot: [0.20, 0.30],
    trunkSegments:  6,
    trunkColor:     0x4a2e18,
    puffCount:      [4, 6],
    puffRadius:     [1.4, 2.0],
    puffSpread:     [0.0, 0.0],
    puffYStart:     0.45,
    puffYSpread:    [0.0, 1.0],
    puffSegments:   1,
    leafColors:     [0x0e3c14, 0x14501a, 0x1a6322, 0x205a18],
    hasLeaves:      true,
    hasBranches:    false,
    branchCount:    [0, 0],
    conical:        true,
  },

  palm: {
    trunkHeight:    [4.0, 6.5],
    trunkRadiusTop: [0.10, 0.14],
    trunkRadiusBot: [0.16, 0.22],
    trunkSegments:  8,
    trunkColor:     0x8a6a3a,
    puffCount:      [7, 10],
    puffRadius:     [0.55, 0.85],
    puffSpread:     [1.6, 2.4],
    puffYStart:     1.0,
    puffYSpread:    [-0.2, 0.4],
    puffSegments:   1,
    leafColors:     [0x2f7a2f, 0x3e9a3a, 0x55b04a],
    hasLeaves:      true,
    hasBranches:    false,
    branchCount:    [0, 0],
    conical:        false,
  },

  birch: {
    trunkHeight:    [4.0, 6.0],
    trunkRadiusTop: [0.07, 0.11],
    trunkRadiusBot: [0.10, 0.15],
    trunkSegments:  6,
    trunkColor:     0xe6e2d5,
    puffCount:      [4, 6],
    puffRadius:     [0.7, 1.1],
    puffSpread:     [0.4, 0.9],
    puffYStart:     0.85,
    puffYSpread:    [0.0, 1.1],
    puffSegments:   1,
    leafColors:     [0xa8c83a, 0xc8d850, 0xd4b800, 0xe8c850],
    hasLeaves:      true,
    hasBranches:    false,
    branchCount:    [0, 0],
    conical:        false,
  },

  dead: {
    trunkHeight:    [3.5, 5.5],
    trunkRadiusTop: [0.05, 0.09],
    trunkRadiusBot: [0.15, 0.22],
    trunkSegments:  6,
    trunkColor:     0x3a2a1a,
    puffCount:      [0, 0],
    puffRadius:     [0, 0],
    puffSpread:     [0, 0],
    puffYStart:     0,
    puffYSpread:    [0, 0],
    puffSegments:   1,
    leafColors:     [],
    hasLeaves:      false,
    hasBranches:    true,
    branchCount:    [3, 6],
    conical:        false,
  },

  jungle: {
    trunkHeight:    [6.0, 9.0],
    trunkRadiusTop: [0.12, 0.18],
    trunkRadiusBot: [0.22, 0.34],
    trunkSegments:  8,
    trunkColor:     0x5a3a20,
    puffCount:      [8, 12],
    puffRadius:     [1.1, 1.9],
    puffSpread:     [0.9, 1.8],
    puffYStart:     0.7,
    puffYSpread:    [0.0, 2.4],
    puffSegments:   1,
    leafColors:     [0x1d4e14, 0x2a6b1c, 0x3a8a26, 0x4aa033],
    hasLeaves:      true,
    hasBranches:    false,
    branchCount:    [0, 0],
    conical:        false,
  },

  oak: {
    trunkHeight:    [4.5, 6.5],
    trunkRadiusTop: [0.14, 0.22],
    trunkRadiusBot: [0.28, 0.40],
    trunkSegments:  8,
    trunkColor:     0x55371b,
    puffCount:      [6, 9],
    puffRadius:     [1.2, 2.1],
    puffSpread:     [1.0, 1.8],
    puffYStart:     0.75,
    puffYSpread:    [0.0, 1.4],
    puffSegments:   1,
    leafColors:     [0x355c20, 0x457828, 0x568f33, 0x6ba83d],
    hasLeaves:      true,
    hasBranches:    false,
    branchCount:    [0, 0],
    conical:        false,
  },
};
