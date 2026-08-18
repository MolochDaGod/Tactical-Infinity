/**
 * Modular wooden pier kit — isolate by node name.
 * Pack: /models/fleet/piers/wooden_pier_kit.glb
 * Source: D:\Games\Models\wooden_pier_22_mb.glb
 *
 * Families:
 *   01 = straight walkway
 *   02 = connector / mid
 *   03 = end / cap
 */

export const PIER_KIT_URL = '/models/fleet/piers/wooden_pier_kit.glb';

export type PierPartRole = 'straight' | 'connector' | 'end';

export interface PierPartDef {
  id: string;
  role: PierPartRole;
  /** Object3D.name substring */
  node: string;
  name: string;
  lengthM: number;
  beamM: number;
  heightM: number;
}

export const PIER_PARTS: readonly PierPartDef[] = [
  { id: 'walk_a', role: 'straight', node: '01', name: 'Walkway A', lengthM: 4, beamM: 2.2, heightM: 1.1 },
  { id: 'walk_b', role: 'straight', node: '01_1', name: 'Walkway B', lengthM: 4, beamM: 2.2, heightM: 1.1 },
  { id: 'walk_c', role: 'straight', node: '01_2', name: 'Walkway C', lengthM: 4, beamM: 2.2, heightM: 1.1 },
  { id: 'walk_d', role: 'straight', node: '01_3', name: 'Walkway D', lengthM: 4, beamM: 2.2, heightM: 1.1 },
  { id: 'walk_base', role: 'straight', node: '01_2_2', name: 'Walkway Base', lengthM: 4, beamM: 2.2, heightM: 1.1 },
  { id: 'join_a', role: 'connector', node: '02', name: 'Connector A', lengthM: 3.2, beamM: 2.4, heightM: 1.1 },
  { id: 'join_b', role: 'connector', node: '02_1', name: 'Connector B', lengthM: 3.2, beamM: 2.4, heightM: 1.1 },
  { id: 'join_base', role: 'connector', node: '02_2', name: 'Connector Base', lengthM: 3.2, beamM: 2.4, heightM: 1.1 },
  { id: 'end_a', role: 'end', node: '03', name: 'Pier End A', lengthM: 3.4, beamM: 2.6, heightM: 1.2 },
  { id: 'end_b', role: 'end', node: '03_1', name: 'Pier End B', lengthM: 3.4, beamM: 2.6, heightM: 1.2 },
  { id: 'end_c', role: 'end', node: '03_2', name: 'Pier End C', lengthM: 3.4, beamM: 2.6, heightM: 1.2 },
  { id: 'end_base', role: 'end', node: '03_2_2', name: 'Pier End Base', lengthM: 3.4, beamM: 2.6, heightM: 1.2 },
];

export function pierPartsByRole(role: PierPartRole): PierPartDef[] {
  return PIER_PARTS.filter((p) => p.role === role);
}
