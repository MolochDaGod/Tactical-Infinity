# Tethical - Tactical Strategy Game

## Overview
Tethical is an infinitely playable browser-based tactical strategy game inspired by classics like Final Fantasy Tactics, Fire Emblem, and Into the Breach. It features turn-based combat on a grid-based battlefield with procedurally generated maps, diverse unit classes, and rich lore set in the fractured world of Aethermoor. The project aims to provide a full game loop with a main menu, battle system, unit roster, lore codex, and an island management system with 3D barracks for unit visualization.

## User Preferences
- Dark mode preferred for fantasy tactical games
- Emphasis on information clarity over decorative flourishes
- Clean grid-based UI for strategic decision-making
- 3 factions STRICTLY: Crusade (Human+Barbarian), Fabled (Dwarf+Elf), Legion (Orc+Undead)

## System Architecture

### UI/UX Decisions
- **Color Scheme**: Primary Golden amber (hsl 38), Accent Blue (hsl 200).
- **Fonts**: Cinzel for headers, Inter for UI text.
- **Border Radius**: Small/subtle.
- **Theming**: Full dark/light mode support.
- **Equipment Visualization**: Tiered equipment (0-8) with visual indicators (glows, badges, colors).

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, Tailwind CSS (custom design tokens), Shadcn/UI components, Framer Motion for animations.
- **Rendering**: PixiJS for 2D tactical battles, Three.js for 3D unit/island visualization.
- **3D Assets**: Toon_RTS character models and various building models (FBX format) are used.
- **Backend**: Express.js with TypeScript, in-memory storage, RESTful API.
- **Shared**: Zod schemas for type safety, GRUDGE UUID system for entity identification, comprehensive game definitions.

### Feature Specifications
- **4 Unit Classes** with tiered skill trees (abilities at L0, L1, L5, L10, L15, L20):
  - **Worge (Shapeshifter)**: Tank/Burst DPS - Bear Form, Raptor Form, pack abilities
  - **Warrior**: Tank/DPS/Paladin - Invulnerability, dual wield, shield specialist
  - **Mage Priest**: Healer/Magic DPS - Mana Shield, heals, offensive spells
  - **Ranger Scout**: Scout DPS/Utility - Precision, stealth, ranged devastation
- **3 Factions / 6 Races**: Crusade (Human/Barbarian), Fabled (Dwarf/Elf), Legion (Orc/Undead).
- **Turn-Based Combat**: Speed-based turn order, movement, attack actions, combat preview.
- **Hero Stats System (8 Attributes)**:
  - **Strength**: Tank/Melee DPS - Health (+26 flat, +0.8%), Damage (+3 flat, +2%), Defense (+12 flat, +1.5%), Block/Crit bonuses
  - **Vitality**: Tank/Survivability - Health (+25 flat, +0.5%), Defense (+12 flat), Block Factor, Resistance
  - **Endurance**: Defensive Specialist - Defense (+12 flat, +12%), Block Chance (+0.11% flat, +73.5%), Resistance
  - **Intellect**: Mage/Caster - Mana (+5 flat, +5%), Damage (+4 flat, +2.5%), Accuracy, Resistance
  - **Wisdom**: Healer/Support - Health (+10 flat), Mana (+20 flat, +3%), Damage (+2 flat, +1.5%), Crit Chance
  - **Dexterity**: Rogue/Precision - Damage (+3 flat, +1.8%), Crit Chance (+0.5% flat, +1.2%), Accuracy (+0.7% flat, +1.5%)
  - **Agility**: Mobile DPS/Dodge - Stamina (+5 flat, +0.5%), Damage (+3 flat, +1.6%), Crit Chance, Speed/Movement
  - **Tactics**: Strategic Commander - Health (+10 flat, +8.4%), Mana (+0 flat, +8.2%), Block Chance (+0.27% flat, +0.8%)
  - **Combat Factors**: Block Chance (75% cap), Block Factor (90% cap), Crit Chance (75% cap), Crit Factor (3x cap), Accuracy (95% cap), Resistance (95% cap), Drain/Reflect/Absorb (50% caps)
  - **Diminishing Returns**: Full efficiency 1-25 points, 50% efficiency 26-50 points, 25% efficiency 51+ points
  - **Damage Formula**: `Damage Taken = Incoming × (100 - √Defense) / 100` with Block/Crit modifiers
