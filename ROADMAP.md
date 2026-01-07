# Mage Knight Digital - Project Roadmap

## Overview

This roadmap tracks the path from current state to a fully playable, polished Mage Knight digital implementation with AI opponents and multiplayer support.

**Last Updated:** January 2025
**Test Count:** 605 tests passing

---

## Phase 1: First Reconnaissance Playable (MVP)
**Goal:** Complete, playable First Reconnaissance solo scenario

### 1.1 Core Mechanics

| Feature | Status | Notes |
|---------|--------|-------|
| Tactic selection | Done | Turn order works; individual tactic effects NOT implemented |
| Movement with terrain costs | Done | Day/night terrain costs differ |
| Exploration with tile placement | Done | Tile rotation hardcoded to 0 (visual issue) |
| Combat system (block, damage, attack) | Done | 4 phases, elemental tracking, all working |
| Rampaging enemies | Done | Spawning, movement blocking, provoking |
| Site conquest | Done | Conquest, shield tokens, owner tracking |
| Day/Night transitions | Done | Mana rules, terrain costs, round cycling |
| Card effects (basic) | Done | Conditional and scaling effects working |
| Fame tracking | Done | Level progression, stat gains |
| Round structure | Done | Tactics → turns → round end |
| Unit offer population | Done | Regular and elite units |

### 1.2 Known Bugs / Missing Features

| Task | Ticket | Status |
|------|--------|--------|
| Announce end of round should forfeit turn immediately | `end-of-round-announcement.md` | Not Started |
| Challenge rampaging enemy from adjacent hex | `challenge-rampaging-enemies.md` | Not Started |
| Combat button says "Skip" when enemies defeated | `combat-button-text.md` | Not Started |
| Solo end of round should auto-progress | Related to above | Not Started |
| Mana source selection UI for powered cards | `mana-selection-for-powered-cards.md` | Partially Complete (auto-select works) |
| Turn phase enforcement (movement → action) | `turn-structure-and-phases.md` | Not Started |
| Scenario end scoring screen | `scenario-end-game-flow.md` | Not Started |
| Enemy visibility tracking (affects undo) | `enemy-visibility-and-undo.md` | Not Started |

### 1.3 Site Interactions

| Site | Status | Notes |
|------|--------|-------|
| Village (heal) | Done | 3 influence = 1 healing |
| Village (recruit) | Done | At inhabited sites |
| Village (plunder) | Not Started | Reputation penalty mechanic |
| Monastery (heal) | Done | 2 influence = 1 healing |
| Monastery (recruit) | Done | At inhabited sites |
| Monastery (buy AA) | Not Started | Advanced action offer |
| Monastery (burn) | Not Started | Reputation mechanic |
| Keep (assault, own) | Done | Conquest and ownership |
| Keep (+1 hand limit) | Done | Adjacent to owned keep |
| Mage Tower (assault) | Done | Conquest mechanics |
| Mage Tower (buy spells) | Not Started | Spell offer |
| Dungeon/Tomb | Done | Entry, enemies, night mana rules |
| Monster Den | Partial | Entry works, re-entry for fame |
| Ancient Ruins | Partial | Day auto-conquest works |
| Crystal Mines | Not Started | End turn bonus mana |
| Magical Glade | Not Started | Heal, mana effects |
| Spawning Grounds | Not Started | Multi-enemy site |

---

## Phase 2: Complete Base Game Content
**Goal:** All base game content implemented

### 2.1 Cards & Effects

| Task | Status | Notes |
|------|--------|-------|
| Basic action effects | Partial | 14 cards defined, some placeholder effects |
| Advanced action effects | Not Started | ~40 cards |
| Advanced action acquisition | Not Started | Monastery, level up |
| Spell effects | Not Started | ~36 cards |
| Spell acquisition | Not Started | Mage tower, level up |
| Artifact effects | Not Started | ~24 cards |
| Artifact acquisition | Not Started | Combat rewards |
| Wound card mechanics | Done | Knockout, hand wounds |

**Card Definition Progress:**
- Basic Actions: 14/16 defined (Mana Draw, Crystallize have placeholder effects)
- Advanced Actions: 0 defined
- Spells: 0 defined
- Artifacts: 0 defined

### 2.2 Units

