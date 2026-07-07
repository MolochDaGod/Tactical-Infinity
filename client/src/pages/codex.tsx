import { LoreCodex } from "@/components/game/LoreCodex";

interface CodexPageProps {
  unlockedEntries?: string[];
  onBack: () => void;
}

export default function CodexPage({ unlockedEntries, onBack }: CodexPageProps) {
  return (
    <div className="h-screen w-full overflow-hidden" style={{ background: "#1a0e08" }}>
      <LoreCodex unlockedEntries={unlockedEntries} onBack={onBack} />
    </div>
  );
}
