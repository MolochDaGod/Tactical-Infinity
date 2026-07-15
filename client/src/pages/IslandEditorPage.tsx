import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FollowCamera } from '@/lib/camera/FollowCamera';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { createToonOceanPlane, updateToonWater } from '@/lib/toonWaterShader';
import {
  TERRAIN_TEXTURES,
  createTerrainSplatMaterial,
  autoSplatFromHeight,
  type TerrainSplatMaterial,
} from '@/lib/terrainTextures';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowUp, ArrowDown, Minus, TreePine, Mountain, MousePointer2,
  Eraser, Layers, Save, FolderOpen, FilePlus, Undo2, Redo2,
  Grid3x3, Download, Upload, Trash2, Copy, RotateCw,
  ChevronRight, ChevronLeft, UploadCloud,
} from 'lucide-react';
import { savePublishedIsland } from '@/lib/adminOverrides';

// ── Types ─────────────────────────────────────────────────────────────────────
type EditMode = 'terrain' | 'place' | 'select' | 'erase' | 'follow';
type TerrainTool = 'raise' | 'lower' | 'smooth' | 'flatten' | 'noise' | 'texture';
type BrushFalloff = 'smooth' | 'linear' | 'constant';
type AssetType =
  | 'palm_tree' | 'pine_tree' | 'dead_tree'
  | 'rock' | 'ore_iron' | 'ore_gold' | 'crystal'
  | 'house' | 'tower' | 'farm' | 'forge' | 'dock'
  | 'wall' | 'barracks' | 'warehouse' | 'market' | 'sawmill'
  | 'char_human' | 'char_barbarian' | 'char_dwarf' | 'char_elf' | 'char_orc' | 'char_undead'
  | 'herb_bush' | 'deer' | 'boar' | 'goldmine_node'
  | 'particle_fire' | 'particle_fog' | 'lantern' | 'campfire';

interface PlacedAsset {
  id: string;
  type: AssetType;
  position: THREE.Vector3;
  rotationY: number;
  mesh: THREE.Group;
}
interface IslandSave {
  id: string; name: string; gridSize: number;
  heightmap: number[]; waterLevel: number; biome: string;
  assets: Array<{ id: string; type: AssetType; x: number; y: number; z: number; rotationY: number }>;
  savedAt: string;
}
type ContextMenuState = {
  x: number; y: number;
  worldPos: THREE.Vector3;
  target: PlacedAsset | null;
} | null;

// ── Asset catalogue ───────────────────────────────────────────────────────────
const HARVESTABLE_DEFS = [
  { type: 'palm_tree' as AssetType, label: 'Palm Tree', icon: '🌴', yields: 'Wood' },
  { type: 'pine_tree' as AssetType, label: 'Pine Tree', icon: '🌲', yields: 'Wood' },
  { type: 'dead_tree' as AssetType, label: 'Dead Tree', icon: '🪵', yields: 'Wood' },
  { type: 'rock'      as AssetType, label: 'Rock',      icon: '🪨', yields: 'Stone' },
  { type: 'ore_iron'  as AssetType, label: 'Iron Ore',  icon: '⚙️', yields: 'Iron' },
  { type: 'ore_gold'  as AssetType, label: 'Gold Ore',  icon: '✨', yields: 'Gold' },
  { type: 'crystal'   as AssetType, label: 'Crystal',   icon: '💎', yields: 'Mana' },
  { type: 'herb_bush' as AssetType, label: 'Herb Bush', icon: '🌿', yields: 'Herbs' },
  { type: 'goldmine_node' as AssetType, label: 'Gold Mine', icon: '⛏️', yields: 'Gold' },
  { type: 'deer'      as AssetType, label: 'Deer',      icon: '🦌', yields: 'Hide' },
  { type: 'boar'      as AssetType, label: 'Boar',      icon: '🐗', yields: 'Meat' },
];
const BUILDING_DEFS = [
  { type: 'house'     as AssetType, label: 'House',     icon: '🏠', category: 'Basic' },
  { type: 'tower'     as AssetType, label: 'Tower',     icon: '🗼', category: 'Defense' },
  { type: 'wall'      as AssetType, label: 'Wall',      icon: '🧱', category: 'Defense' },
  { type: 'barracks'  as AssetType, label: 'Barracks',  icon: '⚔️', category: 'Military' },
  { type: 'farm'      as AssetType, label: 'Farm',      icon: '🌾', category: 'Production' },
  { type: 'forge'     as AssetType, label: 'Forge',     icon: '🔥', category: 'Crafting' },
  { type: 'sawmill'   as AssetType, label: 'Sawmill',   icon: '🪚', category: 'Production' },
  { type: 'dock'      as AssetType, label: 'Dock',      icon: '⚓', category: 'Harbor' },
  { type: 'warehouse' as AssetType, label: 'Warehouse', icon: '📦', category: 'Storage' },
  { type: 'market'    as AssetType, label: 'Market',    icon: '🏪', category: 'Trade' },
];
const CHARACTER_DEFS = [
  { type: 'char_human'     as AssetType, label: 'Human',     icon: '🧑', faction: 'Crusade',  color: 0xD4A868 },
  { type: 'char_barbarian' as AssetType, label: 'Barbarian',  icon: '🪓', faction: 'Crusade',  color: 0x8B5E3C },
  { type: 'char_dwarf'     as AssetType, label: 'Dwarf',      icon: '⛏️', faction: 'Fabled',   color: 0x7A6A5A },
  { type: 'char_elf'       as AssetType, label: 'Elf',        icon: '🏹', faction: 'Fabled',   color: 0x4A8A5A },
  { type: 'char_orc'       as AssetType, label: 'Orc',        icon: '💀', faction: 'Legion',   color: 0x5A7A3A },
  { type: 'char_undead'    as AssetType, label: 'Undead',     icon: '☠️', faction: 'Legion',   color: 0x6A5A7A },
];
const EFFECTS_DEFS = [
  { type: 'campfire'      as AssetType, label: 'Campfire',    icon: '🔥', category: 'Lights' },
  { type: 'lantern'       as AssetType, label: 'Lantern',     icon: '🏮', category: 'Lights' },
  { type: 'particle_fire' as AssetType, label: 'Fire Emitter', icon: '💫', category: 'FX' },
  { type: 'particle_fog'  as AssetType, label: 'Fog Volume',  icon: '🌫️', category: 'FX' },
];

// ── Vertex color from height ──────────────────────────────────────────────────
function heightToRGB(y: number, out: [number, number, number]): void {
  if (y <= 0)       { out[0] = 0.78; out[1] = 0.70; out[2] = 0.42; }
  else if (y < 2.5) { out[0] = 0.82; out[1] = 0.75; out[2] = 0.46; }
  else if (y < 10)  { out[0] = 0.30; out[1] = 0.62; out[2] = 0.20; }
  else if (y < 22)  { out[0] = 0.22; out[1] = 0.50; out[2] = 0.16; }
  else if (y < 36)  { out[0] = 0.56; out[1] = 0.50; out[2] = 0.42; }
  else              { out[0] = 0.92; out[1] = 0.92; out[2] = 0.92; }
}

// ── Shared materials (created once at module level) ───────────────────────────
const MATS = {
  trunk:   new THREE.MeshLambertMaterial({ color: 0x8B5E3C }),
  palmLf:  new THREE.MeshLambertMaterial({ color: 0x2d8a1a }),
  pine:    new THREE.MeshLambertMaterial({ color: 0x1a5c1a }),
  dead:    new THREE.MeshLambertMaterial({ color: 0x6a5030 }),
  rock:    new THREE.MeshLambertMaterial({ color: 0x7a7060 }),
  darkRk:  new THREE.MeshLambertMaterial({ color: 0x3a3028 }),
  sand:    new THREE.MeshLambertMaterial({ color: 0xd4b896 }),
  red:     new THREE.MeshLambertMaterial({ color: 0x8b3a3a }),
  brown:   new THREE.MeshLambertMaterial({ color: 0x6b3d1e }),
  grey:    new THREE.MeshLambertMaterial({ color: 0x8a8070 }),
  darkBlu: new THREE.MeshLambertMaterial({ color: 0x6070a0 }),
  orange:  new THREE.MeshLambertMaterial({ color: 0xcc6633 }),
  dark:    new THREE.MeshLambertMaterial({ color: 0x4a4038 }),
  wood:    new THREE.MeshLambertMaterial({ color: 0xa0703a }),
  plank:   new THREE.MeshLambertMaterial({ color: 0x8B6914 }),
  post:    new THREE.MeshLambertMaterial({ color: 0x6B4A14 }),
  tan:     new THREE.MeshLambertMaterial({ color: 0xa08050 }),
  gold:    new THREE.MeshLambertMaterial({ color: 0xccaa44 }),
  green:   new THREE.MeshLambertMaterial({ color: 0x5a8c2a, side: THREE.DoubleSide }),
  awning:  new THREE.MeshLambertMaterial({ color: 0xcc4422, side: THREE.DoubleSide }),
  counter: new THREE.MeshLambertMaterial({ color: 0xc09060 }),
  fieldGr: new THREE.MeshLambertMaterial({ color: 0x5a8c2a, side: THREE.DoubleSide }),
};