| Task | Status | Notes |
|------|--------|-------|
| Unit definitions (all) | Done | 10 regular + 6 elite |
| Unit recruitment | Done | At inhabited sites |
| Unit command slots | Done | Limited by level |
| Unit combat abilities | Done | Attack/Block/Ranged/Siege |
| Passive abilities | Done | Swift, Brutal, Poison, Paralyze |
| Unit wounding | Done | Armor reduces damage |
| Resistant units | Done | Double armor |
| Unit healing | Not Started | Heal unit vs hero targeting |
| Unit disbanding | Not Started | Manual release |
| Ready at round end | Done | All units including wounded |

**Special Unit Abilities (Not Implemented):**
- Magic Familiars - custom mana ability
- Sorcerers - custom spell ability
- Delphana Masters - custom ability

### 2.3 Enemy Abilities

| Ability | Status | Notes |
|---------|--------|-------|
| Fortified | Done | Siege required in ranged phase |
| Brutal | Done | Doubles damage dealt |
| Swift | Done | Doubles block requirement |
| Poison (hero) | Done | Wounds to hand AND discard |
| Poison (unit) | Done | 2 wounds = destroyed |
| Paralyze (hero) | Done | Discard all non-wound cards |
| Paralyze (unit) | Done | Unit immediately destroyed |
| Summon | Not Started | Spawn additional enemies |
| Cumbersome | Not Started | Attack timing restriction |
| Arcane Immunity | Not Started | Resistance to spells |

### 2.4 Tactic Card Effects

All 12 tactic cards have turn order mechanics working, but individual effects are NOT implemented:

