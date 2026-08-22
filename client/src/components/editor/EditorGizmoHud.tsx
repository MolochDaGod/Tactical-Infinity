/**
 * Overlay HUD for shared editor gizmo + material families.
 * Mount on dock-workshop / fleet-assets (ship/island already have their own chrome).
 */

import { useState } from 'react';
import {
  EDITOR_MATERIAL_FAMILIES,
  EDITOR_MATERIAL_GROUPS,
  countHierarchy,
  type EditorGizmoMode,
  type EditorMaterialFamilyId,
  type HierarchyNode,
} from '@/lib/editorTools';

interface Props {
  mode: EditorGizmoMode;
  selectedName: string | null;
  selectedUuid?: string | null;
  familyId: string | null;
  enabled?: boolean;
  hierarchy?: HierarchyNode[];
  onMode: (m: EditorGizmoMode) => void;
  onFamily: (id: EditorMaterialFamilyId) => void;
  onPickNode?: (uuid: string) => void;
  onTint?: (hex: string) => void;
  onRoughness?: (v: number) => void;
  onMetalness?: (v: number) => void;
  onRepeat?: (v: number) => void;
  onTextureFile?: (file: File) => void;
  onDeselect?: () => void;
}

export function SceneHierarchyPanel({
  hierarchy,
  selectedUuid,
  onPick,
}: {
  hierarchy: HierarchyNode[];
  selectedUuid?: string | null;
  onPick?: (uuid: string) => void;
}) {
  if (!hierarchy.length) return null;
  const c = countHierarchy(hierarchy);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-amber-400/80 mb-0.5">
        Hierarchy
        <span className="ml-1 text-slate-500 normal-case tracking-normal">
          {c.meshes} mesh · {c.nodes} nodes
        </span>
      </div>
      <div className="max-h-52 overflow-y-auto rounded border border-white/10 bg-black/40 py-0.5">
        {hierarchy.map((n) => (
          <TreeRow
            key={n.uuid}
            node={n}
            depth={0}
            selectedUuid={selectedUuid}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

function TreeRow({
  node,
  depth,
  selectedUuid,
  onPick,
}: {
  node: HierarchyNode;
  depth: number;
  selectedUuid?: string | null;
  onPick?: (uuid: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const selected = selectedUuid === node.uuid;
  return (
    <div>
      <div className="flex items-center gap-0.5" style={{ paddingLeft: depth * 8 }}>
        {node.childCount > 0 ? (
          <button
            type="button"
            className="w-3 shrink-0 text-[8px] text-slate-500"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <button
          type="button"
          title={node.uuid}
          onClick={() => onPick?.(node.uuid)}
          className={`flex-1 text-left truncate px-1 py-0.5 rounded ${
            selected ? 'bg-amber-800/70 text-amber-100' : 'text-slate-300 hover:bg-white/10'
          }`}
        >
          <span className="text-slate-500 mr-1">{node.kind === 'mesh' ? '◼' : '□'}</span>
          {node.name}
          {node.childCount > 0 && (
            <span className="text-slate-600 ml-1">{node.childCount}</span>
          )}
          {node.assetUuid && (
            <span className="block text-[8px] font-mono text-slate-600 truncate">{node.assetUuid}</span>
          )}
        </button>
      </div>
      {open &&
        node.children.map((c) => (
          <TreeRow
            key={c.uuid}
            node={c}
            depth={depth + 1}
            selectedUuid={selectedUuid}
            onPick={onPick}
          />
        ))}
    </div>
  );
}

const MODES: { id: EditorGizmoMode; label: string; hint: string }[] = [
  { id: 'translate', label: 'Move', hint: 'W / G' },
  { id: 'rotate', label: 'Rotate', hint: 'E / R' },
  { id: 'scale', label: 'Scale', hint: 'T / S' },
];

export default function EditorGizmoHud({
  mode,
  selectedName,
  selectedUuid,
  familyId,
  enabled = true,
  hierarchy,
  onMode,
  onFamily,
  onPickNode,
  onTint,
  onRoughness,
  onMetalness,
  onRepeat,
  onTextureFile,
  onDeselect,
}: Props) {
  if (!enabled) return null;
  return (
    <div
      className="absolute top-3 left-3 z-20 w-80 max-h-[90vh] overflow-y-auto pointer-events-auto text-[#e8dfd0] text-[11px]"
      data-testid="editor-gizmo-hud"
    >
      <div className="rounded border border-amber-800/50 bg-black/75 backdrop-blur-sm p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="uppercase tracking-widest text-amber-300/90 text-[10px]">Edit</span>
          {selectedName && onDeselect && (
            <button type="button" className="text-[10px] text-slate-400 hover:text-white" onClick={onDeselect}>
              Esc
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.hint}
              onClick={() => onMode(m.id)}
              className={`flex-1 rounded border px-1 py-1 ${
                mode === m.id ? 'border-amber-400 bg-amber-900/50' : 'border-white/15 hover:border-amber-700/40'
              }`}
              data-testid={`gizmo-${m.id}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-slate-400 truncate">
          {selectedName ? `Selected · ${selectedName}` : 'Click a mesh or a row in Hierarchy'}
        </div>
        {selectedUuid && (
          <div className="text-[8px] font-mono text-slate-600 truncate">three {selectedUuid}</div>
        )}
        {hierarchy && hierarchy.length > 0 && (
          <SceneHierarchyPanel
            hierarchy={hierarchy}
            selectedUuid={selectedUuid}
            onPick={onPickNode}
          />
        )}
        {selectedName && (
          <>
            <div className="text-[10px] uppercase tracking-wide text-amber-400/80">Textures</div>
            {EDITOR_MATERIAL_GROUPS.map((g) => (
              <div key={g.id} className="space-y-0.5">
                <div className="text-[9px] uppercase tracking-widest text-slate-500">{g.label}</div>
                <div className="flex flex-wrap gap-1">
                  {EDITOR_MATERIAL_FAMILIES.filter((f) => f.group === g.id).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      title={f.label}
                      onClick={() => onFamily(f.id)}
                      className={`w-10 h-10 rounded border overflow-hidden relative ${
                        familyId === f.id ? 'border-amber-400 ring-1 ring-amber-300' : 'border-white/20'
                      }`}
                      data-testid={`mat-${f.id}`}
                    >
                      {f.albedoPath ? (
                        <img src={f.albedoPath} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <span
                          className="absolute inset-0"
                          style={{ background: `#${f.color.toString(16).padStart(6, '0')}` }}
                        />
                      )}
                      <span className="absolute bottom-0 inset-x-0 text-[7px] leading-tight bg-black/60 text-center truncate px-0.5">
                        {f.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-1">
              {onTint && (
                <label className="flex items-center gap-1 text-slate-400">
                  Tint
                  <input
                    type="color"
                    defaultValue="#c4a574"
                    className="h-5 w-8 bg-transparent border-0 p-0 cursor-pointer"
                    onChange={(e) => onTint(e.target.value)}
                  />
                </label>
              )}
              {onTextureFile && (
                <label className="text-[10px] text-amber-200/80 cursor-pointer underline">
                  Texture file
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onTextureFile(f);
                    }}
                  />
                </label>
              )}
            </div>
            {onRoughness && (
              <label className="block text-slate-400">
                Rough
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  defaultValue={0.8}
                  className="w-full accent-amber-500"
                  onChange={(e) => onRoughness(+e.target.value)}
                />
              </label>
            )}
            {onMetalness && (
              <label className="block text-slate-400">
                Metal
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  defaultValue={0}
                  className="w-full accent-amber-500"
                  onChange={(e) => onMetalness(+e.target.value)}
                />
              </label>
            )}
            {onRepeat && (
              <label className="block text-slate-400">
                Repeat
                <input
                  type="range"
                  min={0.5}
                  max={8}
                  step={0.5}
                  defaultValue={2}
                  className="w-full accent-amber-500"
                  onChange={(e) => onRepeat(+e.target.value)}
                />
              </label>
            )}
          </>
        )}
        <p className="text-[9px] text-slate-500 leading-snug">
          W move · E rotate · T scale · Ctrl+Z undo · Ctrl+Y redo · Ctrl+Shift to terrain · Ctrl+Alt in front of camera
        </p>
      </div>
    </div>
  );
}
