import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ObjectStore,
  calcWeaponDamage,
  TIER_NAMES,
  TIER_COLORS,
  getSlotColor,
  getSlotLabel,
  type ClassDef,
  type ClassAbility,
  type WeaponDef,
  type WeaponSkillDef,
  type RaceDef,
  type FactionDef,
  type AttributeDef,
} from "@/lib/objectStoreAPI";

type BookTab = "skills" | "weapons" | "character" | "lore";

interface MagicBookUIProps {
  isOpen: boolean;
  onClose: () => void;
  playerClass?: string;
  playerRace?: string;
  playerName?: string;
  playerLevel?: number;
}

const TAB_COLORS: Record<BookTab, { label: string; color: string }> = {
  skills:    { label: "Skills",    color: "#c084fc" },
  weapons:   { label: "Weapons",   color: "#f97316" },
  character: { label: "Character", color: "#38bdf8" },
  lore:      { label: "Lore",      color: "#4ade80" },
};

const BOOK_FRAME_W = 272;
const BOOK_FRAME_H = 272;
const BOOK_COLS = 4;
const TOTAL_OPEN_FRAMES = 12;
const FRAME_DURATION = 60;

function PixelIcon({ index, size = 40 }: { index: number; size?: number }) {
  return (
    <img
      src={`/ui/magic_book/icons/Icon${Math.min(20, Math.max(1, index))}_big.png`}
      alt=""
      style={{ width: size, height: size, imageRendering: "pixelated" }}
      draggable={false}
    />
  );
}

function LoadingSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );
}

