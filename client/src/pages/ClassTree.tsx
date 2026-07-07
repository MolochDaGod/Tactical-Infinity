import { useEffect, useMemo, useRef, useState } from "react";
import RacePreview3D from "@/components/classtree/RacePreview3D";
import { buildCaptainFromClassTree, saveCaptainBuild, CLASS_TO_WEAPON_STYLE, type ClassKey as CaptainClassKey } from "@/lib/captainBuild";
import { persistCaptainBuildToFleet } from "@/lib/grudgeCharacterSync";
import humanImg from "@/assets/races/human.png";
import elfImg from "@/assets/races/elf.png";
import dwarfImg from "@/assets/races/dwarf.png";
import orcImg from "@/assets/races/orc.png";
import barbarianImg from "@/assets/races/barbarian.png";
import undeadImg from "@/assets/races/undead.png";

// ── Data: races ─────────────────────────────────────────────────────────────
type RaceKey = "elf" | "human" | "dwarf" | "orc" | "barbarian" | "undead";
const RACES: Record<RaceKey, { name: string; img: string; blurb: string }> = {
  elf:       { name: "Elf",       img: elfImg,       blurb: "Agile & arcane-touched. +DEX, +INT." },
  human:     { name: "Human",     img: humanImg,     blurb: "Balanced and versatile. +ALL." },
  dwarf:     { name: "Dwarf",     img: dwarfImg,     blurb: "Stoic and resilient. +VIT, +STR." },
  orc:       { name: "Orc",       img: orcImg,       blurb: "Savage power. +STR, +END." },
  barbarian: { name: "Barbarian", img: barbarianImg, blurb: "Relentless fury. +STR, +LCK." },
  undead:    { name: "Undead",    img: undeadImg,    blurb: "Deathless and cursed. +WIS, +END." },
};

// ── Data: classes (ported from class-selector.html) ─────────────────────────
type ClassKey = "mage" | "warrior" | "ranger" | "worge";
type Skill = { n: string; i: string; d: string; stats: Record<string, string | number> };
type Tier = { lvl: number; label: string; hint: string; auto?: boolean; picks?: number; skills: Skill[] };
type ClassDef = { name: string; role: string; emoji: string; desc: string; hero: string; tiers: Tier[] };

// External imgur class hero art (decorative). Keep as-is until we generate local versions.
const HERO_BG: Record<ClassKey, string> = {
  mage:    "https://i.imgur.com/vKQR4UT.png",
  warrior: "https://i.imgur.com/Wj2mUH2.png",
  ranger:  "https://i.imgur.com/5A6e5kL.png",
  worge:   "https://i.imgur.com/BrQH0Bx.png",
};

