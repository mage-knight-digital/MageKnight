# Site Panel UI - Detailed Site Information View

## Overview

A detailed information panel that shows comprehensive site information, replacing the need to memorize rules. Works in two contexts:
1. **Scouting** - Click into tooltip while exploring to see full details
2. **Arrival** - Auto-opens when landing on an interactive site

## User Flow

### Scouting (before moving)
1. Hover hex → small tooltip (quick info)
2. Click tooltip or "More Info" → full site panel slides in on right (50% screen)
3. Camera shifts left to make room
4. Player can close and continue exploring

### Arriving at Site
1. Hero lands on interactive site
2. Screen auto-transitions:
   - Left 50%: Hero token + radial action menu
   - Right 50%: Full site panel
3. Experienced player: glance, click action, done
4. New player: read panel, understand options, then decide

## Site Panel Layout

```
┌──────────────────────────────────────────────┐
│ 🪦 TOMB                              [X]     │
├──────────────────────────────────────────────┤
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │                                      │    │
│  │         [ Site Artwork PNG ]         │    │
│  │         (transparent background)     │    │
│  │                                      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ══════════════════════════════════════════  │
│  COMBAT                                      │
│  ──────────────────────────────────────────  │
│  ┌─────────────┐                             │
│  │  [enemy    │  🔴 DRACONUM                 │
│  │   token    │  ⚔️ 8 Fire   🛡️ 7   ⭐ 8    │
│  │   image]   │                              │
│  │            │  ⚡ Swift - requires 2x Block │
│  └─────────────┘ 💀 Brutal - deals 2x damage │
│                                              │
│  ══════════════════════════════════════════  │
│  RESTRICTIONS                                │
│  ──────────────────────────────────────────  │
│  🌙 Night Rules                              │
│     No gold mana, black mana available       │
│                                              │
│  🚫 No Units                                 │
│     You must fight alone                     │
│                                              │
│  ══════════════════════════════════════════  │
│  REWARD (if victorious)                      │
│  ──────────────────────────────────────────  │
│  📜 1 Spell                                  │
│  🏺 1 Artifact                               │
│                                              │
└──────────────────────────────────────────────┘
```

## Panel Sections by Site Type

### Adventure Sites (Dungeon, Tomb, Monster Den, Spawning Grounds, Ruins)
- Site artwork
- COMBAT section with enemy card(s)
- RESTRICTIONS section (if any)
- REWARD section

### Interaction Sites (Village, Monastery)
- Site artwork
- SERVICES section (Recruit, Heal, Buy AA, etc.)
- AVAILABLE UNITS section (if applicable)
- Special actions (Plunder, Burn)

### Fortified Sites (Keep, Mage Tower, City)
- Site artwork
- GARRISON section with enemy card(s) - if unconquered
- SERVICES section - if conquered
- Fortification warning

### Passive Sites (Mine, Magical Glade, Deep Mine)
- Site artwork
- EFFECT section (end of turn / start of turn effects)

## Enemy Card Component

Reusable component showing:
- Enemy token image
- Name and color indicator
- Stats row: Attack (with element), Armor, Fame
- Abilities with short descriptions
- Resistances (if any)

```
┌─────────────────────────────────────┐
│  [token]  🔴 FIRE DRAGON            │
│           ⚔️ 9 Fire  🛡️ 7  ⭐ 8     │
│                                     │
│           ⚡ Swift - requires 2x Block
│           🔥 Fire Resistance        │
│           ❄️ Ice Resistance         │
└─────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Basic Panel Structure
- [ ] Create `SitePanel` component with dark theme
- [ ] Implement slide-in animation from right
- [ ] Add close button functionality
- [ ] Camera shift logic (shift view left when panel opens)

### Phase 2: Site Content
- [ ] Site header with icon and name
- [ ] Site artwork display (use Mage Tower as placeholder)
- [ ] Section components (Combat, Restrictions, Rewards, Services)
- [ ] Wire up site data from `SiteOptions`

### Phase 3: Enemy Cards
- [ ] Create `EnemyCard` component (larger than tooltip version)
- [ ] Enemy token image display
- [ ] Stats layout
- [ ] Ability display with descriptions

### Phase 4: Integration
- [ ] "More Info" trigger from tooltip hover
- [ ] Auto-open on site arrival
- [ ] Integrate with radial menu (50/50 split layout)
- [ ] Handle panel + radial menu interaction

### Phase 5: Polish
- [ ] Scroll behavior if content overflows
- [ ] Transitions and animations
- [ ] High-res ability icons (when available)
- [ ] Site artwork for all site types

## Assets Needed

- [ ] Site artwork PNGs (transparent) - have some, need to add to repo
- [ ] Mage Tower image (placeholder) - already in repo
- [ ] High-res ability icons - coming soon
- [ ] Enemy token images - already have

## Design Decisions

- **Scrollable**: Avoid if possible, but support if needed for many enemies
- **Ability reference**: Start without, add expandable reference later
- **Theme**: Dark theme consistent with current UI
- **Controller support**: Panel navigable with bumper/button, scroll with stick

## Related Files

- `packages/client/src/components/HexTooltip/` - Current tooltip system
- `packages/client/src/components/HexContextMenu/` - Current radial menu
- `packages/shared/src/types/validActions.ts` - SiteOptions type
- `packages/core/src/engine/validActions/sites.ts` - getSiteOptions()
