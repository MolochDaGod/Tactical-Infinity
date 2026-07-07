declare global {
  interface Window {
    puter: {
      auth: {
        signIn: () => Promise<{ username: string }>;
        signOut: () => void;
        isSignedIn: () => boolean;
        getUser: () => Promise<PuterUser>;
      };
      kv: {
        set: (key: string, value: unknown) => Promise<void>;
        get: (key: string) => Promise<unknown>;
        del: (key: string) => Promise<void>;
        list: (options?: { prefix?: string }) => Promise<{ key: string; value: unknown }[]>;
      };
      fs: {
        write: (path: string, content: string | Blob) => Promise<void>;
        read: (path: string) => Promise<Blob>;
        mkdir: (path: string) => Promise<void>;
        readdir: (path: string) => Promise<{ name: string; is_dir: boolean }[]>;
        delete: (path: string) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
      };
      ai: {
        chat: (prompt: string, options?: { model?: string }) => Promise<string | { message: { content: string } }>;
        txt2img: (prompt: string, options?: {
          testMode?: boolean;
          model?: string;
          width?: number;
          height?: number;
          steps?: number;
          seed?: number;
          negative_prompt?: string;
          disable_safety_checker?: boolean;
        }) => Promise<HTMLImageElement | { src: string }>;
      };
    };
  }
}

export interface PuterUser {
  username: string;
  uuid: string;
  email?: string;
  email_confirmed?: boolean;
  is_temp?: boolean;
}

export interface PlayerData {
  id: string;
  username: string;
  faction: "crusade" | "fabled" | "legion";
  race: string;
  captainName: string;
  gold: number;
  reputation: number;
  level: number;
  experience: number;
  createdAt: string;
  lastPlayedAt: string;
}

export interface ShipData {
  id: string;
  name: string;
  type: "sloop" | "brigantine" | "galleon" | "man-o-war";
  health: number;
  maxHealth: number;
  cannons: number;
  crew: number;
  maxCrew: number;
  speed: number;
  customTextures?: Record<string, string>;
}

export interface UnitData {
  id: string;
  name: string;
  race: string;
  unitClass: "warrior" | "ranger" | "mage" | "worge";
  level: number;
  experience: number;
  stats: {
    health: number;
    strength: number;
    defense: number;
    speed: number;
    magic: number;
  };
  equipment: Record<string, string>;
  skills: string[];
}

export interface IslandData {
  id: string;
  name: string;
  buildings: {
    type: string;
    position: { x: number; z: number };
    level: number;
  }[];
  resources: Record<string, number>;
}

export interface SaveGameData {
  player: PlayerData;
  ships: ShipData[];
  units: UnitData[];
  islands: IslandData[];
  settings: GameSettings;
  version: string;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  graphicsQuality: "low" | "medium" | "high" | "ultra";
  showTutorials: boolean;
  cameraSpeed: number;
}

const SAVE_KEY_PREFIX = "tethical_";
const CURRENT_VERSION = "1.0.0";

export function isPuterAvailable(): boolean {
  return typeof window !== "undefined" && !!window.puter;
}

export async function signIn(): Promise<PuterUser | null> {
  if (!isPuterAvailable()) {
    console.warn("Puter.js not loaded");
    return null;
  }
  
  try {
    await window.puter.auth.signIn();
    const user = await window.puter.auth.getUser();
    return user;
  } catch (error) {
    console.error("Puter sign in failed:", error);
    return null;
  }
}

export function signOut(): void {
  if (!isPuterAvailable()) return;
  window.puter.auth.signOut();
}

export function isSignedIn(): boolean {
  if (!isPuterAvailable()) return false;
  return window.puter.auth.isSignedIn();
}

export async function getUser(): Promise<PuterUser | null> {
  if (!isPuterAvailable() || !isSignedIn()) return null;
  
  try {
    return await window.puter.auth.getUser();
  } catch {
    return null;
  }
}

export async function saveGame(data: SaveGameData): Promise<boolean> {
  if (!isPuterAvailable() || !isSignedIn()) {
    console.warn("Must be signed in to save");
    return false;
  }
  
  try {
    const key = `${SAVE_KEY_PREFIX}save_${data.player.id}`;
    const saveData = {
      ...data,
      version: CURRENT_VERSION,
      savedAt: new Date().toISOString(),
    };
    await window.puter.kv.set(key, saveData);
    return true;
  } catch (error) {
    console.error("Failed to save game:", error);
    return false;
  }
}

export async function loadGame(playerId: string): Promise<SaveGameData | null> {
  if (!isPuterAvailable() || !isSignedIn()) return null;
  
  try {
    const key = `${SAVE_KEY_PREFIX}save_${playerId}`;
    const data = await window.puter.kv.get(key);
    return data as SaveGameData | null;
  } catch (error) {
    console.error("Failed to load game:", error);
    return null;
  }
}