function SkillsPage({ classDef, weaponSkills }: {
  classDef: ClassDef | null;
  weaponSkills: Record<string, WeaponSkillDef[]> | null;
}) {
  const [hoveredAbility, setHoveredAbility] = useState<ClassAbility | null>(null);
  const [hoveredWSkill, setHoveredWSkill] = useState<WeaponSkillDef | null>(null);

  if (!classDef) return <LoadingSpinner />;

  const primaryWeapon = classDef.weaponTypes[0] || "swords";
  const wSkills = weaponSkills
    ? Object.values(weaponSkills).flat().slice(0, 6)
    : [];

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col px-3 py-2 overflow-y-auto" style={{ maxHeight: "100%" }}>
        <h3 className="font-bold text-amber-900 text-[11px] tracking-wider mb-2 text-center"
          style={{ fontFamily: "'Cinzel', serif" }}>
          {classDef.name.toUpperCase()} ABILITIES
        </h3>
        <div className="grid grid-cols-3 gap-2 place-items-center">
          {classDef.abilities.slice(0, 9).map((ability, i) => (
            <div key={ability.id} className="flex flex-col items-center gap-0.5">
              <div
                className={`relative rounded-sm border-2 p-1 cursor-pointer transition-all ${
                  hoveredAbility?.id === ability.id
                    ? "border-amber-500 bg-amber-900/20 shadow-md shadow-amber-500/30 scale-105"
                    : "border-amber-800/40 bg-amber-950/10 hover:border-amber-600/60"
                }`}
                onMouseEnter={() => { setHoveredAbility(ability); setHoveredWSkill(null); }}
                onMouseLeave={() => setHoveredAbility(null)}
              >
                <PixelIcon index={(i % 20) + 1} size={36} />
                {ability.cooldown > 0 && (
                  <div className="absolute -top-1 -right-1 bg-amber-800 text-white text-[7px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                    {ability.cooldown}
                  </div>
                )}
              </div>
              <span className="text-[8px] text-amber-900/70 font-semibold text-center leading-tight max-w-[58px] truncate">
                {ability.name}
              </span>
            </div>
          ))}
        </div>

        {wSkills.length > 0 && (
          <>
            <div className="text-[9px] text-amber-900/50 uppercase tracking-wider mt-3 mb-1.5 font-semibold text-center">
              Weapon Skills ({primaryWeapon})
            </div>
            <div className="grid grid-cols-3 gap-2 place-items-center">
              {wSkills.slice(0, 6).map((ws, i) => (
                <div key={ws.id} className="flex flex-col items-center gap-0.5">
                  <div
                    className={`relative rounded-sm border-2 p-1 cursor-pointer transition-all ${
                      hoveredWSkill?.id === ws.id
                        ? "border-amber-500 bg-amber-900/20 shadow-md scale-105"
                        : "border-amber-800/30 bg-amber-950/5 hover:border-amber-600/50"
                    }`}
                    style={{ borderColor: hoveredWSkill?.id === ws.id ? getSlotColor(ws.slot) : undefined }}
                    onMouseEnter={() => { setHoveredWSkill(ws); setHoveredAbility(null); }}
                    onMouseLeave={() => setHoveredWSkill(null)}
                  >
                    <PixelIcon index={((i + 5) % 20) + 1} size={32} />
                    {ws.cooldown > 0 && (
                      <div className="absolute -top-1 -right-1 bg-blue-700 text-white text-[7px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                        {ws.cooldown}
                      </div>
                    )}
                  </div>
                  <span className="text-[7px] text-amber-900/60 font-semibold text-center leading-tight max-w-[54px] truncate">
                    {ws.name}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 flex flex-col px-3 py-2">
        <h3 className="font-bold text-amber-900 text-[11px] tracking-wider mb-2 text-center"
          style={{ fontFamily: "'Cinzel', serif" }}>
          DETAILS
        </h3>
        {hoveredAbility ? (
          <div className="flex flex-col items-center gap-1.5 mt-1">
            <div className="border-2 border-amber-700/60 rounded p-1.5 bg-amber-900/10">
              <PixelIcon index={(classDef.abilities.indexOf(hoveredAbility) % 20) + 1} size={48} />
            </div>
            <div className="text-amber-900 font-bold text-xs text-center" style={{ fontFamily: "'Cinzel', serif" }}>
              {hoveredAbility.name}
            </div>
            <div className={`text-[9px] font-semibold uppercase tracking-wide ${
              hoveredAbility.type === "physical" ? "text-red-700" :
              hoveredAbility.type === "buff" ? "text-green-700" :
              hoveredAbility.type === "magical" ? "text-blue-700" : "text-amber-700"
            }`}>
              {hoveredAbility.type}
            </div>
            <p className="text-amber-900/60 text-[10px] text-center leading-relaxed px-1">
              {hoveredAbility.description}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-amber-800/70 mt-0.5">
              {hoveredAbility.damage > 0 && <span>DMG: {(hoveredAbility.damage * 100).toFixed(0)}%</span>}
              {hoveredAbility.cooldown > 0 && <span>CD: {hoveredAbility.cooldown}s</span>}
              {hoveredAbility.manaCost > 0 && <span>Mana: {hoveredAbility.manaCost}</span>}
              {hoveredAbility.staminaCost > 0 && <span>Stam: {hoveredAbility.staminaCost}</span>}
              {hoveredAbility.manaGain && <span className="text-blue-600">+{hoveredAbility.manaGain} mana</span>}
              {hoveredAbility.staminaGain && <span className="text-green-600">+{hoveredAbility.staminaGain} stam</span>}
            </div>
          </div>
        ) : hoveredWSkill ? (
          <div className="flex flex-col items-center gap-1.5 mt-1">
            <div className="border-2 rounded p-1.5 bg-amber-900/10" style={{ borderColor: getSlotColor(hoveredWSkill.slot) }}>
              <PixelIcon index={6} size={48} />
            </div>
            <div className="text-amber-900 font-bold text-xs text-center" style={{ fontFamily: "'Cinzel', serif" }}>
              {hoveredWSkill.name}
            </div>
            <div className="text-[9px] font-bold uppercase px-2 py-0.5 rounded"
              style={{ color: getSlotColor(hoveredWSkill.slot), backgroundColor: `${getSlotColor(hoveredWSkill.slot)}15` }}>
              {getSlotLabel(hoveredWSkill.slot)}
            </div>
            <p className="text-amber-900/60 text-[10px] text-center leading-relaxed px-1">
              {hoveredWSkill.description}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-amber-800/70 mt-0.5">
              <span>DMG: {((hoveredWSkill.damageMultiplier || 1) * 100).toFixed(0)}%</span>
              {hoveredWSkill.cooldown > 0 && <span>CD: {hoveredWSkill.cooldown}s</span>}
              {hoveredWSkill.manaCost > 0 && <span>Mana: {hoveredWSkill.manaCost}</span>}
              {hoveredWSkill.effect && <span className="text-purple-600">{hoveredWSkill.effect}</span>}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-amber-900/40 text-[10px] text-center italic">
              Hover a skill to view details
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function WeaponsPage({ weapons }: { weapons: WeaponDef[] | null }) {
  const [hoveredWeapon, setHoveredWeapon] = useState<WeaponDef | null>(null);
  const [selectedTier, setSelectedTier] = useState(3);

  if (!weapons) return <LoadingSpinner />;

  const equipped = weapons.slice(0, 2);
  const inventory = weapons.slice(2, 8);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col px-3 py-2 overflow-y-auto" style={{ maxHeight: "100%" }}>
        <h3 className="font-bold text-amber-900 text-[11px] tracking-wider mb-2 text-center"
          style={{ fontFamily: "'Cinzel', serif" }}>
          ARMORY
        </h3>

        <div className="flex items-center gap-1 mb-2 justify-center">
          <span className="text-[8px] text-amber-900/50 uppercase">Tier</span>
          {[1, 2, 3, 4, 5].map((t) => (
            <button key={t}
              onClick={() => setSelectedTier(t)}
              className={`w-5 h-5 rounded text-[9px] font-bold transition-all ${
                selectedTier === t
                  ? "text-white shadow-sm scale-110"
                  : "text-white/60 hover:scale-105"
              }`}
              style={{ backgroundColor: selectedTier === t ? TIER_COLORS[t] : `${TIER_COLORS[t]}66` }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mb-2">
          <div className="text-[8px] text-amber-900/50 uppercase tracking-wider mb-1 font-semibold">
            Equipped
          </div>
          <div className="flex gap-1.5">
            {equipped.map((w) => (
              <div key={w.id}
                className={`border-2 rounded p-1 cursor-pointer transition-all ${
                  hoveredWeapon?.id === w.id ? "scale-105 shadow-md" : ""
                }`}
                style={{ borderColor: TIER_COLORS[selectedTier], backgroundColor: `${TIER_COLORS[selectedTier]}15` }}
                onMouseEnter={() => setHoveredWeapon(w)}
                onMouseLeave={() => setHoveredWeapon(null)}
              >
                <PixelIcon index={weapons.indexOf(w) + 1} size={36} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[8px] text-amber-900/50 uppercase tracking-wider mb-1 font-semibold">
            Inventory
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {inventory.map((w) => (
              <div key={w.id}
                className={`border rounded p-1 cursor-pointer transition-all ${
                  hoveredWeapon?.id === w.id ? "border-amber-500 scale-105" : "border-amber-800/25 hover:border-amber-600/50"
                }`}
                style={{ backgroundColor: "rgba(120,80,20,0.03)" }}
                onMouseEnter={() => setHoveredWeapon(w)}
                onMouseLeave={() => setHoveredWeapon(null)}
              >
                <PixelIcon index={weapons.indexOf(w) + 1} size={32} />
              </div>
            ))}
            {Array.from({ length: Math.max(0, 6 - inventory.length) }).map((_, i) => (
              <div key={`e-${i}`} className="border border-amber-900/12 rounded p-1 flex items-center justify-center" style={{ width: 44, height: 44 }}>
                <div className="w-5 h-5 border border-dashed border-amber-900/15 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-3 py-2">
        <h3 className="font-bold text-amber-900 text-[11px] tracking-wider mb-2 text-center"
          style={{ fontFamily: "'Cinzel', serif" }}>
          DETAILS
        </h3>
        {hoveredWeapon ? (
          <div className="flex flex-col items-center gap-1.5 mt-1">
            <div className="border-2 rounded p-1.5 bg-amber-900/10" style={{ borderColor: TIER_COLORS[selectedTier] }}>
              <PixelIcon index={weapons.indexOf(hoveredWeapon) + 1} size={48} />
            </div>
            <div className="text-amber-900 font-bold text-xs text-center" style={{ fontFamily: "'Cinzel', serif" }}>
              {hoveredWeapon.name}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold uppercase" style={{ color: TIER_COLORS[selectedTier] }}>
                {TIER_NAMES[selectedTier]}
              </span>
              <span className="text-[9px] text-amber-900/50">
                T{selectedTier} · {hoveredWeapon.category}
              </span>
            </div>
            <p className="text-amber-900/50 text-[9px] text-center italic px-1">
              {hoveredWeapon.lore}
            </p>
            <div className="w-full space-y-0.5 px-1 mt-0.5">
              <div className="flex justify-between text-[9px]">
                <span className="text-red-700 font-semibold">DMG</span>
                <span className="text-amber-900/80 font-bold">{calcWeaponDamage(hoveredWeapon, selectedTier)}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-amber-700 font-semibold">SPD</span>
                <span className="text-amber-900/80 font-bold">{hoveredWeapon.stats.speedBase + hoveredWeapon.stats.speedPerTier * (selectedTier - 1)}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-yellow-700 font-semibold">CRIT</span>
                <span className="text-amber-900/80 font-bold">{(hoveredWeapon.stats.critBase + hoveredWeapon.stats.critPerTier * (selectedTier - 1)).toFixed(1)}%</span>
              </div>
            </div>
            <div className="text-[8px] text-amber-900/50 mt-0.5">
              Crafted by: <span className="text-amber-800 font-semibold">{hoveredWeapon.craftedBy}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-amber-900/40 text-[10px] text-center italic">
              Hover a weapon to inspect
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CharacterPage({ classDef, raceDef, attributes, playerName, playerLevel }: {
  classDef: ClassDef | null;
  raceDef: RaceDef | null;
  attributes: AttributeDef[] | null;
  playerName: string;
  playerLevel: number;
}) {
  if (!classDef || !raceDef) return <LoadingSpinner />;

  const baseAttrs = classDef.startingAttributes;
  const raceBonus = raceDef.bonuses;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col items-center px-3 py-2">
        <h3 className="font-bold text-amber-900 text-[11px] tracking-wider mb-1 text-center"
          style={{ fontFamily: "'Cinzel', serif" }}>
          {playerName.toUpperCase()}
        </h3>

        <div className="w-16 h-16 rounded-full border-2 flex items-center justify-center mb-1.5 overflow-hidden"
          style={{ borderColor: classDef.color, backgroundColor: `${classDef.color}15` }}>
          <span className="text-2xl">{raceDef.emoji}</span>
        </div>

        <div className="text-center mb-2">
          <div className="text-amber-800 text-[10px] font-semibold capitalize">
            {raceDef.name} {classDef.name}
          </div>
          <div className="text-[9px] font-semibold" style={{ color: raceDef.color }}>
            {raceDef.trait}
          </div>
          <div className="text-amber-900/50 text-[9px]">Level {playerLevel}</div>
          <div className="w-20 h-1.5 bg-amber-900/12 rounded-full mt-0.5 mx-auto overflow-hidden">
            <div className="h-full bg-amber-600 rounded-full" style={{ width: "65%" }} />
          </div>
          <div className="text-[8px] text-amber-900/35 mt-0.5">2,340 / 3,600 XP</div>
        </div>

        <div className="w-full space-y-1">
          {(attributes || []).slice(0, 8).map((attr) => {
            const base = baseAttrs[attr.name] || 0;
            const bonus = raceBonus[attr.name] || 0;
            const total = base + bonus + playerLevel;
            return (
              <div key={attr.id} className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold w-6" style={{ color: attr.color }}>
                  {attr.name.slice(0, 3).toUpperCase()}
                </span>
                <div className="flex-1 h-1.5 bg-amber-900/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${Math.min(100, (total / 30) * 100)}%`,
                    background: `linear-gradient(to right, ${attr.color}aa, ${attr.color})`,
                  }} />
                </div>
                <span className="text-[9px] text-amber-900/60 font-semibold w-4 text-right">{total}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col px-3 py-2">
        <h3 className="font-bold text-amber-900 text-[11px] tracking-wider mb-2 text-center"
          style={{ fontFamily: "'Cinzel', serif" }}>
          PASSIVES
        </h3>

        <div className="bg-amber-900/5 rounded p-2 mb-2">
          <div className="text-[9px] font-bold text-amber-800">{raceDef.name} Racial</div>
          <div className="text-[8px] text-amber-900/60">{raceDef.passive}</div>
        </div>

        <div className="text-[9px] text-amber-900/50 uppercase tracking-wider mb-1 font-semibold">
          Weapon Proficiencies
        </div>
        <div className="flex flex-wrap gap-1">
          {classDef.weaponTypes.map((wt) => (
            <span key={wt} className="text-[8px] bg-amber-800/10 text-amber-800 px-1.5 py-0.5 rounded capitalize font-medium">
              {wt.replace(/([A-Z])/g, " $1").replace(/(\d)/, " $1")}
            </span>
          ))}
        </div>

        <div className="text-[9px] text-amber-900/50 uppercase tracking-wider mt-2 mb-1 font-semibold">
          Armor Types
        </div>
        <div className="flex flex-wrap gap-1">
          {classDef.armorTypes.map((at) => (
            <span key={at} className="text-[8px] bg-amber-800/10 text-amber-800 px-1.5 py-0.5 rounded capitalize font-medium">
              {at}
            </span>
          ))}
        </div>

        <p className="text-amber-900/40 text-[8px] mt-2 leading-relaxed italic">
          {classDef.lore}
        </p>
      </div>
    </div>
  );
}

function LorePage({ factions }: { factions: Record<string, FactionDef> | null }) {
  if (!factions) return <LoadingSpinner />;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col px-3 py-2 overflow-y-auto" style={{ maxHeight: "100%" }}>
        <h3 className="font-bold text-amber-900 text-[11px] tracking-wider mb-2 text-center"
          style={{ fontFamily: "'Cinzel', serif" }}>
          THE GRUDGE WARS
        </h3>
        <div className="space-y-2.5">
          {Object.values(factions).map((faction) => (
            <div key={faction.id} className="border rounded-sm p-2" style={{ borderColor: `${faction.color}40`, backgroundColor: `${faction.color}08` }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm">{faction.emoji}</span>
                <span className="text-[10px] font-bold" style={{ color: faction.color, fontFamily: "'Cinzel', serif" }}>
                  {faction.name}
                </span>
              </div>
              <div className="text-[8px] text-amber-900/50 mb-0.5">
                Patron: {faction.patron} · Races: {faction.races.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(", ")}
              </div>
              <p className="text-amber-900/60 text-[9px] leading-relaxed">
                {faction.lore}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-3 py-2">
        <div className="relative w-20 h-20 mb-2">
          <img src="/ui/magic_book/book_content.png" alt=""
            className="w-full h-full object-contain"
            style={{ imageRendering: "pixelated", objectPosition: "top center" }}
            draggable={false}
          />
        </div>
        <div className="text-center space-y-1.5">
          <div className="text-[9px] text-amber-800 font-semibold" style={{ fontFamily: "'Cinzel', serif" }}>
            World of Aethermoor
          </div>
          <p className="text-amber-900/40 text-[8px] italic px-2 leading-relaxed">
            Three factions wage endless war for dominion. Choose your allegiance wisely — every grudge runs deep in these lands.
          </p>
          <div className="flex flex-col gap-1 mt-1">
            <div className="text-[8px] text-amber-900/40">Tier System: T1-T8</div>
            <div className="flex gap-0.5 justify-center">
              {[1,2,3,4,5,6,7,8].map(t => (
                <div key={t} className="w-3 h-3 rounded-sm text-[6px] font-bold flex items-center justify-center text-white"
                  style={{ backgroundColor: TIER_COLORS[t] }}>
                  {t}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
              {TIER_NAMES.slice(1).map((name, i) => (
                <span key={name} className="text-[7px] font-medium" style={{ color: TIER_COLORS[i + 1] }}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MagicBookUI({
  isOpen,
  onClose,
  playerClass = "warrior",
  playerRace = "human",
  playerName = "Captain",
  playerLevel = 5,
}: MagicBookUIProps) {
  const [activeTab, setActiveTab] = useState<BookTab>("skills");
  const [animState, setAnimState] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const [openFrame, setOpenFrame] = useState(0);

  const { data: classesData } = useQuery({
    queryKey: ["/objectstore/classes"],
    queryFn: () => ObjectStore.getClasses(),
    enabled: isOpen,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: racesData } = useQuery({
    queryKey: ["/objectstore/races"],
    queryFn: () => ObjectStore.getRaces(),
    enabled: isOpen,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: weaponsData } = useQuery({
    queryKey: ["/objectstore/weapons"],
    queryFn: () => ObjectStore.getWeapons(),
    enabled: isOpen,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: weaponSkillsData } = useQuery({
    queryKey: ["/objectstore/weaponSkills"],
    queryFn: () => ObjectStore.getWeaponSkills(),
    enabled: isOpen,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: attributesData } = useQuery({
    queryKey: ["/objectstore/attributes"],
    queryFn: () => ObjectStore.getAttributes(),
    enabled: isOpen,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: factionsData } = useQuery({
    queryKey: ["/objectstore/factions"],
    queryFn: () => ObjectStore.getFactions(),
    enabled: isOpen,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const classDef = classesData?.classes?.[playerClass] || null;
  const raceDef = racesData?.races?.[playerRace] || null;

  const allWeapons: WeaponDef[] = weaponsData
    ? Object.values(weaponsData.categories).flatMap((cat) => cat.items)
    : [];

  const primaryWeapon = classDef?.weaponTypes[0] || "swords";
  const weaponSkills = weaponSkillsData?.weaponTypes?.[primaryWeapon]?.sharedSkills || null;

  useEffect(() => {
    if (isOpen && animState === "closed") {
      setAnimState("opening");
      setOpenFrame(0);
    } else if (!isOpen && animState === "open") {
      setAnimState("closing");
      setOpenFrame(TOTAL_OPEN_FRAMES - 1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (animState === "opening") {
      if (openFrame < TOTAL_OPEN_FRAMES - 1) {
        const timer = setTimeout(() => setOpenFrame((f) => f + 1), FRAME_DURATION);
        return () => clearTimeout(timer);
      } else {
        setAnimState("open");
      }
    } else if (animState === "closing") {
      if (openFrame > 0) {
        const timer = setTimeout(() => setOpenFrame((f) => f - 1), FRAME_DURATION);
        return () => clearTimeout(timer);
      } else {
        setAnimState("closed");
      }
    }
  }, [animState, openFrame]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "b" || e.key === "B") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (animState === "closed" && !isOpen) return null;

  const showContent = animState === "open";
  const frameCol = openFrame % BOOK_COLS;
  const frameRow = Math.floor(openFrame / BOOK_COLS);

  const bookScale = 2.8;
  const bookW = BOOK_FRAME_W * bookScale;
  const bookH = BOOK_FRAME_H * bookScale;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      data-testid="magic-book-overlay"
    >
      <div className="relative" style={{ width: bookW, height: bookH }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(/ui/magic_book/Open_book.png)`,
            backgroundPosition: `-${frameCol * BOOK_FRAME_W * bookScale}px -${frameRow * BOOK_FRAME_H * bookScale}px`,
            backgroundSize: `${1088 * bookScale}px ${816 * bookScale}px`,
            imageRendering: "pixelated",
          }}
        />

        {showContent && (
          <>
            <div
              className="absolute overflow-hidden"
              style={{
                left: bookW * 0.08,
                top: bookH * 0.12,
                width: bookW * 0.84,
                height: bookH * 0.76,
              }}
            >
              {activeTab === "skills" && (
                <SkillsPage classDef={classDef} weaponSkills={weaponSkills} />
              )}
              {activeTab === "weapons" && (
                <WeaponsPage weapons={allWeapons.length > 0 ? allWeapons : null} />
              )}
              {activeTab === "character" && (
                <CharacterPage
                  classDef={classDef}
                  raceDef={raceDef}
                  attributes={attributesData?.attributes || null}
                  playerName={playerName}
                  playerLevel={playerLevel}
                />
              )}
              {activeTab === "lore" && (
                <LorePage factions={factionsData?.factions || null} />
              )}
            </div>

            <div
              className="absolute flex flex-col gap-1"
              style={{ right: -44, top: bookH * 0.15 }}
            >
              {(Object.entries(TAB_COLORS) as [BookTab, typeof TAB_COLORS[BookTab]][]).map(([tab, cfg]) => (
                <button
                  key={tab}
                  data-testid={`book-tab-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-r-md transition-all border-l-0 ${
                    activeTab === tab
                      ? "text-white shadow-lg translate-x-1"
                      : "text-white/70 hover:translate-x-0.5"
                  }`}
                  style={{
                    backgroundColor: activeTab === tab ? cfg.color : `${cfg.color}88`,
                    borderTop: `1px solid ${cfg.color}`,
                    borderRight: `1px solid ${cfg.color}`,
                    borderBottom: `1px solid ${cfg.color}`,
                    minWidth: 40,
                  }}
                >
                  {cfg.label}
                </button>
              ))}
            </div>

            <button
              data-testid="book-close"
              onClick={onClose}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-900/40 hover:bg-amber-900/70 flex items-center justify-center text-amber-100 text-xs font-bold transition-colors"
              title="Close (Esc)"
            >
              x
            </button>

            <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
              <span className="text-amber-900/30 text-[9px]">
                Press <kbd className="font-mono font-bold text-amber-900/50">B</kbd> or <kbd className="font-mono font-bold text-amber-900/50">Esc</kbd> to close
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
