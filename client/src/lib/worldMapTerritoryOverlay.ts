/**
 * worldMapTerritoryOverlay.ts
 *
 * Renderable Three.js overlay showing the three Grudge factions' territories
 * (Crusade / Fabled / Legion) plus the neutral and pirate zones, with:
 *
 *   - Soft-edge faction discs on the water plane (radial falloff to a hard
 *     boundary line at FACTION_TERRITORIES[faction].radius).
 *   - Capital city markers (vertical banner + glow puck) per faction.
 *
 * Pure helper module: returns THREE.Group instances ready to be added to
 * any scene. No globals, no side-effects on import.
 */

import * as THREE from 'three';
import { FACTION_TERRITORIES } from './worldMapData';
import type { Faction } from './worldMapData';
import { getCapitalIsland } from './worldMapChunks';

const TERRITORY_Y    = 0.5;   // hover just above the water plane
const CAPITAL_BANNER_HEIGHT = 80;
const CAPITAL_GLOW_RADIUS   = 60;

// Only the playable faction zones get a full overlay.
const PLAYABLE_FACTIONS: Faction[] = ['crusade', 'fabled', 'legion'];

// ── Soft-edge disc shader ───────────────────────────────────────────────────
// Renders a high-opacity ring at radius = 1 with smooth interior fill, used
// to communicate "this is X faction's claimed water" without occluding the
// islands beneath. Plays nicely with the water plane: additive on the rim
// for a glow line, normal blend for the interior wash.
const TERRITORY_VS = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const TERRITORY_FS = /* glsl */`
varying vec2 vUv;
uniform vec3  uColor;
uniform float uOpacity;
uniform float uEdgeStrength;
uniform float uTime;

void main() {
  // uv is [0,1]; centre disc at (0.5, 0.5), radius 0.5.
  vec2  d  = vUv - 0.5;
  float r  = length(d) * 2.0;          // 0 at centre, 1 at boundary
  if (r > 1.0) discard;

  // Interior fill: gentle radial gradient, brighter near centre.
  float fill = smoothstep(1.0, 0.2, r) * uOpacity;

  // Boundary ring: bright line just inside the radius with subtle pulse.
  float ringWidth = 0.04;
  float ring = smoothstep(1.0, 1.0 - ringWidth, r) - smoothstep(1.0 - ringWidth, 1.0 - ringWidth * 2.0, r);
  ring = max(0.0, ring) * uEdgeStrength;
  float pulse = 0.85 + 0.15 * sin(uTime * 1.8);
  ring *= pulse;

  vec3 col = uColor * (fill + ring);
  float a  = clamp(fill + ring, 0.0, 0.85);
  gl_FragColor = vec4(col, a);
}`;

interface TerritoryDiscOptions {
  /** Override base opacity (default 0.18). */
  opacity?:      number;
  /** Override boundary line strength (default 1.4). */
  edgeStrength?: number;
}

export interface TerritoryOverlay {
  group:    THREE.Group;
  /** Call each frame to animate the boundary pulse. */
  update:   (timeSeconds: number) => void;
  dispose:  () => void;
}

function makeFactionDisc(faction: Faction, opts: TerritoryDiscOptions = {}): THREE.Mesh {
  const { center, radius, color } = FACTION_TERRITORIES[faction];
  const mat = new THREE.ShaderMaterial({
    vertexShader:   TERRITORY_VS,
    fragmentShader: TERRITORY_FS,
    transparent:    true,
    depthWrite:     false,
    side:           THREE.DoubleSide,
    uniforms: {
      uColor:        { value: new THREE.Color(color) },
      uOpacity:      { value: opts.opacity      ?? 0.18 },
      uEdgeStrength: { value: opts.edgeStrength ?? 1.4 },
      uTime:         { value: 0 },
    },
  });
  // 64-segment disc — smooth boundary without overdraw.
  const geo = new THREE.CircleGeometry(radius, 96);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(center.x, TERRITORY_Y, center.z);
  mesh.renderOrder = -1; // render before islands so they sit on top
  mesh.name = `Territory_${faction}`;
  return mesh;
}

function makeCapitalMarker(faction: Faction): THREE.Group | null {
  const island = getCapitalIsland(faction);
  if (!island) return null;
  const { color } = FACTION_TERRITORIES[faction];

  const group = new THREE.Group();
  group.name = `Capital_${faction}_${island.id}`;
  group.position.set(island.position.x, 0, island.position.z);

  // Glow puck on the water plane around the capital.
  const puckGeo = new THREE.RingGeometry(CAPITAL_GLOW_RADIUS * 0.9, CAPITAL_GLOW_RADIUS, 64);
  const puckMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const puck = new THREE.Mesh(puckGeo, puckMat);
  puck.rotation.x = -Math.PI / 2;
  puck.position.y = TERRITORY_Y + 0.1;
  puck.renderOrder = 0;
  group.add(puck);

  // Vertical banner pole + flag.
  const poleGeo = new THREE.CylinderGeometry(0.6, 0.6, CAPITAL_BANNER_HEIGHT, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = CAPITAL_BANNER_HEIGHT / 2;
  group.add(pole);

  const flagGeo = new THREE.PlaneGeometry(28, 18);
  const flagMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
  });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(14, CAPITAL_BANNER_HEIGHT - 14, 0);
  group.add(flag);

  // Faction-colour glow halo at the top of the pole.
  const haloGeo = new THREE.SphereGeometry(6, 16, 12);
  const haloMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.y = CAPITAL_BANNER_HEIGHT + 2;
  group.add(halo);

  group.userData = {
    faction,
    islandId:   island.id,
    islandName: island.name,
    isCapital:  true,
  };
  return group;
}

/**
 * Build the full territory overlay — three faction discs + capital markers.
 * Returns a group you can add directly to your world map scene plus an
 * `update(t)` to animate the boundary pulse.
 */
export function createTerritoryOverlay(opts: TerritoryDiscOptions = {}): TerritoryOverlay {
  const root = new THREE.Group();
  root.name = 'WorldMapTerritoryOverlay';

  const discMats: THREE.ShaderMaterial[] = [];
  for (const faction of PLAYABLE_FACTIONS) {
    const disc = makeFactionDisc(faction, opts);
    discMats.push(disc.material as THREE.ShaderMaterial);
    root.add(disc);

    const cap = makeCapitalMarker(faction);
    if (cap) root.add(cap);
  }

  const update = (t: number) => {
    for (const m of discMats) m.uniforms.uTime.value = t;
  };

  const dispose = () => {
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach(x => x.dispose());
      else if (m)            m.dispose();
    });
    root.clear();
  };

  return { group: root, update, dispose };
}
