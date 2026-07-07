import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Move, RotateCcw, Maximize2, Upload, Save, Trash2, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type GizmoMode = 'translate' | 'rotate' | 'scale' | 'none';

export interface EditableObject {
  id: string;
  name: string;
  type: 'ship' | 'island' | 'prop' | 'imported';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  visible: boolean;
}

export interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  gizmoMode: GizmoMode;
  onGizmoModeChange: (mode: GizmoMode) => void;
  selectedObject: EditableObject | null;
  editableObjects: EditableObject[];
  onSelectObject: (id: string | null) => void;
  onImportGLB: (file: File, name: string) => Promise<{ success: boolean; error?: string }>;
  onSaveEdits: () => Promise<{ success: boolean; error?: string }>;
  onDeleteObject: (id: string) => void;
  onTransformChange: (id: string, transform: Partial<EditableObject>) => void;
  onToggleVisibility: (id: string) => void;
}

export function AdminPanel({
  isOpen,
  onClose,
  gizmoMode,
  onGizmoModeChange,
  selectedObject,
  editableObjects,
  onSelectObject,
  onImportGLB,
  onSaveEdits,
  onDeleteObject,
  onTransformChange,
  onToggleVisibility
}: AdminPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importName, setImportName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [objectsExpanded, setObjectsExpanded] = useState(true);
  const [transformExpanded, setTransformExpanded] = useState(true);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = importName.trim() || file.name.replace(/\.(glb|gltf)$/i, '');
    setIsImporting(true);
    
    try {
      const result = await onImportGLB(file, name);
      if (result.success) {
        setImportName('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } finally {
      setIsImporting(false);
    }
  }, [importName, onImportGLB]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSaveEdits();
    } finally {
      setIsSaving(false);
    }
  }, [onSaveEdits]);

  const formatNumber = (n: number) => n.toFixed(2);

  if (!isOpen) return null;

  return (
    <Card className="absolute top-20 right-4 w-80 max-h-[calc(100vh-120px)] overflow-y-auto bg-background/95 backdrop-blur-sm p-4 z-50" data-testid="panel-admin">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          <h3 className="font-semibold">Admin Panel</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-admin">
          <ChevronUp className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">Gizmo Mode</Label>
          <div className="flex gap-1">
            <Button
              variant={gizmoMode === 'translate' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onGizmoModeChange('translate')}
              data-testid="button-gizmo-translate"
              title="Move (G)"
            >
              <Move className="w-4 h-4" />
            </Button>
            <Button
              variant={gizmoMode === 'rotate' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onGizmoModeChange('rotate')}
              data-testid="button-gizmo-rotate"
              title="Rotate (R)"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant={gizmoMode === 'scale' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onGizmoModeChange('scale')}
              data-testid="button-gizmo-scale"
              title="Scale (S)"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button
              variant={gizmoMode === 'none' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onGizmoModeChange('none')}
              data-testid="button-gizmo-none"
              title="No Gizmo (Esc)"
            >
              None
            </Button>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <Label className="text-sm text-muted-foreground mb-2 block">Import GLB Model</Label>
          <div className="space-y-2">
            <Input
              placeholder="Model name (optional)"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              data-testid="input-import-name"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-import-file"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              data-testid="button-import-glb"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isImporting ? 'Importing...' : 'Choose GLB File'}
            </Button>
          </div>
        </div>

        <Collapsible open={objectsExpanded} onOpenChange={setObjectsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between" data-testid="button-toggle-objects">
              <span>Objects ({editableObjects.length})</span>
              {objectsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="max-h-40 overflow-y-auto space-y-1">
              {editableObjects.map((obj) => (
                <div
                  key={obj.id}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer ${
                    selectedObject?.id === obj.id ? 'bg-primary/20 border border-primary' : 'hover-elevate'
                  }`}
                  onClick={() => onSelectObject(obj.id)}
                  data-testid={`object-item-${obj.id}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {obj.type}
                    </Badge>
                    <span className="text-sm truncate">{obj.name}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisibility(obj.id);
                      }}
                      data-testid={`button-visibility-${obj.id}`}
                    >
                      {obj.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </Button>
                    {obj.type === 'imported' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteObject(obj.id);
                        }}
                        data-testid={`button-delete-${obj.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {editableObjects.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No editable objects
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {selectedObject && (
          <Collapsible open={transformExpanded} onOpenChange={setTransformExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between" data-testid="button-toggle-transform">
                <span>Transform: {selectedObject.name}</span>
                {transformExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Position</Label>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-red-500">X</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={formatNumber(selectedObject.position.x)}
                      onChange={(e) => onTransformChange(selectedObject.id, {
                        position: { ...selectedObject.position, x: parseFloat(e.target.value) || 0 }
                      })}
                      className="h-7 text-xs"
                      data-testid="input-pos-x"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-green-500">Y</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={formatNumber(selectedObject.position.y)}
                      onChange={(e) => onTransformChange(selectedObject.id, {
                        position: { ...selectedObject.position, y: parseFloat(e.target.value) || 0 }
                      })}
                      className="h-7 text-xs"
                      data-testid="input-pos-y"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-blue-500">Z</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={formatNumber(selectedObject.position.z)}
                      onChange={(e) => onTransformChange(selectedObject.id, {
                        position: { ...selectedObject.position, z: parseFloat(e.target.value) || 0 }
                      })}
                      className="h-7 text-xs"
                      data-testid="input-pos-z"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Rotation (degrees)</Label>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-red-500">X</span>
                    <Input
                      type="number"
                      step="1"
                      value={formatNumber(selectedObject.rotation.x * (180 / Math.PI))}
                      onChange={(e) => onTransformChange(selectedObject.id, {
                        rotation: { ...selectedObject.rotation, x: (parseFloat(e.target.value) || 0) * (Math.PI / 180) }
                      })}
                      className="h-7 text-xs"
                      data-testid="input-rot-x"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-green-500">Y</span>
                    <Input
                      type="number"
                      step="1"
                      value={formatNumber(selectedObject.rotation.y * (180 / Math.PI))}
                      onChange={(e) => onTransformChange(selectedObject.id, {
                        rotation: { ...selectedObject.rotation, y: (parseFloat(e.target.value) || 0) * (Math.PI / 180) }
                      })}
                      className="h-7 text-xs"
                      data-testid="input-rot-y"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-blue-500">Z</span>
                    <Input
                      type="number"
                      step="1"
                      value={formatNumber(selectedObject.rotation.z * (180 / Math.PI))}
                      onChange={(e) => onTransformChange(selectedObject.id, {
                        rotation: { ...selectedObject.rotation, z: (parseFloat(e.target.value) || 0) * (Math.PI / 180) }
                      })}
                      className="h-7 text-xs"
                      data-testid="input-rot-z"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Scale</Label>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-red-500">X</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={formatNumber(selectedObject.scale.x)}
                      onChange={(e) => onTransformChange(selectedObject.id, {
                        scale: { ...selectedObject.scale, x: parseFloat(e.target.value) || 1 }
                      })}
                      className="h-7 text-xs"
                      data-testid="input-scale-x"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-green-500">Y</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={formatNumber(selectedObject.scale.y)}
                      onChange={(e) => onTransformChange(selectedObject.id, {
                        scale: { ...selectedObject.scale, y: parseFloat(e.target.value) || 1 }
                      })}
                      className="h-7 text-xs"
                      data-testid="input-scale-y"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-blue-500">Z</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={formatNumber(selectedObject.scale.z)}
                      onChange={(e) => onTransformChange(selectedObject.id, {
                        scale: { ...selectedObject.scale, z: parseFloat(e.target.value) || 1 }
                      })}
                      className="h-7 text-xs"
                      data-testid="input-scale-z"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="border-t border-border pt-4">
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="button-save-edits"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save All Edits'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
