import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { SelectionManager, TransformGizmo, Selectable, SelectionState, DragBoxState, GizmoMode, TransformState } from '@/lib/rtsControls';

export type InputMode = 'select' | 'build' | 'command';

export interface RTSControlsOptions {
  camera: THREE.Camera | null;
  scene: THREE.Scene | null;
  container: HTMLElement | null;
  enabled?: boolean;
}

export function useRTSControls(options: RTSControlsOptions) {
  const { camera, scene, container, enabled = true } = options;
  
  const selectionManagerRef = useRef<SelectionManager | null>(null);
  const gizmoRef = useRef<TransformGizmo | null>(null);
  
  const [inputMode, setInputMode] = useState<InputMode>('select');
  const [selection, setSelection] = useState<SelectionState>({ selected: [], hovered: null });
  const [dragBox, setDragBox] = useState<DragBoxState>({ active: false, startX: 0, startY: 0, endX: 0, endY: 0 });
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate');
  const [transformState, setTransformState] = useState<TransformState | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  
  useEffect(() => {
    if (!camera || !scene || !container || !enabled) return;
    
    const selectionManager = new SelectionManager();
    selectionManager.initialize(camera, scene, container);
    selectionManagerRef.current = selectionManager;
    
    const gizmo = new TransformGizmo();
    gizmo.initialize(camera, container);
    scene.add(gizmo.getGizmoObject());
    gizmoRef.current = gizmo;
    
    const unsubSelection = selectionManager.onSelectionChange(setSelection);
    const unsubDragBox = selectionManager.onDragBoxChange(setDragBox);
    const unsubTransform = gizmo.onTransformChange(setTransformState);
    
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (selectionManager.getSelection().length > 0) {
        setContextMenuPosition({ x: event.clientX, y: event.clientY });
      }
    };
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        selectionManager.clearSelection();
        gizmo.detach();
        setContextMenuPosition(null);
        setInputMode('select');
      }
      if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        selectionManager.selectAll();
      }
      if (event.key === 'r' && inputMode === 'build') {
        setGizmoMode(prev => prev === 'translate' ? 'rotate' : 'translate');
      }
    };
    
    container.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      unsubSelection();
      unsubDragBox();
      unsubTransform();
      container.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      
      selectionManager.dispose();
      scene.remove(gizmo.getGizmoObject());
      gizmo.dispose();
      
      selectionManagerRef.current = null;
      gizmoRef.current = null;
    };
  }, [camera, scene, container, enabled]);
  
  useEffect(() => {
    if (gizmoRef.current) {
      gizmoRef.current.setMode(inputMode === 'build' ? gizmoMode : 'none');
    }
  }, [inputMode, gizmoMode]);
  
  const registerSelectable = useCallback((selectable: Selectable) => {
    selectionManagerRef.current?.registerSelectable(selectable);
  }, []);
  
  const unregisterSelectable = useCallback((id: string) => {
    selectionManagerRef.current?.unregisterSelectable(id);
  }, []);
  
  const select = useCallback((id: string, additive = false) => {
    selectionManagerRef.current?.select(id, additive);
  }, []);
  
  const clearSelection = useCallback(() => {
    selectionManagerRef.current?.clearSelection();
  }, []);
  
  const attachGizmo = useCallback((target: THREE.Object3D) => {
    gizmoRef.current?.attach(target);
  }, []);
  
  const detachGizmo = useCallback(() => {
    gizmoRef.current?.detach();
  }, []);
  
  const closeContextMenu = useCallback(() => {
    setContextMenuPosition(null);
  }, []);
  
  const updateGizmo = useCallback(() => {
    gizmoRef.current?.update();
  }, []);
  
  return {
    inputMode,
    setInputMode,
    selection,
    dragBox,
    gizmoMode,
    setGizmoMode,
    transformState,
    contextMenuPosition,
    closeContextMenu,
    registerSelectable,
    unregisterSelectable,
    select,
    clearSelection,
    attachGizmo,
    detachGizmo,
    updateGizmo,
  };
}
