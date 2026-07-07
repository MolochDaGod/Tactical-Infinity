import * as THREE from 'three';

/**
 * Waterfall Isle — Hero landing zone for the world map.
 *
 * Decorates the player's starting island with landmarks visible from the
 * spawn pose: a lighthouse on the eastern point, a welcome dock with
 * banner, glowing waypoint runes at the island center, and a chain of
 * floating anchor buoys leading the player's eye from the ship to shore.
 *
 * Returns a disposable Group so callers can cleanly remove + dispose
 * everything via `disposeStartingArea()`.
 */

export interface StartingAreaOptions {
  /** World position of the island center. Default (0,0,0). */
  islandCenter?: THREE.Vector3;
  /** Approach bearing in radians (where the ship sails IN from). Default = SE. */
  approachBearing?: number;
  /** Island radius — landmarks are placed near this distance. Default 150. */
  islandRadius?: number;
}

export interface StartingArea {
  group: THREE.Group;
  /** Per-frame tick to animate beacons, buoys, water particles. */
  update: (delta: number, elapsed: number) => void;
  dispose: () => void;
}

const COL_LIGHTHOUSE_STONE = 0xe8dccc;
const COL_LIGHTHOUSE_RED = 0xc8362d;
const COL_BEACON = 0xffd680;
const COL_DOCK_WOOD = 0x6e4a2a;
const COL_DOCK_DARK = 0x4a3018;
const COL_BANNER = 0xffffff;
const COL_RUNE = 0x6fd6ff;
const COL_RUNE_HOT = 0xb8eaff;
const COL_BUOY_RED = 0xd23a2a;
const COL_BUOY_GREEN = 0x2ea14a;

