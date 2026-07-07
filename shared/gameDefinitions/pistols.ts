/**
 * Pistols — the missing weapon family. WEAPON_TYPES already declared "Gun"
 * but no Weapon entries existed. These reference the Quaternius pirate kit
 * pistol models so they actually render in-world instead of falling back
 * to a default cube.
 *
 * Wired into ALL_WEAPONS via re-export from weapons.ts.
 */

import type { Weapon } from './weapons';

function parseStats(dmg: string, speed: string, combo: string, crit: string, block: string, def: string) {
  const parse = (s: string) => {
    const parts = s.split(' +');
    const base    = parseFloat(parts[0]) || 0;
    const perTier = parts.length > 1 ? (parseFloat(parts[1]) || 0) : 0;
    return { base, perTier };
  };
  return {
    damageBase:    parse(dmg).base,    damagePerTier:    parse(dmg).perTier,
    speedBase:     parse(speed).base,  speedPerTier:     parse(speed).perTier,
    comboBase:     parse(combo).base,  comboPerTier:     parse(combo).perTier,
    critBase:      parse(crit).base,   critPerTier:      parse(crit).perTier,
    blockBase:     parse(block).base,  blockPerTier:     parse(block).perTier,
    defenseBase:   parse(def).base,    defensePerTier:   parse(def).perTier,
  };
}

// Quaternius pirate kit pistol asset paths.
// (Asset registry tracks these; missing files fall back to a procedural pistol.)
const PISTOL_ASSET = {
  flintlock:    '/models/pirate/pistol-flintlock.glb',
  blunderbuss:  '/models/pirate/pistol-blunderbuss.glb',
  doubleBarrel: '/models/pirate/pistol-doublebarrel.glb',
  hand:         '/models/pirate/pistol-hand.glb',
};

export const PISTOLS: Weapon[] = [
  {
    id: 'pistol-grudgemaker',
    name: 'Grudgemaker',
    type: 'Gun', category: '1h',
    lore: 'A flintlock notched once for every grudge it has settled.',
    stats: parseStats('38 +9', '60 +14', '0 +0', '8 +1.2', '0 +0', '5 +1'),
    basicAbility: 'Pistol Shot (single, builds 1 Grudge Mark)',
    abilities: [
      'Quick Draw (instant shot, no wind-up)',
      'Powder Burn (cone AoE point-blank)',
      'Mark & Fire (consume 3 marks for guaranteed crit)',
      'Pistol Whip (melee bash + interrupt)',
    ],
    signatureAbility: 'Six Shots, Six Grudges (auto-fire on every visible Mark)',
    passives: ['Steady Hand (+15% crit at full hp)', 'Quick Reload (-25% cooldown)', 'Powder Master (+10% dmg)'],
    craftedBy: 'Engineer',
    assetPath: PISTOL_ASSET.flintlock,
  },
  {
    id: 'pistol-blunderbuss',
    name: 'Blunderbuss',
    type: 'Gun', category: '1h',
    lore: 'A bell-mouthed thunder-stick. Inaccurate, devastating up close.',
    stats: parseStats('22 +6', '90 +20', '0 +0', '4 +0.6', '0 +0', '5 +1'),
    basicAbility: 'Scattershot (cone AoE)',
    abilities: [
      'Powder Burn (point-blank cone)',
      'Pistol Whip (melee bash)',
      'Loaded for Bear (load 2 charges, fire both)',
      'Knockback Round (push targets)',
    ],
    signatureAbility: 'Iron Storm (full cone point-blank, knockdown)',
    passives: ['Wide Pattern (+30% spread radius)', 'Iron Lungs (+10% knockback)', 'Brawler (+15% melee dmg)'],
    craftedBy: 'Engineer',
    assetPath: PISTOL_ASSET.blunderbuss,
  },
  {
    id: 'pistol-doublebarrel',
    name: 'Double Cross',
    type: 'Gun', category: '1h',
    lore: 'Two barrels for two grudges. Fire one, fire both, never miss the second.',
    stats: parseStats('30 +7', '70 +16', '20 +8', '6 +0.9', '0 +0', '4 +0.8'),
    basicAbility: 'Pistol Shot',
    abilities: [
      'Twin Tap (fire both barrels in sequence)',
      'Quick Draw (instant first shot)',
      'Mark & Fire (mark consumer)',
      'Reload Roll (reload while dodging)',
    ],
    signatureAbility: 'Crossfire (dual-shot, second auto-targets nearest mark)',
    passives: ['Twin Strike (+20% combo)', 'Steady Hand', 'Quick Reload'],
    craftedBy: 'Engineer',
    assetPath: PISTOL_ASSET.doubleBarrel,
  },
  {
    id: 'pistol-hand',
    name: 'Hand Cannon',
    type: 'Gun', category: '1h',
    lore: 'A short-barrelled brute. Easy to hide, harder to ignore.',
    stats: parseStats('45 +11', '50 +12', '0 +0', '7 +1.0', '0 +0', '6 +1.2'),
    basicAbility: 'Pistol Shot',
    abilities: [
      'Heavy Round (high single-target dmg)',
      'Pistol Whip',
      'Aimed Shot (channelled crit)',
      'Backbreaker (bonus dmg vs slowed)',
    ],
    signatureAbility: 'Cannon Round (massive single shot, recoil knockback on self)',
    passives: ['Heavy Bore (+25% dmg, -20% speed)', 'Iron Sights (+10% range)', 'Powder Master'],
    craftedBy: 'Engineer',
    assetPath: PISTOL_ASSET.hand,
  },
];
