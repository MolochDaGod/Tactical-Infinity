/**
 * ShipTester — admin tab that surfaces every ship prefab in one place so
 * designers can pick a hull, inspect its config, and either preview the
 * model or launch the sailing scene with that prefab pre-selected.
 *
 * Pure metadata browser plus model preview and a launcher button — does
 * not duplicate the Three.js scene from `OpenWaterSailing.tsx`. That keeps
 * this tab cheap to render alongside the rest of the admin hub.
 */
import { useMemo, useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Anchor, Ship as ShipIcon, ExternalLink, Eye } from "lucide-react";
import { SHIP_MODEL_PATHS, SHIP_PREFAB_CONFIGS } from "@/lib/shipPrefabs";

interface ShipTesterProps {
  onLaunchSailing?: (shipKey: string) => void;
}

export function ShipTester({ onLaunchSailing }: ShipTesterProps) {
  const shipKeys = useMemo(() => Object.keys(SHIP_MODEL_PATHS) as Array<keyof typeof SHIP_MODEL_PATHS>, []);
  const [selected, setSelected] = useState<string>(shipKeys[0] ?? "small");

  const config = SHIP_PREFAB_CONFIGS[selected];
  const modelPath = (SHIP_MODEL_PATHS as Record<string, string>)[selected];
  const previewRef = useRef<HTMLImageElement | null>(null);

  // Cheap "model exists" check — issue a HEAD and toggle a badge.
  const [modelStatus, setModelStatus] = useState<"checking" | "ok" | "missing">("checking");
  useEffect(() => {
    if (!modelPath) { setModelStatus("missing"); return; }
    setModelStatus("checking");
    let cancelled = false;
    fetch(modelPath, { method: "HEAD" })
      .then((r) => { if (!cancelled) setModelStatus(r.ok ? "ok" : "missing"); })
      .catch(() => { if (!cancelled) setModelStatus("missing"); });
    return () => { cancelled = true; };
  }, [modelPath]);

  return (
    <div className="grid grid-cols-12 gap-4 h-full p-4">
      {/* Ship list */}
      <Card className="col-span-4 overflow-hidden flex flex-col" data-testid="card-ship-list">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShipIcon className="w-4 h-4" /> Ship Prefabs
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto space-y-1">
          {shipKeys.map((key) => {
            const isSel = key === selected;
            const cfg = SHIP_PREFAB_CONFIGS[key];
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                data-testid={`button-ship-${key}`}
                className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                  isSel
                    ? "bg-amber-500/10 border-amber-500/50 text-amber-200"
                    : "bg-card hover:bg-muted/50 border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{key}</span>
                  {cfg && (
                    <Badge variant="secondary" className="text-xs">
                      {cfg.numCannons} cannons
                    </Badge>
                  )}
                </div>
                {cfg && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Mast {cfg.mastHeight.toFixed(1)}m · Sail {cfg.sailWidth.toFixed(1)}×{cfg.sailHeight.toFixed(1)}
                  </div>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Detail + actions */}
      <Card className="col-span-8 overflow-hidden flex flex-col" data-testid="card-ship-detail">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Anchor className="w-4 h-4" /> {selected}
            <Badge
              variant={modelStatus === "ok" ? "default" : modelStatus === "checking" ? "secondary" : "destructive"}
              className="text-xs ml-2"
              data-testid="badge-model-status"
            >
              {modelStatus === "ok" ? "GLB OK" : modelStatus === "checking" ? "checking…" : "missing"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Model Path</Label>
            <div className="font-mono text-xs bg-muted/40 rounded px-2 py-1 mt-1 break-all" data-testid="text-model-path">
              {modelPath || "(no model)"}
            </div>
          </div>

          {config && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Hull Scale" value={`${config.hullScale.x.toFixed(2)} × ${config.hullScale.y.toFixed(2)} × ${config.hullScale.z.toFixed(2)}`} />
              <Stat label="Cannons"    value={String(config.numCannons)} />
              <Stat label="Mast"       value={`${config.mastHeight.toFixed(1)} m (r ${config.mastRadius.toFixed(2)})`} />
              <Stat label="Sail"       value={`${config.sailWidth.toFixed(1)} × ${config.sailHeight.toFixed(1)} (${config.sailSegmentsX}×${config.sailSegmentsY} segs)`} />
              <Stat label="Hull Color" value={`#${config.hullColor.toString(16).padStart(6, "0")}`} swatch={`#${config.hullColor.toString(16).padStart(6, "0")}`} />
              <Stat label="Sail Color" value={`#${config.sailColor.toString(16).padStart(6, "0")}`} swatch={`#${config.sailColor.toString(16).padStart(6, "0")}`} />
              <Stat label="Deck Color" value={`#${config.deckColor.toString(16).padStart(6, "0")}`} swatch={`#${config.deckColor.toString(16).padStart(6, "0")}`} />
              <Stat label="Extras"     value={[config.hasFlag && "flag", config.hasCrowsNest && "crow's nest"].filter(Boolean).join(", ") || "—"} />
            </div>
          )}

          <Separator />

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => onLaunchSailing?.(selected)}
              data-testid="button-launch-sailing"
            >
              <ExternalLink className="w-4 h-4 mr-1" /> Launch Sailing Scene
            </Button>
            <Button
              size="sm"
              variant="outline"
              asChild
              data-testid="button-preview-model"
            >
              <a href={modelPath} target="_blank" rel="noreferrer">
                <Eye className="w-4 h-4 mr-1" /> Open GLB
              </a>
            </Button>
          </div>

          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="mb-1"><strong className="text-foreground">Tip:</strong> Use this tab to verify a ship prefab loads
              correctly before binding it to a quest, faction or starting roster.</p>
            <p>Tier-aware sail materials and cannon counts are pulled from <code>shipPrefabs.ts</code>;
              changes there flow into this view automatically.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="bg-muted/30 rounded px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 font-mono text-sm">
        {swatch && <span className="inline-block w-3 h-3 rounded border border-border" style={{ background: swatch }} />}
        <span data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</span>
      </div>
    </div>
  );
}

export default ShipTester;
