/**
 * FishingTester — admin tab that exposes the fishing minigame's loot table,
 * spawn rules and biome bias so designers can balance fish drops without
 * launching the full sailing scene.
 *
 * MVP feature set:
 *  - List the fish species the project ships GLBs for.
 *  - For each species: configurable rarity, base XP, biome bias.
 *  - Live "cast" simulator that rolls 100 casts using the current weights
 *    and shows the resulting drop distribution as a histogram.
 *  - "Reset to defaults" + "Launch sailing" buttons for quick verification.
 */
import { useMemo, useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Fish, Anchor, ExternalLink, RotateCcw, UploadCloud } from "lucide-react";
import { saveFishWeights } from "@/lib/adminOverrides";
import { useToast } from "@/hooks/use-toast";

interface FishingTesterProps {
  onLaunchSailing?: () => void;
}

interface FishEntry {
  id: string;
  name: string;
  modelPath: string;
  rarity: "common" | "uncommon" | "rare" | "legendary";
  weight: number;       // relative drop weight
  baseXP: number;
  biome: "tropical" | "arctic" | "deep" | "coastal";
}

const RARITY_COLOR: Record<FishEntry["rarity"], string> = {
  common:    "#9ca3af",
  uncommon:  "#22c55e",
  rare:      "#3b82f6",
  legendary: "#f59e0b",
};

// Ids match the LIVE FishManager species names exactly so published weights map
// straight onto the real spawn path. These are the species FishManager loads
// and spawns, so weight changes here are observable in the sailing scene.
const DEFAULT_FISH: FishEntry[] = [
  { id: "Clownfish",     name: "Clownfish",     modelPath: "/fish/Clownfish.glb",      rarity: "common",    weight: 30, baseXP: 4,   biome: "coastal"  },
  { id: "BlueTang",      name: "Blue Tang",     modelPath: "/fish/Blue Tang.glb",      rarity: "common",    weight: 28, baseXP: 5,   biome: "tropical" },
  { id: "YellowTang",    name: "Yellow Tang",   modelPath: "/fish/Yellow Tang.glb",    rarity: "common",    weight: 26, baseXP: 5,   biome: "tropical" },
  { id: "Koi",           name: "Koi",           modelPath: "/fish/Koi.glb",            rarity: "uncommon",  weight: 18, baseXP: 12,  biome: "coastal"  },
  { id: "Tuna",          name: "Tuna",          modelPath: "/fish/Tuna.glb",           rarity: "uncommon",  weight: 22, baseXP: 18,  biome: "coastal"  },
  { id: "Shark",         name: "Shark",         modelPath: "/fish/Shark.glb",          rarity: "rare",      weight: 8,  baseXP: 90,  biome: "deep"     },
  { id: "Goldfish",      name: "Goldfish",      modelPath: "/fish/Goldfish.glb",       rarity: "common",    weight: 30, baseXP: 3,   biome: "coastal"  },
  { id: "Tetra",         name: "Tetra",         modelPath: "/fish/Tetra.glb",          rarity: "common",    weight: 30, baseXP: 3,   biome: "tropical" },
  { id: "ButterflyFish", name: "Butterfly Fish",modelPath: "/fish/Butterfly Fish.glb", rarity: "uncommon",  weight: 16, baseXP: 14,  biome: "tropical" },
  { id: "Piranha",       name: "Piranha",       modelPath: "/fish/Piranha.glb",        rarity: "rare",      weight: 10, baseXP: 45,  biome: "deep"     },
  { id: "Anglerfish",    name: "Anglerfish",    modelPath: "/fish/Anglerfish.glb",     rarity: "legendary", weight: 4,  baseXP: 180, biome: "deep"     },
  { id: "Lionfish",      name: "Lionfish",      modelPath: "/fish/Lionfish.glb",       rarity: "rare",      weight: 9,  baseXP: 55,  biome: "tropical" },
];

const BIOMES = ["tropical", "arctic", "deep", "coastal"] as const;

