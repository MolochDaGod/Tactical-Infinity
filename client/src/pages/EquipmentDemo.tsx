import { useEffect, useMemo, useState } from "react";
import EquipmentPanel, { type RaceKey, type EquippedMap, type SlotId } from "@/components/EquipmentPanel";
import gruda1 from "@/assets/lore/gruda1_1777036182198.png";
import {
  type GearItem,
  type GearSlot,
  PAPERDOLL_SLOT_TO_GEAR,
} from "@shared/gameDefinitions/gear";
import {
  loadGearCatalogue,
  localCatalogue,
  gearForSlot,
  gearById,
} from "@/lib/gear/catalogue";
import {
  getLoadout,
  setSlot,
  setLoadout,
  subscribeLoadout,
  PLAYER_LOADOUT_ID,
  type Loadout,
} from "@/lib/gear/loadout";

const RACES: RaceKey[] = ["human", "barbarian", "dwarf", "elf", "orc", "undead"];

// Which paperdoll slot displays each canonical gear slot. (The paperdoll has no
// dedicated shoulders slot, so shoulders gear simply isn't surfaced in this UI —
// the underlying gear system still supports it.)
const GEAR_TO_PAPERDOLL: Partial<Record<GearSlot, SlotId>> = {
  weapon: "weapon",
  offhand: "offhand",
  head: "helmet",
  chest: "chest",
  hands: "gloves",
  legs: "legs",
  feet: "boots",
  cape: "cloak",
  accessory: "amulet",
};

// Quick-fill presets (real catalogue ids from the local fallback catalogue).
const STARTER_PRESET: Loadout = { weapon: "w_sword", chest: "a_chest", feet: "a_boots" };
const VETERAN_PRESET: Loadout = {
  weapon: "w_greatsword",
  offhand: "o_roman_shield",
  head: "a_helm",
  shoulders: "a_pauldrons",
  chest: "a_chest",
  hands: "a_gauntlets",
  feet: "a_boots",
  cape: "a_cape",
  accessory: "acc_crown",
};

interface EquipmentDemoProps {
  onBack?: () => void;
}

