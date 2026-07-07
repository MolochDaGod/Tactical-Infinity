// Single source of truth for every page in Tethical.
// Maps the internal `GamePhase` machine to a URL slug, a title, and a
// category so the UI, the URL bar, and any future site map all agree.
//
// Adding a new page?
//   1. Add an entry here.
//   2. Add a `phase === "<id>"` branch in App.tsx.
//   3. Done — slug, title, and direct linking work automatically.

export type PageCategory = "menu" | "overworld" | "battle" | "character" | "social" | "lore" | "admin" | "dev";

export interface PageMeta {
  /** Internal phase id used by useGameState. */
  phase: string;
  /** URL slug (must start with `/`). */
  slug: string;
  /** Human-readable title shown in tab + page header. */
  title: string;
  /** Short blurb. */
  description: string;
  /** Category for grouping in nav / site map. */
  category: PageCategory;
  /** Whether the page is reachable from the main menu (vs dev-only). */
  publicNav: boolean;
}

export const PAGE_REGISTRY: PageMeta[] = [
  // ── Menu ──────────────────────────────────────────────────────────────────
  { phase: "menu",            slug: "/",                    title: "Tethical — Grudge Warlords",  description: "Main menu",                                  category: "menu",     publicNav: true },

  // ── Overworld ─────────────────────────────────────────────────────────────
  { phase: "sailing",         slug: "/sailing",             title: "Open Water",                  description: "3D sailing & ship combat",                   category: "overworld", publicNav: true },
  { phase: "productionisland",slug: "/island",              title: "Island",                      description: "Land exploration, harvesting, crafting",     category: "overworld", publicNav: true },
  { phase: "worldmap",        slug: "/world-map",           title: "World Map",                   description: "Faction territory map of Aethermoor",        category: "overworld", publicNav: true },
  { phase: "islands",         slug: "/islands",             title: "Islands Browser",             description: "Pick an island to visit",                    category: "overworld", publicNav: true },
  { phase: "beachSpawn",      slug: "/beach-spawn",         title: "Beach Spawn",                 description: "Beach landing scene",                        category: "overworld", publicNav: false },
  { phase: "islandlanding",   slug: "/island-landing",      title: "Docking",                     description: "Drop anchor and dock at an island",          category: "overworld", publicNav: false },
  { phase: "islandexplore",   slug: "/island-explore",      title: "Island Exploration",          description: "Explore a landed island on foot",            category: "overworld", publicNav: false },

  // ── Battle ────────────────────────────────────────────────────────────────
  { phase: "battle",          slug: "/battle",              title: "Battle",                      description: "Tactical island battle",                     category: "battle",    publicNav: true },
  { phase: "battlegrounds",   slug: "/battlegrounds",       title: "Battlegrounds",               description: "PvP/encounter selector",                     category: "battle",    publicNav: true },
  { phase: "playerarena",     slug: "/player-arena",        title: "Player Arena",                description: "Solo arena combat",                          category: "battle",    publicNav: false },

  // ── Character / Loadout ───────────────────────────────────────────────────
  { phase: "captain",         slug: "/captain-creation",    title: "Create Captain",              description: "Race / class / appearance setup",            category: "character", publicNav: true },
  { phase: "classtree",       slug: "/class-tree",          title: "Class & Skill Tree",          description: "Race · class · skill codex",                 category: "character", publicNav: true },
  { phase: "barracks",        slug: "/barracks",            title: "Barracks",                    description: "Manage units & formations",                  category: "character", publicNav: true },
  { phase: "roster",          slug: "/roster",              title: "Roster",                      description: "Pick units for the next battle",             category: "character", publicNav: true },
  { phase: "equipment",       slug: "/equipment",           title: "Equipment Loadout",           description: "12-slot loadout panel for all races",        category: "character", publicNav: true },
  { phase: "raceviewer",      slug: "/race-viewer",         title: "Race Character Viewer",       description: "3D race + class browser",                    category: "character", publicNav: false },
  { phase: "unitviewer",      slug: "/units",               title: "Unit Builds",                 description: "Faction starting builds + baked animations", category: "character", publicNav: true },

  // ── Social / Lore ─────────────────────────────────────────────────────────
  { phase: "chat",            slug: "/chat",                title: "Chat",                        description: "Tavern chat",                                category: "social",    publicNav: true },
  { phase: "codex",           slug: "/codex",               title: "Lore Codex",                  description: "World, factions, & ancestry codex",          category: "lore",      publicNav: true },
  { phase: "intro",           slug: "/intro",               title: "Intro Cinematic",             description: "Opening cinematic",                          category: "lore",      publicNav: false },

  // ── Admin / Dev tools ─────────────────────────────────────────────────────
  { phase: "admin",           slug: "/admin",               title: "Admin",                       description: "Dev tools hub",                              category: "admin",     publicNav: false },
  { phase: "adminmap",        slug: "/admin/map",           title: "Admin · Map",                 description: "World map editor",                           category: "admin",     publicNav: false },
  { phase: "adminassets",     slug: "/admin/assets",        title: "Admin · Assets",              description: "Asset browser",                              category: "admin",     publicNav: false },
  { phase: "adminsprites",    slug: "/admin/sprites",       title: "Admin · Sprites",             description: "Sprite catalogue",                           category: "admin",     publicNav: false },
  { phase: "assetregistry",   slug: "/admin/asset-registry",title: "Admin · Asset Registry",      description: "Stylized + extracted asset registry",        category: "admin",     publicNav: false },
  { phase: "islandeditor",    slug: "/admin/island-editor", title: "Admin · Island Editor",       description: "Terrain painting & object placement",        category: "admin",     publicNav: false },
  { phase: "buildertest",     slug: "/admin/builder-test",  title: "Admin · Builder Test",        description: "Procedural builder test bench",              category: "admin",     publicNav: false },
  { phase: "pixyfx",          slug: "/admin/pixy-fx",       title: "Admin · Pixi FX",             description: "Pixi particle FX showcase",                  category: "admin",     publicNav: false },
  { phase: "polygonjs",       slug: "/admin/polygon-js",    title: "Admin · Polygon JS",          description: "Polygon JS scene demo",                      category: "admin",     publicNav: false },
  { phase: "turretdemo",      slug: "/admin/turret-demo",   title: "Admin · Turret Demo",         description: "Turret targeting demo",                      category: "admin",     publicNav: false },
  { phase: "videogen",        slug: "/admin/video-gen",     title: "Admin · Video Generator",     description: "AI video generation",                        category: "admin",     publicNav: false },
  { phase: "shipeditor",      slug: "/ship-editor",         title: "Ship Editor",                 description: "Ship loadout editor",                        category: "dev",       publicNav: false },
  { phase: "grudgetest",      slug: "/grudge-controller-test", title: "Grudge Controller Test",   description: "Grudge SDK harness",                         category: "dev",       publicNav: false },
];