export function FishingTester({ onLaunchSailing }: FishingTesterProps) {
  const { toast } = useToast();
  const [fish, setFish]       = useState<FishEntry[]>(DEFAULT_FISH);
  const [biome, setBiome]     = useState<typeof BIOMES[number]>("tropical");
  const [casts, setCasts]     = useState<Record<string, number>>({});
  const [models, setModels]   = useState<Record<string, "ok" | "missing" | "checking">>({});

  // Verify which model files exist (HEAD requests, cheap).
  useEffect(() => {
    let cancelled = false;
    const next: Record<string, "ok" | "missing" | "checking"> = {};
    fish.forEach((f) => { next[f.id] = "checking"; });
    setModels(next);
    Promise.all(
      fish.map((f) =>
        fetch(f.modelPath, { method: "HEAD" })
          .then((r) => ({ id: f.id, ok: r.ok }))
          .catch(() => ({ id: f.id, ok: false })),
      ),
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, "ok" | "missing" | "checking"> = {};
      results.forEach((r) => { map[r.id] = r.ok ? "ok" : "missing"; });
      setModels(map);
    });
    return () => { cancelled = true; };
  }, [fish]);

  // Derived: biome-aware effective weights (×2 if it matches current biome).
  const effective = useMemo(() => {
    return fish.map((f) => ({ ...f, ew: f.weight * (f.biome === biome ? 2 : 1) }));
  }, [fish, biome]);

  const totalEW = useMemo(() => effective.reduce((s, f) => s + f.ew, 0), [effective]);

  const simulate = (n: number) => {
    const next: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const r = Math.random() * totalEW;
      let acc = 0;
      for (const f of effective) {
        acc += f.ew;
        if (r <= acc) { next[f.id] = (next[f.id] ?? 0) + 1; break; }
      }
    }
    setCasts(next);
  };

  const updateWeight = (id: string, w: number) =>
    setFish((arr) => arr.map((f) => (f.id === id ? { ...f, weight: w } : f)));

  const publishWeights = () => {
    const weights: Record<string, number> = {};
    fish.forEach((f) => { weights[f.id] = f.weight; });
    saveFishWeights(weights);
    toast({
      title: "Loot weights published",
      description: "FishManager will use these weights the next time the sailing scene spawns fish.",
    });
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-full p-4">
      {/* Fish table */}
      <Card className="col-span-7 overflow-hidden flex flex-col" data-testid="card-fishing-table">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Fish className="w-4 h-4" /> Fishing Loot Table
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Biome:</Label>
            {BIOMES.map((b) => (
              <button
                key={b}
                onClick={() => setBiome(b)}
                data-testid={`button-fishing-biome-${b}`}
                className={`text-xs px-2 py-0.5 rounded border capitalize transition-colors ${
                  biome === b
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200"
                    : "bg-card hover:bg-muted/50 border-border"
                }`}
              >{b}</button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto space-y-2">
          {effective.map((f) => {
            const pct  = totalEW > 0 ? (f.ew / totalEW) * 100 : 0;
            const drops = casts[f.id] ?? 0;
            const status = models[f.id] ?? "checking";
            return (
              <div
                key={f.id}
                className="border border-border rounded-md p-3 bg-card"
                data-testid={`fish-row-${f.id}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: RARITY_COLOR[f.rarity] }}
                    title={f.rarity}
                  />
                  <span className="font-medium flex-1">{f.name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{f.biome}</Badge>
                  <Badge
                    variant={status === "ok" ? "default" : status === "checking" ? "secondary" : "destructive"}
                    className="text-[10px]"
                  >
                    {status === "ok" ? "GLB" : status === "checking" ? "…" : "missing"}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums w-14 text-right">
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[f.weight]}
                    min={0}
                    max={100}
                    step={1}
                    className="flex-1"
                    onValueChange={(arr) => updateWeight(f.id, arr[0] ?? 0)}
                    data-testid={`slider-weight-${f.id}`}
                  />
                  <span className="text-xs font-mono w-10 tabular-nums text-right" data-testid={`text-weight-${f.id}`}>
                    {f.weight}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums w-12 text-right" data-testid={`text-drops-${f.id}`}>
                    {drops > 0 ? `${drops}×` : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Cast simulator */}
      <Card className="col-span-5 overflow-hidden flex flex-col" data-testid="card-fishing-simulator">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Anchor className="w-4 h-4" /> Cast Simulator
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Rolls a batch of casts using the current weights with a ×2 biome bonus
            for matching species. Use this to verify rarity targets before pushing
            balance changes into <code>fishManager</code>.
          </p>

          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="outline" onClick={() => simulate(10)}   data-testid="button-cast-10">
              Cast ×10
            </Button>
            <Button size="sm" variant="outline" onClick={() => simulate(100)}  data-testid="button-cast-100">
              Cast ×100
            </Button>
            <Button size="sm" variant="outline" onClick={() => simulate(1000)} data-testid="button-cast-1000">
              Cast ×1000
            </Button>
          </div>

          <div className="bg-muted/30 rounded-md p-3 space-y-1.5">
            {effective.map((f) => {
              const drops = casts[f.id] ?? 0;
              const total = Object.values(casts).reduce((s, n) => s + n, 0);
              const pct   = total > 0 ? (drops / total) * 100 : 0;
              return (
                <div key={f.id} className="text-xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <span>{f.name}</span>
                    <span className="font-mono text-muted-foreground">{drops} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${pct}%`, background: RARITY_COLOR[f.rarity] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setFish(DEFAULT_FISH); setCasts({}); }}
              data-testid="button-reset-fishing"
            >
              <RotateCcw className="w-4 h-4 mr-1" /> Reset
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={publishWeights}
              data-testid="button-publish-fishing"
            >
              <UploadCloud className="w-4 h-4 mr-1" /> Publish
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onLaunchSailing?.()}
              data-testid="button-launch-sailing-from-fishing"
            >
              <ExternalLink className="w-4 h-4 mr-1" /> Launch Sailing
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default FishingTester;
