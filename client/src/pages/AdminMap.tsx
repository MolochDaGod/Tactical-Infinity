import { useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Grid3x3, Mountain, TreePine, Pickaxe, Hammer, 
  RotateCcw, Download, Maximize2, ZoomIn, ZoomOut,
  Move, MousePointer2, Eraser, Eye, EyeOff, Palmtree, Shuffle
} from 'lucide-react';
import {
  ALL_ASSETS,
  BUILDINGS,
  HARVESTABLE_RESOURCES,
  CRAFTING_STATIONS,
  GRID_SIZE_DIMENSIONS,
  type GameAsset,
  type GridSize,
} from '@/data/assetManifest';

type TerrainType = 'grass' | 'water' | 'sand' | 'stone' | 'forest' | 'mountain';
type ToolMode = 'select' | 'place' | 'erase' | 'terrain' | 'height';
type NodeType = 'ore' | 'herb' | 'crystal' | 'wood' | 'fish' | 'rare_ore' | 'ancient_tree' | 'ley_line';

interface IslandNode {
  uuid: string;
  id: string;
  type: NodeType;
  x: number;
  y: number;
  rarityPercent: number;
  activeChancePercent: number;
  isActive: boolean;
  permittedTerrains: TerrainType[];
  harvestYield?: string;
  respawnTimeMs?: number;
  xpReward?: number;
}

interface SpawnPoint {
  uuid: string;
  id: string;
  x: number;
  y: number;
  type: 'player' | 'enemy' | 'npc';
  capacity?: number;
  respawnDelayMs?: number;
}

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const NODE_HARVEST_CONFIG: Record<NodeType, { yield: string; respawnMs: number; xp: number }> = {
  ore: { yield: 'iron_ore', respawnMs: 60000, xp: 15 },
  herb: { yield: 'herb_bundle', respawnMs: 45000, xp: 10 },
  crystal: { yield: 'crystal_shard', respawnMs: 120000, xp: 25 },
  wood: { yield: 'raw_wood', respawnMs: 50000, xp: 12 },
  fish: { yield: 'raw_fish', respawnMs: 30000, xp: 8 },
  rare_ore: { yield: 'rare_ore', respawnMs: 300000, xp: 50 },
  ancient_tree: { yield: 'ancient_wood', respawnMs: 600000, xp: 75 },
  ley_line: { yield: 'mana_essence', respawnMs: 900000, xp: 100 },
};

interface GridCell {
  x: number;
  y: number;
  terrain: TerrainType;
  height: number;
  placedAsset?: {
    asset: GameAsset;
    rotation: number;
  };
  isOccupied: boolean;
  occupiedBy?: string;
  nodeId?: string;
  spawnId?: string;
}

interface PlacedAsset {
  id: string;
  asset: GameAsset;
  x: number;
  y: number;
  rotation: number;
}

interface MapSettings {
  gridWidth: number;
  gridHeight: number;
  averageHeight: number;
  heightVariance: number;
  cellSize: number;
  islandRadius: number;
}

interface TerrainPercentages {
  grass: number;
  forest: number;
  stone: number;
  mountain: number;
}

const NODE_CONFIG: Record<NodeType, { rarity: number; activeChance: number; terrains: TerrainType[]; color: string }> = {
  ore: { rarity: 25, activeChance: 70, terrains: ['stone', 'mountain'], color: '#8B4513' },
  herb: { rarity: 30, activeChance: 80, terrains: ['grass', 'forest'], color: '#228B22' },
  crystal: { rarity: 10, activeChance: 40, terrains: ['mountain', 'stone'], color: '#9932CC' },
  wood: { rarity: 35, activeChance: 85, terrains: ['forest'], color: '#654321' },
  fish: { rarity: 20, activeChance: 60, terrains: ['sand'], color: '#4169E1' },
  rare_ore: { rarity: 5, activeChance: 25, terrains: ['mountain'], color: '#FFD700' },
  ancient_tree: { rarity: 3, activeChance: 20, terrains: ['forest'], color: '#006400' },
  ley_line: { rarity: 2, activeChance: 15, terrains: ['stone', 'mountain'], color: '#00CED1' },
};

const TERRAIN_COLORS: Record<TerrainType, string> = {
  grass: 'bg-green-500',
  water: 'bg-blue-500',
  sand: 'bg-yellow-300',
  stone: 'bg-gray-400',
  forest: 'bg-green-700',
  mountain: 'bg-gray-600',
};