const CLASSES: Record<ClassKey, ClassDef> = {
  mage: {
    name: "Mage Priest", role: "Primary Healer · Magic DPS · Utility", emoji: "🔮",
    desc: "Mana Shield & Mobility — mana-based shield, Blink teleport, and portals.",
    hero: HERO_BG.mage,
    tiers: [
      { lvl: 0, label: "Arcane Affinity", hint: "Automatic", auto: true, skills: [
        { n: "Mana Shield", i: "◈", d: "Passive shield based on mana %. Active: 15s massive crit/spell boost.", stats: { Mana: 20, CD: "30s", Duration: "15s", Range: "10y" } },
      ]},
      { lvl: 1, label: "Basic Arts", hint: "Pick 1 of 2", skills: [
        { n: "Magic Missile", i: "✶", d: "Multi-projectile damage. Fast, cheap, reliable.", stats: { Mana: 5, CD: "0.5s", DMG: 10, Range: "25y" } },
        { n: "Heal", i: "✚", d: "Direct single-target healing spell.", stats: { Mana: 15, CD: "8s", Duration: "3s", Range: "20y" } },
      ]},
      { lvl: 5, label: "Specialization", hint: "Pick 1 of 2", skills: [
        { n: "Fireball", i: "🔥", d: "AoE fire damage. Explodes on impact.", stats: { Mana: 20, CD: "6s", DMG: 25, AoE: "Yes" } },
        { n: "Greater Heal", i: "✦", d: "Powerful single-target heal with +50% healing power.", stats: { Mana: 30, CD: "12s", Duration: "5s", Range: "25y" } },
      ]},
      { lvl: 10, label: "Advanced Magic", hint: "Pick 1 of 3", skills: [
        { n: "Lightning Chain", i: "⚝", d: "Chains to up to 5 targets for multi-target damage.", stats: { Mana: 35, CD: "10s", DMG: 30, Range: "30y" } },
        { n: "Blink", i: "⚡", d: "10-yard directional teleport. Instant movement.", stats: { Mana: 20, CD: "15s", Range: "10y" } },
        { n: "Group Heal", i: "✧", d: "AoE heal for party. Restores nearby allies.", stats: { Mana: 40, CD: "20s", Duration: "5s", Range: "15y" } },
      ]},
      { lvl: 15, label: "Master Tier", hint: "Pick 1 of 2", skills: [
        { n: "Meteor", i: "☄", d: "Delayed massive AoE damage. Massive destruction.", stats: { Mana: 60, CD: "45s", DMG: 100, AoE: "Yes" } },
        { n: "Portal", i: "◉", d: "Place/connect portals for team teleportation.", stats: { Mana: 50, CD: "120s", Duration: "30s", Range: "10y" } },
      ]},
      { lvl: 20, label: "Legendary Magic", hint: "Pick 1 of 2", skills: [
        { n: "Archmage", i: "✪", d: "+40% Spell Power. Reduced costs & cooldowns. Ultimate power.", stats: { Mana: 80, CD: "180s", Duration: "30s", "+SP": "40%" } },
        { n: "Reality Tear", i: "✺", d: "Devastating line-of-effect reality-warping damage.", stats: { Mana: 90, CD: "150s", DMG: 180, AoE: "Line" } },
      ]},
    ],
  },
  warrior: {
    name: "Warrior", role: "Tank · DPS · Paladin", emoji: "🗡️",
    desc: "Flexible fighter — can spec tank, DPS, or paladin support.",
    hero: HERO_BG.warrior,
    tiers: [
      { lvl: 0, label: "Invincibility", hint: "Automatic", auto: true, skills: [
        { n: "Invulnerability", i: "⛨", d: "Temporary immunity (1–4s). Scales with trait level.", stats: { Mana: 30, CD: "60s", Duration: "1s", Range: "Self" } },
      ]},
      { lvl: 1, label: "Combat Basics", hint: "Pick 1 of 2", skills: [
        { n: "Taunt", i: "❢", d: "Force enemies to target you. Threat generation.", stats: { Mana: 10, CD: "15s", Duration: "5s", Range: "10y" } },
        { n: "Quick Strike", i: "⚔", d: "Fast attack with +15% attack speed bonus.", stats: { Mana: 5, CD: "3s", DMG: 8, Range: "3y" } },
      ]},
      { lvl: 5, label: "Specialization", hint: "Pick 1 of 2", skills: [
        { n: "Damage Surge", i: "↑", d: "+25% damage for 5s. Temporary damage boost.", stats: { Mana: 15, CD: "20s", Duration: "5s", "+DMG": "25%" } },
        { n: "Guardian's Aura", i: "◎", d: "+15% party defense within range. Ally buff.", stats: { Mana: 20, CD: "45s", Duration: "30s", Range: "15y" } },
      ]},
      { lvl: 10, label: "Advanced Combat", hint: "Pick 1 of 3", skills: [
        { n: "Dual Wield", i: "✕", d: "Attack speed and multi-hit capability.", stats: { Passive: "Yes", "+AS": "20%", Hits: "2", Range: "3y" } },
        { n: "Shield Specialist", i: "✜", d: "Increases block chance and defense.", stats: { Passive: "Yes", Block: "+15%", Def: "+10%" } },
        { n: "Life Drain", i: "♡", d: "Damage heals you for 10% of damage dealt.", stats: { Mana: 15, CD: "15s", DMG: 20, Heal: "10%" } },
      ]},
      { lvl: 15, label: "Master Warrior", hint: "Pick 1 of 2", skills: [
        { n: "Execute", i: "⚒", d: "+50% damage vs enemies below 30% HP.", stats: { Mana: 25, CD: "20s", DMG: 40, Bonus: "+50% <30%" } },
        { n: "Double Strike", i: "✖", d: "Two consecutive attacks for 2× damage.", stats: { Mana: 12, CD: "8s", DMG: "15×2", Range: "3y" } },
      ]},
      { lvl: 20, label: "Legendary Warrior", hint: "Pick 1 of 2", skills: [
        { n: "Avatar Form", i: "✪", d: "All stats boosted + increased size. Ultimate transformation.", stats: { Mana: 50, CD: "120s", Duration: "15s", "+All": "30%" } },
        { n: "Perfect Counter", i: "◈", d: "Chance to fully counter incoming attacks and retaliate.", stats: { Passive: "Yes", Chance: "25%", Counter: "+100%" } },
      ]},
    ],
  },
  ranger: {
    name: "Ranger Scout", role: "Primary DPS · Utility · Off-Tank", emoji: "🏹",
    desc: "Dual specialization — ranged master or melee assassin with traps and mobility.",
    hero: HERO_BG.ranger,
    tiers: [
      { lvl: 0, label: "Hunter's Instinct", hint: "Automatic", auto: true, skills: [
        { n: "Precision", i: "◇", d: "Passive accuracy/crit bonus & movement speed in natural terrain.", stats: { Mana: 15, CD: "45s", Duration: "30s", "+Acc": "10%" } },
      ]},
      { lvl: 1, label: "Basic Training", hint: "Pick 1 of 2", skills: [
        { n: "Power Shot", i: "➤", d: "High damage ranged attack. +25% ranged damage.", stats: { Mana: 5, CD: "0.5s", DMG: 15, Range: "30y" } },
        { n: "Stealth Strike", i: "✦", d: "Melee attack from stealth — guaranteed crit.", stats: { Mana: 10, CD: "10s", DMG: 20, Range: "3y" } },
      ]},
      { lvl: 5, label: "Specialization", hint: "Pick 1 of 2", skills: [
        { n: "Multi Shot", i: "⋯", d: "Fire multiple arrows. Hits up to 3 targets.", stats: { Mana: 15, CD: "8s", DMG: 12, Targets: 3 } },
        { n: "Shadow Step", i: "➶", d: "Short-range teleport behind enemy. Instant reposition.", stats: { Mana: 12, CD: "12s", Duration: "3s", Range: "10y" } },
      ]},
      { lvl: 10, label: "Advanced Techniques", hint: "Pick 1 of 3", skills: [
        { n: "Explosive Shot", i: "✺", d: "AoE ranged damage. Explodes on impact.", stats: { Mana: 25, CD: "15s", DMG: 35, AoE: "Yes" } },
        { n: "Poison Blade", i: "☠", d: "Melee attacks apply a poison DoT.", stats: { Mana: 10, CD: "6s", DMG: 10, DoT: "Yes" } },
        { n: "Trap Mastery", i: "◈", d: "Deploy and upgrade multiple trap types.", stats: { Mana: 20, CD: "30s", Duration: "60s" } },
      ]},
      { lvl: 15, label: "Master Hunter", hint: "Pick 1 of 2", skills: [
        { n: "Rain of Arrows", i: "⇊", d: "Massive AoE ranged barrage.", stats: { Mana: 40, CD: "30s", DMG: 60, AoE: "Yes" } },
        { n: "Assassinate", i: "✖", d: "High-damage stealth execution. +200% stealth damage.", stats: { Mana: 30, CD: "25s", DMG: 50, Bonus: "+200% stealth" } },
      ]},
      { lvl: 20, label: "Legendary Skills", hint: "Pick 1 of 2", skills: [
        { n: "Storm of Arrows", i: "✪", d: "Ultimate ranged devastation. Massive AoE damage.", stats: { Mana: 60, CD: "60s", DMG: 120, AoE: "Yes" } },
        { n: "Shadow Master", i: "◆", d: "Enhanced stealth: multiple strikes, perma-stealth.", stats: { Mana: 50, CD: "120s", Duration: "20s" } },
      ]},
    ],
  },
  worge: {
    name: "Worg Shapeshifter", role: "Primary Tank · Burst DPS · Utility", emoji: "🐺",
    desc: "Shapeshifting: become different animal forms with unique stats and roles.",
    hero: HERO_BG.worge,
    tiers: [
      { lvl: 0, label: "Primal Shift", hint: "Automatic", auto: true, skills: [
        { n: "Bear Form", i: "🐻", d: "Transform into WorgBear: massive HP/Defense, threat generation, damage reduction.", stats: { Mana: 25, CD: "30s", Duration: "60s", "+HP": "50%" } },
      ]},
      { lvl: 1, label: "Pack Instincts", hint: "Pick 1 of 2", skills: [
        { n: "Howl", i: "♪", d: "AoE fear + debuff enemies around you.", stats: { Mana: 15, CD: "20s", Duration: "3s", Range: "10y" } },
        { n: "Pack Hunt", i: "◉", d: "Damage bonus when near allied units.", stats: { Mana: 15, CD: "25s", Duration: "20s", "+DMG": "20%" } },
      ]},
      { lvl: 5, label: "Primal Mastery", hint: "Pick 1 of 2", skills: [
        { n: "Feral Rage", i: "✱", d: "+25% attack speed for duration.", stats: { Mana: 20, CD: "30s", Duration: "10s", "+AS": "25%" } },
        { n: "Alpha Call", i: "✦", d: "Summon 2 temporary wolf allies.", stats: { Mana: 30, CD: "60s", Duration: "30s", Summons: 2 } },
      ]},
      { lvl: 10, label: "Advanced", hint: "Pick 1 of 3", skills: [
        { n: "Alpha Bear", i: "✜", d: "AoE taunt + tanking buffs while in Bear form.", stats: { Mana: 25, CD: "30s", Duration: "10s", Range: "15y" } },
        { n: "Raptor Form", i: "🦖", d: "Stealth DPS form. Crit strike bonus.", stats: { Mana: 25, CD: "30s", Duration: "45s" } },
        { n: "Blood Frenzy", i: "♥", d: "Damage increases as health decreases.", stats: { Mana: 20, CD: "45s", Duration: "15s", "+DMG": "50% lowHP" } },
      ]},
      { lvl: 15, label: "Apex Predator", hint: "Pick 1 of 2", skills: [
        { n: "Apex Predator", i: "◆", d: "Enhanced tracking. +30% damage vs wounded targets.", stats: { Mana: 35, CD: "60s", Duration: "20s", "+DMG": "30%" } },
        { n: "Primal Fury", i: "⚡", d: "+100% all stats, costs HP/s while active.", stats: { Mana: 40, CD: "90s", Duration: "10s", "+All": "100%" } },
      ]},
      { lvl: 20, label: "Legendary Choices", hint: "Pick 2 of 2", picks: 2, skills: [
        { n: "Worg Lord", i: "✪", d: "Ultimate tank form. Pack summoning + ultimate power.", stats: { Mana: 60, CD: "180s", Duration: "30s", "+HP": "+100%" } },
        { n: "Primal Avatar", i: "☽", d: "Colossal form: huge stat increase and fear aura.", stats: { Mana: 70, CD: "180s", Duration: "25s", "+Size": "Yes" } },
      ]},
    ],
  },
};