export async function listSaveGames(): Promise<{ key: string; data: SaveGameData }[]> {
  if (!isPuterAvailable() || !isSignedIn()) return [];
  
  try {
    const saves = await window.puter.kv.list({ prefix: `${SAVE_KEY_PREFIX}save_` });
    return saves.map((s) => ({
      key: s.key,
      data: s.value as SaveGameData,
    }));
  } catch (error) {
    console.error("Failed to list saves:", error);
    return [];
  }
}

export async function deleteSaveGame(playerId: string): Promise<boolean> {
  if (!isPuterAvailable() || !isSignedIn()) return false;
  
  try {
    const key = `${SAVE_KEY_PREFIX}save_${playerId}`;
    await window.puter.kv.del(key);
    return true;
  } catch (error) {
    console.error("Failed to delete save:", error);
    return false;
  }
}

export async function saveSettings(settings: GameSettings): Promise<boolean> {
  if (!isPuterAvailable() || !isSignedIn()) return false;
  
  try {
    await window.puter.kv.set(`${SAVE_KEY_PREFIX}settings`, settings);
    return true;
  } catch {
    return false;
  }
}

export async function loadSettings(): Promise<GameSettings | null> {
  if (!isPuterAvailable() || !isSignedIn()) return null;
  
  try {
    const settings = await window.puter.kv.get(`${SAVE_KEY_PREFIX}settings`);
    return settings as GameSettings | null;
  } catch {
    return null;
  }
}

export function getDefaultSettings(): GameSettings {
  return {
    musicVolume: 0.7,
    sfxVolume: 0.8,
    graphicsQuality: "high",
    showTutorials: true,
    cameraSpeed: 1,
  };
}

export function createNewPlayer(username: string, faction: "crusade" | "fabled" | "legion", race: string, captainName: string): PlayerData {
  return {
    id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    username,
    faction,
    race,
    captainName,
    gold: 1000,
    reputation: 0,
    level: 1,
    experience: 0,
    createdAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
  };
}

export function createStarterShip(playerFaction: string): ShipData {
  return {
    id: `ship_${Date.now()}`,
    name: "The Wanderer",
    type: "sloop",
    health: 100,
    maxHealth: 100,
    cannons: 4,
    crew: 8,
    maxCrew: 12,
    speed: 10,
  };
}

export function createStarterUnit(race: string, unitClass: "warrior" | "ranger" | "mage" | "worge"): UnitData {
  const baseStats = {
    warrior: { health: 120, strength: 15, defense: 12, speed: 8, magic: 3 },
    ranger: { health: 80, strength: 10, defense: 6, speed: 14, magic: 5 },
    mage: { health: 60, strength: 5, defense: 4, speed: 10, magic: 18 },
    worge: { health: 100, strength: 12, defense: 10, speed: 12, magic: 8 },
  };
  
  return {
    id: `unit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name: `${race} ${unitClass}`,
    race,
    unitClass,
    level: 1,
    experience: 0,
    stats: baseStats[unitClass],
    equipment: {},
    skills: [],
  };
}

export function createStarterIsland(): IslandData {
  return {
    id: `island_${Date.now()}`,
    name: "Haven Isle",
    buildings: [
      { type: "dock", position: { x: 0, z: 5 }, level: 1 },
      { type: "barracks", position: { x: -3, z: 0 }, level: 1 },
    ],
    resources: {
      wood: 500,
      stone: 300,
      iron: 100,
      food: 200,
    },
  };
}

export async function uploadShipTexture(shipId: string, textureName: string, imageBlob: Blob): Promise<string | null> {
  if (!isPuterAvailable() || !isSignedIn()) return null;
  
  try {
    const path = `/tethical/ships/${shipId}/${textureName}.png`;
    await window.puter.fs.write(path, imageBlob);
    return path;
  } catch (error) {
    console.error("Failed to upload texture:", error);
    return null;
  }
}

export async function generateAITexture(prompt: string): Promise<string | null> {
  if (!isPuterAvailable()) return null;
  
  try {
    const result = await window.puter.ai.txt2img(prompt);
    return result.src;
  } catch (error) {
    console.error("Failed to generate AI texture:", error);
    return null;
  }
}

export async function generateNPCDialogue(context: string, personality: string): Promise<string | null> {
  if (!isPuterAvailable()) return null;
  
  try {
    const prompt = `You are an NPC in a fantasy sailing game. Your personality: ${personality}. Context: ${context}. Respond in character with 1-2 sentences.`;
    const response = await window.puter.ai.chat(prompt);
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object' && 'message' in (response as any)) {
      return (response as any).message?.content ?? null;
    }
    return null;
  } catch (error) {
    console.error("Failed to generate dialogue:", error);
    return null;
  }
}