// ── Lookup helpers ──────────────────────────────────────────────────────────
const BY_SLUG  = new Map(PAGE_REGISTRY.map((p) => [p.slug.toLowerCase(), p]));
const BY_PHASE = new Map(PAGE_REGISTRY.map((p) => [p.phase, p]));

export function getPageBySlug(slug: string): PageMeta | undefined {
  // Normalize: strip trailing slash, lowercase, collapse double slashes.
  const s = slug.toLowerCase().replace(/\/+$/, "") || "/";
  return BY_SLUG.get(s);
}

export function getPageByPhase(phase: string): PageMeta | undefined {
  return BY_PHASE.get(phase);
}

export function getPagesByCategory(): Record<PageCategory, PageMeta[]> {
  const out: Partial<Record<PageCategory, PageMeta[]>> = {};
  for (const p of PAGE_REGISTRY) {
    (out[p.category] ??= []).push(p);
  }
  return out as Record<PageCategory, PageMeta[]>;
}

/** Console-friendly site map. Call from devtools: `printSiteMap()`. */
export function printSiteMap(): void {
  // eslint-disable-next-line no-console
  console.groupCollapsed("%cTethical site map", "color:#f59e0b;font-weight:bold");
  const grouped = getPagesByCategory();
  for (const [cat, pages] of Object.entries(grouped)) {
    // eslint-disable-next-line no-console
    console.groupCollapsed(`%c${cat.toUpperCase()} (${pages.length})`, "color:#fbbf24");
    for (const p of pages) {
      // eslint-disable-next-line no-console
      console.log(`%c${p.slug.padEnd(28)}%c ${p.title}`, "color:#7dd3fc;font-family:monospace", "color:inherit");
    }
    // eslint-disable-next-line no-console
    console.groupEnd();
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
}

if (typeof window !== "undefined") {
  (window as any).printSiteMap = printSiteMap;
  (window as any).PAGE_REGISTRY = PAGE_REGISTRY;
}
