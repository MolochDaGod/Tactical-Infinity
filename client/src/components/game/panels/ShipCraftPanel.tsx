/**
 * Main-panel Ships tab — production water engagement:
 *   • Raft = quick craft + multi-attachment loadout
 *   • Dock hulls listed for status; construction is at Boat Dock RTS building
 */

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Anchor, Hammer, Ship, Check, Lock } from 'lucide-react';
import {
  RAFT_QUICK_CRAFT,
  DOCK_SHIP_RECIPES,
  attachmentsForSlot,
  getRaftAttachment,
  type RaftAttachmentSlot,
  type RaftAttachmentId,
} from '@shared/gameDefinitions/waterEngagement';
import type { BoatId } from '@shared/gameDefinitions/boatRegistry';
import {
  canBuildBoat,
  getRaftLoadout,
  isBoatDockBuilt,
  isRaftBuilt,
  loadProgression,
  markBoatBuilt,
  markRaftBuilt,
  setActiveBoat,
  setRaftAttachment,
} from '@/lib/playerProgression';

const SLOTS: RaftAttachmentSlot[] = ['sail', 'mast', 'storage', 'utility', 'mooring', 'canopy'];

const SLOT_LABEL: Record<RaftAttachmentSlot, string> = {
  sail: 'Sail',
  mast: 'Mast',
  storage: 'Storage',
  utility: 'Utility',
  mooring: 'Mooring',
  canopy: 'Canopy',
};

export interface ShipCraftPanelProps {
  /** Optional mission resources (home island harvest). Falls back to zeros. */
  resources?: { wood?: number; hemp?: number; stone?: number; gold?: number };
  onRaftBuilt?: () => void;
  onOpenBoatYard?: () => void;
}

