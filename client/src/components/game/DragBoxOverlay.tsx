import type { DragBoxState } from '@/lib/rtsControls';

interface DragBoxOverlayProps {
  dragBox: DragBoxState;
}

export function DragBoxOverlay({ dragBox }: DragBoxOverlayProps) {
  if (!dragBox.active) return null;
  
  const left = Math.min(dragBox.startX, dragBox.endX);
  const top = Math.min(dragBox.startY, dragBox.endY);
  const width = Math.abs(dragBox.endX - dragBox.startX);
  const height = Math.abs(dragBox.endY - dragBox.startY);
  
  return (
    <div
      className="absolute pointer-events-none border-2 border-primary bg-primary/10"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      data-testid="drag-box-overlay"
    />
  );
}
