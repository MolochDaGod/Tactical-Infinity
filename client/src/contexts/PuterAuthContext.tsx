import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  type PuterUser,
  type PlayerData,
  type SaveGameData,
  type GameSettings,
  isPuterAvailable,
  signIn as puterSignIn,
  signOut as puterSignOut,
  isSignedIn as puterIsSignedIn,
  getUser as puterGetUser,
  saveGame as puterSaveGame,
  loadGame as puterLoadGame,
  listSaveGames as puterListSaves,
  deleteSaveGame as puterDeleteSave,
  saveSettings as puterSaveSettings,
  loadSettings as puterLoadSettings,
  getDefaultSettings,
} from "@/lib/puterAuth";
import { kvWorker, type BattleResult, type ResourceHarvestEvent, type LifetimeStats } from "@/lib/puterKvWorker";
import {
  initCloudFolders,
  saveIslandFile,
  loadIslandFile,
  listIslandFiles,
  deleteIslandFile,
  saveScreenshot,
  exportGameFile,
  listExports,
  type IslandSaveFile,
  type GameExportFile,
} from "@/lib/puterCloudStorage";

interface AuthContextValue {
  user: PuterUser | null;
  isLoading: boolean;
  isAvailable: boolean;
  cloudReady: boolean;
  currentSave: SaveGameData | null;
  settings: GameSettings;

  signIn: () => Promise<void>;
  signOut: () => void;
  saveCurrentGame: () => Promise<boolean>;
  loadSave: (playerId: string) => Promise<boolean>;
  listSaves: () => Promise<{ key: string; data: SaveGameData }[]>;
  deleteSave: (playerId: string) => Promise<boolean>;
  updatePlayer: (updates: Partial<PlayerData>) => void;
  updateSettings: (updates: Partial<GameSettings>) => Promise<void>;
  setCurrentSave: (save: SaveGameData | null) => void;

  recordBattle: (result: BattleResult) => Promise<void>;
  recordResourceHarvest: (event: ResourceHarvestEvent) => Promise<void>;
  recordIslandVisit: (islandId: string) => Promise<void>;
  getLifetimeStats: () => Promise<LifetimeStats>;
  getBattleHistory: () => Promise<BattleResult[]>;

  saveIsland: (islandId: string, name: string, data: unknown) => Promise<boolean>;
  loadIsland: (islandId: string) => Promise<IslandSaveFile | null>;
  listIslands: () => Promise<{ id: string; name: string; savedAt: string }[]>;
  deleteIsland: (islandId: string) => Promise<boolean>;
  captureScreenshot: (label: string, canvas: HTMLCanvasElement) => Promise<string | null>;
  exportGame: (type: GameExportFile["type"], payload: unknown) => Promise<string | null>;
  listGameExports: () => Promise<{ path: string; type: string; exportedAt: string }[]>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function PuterAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<PuterUser | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [currentSave, setCurrentSave] = useState<SaveGameData | null>(null);
  const [settings, setSettings]       = useState<GameSettings>(getDefaultSettings());
  const [isAvailable, setIsAvailable] = useState(false);
  const [cloudReady, setCloudReady]   = useState(false);

