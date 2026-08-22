/**
 * KayKit Resource Bits 1.0 (CC0 — Kay Lousberg).
 * Source: ObjectStore/KayKit_ResourceBits_1.0_FREE
 * Runtime pack: models/kaykit/resource-bits.glb
 *
 * Author units are already SI metres (ingot 0.25 m tall, barrel 1.0 m,
 * large stacks ~1.2–1.5 m). Human 1.8 m — no 100× rescale.
 *
 * Visual wealth only. Counts stay locationInventory / mission resources /
 * Railway bag. Not a second inventory.
 */
import { fleetMeshUuid } from './fleetMeshUuid';

export const KAYKIT_BITS_R2 = 'models/kaykit/resource-bits.glb';
export const KAYKIT_BITS_CDN = `https://assets.grudge-studio.com/${KAYKIT_BITS_R2}`;
export const KAYKIT_BITS_LOCAL = `/${KAYKIT_BITS_R2}`;

export type ResourceWealthKind = 'wood' | 'stone' | 'hemp' | 'ore' | 'gold' | 'fuel' | 'parts';
/** 0 empty · 1 sparse · 2 modest · 3 rich */
export type WealthTier = 0 | 1 | 2 | 3;

export interface ResourceBitDef {
  node: string;
  kind: ResourceWealthKind;
  tier: WealthTier;
  /** Accessor AABB metres (author SI). */
  sizeM: { x: number; y: number; z: number };
}

export const KAYKIT_BITS: readonly ResourceBitDef[] = [
  { node: 'Wood_Plank_A', kind: 'wood', tier: 1, sizeM: { x: 0.4, y: 0.15, z: 1.5 } },
  { node: 'Wood_Planks_Stack_Small', kind: 'wood', tier: 2, sizeM: { x: 0.85, y: 0.32, z: 1.6 } },
  { node: 'Wood_Planks_Stack_Large', kind: 'wood', tier: 3, sizeM: { x: 1.67, y: 1.22, z: 1.62 } },
  { node: 'Stone_Chunks_Small', kind: 'stone', tier: 1, sizeM: { x: 1.12, y: 0.58, z: 0.79 } },
  { node: 'Stone_Bricks_Stack_Small', kind: 'stone', tier: 2, sizeM: { x: 1.04, y: 0.63, z: 0.82 } },
  { node: 'Stone_Bricks_Stack_Large', kind: 'stone', tier: 3, sizeM: { x: 1.51, y: 1.23, z: 1.63 } },
  { node: 'Textiles_A', kind: 'hemp', tier: 1, sizeM: { x: 0.75, y: 0.44, z: 0.95 } },
  { node: 'Textiles_Stack_Small', kind: 'hemp', tier: 2, sizeM: { x: 1.66, y: 0.93, z: 1.59 } },
  { node: 'Textiles_Stack_Large', kind: 'hemp', tier: 3, sizeM: { x: 1.64, y: 0.96, z: 1.67 } },
  { node: 'Iron_Nugget_Small', kind: 'ore', tier: 1, sizeM: { x: 0.14, y: 0.12, z: 0.15 } },
  { node: 'Iron_Nuggets', kind: 'ore', tier: 2, sizeM: { x: 0.93, y: 0.48, z: 0.85 } },
  { node: 'Iron_Bars_Stack_Large', kind: 'ore', tier: 3, sizeM: { x: 1.66, y: 1.5, z: 1.68 } },
  { node: 'Gold_Nugget_Small', kind: 'gold', tier: 1, sizeM: { x: 0.14, y: 0.12, z: 0.15 } },
  { node: 'Gold_Nuggets', kind: 'gold', tier: 2, sizeM: { x: 0.93, y: 0.48, z: 0.85 } },
  { node: 'Gold_Bars_Stack_Large', kind: 'gold', tier: 3, sizeM: { x: 1.66, y: 1.5, z: 1.68 } },
  { node: 'Fuel_A_Jerrycan', kind: 'fuel', tier: 1, sizeM: { x: 0.4, y: 0.78, z: 0.72 } },
  { node: 'Fuel_A_Barrel', kind: 'fuel', tier: 2, sizeM: { x: 0.75, y: 1.01, z: 0.75 } },
  { node: 'Fuel_A_Barrels', kind: 'fuel', tier: 3, sizeM: { x: 1.51, y: 1.01, z: 1.51 } },
  { node: 'Parts_Cog', kind: 'parts', tier: 1, sizeM: { x: 0.37, y: 0.4, z: 0.15 } },
  { node: 'Parts_Pile_Small', kind: 'parts', tier: 2, sizeM: { x: 1.16, y: 0.33, z: 0.99 } },
  { node: 'Parts_Pile_Large', kind: 'parts', tier: 3, sizeM: { x: 1.74, y: 0.73, z: 1.57 } },
];

/** Counts → stack size. Sparse / modest / rich. */
export function wealthTier(count: number): WealthTier {
  if (!(count > 0)) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  return 3;
}

export function bitFor(kind: ResourceWealthKind, tier: WealthTier): ResourceBitDef | null {
  if (tier <= 0) return null;
  return KAYKIT_BITS.find((b) => b.kind === kind && b.tier === tier) ?? null;
}

export function kaykitBitUuid(node: string): string {
  return fleetMeshUuid(KAYKIT_BITS_R2, node);
}

export const CAMP_WEALTH_KINDS: readonly ResourceWealthKind[] = ['wood', 'stone', 'ore', 'gold', 'hemp'];
export const BOAT_WEALTH_KINDS: readonly ResourceWealthKind[] = ['wood', 'hemp', 'fuel', 'gold'];
export const DOCK_WEALTH_KINDS: readonly ResourceWealthKind[] = ['wood', 'stone', 'hemp'];

/** Default camp stores so islets read as poor / modest / rich without a second bag. */
export const CAMP_DEFAULT_WEALTH: Record<string, Record<string, number>> = {
  crusade: { wood: 12, gold: 8, stone: 4 },
  fabled: { hemp: 11, wood: 6, gold: 3 },
  legion: { stone: 16, ore: 12, wood: 4 },
};