// ── Icon mapping → /skill-tree/icons/<class>/<class>_<n>.png ────────────────
const ICONS: Record<ClassKey, Record<string, string>> = {
  mage: {
    "Mana Shield":     "/skill-tree/icons/FrostMage/FrostMage_21.png",
    "Magic Missile":   "/skill-tree/icons/FrostMage/FrostMage_14.png",
    "Heal":            "/skill-tree/icons/FireMage/FireMage_13.png",
    "Fireball":        "/skill-tree/icons/FireMage/FireMage_28.png",
    "Greater Heal":    "/skill-tree/icons/EarthMage/EarthMage_10.png",
    "Lightning Chain": "/skill-tree/icons/FireMage/FireMage_25.png",
    "Blink":           "/skill-tree/icons/FrostMage/FrostMage_19.png",
    "Group Heal":      "/skill-tree/icons/FireMage/FireMage_22.png",
    "Meteor":          "/skill-tree/icons/FireMage/FireMage_35.png",
    "Portal":          "/skill-tree/icons/FireMage/FireMage_30.png",
    "Archmage":        "/skill-tree/icons/FireMage/FireMage_40.png",
    "Reality Tear":    "/skill-tree/icons/FireMage/FireMage_20.png",
  },
  warrior: {
    "Invulnerability":  "/skill-tree/icons/EarthMage/EarthMage_25.png",
    "Taunt":            "/skill-tree/icons/EarthMage/EarthMage_13.png",
    "Quick Strike":     "/skill-tree/icons/FireMage/FireMage_2.png",
    "Damage Surge":     "/skill-tree/icons/FireMage/FireMage_26.png",
    "Guardian's Aura":  "/skill-tree/icons/EarthMage/EarthMage_31.png",
    "Dual Wield":       "/skill-tree/icons/Hunter/Hunter_15.png",
    "Shield Specialist":"/skill-tree/icons/EarthMage/EarthMage_4.png",
    "Life Drain":       "/skill-tree/icons/Necromancer/Necromancer_16.png",
    "Execute":          "/skill-tree/icons/FireMage/FireMage_19.png",
    "Double Strike":    "/skill-tree/icons/FireMage/FireMage_17.png",
    "Avatar Form":      "/skill-tree/icons/FireMage/FireMage_33.png",
    "Perfect Counter":  "/skill-tree/icons/EarthMage/EarthMage_26.png",
  },
  ranger: {
    "Precision":      "/skill-tree/icons/Hunter/Hunter_4.png",
    "Power Shot":     "/skill-tree/icons/Hunter/Hunter_24.png",
    "Stealth Strike": "/skill-tree/icons/Hunter/Hunter_14.png",
    "Multi Shot":     "/skill-tree/icons/Hunter/Hunter_8.png",
    "Shadow Step":    "/skill-tree/icons/Hunter/Hunter_6.png",
    "Explosive Shot": "/skill-tree/icons/Hunter/Hunter_17.png",
    "Poison Blade":   "/skill-tree/icons/Hunter/Hunter_25.png",
    "Trap Mastery":   "/skill-tree/icons/Hunter/Hunter_16.png",
    "Rain of Arrows": "/skill-tree/icons/Hunter/Hunter_22.png",
    "Assassinate":    "/skill-tree/icons/Hunter/Hunter_15.png",
    "Storm of Arrows":"/skill-tree/icons/Hunter/Hunter_18.png",
    "Shadow Master":  "/skill-tree/icons/Hunter/Hunter_21.png",
  },
  worge: {
    "Bear Form":     "/skill-tree/icons/EarthMage/EarthMage_20.png",
    "Howl":          "/skill-tree/icons/Hunter/Hunter_9.png",
    "Pack Hunt":     "/skill-tree/icons/Hunter/Hunter_1.png",
    "Feral Rage":    "/skill-tree/icons/FireMage/FireMage_14.png",
    "Alpha Call":    "/skill-tree/icons/Hunter/Hunter_20.png",
    "Alpha Bear":    "/skill-tree/icons/EarthMage/EarthMage_31.png",
    "Raptor Form":   "/skill-tree/icons/FireMage/FireMage_36.png",
    "Blood Frenzy":  "/skill-tree/icons/FireMage/FireMage_3.png",
    "Apex Predator": "/skill-tree/icons/Hunter/Hunter_7.png",
    "Primal Fury":   "/skill-tree/icons/FireMage/FireMage_34.png",
    "Worg Lord":     "/skill-tree/icons/Necromancer/Necromancer_5.png",
    "Primal Avatar": "/skill-tree/icons/FireMage/FireMage_33.png",
  },
};