export function ShipCraftPanel({
  resources = {},
  onRaftBuilt,
  onOpenBoatYard,
}: ShipCraftPanelProps) {
  const [, tick] = useState(0);
  const refresh = useCallback(() => tick((n) => n + 1), []);

  const prog = loadProgression();
  const raftBuilt = isRaftBuilt();
  const dockBuilt = isBoatDockBuilt();
  const loadout = getRaftLoadout();

  const wood = resources.wood ?? 0;
  const hemp = resources.hemp ?? 0;
  const stone = resources.stone ?? 0;
  const gold = resources.gold ?? 0;

  const canCraftRaft =
    !raftBuilt &&
    wood >= RAFT_QUICK_CRAFT.wood &&
    hemp >= RAFT_QUICK_CRAFT.hemp &&
    stone >= RAFT_QUICK_CRAFT.stone;

  const craftRaft = () => {
    if (!canCraftRaft && !raftBuilt) return;
    markRaftBuilt();
    onRaftBuilt?.();
    refresh();
  };

  const equip = (slot: RaftAttachmentSlot, id: RaftAttachmentId) => {
    if (!raftBuilt) return;
    setRaftAttachment(slot, id);
    refresh();
  };

  const owned = useMemo(() => new Set(prog.builtBoats), [prog.builtBoats]);

  return (
    <ScrollArea className="h-full pr-2" data-testid="panel-ship-craft">
      <div className="space-y-5 pb-4">
        {/* ── Raft quick craft ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Hammer className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-100">Raft — Quick Craft</h3>
            {raftBuilt ? (
              <Badge className="bg-green-800/60 text-green-200 border-green-600/40">Built</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-300 border-amber-500/40">
                Main panel
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Build your starter hull here (not from the RTS hammer). Attach sails, barrels, mooring,
            and more after it is craftable.
          </p>

          {!raftBuilt && (
            <div className="rounded-lg border border-amber-500/25 bg-black/40 p-3 space-y-2 mb-3">
              {(
                [
                  ['Wood', wood, RAFT_QUICK_CRAFT.wood],
                  ['Hemp', hemp, RAFT_QUICK_CRAFT.hemp],
                  ['Stone', stone, RAFT_QUICK_CRAFT.stone],
                ] as const
              ).map(([label, have, need]) => (
                <div key={label} className="space-y-0.5">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>{label}</span>
                    <span className={have >= need ? 'text-green-400' : 'text-amber-300'}>
                      {have}/{need}
                    </span>
                  </div>
                  <Progress value={Math.min(100, (have / need) * 100)} className="h-1 bg-white/10" />
                </div>
              ))}
              <Button
                className="w-full mt-2"
                disabled={!canCraftRaft}
                onClick={craftRaft}
                data-testid="button-quick-craft-raft"
              >
                <Ship className="w-4 h-4 mr-2" />
                {canCraftRaft ? 'Craft Sailed Raft' : 'Gather materials'}
              </Button>
            </div>
          )}

          {raftBuilt && (
            <div className="space-y-3">
              <p className="text-[11px] text-green-400/90 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Raft ready — equip attachments below
              </p>
              {SLOTS.map((slot) => {
                const options = attachmentsForSlot(slot);
                const current = loadout[slot];
                return (
                  <div key={slot} className="rounded-md border border-white/10 bg-slate-900/50 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                      {SLOT_LABEL[slot]}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {options.map((opt) => {
                        const selected = current === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => equip(slot, opt.id)}
                            title={opt.description}
                            className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                              selected
                                ? 'border-amber-400 bg-amber-900/40 text-amber-100'
                                : 'border-white/15 bg-black/30 text-slate-300 hover:border-amber-500/40'
                            }`}
                            data-testid={`raft-attach-${opt.id}`}
                          >
                            {opt.name}
                          </button>
                        );
                      })}
                    </div>
                    {current && (
                      <p className="text-[10px] text-slate-500 mt-1.5">
                        {getRaftAttachment(current)?.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <Separator className="bg-white/10" />

        {/* ── Boat dock hulls ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Anchor className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-sky-100">Ship tiers — Boat Dock</h3>
            {dockBuilt ? (
              <Badge className="bg-sky-900/50 text-sky-200 border-sky-600/40">Dock online</Badge>
            ) : (
              <Badge variant="outline" className="text-slate-400 border-slate-600">
                Place Boat Dock (RTS)
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3">
            The other five hulls are constructed at a <strong className="text-slate-200">Boat Dock</strong>{' '}
            RTS building (hammer → Harbor). Place it on a shore across any of the 9 ocean sectors.
          </p>

          {!dockBuilt && (
            <div className="rounded-lg border border-sky-500/20 bg-sky-950/30 p-3 text-xs text-slate-300 mb-3">
              Build menu → Harbor → <span className="text-sky-300 font-medium">Boat Dock</span>
              {onOpenBoatYard && (
                <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={onOpenBoatYard}>
                  Open boat yard
                </Button>
              )}
            </div>
          )}

          <div className="space-y-2">
            {DOCK_SHIP_RECIPES.map((recipe) => {
              const id = recipe.hull as BoatId;
              const has = owned.has(id);
              const can = canBuildBoat(id);
              const active = prog.activeBoatId === id;
              return (
                <div
                  key={id}
                  className={`rounded-lg border p-3 ${
                    has
                      ? 'border-green-600/30 bg-green-950/20'
                      : can
                        ? 'border-sky-500/30 bg-sky-950/25'
                        : 'border-white/10 bg-black/30 opacity-80'
                  }`}
                  data-testid={`dock-hull-${id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{recipe.displayName}</span>
                        <Badge variant="outline" className="text-[10px]">
                          T{recipe.tier}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{recipe.description}</p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Cost: {recipe.cost.wood}w · {recipe.cost.stone}s · {recipe.cost.ore}ore ·{' '}
                        {recipe.cost.gold}g
                        {recipe.cost.hemp ? ` · ${recipe.cost.hemp} hemp` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {has ? (
                        <>
                          <Badge className="bg-green-800/50 text-green-200">Owned</Badge>
                          <Button
                            size="sm"
                            variant={active ? 'default' : 'outline'}
                            className="h-7 text-[11px]"
                            onClick={() => {
                              setActiveBoat(id);
                              refresh();
                            }}
                          >
                            {active ? 'Active' : 'Set active'}
                          </Button>
                        </>
                      ) : can ? (
                        <Button
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            markBoatBuilt(id);
                            refresh();
                          }}
                          data-testid={`button-build-hull-${id}`}
                        >
                          Build at dock
                        </Button>
                      ) : (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          {!dockBuilt
                            ? 'Needs dock'
                            : !raftBuilt
                              ? 'Needs raft'
                              : 'Locked'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
