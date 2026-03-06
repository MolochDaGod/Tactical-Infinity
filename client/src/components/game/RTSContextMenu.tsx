import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Move, RotateCw, Trash2, Copy, Eye, Hammer, 
  Swords, Shield, Heart, Users, Package, Settings
} from 'lucide-react';
import type { Selectable } from '@/lib/rtsControls';

export interface ContextAction {
  id: string;
  label: string;
  icon: typeof Move;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
}

interface RTSContextMenuProps {
  position: { x: number; y: number };
  selection: Selectable[];
  onClose: () => void;
  onAction?: (actionId: string, selection: Selectable[]) => void;
}

const unitActions: ContextAction[] = [
  { id: 'move', label: 'Move', icon: Move, onClick: () => {} },
  { id: 'attack', label: 'Attack', icon: Swords, onClick: () => {} },
  { id: 'defend', label: 'Defend', icon: Shield, onClick: () => {} },
  { id: 'heal', label: 'Heal', icon: Heart, onClick: () => {} },
  { id: 'group', label: 'Group', icon: Users, onClick: () => {} },
];

const buildingActions: ContextAction[] = [
  { id: 'move', label: 'Move', icon: Move, onClick: () => {} },
  { id: 'rotate', label: 'Rotate', icon: RotateCw, onClick: () => {} },
  { id: 'upgrade', label: 'Upgrade', icon: Hammer, onClick: () => {} },
  { id: 'inspect', label: 'Inspect', icon: Eye, onClick: () => {} },
  { id: 'demolish', label: 'Demolish', icon: Trash2, onClick: () => {}, variant: 'destructive' },
];

const resourceActions: ContextAction[] = [
  { id: 'harvest', label: 'Harvest', icon: Package, onClick: () => {} },
  { id: 'inspect', label: 'Inspect', icon: Eye, onClick: () => {} },
];

export function RTSContextMenu({ position, selection, onClose, onAction }: RTSContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);
  
  const getActionsForSelection = (): ContextAction[] => {
    if (selection.length === 0) return [];
    
    const types = new Set(selection.map(s => s.type));
    
    if (types.size > 1) {
      return [
        { id: 'move', label: 'Move All', icon: Move, onClick: () => {} },
        { id: 'group', label: 'Group', icon: Users, onClick: () => {} },
      ];
    }
    
    const type = selection[0].type;
    switch (type) {
      case 'unit':
        return unitActions;
      case 'building':
        return buildingActions;
      case 'resource':
        return resourceActions;
      default:
        return [];
    }
  };
  
  const actions = getActionsForSelection();
  
  if (actions.length === 0) return null;
  
  const handleAction = (action: ContextAction) => {
    onAction?.(action.id, selection);
    onClose();
  };
  
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    zIndex: 9999,
  };
  
  const selectionInfo = selection.length === 1 
    ? `${selection[0].type}: ${selection[0].id.substring(0, 8)}...`
    : `${selection.length} items selected`;
  
  return (
    <Card 
      ref={menuRef}
      className="p-1 min-w-[160px] shadow-lg"
      style={menuStyle}
      data-testid="rts-context-menu"
    >
      <div className="px-2 py-1 text-xs text-muted-foreground border-b border-border mb-1">
        {selectionInfo}
      </div>
      
      <div className="flex flex-col gap-0.5">
        {actions.map((action, index) => (
          <div key={action.id}>
            {index > 0 && action.variant === 'destructive' && (
              <Separator className="my-1" />
            )}
            <Button
              variant={action.variant === 'destructive' ? 'destructive' : 'ghost'}
              size="sm"
              className="w-full justify-start gap-2 h-8"
              onClick={() => handleAction(action)}
              disabled={action.disabled}
              data-testid={`context-action-${action.id}`}
            >
              <action.icon className="w-4 h-4" />
              {action.label}
            </Button>
          </div>
        ))}
      </div>
      
      <Separator className="my-1" />
      
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 h-8 text-muted-foreground"
        onClick={onClose}
        data-testid="context-action-cancel"
      >
        <Settings className="w-4 h-4" />
        Cancel
      </Button>
    </Card>
  );
}