const STORAGE_KEY = "gw-selector-v3";

type State = { race: RaceKey | null; cls: ClassKey | null; picks: Record<string, Record<number, string[]>> };

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { race: null, cls: null, picks: {} };
}

function saveState(s: State) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

interface Props {
  onBack?: () => void;
  onForgeCaptain?: () => void;
}

export default function ClassTree({ onBack, onForgeCaptain }: Props) {
  const [state, setState] = useState<State>(() => loadState());
  const [toast, setToast] = useState<string | null>(null);
  const [curtain, setCurtain] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; skill: Skill; lvl: number } | null>(null);
  const particlesRef = useRef<HTMLDivElement>(null);

  // Persist whenever state changes
  useEffect(() => { saveState(state); }, [state]);

  // Auto-pick the level-0 skills for the active class
  useEffect(() => {
    const k = state.cls;
    if (!k) return;
    const c = CLASSES[k];
    const tier0 = c.tiers.find(t => t.auto);
    if (!tier0) return;
    const cur = state.picks[k]?.[tier0.lvl] ?? [];
    if (cur.length === 0) {
      setState(s => ({
        ...s,
        picks: { ...s.picks, [k]: { ...(s.picks[k] || {}), [tier0.lvl]: [tier0.skills[0].n] } },
      }));
    }
  }, [state.cls]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spawn drifting particles once
  useEffect(() => {
    const host = particlesRef.current;
    if (!host) return;
    const colors = ["#fff", "#f6c945", "#6aa9ff", "#c792ff", "#6bdc8b"];
    for (let i = 0; i < 70; i++) {
      const s = document.createElement("span");
      s.style.left = Math.random() * 100 + "%";
      s.style.bottom = "-10px";
      s.style.animationDuration = (12 + Math.random() * 22) + "s";
      s.style.animationDelay = (-Math.random() * 30) + "s";
      const size = Math.random() * 2.4 + 0.8;
      s.style.width = s.style.height = size + "px";
      const color = colors[Math.floor(Math.random() * colors.length)];
      s.style.background = color;
      s.style.color = color;
      s.style.boxShadow = "0 0 " + (6 + Math.random() * 10) + "px currentColor";
      host.appendChild(s);
    }
    return () => { while (host.firstChild) host.removeChild(host.firstChild); };
  }, []);

  const cls = state.cls;
  const c = cls ? CLASSES[cls] : null;
  const race = state.race ? RACES[state.race] : null;

  const need = useMemo(() => c ? c.tiers.filter(t => !t.auto).reduce((a, t) => a + (t.picks ?? 1), 0) : 0, [c]);
  const got = useMemo(() => {
    if (!c || !cls) return 0;
    return c.tiers.filter(t => !t.auto).reduce((a, t) => a + ((state.picks[cls]?.[t.lvl]?.length) ?? 0), 0);
  }, [c, cls, state.picks]);
  const pct = need ? Math.min(100, (got / need) * 100) : 0;
  const ready = need > 0 && got >= need;

  const isPicked = (k: ClassKey, lvl: number, name: string) => (state.picks[k]?.[lvl] ?? []).includes(name);

  const togglePick = (k: ClassKey, lvl: number, name: string, picks: number) => {
    setState(s => {
      const classPicks = { ...(s.picks[k] || {}) };
      let arr = classPicks[lvl] ? [...classPicks[lvl]] : [];
      if (arr.includes(name)) arr = arr.filter(x => x !== name);
      else { arr.push(name); while (arr.length > picks) arr.shift(); }
      classPicks[lvl] = arr;
      return { ...s, picks: { ...s.picks, [k]: classPicks } };
    });
  };

  const onRandomize = () => {
    if (!cls || !c) return;
    const next: Record<number, string[]> = {};
    c.tiers.forEach(t => {
      if (t.auto) { next[t.lvl] = [t.skills[0].n]; return; }
      const picks = t.picks ?? 1;
      const pool = [...t.skills].sort(() => Math.random() - 0.5).slice(0, picks).map(s => s.n);
      next[t.lvl] = pool;
    });
    setState(s => ({ ...s, picks: { ...s.picks, [cls]: next } }));
  };

  const onReset = () => {
    if (!confirm("Reset race, class, and all selections?")) return;
    setState({ race: null, cls: null, picks: {} });
  };

  const onLock = () => {
    if (!cls || !ready || !state.race) return;
    setCurtain(true);
    setTimeout(() => setCurtain(false), 900);
    const raceName = race ? race.name + " " : "";
    setToast(`⚔ ${raceName}${CLASSES[cls].name} Build Locked`);
    setTimeout(() => setToast(null), 1900);
    const build = buildCaptainFromClassTree(state.race, cls as CaptainClassKey, state.picks[cls] ?? {});
    saveCaptainBuild(build);
    void persistCaptainBuildToFleet(build).catch((err) =>
      console.warn("[ClassTree] fleet sync failed:", err),
    );
    // eslint-disable-next-line no-console
    console.log("[ClassTree] Captain build saved:", build);
  };

  const onForge = () => {
    if (!cls || !ready || !state.race) return;
    const build = buildCaptainFromClassTree(state.race, cls as CaptainClassKey, state.picks[cls] ?? {});
    saveCaptainBuild(build);
    void persistCaptainBuildToFleet(build).catch((err) =>
      console.warn("[ClassTree] fleet sync failed:", err),
    );
    onForgeCaptain?.();
  };

  const canForge = ready && !!cls && !!state.race;

  const showTip = (e: React.MouseEvent, skill: Skill, lvl: number) => {
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + 300 > window.innerWidth) x = e.clientX - 300 - 14;
    if (y + 200 > window.innerHeight) y = e.clientY - 200 - 14;
    setTip({ x, y, skill, lvl });
  };

  return (
    <div className="ct-root" data-testid="page-class-tree">
      <style>{CSS}</style>

      {/* background stage */}
      <div className="stage">
        {(Object.keys(HERO_BG) as ClassKey[]).map(k => (
          <div
            key={k}
            className={`bg ${cls === k ? "active" : ""}`}
            style={{ backgroundImage: `url('${HERO_BG[k]}')` }}
          />
        ))}
        <div className="sheen" />
        <div className="particles" ref={particlesRef} />
      </div>

      <div className="shell">
        <div className="topbar">
          <div className="brand">
            GRUDGE WARLORDS
            <small>RACE · CLASS · SKILL CODEX</small>
          </div>
          <div className="crumbs">
            Distribution · <b>0</b>·1·5·10·15·20
          </div>
          {onBack && (
            <button onClick={onBack} className="btn ghost" data-testid="button-back-class-tree" style={{ marginLeft: 16 }}>
              ← Back
            </button>
          )}
        </div>

        {/* races */}
        <div className="racepicker">
          {(Object.keys(RACES) as RaceKey[]).map(k => {
            const r = RACES[k];
            const active = state.race === k;
            return (
              <div
                key={k}
                className={`race ${active ? "active" : ""}`}
                title={`${r.name} — ${r.blurb}`}
                onClick={() => setState(s => ({ ...s, race: s.race === k ? null : k }))}
                data-testid={`race-${k}`}
              >
                <div className="portrait" style={{ backgroundImage: `url('${r.img}')` }} />
                <div className="label">{r.name}</div>
              </div>
            );
          })}
        </div>

        {/* classes */}
        <div className="classpicker">
          {(Object.keys(CLASSES) as ClassKey[]).map(k => {
            const cc = CLASSES[k];
            const active = cls === k;
            return (
              <div
                key={k}
                className={`cls ${active ? "active" : ""}`}
                data-k={k}
                onClick={() => setState(s => ({ ...s, cls: k, picks: { ...s.picks, [k]: s.picks[k] || {} } }))}
                data-testid={`class-${k}`}
              >
                <div className="cover" style={{ backgroundImage: `url('${cc.hero}')` }} />
                <div className="head">
                  <div className="crest">{cc.emoji}</div>
                  <div>
                    <h3>{cc.name}</h3>
                    <div className="role">{cc.role}</div>
                  </div>
                </div>
                <p>{cc.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="main">
          <section className="board">
            <div className="board-head">
              <h2>{c ? c.name : "Choose your Class"}</h2>
              <span className="tag">{c ? c.role : "—"}</span>
            </div>

            <div className="progress">
              <div className="fill" style={{ width: pct + "%" }} />
              <div className="ticks">
                <span>0</span><span>1</span><span>5</span><span>10</span><span>15</span><span>20</span>
              </div>
            </div>

            <div className="tree" data-k={cls ?? ""}>
              {!c ? (
                <div style={{ padding: 40, color: "var(--mute)", textAlign: "center", fontSize: 14 }}>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: 18, letterSpacing: 2, color: "#fff", marginBottom: 8 }}>
                    ⚔ Select a Class ⚔
                  </div>
                  Choose from Mage, Warrior, Ranger, or Worge above to view its skill tree.
                </div>
              ) : c.tiers.map(t => {
                const picks = t.picks ?? 1;
                return (
                  <div key={t.lvl} className={`tier ${t.auto ? "auto" : ""}`}>
                    <div className="tier-label">
                      <b>Lv {t.lvl}</b>{t.label}
                      <div className="pickhint">{t.hint}</div>
                    </div>
                    <div className="row">
                      {t.skills.map(s => {
                        const picked = cls ? isPicked(cls, t.lvl, s.n) : false;
                        const iconPath = ICONS[cls!]?.[s.n];
                        return (
                          <div
                            key={s.n}
                            className={`node ${t.auto ? "auto" : ""} ${picked ? "selected" : ""}`}
                            onMouseMove={(e) => showTip(e, s, t.lvl)}
                            onMouseLeave={() => setTip(null)}
                            onClick={() => { if (!t.auto && cls) togglePick(cls, t.lvl, s.n, picks); }}
                            data-testid={`skill-${cls}-${t.lvl}-${s.n.replace(/\s+/g, "-").toLowerCase()}`}
                          >
                            {t.auto && <div className="badge">AUTO</div>}
                            <div className="head">
                              <div className="icon">
                                {iconPath ? <img src={iconPath} alt={s.n} /> : <span>{s.i}</span>}
                              </div>
                              <div className="name">{s.n}</div>
                            </div>
                            <div className="desc">{s.d}</div>
                            <div className="meta">
                              {Object.entries(s.stats).slice(0, 4).map(([k, v]) => (
                                <span key={k}>{k}: {v}</span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="side">
            <div className="hero">
              {state.race ? (
                <div className="preview3d">
                  <RacePreview3D
                    race={state.race}
                    weaponStyle={cls ? CLASS_TO_WEAPON_STYLE[cls as CaptainClassKey] : null}
                  />
                </div>
              ) : (
                <div
                  className="img"
                  style={{
                    backgroundImage: c ? `url('${c.hero}')` : "none",
                    backgroundPosition: "center",
                  }}
                />
              )}
              <div className="title">
                <h3>{(race ? race.name + " " : "") + (c ? c.name : "—")}</h3>
                <span>{race ? `${race.blurb} · ${c?.role ?? ""}` : (c ? c.role : "Select a class to begin")}</span>
              </div>
            </div>

            <div className="build">
              {c && cls ? c.tiers.map(t => {
                const arr = state.picks[cls]?.[t.lvl] ?? [];
                const names = arr.length ? arr.join(" + ") : "—";
                const picked = arr.length > 0;
                return (
                  <div key={t.lvl} className={`bline ${picked ? "picked" : ""}`}>
                    <div className="dot" />
                    <div className="lbl">Lv {t.lvl}</div>
                    <b>{names}</b>
                    <em>{t.auto ? "auto" : `pick ${t.picks ?? 1}`}</em>
                  </div>
                );
              }) : (
                <div style={{ color: "var(--mute)", fontSize: 12, padding: "6px 2px" }}>No class selected.</div>
              )}
            </div>

            <div className="actions">
              <button className="btn primary" onClick={onLock} disabled={!canForge} data-testid="button-lock-build">
                Lock Build
              </button>
              {onForgeCaptain && (
                <button className="btn forge" onClick={onForge} disabled={!canForge} data-testid="button-forge-captain">
                  ⚔ Forge as Captain
                </button>
              )}
              <button className="btn ghost" onClick={onRandomize} disabled={!cls} data-testid="button-randomize">
                Randomize
              </button>
              <button className="btn danger" onClick={onReset} data-testid="button-reset">
                Reset
              </button>
            </div>
          </aside>
        </div>
      </div>

      {tip && (
        <div className="tip show" style={{ left: tip.x, top: tip.y }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {cls && ICONS[cls]?.[tip.skill.n] && (
              <div className="thumb"><img src={ICONS[cls][tip.skill.n]} alt={tip.skill.n} /></div>
            )}
            <div style={{ flex: 1 }}>
              <b>{tip.skill.n}</b> <span style={{ color: "var(--mute)", fontSize: 11 }}>· Lv {tip.lvl}</span>
              <div style={{ marginTop: 6 }}>{tip.skill.d}</div>
              <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {Object.entries(tip.skill.stats).map(([k, v]) => (
                  <span key={k} style={{ background: "rgba(255,255,255,.05)", padding: "2px 6px", borderRadius: 6, fontSize: 11 }}>
                    {k}: {v}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}
      <div className={`curtain ${curtain ? "show" : ""}`} />
    </div>
  );
}

const CSS = `
.ct-root{
  --ink:#eef2ff; --mute:#9aa3c7; --line:rgba(255,255,255,.08);
  --gold:#f6c945; --gold2:#ffd98a; --shadow:0 20px 60px -20px rgba(0,0,0,.55);
  --c-worge:#c792ff; --c-warrior:#ff6b57; --c-mage:#6aa9ff; --c-ranger:#6bdc8b;
  position:relative;min-height:100vh;width:100%;
  font-family:'Inter',system-ui,sans-serif;color:var(--ink);
  background:#05060c;overflow-x:hidden;
}
.ct-root *{box-sizing:border-box}

.ct-root .stage{position:fixed;inset:0;z-index:0;overflow:hidden;}
.ct-root .stage .bg{
  position:absolute;inset:-4%;background-size:cover;background-position:center;
  filter:saturate(1.1) brightness(.55);transform:scale(1.06);
  transition:opacity 1.2s ease, transform 8s ease;opacity:0;
}
.ct-root .stage .bg.active{opacity:1;transform:scale(1.02)}
.ct-root .stage::after{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:
    radial-gradient(1200px 700px at 50% 110%,rgba(0,0,0,.75),transparent 55%),
    radial-gradient(900px 500px at 10% -10%,rgba(10,15,40,.6),transparent 60%),
    linear-gradient(180deg,rgba(5,6,12,.4),rgba(5,6,12,.82));
}
.ct-root .particles{position:absolute;inset:0;pointer-events:none;overflow:hidden;mix-blend-mode:screen;opacity:.8}
.ct-root .particles span{
  position:absolute;display:block;width:2px;height:2px;border-radius:50%;background:#fff;opacity:0;
  animation:ct-drift linear infinite;
}
@keyframes ct-drift{
  0%{opacity:0;transform:translateY(0) scale(.6)}
  10%{opacity:.9}
  100%{opacity:0;transform:translateY(-110vh) scale(1.3)}
}
.ct-root .sheen{
  position:absolute;inset:-20%;pointer-events:none;
  background:conic-gradient(from 0deg at 30% 40%,rgba(106,169,255,.12),transparent 25%,rgba(199,146,255,.10) 55%,transparent 80%,rgba(107,220,139,.09));
  filter:blur(60px);animation:ct-spin 40s linear infinite;opacity:.9;
}
@keyframes ct-spin{to{transform:rotate(360deg)}}

.ct-root .shell{position:relative;z-index:2;max-width:1440px;margin:0 auto;padding:26px 26px 60px}
.ct-root .topbar{display:flex;align-items:center;gap:16px;margin-bottom:22px}
.ct-root .brand{
  font-family:'Cinzel',serif;font-weight:900;letter-spacing:3px;font-size:22px;
  background:linear-gradient(90deg,var(--gold),#fff3c2 50%,var(--gold));
  -webkit-background-clip:text;background-clip:text;color:transparent;
  text-shadow:0 0 24px rgba(246,201,69,.15);
}
.ct-root .brand small{
  display:block;font-family:'Inter',sans-serif;letter-spacing:2px;
  color:var(--mute);font-weight:600;font-size:10px;margin-top:2px;
}
.ct-root .crumbs{margin-left:auto;color:var(--mute);font-size:12px;letter-spacing:2px}
.ct-root .crumbs b{color:#fff}

.ct-root .racepicker{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:14px}
@media (max-width:820px){.ct-root .racepicker{grid-template-columns:repeat(3,1fr)}}
.ct-root .race{
  position:relative;cursor:pointer;border:1px solid var(--line);border-radius:14px;overflow:hidden;
  aspect-ratio:1/1;background:#0b0f1e;
  transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease;
}
.ct-root .race:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.22)}
.ct-root .race .portrait{
  position:absolute;inset:0;background-size:cover;background-position:center top;
  transform:scale(1.03);transition:transform .5s ease,filter .3s ease;filter:saturate(.9) brightness(.9);
}
.ct-root .race:hover .portrait{transform:scale(1.1);filter:saturate(1.1) brightness(1)}
.ct-root .race::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(6,8,16,.8))}
.ct-root .race .label{
  position:absolute;left:0;right:0;bottom:6px;z-index:2;text-align:center;
  font-family:'Cinzel',serif;font-size:11px;letter-spacing:2px;color:#fff;
  text-shadow:0 2px 6px rgba(0,0,0,.9);
}
.ct-root .race.active{
  border-color:transparent;
  box-shadow:0 0 0 1px rgba(246,201,69,.6),0 14px 40px -14px rgba(246,201,69,.5);
}
.ct-root .race.active .portrait{filter:saturate(1.2) brightness(1.05);transform:scale(1.08)}

.ct-root .classpicker{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
@media (max-width:820px){.ct-root .classpicker{grid-template-columns:repeat(2,1fr)}}
.ct-root .cls{
  position:relative;cursor:pointer;border:1px solid var(--line);border-radius:18px;
  padding:18px 18px 16px;background:linear-gradient(180deg,rgba(18,22,40,.75),rgba(10,12,22,.75));
  backdrop-filter:blur(14px);overflow:hidden;
  transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease;
}
.ct-root .cls:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.18)}
.ct-root .cls .cover{
  position:absolute;inset:0;z-index:0;opacity:.55;background-size:cover;background-position:center top;
  -webkit-mask-image:linear-gradient(180deg,black,transparent 85%);mask-image:linear-gradient(180deg,black,transparent 85%);
  transform:scale(1.05);transition:transform .6s ease,opacity .3s ease;filter:saturate(.9) brightness(.8);
}
.ct-root .cls:hover .cover{transform:scale(1.12);opacity:.7;filter:saturate(1.1) brightness(.9)}
.ct-root .cls .head{position:relative;z-index:1;display:flex;align-items:center;gap:12px}
.ct-root .cls .crest{
  width:52px;height:52px;border-radius:14px;display:grid;place-items:center;font-size:26px;
  background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.05));
  border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 0 30px rgba(255,255,255,.05);
}
.ct-root .cls h3{margin:0;font-family:'Cinzel',serif;font-size:18px;letter-spacing:1px}
.ct-root .cls .role{position:relative;z-index:1;color:var(--mute);font-size:12px;margin-top:2px;letter-spacing:.5px}
.ct-root .cls p{position:relative;z-index:1;color:#cfd5f5;font-size:13px;line-height:1.45;margin:12px 0 0}
.ct-root .cls.active{
  border-color:transparent;
  box-shadow:0 0 0 1px rgba(246,201,69,.55),0 22px 50px -20px rgba(246,201,69,.35);
}
.ct-root .cls.active .cover{opacity:.85;filter:saturate(1.1) brightness(.95)}
.ct-root .cls[data-k="mage"] .crest{background:linear-gradient(180deg,#bcd8ff,#6aa9ff);color:#04122c}
.ct-root .cls[data-k="warrior"] .crest{background:linear-gradient(180deg,#ffb3a6,#ff6b57);color:#2a0a07}
.ct-root .cls[data-k="ranger"] .crest{background:linear-gradient(180deg,#b2f0c4,#6bdc8b);color:#06220f}
.ct-root .cls[data-k="worge"] .crest{background:linear-gradient(180deg,#e1c8ff,#c792ff);color:#1c0a3a}

.ct-root .main{display:grid;grid-template-columns:1fr 380px;gap:20px}
@media (max-width:1100px){.ct-root .main{grid-template-columns:1fr}}

.ct-root .board{
  position:relative;border:1px solid var(--line);border-radius:22px;
  background:radial-gradient(600px 300px at 10% -10%,rgba(255,255,255,.06),transparent 60%),linear-gradient(180deg,rgba(16,20,36,.78),rgba(8,10,20,.78));
  backdrop-filter:blur(12px);padding:22px 22px 26px;overflow:hidden;box-shadow:var(--shadow);
}
.ct-root .board::before{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:.35;
  background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);
  background-size:40px 40px;
  -webkit-mask-image:radial-gradient(ellipse at center,black 65%,transparent 100%);mask-image:radial-gradient(ellipse at center,black 65%,transparent 100%);
}
.ct-root .board-head{display:flex;align-items:center;gap:14px;margin:2px 0 10px}
.ct-root .board-head h2{margin:0;font-family:'Cinzel',serif;letter-spacing:2px;font-size:22px}
.ct-root .board-head .tag{
  margin-left:auto;font-size:11px;color:var(--mute);letter-spacing:2px;
  padding:6px 10px;border:1px solid var(--line);border-radius:999px;
}
.ct-root .progress{position:relative;height:10px;border-radius:999px;margin:10px 0 20px;background:rgba(255,255,255,.05);border:1px solid var(--line);overflow:hidden}
.ct-root .progress .fill{
  position:absolute;inset:0;width:0%;
  background:linear-gradient(90deg,var(--gold),#fff3c2,var(--gold));
  box-shadow:0 0 30px rgba(246,201,69,.5) inset;transition:width .45s cubic-bezier(.2,.8,.2,1);
}
.ct-root .progress .ticks{position:absolute;inset:0;display:flex;justify-content:space-between;padding:0 4px;align-items:center}
.ct-root .progress .ticks span{font-size:9px;color:var(--mute);letter-spacing:2px}

.ct-root .tree{position:relative;display:flex;flex-direction:column;gap:28px;z-index:1}
.ct-root .tier{display:grid;grid-template-columns:150px 1fr;gap:16px;align-items:center}
.ct-root .tier-label{
  text-align:right;color:var(--mute);font-size:11px;letter-spacing:2px;text-transform:uppercase;
  border-right:1px dashed rgba(255,255,255,.12);padding-right:14px;
}
.ct-root .tier-label b{display:block;font-family:'Cinzel',serif;font-size:22px;color:#fff;letter-spacing:0;margin-bottom:2px}
.ct-root .tier-label .pickhint{
  display:inline-block;margin-top:6px;font-size:10px;padding:3px 8px;
  border-radius:999px;background:rgba(255,255,255,.05);color:#cfd5f5;border:1px solid var(--line);
}
.ct-root .tier.auto .pickhint{background:linear-gradient(180deg,rgba(246,201,69,.2),rgba(246,201,69,.05));color:var(--gold2);border-color:rgba(246,201,69,.35)}

.ct-root .row{display:flex;flex-wrap:wrap;gap:14px}
.ct-root .node{
  position:relative;width:220px;min-height:112px;cursor:pointer;
  border-radius:16px;padding:14px 14px 12px;
  background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015));
  border:1px solid var(--line);overflow:hidden;
  transition:transform .18s ease,border-color .18s ease,box-shadow .25s ease;
}
.ct-root .node:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.22)}
.ct-root .node .head{display:flex;align-items:center;gap:10px}
.ct-root .node .icon{
  width:42px;height:42px;border-radius:10px;display:grid;place-items:center;overflow:hidden;
  font-size:18px;font-weight:900;color:#06101f;
  background:linear-gradient(180deg,#fff,#cfd8ff);
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.15),0 6px 22px -12px rgba(255,255,255,.4);
}
.ct-root .node .icon img{width:100%;height:100%;display:block;object-fit:cover}
.ct-root .node .name{font-weight:800;font-size:14px;letter-spacing:.2px}
.ct-root .node .desc{color:#c9cfec;font-size:12px;line-height:1.45;margin-top:6px;min-height:34px}
.ct-root .node .meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.ct-root .node .meta span{font-size:10px;color:#dcdff0;background:rgba(255,255,255,.06);padding:2px 7px;border-radius:999px;letter-spacing:.3px}
.ct-root .node.auto{
  border-color:rgba(246,201,69,.4);
  background:linear-gradient(180deg,rgba(246,201,69,.14),rgba(246,201,69,.02));
  box-shadow:0 10px 40px -18px rgba(246,201,69,.5);
}
.ct-root .node.auto .badge{
  position:absolute;top:10px;right:10px;font-size:9px;letter-spacing:1.5px;
  background:linear-gradient(180deg,var(--gold),#d8a819);color:#201608;
  padding:3px 8px;border-radius:999px;font-weight:800;
}
.ct-root .node.selected{
  border-color:transparent;
  box-shadow:0 0 0 1px rgba(246,201,69,.6),0 10px 50px -10px rgba(246,201,69,.55),0 0 40px rgba(246,201,69,.15);
  background:linear-gradient(180deg,rgba(246,201,69,.18),rgba(246,201,69,.04));
  animation:ct-pick .6s ease;
}
.ct-root .node.selected .icon{box-shadow:0 0 18px rgba(246,201,69,.9),inset 0 0 0 1px rgba(0,0,0,.15)}
@keyframes ct-pick{0%{transform:scale(1)}35%{transform:scale(1.06) rotate(.3deg)}100%{transform:scale(1)}}
.ct-root .tree[data-k="mage"] .node .icon{background:linear-gradient(180deg,#bcd8ff,#6aa9ff);color:#03132c}
.ct-root .tree[data-k="warrior"] .node .icon{background:linear-gradient(180deg,#ffb3a6,#ff6b57);color:#2a0a07}
.ct-root .tree[data-k="ranger"] .node .icon{background:linear-gradient(180deg,#b2f0c4,#6bdc8b);color:#08220f}
.ct-root .tree[data-k="worge"] .node .icon{background:linear-gradient(180deg,#e1c8ff,#c792ff);color:#1c0a3a}

.ct-root .side{
  position:sticky;top:20px;align-self:start;
  border:1px solid var(--line);border-radius:22px;
  background:linear-gradient(180deg,rgba(16,20,36,.85),rgba(8,10,20,.85));
  backdrop-filter:blur(14px);padding:18px;min-height:520px;box-shadow:var(--shadow);overflow:hidden;
}
.ct-root .side .hero{
  position:relative;height:220px;border-radius:16px;overflow:hidden;margin-bottom:16px;background:#0a0f20;
  border:1px solid rgba(255,255,255,.08);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.04),0 18px 40px -24px rgba(0,0,0,.65);
}
.ct-root .side .hero .img{
  position:absolute;inset:0;background-size:cover;background-position:center;
  transform:scale(1.05);transition:transform .8s ease;
}
.ct-root .side .hero:hover .img{transform:scale(1.12)}
.ct-root .side .hero::after{
  content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(6,8,16,.08),rgba(6,8,16,.82)),radial-gradient(400px 180px at 50% 0%,rgba(255,255,255,.12),transparent 60%);
}
.ct-root .side .hero .title{position:absolute;left:14px;right:14px;bottom:10px;z-index:2}
.ct-root .side .hero .title h3{margin:0;font-family:'Cinzel',serif;font-size:22px;letter-spacing:1.5px;text-shadow:0 2px 12px rgba(0,0,0,.6)}
.ct-root .side .hero .title span{color:#dcdff0;font-size:11px;letter-spacing:1.5px}

.ct-root .build{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.ct-root .bline{
  display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;
  background:rgba(255,255,255,.03);border:1px solid var(--line);font-size:12px;
}
.ct-root .bline.picked{border-color:rgba(246,201,69,.35);background:linear-gradient(180deg,rgba(246,201,69,.07),transparent)}
.ct-root .bline .dot{width:8px;height:8px;border-radius:50%;background:#555c7a}
.ct-root .bline.picked .dot{background:var(--gold);box-shadow:0 0 10px var(--gold)}
.ct-root .bline .lbl{font-family:'Cinzel',serif;letter-spacing:1.5px;color:var(--mute);width:60px}
.ct-root .bline b{color:#fff}
.ct-root .bline em{margin-left:auto;color:var(--mute);font-style:normal;font-size:11px}

.ct-root .actions{display:flex;gap:8px;flex-wrap:wrap}
.ct-root .btn{
  appearance:none;border:0;cursor:pointer;font-weight:800;font-size:13px;
  padding:11px 14px;border-radius:12px;letter-spacing:.5px;
  transition:transform .1s,filter .15s,box-shadow .2s;color:var(--ink);
}
.ct-root .btn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.08)}
.ct-root .btn.primary{
  background:linear-gradient(180deg,var(--gold),#d8a819);color:#20180a;
  box-shadow:0 10px 30px -10px rgba(246,201,69,.65);
}
.ct-root .btn.primary:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.4)}
.ct-root .btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.ct-root .btn.danger{background:rgba(255,70,70,.12);color:#ff9aa0;border:1px solid rgba(255,70,70,.3)}
.ct-root .btn.forge{
  background:linear-gradient(180deg,#7c5cff,#4a2ad6);color:#f4f0ff;
  box-shadow:0 10px 30px -10px rgba(124,92,255,.65);
  border:1px solid rgba(180,160,255,.4);
}
.ct-root .btn.forge:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.4)}
.ct-root .preview3d{position:absolute;inset:0;background:radial-gradient(ellipse at center bottom,rgba(124,92,255,.18),transparent 70%),#070a14}

.ct-root .tip{
  position:fixed;z-index:100;pointer-events:none;
  background:rgba(10,12,22,.95);border:1px solid var(--line);border-radius:12px;
  padding:12px 14px;max-width:280px;font-size:12px;line-height:1.5;color:#dfe3f7;
  box-shadow:var(--shadow);opacity:0;transform:translateY(6px);
  transition:opacity .14s ease,transform .14s ease;
}
.ct-root .tip.show{opacity:1;transform:translateY(0)}
.ct-root .tip b{color:#fff}
.ct-root .tip .thumb{
  width:48px;height:48px;border-radius:10px;overflow:hidden;flex:0 0 auto;
  border:1px solid rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(0,0,0,.18);
}
.ct-root .tip .thumb img{width:100%;height:100%;display:block;object-fit:cover}

.ct-root .toast{
  position:fixed;bottom:24px;left:50%;transform:translate(-50%,0);
  background:linear-gradient(180deg,var(--gold),#d8a819);color:#20180a;
  padding:14px 20px;border-radius:14px;font-weight:800;letter-spacing:.8px;
  box-shadow:0 20px 60px -20px rgba(246,201,69,.6);z-index:200;
}
.ct-root .curtain{
  position:fixed;inset:0;background:radial-gradient(ellipse at center,rgba(246,201,69,.18),rgba(5,6,12,.95) 60%);
  opacity:0;pointer-events:none;z-index:150;transition:opacity .6s ease;
}
.ct-root .curtain.show{opacity:1}

@media (max-width:720px){
  .ct-root .tier{grid-template-columns:1fr}
  .ct-root .tier-label{text-align:left;border-right:0;border-left:2px solid rgba(255,255,255,.1);padding:0 0 0 10px}
  .ct-root .node{width:calc(50% - 7px)}
}
`;