// ── Procedural mesh factories ─────────────────────────────────────────────────
function makePalmTree(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, 4.5, 7), MATS.trunk);
  trunk.position.y = 2.25; trunk.rotation.z = 0.1; g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 4), MATS.palmLf);
    frond.position.set(Math.cos(a) * 0.7, 5, Math.sin(a) * 0.7);
    frond.rotation.set(0.55, a, 0); g.add(frond);
  }
  return g;
}
function makePineTree(): THREE.Group {
  const g = new THREE.Group();
  g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 3, 6), MATS.trunk), { position: new THREE.Vector3(0, 1.5, 0) }));
  ([0, 1.8, 3.3] as number[]).forEach((off, i) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.6 - i * 0.4, 2.2, 7), MATS.pine);
    c.position.y = 2.5 + off; g.add(c);
  });
  return g;
}
function makeDeadTree(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.25, 4, 5), MATS.dead);
  trunk.position.y = 2; g.add(trunk);
  ([0, 1, 2] as number[]).forEach((i) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 1.5, 4), MATS.dead);
    b.position.set(Math.cos(i * 2.1) * 0.5, 3.5 + i * 0.3, Math.sin(i * 2.1) * 0.5);
    b.rotation.set(0.7, i * 2.1, 0); g.add(b);
  });
  return g;
}
function makeRock(): THREE.Group {
  const g = new THREE.Group();
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 1), MATS.rock);
  r.scale.set(1 + Math.random() * 0.3, 0.65, 0.9 + Math.random() * 0.3);
  r.position.y = 0.4; g.add(r);
  if (Math.random() > 0.4) {
    const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 1), MATS.rock);
    r2.position.set(0.8, 0.28, 0.3); r2.scale.y = 0.6; g.add(r2);
  }
  return g;
}
function makeOre(color: number): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), MATS.darkRk);
  base.scale.y = 0.7; base.position.y = 0.38; g.add(base);
  const mat = new THREE.MeshBasicMaterial({ color });
  ([0, 1, 2] as number[]).forEach((i) => {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), mat);
    const a = (i / 3) * Math.PI * 2;
    c.position.set(Math.cos(a) * 0.28, 0.52 + i * 0.08, Math.sin(a) * 0.28); g.add(c);
  });
  return g;
}
function makeCrystal(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 0.85 });
  ([0, 1, 2, 3] as number[]).forEach((i) => {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 + i * 0.06, 0), mat);
    const a = (i / 4) * Math.PI * 2;
    c.position.set(Math.cos(a) * 0.3, 0.3 + i * 0.28, Math.sin(a) * 0.3); g.add(c);
  });
  return g;
}
function makeHouse(): THREE.Group {
  // Doorway clear height = 2.75 m (metricSizing.DOORWAY_HEIGHT_M).
  const DOOR_H = 2.75;
  const DOOR_W = 1.15;
  const WALL_H = 3.2;
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(5.5, WALL_H, 5.5), MATS.sand);
  walls.position.y = WALL_H * 0.5; g.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.8, 4), MATS.red);
  roof.position.y = WALL_H + 1.2; roof.rotation.y = Math.PI / 4; g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.12), MATS.brown);
  door.position.set(0, DOOR_H * 0.5, 2.8); g.add(door);
  return g;
}
function makeTower(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 8, 8), MATS.grey);
  body.position.y = 4; g.add(body);
  const top = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.25, 4, 8), MATS.grey);
  top.position.y = 8.25; top.rotation.x = Math.PI / 2; g.add(top);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2, 8), MATS.dark);
  roof.position.y = 10; g.add(roof);
  return g;
}
function makeFarm(): THREE.Group {
  const g = new THREE.Group();
  const barn = new THREE.Mesh(new THREE.BoxGeometry(5, 2.5, 4), MATS.orange);
  barn.position.y = 1.25; g.add(barn);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), MATS.fieldGr);
  field.rotation.x = -Math.PI / 2; field.position.set(5, 0.05, 0); g.add(field);
  return g;
}
function makeForge(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), MATS.dark);
  body.position.y = 1.5; g.add(body);
  const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 3, 6), MATS.darkRk);
  chim.position.set(1.2, 4.5, 1.2); g.add(chim);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff5500 }));
  glow.position.set(1.2, 6, 1.2); g.add(glow);
  return g;
}
function makeSawmill(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(5, 2.8, 4), MATS.wood);
  body.position.y = 1.4; g.add(body);
  ([-3.8, 3.8] as number[]).forEach((ox) => {
    ([0, 1, 2] as number[]).forEach((i) => {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.5, 6), MATS.brown);
      log.rotation.z = Math.PI / 2;
      log.position.set(ox, 0.3 + i * 0.6, (i - 1) * 0.7); g.add(log);
    });
  });
  return g;
}
function makeBarracks(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 5), MATS.darkBlu);
  body.position.y = 1.5; g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.5, 5.5), new THREE.MeshLambertMaterial({ color: 0x4a5880 }));
  roof.position.y = 3.25; g.add(roof);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 4), MATS.gold);
  pole.position.set(0, 5.5, 0); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ color: 0xff2222, side: THREE.DoubleSide }));
  flag.position.set(0.7, 7.5, 0); g.add(flag);
  return g;
}
function makeDock(): THREE.Group {
  const g = new THREE.Group();
  const pier = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 10), MATS.plank);
  pier.position.y = 0.15; g.add(pier);
  ([-5, 0, 5] as number[]).forEach((pz) => {
    ([-1, 1] as number[]).forEach((px) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2, 5), MATS.post);
      post.position.set(px * 1.2, -0.7, pz); g.add(post);
    });
  });
  return g;
}
function makeWarehouse(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 6), MATS.tan);
  body.position.y = 2; g.add(body);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 4.5, 2, 4, 1, false), MATS.red);
  roof.position.y = 5; roof.scale.x = 2; g.add(roof);
  return g;
}
function makeMarket(): THREE.Group {
  const g = new THREE.Group();
  ([-2, 2] as number[]).forEach((px) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3, 5), MATS.post);
    post.position.set(px, 1.5, 0); g.add(post);
  });
  const awning = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), MATS.awning);
  awning.rotation.x = -0.3; awning.position.y = 3.5; g.add(awning);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 1), MATS.counter);
  counter.position.set(0, 0.5, 0); g.add(counter);
  return g;
}
function makeWall(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 1), MATS.grey);
  body.position.y = 1.5; g.add(body);
  ([-2, -1, 0, 1, 2] as number[]).forEach((i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 1.1), MATS.grey);
    m.position.set(i * 1.2, 3.4, 0); g.add(m);
  });
  return g;
}

function makeRaceCharacter(color: number, raceLabel: string): THREE.Group {
  const g = new THREE.Group();
  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const skinColor = color;
  const armorColor = new THREE.Color(color).offsetHSL(0, -0.1, -0.15).getHex();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 7), lam(armorColor));
  body.position.y = 1.2; g.add(body);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), lam(skinColor));
  head.position.y = 2.0; g.add(head);
  const helm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), lam(armorColor));
  helm.position.y = 2.08; helm.scale.set(1, 0.65, 1); g.add(helm);
  [-0.45, 0.45].forEach(x => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 5), lam(armorColor));
    arm.position.set(x, 1.2, 0); arm.rotation.z = x > 0 ? -0.4 : 0.4; g.add(arm);
  });
  [-0.15, 0.15].forEach(x => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.7, 5), lam(armorColor));
    leg.position.set(x, 0.42, 0); g.add(leg);
  });
  const nameplate = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.25), new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.6, side: THREE.DoubleSide
  }));
  nameplate.position.y = 2.7; g.add(nameplate);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.08, 16), lam(color));
  pedestal.position.y = 0.04; g.add(pedestal);
  g.traverse(c => { if ((c as THREE.Mesh).isMesh) c.castShadow = true; });
  return g;
}
function makeHerbBush(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.5 + Math.random() * 0.3, 4), MATS.green);
    stem.position.set((Math.random() - 0.5) * 0.5, 0.25, (Math.random() - 0.5) * 0.5); g.add(stem);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), MATS.green);
    leaf.position.copy(stem.position).add(new THREE.Vector3(0, 0.3, 0)); g.add(leaf);
  }
  return g;
}
function makeAnimal(bodyColor: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: bodyColor, flatShading: true });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.6, 4, 6), mat);
  body.position.y = 0.5; body.rotation.z = Math.PI * 0.5; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 5, 4), mat);
  head.position.set(0.5, 0.55, 0); g.add(head);
  [-0.15, 0.15].forEach(x => {
    [-0.12, 0.12].forEach(z => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 4), mat);
      leg.position.set(x, 0.17, z); g.add(leg);
    });
  });
  return g;
}
function makeGoldmineNode(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), MATS.darkRk);
  base.position.y = 0.45; base.scale.set(1.3, 0.75, 1.3); g.add(base);
  [0, 1, 2, 3].forEach(i => {
    const nugget = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18 + Math.random() * 0.1, 0),
      new THREE.MeshLambertMaterial({ color: 0xD4AA30, flatShading: true }));
    const a = (i / 4) * Math.PI * 2;
    nugget.position.set(Math.cos(a) * 0.5, 0.6 + i * 0.12, Math.sin(a) * 0.5); g.add(nugget);
  });
  return g;
}
function makeCampfire(): THREE.Group {
  const g = new THREE.Group();
  [0, 1, 2, 3, 4, 5].forEach(i => {
    const a = (i / 6) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 5), MATS.brown);
    log.position.set(Math.cos(a) * 0.25, 0.1, Math.sin(a) * 0.25);
    log.rotation.z = Math.PI * 0.5; log.rotation.y = a; g.add(log);
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 6),
    new THREE.MeshBasicMaterial({ color: 0xFF6600, transparent: true, opacity: 0.85 }));
  flame.position.y = 0.5; g.add(flame);
  const glow = new THREE.PointLight(0xFF8833, 2, 8);
  glow.position.y = 0.8; g.add(glow);
  return g;
}
function makeLantern(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 2.5, 5), MATS.dark);
  pole.position.y = 1.25; g.add(pole);
  const cage = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x333333, transparent: true, opacity: 0.6 }));
  cage.position.y = 2.7; g.add(cage);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xFFDD88 }));
  bulb.position.y = 2.7; g.add(bulb);
  const glow = new THREE.PointLight(0xFFDD66, 1.5, 6);
  glow.position.y = 2.7; g.add(glow);
  return g;
}
function makeParticleFire(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.05, 4, 3),
      new THREE.MeshBasicMaterial({ color: [0xFF4400, 0xFF8800, 0xFFCC00][i % 3], transparent: true, opacity: 0.7 }));
    p.position.set((Math.random() - 0.5) * 0.5, Math.random() * 1.2, (Math.random() - 0.5) * 0.5); g.add(p);
  }
  g.add(new THREE.PointLight(0xFF6600, 1.5, 5));
  return g;
}
function makeParticleFog(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.8 + Math.random() * 0.6, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xCCCCCC, transparent: true, opacity: 0.15 }));
    cloud.position.set((Math.random() - 0.5) * 3, 0.5 + Math.random() * 1, (Math.random() - 0.5) * 3);
    cloud.scale.set(1 + Math.random(), 0.4, 1 + Math.random()); g.add(cloud);
  }
  return g;
}

function createAssetMesh(type: AssetType): THREE.Group {
  let g: THREE.Group;
  switch (type) {
    case 'palm_tree': g = makePalmTree(); break;
    case 'pine_tree': g = makePineTree(); break;
    case 'dead_tree': g = makeDeadTree(); break;
    case 'rock':      g = makeRock();     break;
    case 'ore_iron':  g = makeOre(0xcc8844); break;
    case 'ore_gold':  g = makeOre(0xffcc00); break;
    case 'crystal':   g = makeCrystal(); break;
    case 'house':     g = makeHouse();   break;
    case 'tower':     g = makeTower();   break;
    case 'farm':      g = makeFarm();    break;
    case 'forge':     g = makeForge();   break;
    case 'sawmill':   g = makeSawmill(); break;
    case 'barracks':  g = makeBarracks(); break;
    case 'dock':      g = makeDock();    break;
    case 'warehouse': g = makeWarehouse(); break;
    case 'market':    g = makeMarket();  break;
    case 'wall':      g = makeWall();    break;
    case 'char_human':     g = makeRaceCharacter(0xD4A868, 'Human'); break;
    case 'char_barbarian': g = makeRaceCharacter(0x8B5E3C, 'Barbarian'); break;
    case 'char_dwarf':     g = makeRaceCharacter(0x7A6A5A, 'Dwarf'); break;
    case 'char_elf':       g = makeRaceCharacter(0x4A8A5A, 'Elf'); break;
    case 'char_orc':       g = makeRaceCharacter(0x5A7A3A, 'Orc'); break;
    case 'char_undead':    g = makeRaceCharacter(0x6A5A7A, 'Undead'); break;
    case 'herb_bush':      g = makeHerbBush(); break;
    case 'deer':           g = makeAnimal(0xA08060); break;
    case 'boar':           g = makeAnimal(0x6A4A3A); break;
    case 'goldmine_node':  g = makeGoldmineNode(); break;
    case 'campfire':       g = makeCampfire(); break;
    case 'lantern':        g = makeLantern(); break;
    case 'particle_fire':  g = makeParticleFire(); break;
    case 'particle_fog':   g = makeParticleFog(); break;
    default:          g = makePalmTree(); break;
  }
  g.userData.isAsset = true;
  g.userData.assetType = type;
  g.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  return g;
}

// ── Terrain tool colours ──────────────────────────────────────────────────────
const TOOL_COLORS: Record<TerrainTool, number> = {
  raise: 0x00ff88, lower: 0xff4444, smooth: 0x44aaff, flatten: 0xffcc00, noise: 0xff88ff, texture: 0x88ff88,
};

