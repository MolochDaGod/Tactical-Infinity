/**
 * Shared TransformControls session — same gizmo used by ship/island editors.
 * Select + W/E/R (G/R/S aliases) + material family apply.
 */

import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  applyFamilyToObject,
  getMaterialFamily,
  loadAlbedoFile,
  loadFamilyAlbedo,
  setObjectPbr,
  tintObject,
  type EditorMaterialFamilyId,
} from './materialFamilies';

export type EditorGizmoMode = 'translate' | 'rotate' | 'scale';

export interface EditorGizmoOpts {
  scene: THREE.Scene;
  camera: THREE.Camera;
  domElement: HTMLElement;
  orbit?: OrbitControls | null;
  pickRoots: () => THREE.Object3D[];
  onSelect?: (mesh: THREE.Object3D | null) => void;
  onMode?: (mode: EditorGizmoMode) => void;
}

function isGizmoNode(obj: THREE.Object3D | null): boolean {
  let o = obj;
  while (o) {
    if ((o as any).isTransformControls || o.name.startsWith('TransformControls')) return true;
    o = o.parent;
  }
  return false;
}

export class EditorGizmoSession {
  readonly transform: TransformControls;
  mode: EditorGizmoMode = 'translate';
  selected: THREE.Object3D | null = null;
  familyId: EditorMaterialFamilyId | null = null;
  enabled = true;

  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private dom: HTMLElement;
  private orbit?: OrbitControls | null;
  private pickRoots: () => THREE.Object3D[];
  private onSelect?: (mesh: THREE.Object3D | null) => void;
  private onModeCb?: (mode: EditorGizmoMode) => void;
  private ray = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private outline: THREE.BoxHelper | null = null;
  private helper: THREE.Object3D | null = null;
  private unsubs: Array<() => void> = [];

  constructor(opts: EditorGizmoOpts) {
    this.scene = opts.scene;
    this.camera = opts.camera;
    this.dom = opts.domElement;
    this.orbit = opts.orbit;
    this.pickRoots = opts.pickRoots;
    this.onSelect = opts.onSelect;
    this.onModeCb = opts.onMode;

    const transform = new TransformControls(this.camera, this.dom);
    transform.setMode('translate');
    transform.setSize(0.9);
    const helper =
      typeof (transform as any).getHelper === 'function'
        ? ((transform as any).getHelper() as THREE.Object3D)
        : null;
    if (helper?.isObject3D) {
      this.scene.add(helper);
      this.helper = helper;
    } else if ((transform as unknown as THREE.Object3D).isObject3D) {
      this.scene.add(transform as unknown as THREE.Object3D);
      this.helper = transform as unknown as THREE.Object3D;
    }
    transform.addEventListener('dragging-changed', (e: { value: boolean }) => {
      if (this.orbit) this.orbit.enabled = !e.value;
    });
    this.transform = transform;

    const onPointer = (ev: PointerEvent) => this.onPointerDown(ev);
    const onKey = (ev: KeyboardEvent) => this.onKey(ev);
    this.dom.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    this.unsubs.push(() => this.dom.removeEventListener('pointerdown', onPointer));
    this.unsubs.push(() => window.removeEventListener('keydown', onKey));
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.detach();
    this.transform.visible = on;
    this.transform.enabled = on;
  }

  setMode(mode: EditorGizmoMode): void {
    this.mode = mode;
    this.transform.setMode(mode);
    this.onModeCb?.(mode);
  }

  attach(obj: THREE.Object3D): void {
    this.selected = obj;
    this.transform.attach(obj);
    if (this.outline) {
      this.scene.remove(this.outline);
      this.outline.dispose();
    }
    this.outline = new THREE.BoxHelper(obj, 0xffcc44);
    this.scene.add(this.outline);
    this.onSelect?.(obj);
  }

  detach(): void {
    this.transform.detach();
    this.selected = null;
    if (this.outline) {
      this.scene.remove(this.outline);
      this.outline.dispose();
      this.outline = null;
    }
    this.onSelect?.(null);
  }

  updateOutline(): void {
    this.outline?.update();
  }

  async applyFamily(id: EditorMaterialFamilyId): Promise<number> {
    if (!this.selected) return 0;
    const family = getMaterialFamily(id);
    if (!family) return 0;
    this.familyId = id;
    const map = await loadFamilyAlbedo(family);
    const n = applyFamilyToObject(this.selected, family, map);
    this.updateOutline();
    return n;
  }

  async applyAlbedoFile(file: File): Promise<void> {
    if (!this.selected) return;
    const tex = await loadAlbedoFile(file);
    applyFamilyToObject(
      this.selected,
      getMaterialFamily(this.familyId ?? 'wood') ?? {
        id: 'wood',
        label: 'Wood',
        color: 0xffffff,
        roughness: 0.8,
        metalness: 0,
        mapKind: 'wood',
      },
      tex,
    );
    this.updateOutline();
  }

  tint(hex: string): void {
    if (!this.selected) return;
    tintObject(this.selected, hex);
    this.updateOutline();
  }

  setPbr(opts: { roughness?: number; metalness?: number; repeat?: number }): void {
    if (!this.selected) return;
    setObjectPbr(this.selected, opts);
    this.updateOutline();
  }

  dispose(): void {
    this.detach();
    for (const u of this.unsubs) u();
    this.unsubs = [];
    if (this.helper) this.scene.remove(this.helper);
    this.transform.dispose();
  }

  private onPointerDown(ev: PointerEvent): void {
    if (!this.enabled || ev.button !== 0) return;
    if (this.transform.dragging) return;
    const rect = this.dom.getBoundingClientRect();
    this.mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.mouse, this.camera);
    const roots = this.pickRoots().filter(Boolean);
    const hits = this.ray.intersectObjects(roots, true);
    for (const hit of hits) {
      if (isGizmoNode(hit.object)) continue;
      if (hit.object.userData.editorIgnore) continue;
      let o: THREE.Object3D | null = hit.object;
      while (o && !(o as THREE.Mesh).isMesh) o = o.parent;
      if (!o || o.userData.editorIgnore) continue;
      this.attach(o);
      return;
    }
  }

  private onKey(ev: KeyboardEvent): void {
    if (!this.enabled) return;
    const tag = (ev.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const k = ev.key;
    if (k === 'w' || k === 'W' || k === 'g' || k === 'G') {
      ev.preventDefault();
      this.setMode('translate');
      return;
    }
    if (k === 'e' || k === 'E' || k === 'r' || k === 'R') {
      ev.preventDefault();
      this.setMode('rotate');
      return;
    }
    if (k === 't' || k === 'T' || k === 's' || k === 'S') {
      ev.preventDefault();
      this.setMode('scale');
      return;
    }
    if (k === 'Escape') {
      this.detach();
    }
  }
}