- **Tiered Equipment System (T1-T8)**:
  - Weapons: Swords, Axes, Daggers, Hammers, Greatswords, Bows, Crossbows, Guns, Staves, Tomes
  - Armor: Cloth, Leather, Metal, Gem materials with set bonuses
  - Stats scale with tier: damage, speed, combo, crit, block, defense (weapons); HP, mana, crit, block, defense (armor)
- **Crafting Professions**: Blacksmith (melee), Bowyer (ranged), Enchanter (magic), Alchemist, Leatherworker, Tailor
- **Procedural Generation**: Maps and enemy teams.
- **Island System**: 3x3 island grid with building placement (Barracks, Archery Range, Market, Port, Storage, House, Wall Tower) and resource management.
- **Lore Codex**: Detailed world-building.
- **GRUDGE UUID System**: Unique identifiers for all game entities with prefixes and event types for history tracking.
- **Account System**: Role-based access control with varying character and island limits.
- **Game Modes**:
    1.  **World Map Sailing (3D)**: Three.js WebGL renderer with 3D ship models, expanded 9000x9000 world map (3x larger), multi-layered ocean with animated waves, skybox with sun, dual camera system (F1/F2 keys). Features include:
        - **Valheim-Style Sailing**: W deploys sails to catch wind, S retracts sails to stop. Movement is fully wind-driven:
          - No-sail zone (0-45° into wind): Cannot make progress, must tack
          - Close haul (45-90°): Decent speed, tight sail trim
          - Broad reach (90-135°): BEST speed (1.5-1.8x multiplier), optimal sailing angle
          - Running downwind (135-180°): Good speed, wide sail trim
        - **Sail Trim System**: Q/E keys to adjust sail angle (±120° range). Optimal sail angle varies by point of sail for maximum efficiency.
        - **Wind Indicator HUD**: Bottom-left compass showing wind direction (blue) and sail angle (amber) with speed percentage, weather, and time of day.
        - **Dynamic Weather System**: Four weather states (clear, cloudy, stormy, foggy) affecting wind speed and visibility. Weather changes every 2-7 minutes with weighted probability.
        - **Day/Night Cycle**: Dynamic sky colors, sun position, and lighting adjustments throughout the day cycle.
        - **Multi-layered Ocean**: Deep water layer with animated surface waves using vertex displacement.
        - **Sea Life Ecosystem**: 40 fish swimming in schools and 15 jellyfish floating beneath the surface.
        - **Island Distribution**: 20 islands spread across the world at 600-3600 unit distances (2x more spread out).
        - **Cannon Aiming**: Right-click hold to aim with blue trajectory arc and target circle visualization.
        - **Abilities Hotbar**: 5 ability slots at bottom-center (1=Repair heals 20HP, 2-5 reserved).
        - Physics-based cannonball projectiles (Spacebar to fire), procedural islands with biome-based colors (tropical, volcanic, arctic, desert, haunted), NPC pirate ships with AI pursuit/patrol behaviors. Performance optimized with mutable refs for game state and batched HUD updates (100ms interval).
    2.  **Tactical Battles (2D Side-View)**: PixiJS grid-based combat, unit abilities, particle effects.
    3.  **Island Harvesting (3D)**: Three.js for resource gathering, crafting, building placement, and unit training; Yuka.js for AI (steering behaviors, pathfinding, FSM for animations).

### System Design Choices
- **Renderer Architecture**: Dedicated PixiRenderer for 2D, Three.js for 3D scene management with FBX model loading and animation mixing.
- **Asset System**: Centralized asset manifest for sprites, character, weapon, and terrain assets.
- **Game Definitions System**: Central repository for all game data including weapons, combat, attributes, races, classes, professions, dungeons, islands, items, and sailing.
- **RTS Controls System**: SelectionManager for click/shift-click/drag-box selection, TransformGizmo for building placement with translate/rotate handles, RTSContextMenu for right-click actions. Located in `client/src/lib/rtsControls/` with React hook `useRTSControls` for integration.

## External Dependencies
- **React**: Frontend UI library.
- **TypeScript**: Superset of JavaScript for type safety.
- **Wouter**: React router.
- **TanStack Query**: Data fetching (prepared for future use).
- **Tailwind CSS**: Utility-first CSS framework.
- **Shadcn/UI**: UI component library.
- **Framer Motion**: Animation library.
- **PixiJS**: 2D WebGL renderer.
- **Three.js**: 3D WebGL renderer.
- **@pixi/particle-emitter**: Particle system for PixiJS.
- **Express.js**: Backend web application framework.
- **Zod**: Schema declaration and validation library.
- **Yuka.js**: JavaScript library for AI in games.