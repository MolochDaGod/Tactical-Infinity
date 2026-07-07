/**
 * OceanTester — admin tab that lets designers preview wave + wind presets
 * for the open-water sailing scene without leaving the admin hub.
 *
 * Renders a small live Three.js water plane with Gerstner-style waves so the
 * effect of a preset is visible immediately. The same preset values can then
 * be flipped on in the real `OpenWaterSailing` scene via the "Launch" button.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Waves, Wind, ExternalLink, Sun, CloudRain, Snowflake } from "lucide-react";

interface OceanTesterProps {
  onLaunchSailing?: (preset: OceanPreset) => void;
}

export interface OceanPreset {
  id: string;
  name: string;
  waveHeight: number;
  waveSpeed: number;
  windStrength: number;
  windDirection: number; // radians
  weather: "calm" | "rain" | "storm" | "fog";
}

const PRESETS: OceanPreset[] = [
  { id: "calm",    name: "Doldrums",   waveHeight: 0.3, waveSpeed: 0.4, windStrength: 0.2, windDirection: 0.0,             weather: "calm" },
  { id: "fair",    name: "Fair Trade", waveHeight: 0.8, waveSpeed: 0.7, windStrength: 0.6, windDirection: Math.PI * 0.25,  weather: "calm" },
  { id: "squall",  name: "Squall",     waveHeight: 1.6, waveSpeed: 1.0, windStrength: 0.9, windDirection: Math.PI * 0.5,   weather: "rain" },
  { id: "storm",   name: "Tempest",    waveHeight: 2.8, waveSpeed: 1.5, windStrength: 1.4, windDirection: Math.PI * 0.75,  weather: "storm" },
  { id: "frozen",  name: "Polar Drift",waveHeight: 0.5, waveSpeed: 0.3, windStrength: 0.4, windDirection: Math.PI,         weather: "fog" },
];

export function OceanTester({ onLaunchSailing }: OceanTesterProps) {
  const [preset, setPreset] = useState<OceanPreset>(PRESETS[1]);
  const mountRef = useRef<HTMLDivElement | null>(null);

  // ── Tiny Three.js preview ───────────────────────────────────────────────
  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;

    const w = host.clientWidth;
    const h = host.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(preset.weather === "storm" ? 0x222a3a : preset.weather === "fog" ? 0x9aa6b8 : 0x6cb1ff);
    scene.fog = new THREE.Fog(scene.background as THREE.Color, 25, 110);

    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 500);
    camera.position.set(0, 7, 22);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    host.appendChild(renderer.domElement);

    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(20, 20, 10);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x6080a0, 0.6));

    // Water plane with custom shader for Gerstner-style waves.
    const waterGeo = new THREE.PlaneGeometry(120, 120, 96, 96);
    waterGeo.rotateX(-Math.PI / 2);

    const uniforms = {
      uTime:      { value: 0 },
      uHeight:    { value: preset.waveHeight },
      uSpeed:     { value: preset.waveSpeed },
      uWindStr:   { value: preset.windStrength },
      uWindDir:   { value: preset.windDirection },
      uColor:     { value: new THREE.Color(preset.weather === "storm" ? 0x1a3a55 : 0x2c6d99) },
      uColorTip:  { value: new THREE.Color(0xb8d8e8) },
    };

    const waterMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        uniform float uTime, uHeight, uSpeed, uWindStr, uWindDir;
        varying float vH;
        varying vec2  vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          float wd = uWindDir;
          vec2 dir = vec2(cos(wd), sin(wd));
          float t = uTime * uSpeed;
          float w1 = sin(dot(p.xz, dir) * 0.25 + t * 1.6);
          float w2 = sin(dot(p.xz, dir.yx * vec2(-1.0, 1.0)) * 0.13 + t * 1.0) * 0.7;
          float w3 = sin((p.x + p.z) * 0.4 + t * 2.4) * 0.3;
          float h = (w1 + w2 + w3) * uHeight;
          p.y += h;
          vH = h;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor, uColorTip;
        varying float vH;
        varying vec2  vUv;
        void main() {
          float t = clamp((vH + 1.0) * 0.5, 0.0, 1.0);
          vec3 col = mix(uColor, uColorTip, smoothstep(0.55, 0.95, t));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const water = new THREE.Mesh(waterGeo, waterMat);
    scene.add(water);

    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      uniforms.uTime.value = (performance.now() - t0) / 1000;
      uniforms.uHeight.value   = preset.waveHeight;
      uniforms.uSpeed.value    = preset.waveSpeed;
      uniforms.uWindStr.value  = preset.windStrength;
      uniforms.uWindDir.value  = preset.windDirection;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const W = host.clientWidth, H = host.clientHeight;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.forceContextLoss();
      renderer.dispose();
      waterGeo.dispose();
      waterMat.dispose();
      host.removeChild(renderer.domElement);
    };
    // We intentionally re-create the scene only on weather change (which alters bg/fog colours).
    // Wave/wind values are pushed in via the animation tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.weather]);

  return (
    <div className="grid grid-cols-12 gap-4 h-full p-4">
      {/* Live preview */}
      <Card className="col-span-7 overflow-hidden flex flex-col" data-testid="card-ocean-preview">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Waves className="w-4 h-4" /> Live Preview — {preset.name}
            <Badge variant="secondary" className="ml-2 capitalize">{preset.weather}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <div ref={mountRef} className="w-full h-full min-h-[320px]" data-testid="ocean-preview-canvas" />
        </CardContent>
      </Card>

      {/* Presets + sliders */}
      <Card className="col-span-5 overflow-hidden flex flex-col" data-testid="card-ocean-controls">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wind className="w-4 h-4" /> Presets &amp; Tuning
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p)}
                data-testid={`button-ocean-preset-${p.id}`}
                className={`text-left px-3 py-2 rounded-md border transition-colors ${
                  preset.id === p.id
                    ? "bg-blue-500/10 border-blue-500/50 text-blue-200"
                    : "bg-card hover:bg-muted/50 border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.name}</span>
                  {p.weather === "calm"  && <Sun        className="w-4 h-4 text-amber-300" />}
                  {p.weather === "rain"  && <CloudRain  className="w-4 h-4 text-sky-300" />}
                  {p.weather === "storm" && <CloudRain  className="w-4 h-4 text-violet-300" />}
                  {p.weather === "fog"   && <Snowflake  className="w-4 h-4 text-cyan-200" />}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  H {p.waveHeight.toFixed(1)} · W {p.windStrength.toFixed(1)}
                </div>
              </button>
            ))}
          </div>

          <Separator />

          <div className="space-y-3">
            <SliderRow label="Wave Height" value={preset.waveHeight} min={0} max={4} step={0.1}
              onChange={(v) => setPreset({ ...preset, waveHeight: v })} testid="slider-wave-height" />
            <SliderRow label="Wave Speed" value={preset.waveSpeed} min={0} max={3} step={0.1}
              onChange={(v) => setPreset({ ...preset, waveSpeed: v })} testid="slider-wave-speed" />
            <SliderRow label="Wind Strength" value={preset.windStrength} min={0} max={2} step={0.05}
              onChange={(v) => setPreset({ ...preset, windStrength: v })} testid="slider-wind-strength" />
            <SliderRow label="Wind Direction (rad)" value={preset.windDirection} min={0} max={Math.PI * 2} step={0.05}
              onChange={(v) => setPreset({ ...preset, windDirection: v })} testid="slider-wind-direction" />
          </div>

          <Separator />

          <Button
            size="sm"
            onClick={() => onLaunchSailing?.(preset)}
            className="w-full"
            data-testid="button-launch-sailing-with-preset"
          >
            <ExternalLink className="w-4 h-4 mr-2" /> Launch Sailing with this preset
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, testid }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  testid: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground" data-testid={`${testid}-value`}>{value.toFixed(2)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(arr) => onChange(arr[0] ?? 0)}
        data-testid={testid}
      />
    </div>
  );
}

export default OceanTester;