  const _bootstrapCloud = useCallback(async (save: SaveGameData | null) => {
    const ok = await initCloudFolders();
    setCloudReady(ok);
    if (ok && save) {
      await kvWorker.start(save);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      const available = isPuterAvailable();
      setIsAvailable(available);

      if (available && puterIsSignedIn()) {
        const puterUser = await puterGetUser();
        setUser(puterUser);

        const savedSettings = await puterLoadSettings();
        if (savedSettings) setSettings(savedSettings);

        const saves = await puterListSaves();
        if (saves.length > 0) {
          const latest = saves[saves.length - 1].data;
          setCurrentSave(latest);
          await _bootstrapCloud(latest);
        } else {
          await _bootstrapCloud(null);
        }
      }
      setIsLoading(false);
    };

    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [_bootstrapCloud]);

  useEffect(() => {
    if (currentSave) kvWorker.updateSaveData(currentSave);
  }, [currentSave]);

  const signIn = useCallback(async () => {
    setIsLoading(true);
    const puterUser = await puterSignIn();
    if (puterUser) {
      setUser(puterUser);
      const savedSettings = await puterLoadSettings();
      if (savedSettings) setSettings(savedSettings);
      const saves = await puterListSaves();
      const latest = saves.length > 0 ? saves[saves.length - 1].data : null;
      if (latest) setCurrentSave(latest);
      await _bootstrapCloud(latest);
    }
    setIsLoading(false);
  }, [_bootstrapCloud]);

  const signOut = useCallback(() => {
    kvWorker.stop();
    puterSignOut();
    setUser(null);
    setCurrentSave(null);
    setSettings(getDefaultSettings());
    setCloudReady(false);
  }, []);

  const saveCurrentGame = useCallback(async (): Promise<boolean> => {
    if (!currentSave) return false;
    const updatedSave: SaveGameData = {
      ...currentSave,
      player: { ...currentSave.player, lastPlayedAt: new Date().toISOString() },
      settings,
    };
    const success = await puterSaveGame(updatedSave);
    if (success) setCurrentSave(updatedSave);
    return success;
  }, [currentSave, settings]);

  const loadSave = useCallback(async (playerId: string): Promise<boolean> => {
    const save = await puterLoadGame(playerId);
    if (save) {
      setCurrentSave(save);
      if (save.settings) setSettings(save.settings);
      await kvWorker.start(save);
      return true;
    }
    return false;
  }, []);

  const listSaves = useCallback(() => puterListSaves(), []);

  const deleteSave = useCallback(async (playerId: string): Promise<boolean> => {
    const success = await puterDeleteSave(playerId);
    if (success && currentSave?.player.id === playerId) setCurrentSave(null);
    return success;
  }, [currentSave]);

  const updatePlayer = useCallback((updates: Partial<PlayerData>) => {
    if (!currentSave) return;
    setCurrentSave({ ...currentSave, player: { ...currentSave.player, ...updates } });
  }, [currentSave]);

  const updateSettings = useCallback(async (updates: Partial<GameSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    await puterSaveSettings(newSettings);
  }, [settings]);

  const recordBattle         = useCallback((r: BattleResult)         => kvWorker.recordBattle(r),          []);
  const recordResourceHarvest= useCallback((e: ResourceHarvestEvent) => kvWorker.recordResourceHarvest(e), []);
  const recordIslandVisit    = useCallback((id: string)              => kvWorker.recordIslandVisit(id),    []);
  const getLifetimeStats     = useCallback(()                        => kvWorker.getLifetimeStats(),       []);
  const getBattleHistory     = useCallback(()                        => kvWorker.getBattleHistory(),       []);

  const saveIsland      = useCallback((id: string, name: string, data: unknown) => saveIslandFile(id, name, data), []);
  const loadIsland      = useCallback((id: string) => loadIslandFile(id), []);
  const listIslands     = useCallback(() => listIslandFiles(), []);
  const deleteIsland    = useCallback((id: string) => deleteIslandFile(id), []);
  const captureScreenshot = useCallback((label: string, canvas: HTMLCanvasElement) => saveScreenshot(label, canvas), []);
  const exportGame      = useCallback((type: GameExportFile["type"], payload: unknown) => exportGameFile(type, payload), []);
  const listGameExports = useCallback(() => listExports(), []);

  const value: AuthContextValue = {
    user, isLoading, isAvailable, cloudReady, currentSave, settings,
    signIn, signOut, saveCurrentGame, loadSave, listSaves, deleteSave,
    updatePlayer, updateSettings, setCurrentSave,
    recordBattle, recordResourceHarvest, recordIslandVisit, getLifetimeStats, getBattleHistory,
    saveIsland, loadIsland, listIslands, deleteIsland, captureScreenshot, exportGame, listGameExports,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function usePuterAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("usePuterAuth must be used within PuterAuthProvider");
  return context;
}