**Day Tactics:**
| Tactic | Effect | Status |
|--------|--------|--------|
| Early Bird (#1) | Turn order only | Implemented |
| Rethink (#2) | Discard/reshuffle | Not Started |
| Mana Steal (#3) | Borrow die | Not Started |
| Planning (#4) | Hand limit +1 | Not Started |
| Great Start (#5) | Draw 2 | Not Started |
| The Right Moment (#6) | Extra turn | Not Started |

**Night Tactics:**
| Tactic | Effect | Status |
|--------|--------|--------|
| From The Dusk (#1) | Turn order only | Implemented |
| Long Night (#2) | Reshuffle discard | Not Started |
| Mana Search (#3) | Re-roll dice | Not Started |
| Midnight Meditation (#4) | Shuffle cards | Not Started |
| Preparation (#5) | Search deck | Not Started |
| Sparing Power (#6) | Store cards under tactic | Not Started |

### 2.5 Heroes

| Hero | Status | Notes |
|------|--------|-------|
| Arythea | Partial | Starting deck only |
| Tovak | Partial | Starting deck only |
| Goldyx | Partial | Starting deck only |
| Norowas | Partial | Starting deck only |
| Wolfhawk | Partial | Starting deck only |
| Krang | Partial | Starting deck only (Lost Legion) |
| Braevalar | Partial | Starting deck only (Lost Legion) |

**Missing for all heroes:**
- Hero-specific abilities
- Skill system integration
- Hero-specific advanced actions

### 2.6 Skill System

| Task | Status | Notes |
|------|--------|-------|
| Skill definitions | Not Started | ~36 skills |
| Skill deck setup | Not Started | Hero-specific + common |
| Skill selection on level up | Not Started | Even levels |
| Skill effect resolution | Not Started | Passive and activated |

### 2.7 Map & Tiles

| Task | Status | Notes |
|------|--------|-------|
| All countryside tiles | Done | 11 base + 3 Lost Legion |
| All core tiles | Done | 4 base + 2 Lost Legion |
| City tiles | Done | 1 defined |
| Wedge map shape | Done | First Reconnaissance |
| Tile rotation | Not Started | Hardcoded to 0 |
| Open map shape | Not Started | Full Conquest |
| Column-limited shapes | Not Started | Other scenarios |
| Symbol matching | Not Started | River/city connection rules |

### 2.8 Scenarios

| Scenario | Status | Notes |
|----------|--------|-------|
| First Reconnaissance (Solo) | Done | 4 rounds, city entry blocked |
| First Reconnaissance (2-4p) | Not Started | Different tile counts |
| Full Conquest | Not Started | Stub only |
| Blitz Conquest | Not Started | |
| Solo Conquest | Not Started | Dummy player |
| Full Cooperation | Not Started | Cooperative |
| Mine Liberation | Not Started | |
| Dungeon Lords | Not Started | |
| Druid Nights | Not Started | |

---

## Phase 3: Polish & UX
**Goal:** Smooth, enjoyable player experience

### 3.1 UI Components

**Implemented:**
- Game board with hex grid
- Player hand display
- Resource panel (hero stats)
- Crystals panel
- Mana source panel (dice)
- Unit offer panel
- Tactic selection overlay
- Combat overlay (phases, enemies, actions)
- Event log

**Missing:**
- Skill/card selection UI (even level rewards)
- Damage assignment UI (hero vs units choice)
- Card play during combat UI improvements
- Combat accumulator display
- Scenario selection/setup UI
- Game end/scoring screen
- Undo confirmation UI

### 3.2 Art & Assets

| Task | Status |
|------|--------|
| Real card art | Not Started |
| Real tile art | Not Started |
| Real enemy token art | Not Started |
| Real unit card art | Not Started |
| Sound effects | Not Started |
| Background music | Not Started |
| Animations | Not Started |

### 3.3 Quality of Life

| Task | Status |
|------|--------|
| Auto-block when obvious | Not Started |
| Auto-assign damage when no choice | Not Started |
| Suggested moves highlight | Not Started |
| Card effect previews | Not Started |
| Combat damage calculator | Not Started |
| Save/load game | Not Started |
| Tutorial/help system | Not Started |

---

## Phase 4: Multiplayer
**Goal:** Play with friends online

### 4.1 Networking

| Task | Status | Notes |
|------|--------|-------|
| WebSocket server | Not Started | |
| Client-server protocol | Not Started | |
| State synchronization | Not Started | |
| Reconnection handling | Not Started | |
| Per-player state filtering | Done | `toClientState()` |

### 4.2 Lobby System

| Task | Status |
|------|--------|
| Create game lobby | Not Started |
| Join game lobby | Not Started |
| Lobby chat | Not Started |
| Scenario/settings selection | Not Started |
| Invite links | Not Started |

### 4.3 Game Modes

| Task | Status |
|------|--------|
| Competitive (race to city) | Not Started |
| Cooperative | Not Started |
| PvP combat | Not Started |
| Turn timer | Not Started |

---

## Phase 5: AI & RL
**Goal:** Train and deploy AI opponents

### 5.1 Infrastructure

| Task | Status | Notes |
|------|--------|-------|
| Valid actions enumeration | Done | Server computes all valid actions |
| State representation for RL | Not Started | |
| Reward shaping | Not Started | |
| Training environment | Not Started | |

### 5.2 AI Development

| Task | Status |
|------|--------|
| Random agent (baseline) | Not Started |
| Heuristic agent | Not Started |
| RL agent training | Not Started |
| Difficulty levels | Not Started |
| Dummy player (solo variant) | Not Started |

---

## Phase 6: Expansions
**Goal:** Lost Legion and beyond

### 6.1 Lost Legion

| Task | Status |
|------|--------|
| Volkare (moving enemy army) | Not Started |
| New heroes (Braevalar, Krang) | Partial (decks only) |
| New units | Not Started |
| New enemies | Not Started |
| New tiles | Done (in tile deck) |
| New scenarios | Not Started |
| Maze/Labyrinth sites | Not Started |

---

## Current Sprint Focus

**Active Work:**
1. Bug fixes from tickets

**Next Up:**
1. Announce end of round forfeit fix
2. Challenge rampaging from adjacent
3. Tactic card effects
4. Scoring screen

**Recently Completed:**
- Combat system end-to-end
- Block/damage/attack assignment
- Draw card effect
- Unit offer population
- Conditional effects system
- Scaling effects system
- Mana validation for powered cards
- First Reconnaissance scenario

---

## Technical Debt

| Issue | Ticket | Priority |
|-------|--------|----------|
| Tile rotation hardcoded to 0 | - | Low |
| Enemy visibility not tracked | `enemy-visibility-and-undo.md` | Medium |
| Damage overflow auto-routes to hero | - | Medium |
| Combat accumulator not displayed | - | Low |
| Event log hidden during combat | - | Low |
| Some cards have placeholder effects | - | Medium |
| Turn phase not strictly enforced | `turn-structure-and-phases.md` | Medium |

---

## Architecture Notes

- **Server is source of truth** for valid actions (RL-friendly)
- **Seeded RNG** for reproducible games (testing, replay)
- **Event sourcing** for UI communication and debugging
- **Command pattern** for undo support
- **Modifier system** for dynamic effects (terrain, combat, skills)
- **TypeScript throughout** with strict types

---

*See `docs/status.md` for detailed implementation notes and `docs/tickets/` for specific issues.*