export default function EquipmentDemo({ onBack }: EquipmentDemoProps) {
  const [debugGrid, setDebugGrid] = useState(false);
  const [selectedRace, setSelectedRace] = useState<RaceKey>("human");
  const [catalogue, setCatalogue] = useState<GearItem[]>(() => localCatalogue());
  const [lastAction, setLastAction] = useState<string>("");
  const [, forceTick] = useState(0);

  // Edit the SAME loadout the in-game 3D player reads, so equipping here drives
  // the character in IslandBattle. The race picker only swaps the preview portrait.
  const characterId = PLAYER_LOADOUT_ID;

  // Load the hub-backed catalogue (falls back to local assets).
  useEffect(() => {
    let live = true;
    loadGearCatalogue().then((c) => { if (live) setCatalogue(c); }).catch(() => {});
    return () => { live = false; };
  }, []);

  // Re-render on any persisted loadout change.
  useEffect(() => subscribeLoadout(() => forceTick((n) => n + 1)), []);

  const loadout = getLoadout(characterId);

  const equipped: EquippedMap = useMemo(() => {
    const map: EquippedMap = {};
    for (const [slot, id] of Object.entries(loadout)) {
      const item = gearById(catalogue, id);
      const paperdollSlot = GEAR_TO_PAPERDOLL[slot as GearSlot];
      if (!item || !paperdollSlot) continue;
      map[paperdollSlot] = {
        name: item.name,
        rarity: item.rarity,
        iconUrl: item.icon,
      };
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue, JSON.stringify(loadout)]);

  const equippedCount = Object.keys(loadout).length;

  // Clicking a slot cycles: empty → item 0 → item 1 → … → empty. Each change
  // persists to localStorage immediately (survives reload + scene changes).
  const handleSlotClick = (paperdollSlot: SlotId) => {
    const gearSlot = PAPERDOLL_SLOT_TO_GEAR[paperdollSlot];
    if (!gearSlot) { setLastAction(`No gear maps to "${paperdollSlot}"`); return; }
    const options = gearForSlot(catalogue, gearSlot);
    if (options.length === 0) { setLastAction(`No ${gearSlot} gear in catalogue`); return; }
    const currentId = loadout[gearSlot];
    const idx = options.findIndex((g) => g.id === currentId);
    const next = options[idx + 1]; // undefined once we pass the end → unequip
    setSlot(characterId, gearSlot, next ? next.id : null);
    setLastAction(next ? `Equipped ${next.name} (${gearSlot})` : `Unequipped ${gearSlot}`);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 overflow-auto">
      {/* Hero banner */}
      <div
        className="relative w-full h-44 md:h-60 overflow-hidden border-b border-amber-900/40"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.85)), url(${gruda1})`,
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
        }}
      >
        <div className="absolute inset-0 flex items-end justify-between px-6 pb-4">
          <div>
            <p className="text-amber-300/80 tracking-[0.3em] text-xs font-serif">EQUIPMENT</p>
            <h1 className="text-3xl md:text-4xl font-serif tracking-wider text-amber-100 drop-shadow">
              GRUDGE WARLORD LOADOUT
            </h1>
            <p className="text-stone-300/80 text-sm mt-1">
              Hub-driven gear catalogue · click any slot to cycle gear · persists locally
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {/* Quick-fill presets */}
            <div className="inline-flex rounded-md ring-1 ring-amber-700/50 overflow-hidden">
              <button
                type="button"
                onClick={() => { setLoadout(characterId, STARTER_PRESET); setLastAction("Applied Starter preset"); }}
                data-testid="button-preset-starter"
                className="px-3 py-1.5 text-sm bg-stone-900/80 text-stone-300 hover-elevate active-elevate-2"
              >
                Starter
              </button>
              <button
                type="button"
                onClick={() => { setLoadout(characterId, VETERAN_PRESET); setLastAction("Applied Veteran preset"); }}
                data-testid="button-preset-veteran"
                className="px-3 py-1.5 text-sm bg-stone-900/80 text-stone-300 hover-elevate active-elevate-2 border-l border-amber-900/40"
              >
                Veteran
              </button>
              <button
                type="button"
                onClick={() => { setLoadout(characterId, {}); setLastAction("Cleared loadout"); }}
                data-testid="button-preset-clear"
                className="px-3 py-1.5 text-sm bg-stone-900/80 text-stone-300 hover-elevate active-elevate-2 border-l border-amber-900/40"
              >
                Clear
              </button>
            </div>

            <button
              type="button"
              onClick={() => setDebugGrid((v) => !v)}
              data-testid="button-toggle-grid"
              className="px-3 py-1.5 rounded-md text-sm bg-stone-900/80 ring-1 ring-amber-700/50 hover-elevate active-elevate-2"
            >
              {debugGrid ? "Hide Grid" : "Show Grid"}
            </button>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                data-testid="button-back-equipment-demo"
                className="px-3 py-1.5 rounded-md text-sm bg-stone-900/80 ring-1 ring-stone-600/50 hover-elevate active-elevate-2"
              >
                Back
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Selected race detail */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-[auto,1fr] gap-8 items-start">
          <EquipmentPanel
            race={selectedRace}
            equipped={equipped}
            debugGrid={debugGrid}
            width={460}
            onSlotClick={handleSlotClick}
          />

          <div className="space-y-4">
            <div className="rounded-md p-3 ring-1 ring-amber-700/40 bg-stone-900/60" data-testid="panel-gear-status">
              <p className="text-amber-300/80 tracking-[0.2em] text-xs font-serif mb-1">
                GEAR SYSTEM
              </p>
              <p className="text-sm text-stone-300">
                Gear is loaded from the canonical hub catalogue, falling back to real
                local GLB assets when the hub is unavailable. Every slot resolves to
                the same reusable <code className="text-amber-200">GearItem</code> model
                used to render weapons on hand bones and toggle built-in armor in 3D.
              </p>
              <p className="text-xs mt-2 font-mono text-emerald-400" data-testid="text-gear-count">
                ✓ {catalogue.length} catalogue items · {equippedCount} slots equipped (drives in-game player)
              </p>
            </div>

            <h2 className="text-xl font-serif tracking-wider text-amber-200">How it works</h2>
            <ul className="text-sm text-stone-300 space-y-2 list-disc pl-5">
              <li>
                Click any slot to cycle through the catalogue's gear for that slot:
                <code className="text-amber-200"> empty → item 0 → item 1 → … → empty</code>.
              </li>
              <li>
                Every change writes to <code className="text-amber-200">localStorage</code> under
                the shared player key (<code className="text-amber-200">{characterId}</code>) and survives reloads.
              </li>
              <li>
                The same loadout drives the 3D character: weapons attach as real GLB
                models to the hand bones and armor toggles built-in submeshes.
              </li>
              <li>
                Weapons resolve to a rig-independent <code className="text-amber-200">weaponStyle</code> so
                a sword sizes correctly on both the FBX and GLB character rigs.
              </li>
            </ul>

            <h2 className="text-xl font-serif tracking-wider text-amber-200 pt-4">Slot Map</h2>
            <div className="grid grid-cols-2 gap-4 text-sm text-stone-300">
              <div>
                <p className="text-amber-300/80 font-semibold mb-1">Left column</p>
                <ol className="list-decimal pl-5 space-y-0.5">
                  <li>Helmet</li>
                  <li>Chest</li>
                  <li>Gloves</li>
                  <li>Leggings</li>
                  <li>Boots</li>
                </ol>
              </div>
              <div>
                <p className="text-amber-300/80 font-semibold mb-1">Right column</p>
                <ol className="list-decimal pl-5 space-y-0.5">
                  <li>Main Hand</li>
                  <li>Off Hand</li>
                  <li>Amulet</li>
                  <li>Belt</li>
                  <li>Cloak</li>
                </ol>
              </div>
            </div>

            {lastAction && (
              <div
                className="mt-4 p-3 rounded-md bg-stone-900/80 ring-1 ring-amber-700/40 text-sm"
                data-testid="text-last-action"
              >
                <span className="text-amber-200 font-mono">{lastAction}</span>
              </div>
            )}
          </div>
        </div>

        {/* All races side-by-side */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-serif tracking-wider text-amber-200">
              All Races · Pick one above
            </h2>
            <p className="text-xs text-stone-400">
              Same component, same grid math — six identical layouts, six different portraits.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {RACES.map((race) => (
              <div
                key={race}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedRace(race)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedRace(race);
                  }
                }}
                data-testid={`button-pick-race-${race}`}
                className={[
                  "block w-full text-left rounded-xl transition cursor-pointer outline-none",
                  selectedRace === race
                    ? "ring-2 ring-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.25)]"
                    : "ring-1 ring-stone-800 hover:ring-amber-700/60 focus:ring-amber-500",
                ].join(" ")}
              >
                <EquipmentPanel
                  race={race}
                  equipped={race === selectedRace ? equipped : {}}
                  width={300}
                  debugGrid={debugGrid}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
