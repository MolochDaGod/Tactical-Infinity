import { useEffect, useRef, useCallback, useState } from "react";
import * as PIXI from "pixi.js";
import type { Tile, Unit } from "@shared/schema";
import { terrainAssets, characterAssets, effectAssets } from "@/lib/assetManifest";
import { tierGlowColors, factionSpriteVariants } from "@/lib/spriteData";
import { terrainInfo } from "@/lib/gameData";

interface PixiRendererProps {
  tiles: Tile[];
  units: Unit[];
  width: number;
  height: number;
  selectedUnitId: string | null;
  highlightedTiles: { x: number; y: number }[];
  onTileClick: (x: number, y: number) => void;
  onUnitClick: (unit: Unit) => void;
}

const TILE_SIZE = 48;
const TILE_PADDING = 2;

type SpriteCache = Map<string, PIXI.Sprite | PIXI.AnimatedSprite>;

export function PixiRenderer({
  tiles,
  units,
  width,
  height,
  selectedUnitId,
  highlightedTiles,
  onTileClick,
  onUnitClick,
}: PixiRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const layersRef = useRef<{
    terrain: PIXI.Container;
    highlights: PIXI.Container;
    units: PIXI.Container;
    effects: PIXI.Container;
    ui: PIXI.Container;
  } | null>(null);
  const spriteCacheRef = useRef<SpriteCache>(new Map());
  const [isReady, setIsReady] = useState(false);

  const terrainColors: Record<string, number> = {
    grass: 0x4ade80,
    forest: 0x22c55e,
    water: 0x3b82f6,
    mountain: 0x64748b,
    sand: 0xfcd34d,
    stone: 0x9ca3af,
  };

  const createTileGraphic = useCallback((tile: Tile, x: number, y: number): PIXI.Graphics => {
    const graphics = new PIXI.Graphics();
    const color = terrainColors[tile.terrain] || 0x4ade80;
    
    graphics
      .roundRect(
        x * (TILE_SIZE + TILE_PADDING),
        y * (TILE_SIZE + TILE_PADDING),
        TILE_SIZE,
        TILE_SIZE,
        4
      )
      .fill({ color });
    
    if (tile.terrain === "water") {
      graphics
        .roundRect(
          x * (TILE_SIZE + TILE_PADDING) + 4,
          y * (TILE_SIZE + TILE_PADDING) + TILE_SIZE / 2,
          TILE_SIZE - 8,
          4,
          2
        )
        .fill({ color: 0x60a5fa, alpha: 0.5 });
    }
    
    if (tile.elevation > 0) {
      graphics
        .roundRect(
          x * (TILE_SIZE + TILE_PADDING),
          y * (TILE_SIZE + TILE_PADDING),
          TILE_SIZE,
          TILE_SIZE,
          4
        )
        .fill({ color: 0xffffff, alpha: 0.1 });
    }

    graphics.eventMode = "static";
    graphics.cursor = "pointer";
    graphics.on("pointerdown", () => onTileClick(x, y));
    
    return graphics;
  }, [onTileClick]);

  const createUnitSprite = useCallback((unit: Unit): PIXI.Container => {
    const container = new PIXI.Container();
    
    const equipmentTier = unit.equipment?.weapon?.tier ?? Math.min(Math.floor(unit.level / 3), 8);
    const factionVariant = factionSpriteVariants[unit.faction];
    
    const baseColor = unit.isEnemy ? 0xdc2626 : 0x2563eb;
    
    const background = new PIXI.Graphics();
    background
      .roundRect(-TILE_SIZE / 2 + 4, -TILE_SIZE / 2 + 4, TILE_SIZE - 8, TILE_SIZE - 8, 6)
      .fill({ color: baseColor });
    container.addChild(background);
    
    if (equipmentTier >= 2) {
      const glowColor = parseInt(tierGlowColors[equipmentTier].replace("#", ""), 16);
      const glow = new PIXI.Graphics();
      glow
        .roundRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4, 8)
        .stroke({ color: glowColor, width: 2, alpha: 0.7 });
      container.addChild(glow);
    }

    const classSymbols: Record<string, string> = {
      warrior: "W",
      mage: "M",
      archer: "A",
      healer: "H",
      rogue: "R",
      knight: "K",
    };
    
    const text = new PIXI.Text({
      text: classSymbols[unit.class] || "?",
      style: {
        fontFamily: "Cinzel, serif",
        fontSize: 18,
        fontWeight: "bold",
        fill: 0xffffff,
      },
    });
    text.anchor.set(0.5);
    container.addChild(text);
    
    const healthBarBg = new PIXI.Graphics();
    healthBarBg
      .roundRect(-TILE_SIZE / 2 + 6, TILE_SIZE / 2 - 10, TILE_SIZE - 12, 4, 2)
      .fill({ color: 0x000000, alpha: 0.5 });
    container.addChild(healthBarBg);
    
    const healthPercent = unit.stats.hp / unit.stats.maxHp;
    const healthColor = healthPercent > 0.6 ? 0x4ade80 : healthPercent > 0.3 ? 0xfbbf24 : 0xef4444;
    
    const healthBar = new PIXI.Graphics();
    healthBar
      .roundRect(
        -TILE_SIZE / 2 + 6,
        TILE_SIZE / 2 - 10,
        (TILE_SIZE - 12) * healthPercent,
        4,
        2
      )
      .fill({ color: healthColor });
    container.addChild(healthBar);
    
    if (equipmentTier >= 3) {
      const tierBadge = new PIXI.Graphics();
      const badgeColor = equipmentTier >= 6 ? 0xf59e0b : equipmentTier >= 4 ? 0x8b5cf6 : 0x3b82f6;
      tierBadge.circle(-TILE_SIZE / 2 + 10, -TILE_SIZE / 2 + 10, 8).fill({ color: badgeColor });
      container.addChild(tierBadge);
      
      const tierText = new PIXI.Text({
        text: `T${equipmentTier}`,
        style: {
          fontSize: 8,
          fontWeight: "bold",
          fill: 0xffffff,
        },
      });
      tierText.anchor.set(0.5);
      tierText.position.set(-TILE_SIZE / 2 + 10, -TILE_SIZE / 2 + 10);
      container.addChild(tierText);
    }
    
    const weaponBadge = new PIXI.Graphics();
    const weaponColor = equipmentTier >= 4 ? 0x8b5cf6 : equipmentTier >= 2 ? 0x3b82f6 : 0xf59e0b;
    weaponBadge.circle(TILE_SIZE / 2 - 8, TILE_SIZE / 2 - 8, 8).fill({ color: weaponColor });
    container.addChild(weaponBadge);
    
    const weaponSymbols: Record<string, string> = {
      sword: "S",
      axe: "X",
      dagger: "D",
      hammer: "H",
      bow: "B",
      crossbow: "C",
      gun: "G",
      staff: "F",
      tome: "T",
    };
    const weaponType = unit.equipment?.weapon?.weaponType || "sword";
    const weaponText = new PIXI.Text({
      text: weaponSymbols[weaponType] || "?",
      style: {
        fontSize: 8,
        fontWeight: "bold",
        fill: 0xffffff,
      },
    });
    weaponText.anchor.set(0.5);
    weaponText.position.set(TILE_SIZE / 2 - 8, TILE_SIZE / 2 - 8);
    container.addChild(weaponText);
    
    container.eventMode = "static";
    container.cursor = "pointer";
    container.on("pointerdown", () => onUnitClick(unit));
    
    return container;
  }, [onUnitClick]);

  const createHighlight = useCallback((x: number, y: number, isMovement: boolean): PIXI.Graphics => {
    const graphics = new PIXI.Graphics();
    const color = isMovement ? 0x3b82f6 : 0xef4444;
    
    graphics
      .roundRect(
        x * (TILE_SIZE + TILE_PADDING) + 2,
        y * (TILE_SIZE + TILE_PADDING) + 2,
        TILE_SIZE - 4,
        TILE_SIZE - 4,
        4
      )
      .fill({ color, alpha: 0.3 })
      .stroke({ color, width: 2, alpha: 0.6 });
    
    graphics.eventMode = "static";
    graphics.cursor = "pointer";
    graphics.on("pointerdown", () => onTileClick(x, y));
    
    return graphics;
  }, [onTileClick]);

  useEffect(() => {
    if (!containerRef.current) return;

    const initPixi = async () => {
      const app = new PIXI.Application();
      
      await app.init({
        width: width * (TILE_SIZE + TILE_PADDING),
        height: height * (TILE_SIZE + TILE_PADDING),
        backgroundColor: 0x1a1a2e,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      containerRef.current?.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;

      const terrain = new PIXI.Container();
      const highlights = new PIXI.Container();
      const unitsLayer = new PIXI.Container();
      const effects = new PIXI.Container();
      const ui = new PIXI.Container();

      app.stage.addChild(terrain);
      app.stage.addChild(highlights);
      app.stage.addChild(unitsLayer);
      app.stage.addChild(effects);
      app.stage.addChild(ui);

      layersRef.current = {
        terrain,
        highlights,
        units: unitsLayer,
        effects,
        ui,
      };

      setIsReady(true);
    };

    initPixi();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [width, height]);

  useEffect(() => {
    if (!isReady || !layersRef.current) return;
    
    const { terrain } = layersRef.current;
    terrain.removeChildren();
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles.find(t => t.x === x && t.y === y);
        if (tile) {
          const graphic = createTileGraphic(tile, x, y);
          terrain.addChild(graphic);
        }
      }
    }
  }, [isReady, tiles, width, height, createTileGraphic]);

  useEffect(() => {
    if (!isReady || !layersRef.current) return;
    
    const { highlights } = layersRef.current;
    highlights.removeChildren();
    
    for (const pos of highlightedTiles) {
      const highlight = createHighlight(pos.x, pos.y, true);
      highlights.addChild(highlight);
    }
  }, [isReady, highlightedTiles, createHighlight]);

  useEffect(() => {
    if (!isReady || !layersRef.current) return;
    
    const { units: unitsLayer } = layersRef.current;
    unitsLayer.removeChildren();
    spriteCacheRef.current.clear();
    
    for (const unit of units) {
      if (!unit.position) continue;
      
      const sprite = createUnitSprite(unit);
      sprite.position.set(
        unit.position.x * (TILE_SIZE + TILE_PADDING) + TILE_SIZE / 2,
        unit.position.y * (TILE_SIZE + TILE_PADDING) + TILE_SIZE / 2
      );
      
      if (unit.id === selectedUnitId) {
        sprite.scale.set(1.1);
      }
      
      unitsLayer.addChild(sprite);
    }
  }, [isReady, units, selectedUnitId, createUnitSprite]);

  return (
    <div 
      ref={containerRef} 
      className="rounded-lg overflow-hidden"
      data-testid="pixi-renderer"
    />
  );
}