export function decorateStartingArea(
  parent: THREE.Object3D,
  opts: StartingAreaOptions = {},
): StartingArea {
  const center = opts.islandCenter?.clone() ?? new THREE.Vector3(0, 0, 0);
  const bearing = opts.approachBearing ?? Math.PI * 0.25; // approach from SE
  const radius = opts.islandRadius ?? 150;

  const group = new THREE.Group();
  group.name = 'WaterfallIsle:StartingArea';
  group.position.copy(center);
  parent.add(group);

  const disposables: Array<{ dispose: () => void }> = [];
  const trackMaterial = (m: THREE.Material) => disposables.push(m);
  const trackGeometry = (g: THREE.BufferGeometry) => disposables.push(g);

  // ── 1. Lighthouse on the eastern point (visible silhouette from spawn) ──
  const lighthouseGroup = new THREE.Group();
  lighthouseGroup.name = 'lighthouse';
  // Place along approach bearing on the island edge, lifted onto a small mound.
  const lhDist = radius * 0.92;
  lighthouseGroup.position.set(
    Math.sin(bearing) * lhDist,
    2.5,
    Math.cos(bearing) * lhDist,
  );

  const lhBaseGeo = new THREE.CylinderGeometry(3.2, 4.0, 4, 16);
  const lhStoneMat = new THREE.MeshStandardMaterial({
    color: COL_LIGHTHOUSE_STONE, roughness: 0.85, metalness: 0.0,
  });
  const lhBase = new THREE.Mesh(lhBaseGeo, lhStoneMat);
  lhBase.castShadow = true;
  lhBase.receiveShadow = true;
  lhBase.position.y = 2;
  lighthouseGroup.add(lhBase);
  trackGeometry(lhBaseGeo);
  trackMaterial(lhStoneMat);

  // Striped tower (alternating white & red rings) for that classic silhouette.
  for (let i = 0; i < 5; i++) {
    const ringGeo = new THREE.CylinderGeometry(2.2 - i * 0.2, 2.4 - i * 0.2, 3, 16);
    const ringMat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? COL_LIGHTHOUSE_STONE : COL_LIGHTHOUSE_RED,
      roughness: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.castShadow = true;
    ring.position.y = 4 + i * 3;
    lighthouseGroup.add(ring);
    trackGeometry(ringGeo);
    trackMaterial(ringMat);
  }

  // Lantern room (glowing).
  const lanternGeo = new THREE.CylinderGeometry(1.6, 1.6, 2, 16);
  const lanternMat = new THREE.MeshStandardMaterial({
    color: COL_BEACON, emissive: COL_BEACON, emissiveIntensity: 1.6,
    roughness: 0.3, transparent: true, opacity: 0.9,
  });
  const lantern = new THREE.Mesh(lanternGeo, lanternMat);
  lantern.position.y = 19;
  lighthouseGroup.add(lantern);
  trackGeometry(lanternGeo);
  trackMaterial(lanternMat);

  // Cap.
  const capGeo = new THREE.ConeGeometry(2.0, 2.5, 16);
  const capMat = new THREE.MeshStandardMaterial({ color: COL_LIGHTHOUSE_RED, roughness: 0.5 });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = 21.25;
  cap.castShadow = true;
  lighthouseGroup.add(cap);
  trackGeometry(capGeo);
  trackMaterial(capMat);

  // Sweeping spotlight from the lantern (cheap PointLight + animated intensity).
  const beaconLight = new THREE.PointLight(COL_BEACON, 6, 220, 1.6);
  beaconLight.position.y = 19;
  lighthouseGroup.add(beaconLight);

  group.add(lighthouseGroup);

  // ── 2. Welcome dock at the SE shore (where the player will berth) ──
  const dockGroup = new THREE.Group();
  dockGroup.name = 'welcomeDock';
  const dockDist = radius * 1.0;
  const dockX = Math.sin(bearing - 0.18) * dockDist;
  const dockZ = Math.cos(bearing - 0.18) * dockDist;
  dockGroup.position.set(dockX, 0, dockZ);
  // Orient the dock pointing OUT to sea along the approach bearing.
  dockGroup.rotation.y = bearing - 0.18 + Math.PI;

  // Plank deck.
  const deckGeo = new THREE.BoxGeometry(6, 0.4, 22);
  const deckMat = new THREE.MeshStandardMaterial({ color: COL_DOCK_WOOD, roughness: 0.9 });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.set(0, 0.6, 8);
  deck.castShadow = true;
  deck.receiveShadow = true;
  dockGroup.add(deck);
  trackGeometry(deckGeo);
  trackMaterial(deckMat);

  // Pylons.
  const pylonGeo = new THREE.CylinderGeometry(0.25, 0.3, 4, 8);
  const pylonMat = new THREE.MeshStandardMaterial({ color: COL_DOCK_DARK, roughness: 0.95 });
  for (let i = 0; i < 5; i++) {
    const z = 0 + i * 4;
    for (const x of [-2.6, 2.6]) {
      const p = new THREE.Mesh(pylonGeo, pylonMat);
      p.position.set(x, -1.2, z);
      p.castShadow = true;
      dockGroup.add(p);
    }
  }
  trackGeometry(pylonGeo);
  trackMaterial(pylonMat);

  // Welcome banner archway at the landward end.
  const archPostGeo = new THREE.BoxGeometry(0.4, 6, 0.4);
  const archPostMat = new THREE.MeshStandardMaterial({ color: COL_DOCK_DARK, roughness: 0.8 });
  for (const x of [-3.2, 3.2]) {
    const post = new THREE.Mesh(archPostGeo, archPostMat);
    post.position.set(x, 3, -2);
    post.castShadow = true;
    dockGroup.add(post);
  }
  trackGeometry(archPostGeo);
  trackMaterial(archPostMat);

  const archBeamGeo = new THREE.BoxGeometry(7.2, 0.5, 0.5);
  const archBeam = new THREE.Mesh(archBeamGeo, archPostMat);
  archBeam.position.set(0, 6.2, -2);
  dockGroup.add(archBeam);
  trackGeometry(archBeamGeo);

  const bannerGeo = new THREE.PlaneGeometry(6.5, 1.6);
  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 512; bannerCanvas.height = 128;
  const bctx = bannerCanvas.getContext('2d')!;
  bctx.fillStyle = '#1a1410'; bctx.fillRect(0, 0, 512, 128);
  bctx.strokeStyle = '#c8a86a'; bctx.lineWidth = 4;
  bctx.strokeRect(8, 8, 512 - 16, 128 - 16);
  bctx.fillStyle = '#f3e3b8';
  bctx.font = "bold 56px 'Cinzel', 'Times New Roman', serif";
  bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
  bctx.fillText('WATERFALL ISLE', 256, 64);
  const bannerTex = new THREE.CanvasTexture(bannerCanvas);
  bannerTex.colorSpace = THREE.SRGBColorSpace;
  bannerTex.anisotropy = 4;
  const bannerMat = new THREE.MeshBasicMaterial({
    map: bannerTex, transparent: true, side: THREE.DoubleSide,
  });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, 5.4, -2);
  dockGroup.add(banner);
  trackGeometry(bannerGeo);
  trackMaterial(bannerMat);
  disposables.push({ dispose: () => bannerTex.dispose() });

  // Two glowing lanterns hanging on the arch.
  const dockLampGeo = new THREE.SphereGeometry(0.35, 12, 8);
  const dockLampMat = new THREE.MeshStandardMaterial({
    color: COL_BEACON, emissive: COL_BEACON, emissiveIntensity: 2.0,
  });
  for (const x of [-2.8, 2.8]) {
    const lamp = new THREE.Mesh(dockLampGeo, dockLampMat);
    lamp.position.set(x, 5.6, -2);
    dockGroup.add(lamp);
    const lampLight = new THREE.PointLight(COL_BEACON, 2, 25, 1.6);
    lampLight.position.set(x, 5.6, -2);
    dockGroup.add(lampLight);
  }
  trackGeometry(dockLampGeo);
  trackMaterial(dockLampMat);

  group.add(dockGroup);

  // ── 3. Anchor buoys leading the eye from spawn to dock ──
  const buoyDist0 = dockDist + 25;
  const buoyDistStep = 25;
  const buoys: Array<{ mesh: THREE.Mesh; phase: number; baseY: number }> = [];
  const buoyConeGeo = new THREE.ConeGeometry(0.7, 1.6, 8);
  const buoyRedMat = new THREE.MeshStandardMaterial({
    color: COL_BUOY_RED, emissive: COL_BUOY_RED, emissiveIntensity: 0.5, roughness: 0.6,
  });
  const buoyGreenMat = new THREE.MeshStandardMaterial({
    color: COL_BUOY_GREEN, emissive: COL_BUOY_GREEN, emissiveIntensity: 0.5, roughness: 0.6,
  });
  trackGeometry(buoyConeGeo);
  trackMaterial(buoyRedMat);
  trackMaterial(buoyGreenMat);

  for (let i = 0; i < 4; i++) {
    const d = buoyDist0 + i * buoyDistStep;
    // Two buoys flanking the channel, ~6u apart perpendicular to bearing.
    const perpX = Math.cos(bearing - 0.18);
    const perpZ = -Math.sin(bearing - 0.18);
    for (const [side, mat] of [[-1, buoyRedMat], [1, buoyGreenMat]] as const) {
      const x = Math.sin(bearing - 0.18) * d + perpX * side * 6;
      const z = Math.cos(bearing - 0.18) * d + perpZ * side * 6;
      const buoy = new THREE.Mesh(buoyConeGeo, mat);
      buoy.position.set(x, 0.6, z);
      buoy.castShadow = true;
      group.add(buoy);
      buoys.push({ mesh: buoy, phase: i * 0.7 + (side > 0 ? Math.PI : 0), baseY: 0.6 });
    }
  }

  // ── 4. Glowing waypoint stone circle at the island center ──
  const runeGroup = new THREE.Group();
  runeGroup.name = 'waypointRunes';
  runeGroup.position.set(0, 4, 0); // Lift onto the island plateau.
  const stoneGeo = new THREE.BoxGeometry(1.4, 4.5, 0.9);
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x4a4a55, roughness: 0.9, emissive: COL_RUNE, emissiveIntensity: 0.15,
  });
  trackGeometry(stoneGeo);
  trackMaterial(stoneMat);

  const runeRadius = 11;
  const runeStones: Array<{ mesh: THREE.Mesh; phase: number }> = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(stoneGeo, stoneMat.clone());
    stone.position.set(Math.cos(a) * runeRadius, 0, Math.sin(a) * runeRadius);
    stone.lookAt(0, stone.position.y, 0);
    stone.castShadow = true;
    runeGroup.add(stone);
    trackMaterial(stone.material as THREE.Material);
    runeStones.push({ mesh: stone, phase: i * (Math.PI * 2 / 8) });
  }

  // Floating glow disc at the center.
  const glowGeo = new THREE.RingGeometry(2.5, 9, 48);
  const glowMat = new THREE.MeshBasicMaterial({
    color: COL_RUNE_HOT, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.05;
  runeGroup.add(glow);
  trackGeometry(glowGeo);
  trackMaterial(glowMat);

  // Up-shooting beacon column visible from far across the sea.
  const beamGeo = new THREE.CylinderGeometry(0.5, 1.8, 80, 16, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: COL_RUNE_HOT, transparent: true, opacity: 0.18, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 40;
  runeGroup.add(beam);
  trackGeometry(beamGeo);
  trackMaterial(beamMat);

  group.add(runeGroup);

  // ── Animation tick ──
  const update = (_delta: number, elapsed: number) => {
    // Lighthouse beacon "sweeps" by pulsing intensity on a 4s cycle.
    const sweep = 0.5 + 0.5 * Math.sin(elapsed * 1.6);
    beaconLight.intensity = 3 + sweep * 6;
    lanternMat.emissiveIntensity = 1.2 + sweep * 1.2;

    // Buoys bob.
    for (const b of buoys) {
      b.mesh.position.y = b.baseY + Math.sin(elapsed * 1.4 + b.phase) * 0.18;
      b.mesh.rotation.z = Math.sin(elapsed * 0.9 + b.phase) * 0.06;
    }

    // Runes pulse on/off in sequence + center glow breathes + beam shimmers.
    for (let i = 0; i < runeStones.length; i++) {
      const r = runeStones[i];
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.6 - r.phase);
      const m = r.mesh.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.15 + pulse * 0.85;
    }
    glowMat.opacity = 0.35 + 0.15 * Math.sin(elapsed * 1.8);
    glow.rotation.z = elapsed * 0.15;
    beamMat.opacity = 0.14 + 0.08 * Math.sin(elapsed * 2.2);
  };

  const dispose = () => {
    parent.remove(group);
    for (const d of disposables) {
      try { d.dispose(); } catch { /* swallow */ }
    }
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mm) => mm.dispose());
        }
      }
    });
  };

  return { group, update, dispose };
}

