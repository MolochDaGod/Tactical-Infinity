export type SlotType = 'primary' | 'secondary' | 'ability' | 'ultimate';

export interface WeaponSkillOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: number;
  damage: number;
  cooldown: number;
  effects: string[];
}

export interface SkillSlot {
  type: SlotType;
  unlockTier: number;
  label: string;
  skills: WeaponSkillOption[];
}

export interface WeaponTypeDefinition {
  id: string;
  name: string;
  icon: string;
  slots: SkillSlot[];
}

export interface SelectedSkills {
  primary: string | null;
  secondary: string | null;
  ability: string | null;
  ultimate: string | null;
}

export const WEAPON_TYPE_DEFINITIONS: Record<string, WeaponTypeDefinition> = {
  SWORD: {
    id: "SWORD",
    name: "Sword",
    icon: "sword",
    slots: [
      {
        type: "primary",
        unlockTier: 1,
        label: "PRIMARY",
        skills: [
          { id: "sword_vengeful_slash", name: "Vengeful Slash", description: "Single-target slash, builds 1 Grudge Mark stack, max 3", icon: "sword", tier: 1, damage: 45, cooldown: 0, effects: ["Builds Grudge Mark"] },
          { id: "sword_lunging_strike", name: "Lunging Strike", description: "Ranged thrust attack", icon: "sword", tier: 2, damage: 55, cooldown: 2, effects: ["Extended Range"] },
          { id: "sword_fearful_swipe", name: "Fearful Swipe", description: "AoE fear attack", icon: "sword", tier: 3, damage: 40, cooldown: 4, effects: ["AoE Fear 2s"] },
        ]
      },
      {
        type: "secondary",
        unlockTier: 2,
        label: "SECONDARY",
        skills: [
          { id: "sword_blood_rush", name: "Blood Rush", description: "Dash forward 8m, AoE damage", icon: "zap", tier: 1, damage: 35, cooldown: 8, effects: ["Dash 8m", "AoE Damage"] },
          { id: "sword_iron_grudge", name: "Iron Grudge", description: "3s damage reduction + reflect", icon: "shield", tier: 2, damage: 0, cooldown: 12, effects: ["30% DR", "Reflect 20%"] },
          { id: "sword_clan_charge", name: "Clan Charge", description: "Gap-closer charge + 1s stun", icon: "zap", tier: 3, damage: 40, cooldown: 10, effects: ["Charge", "Stun 1s"] },
        ]
      },
      {
        type: "ability",
        unlockTier: 2,
        label: "ABILITY",
        skills: [
          { id: "sword_heroic_cleave", name: "Heroic Cleave", description: "Cone AoE clear", icon: "swords", tier: 1, damage: 60, cooldown: 6, effects: ["Cone AoE"] },
          { id: "sword_parry_counter", name: "Parry Counter", description: "Block + counter damage", icon: "shield", tier: 2, damage: 80, cooldown: 8, effects: ["Block", "Counter Attack"] },
          { id: "sword_deep_wound", name: "Deep Wound", description: "Apply bleed stack", icon: "droplet", tier: 3, damage: 30, cooldown: 4, effects: ["Bleed 5s"] },
          { id: "sword_shadow_edge", name: "Shadow Edge", description: "Dash + stun", icon: "user", tier: 4, damage: 55, cooldown: 10, effects: ["Dash", "Stun 1.5s"] },
          { id: "sword_execute", name: "Execute", description: "Bonus dmg below 30% HP", icon: "skull", tier: 5, damage: 150, cooldown: 15, effects: ["2x dmg <30% HP"] },
        ]
      },
      {
        type: "ultimate",
        unlockTier: 3,
        label: "ULTIMATE",
        skills: [
          { id: "sword_crimson_reprisal", name: "Crimson Reprisal", description: "Large AoE slash, heals per enemy hit", icon: "flame", tier: 1, damage: 150, cooldown: 45, effects: ["Large AoE", "Lifesteal"] },
          { id: "sword_nights_judgment", name: "Night's Judgment", description: "Teleport behind + bleed DoT", icon: "moon", tier: 4, damage: 200, cooldown: 60, effects: ["Teleport", "Bleed DoT"] },
        ]
      }
    ]
  },
  
  AXE: {
    id: "AXE",
    name: "Axe",
    icon: "axe",
    slots: [
      {
        type: "primary",
        unlockTier: 1,
        label: "PRIMARY",
        skills: [
          { id: "axe_rending_chop", name: "Rending Chop", description: "Single target, applies Bleed stack", icon: "axe", tier: 1, damage: 50, cooldown: 0, effects: ["Applies Bleed"] },
          { id: "axe_lunging_chop", name: "Lunging Chop", description: "Extended range chop", icon: "axe", tier: 2, damage: 55, cooldown: 2, effects: ["Extended Range"] },
          { id: "axe_ground_slam", name: "Ground Slam", description: "AoE slow attack", icon: "zap", tier: 3, damage: 45, cooldown: 4, effects: ["AoE Slow 30%"] },
        ]
      },
      {
        type: "secondary",
        unlockTier: 2,
        label: "SECONDARY",
        skills: [
          { id: "axe_adrenaline_surge", name: "Adrenaline Surge", description: "+Attack speed buff", icon: "zap", tier: 1, damage: 0, cooldown: 15, effects: ["+30% Atk Speed 5s"] },
          { id: "axe_whirl_pain", name: "Whirl of Pain", description: "Channeled AoE spin", icon: "refresh-cw", tier: 2, damage: 80, cooldown: 10, effects: ["Channel 3s", "360 AoE"] },
          { id: "axe_bloodletting", name: "Bloodletting", description: "AoE bleed apply", icon: "droplet", tier: 3, damage: 40, cooldown: 8, effects: ["AoE Bleed 6s"] },
        ]
      },
      {
        type: "ability",
        unlockTier: 2,
        label: "ABILITY",
        skills: [
          { id: "axe_carnage_spin", name: "Carnage Spin", description: "360 AoE refresh bleed", icon: "refresh-cw", tier: 1, damage: 70, cooldown: 12, effects: ["Refresh all bleeds"] },
          { id: "axe_headcracker", name: "Headcracker", description: "Single stun attack", icon: "hammer", tier: 2, damage: 65, cooldown: 8, effects: ["Stun 2s"] },
          { id: "axe_veinreaver", name: "Veinreaver", description: "AoE lifesteal attack", icon: "heart", tier: 3, damage: 55, cooldown: 10, effects: ["Lifesteal 25%"] },
          { id: "axe_frenzied_chop", name: "Frenzied Chop", description: "High burst, self-damage", icon: "flame", tier: 4, damage: 120, cooldown: 15, effects: ["Take 10% max HP"] },
        ]
      },
      {
        type: "ultimate",
        unlockTier: 3,
        label: "ULTIMATE",
        skills: [
          { id: "axe_apocalypse_cleave", name: "Apocalypse Cleave", description: "Large knockback AoE", icon: "skull", tier: 1, damage: 180, cooldown: 50, effects: ["Huge AoE", "Knockback"] },
          { id: "axe_blood_harvest", name: "Blood Harvest", description: "AoE heal on hit", icon: "droplet", tier: 4, damage: 150, cooldown: 60, effects: ["Heal 30% per hit"] },
        ]
      }
    ]
  },

  BOW: {
    id: "BOW",
    name: "Bow",
    icon: "target",
    slots: [
      {
        type: "primary",
        unlockTier: 1,
        label: "PRIMARY",
        skills: [
          { id: "bow_quick_shot", name: "Quick Shot", description: "Basic arrow shot", icon: "target", tier: 1, damage: 45, cooldown: 0, effects: ["Range 25m"] },
          { id: "bow_aimed_shot", name: "Aimed Shot", description: "Charged precision shot", icon: "crosshair", tier: 2, damage: 80, cooldown: 2, effects: ["Guaranteed Crit"] },
          { id: "bow_fire_arrow", name: "Fire Arrow", description: "Ignites target for DoT", icon: "flame", tier: 3, damage: 40, cooldown: 10, effects: ["Burn 6s"] },
        ]
      },
      {
        type: "secondary",
        unlockTier: 2,
        label: "SECONDARY",
        skills: [
          { id: "bow_multishot", name: "Multishot", description: "Fire 3 arrows at once", icon: "target", tier: 1, damage: 35, cooldown: 8, effects: ["3 Arrows", "Cone"] },
          { id: "bow_piercing", name: "Piercing Shot", description: "Arrow pierces through enemies", icon: "arrow-right", tier: 3, damage: 60, cooldown: 6, effects: ["Pierce All"] },
        ]
      },
      {
        type: "ability",
        unlockTier: 2,
        label: "ABILITY",
        skills: [
          { id: "bow_bear_trap", name: "Bear Trap", description: "Place trap that roots enemies", icon: "box", tier: 1, damage: 20, cooldown: 15, effects: ["Root 3s"] },
          { id: "bow_swift_quiver", name: "Swift Quiver", description: "+50% attack speed for 6s", icon: "zap", tier: 4, damage: 0, cooldown: 20, effects: ["+50% Atk Speed"] },
          { id: "bow_poison_arrow", name: "Poison Arrow", description: "Spread poison DoT", icon: "skull", tier: 5, damage: 30, cooldown: 12, effects: ["Poison 8s"] },
        ]
      },
      {
        type: "ultimate",
        unlockTier: 3,
        label: "ULTIMATE",
        skills: [
          { id: "bow_arrow_rain", name: "Arrow Rain", description: "Rain arrows on large area", icon: "cloud-rain", tier: 1, damage: 150, cooldown: 45, effects: ["AoE 10m", "5s Duration"] },
          { id: "bow_sniper_shot", name: "Sniper Shot", description: "Long range massive damage", icon: "crosshair", tier: 4, damage: 350, cooldown: 60, effects: ["50m Range", "Ignore Armor"] },
        ]
      }
    ]
  },

  CROSSBOW: {
    id: "CROSSBOW",
    name: "Crossbow",
    icon: "crosshair",
    slots: [
      {
        type: "primary",
        unlockTier: 1,
        label: "PRIMARY",
        skills: [
          { id: "xbow_heavy_bolt", name: "Heavy Bolt", description: "Single shot, builds Mark", icon: "crosshair", tier: 1, damage: 55, cooldown: 0, effects: ["Builds Mark"] },
          { id: "xbow_rapid_fire", name: "Rapid Fire", description: "Quick successive shots", icon: "zap", tier: 2, damage: 30, cooldown: 3, effects: ["3 Rapid Shots"] },
          { id: "xbow_explosive_round", name: "Explosive Round", description: "AoE explosion on hit", icon: "zap", tier: 3, damage: 50, cooldown: 6, effects: ["AoE 3m"] },
        ]
      },
      {
        type: "secondary",
        unlockTier: 2,
        label: "SECONDARY",
        skills: [
          { id: "xbow_knockback_bolt", name: "Knockback Bolt", description: "Push enemy back", icon: "arrow-right", tier: 1, damage: 40, cooldown: 8, effects: ["Knockback 5m"] },
          { id: "xbow_trap_bolt", name: "Trap Bolt", description: "Root trap on ground", icon: "box", tier: 2, damage: 25, cooldown: 12, effects: ["Root 2s"] },
        ]
      },
      {
        type: "ability",
        unlockTier: 2,
        label: "ABILITY",
        skills: [
          { id: "xbow_siege_mode", name: "Siege Mode", description: "Stationary increased damage", icon: "shield", tier: 1, damage: 0, cooldown: 20, effects: ["+50% Damage", "Immobile"] },
          { id: "xbow_net_shot", name: "Net Shot", description: "Slow and damage", icon: "box", tier: 3, damage: 35, cooldown: 10, effects: ["Slow 50%", "3s"] },
        ]
      },
      {
        type: "ultimate",
        unlockTier: 3,
        label: "ULTIMATE",
        skills: [
          { id: "xbow_barrage", name: "Barrage", description: "Rapid fire 10 bolts", icon: "target", tier: 1, damage: 200, cooldown: 50, effects: ["10 Shots", "2s Duration"] },
          { id: "xbow_cannon_shot", name: "Cannon Shot", description: "Massive single target", icon: "zap", tier: 4, damage: 400, cooldown: 60, effects: ["Armor Break"] },
        ]
      }
    ]
  },

  STAFF: {
    id: "STAFF",
    name: "Staff",
    icon: "wand",
    slots: [
      {
        type: "primary",
        unlockTier: 1,
        label: "PRIMARY",
        skills: [
          { id: "staff_arcane_bolt", name: "Arcane Bolt", description: "Basic magic projectile", icon: "star", tier: 1, damage: 40, cooldown: 0, effects: ["Magic Damage"] },
          { id: "staff_frost_bolt", name: "Frost Bolt", description: "Slow enemy on hit", icon: "snowflake", tier: 2, damage: 45, cooldown: 2, effects: ["Slow 20%"] },
          { id: "staff_fire_bolt", name: "Fire Bolt", description: "Burn DoT on hit", icon: "flame", tier: 3, damage: 50, cooldown: 3, effects: ["Burn 4s"] },
        ]
      },
      {
        type: "secondary",
        unlockTier: 2,
        label: "SECONDARY",
        skills: [
          { id: "staff_frost_nova", name: "Frost Nova", description: "AoE freeze around caster", icon: "snowflake", tier: 1, damage: 50, cooldown: 12, effects: ["Freeze 2s", "AoE 5m"] },
          { id: "staff_fireball", name: "Fireball", description: "Exploding fire projectile", icon: "flame", tier: 2, damage: 80, cooldown: 8, effects: ["AoE 3m", "Burn"] },
          { id: "staff_lightning_bolt", name: "Lightning Bolt", description: "Instant cast, chains", icon: "zap", tier: 3, damage: 60, cooldown: 6, effects: ["Chain 3"] },
        ]
      },
      {
        type: "ability",
        unlockTier: 2,
        label: "ABILITY",
        skills: [
          { id: "staff_mana_shield", name: "Mana Shield", description: "Absorb damage with mana", icon: "shield", tier: 1, damage: 0, cooldown: 20, effects: ["Shield 200"] },
          { id: "staff_blink", name: "Blink", description: "Teleport short distance", icon: "zap", tier: 3, damage: 0, cooldown: 15, effects: ["Teleport 10m"] },
          { id: "staff_polymorph", name: "Polymorph", description: "Turn enemy into critter", icon: "star", tier: 5, damage: 0, cooldown: 30, effects: ["Disable 3s"] },
        ]
      },
      {
        type: "ultimate",
        unlockTier: 3,
        label: "ULTIMATE",
        skills: [
          { id: "staff_meteor", name: "Meteor", description: "Call down meteor strike", icon: "flame", tier: 1, damage: 250, cooldown: 60, effects: ["Huge AoE", "Stun"] },
          { id: "staff_blizzard", name: "Blizzard", description: "Sustained AoE ice storm", icon: "snowflake", tier: 4, damage: 150, cooldown: 50, effects: ["Channel 5s", "Slow"] },
        ]
      }
    ]
  },

  DAGGER: {
    id: "DAGGER",
    name: "Dagger",
    icon: "slash",
    slots: [
      {
        type: "primary",
        unlockTier: 1,
        label: "PRIMARY",
        skills: [
          { id: "dagger_stab", name: "Quick Stab", description: "Fast attack, low damage", icon: "slash", tier: 1, damage: 30, cooldown: 0, effects: ["Fast Attack"] },
          { id: "dagger_backstab", name: "Backstab", description: "Bonus damage from behind", icon: "slash", tier: 2, damage: 60, cooldown: 3, effects: ["+100% from Behind"] },
          { id: "dagger_poison_blade", name: "Poison Blade", description: "Apply poison stack", icon: "droplet", tier: 3, damage: 25, cooldown: 5, effects: ["Poison 6s"] },
        ]
      },
      {
        type: "secondary",
        unlockTier: 2,
        label: "SECONDARY",
        skills: [
          { id: "dagger_shadow_step", name: "Shadow Step", description: "Teleport behind target", icon: "user", tier: 1, damage: 0, cooldown: 10, effects: ["Teleport", "Stealth 2s"] },
          { id: "dagger_fan_knives", name: "Fan of Knives", description: "Throw knives in cone", icon: "target", tier: 2, damage: 40, cooldown: 8, effects: ["Cone AoE"] },
          { id: "dagger_vanish", name: "Vanish", description: "Become invisible", icon: "eye-off", tier: 3, damage: 0, cooldown: 20, effects: ["Stealth 6s"] },
        ]
      },
      {
        type: "ability",
        unlockTier: 2,
        label: "ABILITY",
        skills: [
          { id: "dagger_eviscerate", name: "Eviscerate", description: "High damage finisher", icon: "skull", tier: 1, damage: 100, cooldown: 12, effects: ["+50% vs Poisoned"] },
          { id: "dagger_garrote", name: "Garrote", description: "Silence and DoT", icon: "x", tier: 3, damage: 40, cooldown: 15, effects: ["Silence 3s", "Bleed"] },
          { id: "dagger_smoke_bomb", name: "Smoke Bomb", description: "AoE blind and escape", icon: "cloud", tier: 4, damage: 0, cooldown: 25, effects: ["Blind 3s", "Stealth"] },
        ]
      },
      {
        type: "ultimate",
        unlockTier: 3,
        label: "ULTIMATE",
        skills: [
          { id: "dagger_death_mark", name: "Death Mark", description: "Mark target, bonus damage", icon: "skull", tier: 1, damage: 200, cooldown: 50, effects: ["+50% Damage 10s"] },
          { id: "dagger_assassinate", name: "Assassinate", description: "Execute low HP target", icon: "skull", tier: 4, damage: 500, cooldown: 60, effects: ["Kill <20% HP"] },
        ]
      }
    ]
  },
};

export function getWeaponSkillById(weaponType: string, skillId: string): WeaponSkillOption | undefined {
  const weapon = WEAPON_TYPE_DEFINITIONS[weaponType];
  if (!weapon) return undefined;
  
  for (const slot of weapon.slots) {
    const skill = slot.skills.find(s => s.id === skillId);
    if (skill) return skill;
  }
  return undefined;
}

export function getSkillsForSlot(weaponType: string, slotType: SlotType): WeaponSkillOption[] {
  const weapon = WEAPON_TYPE_DEFINITIONS[weaponType];
  if (!weapon) return [];
  
  const slot = weapon.slots.find(s => s.type === slotType);
  return slot?.skills || [];
}
