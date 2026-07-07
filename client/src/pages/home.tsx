import { MainMenu } from "@/components/game/MainMenu";

interface HomeProps {
  battlesWon: number;
  onPlayGame?: () => void;
  playLabel?: string;
  playHint?: string;
  onStartBattle: () => void;
  onViewRoster: () => void;
  onViewCodex: () => void;
  onViewBarracks: () => void;
  onViewIslands?: () => void;
  onViewAdmin?: () => void;
  onViewWorldMap?: () => void;
  onViewCaptain?: () => void;
  onViewGrudgeTest?: () => void;
  onViewShipEditor?: () => void;
  onTestIntro?: () => void;
  onViewChat?: () => void;
  onViewPlayerArena?: () => void;
  onViewSailing?: () => void;
  onViewProductionIsland?: () => void;
  onViewEquipment?: () => void;
  onViewClassTree?: () => void;
}

export default function Home({
  battlesWon,
  onPlayGame,
  playLabel,
  playHint,
  onStartBattle,
  onViewRoster,
  onViewCodex,
  onViewBarracks,
  onViewIslands,
  onViewAdmin,
  onViewWorldMap,
  onViewProductionIsland,
}: HomeProps) {
  return (
    <MainMenu
      battlesWon={battlesWon}
      onPlayGame={onPlayGame}
      playLabel={playLabel}
      playHint={playHint}
      onStartBattle={onStartBattle}
      onViewRoster={onViewRoster}
      onViewCodex={onViewCodex}
      onViewBarracks={onViewBarracks}
      onViewIslands={onViewIslands}
      onViewAdmin={onViewAdmin}
      onViewWorldMap={onViewWorldMap}
      onViewProductionIsland={onViewProductionIsland}
    />
  );
}
