import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Anchor, Hammer, Ship, TreePine, Mountain, Leaf } from 'lucide-react';
import {
  RAFT_RECIPE,
  type MissionResources,
} from '@/lib/islandStarterMission';

interface StarterRaftPanelProps {
  resources: MissionResources;
  raftBuilt: boolean;
  canBuild: boolean;
  onBuild: () => void;
  onSetSail?: () => void;
}

function ResourceRow({
  label,
  have,
  need,
  icon,
}: {
  label: string;
  have: number;
  need: number;
  icon: React.ReactNode;
}) {
  const pct = need > 0 ? Math.min(100, (have / need) * 100) : 100;
  const done = have >= need;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-white/80">
        <span className="flex items-center gap-1.5">{icon}{label}</span>
        <span className={done ? 'text-green-400' : 'text-amber-300'}>{have}/{need}</span>
      </div>
      <Progress value={pct} className="h-1.5 bg-white/10" />
    </div>
  );
}

export function StarterRaftPanel({
  resources,
  raftBuilt,
  canBuild,
  onBuild,
  onSetSail,
}: StarterRaftPanelProps) {
  if (raftBuilt) {
    return (
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[min(420px,92vw)]"
        data-testid="panel-raft-complete"
      >
        <div className="bg-black/75 backdrop-blur-md rounded-xl border border-green-500/40 px-5 py-4 shadow-lg">
          <div className="flex items-center gap-2 mb-2 text-green-300 font-semibold">
            <Ship className="w-5 h-5" />
            Sailed Raft Ready
          </div>
          <p className="text-sm text-white/70 mb-3">
            Your patchwork sail is rigged. Walk to the dock and press <kbd className="px-1 bg-white/15 rounded font-mono text-xs">F</kbd> to set sail, or use the button below.
          </p>
          {onSetSail && (
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={onSetSail}
              data-testid="button-set-sail-raft"
            >
              <Anchor className="w-4 h-4 mr-2" />
              Set Sail to World Map
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[min(420px,92vw)]"
      data-testid="panel-build-raft"
    >
      <div className="bg-black/75 backdrop-blur-md rounded-xl border border-amber-500/35 px-5 py-4 shadow-lg">
        <div className="flex items-center gap-2 mb-1 text-amber-300 font-semibold">
          <Hammer className="w-5 h-5" />
          Build Your First Boat
        </div>
        <p className="text-xs text-white/60 mb-3">
          Harvest nodes with <kbd className="px-1 bg-white/15 rounded font-mono">E</kbd> — then craft a sailed raft before the larger hulls unlock.
        </p>
        <div className="space-y-2 mb-4">
          <ResourceRow label="Wood" have={resources.wood} need={RAFT_RECIPE.wood} icon={<TreePine className="w-3.5 h-3.5 text-green-500" />} />
          <ResourceRow label="Hemp" have={resources.hemp} need={RAFT_RECIPE.hemp} icon={<Leaf className="w-3.5 h-3.5 text-lime-400" />} />
          <ResourceRow label="Stone" have={resources.stone} need={RAFT_RECIPE.stone} icon={<Mountain className="w-3.5 h-3.5 text-stone-400" />} />
        </div>
        <Button
          className="w-full"
          disabled={!canBuild}
          onClick={onBuild}
          data-testid="button-build-raft"
        >
          <Hammer className="w-4 h-4 mr-2" />
          {canBuild ? 'Build Sailed Raft' : 'Gather Materials'}
        </Button>
      </div>
    </div>
  );
}