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
}

export default function Home({ battlesWon, onStartBattle, onViewRoster, onViewCodex, onViewBarracks, onViewIslands, onViewAdmin, onViewWorldMap }: HomeProps) {
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
    />
  );
}