const TERRAIN_LABELS: Record<TerrainType, string> = {
  grass: 'Grass',
  water: 'Water',
  sand: 'Sand',
  stone: 'Stone',
  forest: 'Forest',
  mountain: 'Mountain',
};

const CATEGORY_ICONS: Record<string, JSX.Element> = {
  building: <Hammer className="w-4 h-4" />,
  resource: <TreePine className="w-4 h-4" />,
  crafting: <Pickaxe className="w-4 h-4" />,
};

const GRID_SIZE_COLORS: Record<GridSize, string> = {
  '1x1': 'bg-green-100 border-green-400',
  '1x2': 'bg-blue-100 border-blue-400',
  '2x1': 'bg-blue-100 border-blue-400',
  '2x2': 'bg-yellow-100 border-yellow-400',
  '2x3': 'bg-orange-100 border-orange-400',
  '3x2': 'bg-orange-100 border-orange-400',
  '3x3': 'bg-red-100 border-red-400',
  '4x4': 'bg-purple-100 border-purple-400',
};

export default function AdminMap() {
  const [mapSettings, setMapSettings] = useState<MapSettings>({
    gridWidth: 105,
    gridHeight: 125,
    averageHeight: 50,
    heightVariance: 20,
    cellSize: 8,
    islandRadius: 48,
  });
  
  const [islandNodes, setIslandNodes] = useState<IslandNode[]>([]);
  const [spawnPoints, setSpawnPoints] = useState<SpawnPoint[]>([]);
  
  const [grid, setGrid] = useState<GridCell[][]>(() => 
    generateGrid(mapSettings.gridWidth, mapSettings.gridHeight, mapSettings.averageHeight, mapSettings.heightVariance)
  );
  
  const [placedAssets, setPlacedAssets] = useState<PlacedAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<GameAsset | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [selectedTerrain, setSelectedTerrain] = useState<TerrainType>('grass');
  const [brushSize, setBrushSize] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showHeightMap, setShowHeightMap] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null);
  const [assetFilter, setAssetFilter] = useState<string>('all');
  const [assetSearch, setAssetSearch] = useState('');
  const [heightAdjustment, setHeightAdjustment] = useState(10);
  
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  function generateGrid(width: number, height: number, avgHeight: number, variance: number): GridCell[][] {
    const newGrid: GridCell[][] = [];
    for (let y = 0; y < height; y++) {
      const row: GridCell[] = [];
      for (let x = 0; x < width; x++) {
        const heightVariation = (Math.random() - 0.5) * variance;
        const cellHeight = Math.max(0, Math.min(100, avgHeight + heightVariation));
        let terrain: TerrainType = 'grass';
        if (cellHeight < 20) terrain = 'water';
        else if (cellHeight < 30) terrain = 'sand';
        else if (cellHeight > 80) terrain = 'mountain';
        else if (cellHeight > 70) terrain = 'stone';
        else if (Math.random() > 0.7) terrain = 'forest';
        
        row.push({
          x,
          y,
          terrain,
          height: Math.round(cellHeight),
          isOccupied: false,
        });
      }
      newGrid.push(row);
    }
    return newGrid;
  }

  const regenerateMap = useCallback(() => {
    setGrid(generateGrid(mapSettings.gridWidth, mapSettings.gridHeight, mapSettings.averageHeight, mapSettings.heightVariance));
    setPlacedAssets([]);
    setSelectedCell(null);
    setCameraOffset({ x: 0, y: 0 });
  }, [mapSettings]);

  const [islandSeed, setIslandSeed] = useState(() => Math.floor(Math.random() * 1000000));
  const [terrainPct, setTerrainPct] = useState<TerrainPercentages>({
    grass: 40,
    forest: 30,
    stone: 15,
    mountain: 15,
  });

  const generateIslandGrid = useCallback(() => {
    const width = mapSettings.gridWidth;
    const height = mapSettings.gridHeight;
    const seed = islandSeed;
    const configuredRadius = Math.max(44, Math.min(52, mapSettings.islandRadius));
    
    function seededRandom(s: number): () => number {
      let state = s;
      return () => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x7fffffff;
      };
    }
    
    function simplexNoise2D(x: number, y: number, seed: number): number {
      const rng = seededRandom(seed + Math.floor(x * 1000) + Math.floor(y * 7919));
      const n1 = rng();
      const n2 = rng();
      return Math.sin(x * 0.1 + n1 * 6.28) * 0.5 + Math.cos(y * 0.1 + n2 * 6.28) * 0.5;
    }
    
    const rng = seededRandom(seed);
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = configuredRadius;
    
    const ellipseA = maxRadius * (0.85 + rng() * 0.3);
    const ellipseB = maxRadius * (0.85 + rng() * 0.3);
    const rotation = rng() * Math.PI * 2;
    
    const newGrid: GridCell[][] = [];
    const originalIsLand: boolean[][] = [];
    const isLand: boolean[][] = [];
    
    for (let y = 0; y < height; y++) {
      const row: GridCell[] = [];
      const landRow: boolean[] = [];
      
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const rotatedX = dx * Math.cos(rotation) + dy * Math.sin(rotation);
        const rotatedY = -dx * Math.sin(rotation) + dy * Math.cos(rotation);
        const normalizedDist = Math.sqrt((rotatedX / ellipseA) ** 2 + (rotatedY / ellipseB) ** 2);
        
        const noiseValue = simplexNoise2D(x * 0.05, y * 0.05, seed) * 0.15;
        const coastlineNoise = simplexNoise2D(x * 0.08, y * 0.08, seed + 1000) * 0.1;
        const adjustedDist = normalizedDist + noiseValue + coastlineNoise;
        
        const isOnLand = adjustedDist < 1.0;
        landRow.push(isOnLand);
        
        let cellHeight: number;
        if (!isOnLand) {
          cellHeight = 5 + rng() * 10;
        } else {
          const distFromCoast = 1.0 - adjustedDist;
          const baseHeight = 30 + distFromCoast * 50;
          const heightNoise = simplexNoise2D(x * 0.03, y * 0.03, seed + 2000) * mapSettings.heightVariance;
          cellHeight = Math.max(25, Math.min(90, baseHeight + heightNoise));
        }
        
        row.push({
          x, y,
          terrain: isOnLand ? 'grass' : 'water',
          height: Math.round(cellHeight),
          isOccupied: false,
        });
      }
      newGrid.push(row);
      originalIsLand.push(landRow);
      isLand.push([...landRow]);
    }
    
    const rawTotal = terrainPct.grass + terrainPct.forest + terrainPct.stone + terrainPct.mountain;
    const totalPct = rawTotal > 0 ? rawTotal : 100;
    const safePct = rawTotal > 0 ? terrainPct : { grass: 40, forest: 30, stone: 15, mountain: 15 };
    const normalizedPct = {
      grass: safePct.grass / totalPct,
      forest: safePct.forest / totalPct,
      stone: safePct.stone / totalPct,
      mountain: safePct.mountain / totalPct,
    };
    
    const grassThreshold = normalizedPct.grass;
    const forestThreshold = grassThreshold + normalizedPct.forest;
    const stoneThreshold = forestThreshold + normalizedPct.stone;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (newGrid[y][x].terrain === 'water') continue;
        
        const cellHeight = newGrid[y][x].height;
        const isNearWater = (
          (x > 0 && newGrid[y][x-1].terrain === 'water') ||
          (x < width-1 && newGrid[y][x+1].terrain === 'water') ||
          (y > 0 && newGrid[y-1][x].terrain === 'water') ||
          (y < height-1 && newGrid[y+1][x].terrain === 'water')
        );
        
        let terrain: TerrainType;
        if (!isLand[y][x]) {
          terrain = 'water';
        } else if (isNearWater && cellHeight < 35) {
          terrain = 'sand';
        } else {
          const heightFactor = (cellHeight - 25) / 65;
          const biomeRoll = rng();
          const adjustedRoll = biomeRoll * (1 - heightFactor * 0.5) + heightFactor * 0.5;
          
          if (adjustedRoll < grassThreshold) {
            terrain = 'grass';
          } else if (adjustedRoll < forestThreshold) {
            terrain = 'forest';
          } else if (adjustedRoll < stoneThreshold) {
            terrain = 'stone';
          } else {
            terrain = 'mountain';
          }
        }
        
        newGrid[y][x].terrain = terrain;
      }
    }
    
    const validCellsByTerrain: Record<TerrainType, {x: number; y: number}[]> = {
      grass: [], water: [], sand: [], stone: [], forest: [], mountain: []
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isLand[y][x] && !newGrid[y][x].isOccupied) {
          validCellsByTerrain[newGrid[y][x].terrain].push({x, y});
        }
      }
    }
    
    const nodeTypes = Object.keys(NODE_CONFIG) as NodeType[];
    const totalRarity = nodeTypes.reduce((sum, t) => sum + NODE_CONFIG[t].rarity, 0);
    const nodeCount = Math.floor(12 + rng() * 9);
    const generatedNodes: IslandNode[] = [];
    const usedPositions = new Set<string>();
    
    for (let i = 0; i < nodeCount; i++) {
      let roll = rng() * totalRarity;
      let selectedType: NodeType = 'ore';
      for (const nodeType of nodeTypes) {
        roll -= NODE_CONFIG[nodeType].rarity;
        if (roll <= 0) {
          selectedType = nodeType;
          break;
        }
      }
      
      const config = NODE_CONFIG[selectedType];
      const validCells: {x: number; y: number}[] = [];
      for (const terrain of config.terrains) {
        validCells.push(...validCellsByTerrain[terrain]);
      }
      
      const availableCells = validCells.filter(c => !usedPositions.has(`${c.x},${c.y}`));
      if (availableCells.length === 0) continue;
      
      const cellIndex = Math.floor(rng() * availableCells.length);
      const cell = availableCells[cellIndex];
      usedPositions.add(`${cell.x},${cell.y}`);
      
      const isActive = rng() * 100 < config.activeChance;
      const nodeId = `node_${i}_${selectedType}`;
      
      const harvestConfig = NODE_HARVEST_CONFIG[selectedType];
      generatedNodes.push({
        uuid: generateUUID(),
        id: nodeId,
        type: selectedType,
        x: cell.x,
        y: cell.y,
        rarityPercent: config.rarity,
        activeChancePercent: config.activeChance,
        isActive,
        permittedTerrains: config.terrains,
        harvestYield: harvestConfig.yield,
        respawnTimeMs: harvestConfig.respawnMs,
        xpReward: harvestConfig.xp,
      });
      
      newGrid[cell.y][cell.x].nodeId = nodeId;
    }
    
    const generatedSpawns: SpawnPoint[] = [];
    const playerCandidates = validCellsByTerrain['sand'].filter(c => !usedPositions.has(`${c.x},${c.y}`));
    if (playerCandidates.length === 0) {
      playerCandidates.push(...validCellsByTerrain['grass'].filter(c => !usedPositions.has(`${c.x},${c.y}`)));
    }
    if (playerCandidates.length > 0) {
      const playerSpawnIdx = Math.floor(rng() * playerCandidates.length);
      const playerCell = playerCandidates[playerSpawnIdx];
      usedPositions.add(`${playerCell.x},${playerCell.y}`);
      const spawnId = 'spawn_player';
      generatedSpawns.push({ uuid: generateUUID(), id: spawnId, x: playerCell.x, y: playerCell.y, type: 'player', capacity: 1 });
      newGrid[playerCell.y][playerCell.x].spawnId = spawnId;
    }
    
    setGrid(newGrid);
    setIslandNodes(generatedNodes);
    setSpawnPoints(generatedSpawns);
    setPlacedAssets([]);
    setSelectedCell(null);
    setCameraOffset({ x: 0, y: 0 });
  }, [mapSettings, islandSeed, terrainPct]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setCameraOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [isPanning, lastMousePos]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetCamera = useCallback(() => {
    setCameraOffset({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    
    setZoom(prevZoom => {
      const newZoom = Math.max(0.1, Math.min(5, prevZoom + delta));
      return newZoom;
    });
  }, []);

  const handleCellClick = useCallback((x: number, y: number) => {
    if (toolMode === 'select') {
      setSelectedCell({ x, y });
      return;
    }

    if (toolMode === 'terrain') {
      setGrid(prev => {
        const newGrid = prev.map(row => row.map(cell => ({ ...cell })));
        for (let dy = -brushSize + 1; dy < brushSize; dy++) {
          for (let dx = -brushSize + 1; dx < brushSize; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < mapSettings.gridWidth && ny >= 0 && ny < mapSettings.gridHeight) {
              newGrid[ny][nx].terrain = selectedTerrain;
            }
          }
        }
        return newGrid;
      });
      return;
    }

    if (toolMode === 'height') {
      setGrid(prev => {
        const newGrid = prev.map(row => row.map(cell => ({ ...cell })));
        for (let dy = -brushSize + 1; dy < brushSize; dy++) {
          for (let dx = -brushSize + 1; dx < brushSize; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < mapSettings.gridWidth && ny >= 0 && ny < mapSettings.gridHeight) {
              const currentHeight = newGrid[ny][nx].height;
              const newHeight = Math.max(0, Math.min(100, currentHeight + heightAdjustment));
              newGrid[ny][nx].height = newHeight;
            }
          }
        }
        return newGrid;
      });
      return;
    }

    if (toolMode === 'place' && selectedAsset) {
      const dims = GRID_SIZE_DIMENSIONS[selectedAsset.gridSize];
      const canPlace = checkCanPlace(x, y, dims.width, dims.height);
      
      if (canPlace) {
        const newAsset: PlacedAsset = {
          id: `${selectedAsset.id}_${Date.now()}`,
          asset: selectedAsset,
          x,
          y,
          rotation: 0,
        };
        
        setPlacedAssets(prev => [...prev, newAsset]);
        setGrid(prev => {
          const newGrid = prev.map(row => row.map(cell => ({ ...cell })));
          for (let dy = 0; dy < dims.height; dy++) {
            for (let dx = 0; dx < dims.width; dx++) {
              if (y + dy < mapSettings.gridHeight && x + dx < mapSettings.gridWidth) {
                newGrid[y + dy][x + dx].isOccupied = true;
                newGrid[y + dy][x + dx].occupiedBy = newAsset.id;
              }
            }
          }
          return newGrid;
        });
      }
      return;
    }

    if (toolMode === 'erase') {
      const cell = grid[y]?.[x];
      if (cell?.occupiedBy) {
        const assetId = cell.occupiedBy;
        const asset = placedAssets.find(a => a.id === assetId);
        if (asset) {
          const dims = GRID_SIZE_DIMENSIONS[asset.asset.gridSize];
          setPlacedAssets(prev => prev.filter(a => a.id !== assetId));
          setGrid(prev => {
            const newGrid = prev.map(row => row.map(c => ({ ...c })));
            for (let dy = 0; dy < dims.height; dy++) {
              for (let dx = 0; dx < dims.width; dx++) {
                const ny = asset.y + dy;
                const nx = asset.x + dx;
                if (ny < mapSettings.gridHeight && nx < mapSettings.gridWidth) {
                  newGrid[ny][nx].isOccupied = false;
                  newGrid[ny][nx].occupiedBy = undefined;
                }
              }
            }
            return newGrid;
          });
        }
      }
    }
  }, [toolMode, selectedAsset, selectedTerrain, brushSize, grid, placedAssets, mapSettings, heightAdjustment]);

  function checkCanPlace(x: number, y: number, width: number, height: number): boolean {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= mapSettings.gridWidth || ny >= mapSettings.gridHeight) return false;
        if (grid[ny][nx].isOccupied) return false;
        if (grid[ny][nx].terrain === 'water') return false;
      }
    }
    return true;
  }

  const filteredAssets = useMemo(() => {
    let assets = [...BUILDINGS, ...HARVESTABLE_RESOURCES, ...CRAFTING_STATIONS];
    
    if (assetFilter !== 'all') {
      if (assetFilter === 'building') {
        assets = BUILDINGS;
      } else if (assetFilter === 'resource') {
        assets = HARVESTABLE_RESOURCES;
      } else if (assetFilter === 'crafting') {
        assets = CRAFTING_STATIONS;
      } else {
        assets = assets.filter(a => a.gridSize === assetFilter);
      }
    }
    
    if (assetSearch) {
      const search = assetSearch.toLowerCase();
      assets = assets.filter(a => 
        a.name.toLowerCase().includes(search) ||
        a.subcategory.toLowerCase().includes(search)
      );
    }
    
    return assets;
  }, [assetFilter, assetSearch]);

  const exportMap = () => {
    const islandUUID = generateUUID();
    const mapData = {
      islandId: islandUUID,
      seed: islandSeed,
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: mapSettings,
      terrainDistribution: terrainPct,
      grid: grid.map(row => row.map(cell => ({
        terrain: cell.terrain,
        height: cell.height,
        nodeId: cell.nodeId || null,
        spawnId: cell.spawnId || null,
      }))),
      assets: placedAssets.map(a => ({
        uuid: generateUUID(),
        assetId: a.asset.id,
        name: a.asset.name,
        category: a.asset.category,
        x: a.x,
        y: a.y,
        rotation: a.rotation,
        gridSize: a.asset.gridSize,
        harvestable: a.asset.harvestable || false,
        harvestYield: a.asset.harvestYield,
        xpReward: a.asset.xpReward,
      })),
      nodes: islandNodes.map(n => ({
        uuid: n.uuid,
        id: n.id,
        type: n.type,
        position: { x: n.x, y: n.y },
        isActive: n.isActive,
        harvestYield: n.harvestYield,
        respawnTimeMs: n.respawnTimeMs,
        xpReward: n.xpReward,
        rarityPercent: n.rarityPercent,
      })),
      spawns: spawnPoints.map(s => ({
        uuid: s.uuid,
        id: s.id,
        type: s.type,
        position: { x: s.x, y: s.y },
        capacity: s.capacity,
        respawnDelayMs: s.respawnDelayMs,
      })),
      stats: {
        totalNodes: islandNodes.length,
        activeNodes: islandNodes.filter(n => n.isActive).length,
        nodesByType: Object.fromEntries(
          Object.keys(NODE_HARVEST_CONFIG).map(type => [
            type,
            islandNodes.filter(n => n.type === type).length
          ])
        ),
        totalSpawns: spawnPoints.length,
      },
    };
    const blob = new Blob([JSON.stringify(mapData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `island_${islandSeed}_${Date.now()}.json`;
    link.click();
  };

  const selectedCellInfo = selectedCell ? grid[selectedCell.y]?.[selectedCell.x] : null;
  const selectedPlacedAsset = selectedCellInfo?.occupiedBy 
    ? placedAssets.find(a => a.id === selectedCellInfo.occupiedBy) 
    : null;

  return (
    <div className="h-screen overflow-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
      <div className="max-w-[1800px] mx-auto pb-8">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <Grid3x3 className="w-8 h-8 text-emerald-400" />
          <h1 className="text-3xl font-bold">Admin Map Editor</h1>
          <Badge variant="outline" className="border-emerald-500 text-emerald-400">
            {mapSettings.gridWidth}x{mapSettings.gridHeight} Grid
          </Badge>
          <Badge variant="outline" className="border-blue-500 text-blue-400">
            {placedAssets.length} Assets Placed
          </Badge>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3 space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mountain className="w-5 h-5" />
                  Map Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-slate-400">Width (5-300)</Label>
                    <Input
                      type="number"
                      value={mapSettings.gridWidth}
                      onChange={(e) => setMapSettings(s => ({ ...s, gridWidth: Math.min(300, Math.max(5, parseInt(e.target.value) || 10)) }))}
                      className="bg-slate-700 border-slate-600 h-8"
                      min={5}
                      max={300}
                      data-testid="input-grid-width"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Height (5-300)</Label>
                    <Input
                      type="number"
                      value={mapSettings.gridHeight}
                      onChange={(e) => setMapSettings(s => ({ ...s, gridHeight: Math.min(300, Math.max(5, parseInt(e.target.value) || 10)) }))}
                      className="bg-slate-700 border-slate-600 h-8"
                      min={5}
                      max={300}
                      data-testid="input-grid-height"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-slate-400">Island Seed</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      value={islandSeed}
                      onChange={(e) => setIslandSeed(parseInt(e.target.value) || 0)}
                      className="bg-slate-700 border-slate-600 text-sm"
                      data-testid="input-island-seed"
                    />
                    <Button
                      onClick={() => setIslandSeed(Math.floor(Math.random() * 1000000))}
                      variant="outline"
                      size="sm"
                      className="border-slate-600"
                      title="Random Seed"
                      data-testid="button-new-seed"
                    >
                      <Shuffle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 min-w-0">
                  <Button onClick={regenerateMap} className="flex-1 min-w-0 bg-emerald-600 text-sm px-2" data-testid="button-regenerate">
                    <RotateCcw className="w-4 h-4 mr-1 flex-shrink-0" />
                    <span className="truncate">Generate</span>
                  </Button>
                  <Button onClick={generateIslandGrid} className="flex-1 min-w-0 bg-blue-600 text-sm px-2" data-testid="button-island">
                    <Palmtree className="w-4 h-4 mr-1 flex-shrink-0" />
                    <span className="truncate">Island</span>
                  </Button>
                </div>
                <div className="flex gap-2 min-w-0">
                  <Button onClick={exportMap} variant="outline" className="border-slate-600 flex-1 min-w-0 text-sm px-2" data-testid="button-export">
                    <Download className="w-4 h-4 mr-1 flex-shrink-0" />
                    <span className="truncate">Export</span>
                  </Button>
                  <Button onClick={resetCamera} variant="outline" className="border-slate-600 flex-1 min-w-0 text-sm px-2" data-testid="button-reset-camera">
                    <Maximize2 className="w-4 h-4 mr-1 flex-shrink-0" />
                    <span className="truncate">Reset</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { mode: 'select' as ToolMode, icon: <MousePointer2 className="w-4 h-4" />, label: 'Select' },
                    { mode: 'place' as ToolMode, icon: <Move className="w-4 h-4" />, label: 'Place' },
                    { mode: 'erase' as ToolMode, icon: <Eraser className="w-4 h-4" />, label: 'Erase' },
                    { mode: 'terrain' as ToolMode, icon: <Mountain className="w-4 h-4" />, label: 'Terrain' },
                    { mode: 'height' as ToolMode, icon: <Maximize2 className="w-4 h-4" />, label: 'Height' },
                  ].map(({ mode, icon, label }) => (
                    <Button
                      key={mode}
                      variant={toolMode === mode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setToolMode(mode)}
                      className={toolMode === mode ? 'bg-emerald-600' : 'border-slate-600'}
                      title={label}
                      data-testid={`button-tool-${mode}`}
                    >
                      {icon}
                    </Button>
                  ))}
                </div>

                {toolMode === 'terrain' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-400">Terrain Type</Label>
                    <div className="grid grid-cols-3 gap-1">
                      {Object.entries(TERRAIN_COLORS).map(([terrain, color]) => (
                        <Button
                          key={terrain}
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTerrain(terrain as TerrainType)}
                          className={`${selectedTerrain === terrain ? 'ring-2 ring-white' : ''} border-slate-600`}
                          data-testid={`button-terrain-${terrain}`}
                        >
                          <div className={`w-3 h-3 rounded ${color} mr-1`} />
                          <span className="text-xs">{TERRAIN_LABELS[terrain as TerrainType]}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGrid(!showGrid)}
                    className="flex-1 border-slate-600"
                    data-testid="button-toggle-grid"
                  >
                    {showGrid ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
                    Grid
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHeightMap(!showHeightMap)}
                    className="flex-1 border-slate-600"
                    data-testid="button-toggle-heightmap"
                  >
                    {showHeightMap ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
                    Height
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="border-slate-600" data-testid="button-zoom-out">
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-sm flex-1 text-center">{Math.round(zoom * 100)}%</span>
                  <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="border-slate-600" data-testid="button-zoom-in">
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {selectedCellInfo && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Selected Cell</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">Position:</span>
                    <span>({selectedCell!.x}, {selectedCell!.y})</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">Terrain:</span>
                    <Badge className={TERRAIN_COLORS[selectedCellInfo.terrain]}>{TERRAIN_LABELS[selectedCellInfo.terrain]}</Badge>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">Height:</span>
                    <span>{selectedCellInfo.height}m</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="col-span-6">
            <Card className="bg-slate-800/50 border-slate-700 h-full overflow-hidden">
              <CardContent 
                ref={canvasRef}
                className="p-0 overflow-hidden h-full relative"
                style={{ cursor: isPanning ? 'grabbing' : 'grab', minHeight: '500px' }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div className="absolute top-2 left-2 z-20 bg-slate-900/80 rounded px-2 py-1 text-xs text-slate-300">
                  Alt+Click to pan | Scroll to zoom | {Math.round(zoom * 100)}%
                </div>
                <div 
                  className="absolute"
                  style={{
                    width: mapSettings.gridWidth * mapSettings.cellSize * zoom,
                    height: mapSettings.gridHeight * mapSettings.cellSize * zoom,
                    minWidth: 100,
                    minHeight: 100,
                    transform: `translate(${cameraOffset.x}px, ${cameraOffset.y}px)`,
                  }}
                >
                  {grid.map((row, y) => (
                    row.map((cell, x) => {
                      const isSelected = selectedCell?.x === x && selectedCell?.y === y;
                      const heightOpacity = showHeightMap ? cell.height / 100 : 1;
                      
                      return (
                        <div
                          key={`${x}-${y}`}
                          className={`absolute transition-all cursor-pointer ${
                            TERRAIN_COLORS[cell.terrain]
                          } ${showGrid ? 'border border-black/20' : ''} ${
                            isSelected ? 'ring-2 ring-yellow-400 z-10' : ''
                          } ${cell.isOccupied ? 'opacity-70' : ''}`}
                          style={{
                            left: x * mapSettings.cellSize * zoom,
                            top: y * mapSettings.cellSize * zoom,
                            width: mapSettings.cellSize * zoom,
                            height: mapSettings.cellSize * zoom,
                            opacity: showHeightMap ? heightOpacity : undefined,
                          }}
                          onClick={() => handleCellClick(x, y)}
                          data-testid={`cell-${x}-${y}`}
                        >
                          {showHeightMap && (
                            <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white/70">
                              {cell.height}
                            </span>
                          )}
                        </div>
                      );
                    })
                  ))}
                  
                  {placedAssets.map((placed) => {
                    const dims = GRID_SIZE_DIMENSIONS[placed.asset.gridSize];
                    return (
                      <div
                        key={placed.id}
                        className={`absolute flex items-center justify-center text-xs font-bold border-2 rounded ${
                          GRID_SIZE_COLORS[placed.asset.gridSize]
                        } bg-opacity-80 pointer-events-none z-5`}
                        style={{
                          left: placed.x * mapSettings.cellSize * zoom,
                          top: placed.y * mapSettings.cellSize * zoom,
                          width: dims.width * mapSettings.cellSize * zoom,
                          height: dims.height * mapSettings.cellSize * zoom,
                        }}
                      >
                        <div className="text-center p-1 truncate text-slate-800">
                          <div className="text-[10px] font-medium">{placed.asset.name}</div>
                          <div className="text-[8px] opacity-70">{placed.asset.gridSize}</div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {islandNodes.map((node) => (
                    <div
                      key={node.id}
                      className={`absolute rounded-full pointer-events-none z-10 flex items-center justify-center ${
                        node.isActive ? 'ring-2 ring-white' : 'opacity-50'
                      }`}
                      style={{
                        left: node.x * mapSettings.cellSize * zoom + mapSettings.cellSize * zoom * 0.1,
                        top: node.y * mapSettings.cellSize * zoom + mapSettings.cellSize * zoom * 0.1,
                        width: mapSettings.cellSize * zoom * 0.8,
                        height: mapSettings.cellSize * zoom * 0.8,
                        backgroundColor: NODE_CONFIG[node.type].color,
                      }}
                      title={`${node.type} (${node.isActive ? 'Active' : 'Inactive'}) - Rarity: ${node.rarityPercent}%`}
                    >
                      {!node.isActive && <div className="w-2 h-2 rounded-full bg-gray-800" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-3">
            <Card className="bg-slate-800/50 border-slate-700 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Assets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Search assets..."
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  className="bg-slate-700 border-slate-600"
                  data-testid="input-asset-search"
                />
                
                <Select value={assetFilter} onValueChange={setAssetFilter}>
                  <SelectTrigger className="bg-slate-700 border-slate-600" data-testid="select-asset-filter">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Assets</SelectItem>
                    <SelectItem value="building">Buildings</SelectItem>
                    <SelectItem value="resource">Resources</SelectItem>
                    <SelectItem value="crafting">Crafting</SelectItem>
                  </SelectContent>
                </Select>

                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-2">
                    {filteredAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className={`p-2 rounded border cursor-pointer transition-all ${
                          selectedAsset?.id === asset.id
                            ? 'border-emerald-500 bg-emerald-500/20'
                            : 'border-slate-600 bg-slate-700/50'
                        }`}
                        onClick={() => {
                          setSelectedAsset(asset);
                          setToolMode('place');
                        }}
                        data-testid={`asset-${asset.id}`}
                      >
                        <div className="flex items-center gap-2">
                          {CATEGORY_ICONS[asset.category] || <Hammer className="w-4 h-4" />}
                          <span className="font-medium text-sm">{asset.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs border-slate-500">
                            {asset.gridSize}
                          </Badge>
                          <span className="text-xs text-slate-400">{asset.subcategory}</span>
                        </div>
                        {asset.harvestable && (
                          <div className="text-xs text-emerald-400 mt-1">
                            Yields: {asset.harvestYield} (+{asset.xpReward} XP)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