// ───────────────────────── Intro Cinematic ─────────────────────────────

export interface CinematicPose {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

export interface IntroCinematicOptions {
  /** Camera pose to start from (high & wide hero shot). */
  start: CinematicPose;
  /** Camera pose to end at (settle behind ship). */
  end: CinematicPose;
  /** Total duration in seconds. Default 4.5. */
  duration?: number;
  /** Easing function (t in 0..1). Default ease-in-out cubic. */
  ease?: (t: number) => number;
}

export class IntroCinematic {
  private startedAt = -1;
  private duration: number;
  private start: CinematicPose;
  private end: CinematicPose;
  private ease: (t: number) => number;
  private _done = false;

  constructor(opts: IntroCinematicOptions) {
    this.start = {
      position: opts.start.position.clone(),
      lookAt: opts.start.lookAt.clone(),
    };
    this.end = {
      position: opts.end.position.clone(),
      lookAt: opts.end.lookAt.clone(),
    };
    this.duration = opts.duration ?? 4.5;
    this.ease = opts.ease ?? ((t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2));
  }

  /** Returns the current pose to apply this frame, or null when finished. */
  sample(nowMs: number): CinematicPose | null {
    if (this._done) return null;
    if (this.startedAt < 0) this.startedAt = nowMs;
    const t = Math.min(1, (nowMs - this.startedAt) / (this.duration * 1000));
    const e = this.ease(t);
    const pos = this.start.position.clone().lerp(this.end.position, e);
    const look = this.start.lookAt.clone().lerp(this.end.lookAt, e);
    if (t >= 1) this._done = true;
    return { position: pos, lookAt: look };
  }

  get done(): boolean { return this._done; }
}
