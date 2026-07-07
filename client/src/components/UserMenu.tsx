import { useState } from "react";
import { usePuterAuth } from "@/contexts/PuterAuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  User, LogIn, LogOut, Save, FolderOpen, Trash2, 
  Settings, Loader2, Cloud, CloudOff 
} from "lucide-react";
import type { SaveGameData } from "@/lib/puterAuth";

interface UserMenuProps {
  onLoadSave?: (save: SaveGameData) => void;
}

export function UserMenu({ onLoadSave }: UserMenuProps) {
  const { 
    user, 
    isLoading, 
    isAvailable, 
    currentSave,
    signIn, 
    signOut, 
    saveCurrentGame,
    listSaves,
    loadSave,
    deleteSave,
  } = usePuterAuth();

  const [saves, setSaves] = useState<{ key: string; data: SaveGameData }[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showSavesDialog, setShowSavesDialog] = useState(false);

  const handleSignIn = async () => {
    setLoadingAction("signin");
    await signIn();
    setLoadingAction(null);
  };

  const handleSave = async () => {
    if (!currentSave) return;
    setLoadingAction("save");
    await saveCurrentGame();
    setLoadingAction(null);
  };

  const handleOpenSaves = async () => {
    setLoadingAction("list");
    const allSaves = await listSaves();
    setSaves(allSaves);
    setLoadingAction(null);
    setShowSavesDialog(true);
  };

  const handleLoadSave = async (playerId: string, saveData: SaveGameData) => {
    setLoadingAction(`load-${playerId}`);
    const success = await loadSave(playerId);
    if (success && onLoadSave) {
      onLoadSave(saveData);
    }
    setLoadingAction(null);
    setShowSavesDialog(false);
  };

  const handleDeleteSave = async (playerId: string) => {
    if (!confirm("Are you sure you want to delete this save?")) return;
    setLoadingAction(`delete-${playerId}`);
    await deleteSave(playerId);
    const allSaves = await listSaves();
    setSaves(allSaves);
    setLoadingAction(null);
  };

  if (!isAvailable) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <CloudOff className="w-4 h-4" />
        <span>Cloud unavailable</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleSignIn}
        disabled={loadingAction === "signin"}
        data-testid="button-signin"
      >
        {loadingAction === "signin" ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <LogIn className="w-4 h-4 mr-2" />
        )}
        Sign In with Puter
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2" data-testid="button-usermenu">
            <Cloud className="w-4 h-4 text-green-500" />
            <span className="max-w-[100px] truncate">{user.username}</span>
            {user.is_temp && (
              <Badge variant="secondary" className="text-xs">Temp</Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <User className="w-4 h-4" />
            {user.username}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {currentSave && (
            <DropdownMenuItem 
              onClick={handleSave}
              disabled={loadingAction === "save"}
              data-testid="menuitem-save"
            >
              {loadingAction === "save" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Game
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem 
            onClick={handleOpenSaves}
            disabled={loadingAction === "list"}
            data-testid="menuitem-load"
          >
            {loadingAction === "list" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4 mr-2" />
            )}
            Load Game
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={signOut} data-testid="menuitem-signout">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showSavesDialog} onOpenChange={setShowSavesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Your Saved Games</DialogTitle>
            <DialogDescription>
              Select a save to continue your adventure
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {saves.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No saved games found
              </div>
            ) : (
              saves.map(({ key, data }) => (
                <div 
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {data.player.captainName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Level {data.player.level} {data.player.race} ({data.player.faction})
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last played: {new Date(data.player.lastPlayedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleLoadSave(data.player.id, data)}
                      disabled={loadingAction?.startsWith("load")}
                      data-testid={`button-load-${data.player.id}`}
                    >
                      {loadingAction === `load-${data.player.id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Load"
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSave(data.player.id)}
                      disabled={loadingAction?.startsWith("delete")}
                      className="text-destructive"
                      data-testid={`button-delete-${data.player.id}`}
                    >
                      {loadingAction === `delete-${data.player.id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
