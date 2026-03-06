import { Button } from "@/components/ui/button";
import { Monitor, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface RendererToggleProps {
  useWebGL: boolean;
  onToggle: (useWebGL: boolean) => void;
  className?: string;
}

export function RendererToggle({ useWebGL, onToggle, className }: RendererToggleProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant={useWebGL ? "outline" : "default"}
        size="sm"
        onClick={() => onToggle(false)}
        className="gap-1"
        data-testid="button-renderer-css"
      >
        <Monitor className="w-4 h-4" />
        CSS
      </Button>
      <Button
        variant={useWebGL ? "default" : "outline"}
        size="sm"
        onClick={() => onToggle(true)}
        className="gap-1"
        data-testid="button-renderer-webgl"
      >
        <Zap className="w-4 h-4" />
        WebGL
      </Button>
    </div>
  );
}