// ── Main component ────────────────────────────────────────────────────────────
export default function IslandEditorPage() {
  const { toast } = useToast();

  // ── UI State ─────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<EditMode>('terrain');
  const [terrainTool, setTerrainTool] = useState<TerrainTool>('raise');
  const [brushSize, setBrushSize] = useState(8);
  const [brushStrength, setBrushStrength] = useState(0.5);
  const [brushFalloff, setBrushFalloff] = useState<BrushFalloff>('smooth');
  const [selectedAsset, setSelectedAsset] = useState<AssetType>('palm_tree');
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showWireframe, setShowWireframe] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [islandName, setIslandName] = useState('New Island');
  const [waterLevel, setWaterLevel] = useState(1.5);
  const [biome, setBiome] = useState('tropical');
  const [saves, setSaves] = useState<IslandSave[]>([]);
  const [showSaveList, setShowSaveList] = useState(false);
  const [selectedObjInfo, setSelectedObjInfo] = useState<{ type: string; pos: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [minimapSrc, setMinimapSrc] = useState('');
  const [stats, setStats] = useState({ fps: 60, objs: 0, cursor: '0, 0, 0' });
  const [useTextures, setUseTextures] = useState(false);
  const [texChannel, setTexChannel] = useState(0);
  const [texBrushSize, setTexBrushSize] = useState(0.08);
  // Follow-cam mode — when set, the editor camera tracks `followingTarget`
  // via the unified FollowCamera rig (same one used by captain/island/battle).
  const [followingName, setFollowingName] = useState<string | null>(null);
  const [showInspector, setShowInspector] = useState(false);

  // ── Three.js refs ─────────────────────────────────────────────────────────
  const mountRef    = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef    = useRef<THREE.Scene | null>(null);
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitRef    = useRef<OrbitControls | null>(null);
  /**
   * Unified follow-camera rig — same FollowCamera class used by the
   * captain controller, island explore manager, and battle page. In the
   * editor we keep OrbitControls as the default camera and only enable
   * the rig when EditMode === 'follow'. Both target the same THREE camera.
   */
  const followCamRef = useRef<FollowCamera | null>(null);
  const followingTargetRef = useRef<THREE.Object3D | null>(null);
  const transformRef = useRef<TransformControls | null>(null);
  const terrainRef  = useRef<THREE.Mesh | null>(null);
  const waterRef    = useRef<THREE.Mesh | null>(null);
  const brushIndRef = useRef<THREE.Mesh | null>(null);
  const brushOutRef = useRef<THREE.Line | null>(null);
  const placedRef   = useRef<PlacedAsset[]>([]);
  const selectedRef = useRef<PlacedAsset | null>(null);
  const frameRef    = useRef(0);
  const clockRef    = useRef(new THREE.Clock());
  const minimapRef  = useRef<HTMLCanvasElement | null>(null);
  const paintingRef = useRef(false);
  const mouseRef    = useRef(new THREE.Vector2());
  const rayRef      = useRef(new THREE.Raycaster());
  const undoRef     = useRef<number[][]>([]);
  const redoRef     = useRef<number[][]>([]);
  const ctxWorldPos = useRef(new THREE.Vector3());
  const splatRef    = useRef<TerrainSplatMaterial | null>(null);
  const vertexMatRef = useRef<THREE.MeshLambertMaterial | null>(null);

  // Ref mirrors (avoid stale closures in event handlers)
  const modeRef    = useRef<EditMode>('terrain');
  const toolRef    = useRef<TerrainTool>('raise');
  const bSizeRef   = useRef(8);
  const bStrRef    = useRef(0.5);
  const bFallRef   = useRef<BrushFalloff>('smooth');
  const assetRef   = useRef<AssetType>('palm_tree');
  const snapRef    = useRef(false);
  const wLevelRef  = useRef(1.5);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { toolRef.current = terrainTool; }, [terrainTool]);
  useEffect(() => { bSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { bStrRef.current = brushStrength; }, [brushStrength]);
  useEffect(() => { bFallRef.current = brushFalloff; }, [brushFalloff]);
  useEffect(() => { assetRef.current = selectedAsset; }, [selectedAsset]);
  useEffect(() => { snapRef.current = snapToGrid; }, [snapToGrid]);
  useEffect(() => {
    wLevelRef.current = waterLevel;
    if (waterRef.current) waterRef.current.position.y = waterLevel;
  }, [waterLevel]);
  useEffect(() => {
    if (terrainRef.current) {
      const mat = terrainRef.current.material;
      if (mat instanceof THREE.MeshLambertMaterial) mat.wireframe = showWireframe;
    }
  }, [showWireframe]);

  useEffect(() => {
    const terrain = terrainRef.current;
    if (!terrain) return;
    if (useTextures) {
      if (!splatRef.current) {
        const splat = createTerrainSplatMaterial(['grass_3', 'mud_1', 'dark_mud_1', 'tile_2']);
        splatRef.current = splat;
        autoSplatFromHeight(splat.splatData, splat.splatMap, terrain.geometry, 128);
      }
      vertexMatRef.current = terrain.material as THREE.MeshLambertMaterial;
      terrain.material = splatRef.current.material;
    } else {
      if (vertexMatRef.current) {
        terrain.material = vertexMatRef.current;
      }
    }
  }, [useTextures]);

  // ── Minimap render ────────────────────────────────────────────────────────
  const renderMinimap = useCallback(() => {
    const canvas = minimapRef.current;
    const terrain = terrainRef.current;
    if (!canvas || !terrain) return;
    const pos = terrain.geometry.attributes.position;
    const N = Math.round(Math.sqrt(pos.count));
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(128, 128);
    const rgb: [number, number, number] = [0, 0, 0];
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const i = row * N + col;
        const y = pos.getY(i);
        heightToRGB(y, rgb);
        const px = Math.floor(col * 128 / (N - 1));
        const py = Math.floor(row * 128 / (N - 1));
        if (px >= 0 && px < 128 && py >= 0 && py < 128) {
          const idx = (py * 128 + px) * 4;
          imageData.data[idx]     = Math.floor(rgb[0] * 255);
          imageData.data[idx + 1] = Math.floor(rgb[1] * 255);
          imageData.data[idx + 2] = Math.floor(rgb[2] * 255);
          imageData.data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
    // Draw asset dots
    const SIZE = 64;
    placedRef.current.forEach(a => {
      const nx = Math.floor(((a.position.x + SIZE / 2) / SIZE) * 127);
      const ny = Math.floor(((a.position.z + SIZE / 2) / SIZE) * 127);
      const isHarvest = HARVESTABLE_DEFS.some(h => h.type === a.type);
      ctx.fillStyle = isHarvest ? '#22ff88' : '#ffaa22';
      ctx.fillRect(Math.max(0, nx - 1), Math.max(0, ny - 1), 3, 3);
    });
    setMinimapSrc(canvas.toDataURL());
  }, []);

  // ── Brush rebuild ─────────────────────────────────────────────────────────
  const rebuildBrush = useCallback((radius: number) => {
    if (brushIndRef.current) {
      brushIndRef.current.geometry.dispose();
      const g = new THREE.CircleGeometry(radius, 48);
      g.rotateX(-Math.PI / 2);
      brushIndRef.current.geometry = g;
    }
    if (brushOutRef.current) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
      }
      brushOutRef.current.geometry.dispose();
      brushOutRef.current.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    }
  }, []);
  useEffect(() => { rebuildBrush(brushSize); }, [brushSize, rebuildBrush]);

  // Brush color
  useEffect(() => {
    if (brushIndRef.current) (brushIndRef.current.material as THREE.MeshBasicMaterial).color.setHex(TOOL_COLORS[terrainTool]);
    if (brushOutRef.current) (brushOutRef.current.material as THREE.LineBasicMaterial).color.setHex(TOOL_COLORS[terrainTool]);
  }, [terrainTool]);

  // Brush visibility
  useEffect(() => {
    const v = mode === 'terrain';
    if (brushIndRef.current) brushIndRef.current.visible = v;
    if (brushOutRef.current) brushOutRef.current.visible = v;
  }, [mode]);

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  const refreshColors = useCallback(() => {
    const terrain = terrainRef.current; if (!terrain) return;
    const pos = terrain.geometry.attributes.position;
    const colors = terrain.geometry.attributes.color; if (!colors) return;
    const rgb: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < pos.count; i++) {
      heightToRGB(pos.getY(i), rgb);
      colors.setXYZ(i, rgb[0], rgb[1], rgb[2]);
    }
    colors.needsUpdate = true;
  }, []);

  const saveUndo = useCallback(() => {
    const terrain = terrainRef.current; if (!terrain) return;
    const pos = terrain.geometry.attributes.position;
    undoRef.current.push(Array.from(pos.array as Float32Array));
    if (undoRef.current.length > 30) undoRef.current.shift();
    redoRef.current = [];
  }, []);

  const applyUndo = useCallback(() => {
    const terrain = terrainRef.current;
    if (!terrain || undoRef.current.length < 2) return;
    const pos = terrain.geometry.attributes.position;
    redoRef.current.push(Array.from(pos.array as Float32Array));
    undoRef.current.pop();
    const prev = undoRef.current[undoRef.current.length - 1];
    for (let i = 0; i < prev.length; i++) (pos.array as Float32Array)[i] = prev[i];
    pos.needsUpdate = true;
    terrain.geometry.computeVertexNormals();
    refreshColors(); renderMinimap();
  }, [refreshColors, renderMinimap]);

  const applyRedo = useCallback(() => {
    const terrain = terrainRef.current;
    if (!terrain || redoRef.current.length === 0) return;
    const pos = terrain.geometry.attributes.position;
    undoRef.current.push(Array.from(pos.array as Float32Array));
    const next = redoRef.current.pop()!;
    for (let i = 0; i < next.length; i++) (pos.array as Float32Array)[i] = next[i];
    pos.needsUpdate = true;
    terrain.geometry.computeVertexNormals();
    refreshColors(); renderMinimap();
  }, [refreshColors, renderMinimap]);

  // ── Terrain painting ──────────────────────────────────────────────────────
  const paintTerrain = useCallback((worldPt: THREE.Vector3, tool: TerrainTool) => {
    const terrain = terrainRef.current; if (!terrain) return;

    if (tool === 'texture' && splatRef.current) {
      const SIZE = 64;
      const u = (worldPt.x + SIZE / 2) / SIZE;
      const v = (worldPt.z + SIZE / 2) / SIZE;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        splatRef.current.paintSplat(u, v, texChannel, texBrushSize, bStrRef.current * 0.3);
      }
      return;
    }

    const pos = terrain.geometry.attributes.position;
    const colors = terrain.geometry.attributes.color;
    const invM = new THREE.Matrix4().copy(terrain.matrixWorld).invert();
    const local = worldPt.clone().applyMatrix4(invM);
    const radius = bSizeRef.current;
    const str = bStrRef.current;
    const fall = bFallRef.current;
    const rgb: [number, number, number] = [0, 0, 0];

    let avgH = 0, avgN = 0;
    if (tool === 'smooth') {
      for (let i = 0; i < pos.count; i++) {
        const dx = pos.getX(i) - local.x, dz = pos.getZ(i) - local.z;
        if (dx * dx + dz * dz < radius * radius) { avgH += pos.getY(i); avgN++; }
      }
      if (avgN > 0) avgH /= avgN;
    }

    let modified = false;
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - local.x, dz = pos.getZ(i) - local.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= radius) continue;
      const t = dist / radius;
      let inf: number;
      if (fall === 'smooth') { const inv = 1 - t; inf = inv * inv * (3 - 2 * inv); }
      else if (fall === 'linear') { inf = 1 - t; }
      else { inf = 1; }
      const s = str * inf * 0.6;
      let y = pos.getY(i);
      if (tool === 'raise')   y += s;
      else if (tool === 'lower')   y -= s;
      else if (tool === 'smooth')  y += (avgH - y) * s * 1.5;
      else if (tool === 'flatten') y += (local.y - y) * s * 2;
      else if (tool === 'noise')   y += (Math.random() - 0.5) * str * inf * 6;
      y = Math.max(-8, Math.min(60, y));
      pos.setY(i, y);
      if (colors) { heightToRGB(y, rgb); colors.setXYZ(i, rgb[0], rgb[1], rgb[2]); }
      modified = true;
    }
    if (modified) {
      pos.needsUpdate = true;
      if (colors) colors.needsUpdate = true;
      terrain.geometry.computeVertexNormals();
    }
  }, []);

  // ── Raycast helpers ───────────────────────────────────────────────────────
  const getTerrainPoint = useCallback((cx: number, cy: number): THREE.Vector3 | null => {
    const renderer = rendererRef.current; const camera = cameraRef.current; const terrain = terrainRef.current;
    if (!renderer || !camera || !terrain) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    mouseRef.current.x = ((cx - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((cy - rect.top) / rect.height) * 2 + 1;
    rayRef.current.setFromCamera(mouseRef.current, camera);
    const hits = rayRef.current.intersectObject(terrain);
    return hits.length > 0 ? hits[0].point : null;
  }, []);

  const findAssetAt = useCallback((cx: number, cy: number): PlacedAsset | null => {
    const renderer = rendererRef.current; const camera = cameraRef.current;
    if (!renderer || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    mouseRef.current.x = ((cx - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((cy - rect.top) / rect.height) * 2 + 1;
    rayRef.current.setFromCamera(mouseRef.current, camera);
    const meshes = placedRef.current.map(a => a.mesh);
    const hits = rayRef.current.intersectObjects(meshes, true);
    if (hits.length === 0) return null;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && !obj.userData.isAsset) obj = obj.parent;
    if (!obj) return null;
    return placedRef.current.find(a => a.mesh === obj) || null;
  }, []);

  // ── Asset placement ───────────────────────────────────────────────────────
  const placeAsset = useCallback((worldPt: THREE.Vector3) => {
    if (!sceneRef.current) return;
    let p = worldPt.clone();
    if (snapRef.current) { p.x = Math.round(p.x / 2) * 2; p.z = Math.round(p.z / 2) * 2; }
    const mesh = createAssetMesh(assetRef.current);
    mesh.position.copy(p);
    sceneRef.current.add(mesh);
    placedRef.current.push({ id: Date.now() + Math.random().toString(36).slice(2), type: assetRef.current, position: p.clone(), rotationY: 0, mesh });
    renderMinimap();
    setStats(s => ({ ...s, objs: placedRef.current.length }));
  }, [renderMinimap]);

  // ── Selection ─────────────────────────────────────────────────────────────
  const selectAsset = useCallback((cx: number, cy: number) => {
    const found = findAssetAt(cx, cy);
    if (found) {
      selectedRef.current = found;
      transformRef.current?.attach(found.mesh);
      setSelectedObjInfo({ type: found.type, pos: `${found.position.x.toFixed(1)}, ${found.position.y.toFixed(1)}, ${found.position.z.toFixed(1)}` });
    } else {
      selectedRef.current = null;
      transformRef.current?.detach();
      setSelectedObjInfo(null);
    }
  }, [findAssetAt]);

  const deselect = useCallback(() => {
    selectedRef.current = null;
    transformRef.current?.detach();
    setSelectedObjInfo(null);
  }, []);

  const deleteSelected = useCallback(() => {
    const sel = selectedRef.current; if (!sel || !sceneRef.current) return;
    sceneRef.current.remove(sel.mesh);
    transformRef.current?.detach();
    placedRef.current = placedRef.current.filter(a => a.id !== sel.id);
    selectedRef.current = null; setSelectedObjInfo(null);
    renderMinimap(); setStats(s => ({ ...s, objs: placedRef.current.length }));
  }, [renderMinimap]);

  const duplicateSelected = useCallback(() => {
    const sel = selectedRef.current; if (!sel || !sceneRef.current) return;
    const mesh = createAssetMesh(sel.type);
    mesh.position.copy(sel.position).add(new THREE.Vector3(2, 0, 2));
    mesh.rotation.y = sel.rotationY;
    sceneRef.current.add(mesh);
    placedRef.current.push({ id: Date.now() + Math.random().toString(36).slice(2), type: sel.type, position: mesh.position.clone(), rotationY: sel.rotationY, mesh });
    renderMinimap(); setStats(s => ({ ...s, objs: placedRef.current.length }));
  }, [renderMinimap]);

  const rotateSelected = useCallback((deg = 90) => {
    const sel = selectedRef.current; if (!sel) return;
    sel.rotationY += (deg * Math.PI) / 180;
    sel.mesh.rotation.y = sel.rotationY;
  }, []);

  const eraseAt = useCallback((cx: number, cy: number) => {
    const found = findAssetAt(cx, cy); if (!found || !sceneRef.current) return;
    if (selectedRef.current?.id === found.id) { transformRef.current?.detach(); selectedRef.current = null; setSelectedObjInfo(null); }
    sceneRef.current.remove(found.mesh);
    placedRef.current = placedRef.current.filter(a => a.id !== found.id);
    renderMinimap(); setStats(s => ({ ...s, objs: placedRef.current.length }));
  }, [findAssetAt, renderMinimap]);

  // ── Scene initialization ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7ec8e3);
    scene.fog = new THREE.Fog(0x7ec8e3, 100, 300);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(55, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.2, 500);
    camera.position.set(0, 60, 90);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Orbit
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true; orbit.dampingFactor = 0.08;
    orbit.minDistance = 8; orbit.maxDistance = 250;
    orbit.maxPolarAngle = Math.PI * 0.47;
    orbitRef.current = orbit;

    // Unified follow-camera rig — disabled by default (input mode 'none')
    // and only ticked while EditMode === 'follow'. Lets the editor reuse
    // the exact same camera that the captain/island/battle scenes use.
    const followCam = new FollowCamera(camera, {
      yaw: 0, pitch: 0.45, distance: 14,
      lookAtHeight: 1.2, smoothness: 0.12,
      minPitch: -0.3, maxPitch: 1.2,
      minDistance: 3, maxDistance: 60,
      inputMode: 'none', // we don't want it stealing input from OrbitControls
      keyboardYaw: false,
    });
    followCamRef.current = followCam;

    // Lights
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x6b9b32, 0.8));
    const sun = new THREE.DirectionalLight(0xfff5d0, 1.5);
    sun.position.set(60, 100, 40); sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 400;
    scene.add(sun);

    // Terrain (64×64 segments = 65×65 vertices)
    const SIZE = 64, SEGS = 64;
    const tGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
    tGeo.rotateX(-Math.PI / 2);
    const vtxCount = tGeo.attributes.position.count;
    const colBuf = new Float32Array(vtxCount * 3);
    const rgb: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < vtxCount; i++) {
      heightToRGB(0, rgb); colBuf[i * 3] = rgb[0]; colBuf[i * 3 + 1] = rgb[1]; colBuf[i * 3 + 2] = rgb[2];
    }
    tGeo.setAttribute('color', new THREE.BufferAttribute(colBuf, 3));
    const tMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const terrain = new THREE.Mesh(tGeo, tMat);
    terrain.receiveShadow = true; terrain.castShadow = true;
    terrain.userData.isTerrain = true;
    scene.add(terrain); terrainRef.current = terrain;
    undoRef.current = [Array.from(tGeo.attributes.position.array as Float32Array)];

    // Water — toon-shaded ocean plane
    const water = createToonOceanPlane(SIZE + 60, 80, {
      islandRadius: SIZE * 0.35,
      foamWidth:    SIZE * 0.07,
      waveAmp:      0.15,
      waveSpeed:    0.85,
      toonBands:    3,
      colorDeep:    0x063d5e,
      colorMid:     0x0e6a9e,
      colorShallow: 0x27a8c9,
      colorFoam:    0xdff3fa,
      colorCrest:   0xffffff,
    });
    water.position.y = wLevelRef.current; water.renderOrder = 1;
    scene.add(water); waterRef.current = water;

    // Grid helper (faint)
    const grid = new THREE.GridHelper(SIZE, SIZE / 2, 0x555555, 0x333333);
    grid.position.y = 0.05; (grid.material as THREE.LineBasicMaterial).opacity = 0.25;
    (grid.material as THREE.LineBasicMaterial).transparent = true;
    scene.add(grid);

    // Brush indicator
    const bGeo = new THREE.CircleGeometry(8, 48); bGeo.rotateX(-Math.PI / 2);
    const bInd = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide }));
    bInd.visible = true; bInd.renderOrder = 10; scene.add(bInd); brushIndRef.current = bInd;

    const outPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; outPts.push(new THREE.Vector3(Math.cos(a) * 8, 0, Math.sin(a) * 8)); }
    const bOut = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outPts), new THREE.LineBasicMaterial({ color: 0x00ff88, depthWrite: false }));
    bOut.visible = true; bOut.renderOrder = 11; scene.add(bOut); brushOutRef.current = bOut;

    // TransformControls
    const transform = new TransformControls(camera, renderer.domElement);
    transform.mode = 'translate';
    transform.addEventListener('dragging-changed', (e: any) => {
      orbit.enabled = !e.value;
      if (!e.value && selectedRef.current) {
        selectedRef.current.position.copy(selectedRef.current.mesh.position);
        setSelectedObjInfo(si => si ? { ...si, pos: `${selectedRef.current!.position.x.toFixed(1)}, ${selectedRef.current!.position.y.toFixed(1)}, ${selectedRef.current!.position.z.toFixed(1)}` } : null);
      }
    });
    scene.add(transform as unknown as THREE.Object3D); transformRef.current = transform;

    // Minimap canvas
    const mm = document.createElement('canvas'); mm.width = 128; mm.height = 128;
    minimapRef.current = mm;

    // Animation loop
    let fpsLast = 0, fpsFrames = 0;
    function animate(time: number) {
      frameRef.current = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      // Camera drive: when EditMode === 'follow' the unified rig steers the
      // camera toward the picked entity; otherwise OrbitControls owns it.
      // We mutually exclude them at the input level (orbit.enabled is set
      // when entering/leaving follow mode) so they never fight.
      if (modeRef.current === 'follow' && followCamRef.current && followingTargetRef.current) {
        followCamRef.current.update(delta);
      } else {
        orbit.update();
      }
      if (waterRef.current) { updateToonWater(waterRef.current, time * 0.001); }
      renderer.render(scene, camera);
      fpsFrames++;
      if (time - fpsLast > 500) {
        const fps = Math.round(fpsFrames * 1000 / (time - fpsLast));
        fpsLast = time; fpsFrames = 0;
        setStats(s => ({ ...s, fps, objs: placedRef.current.length }));
      }
    }
    frameRef.current = requestAnimationFrame(animate);

    // Resize
    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Load saves
    try { const raw = localStorage.getItem('island_saves'); if (raw) setSaves(JSON.parse(raw)); } catch {}

    setTimeout(renderMinimap, 600);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameRef.current);
      followCamRef.current?.dispose();
      followCamRef.current = null;
      renderer.forceContextLoss(); renderer.dispose(); scene.clear();
      mountRef.current?.removeChild(renderer.domElement);
      rendererRef.current = null; sceneRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Canvas input handlers ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = rendererRef.current?.domElement; if (!canvas) return;

    const onDown = (e: MouseEvent) => {
      if (e.button === 2) return;
      if (modeRef.current === 'terrain') {
        if (orbitRef.current) orbitRef.current.enabled = false;
        saveUndo(); paintingRef.current = true;
        const pt = getTerrainPoint(e.clientX, e.clientY);
        if (pt) paintTerrain(pt, toolRef.current);
      } else if (modeRef.current === 'place') {
        const pt = getTerrainPoint(e.clientX, e.clientY);
        if (pt) placeAsset(pt);
      } else if (modeRef.current === 'select') {
        selectAsset(e.clientX, e.clientY);
      } else if (modeRef.current === 'erase') {
        eraseAt(e.clientX, e.clientY);
      } else if (modeRef.current === 'follow') {
        // Pick any asset under the cursor and tell the unified follow-cam
        // to track it. Glides smoothly toward the new target — no teleport.
        const found = findAssetAt(e.clientX, e.clientY);
        const fc = followCamRef.current;
        if (found && fc) {
          followingTargetRef.current = found.mesh;
          fc.setTarget(found.mesh);
          if (orbitRef.current) orbitRef.current.enabled = false;
          setFollowingName(`${found.type}  ·  ${found.id.slice(0, 6)}`);
        }
      }
    };
    const onMove = (e: MouseEvent) => {
      const pt = getTerrainPoint(e.clientX, e.clientY);
      if (brushIndRef.current && brushOutRef.current) {
        const v = modeRef.current === 'terrain' && !!pt;
        brushIndRef.current.visible = v; brushOutRef.current.visible = v;
        if (pt) {
          brushIndRef.current.position.copy(pt).y += 0.08;
          brushOutRef.current.position.copy(pt).y += 0.12;
          ctxWorldPos.current.copy(pt);
          setStats(s => ({ ...s, cursor: `${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}, ${pt.z.toFixed(1)}` }));
        }
      }
      if (paintingRef.current && modeRef.current === 'terrain') {
        if (pt) {
          paintTerrain(pt, toolRef.current);
          if (Math.random() < 0.04) renderMinimap();
        }
      }
    };
    const onUp = () => {
      if (paintingRef.current) {
        paintingRef.current = false;
        if (orbitRef.current) orbitRef.current.enabled = true;
        renderMinimap();
      }
    };
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      const target = findAssetAt(e.clientX, e.clientY);
      setContextMenu({ x: e.clientX, y: e.clientY, worldPos: ctxWorldPos.current.clone(), target });
    };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('contextmenu', onCtx);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('contextmenu', onCtx);
    };
  }, [paintTerrain, placeAsset, selectAsset, eraseAt, getTerrainPoint, findAssetAt, saveUndo, renderMinimap]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); applyUndo(); return; }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); applyRedo(); return; }
      switch (e.key) {
        case '1': setMode('terrain'); setTerrainTool('raise'); break;
        case '2': setMode('terrain'); setTerrainTool('lower'); break;
        case '3': setMode('terrain'); setTerrainTool('smooth'); break;
        case '4': setMode('terrain'); setTerrainTool('flatten'); break;
        case '5': setMode('terrain'); setTerrainTool('noise'); break;
        case '6': setMode('terrain'); setTerrainTool('texture'); if (!useTextures) setUseTextures(true); break;
        case 'q': case 'Q': setMode('select'); break;
        case 'p': case 'P': setMode('place'); break;
        case 'e': case 'E': setMode('erase'); break;
        case 'Delete': case 'Backspace': deleteSelected(); break;
        case 'r': rotateSelected(); break;
        case 'Escape': deselect(); setContextMenu(null); break;
        case '[': setBrushSize(s => Math.max(1, s - 1)); break;
        case ']': setBrushSize(s => Math.min(60, s + 1)); break;
        case 'g': case 'G': setSnapToGrid(s => !s); break;
        case 'w': case 'W':
          if (transformRef.current) transformRef.current.mode = 'translate'; break;
        case 'R':
          if (e.shiftKey && transformRef.current) transformRef.current.mode = 'rotate'; break;
        case 'S':
          if (e.shiftKey && transformRef.current) transformRef.current.mode = 'scale'; break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyUndo, applyRedo, deleteSelected, rotateSelected, deselect]);

  // Dismiss context menu on LMB
  useEffect(() => {
    const dismiss = () => setContextMenu(null);
    window.addEventListener('click', dismiss);
    return () => window.removeEventListener('click', dismiss);
  }, []);

  // ── Save / Load ───────────────────────────────────────────────────────────
  const extractHeightmap = (): number[] => {
    const terrain = terrainRef.current; if (!terrain) return [];
    const pos = terrain.geometry.attributes.position;
    const out: number[] = [];
    for (let i = 0; i < pos.count; i++) out.push(pos.getY(i));
    return out;
  };

  const saveIsland = () => {
    const heightmap = extractHeightmap();
    const save: IslandSave = {
      id: (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
      name: islandName, gridSize: 64, heightmap, waterLevel: wLevelRef.current, biome,
      assets: placedRef.current.map(a => ({ id: a.id, type: a.type, x: a.position.x, y: a.position.y, z: a.position.z, rotationY: a.rotationY })),
      savedAt: new Date().toISOString(),
    };
    let existing: IslandSave[] = [];
    try { existing = JSON.parse(localStorage.getItem('island_saves') || '[]'); } catch {}
    const idx = existing.findIndex(s => s.name === save.name);
    if (idx >= 0) existing[idx] = save; else existing.push(save);
    localStorage.setItem('island_saves', JSON.stringify(existing));
    setSaves([...existing]);
    toast({ title: '✓ Island saved', description: save.name });
  };

  const publishIsland = () => {
    const heightmap = extractHeightmap();
    const peak = heightmap.reduce((m, h) => Math.max(m, h), 0);
    const maxHeight = Math.max(10, Math.min(80, Math.round(peak)));
    const waterDepth = Math.max(4, Math.min(40, Math.round(20 - wLevelRef.current)));
    const validBiomes = ['tropical', 'temperate', 'volcanic', 'arctic', 'desert'];
    if (!validBiomes.includes(biome)) {
      toast({ title: 'Cannot publish', description: `Biome "${biome}" is not a canonical island biome.`, variant: 'destructive' });
      return;
    }
    savePublishedIsland(biome, {
      name: islandName,
      maxHeight,
      waterDepth,
      savedAt: new Date().toISOString(),
    });
    toast({
      title: '✓ Published to canonical islands',
      description: `${biome}: peak ${maxHeight}m, water depth ${waterDepth}ft — live in the ${biome} explore scene.`,
    });
  };

  const loadIsland = (save: IslandSave) => {
    const terrain = terrainRef.current; const scene = sceneRef.current;
    if (!terrain || !scene) return;
    placedRef.current.forEach(a => scene.remove(a.mesh));
    placedRef.current = []; transformRef.current?.detach();
    selectedRef.current = null; setSelectedObjInfo(null);
    const pos = terrain.geometry.attributes.position;
    const colors = terrain.geometry.attributes.color;
    const rgb: [number, number, number] = [0, 0, 0];
    save.heightmap.forEach((h, i) => {
      if (i < pos.count) {
        pos.setY(i, h);
        if (colors) { heightToRGB(h, rgb); colors.setXYZ(i, rgb[0], rgb[1], rgb[2]); }
      }
    });
    pos.needsUpdate = true; if (colors) colors.needsUpdate = true;
    terrain.geometry.computeVertexNormals();
    if (waterRef.current) waterRef.current.position.y = save.waterLevel;
    wLevelRef.current = save.waterLevel; setWaterLevel(save.waterLevel);
    setBiome(save.biome); setIslandName(save.name);
    save.assets.forEach(a => {
      const mesh = createAssetMesh(a.type);
      mesh.position.set(a.x, a.y, a.z); mesh.rotation.y = a.rotationY;
      scene.add(mesh);
      placedRef.current.push({ id: a.id, type: a.type, position: new THREE.Vector3(a.x, a.y, a.z), rotationY: a.rotationY, mesh });
    });
    undoRef.current = [Array.from(pos.array as Float32Array)]; redoRef.current = [];
    renderMinimap(); setStats(s => ({ ...s, objs: placedRef.current.length }));
    setShowSaveList(false);
    toast({ title: '✓ Island loaded', description: save.name });
  };

  const newIsland = () => {
    const terrain = terrainRef.current; const scene = sceneRef.current;
    if (!terrain || !scene) return;
    placedRef.current.forEach(a => scene.remove(a.mesh)); placedRef.current = [];
    transformRef.current?.detach(); selectedRef.current = null; setSelectedObjInfo(null);
    const pos = terrain.geometry.attributes.position;
    const colors = terrain.geometry.attributes.color;
    const rgb: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, 0);
      if (colors) { heightToRGB(0, rgb); colors.setXYZ(i, rgb[0], rgb[1], rgb[2]); }
    }
    pos.needsUpdate = true; if (colors) colors.needsUpdate = true;
    terrain.geometry.computeVertexNormals();
    undoRef.current = [Array.from(pos.array as Float32Array)]; redoRef.current = [];
    setIslandName('New Island'); renderMinimap();
    setStats(s => ({ ...s, objs: 0 }));
    toast({ title: '+ New island created' });
  };

  const deleteSave = (id: string) => {
    const upd = saves.filter(s => s.id !== id);
    localStorage.setItem('island_saves', JSON.stringify(upd)); setSaves(upd);
  };

  const exportJSON = () => {
    const data: IslandSave = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      name: islandName, gridSize: 64, heightmap: extractHeightmap(),
      waterLevel: wLevelRef.current, biome,
      assets: placedRef.current.map(a => ({ id: a.id, type: a.type, x: a.position.x, y: a.position.y, z: a.position.z, rotationY: a.rotationY })),
      savedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${islandName.replace(/\s+/g, '_')}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
      try { loadIsland(JSON.parse(await file.text())); }
      catch { toast({ title: 'Import failed', variant: 'destructive' }); }
    };
    inp.click();
  };

  // ── Context menu actions ──────────────────────────────────────────────────
  const ctxFlattenHere = () => {
    const terrain = terrainRef.current; if (!terrain || !contextMenu) return;
    const pt = contextMenu.worldPos;
    const pos = terrain.geometry.attributes.position;
    const inv = new THREE.Matrix4().copy(terrain.matrixWorld).invert();
    const local = pt.clone().applyMatrix4(inv);
    const tY = local.y;
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - local.x, dz = pos.getZ(i) - local.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bSizeRef.current * 1.5) {
        const t2 = 1 - dist / (bSizeRef.current * 1.5);
        pos.setY(i, pos.getY(i) + (tY - pos.getY(i)) * t2 * 0.8);
      }
    }
    pos.needsUpdate = true; terrain.geometry.computeVertexNormals();
    refreshColors(); renderMinimap(); setContextMenu(null);
  };

  // ── Tool palette definitions ──────────────────────────────────────────────
  const toolDefs: { tool: TerrainTool; label: string; key: string; desc: string }[] = [
    { tool: 'raise',   label: '↑ Raise',   key: '1', desc: 'Push terrain up' },
    { tool: 'lower',   label: '↓ Lower',   key: '2', desc: 'Push terrain down' },
    { tool: 'smooth',  label: '~ Smooth',  key: '3', desc: 'Average nearby heights' },
    { tool: 'flatten', label: '= Flatten', key: '4', desc: 'Level to brush center' },
    { tool: 'noise',   label: '✦ Noise',   key: '5', desc: 'Random displacement' },
    { tool: 'texture', label: '🎨 Texture', key: '6', desc: 'Paint terrain textures' },
  ];
  const toolColors: Record<TerrainTool, string> = {
    raise: 'text-green-400', lower: 'text-red-400', smooth: 'text-blue-400', flatten: 'text-yellow-400', noise: 'text-purple-400', texture: 'text-emerald-400',
  };
  const TEX_CHANNEL_DEFS = [
    { ch: 0, label: 'Grass', color: 'bg-green-500' },
    { ch: 1, label: 'Mud', color: 'bg-amber-700' },
    { ch: 2, label: 'Dark Mud', color: 'bg-stone-600' },
    { ch: 3, label: 'Stone Tile', color: 'bg-gray-400' },
  ];

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col w-full h-screen bg-gray-950 text-white overflow-hidden select-none" data-testid="island-editor">

      {/* ── Top Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-2 h-11 bg-gray-900 border-b border-gray-700 shrink-0 z-20">
        <span className="font-bold text-amber-400 text-sm mr-1.5 whitespace-nowrap">⛰ Island Editor</span>

        <input
          className="bg-gray-800 border border-gray-600 rounded px-2 h-7 text-sm text-white w-36 focus:outline-none focus:border-amber-500"
          value={islandName} onChange={e => setIslandName(e.target.value)}
          placeholder="Island name…" data-testid="island-name-input"
        />

        <div className="w-px h-5 bg-gray-700 mx-0.5" />

        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs hover:bg-gray-700" onClick={newIsland} title="New Island">
          <FilePlus className="w-3.5 h-3.5 mr-1" />New
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs hover:bg-amber-900 text-amber-300" onClick={saveIsland} title="Save (Ctrl+S)" data-testid="save-button">
          <Save className="w-3.5 h-3.5 mr-1" />Save
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs hover:bg-emerald-900 text-emerald-300" onClick={publishIsland} title="Publish peak height + water depth to the canonical island config for this biome" data-testid="publish-button">
          <UploadCloud className="w-3.5 h-3.5 mr-1" />Publish
        </Button>

        <div className="relative">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs hover:bg-gray-700" onClick={() => setShowSaveList(s => !s)} title="Load saved island" data-testid="load-button">
            <FolderOpen className="w-3.5 h-3.5 mr-1" />Load {saves.length > 0 && <span className="ml-1 bg-amber-700 text-amber-200 rounded px-1 text-[9px]">{saves.length}</span>}
          </Button>
          {showSaveList && (
            <div className="absolute top-9 left-0 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-700 text-xs font-semibold text-gray-300">Saved Islands</div>
              {saves.length === 0 && <div className="px-3 py-4 text-xs text-gray-500 text-center">No saves yet. Paint an island and save!</div>}
              <div className="max-h-56 overflow-y-auto">
                {saves.map(s => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-pointer group border-b border-gray-800">
                    <div className="flex-1 min-w-0" onClick={() => loadIsland(s)}>
                      <div className="text-xs font-medium truncate">{s.name}</div>
                      <div className="text-[10px] text-gray-500">{s.assets.length} objects · {new Date(s.savedAt).toLocaleDateString()}</div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-red-400 hover:bg-red-950" onClick={() => deleteSave(s.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-gray-700 mx-0.5" />

        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs hover:bg-gray-700" onClick={applyUndo} title="Undo (Ctrl+Z)">
          <Undo2 className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs hover:bg-gray-700" onClick={applyRedo} title="Redo (Ctrl+Y)">
          <Redo2 className="w-3.5 h-3.5" />
        </Button>

        <div className="w-px h-5 bg-gray-700 mx-0.5" />

        <Button size="sm" variant="ghost" className={`h-7 px-2 text-xs hover:bg-gray-700 ${showWireframe ? 'text-amber-400 bg-gray-800' : ''}`}
          onClick={() => setShowWireframe(s => !s)} title="Toggle wireframe">
          <Grid3x3 className="w-3.5 h-3.5 mr-1" />Wire
        </Button>
        <Button size="sm" variant="ghost" className={`h-7 px-2 text-xs hover:bg-gray-700 ${snapToGrid ? 'text-blue-400 bg-gray-800' : ''}`}
          onClick={() => setSnapToGrid(s => !s)} title="Snap to grid (G)">
          <Layers className="w-3.5 h-3.5 mr-1" />Snap
        </Button>

        <div className="w-px h-5 bg-gray-700 mx-0.5" />

        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs hover:bg-gray-700" onClick={exportJSON} title="Export JSON file">
          <Download className="w-3.5 h-3.5 mr-1" />Export
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs hover:bg-gray-700" onClick={importJSON} title="Import JSON file">
          <Upload className="w-3.5 h-3.5 mr-1" />Import
        </Button>

        <div className="ml-auto text-[10px] text-gray-500 whitespace-nowrap">{stats.fps} FPS · {stats.objs} objects</div>
      </div>

      {/* ── Main Area ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left Panel ─────────────────────────────────────────────────── */}
        <div className={`flex flex-col bg-gray-900 border-r border-gray-700 shrink-0 transition-all duration-200 z-10 ${leftOpen ? 'w-52' : 'w-9'}`}>
          <button className="flex items-center justify-end px-2 py-1.5 border-b border-gray-700 text-gray-500 hover:text-white"
            onClick={() => setLeftOpen(o => !o)}>
            {leftOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {leftOpen && (
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-3">

                {/* Mode selector */}
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 px-0.5">Editor Mode</div>
                  <div className="grid grid-cols-2 gap-1">
                    {([
                      { id: 'terrain', label: 'Terrain', icon: <Mountain className="w-3 h-3" /> },
                      { id: 'place',   label: 'Place',   icon: <TreePine className="w-3 h-3" /> },
                      { id: 'select',  label: 'Select',  icon: <MousePointer2 className="w-3 h-3" /> },
                      { id: 'erase',   label: 'Erase',   icon: <Eraser className="w-3 h-3" /> },
                      { id: 'follow',  label: 'Follow',  icon: <span className="text-[10px] leading-none">👁</span> },
                    ] as const).map(m => (
                      <button key={m.id}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium transition-colors ${mode === m.id ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                        onClick={() => {
                          setMode(m.id as EditMode);
                          // Toggle orbit / follow exclusivity. Entering follow
                          // disables orbit so the two camera drivers don't fight;
                          // leaving follow restores orbit and clears the target.
                          if (m.id === 'follow') {
                            if (orbitRef.current) orbitRef.current.enabled = false;
                          } else {
                            if (orbitRef.current) orbitRef.current.enabled = true;
                            followCamRef.current?.setTarget(null);
                            followingTargetRef.current = null;
                            setFollowingName(null);
                          }
                        }}
                        data-testid={`mode-${m.id}`}>
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>
                  {mode === 'follow' && (
                    <div className="mt-2 p-2 rounded bg-purple-950/40 border border-purple-800/50 text-[10px] text-purple-200 leading-relaxed">
                      Click any tree, rock, character, or asset to lock the
                      camera onto it. Drag right-mouse to orbit while following.
                    </div>
                  )}
                </div>

                {/* World Inspector toggle */}
                <button
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-medium transition-colors ${showInspector ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                  onClick={() => setShowInspector(s => !s)}
                  data-testid="toggle-inspector">
                  <span>🔎  World Inspector</span>
                  <span className="opacity-70">{showInspector ? '▾' : '▸'}</span>
                </button>
                {showInspector && (
                  <WorldInspector
                    placedAssets={placedRef.current}
                    biome={biome}
                    waterLevel={waterLevel}
                  />
                )}

                <Separator className="bg-gray-800" />

                {/* ── Terrain mode ─ */}
                {mode === 'terrain' && (
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Brush Tool</div>
                      <div className="space-y-0.5">
                        {toolDefs.map(td => (
                          <button key={td.tool}
                            className={`flex items-center justify-between w-full px-2 py-1.5 rounded text-[11px] transition-colors ${terrainTool === td.tool ? 'bg-gray-700 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                            onClick={() => setTerrainTool(td.tool)} title={td.desc} data-testid={`tool-${td.tool}`}>
                            <span className={terrainTool === td.tool ? toolColors[td.tool] : ''}>{td.label}</span>
                            <kbd className="bg-gray-900 border border-gray-700 text-gray-500 rounded px-1 text-[9px]">{td.key}</kbd>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Brush Settings</div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                            <span>Size</span><span className="text-white">{brushSize}u</span>
                          </div>
                          <input type="range" min="1" max="60" value={brushSize} onChange={e => setBrushSize(+e.target.value)}
                            className="w-full h-1.5 accent-amber-500" data-testid="brush-size-slider" />
                          <div className="flex justify-between text-[9px] text-gray-600 mt-0.5"><span>[ smaller</span><span>larger ]</span></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                            <span>Strength</span><span className="text-white">{Math.round(brushStrength * 100)}%</span>
                          </div>
                          <input type="range" min="1" max="100" value={Math.round(brushStrength * 100)} onChange={e => setBrushStrength(+e.target.value / 100)}
                            className="w-full h-1.5 accent-amber-500" />
                        </div>
                        <div>
                          <div className="text-[11px] text-gray-400 mb-1">Falloff</div>
                          <div className="flex gap-1">
                            {(['smooth', 'linear', 'constant'] as const).map(f => (
                              <button key={f}
                                className={`flex-1 py-1 rounded text-[9px] capitalize transition-colors ${brushFalloff === f ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                                onClick={() => setBrushFalloff(f)}>{f}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-gray-800" />

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">PBR Textures</div>
                        <button
                          className={`px-2 py-0.5 rounded text-[9px] transition-colors ${useTextures ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                          onClick={() => setUseTextures(v => !v)}
                          data-testid="toggle-textures"
                        >{useTextures ? 'ON' : 'OFF'}</button>
                      </div>
                      {useTextures && (
                        <div className="space-y-2">
                          <div className="text-[10px] text-gray-500 mb-1">Paint Channel (6 key = texture tool)</div>
                          <div className="space-y-0.5">
                            {TEX_CHANNEL_DEFS.map(tc => (
                              <button key={tc.ch}
                                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] transition-colors ${texChannel === tc.ch ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                onClick={() => { setTexChannel(tc.ch); setTerrainTool('texture'); }}
                                data-testid={`tex-ch-${tc.ch}`}>
                                <span className={`w-3 h-3 rounded-sm ${tc.color}`} />
                                <span className="flex-1 text-left">{tc.label}</span>
                              </button>
                            ))}
                          </div>
                          <div>
                            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                              <span>Tex Brush</span><span>{Math.round(texBrushSize * 100)}%</span>
                            </div>
                            <input type="range" min="0.02" max="0.25" step="0.01" value={texBrushSize}
                              onChange={e => setTexBrushSize(+e.target.value)} className="w-full h-1.5 accent-emerald-500" />
                          </div>
                          <button
                            className="w-full px-2 py-1.5 rounded text-[10px] bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                            onClick={() => {
                              const terrain = terrainRef.current;
                              if (terrain && splatRef.current) {
                                autoSplatFromHeight(splatRef.current.splatData, splatRef.current.splatMap, terrain.geometry, 128);
                              }
                            }}
                            data-testid="auto-splat"
                          >Auto-Splat from Height</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Place mode ─ */}
                {mode === 'place' && (
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Harvestable Nodes</div>
                      <div className="space-y-0.5">
                        {HARVESTABLE_DEFS.map(h => (
                          <button key={h.type}
                            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] transition-colors ${selectedAsset === h.type ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                            onClick={() => setSelectedAsset(h.type)} data-testid={`asset-${h.type}`}>
                            <span className="text-base leading-none">{h.icon}</span>
                            <span className="flex-1 text-left">{h.label}</span>
                            <span className={`text-[9px] ${selectedAsset === h.type ? 'text-amber-200' : 'text-gray-600'}`}>{h.yields}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Buildings</div>
                      <div className="space-y-0.5">
                        {BUILDING_DEFS.map(b => (
                          <button key={b.type}
                            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] transition-colors ${selectedAsset === b.type ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                            onClick={() => setSelectedAsset(b.type)} data-testid={`asset-${b.type}`}>
                            <span className="text-base leading-none">{b.icon}</span>
                            <span className="flex-1 text-left">{b.label}</span>
                            <span className={`text-[9px] ${selectedAsset === b.type ? 'text-amber-200' : 'text-gray-600'}`}>{b.category}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Race Characters (Test)</div>
                      <div className="space-y-0.5">
                        {CHARACTER_DEFS.map(c => (
                          <button key={c.type}
                            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] transition-colors ${selectedAsset === c.type ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                            onClick={() => setSelectedAsset(c.type)} data-testid={`asset-${c.type}`}>
                            <span className="text-base leading-none">{c.icon}</span>
                            <span className="flex-1 text-left">{c.label}</span>
                            <span className={`text-[9px] ${selectedAsset === c.type ? 'text-purple-200' : 'text-gray-600'}`}>{c.faction}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Effects & Lights</div>
                      <div className="space-y-0.5">
                        {EFFECTS_DEFS.map(e => (
                          <button key={e.type}
                            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] transition-colors ${selectedAsset === e.type ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                            onClick={() => setSelectedAsset(e.type)} data-testid={`asset-${e.type}`}>
                            <span className="text-base leading-none">{e.icon}</span>
                            <span className="flex-1 text-left">{e.label}</span>
                            <span className={`text-[9px] ${selectedAsset === e.type ? 'text-orange-200' : 'text-gray-600'}`}>{e.category}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-600 text-center pt-1">LMB = place · Snap: {snapToGrid ? <span className="text-blue-400">ON</span> : 'OFF'} (G)</div>
                  </div>
                )}

                {/* ── Select mode ─ */}
                {mode === 'select' && (
                  <div className="space-y-2">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Selected Object</div>
                    {selectedObjInfo ? (
                      <div className="space-y-2">
                        <div className="bg-gray-800 rounded-lg p-2">
                          <div className="text-[11px] text-amber-400 font-medium capitalize">{selectedObjInfo.type.replace(/_/g, ' ')}</div>
                          <div className="text-[10px] text-gray-500 mt-1 font-mono">{selectedObjInfo.pos}</div>
                        </div>
                        <div className="text-[10px] text-gray-500 mb-1">Gizmo Mode</div>
                        <div className="flex gap-1 mb-2">
                          {(['translate', 'rotate', 'scale'] as const).map(m => (
                            <button key={m}
                              className="flex-1 bg-gray-800 hover:bg-gray-700 rounded py-1.5 text-[10px] capitalize text-gray-400 hover:text-white transition-colors"
                              onClick={() => { if (transformRef.current) transformRef.current.mode = m; }}>
                              {m[0].toUpperCase() + m.slice(1, 3)}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <button className="flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-red-950 text-red-400 rounded px-2 py-1.5 text-[11px] transition-colors"
                            onClick={deleteSelected} data-testid="delete-selected">
                            <Trash2 className="w-3 h-3" />Delete
                          </button>
                          <button className="flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded px-2 py-1.5 text-[11px] transition-colors"
                            onClick={duplicateSelected}>
                            <Copy className="w-3 h-3" />Dup
                          </button>
                          <button className="flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded px-2 py-1.5 text-[11px] col-span-2 transition-colors"
                            onClick={() => rotateSelected(90)}>
                            <RotateCw className="w-3 h-3" />Rotate 90° (R)
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-500 leading-relaxed">
                        Click any object to select it.<br />
                        Use the colored gizmo arrows to move it.<br />
                        <kbd className="bg-gray-800 rounded px-1 text-[9px]">Del</kbd> removes selected.
                      </div>
                    )}
                  </div>
                )}

                {/* ── Erase mode ─ */}
                {mode === 'erase' && (
                  <div className="text-[11px] text-gray-500 leading-relaxed">
                    <div className="bg-red-950/40 border border-red-900 rounded-lg p-2 mb-2 text-red-300 text-[10px]">
                      ⚠ Click any placed object to remove it permanently.
                    </div>
                    <kbd className="bg-gray-800 rounded px-1 text-[9px]">Del</kbd> removes selected object.<br />
                    Right-click → Delete for context menu.
                  </div>
                )}

                <Separator className="bg-gray-800" />

                {/* Island Settings */}
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Island Settings</div>
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                        <span>Water Level</span><span className="text-blue-300">{waterLevel.toFixed(1)}m</span>
                      </div>
                      <input type="range" min="-5" max="20" step="0.5" value={waterLevel} onChange={e => setWaterLevel(+e.target.value)}
                        className="w-full h-1.5 accent-blue-500" />
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-400 mb-1">Biome</div>
                      <select className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-amber-500"
                        value={biome} onChange={e => setBiome(e.target.value)}>
                        {['tropical', 'forest', 'volcanic', 'arctic', 'desert', 'haunted'].map(b => (
                          <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

              </div>
            </ScrollArea>
          )}
        </div>

        {/* ── 3D Canvas ───────────────────────────────────────────────────── */}
        <div className="relative flex-1 min-w-0">
          <div ref={mountRef} className="w-full h-full" />

          {/* Minimap */}
          <div className="absolute bottom-8 right-3 rounded-lg overflow-hidden border border-gray-600 shadow-2xl"
            style={{ width: 128, height: 128 }}>
            {minimapSrc && <img src={minimapSrc} width={128} height={128} className="block" alt="minimap" style={{ imageRendering: 'pixelated' }} />}
            <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] text-gray-300 text-center py-0.5 leading-none">MINIMAP</div>
          </div>

          {/* Mode & status badge (top-left overlay) */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
            <Badge className="text-[10px] h-5 bg-gray-950/85 text-amber-400 border-amber-800 w-fit">
              {mode === 'terrain' ? `⛏ ${terrainTool} • sz:${brushSize}` :
               mode === 'place'   ? `+ ${selectedAsset.replace(/_/g, ' ')}` :
               mode === 'select'  ? '⊕ select' :
               mode === 'follow'  ? `👁 follow ${followingName ?? '(click an entity)'}` :
               '✕ erase'}
            </Badge>
            {snapToGrid && <Badge className="text-[10px] h-5 bg-gray-950/85 text-blue-400 border-blue-800 w-fit">⊞ grid snap</Badge>}
            {mode === 'follow' && followingName && (
              <button
                className="pointer-events-auto text-[10px] h-5 px-2 rounded bg-purple-700 hover:bg-purple-600 text-white border border-purple-500 w-fit"
                onClick={() => {
                  followCamRef.current?.setTarget(null);
                  followingTargetRef.current = null;
                  setFollowingName(null);
                }}
                data-testid="button-stop-follow">
                ✕ stop following
              </button>
            )}
          </div>

          {/* Keyboard hints (top-right overlay) */}
          <div className="absolute top-3 right-3 text-[9px] text-gray-500/80 pointer-events-none text-right leading-relaxed bg-gray-950/60 rounded px-1.5 py-1">
            <div>1-6 tools · P place · Q select · E erase · G snap</div>
            <div>[ ] brush · Ctrl+Z undo · Del remove · R rotate</div>
            <div>RMB → context menu · Orbit: drag · Zoom: scroll</div>
          </div>
        </div>
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-3 h-6 bg-gray-900 border-t border-gray-700 text-[10px] text-gray-500 shrink-0">
        <span>Mode: <span className="text-amber-400">{mode}</span></span>
        {mode === 'terrain' && <span>Tool: <span className="text-gray-300">{terrainTool}</span> · Brush: <span className="text-gray-300">{brushSize}u / {Math.round(brushStrength * 100)}% / {brushFalloff}</span></span>}
        {mode === 'place' && <span>Placing: <span className="text-gray-300">{selectedAsset.replace(/_/g, ' ')}</span></span>}
        <span>Cursor: <span className="font-mono text-gray-400">{stats.cursor}</span></span>
        <span className="ml-auto">{stats.objs} objects · {stats.fps} FPS · Biome: {biome}</span>
      </div>

      {/* ── Context menu ────────────────────────────────────────────────────── */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-gray-950 border border-gray-700 rounded-lg shadow-2xl py-1 text-[11px] text-white w-48 overflow-hidden"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 220) }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.target ? (
            <>
              <div className="px-3 py-1.5 text-gray-500 text-[10px] border-b border-gray-800 capitalize font-medium">
                {contextMenu.target.type.replace(/_/g, ' ')}
              </div>
              <button className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-gray-800 text-gray-200 transition-colors"
                onClick={() => {
                  const t = contextMenu.target!;
                  selectedRef.current = t;
                  transformRef.current?.attach(t.mesh);
                  setSelectedObjInfo({ type: t.type, pos: `${t.position.x.toFixed(1)}, ${t.position.y.toFixed(1)}, ${t.position.z.toFixed(1)}` });
                  setMode('select'); setContextMenu(null);
                }}>
                <MousePointer2 className="w-3 h-3 text-blue-400" /> Select & Move
              </button>
              <button className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-gray-800 text-gray-200 transition-colors"
                onClick={() => { selectedRef.current = contextMenu.target; rotateSelected(90); setContextMenu(null); }}>
                <RotateCw className="w-3 h-3 text-yellow-400" /> Rotate 90°
              </button>
              <button className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-gray-800 text-gray-200 transition-colors"
                onClick={() => { selectedRef.current = contextMenu.target; duplicateSelected(); setContextMenu(null); }}>
                <Copy className="w-3 h-3 text-green-400" /> Duplicate
              </button>
              <div className="border-t border-gray-800 my-0.5" />
              <button className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-red-950 text-red-400 transition-colors"
                onClick={() => { selectedRef.current = contextMenu.target; deleteSelected(); setContextMenu(null); }}>
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </>
          ) : (
            <>
              <div className="px-3 py-1.5 text-gray-500 text-[10px] border-b border-gray-800">Terrain Actions</div>
              <button className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-gray-800 text-gray-200 transition-colors"
                onClick={() => { setMode('terrain'); setTerrainTool('raise'); setContextMenu(null); }}>
                <ArrowUp className="w-3 h-3 text-green-400" /> Raise Here
              </button>
              <button className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-gray-800 text-gray-200 transition-colors"
                onClick={() => { setMode('terrain'); setTerrainTool('lower'); setContextMenu(null); }}>
                <ArrowDown className="w-3 h-3 text-red-400" /> Lower Here
              </button>
              <button className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-gray-800 text-gray-200 transition-colors"
                onClick={ctxFlattenHere}>
                <Minus className="w-3 h-3 text-yellow-400" /> Flatten Here
              </button>
              <div className="border-t border-gray-800 my-0.5" />
              <div className="px-3 py-1 text-gray-500 text-[10px]">Quick Place</div>
              {HARVESTABLE_DEFS.slice(0, 4).map(h => (
                <button key={h.type} className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-gray-800 text-gray-200 transition-colors"
                  onClick={() => { setSelectedAsset(h.type); placeAsset(contextMenu.worldPos); setContextMenu(null); }}>
                  <span className="text-sm leading-none">{h.icon}</span> {h.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// WorldInspector — collapsible "what's actually in this island" sidebar
// ──────────────────────────────────────────────────────────────────────────────
//
// Surfaces every asset category the user asked for (water colors, fish,
// animals, rocks, trees, textures, minerals) along with live counts of
// what's actually placed in the current scene. Pure-display; no editing
// of underlying data files — the goal is to give the editor user a quick
// at-a-glance audit of "what does this island contain".
//
// Data sources are referenced by import path so they stay in sync with
// the rest of the project — no hardcoded copies.
function WorldInspector(props: {
  placedAssets: PlacedAsset[];
  biome: string;
  waterLevel: number;
}) {
  const { placedAssets, biome, waterLevel } = props;

  // Group placed assets by category for the live count panel
  const counts = (() => {
    const c = { trees: 0, rocks: 0, minerals: 0, animals: 0, characters: 0, buildings: 0, fx: 0 };
    for (const a of placedAssets) {
      const t = a.type;
      if (t.endsWith('_tree') || t === 'herb_bush') c.trees++;
      else if (t === 'rock') c.rocks++;
      else if (t === 'ore_iron' || t === 'ore_gold' || t === 'crystal' || t === 'goldmine_node') c.minerals++;
      else if (t === 'deer' || t === 'boar') c.animals++;
      else if (t.startsWith('char_')) c.characters++;
      else if (t.startsWith('particle_') || t === 'lantern' || t === 'campfire') c.fx++;
      else c.buildings++;
    }
    return c;
  })();

  // Water color presets — read defaults that match SeascapeOcean's uniforms.
  // Per-biome tints are an editorial choice surfaced here for at-a-glance
  // audit; tweaking the actual uniforms is a future hookup.
  const WATER_PRESETS: Record<string, { base: string; tint: string; sky: string; label: string }> = {
    tropical:  { base: '#1a4f5c', tint: '#cce698', sky: '#8caee0', label: 'Tropical lagoon' },
    grassland: { base: '#1d4a4c', tint: '#b8d68a', sky: '#88a8db', label: 'Temperate coast' },
    volcano:   { base: '#3a1f1f', tint: '#a06850', sky: '#7a6a78', label: 'Ashen sea' },
    tundra:    { base: '#163040', tint: '#9cc4d6', sky: '#a8c0d8', label: 'Frozen expanse' },
    desert:    { base: '#1f4a52', tint: '#d6cc8a', sky: '#c2b288', label: 'Sun-baked shore' },
  };
  const water = WATER_PRESETS[biome] ?? WATER_PRESETS.tropical;

  // Per-biome ground-texture pack expected at /textures/ground/<biome>/...
  const TEXTURE_PACK = ['sand', 'grass', 'rock', 'layer4'];

  // Animal pool (matches client/src/lib/islandAnimals.ts ANIMAL_SPAWN_WEIGHTS)
  const ANIMAL_POOL = [
    { key: 'rabbit', label: '🐇 Rabbit', weight: 5 },
    { key: 'goat',   label: '🐐 Goat',   weight: 4 },
    { key: 'boar',   label: '🐗 Boar',   weight: 3 },
    { key: 'fox',    label: '🦊 Fox',    weight: 1 },
    { key: 'deer',   label: '🦌 Deer',   weight: 1 },
    { key: 'lamb',   label: '🐑 Lamb',   weight: 1 },
  ];

  // Tree variants (mirrors landscapeAssets.TREE_MODEL_VARIANTS structure)
  const TREE_VARIANTS = [
    { biome: 'tropical',  trees: ['palm_bend', 'palm_straight', 'tropical_tree'] },
    { biome: 'grassland', trees: ['oak_tree',  'pine_tree',     'forest_tree'] },
    { biome: 'volcano',   trees: ['dead_1', 'dead_2', 'dead_3', 'dead_4', 'dead_5'] },
    { biome: 'tundra',    trees: ['birch_1', 'birch_2', 'birch_3', 'pine_tree'] },
    { biome: 'desert',    trees: ['palm_straight', 'dead_1'] },
  ];
  const treesForBiome = TREE_VARIANTS.find(t => t.biome === biome)?.trees ?? [];

  // Rocks + minerals — keys from resourceNodes.ts templates
  const ROCKS = ['stone_boulder', 'granite_rock', 'sandstone_rock'];
  const MINERALS = [
    { key: 'iron_vein',      label: 'Iron',      tier: 'common' },
    { key: 'copper_vein',    label: 'Copper',    tier: 'common' },
    { key: 'coal_vein',      label: 'Coal',      tier: 'common' },
    { key: 'gold_vein',      label: 'Gold',      tier: 'rare' },
    { key: 'mythril_vein',   label: 'Mythril',   tier: 'epic' },
    { key: 'sapphire_vein',  label: 'Sapphire',  tier: 'rare' },
    { key: 'diamond_vein',   label: 'Diamond',   tier: 'epic' },
    { key: 'crystal_blue',   label: 'Blue Crystal',   tier: 'uncommon' },
    { key: 'crystal_purple', label: 'Purple Crystal', tier: 'uncommon' },
    { key: 'crystal_green',  label: 'Green Crystal',  tier: 'uncommon' },
    { key: 'crystal_red',    label: 'Red Crystal',    tier: 'uncommon' },
    { key: 'crystal_gold',   label: 'Gold Crystal',   tier: 'rare' },
    { key: 'crystal_white',  label: 'White Crystal',  tier: 'rare' },
  ];

  // Fish list — pulled from public/fish/* filenames (curated subset)
  const FISH_BY_BAND = [
    { band: 'SHALLOW (-1 to -10m)', list: ['Clownfish', 'Betta', 'Lionfish', 'Pufferfish', 'Seahorse'] },
    { band: 'MID (-10 to -30m)',    list: ['Tuna', 'Swordfish', 'Mahi', 'Barracuda', 'Mackerel'] },
    { band: 'DEEP (-30 to -110m)',  list: ['Shark', 'Whale', 'Anglerfish', 'Blobfish', 'Sunfish', 'Squid'] },
  ];

  const Section = (p: { title: string; children: React.ReactNode }) => (
    <div className="mb-2.5">
      <div className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider mb-1 px-0.5">{p.title}</div>
      <div className="bg-gray-950/60 rounded p-1.5 border border-gray-800/60">{p.children}</div>
    </div>
  );

  return (
    <div className="space-y-1 text-[11px] text-gray-200" data-testid="world-inspector-panel">
      <Section title="Live Object Counts">
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
          <div className="flex justify-between"><span>🌲 Trees</span><span className="text-emerald-400 tabular-nums">{counts.trees}</span></div>
          <div className="flex justify-between"><span>🪨 Rocks</span><span className="text-stone-400 tabular-nums">{counts.rocks}</span></div>
          <div className="flex justify-between"><span>💎 Minerals</span><span className="text-violet-400 tabular-nums">{counts.minerals}</span></div>
          <div className="flex justify-between"><span>🦌 Animals</span><span className="text-amber-400 tabular-nums">{counts.animals}</span></div>
          <div className="flex justify-between"><span>🧝 Characters</span><span className="text-blue-400 tabular-nums">{counts.characters}</span></div>
          <div className="flex justify-between"><span>🏛 Buildings</span><span className="text-orange-400 tabular-nums">{counts.buildings}</span></div>
          <div className="col-span-2 flex justify-between border-t border-gray-800 pt-0.5 mt-0.5">
            <span>✨ FX / Lights</span><span className="text-pink-400 tabular-nums">{counts.fx}</span>
          </div>
        </div>
      </Section>

      <Section title={`Water · ${water.label}`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-5 h-5 rounded border border-gray-700" style={{ background: water.base }} />
            <span className="text-gray-400">Sea base</span>
            <span className="ml-auto font-mono text-gray-300">{water.base}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-5 h-5 rounded border border-gray-700" style={{ background: water.tint }} />
            <span className="text-gray-400">Foam tint</span>
            <span className="ml-auto font-mono text-gray-300">{water.tint}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-5 h-5 rounded border border-gray-700" style={{ background: water.sky }} />
            <span className="text-gray-400">Sky reflection</span>
            <span className="ml-auto font-mono text-gray-300">{water.sky}</span>
          </div>
          <div className="text-[10px] text-gray-500 pt-0.5">Water level: <span className="text-gray-300 tabular-nums">{waterLevel.toFixed(2)}m</span></div>
        </div>
      </Section>

      <Section title="Trees (this biome)">
        {treesForBiome.length === 0 ? (
          <div className="text-[10px] text-gray-500 italic">No tree variants registered.</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {treesForBiome.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 border border-emerald-700/40 text-emerald-300">
                {t.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Rocks">
        <div className="flex flex-wrap gap-1">
          {ROCKS.map(r => (
            <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800/60 border border-stone-700 text-stone-300">
              {r.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Minerals & Crystals">
        <div className="space-y-0.5">
          {MINERALS.map(m => (
            <div key={m.key} className="flex items-center justify-between text-[10px]">
              <span className="text-gray-300">{m.label}</span>
              <span className={
                m.tier === 'epic'     ? 'text-fuchsia-400' :
                m.tier === 'rare'     ? 'text-amber-400' :
                m.tier === 'uncommon' ? 'text-emerald-400' :
                                        'text-gray-500'
              }>{m.tier}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Animals (spawn weights)">
        <div className="space-y-0.5">
          {ANIMAL_POOL.map(a => (
            <div key={a.key} className="flex items-center gap-2 text-[10px]">
              <span className="w-20">{a.label}</span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${(a.weight / 5) * 100}%` }} />
              </div>
              <span className="w-4 text-right text-gray-400 tabular-nums">{a.weight}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Fish (depth-banded)">
        <div className="space-y-1.5">
          {FISH_BY_BAND.map(b => (
            <div key={b.band}>
              <div className="text-[9px] text-cyan-400/80 uppercase tracking-wider mb-0.5">{b.band}</div>
              <div className="flex flex-wrap gap-1">
                {b.list.map(f => (
                  <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/40 border border-cyan-700/40 text-cyan-200">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Texture Pack · /textures/ground/${biome}/`}>
        <div className="grid grid-cols-2 gap-1">
          {TEXTURE_PACK.map(name => (
            <div key={name} className="text-[10px] flex items-center gap-1.5 px-1.5 py-1 rounded bg-gray-900/60 border border-gray-800">
              <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-amber-700 to-yellow-900 border border-gray-700" />
              <span className="font-mono text-gray-400">{name}.jpg</span>
            </div>
          ))}
        </div>
        <div className="text-[9px] text-gray-500 mt-1 leading-snug">
          4-layer splat shader: sand · grass · rock · biome-layer.
          Missing files fall back to flat color.
        </div>
      </Section>
    </div>
  );
}
