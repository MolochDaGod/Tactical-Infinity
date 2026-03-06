# Tethical - Tactical Strategy Game Design Guidelines

## Design Approach
**Reference-Based Hybrid**: Drawing from modern tactical games (Fire Emblem, XCOM, Into the Breach) with clean information architecture meeting fantasy aesthetics. Prioritize gameplay clarity while maintaining immersive atmosphere.

## Typography System
- **Primary Font**: Cinzel or similar serif (Google Fonts) - headers, titles, lore text
- **UI Font**: Inter or Roboto - stats, numbers, tooltips, gameplay text
- **Hierarchy**: 
  - Hero titles: text-4xl/5xl font-bold
  - Section headers: text-2xl/3xl font-semibold
  - Body/stats: text-base/lg
  - Labels/meta: text-sm/xs

## Layout & Spacing
**Spacing Units**: Tailwind 2, 4, 6, 8, 12 for consistent rhythm
- Game board: Full viewport with fixed UI panels
- Panels: p-4 to p-6 internal padding
- Card spacing: gap-4 in grids, space-y-2 for stacked info
- Strategic use of negative space to prevent information overload

## Core Component Library

### Navigation & Menus
- **Main Menu**: Full-screen centered with stacked options, semi-transparent overlay on background artwork
- **In-Game HUD**: Fixed panels (top bar for resources, side panels for unit info, bottom for actions)
- **Tab Navigation**: Segmented controls for switching between Units/Skills/Equipment/Lore

### Game Board Interface
- **Grid Display**: Isometric or square grid with clear tile boundaries
- **Unit Cards**: Floating stat panels on unit selection (HP, Movement, Attack range)
- **Action Indicators**: Highlight tiles for movement range (border glow), attack range (filled overlay)
- **Turn Order**: Vertical timeline showing initiative queue

### Information Panels
- **Unit Details Card**: Portrait + name header, stat grid (HP/ATK/DEF/SPD), ability list with icons
- **Equipment/Inventory**: Grid layout with item cards (icon + name + stats)
- **Lore Codex**: Scrollable text panels with decorative borders, category tabs

### Interactive Elements
- **Primary Actions**: Solid buttons for Move/Attack/Skill/End Turn with clear visual states
- **Secondary Actions**: Ghost/outline buttons for Cancel/Inspect
- **Unit Selection**: Card-based with hover elevation and border highlight
- **Skill Buttons**: Icon + name horizontal layout, cooldown/resource cost badges

### Data Visualization
- **Health Bars**: Segmented bars showing current/max HP
- **Resource Meters**: Mana/energy with fill animation
- **Stat Comparisons**: Side-by-side number displays with color-coded advantage indicators
- **Combat Preview**: Damage calculation display before confirming actions

### Feedback & Notifications
- **Toast Messages**: Top-center for turn changes, level ups
- **Combat Log**: Scrolling text feed in dedicated panel
- **Damage Numbers**: Floating animated text over units during combat
- **Victory/Defeat Screen**: Modal overlay with stats summary

## Game-Specific Design Patterns
- **Unit Roster**: Grid of character portraits with faction/class badges
- **Battlefield Overview**: Minimap in corner showing full tactical view
- **Ability Selection**: Radial menu or horizontal action bar on unit selection
- **Terrain Info**: Tooltip on tile hover showing effects (defense bonus, movement cost)

## Images
- **Menu Background**: Epic fantasy battle scene or atmospheric landscape (full viewport)
- **Unit Portraits**: Character artwork in panels and cards
- **Ability Icons**: Visual representations of skills/spells
- **Terrain Tiles**: Textured sprites for different ground types
- **Faction Emblems**: Decorative elements in UI panels

No large hero image needed - game interface prioritizes functional layout with artwork integrated into panels and backgrounds.

## Animations
- Minimal, purposeful only:
  - Unit movement slide along grid
  - Attack flash/shake
  - HP bar drain on damage
  - Subtle glow on selected units/tiles

**Design Priority**: Information clarity and rapid decision-making over decorative flourishes. Every UI element serves gameplay function.