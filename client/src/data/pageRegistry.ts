export type PageCategory = 'core' | 'combat' | 'exploration' | 'management' | 'admin' | 'dev' | 'cinematic';

export interface PageEntry {
  slug: string;
  phase: string;
  label: string;
  category: PageCategory;
  component: string;
  file: string;
  parent: string | null;
  description: string;
  lines: number;
  hasBackButton: boolean;
  has3D: boolean;
  tags: string[];
}

export const PAGE_REGISTRY: PageEntry[] = [
  {
    slug: 'main-menu',
    phase: 'menu',
    label: 'Main Menu',
    category: 'core',
    component: 'Home',
    file: 'pages/home.tsx',
    parent: null,
    description: 'Landing page with navigation to all game modes',
    lines: 43,
    hasBackButton: false,
    has3D: false,
    tags: ['navigation', 'entry-point'],
  },
  {
    slug: 'captain-creation',
    phase: 'captain',
    label: 'Create Captain',
    category: 'core',
    component: 'CaptainCreation',
    file: 'pages/CaptainCreation.tsx',
    parent: 'main-menu',
    description: 'Race and class selection for new captain, saves to localStorage',
    lines: 742,
    hasBackButton: true,
    has3D: false,
    tags: ['character-creation', 'onboarding', 'localStorage'],
  },
  {
    slug: 'roster',
    phase: 'roster',
    label: 'Roster',
    category: 'management',
    component: 'RosterPage',
    file: 'pages/roster.tsx',
    parent: 'main-menu',
    description: 'Unit selection for battle deployment',
    lines: 106,
    hasBackButton: true,
    has3D: false,
    tags: ['unit-management', 'battle-prep'],
  },
  {
    slug: 'barracks',
    phase: 'barracks',
    label: 'Barracks',
    category: 'management',
    component: 'Barracks',
    file: 'pages/Barracks.tsx',
    parent: 'main-menu',
    description: '3D viewer for 6 race characters with weapon cycling (Q/E), animation blending, click raycasting',
    lines: 821,
    hasBackButton: true,
    has3D: true,
    tags: ['3d-viewer', 'character-viewer', 'weapons', 'animations', 'toon-rts'],
  },
  {
    slug: 'lore-codex',
    phase: 'codex',
    label: 'Lore Codex',
    category: 'core',
    component: 'CodexPage',
    file: 'pages/codex.tsx',
    parent: 'main-menu',
    description: 'Faction lore and game encyclopedia',
    lines: 14,
    hasBackButton: true,
    has3D: false,
    tags: ['lore', 'encyclopedia', 'stub'],
  },
  {
    slug: 'world-map',
    phase: 'worldmap',
    label: 'World Map',
    category: 'exploration',
    component: 'WorldMapPage',
    file: 'pages/world-map.tsx',
    parent: 'main-menu',
    description: 'MMO-style faction territory map with 810 navigable nodes',
    lines: 195,
    hasBackButton: true,
    has3D: false,
    tags: ['map', 'factions', 'navigation', 'territories'],
  },
  {
    slug: 'islands',
    phase: 'islands',
    label: 'Islands',
    category: 'exploration',
    component: 'Islands',
    file: 'pages/Islands.tsx',
    parent: 'main-menu',
    description: '3D island generator with biome presets, terrain generation, vegetation scatter',
    lines: 352,
    hasBackButton: true,
    has3D: true,
    tags: ['3d-viewer', 'terrain', 'biomes', 'procedural-generation'],
  },
  {
    slug: 'open-water-sailing',
    phase: 'sailing',
    label: 'Set Sail',
    category: 'exploration',
    component: 'OpenWaterSailing',
    file: 'pages/OpenWaterSailing.tsx',
    parent: 'main-menu',
    description: '3D ocean sailing with ship combat, island LOD, dock-at-island transitions',
    lines: 2984,
    hasBackButton: true,
    has3D: true,
    tags: ['3d-gameplay', 'sailing', 'ship-combat', 'ocean', 'islands'],
  },
  {
    slug: 'production-island',
    phase: 'productionisland',
    label: 'Production Island',
    category: 'exploration',
    component: 'ProductionIsland',
    file: 'pages/ProductionIsland.tsx',
    parent: 'open-water-sailing',
    description: '3D island exploration: WASD movement, resource gathering, AI combat, dock system',
    lines: 676,
    hasBackButton: true,
    has3D: true,
    tags: ['3d-gameplay', 'island', 'resources', 'combat', 'exploration'],
  },
  {
    slug: 'ship-editor',
    phase: 'shipeditor',
    label: 'Ship Editor',
    category: 'management',
    component: 'ShipEditor',
    file: 'pages/ShipEditor.tsx',
    parent: 'main-menu',
    description: 'Ship builder with cannon mounts, stats, 5-tier progression',
    lines: 3926,
    hasBackButton: true,
    has3D: true,
    tags: ['3d-editor', 'ship-building', 'customization', 'weapons'],
  },
  {
    slug: 'island-battle',
    phase: 'battle',
    label: 'Island Battle',
    category: 'combat',
    component: 'IslandBattlePage',
    file: 'pages/IslandBattlePage.tsx',
    parent: 'main-menu',
    description: '3D arena battle: WASD + tab-targeting, 8 skill hotkeys, 5-wave enemies',
    lines: 1034,
    hasBackButton: true,
    has3D: true,
    tags: ['3d-gameplay', 'combat', 'skills', 'waves', 'action-rpg'],
  },
  {
    slug: 'battlegrounds',
    phase: 'battlegrounds',
    label: 'Battlegrounds',
    category: 'combat',
    component: 'BattleGrounds',
    file: 'pages/BattleGrounds.tsx',
    parent: 'main-menu',
    description: 'Real-time third-person survival mode with Mixamo character controller',
    lines: 1016,
    hasBackButton: true,
    has3D: true,
    tags: ['3d-gameplay', 'combat', 'survival', 'third-person'],
  },
  {
    slug: 'tactical-battle',
    phase: 'battle',
    label: 'Tactical Battle (2D)',
    category: 'combat',
    component: 'BattlePage',
    file: 'pages/battle.tsx',
    parent: null,
    description: '2D PixiJS grid-based turn-by-turn combat (legacy, not wired in App.tsx)',
    lines: 326,
    hasBackButton: false,
    has3D: false,
    tags: ['2d', 'pixi', 'turn-based', 'grid', 'legacy', 'unused'],
  },
  {
    slug: 'player-arena',
    phase: 'playerarena',
    label: 'Player Arena',
    category: 'combat',
    component: 'PlayerArena',
    file: 'pages/PlayerArena.tsx',
    parent: 'main-menu',
    description: '3D player arena test scene',
    lines: 411,
    hasBackButton: true,
    has3D: true,
    tags: ['3d-gameplay', 'combat', 'arena', 'test'],
  },
  {
    slug: 'grudge-controller-test',
    phase: 'grudgetest',
    label: 'Grudge Controller Test',
    category: 'dev',
    component: 'GrudgeControllerTest',
    file: 'pages/GrudgeControllerTest.tsx',
    parent: 'main-menu',
    description: '3D character controller test with WASD, camera, animations',
    lines: 520,
    hasBackButton: true,
    has3D: true,
    tags: ['3d-test', 'character-controller', 'dev-tool'],
  },
  {
    slug: 'intro-cinematic',
    phase: 'intro',
    label: 'Intro Cinematic',
    category: 'cinematic',
    component: 'IntroScene',
    file: 'components/IntroScene.tsx',
    parent: 'main-menu',
    description: 'Intro cutscene before beach spawn',
    lines: 0,
    hasBackButton: false,
    has3D: false,
    tags: ['cinematic', 'cutscene', 'onboarding'],
  },
  {
    slug: 'beach-spawn',
    phase: 'beachSpawn',
    label: 'Beach Spawn',
    category: 'cinematic',
    component: 'BeachSpawnScene',
    file: 'components/BeachSpawnScene.tsx',
    parent: 'intro-cinematic',
    description: 'Post-intro beach landing, exits to world map',
    lines: 0,
    hasBackButton: true,
    has3D: false,
    tags: ['cinematic', 'onboarding', 'transition'],
  },
  {
    slug: 'chat',
    phase: 'chat',
    label: 'Chat',
    category: 'core',
    component: 'Chat',
    file: 'pages/Chat.tsx',
    parent: 'main-menu',
    description: 'AI chat interface powered by Puter.js',
    lines: 373,
    hasBackButton: true,
    has3D: false,
    tags: ['ai', 'chat', 'puter'],
  },
  {
    slug: 'admin-hub',
    phase: 'admin',
    label: 'Admin Hub',
    category: 'admin',
    component: 'Admin',
    file: 'pages/Admin.tsx',
    parent: 'main-menu',
    description: 'Dev tools hub linking to all admin/editor pages',
    lines: 1127,
    hasBackButton: true,
    has3D: false,
    tags: ['admin', 'navigation', 'dev-tools'],
  },
  {
    slug: 'admin-map',
    phase: 'adminmap',
    label: 'Admin Map Editor',
    category: 'admin',
    component: 'AdminMap',
    file: 'pages/AdminMap.tsx',
    parent: 'admin-hub',
    description: 'World map editor tool',
    lines: 1070,
    hasBackButton: true,
    has3D: false,
    tags: ['admin', 'editor', 'map'],
  },
  {
    slug: 'admin-sprites',
    phase: 'adminsprites',
    label: 'Sprite Viewer',
    category: 'admin',
    component: 'AdminSpritesPage',
    file: 'pages/admin-sprites.tsx',
    parent: 'admin-hub',
    description: 'Sprite sheet viewer and animator',
    lines: 611,
    hasBackButton: true,
    has3D: false,
    tags: ['admin', 'sprites', 'viewer'],
  },
  {
    slug: 'admin-assets',
    phase: 'adminassets',
    label: 'Asset Browser',
    category: 'admin',
    component: 'AdminAssets',
    file: 'pages/AdminAssets.tsx',
    parent: 'admin-hub',
    description: 'Browse and inspect game assets',
    lines: 891,
    hasBackButton: true,
    has3D: false,
    tags: ['admin', 'assets', 'browser'],
  },
  {
    slug: 'asset-registry',
    phase: 'assetregistry',
    label: 'Asset Registry',
    category: 'admin',
    component: 'AssetRegistry',
    file: 'pages/AssetRegistry.tsx',
    parent: 'admin-hub',
    description: 'Structured asset registry with categories',
    lines: 259,
    hasBackButton: true,
    has3D: false,
    tags: ['admin', 'assets', 'registry'],
  },
  {
    slug: 'island-editor',
    phase: 'islandeditor',
    label: 'Island Editor',
    category: 'admin',
    component: 'IslandEditorPage',
    file: 'pages/IslandEditorPage.tsx',
    parent: 'admin-hub',
    description: '3D terrain painter + object placement tool',
    lines: 1704,
    hasBackButton: false,
    has3D: true,
    tags: ['admin', '3d-editor', 'terrain', 'island'],
  },
  {
    slug: 'race-viewer',
    phase: 'raceviewer',
    label: 'Race Character Viewer',
    category: 'admin',
    component: 'RaceCharacterViewer',
    file: 'pages/RaceCharacterViewer.tsx',
    parent: 'admin-hub',
    description: '3D viewer for individual race FBX models with textures',
    lines: 643,
    hasBackButton: true,
    has3D: true,
    tags: ['admin', '3d-viewer', 'character-viewer', 'toon-rts'],
  },
  {
    slug: 'video-generator',
    phase: 'videogen',
    label: 'Video Generator',
    category: 'admin',
    component: 'PuterVideoGenerator',
    file: 'components/PuterVideoGenerator.tsx',
    parent: 'admin-hub',
    description: 'AI video generation powered by Puter.js',
    lines: 0,
    hasBackButton: true,
    has3D: false,
    tags: ['admin', 'ai', 'video', 'puter'],
  },
  {
    slug: 'polygonjs-demo',
    phase: 'polygonjs',
    label: 'PolygonJS Demo',
    category: 'dev',
    component: 'PolygonJSDemo',
    file: 'pages/PolygonJSDemo.tsx',
    parent: 'admin-hub',
    description: 'PolygonJS node-based 3D effects demo',
    lines: 427,
    hasBackButton: true,
    has3D: true,
    tags: ['dev-tool', '3d-demo', 'polygonjs', 'effects'],
  },
  {
    slug: 'pixy-fx',
    phase: 'pixyfx',
    label: 'PixyFX Showcase',
    category: 'dev',
    component: 'PixyFxShowcase',
    file: 'pages/PixyFxShowcase.tsx',
    parent: 'admin-hub',
    description: 'PixiJS particle effects showcase',
    lines: 268,
    hasBackButton: true,
    has3D: false,
    tags: ['dev-tool', '2d-demo', 'pixi', 'particles'],
  },
  {
    slug: 'builder-test',
    phase: 'buildertest',
    label: 'Builder Test',
    category: 'dev',
    component: 'BuilderTest',
    file: 'pages/BuilderTest.tsx',
    parent: 'admin-hub',
    description: 'Scene builder prototype',
    lines: 361,
    hasBackButton: false,
    has3D: true,
    tags: ['dev-tool', '3d-test', 'builder'],
  },
  {
    slug: 'turret-demo',
    phase: 'turretdemo',
    label: 'Turret Demo',
    category: 'dev',
    component: 'TurretDemo',
    file: 'pages/TurretDemo.tsx',
    parent: 'admin-hub',
    description: 'Turret targeting and firing system demo',
    lines: 1023,
    hasBackButton: false,
    has3D: true,
    tags: ['dev-tool', '3d-demo', 'turret', 'weapons'],
  },
];

