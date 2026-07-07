import { MainMenu } from "@/components/game/MainMenu";

interface HomeProps {
  battlesWon: number;
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

export default function Home({ battlesWon, onStartBattle, onViewRoster, onViewCodex, onViewBarracks, onViewIslands, onViewAdmin, onViewWorldMap, onViewCaptain, onViewGrudgeTest, onViewShipEditor, onTestIntro, onViewChat, onViewPlayerArena, onViewSailing, onViewProductionIsland, onViewEquipment, onViewClassTree }: HomeProps) {
  return (
    <MainMenu
      battlesWon={battlesWon}
      onStartBattle={onStartBattle}
      onViewRoster={onViewRoster}
      onViewCodex={onViewCodex}
      onViewBarracks={onViewBarracks}
      onViewIslands={onViewIslands}
      onViewAdmin={onViewAdmin}
      onViewWorldMap={onViewWorldMap}
      onViewCaptain={onViewCaptain}
      onViewGrudgeTest={onViewGrudgeTest}
      onViewShipEditor={onViewShipEditor}
      onTestIntro={onTestIntro}
      onViewChat={onViewChat}
      onViewPlayerArena={onViewPlayerArena}
      onViewSailing={onViewSailing}
      onViewProductionIsland={onViewProductionIsland}
      onViewEquipment={onViewEquipment}
      onViewClassTree={onViewClassTree}
    />
  );
}