export function playAttackEffect(
  effectsLayer: PIXI.Container,
  effectType: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  onComplete?: () => void
) {
  const effect = effectAssets[effectType];
  if (!effect) {
    onComplete?.();
    return;
  }

  const startX = fromX * (TILE_SIZE + TILE_PADDING) + TILE_SIZE / 2;
  const startY = fromY * (TILE_SIZE + TILE_PADDING) + TILE_SIZE / 2;
  const endX = toX * (TILE_SIZE + TILE_PADDING) + TILE_SIZE / 2;
  const endY = toY * (TILE_SIZE + TILE_PADDING) + TILE_SIZE / 2;

  const graphics = new PIXI.Graphics();
  const effectColor = effectType === "heal" ? 0x4ade80 : 
                      effectType === "fireball" ? 0xf97316 :
                      effectType === "lightning" ? 0xfbbf24 : 0xffffff;
  
  graphics.circle(0, 0, 8).fill({ color: effectColor });
  graphics.position.set(startX, startY);
  effectsLayer.addChild(graphics);

  const duration = 300;
  const startTime = Date.now();
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    graphics.position.x = startX + (endX - startX) * progress;
    graphics.position.y = startY + (endY - startY) * progress;
    graphics.alpha = 1 - progress * 0.3;
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      effectsLayer.removeChild(graphics);
      graphics.destroy();
      onComplete?.();
    }
  };
  
  requestAnimationFrame(animate);
}