export const PAGE_CATEGORIES: Record<PageCategory, { label: string; color: string }> = {
  core: { label: 'Core', color: '#c4a035' },
  combat: { label: 'Combat', color: '#c43535' },
  exploration: { label: 'Exploration', color: '#35a5c4' },
  management: { label: 'Management', color: '#8a5ac4' },
  admin: { label: 'Admin', color: '#5a8a4a' },
  dev: { label: 'Dev Tools', color: '#8a8a7a' },
  cinematic: { label: 'Cinematic', color: '#c48a35' },
};

export function getPageBySlug(slug: string): PageEntry | undefined {
  return PAGE_REGISTRY.find(p => p.slug === slug);
}

export function getPageByPhase(phase: string): PageEntry | undefined {
  return PAGE_REGISTRY.find(p => p.phase === phase);
}

export function getPagesByCategory(category: PageCategory): PageEntry[] {
  return PAGE_REGISTRY.filter(p => p.category === category);
}

export function getChildPages(parentSlug: string): PageEntry[] {
  return PAGE_REGISTRY.filter(p => p.parent === parentSlug);
}

export function getPagesByTag(tag: string): PageEntry[] {
  return PAGE_REGISTRY.filter(p => p.tags.includes(tag));
}

export function getDuplicateCandidates(): { tag: string; pages: PageEntry[] }[] {
  const tagMap = new Map<string, PageEntry[]>();
  PAGE_REGISTRY.forEach(page => {
    page.tags.forEach(tag => {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag)!.push(page);
    });
  });

  return Array.from(tagMap.entries())
    .filter(([_, pages]) => pages.length > 1)
    .map(([tag, pages]) => ({ tag, pages }))
    .sort((a, b) => b.pages.length - a.pages.length);
}

export function getRegistrySummary() {
  const total = PAGE_REGISTRY.length;
  const byCategory = Object.keys(PAGE_CATEGORIES).map(cat => ({
    category: cat as PageCategory,
    count: getPagesByCategory(cat as PageCategory).length,
  }));
  const with3D = PAGE_REGISTRY.filter(p => p.has3D).length;
  const withoutBack = PAGE_REGISTRY.filter(p => !p.hasBackButton).length;
  const totalLines = PAGE_REGISTRY.reduce((sum, p) => sum + p.lines, 0);
  const orphaned = PAGE_REGISTRY.filter(p => p.parent && !PAGE_REGISTRY.find(pp => pp.slug === p.parent));

  return { total, byCategory, with3D, withoutBack, totalLines, orphaned };
}
