# Mage Knight Digital Implementation - Project Status

## Overview

This document captures the complete state of the Mage Knight board game engine implementation. Use this to resume development if context is lost.

**Last Updated:** January 2025
**Test Count:** 605 tests passing (564 core + 12 shared + 29 server)

---

## Architecture

### Package Structure

```
packages/
├── shared/          # Constants, types, actions, events (no game logic)
├── core/            # Game engine, commands, validators, state
└── server/          # WebSocket server, client state transformation
```

### Key Patterns

1. **Constants with typeof** — All string literals use `as const` pattern:
   ```typescript
   export const COMBAT_PHASE_RANGED = "ranged" as const;
   export type CombatPhase = typeof COMBAT_PHASE_RANGED | ...;
   ```

2. **Command Pattern** — All state mutations go through commands:
   ```typescript
   interface Command {
     type: string;
     playerId: string;
     isReversible: boolean;
     execute(state: GameState): CommandResult;
     undo(state: GameState): CommandResult;
   }
   ```

3. **Validator Chain** — Actions validated before command execution:
   ```typescript
   [MOVE_ACTION]: [
     validateIsPlayersTurn,
     validateRoundPhase,
     validateMovementPoints,
     // ...
   ]
   ```

4. **Event Sourcing** — Commands emit events for UI/logging:
   ```typescript
   interface CommandResult {
     state: GameState;
     events: readonly GameEvent[];
   }
   ```

---

## Completed Features

### Core Game Loop ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Game initialization | `core/src/engine/setup/` | Tiles, players, hands, decks |
| Turn management | `core/src/engine/commands/endTurnCommand.ts` | Turn end, draw cards |
| Round cycle | `core/src/engine/commands/endRoundCommand.ts` | Day/night, reshuffle, ready units |
| Round end announcement | `core/src/engine/commands/announceEndOfRoundCommand.ts` | Empty deck triggers |

### Movement ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Terrain costs | `core/src/engine/movement/` | Day/night costs differ |
| Movement points | `core/src/types/player.ts` | Track and spend |
| Movement validation | `core/src/engine/validators/movementValidators.ts` | Terrain, points, rampaging |
| Rampaging blocks movement | `movementValidators.ts` | Can't enter hex with rampaging enemies |

### Card System ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Card play (basic) | `core/src/engine/commands/playCardCommand.ts` | Apply basic effect |
| Card play (powered) | Same | Spend mana for powered effect |
| Card play (sideways) | Same | +1 to move/influence/attack/block |
| Card effects | `core/src/engine/effects/resolveEffect.ts` | Process effect types |
| Hand/deck/discard | `core/src/types/player.ts` | Card zone management |

### Mana System ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Mana source (dice) | `core/src/engine/mana/manaSource.ts` | Roll, take, deplete |
| Crystals | `core/src/types/player.ts` | Permanent mana storage |
| Tokens | Same | Single-use mana |
| Day/night mana | `shared/src/mana.ts` | Gold depleted at night, black at day |
| Mana powering | `playCardCommand.ts` | Spend mana for powered effects |

### Combat System ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Combat phases | `core/src/types/combat.ts` | Ranged → Block → Damage → Attack |
| Enter combat | `core/src/engine/commands/combat/enterCombatCommand.ts` | Create combat state |
| Combat accumulator | `core/src/types/combat.ts` | Track attack/block by element |
| Elemental tracking | Same | physical/fire/ice/coldFire per attack type |
| Fortification | `combat.ts`, validators | Siege required at fortified sites |
| Enemy resistances | `shared/src/enemies.ts` | Fire/ice/physical resistance |
| Damage assignment | `combat/assignDamageCommand.ts` | To hero or units (knockout tracks hand wounds only) |
| End combat phases | `combat/endCombatPhaseCommand.ts` | Phase transitions |
| Combat victory | Same | Triggers conquest |
| Auto-combat entry | `moveCommand.ts` | Moving to fortified site |
| -1 rep on assault | Same | Applied on entry |
| One combat per turn | `combatValidators.ts` | `hasCombattedThisTurn` flag |
| Combat restrictions | `core/src/types/combat.ts` | `unitsAllowed`, `nightManaRules` flags on CombatState |
| Forced withdrawal | `endCombatPhaseCommand.ts` | Failed fortified assault returns player to origin |

### Enemy Abilities ✅

| Ability | Status | Notes |
|---------|--------|-------|
| Fortified | ✅ Working | Siege required in ranged phase |
| Brutal | ✅ Working | Doubles damage dealt |
| Poison (hero) | ✅ Working | Wounds to hand AND discard |
| Poison (unit) | ✅ Working | 2 wounds = destroyed |
| Swift | ✅ Working | Doubles block requirement (does NOT affect attack timing) |
| Paralyze (hero) | ✅ Working | Discard all non-wound cards from hand when wounded |
| Paralyze (unit) | ✅ Working | Unit immediately destroyed when wounded |
| Summon | ❌ Not implemented | Spawn additional enemies |

### Units ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Unit definitions | `shared/src/units.ts` | All regular + elite units |
| Unit deck initialization | `core/src/data/unitDeckSetup.ts` | Regular/Elite deck setup |
| Unit offer population | `endRoundCommand.ts` | Elite/Regular alternating after core tile |
| Recruit units | `core/src/engine/commands/units/recruitUnitCommand.ts` | Spend influence, remove from offer |
| Recruitment validation | `core/src/engine/validActions/units.ts` | Site type, ownership, affordability |
| Reputation cost modifier | Same | -7 to +7 cost adjustment |
| Site-specific filtering | Same | Only units matching site type shown |
| Undo recruitment | `recruitUnitCommand.ts` | Restores offer, influence |
| Command slots | `core/src/types/player.ts` | Limit from level |
| Unit states | `core/src/types/unit.ts` | ready/spent/wounded |
| Damage absorption | `combat/assignDamageCommand.ts` | Armor reduces damage |
| Resistant units | Same | Double armor if resistant |
| Unit activation | `units/activateUnitCommand.ts` | Use ability, become spent |
| Combat abilities | Same | Attack/Block/Ranged/Siege |
| Ability phase validation | `unitValidators.ts` | Right ability for right phase |
| Passive abilities | Same | Swift/brutal/poison/paralyze flagged |
| Ready at round end | `endRoundCommand.ts` | All units including wounded |

### Sites ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Site types | `core/src/types/map.ts` | Village, monastery, keep, etc. |
| Site properties | `core/src/data/siteProperties.ts` | Fortified, inhabited flags |
| Conquest | `core/src/engine/commands/conquerSiteCommand.ts` | Mark conquered, set owner |
| Shield tokens | Same | Track on hex and city state |
| City leader | `core/src/types/city.ts` | Most shields, tie by first |
| Keep hand limit bonus | `core/src/engine/helpers/handLimitHelpers.ts` | +X when adjacent to owned keep |
| Village healing | `core/src/engine/commands/interactCommand.ts` | 3 influence = 1 healing |
| Monastery healing | Same | 2 influence = 1 healing |
| Recruitment location | `unitValidators.ts` | Must be at inhabited site |
| Keep ownership | `interactValidators.ts` | Only owner can interact |
| Adventure site explore | `core/src/engine/commands/enterSiteCommand.ts` | Dungeon/tomb draw enemies, ruins auto-conquest at day |
| Dungeon/tomb restrictions | `manaValidators.ts`, `unitValidators.ts` | No units, night mana rules (no gold, yes black) |
| Dungeon/tomb re-entry | `siteValidators.ts` | Can re-enter conquered dungeon/tomb for fame grinding |

### Enemies on Map ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Enemy token decks | `core/src/engine/helpers/enemyHelpers.ts` | By color (brown/green/gray/violet/red) |
| Draw enemies | Same | From appropriate deck |
| Place on tile reveal | `core/src/engine/commands/exploreCommand.ts` | Rampaging + site defenders |
| Site defender mapping | `enemyHelpers.ts` | Keep→gray, MageTower→violet, etc. |
| Dungeon/Tomb timing | Same | Enemies drawn on explore, not reveal |
| Ruins night-only | Same | Only at night |

### Level Up ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Fame thresholds | `shared/src/levels.ts` | 0,3,8,14,21,29,38,48,59,71 |
| Level from fame | Same | `getLevelFromFame()` |
| Stat progression | Same | Armor, hand limit, command slots |
| Odd levels | `endTurnCommand.ts` | +command slot, +stats |
| Even levels | Same | Pending skill/card selection |
| Pending level ups | `core/src/types/player.ts` | Queue for end of turn |

### Explore ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Tile placement | `core/src/engine/commands/exploreCommand.ts` | Add hexes to map |
| Tile deck | `core/src/types/map.ts` | Countryside, core, city tiles |
| Enemy placement | `exploreCommand.ts` | On reveal |
| Rotation | ❌ Hardcoded to 0 | Visual issue, gameplay works |

### REST Action ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Standard rest | `core/src/engine/commands/restCommand.ts` | Discard non-wounds, announce |
| Slow recovery | Same | Heal 1 wound if all non-wounds discarded |

### Undo System ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Command stack | `core/src/engine/MageKnightEngine.ts` | Track reversible commands |
| Checkpoints | Same | Non-reversible commands create checkpoints |
| Undo action | Same | Pop and reverse |

### Tactics System ✅ (PR #7)

| Feature | Location | Notes |
|---------|----------|-------|
| Tactic card definitions | `shared/src/tactics.ts`, `core/src/data/tactics.ts` | 12 cards (6 day, 6 night) |
| Tactics selection phase | `core/src/state/GameState.ts` | `roundPhase: tactics_selection` |
| Selection order | `endRoundCommand.ts` | Lowest fame picks first, ties by turn order |
| Turn order from tactics | `selectTacticCommand.ts` | Lower tactic number = earlier turn |
| Day/Night tactic sets | `getTacticsForTimeOfDay()` | Correct set for time of day |
| Tactic validation | `selectTacticCommand.ts` | Can't select taken tactic, wrong time of day |
| Events | `shared/src/events.ts` | `TACTIC_SELECTED`, `TACTICS_PHASE_ENDED` |

**Tactic Effects Status:**
- Turn order mechanics: ✅ Working
- Individual tactic effects: ❌ Not yet implemented (marked `implemented: false`)

**Day Tactics (1-6):** Early Bird, Rethink, Mana Steal, Planning, Great Start, The Right Moment

**Night Tactics (1-6):** From The Dusk, Long Night, Mana Search, Midnight Meditation, Preparation, Sparing Power

**Not Yet Implemented:**
- Tactic removal rules (scenario-specific):
  - Standard multiplayer: tactics reused each round (current behavior)
  - Solo Conquest: remove ALL used tactics after each Day/Night
  - Full Cooperation: players remove ONE used tactic after each Day/Night

### Combat UI ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Combat overlay | `client/src/components/Combat/CombatOverlay.tsx` | Full-screen modal during combat |
| Phase indicator | `client/src/components/Combat/PhaseIndicator.tsx` | Shows current phase with step indicator |
| Enemy cards | `client/src/components/Combat/EnemyCard.tsx` | Stats, abilities, resistances display |
| Enemy list | `client/src/components/Combat/EnemyList.tsx` | All enemies with targetable highlighting |
| Combat summary | `client/src/components/Combat/CombatSummary.tsx` | Phase-specific stats (attack needed, block needed, damage to assign) |
| Combat actions | `client/src/components/Combat/CombatActions.tsx` | End phase button with validation |
| Combat options | `core/src/engine/validActions/combat.ts` | Server-computed `getCombatOptions()` |
| Client combat state | `shared/src/types/clientState.ts` | `ClientCombatState`, `ClientCombatEnemy` types |

**Wired into App.tsx:**
- Shows `CombatOverlay` when `state.combat` is non-null
- Passes `combat` state and `validActions.combat` options

**CSS Styles:**
- Combat overlay (full-screen, dark background)
- Phase indicator steps
- Enemy cards (stats, abilities, resistances, status indicators)
- Combat summary (phase-specific calculations)
- Combat actions (buttons, warnings)

**Not Yet Implemented:**
- Card play during combat (attack/block cards)
- Damage assignment UI (assign to hero vs units)
- Enemy targeting (click to target specific enemies)
- Accumulated attack/block display during card play

### Scenario System ✅

| Feature | Location | Notes |
|---------|----------|-------|
| ScenarioConfig type | `shared/src/scenarios.ts` | Full scenario configuration |
| First Reconnaissance (Solo) | `core/src/data/scenarios/firstReconnaissance.ts` | Solo intro scenario (4 rounds: 2 day, 2 night) |
| Scenario in GameState | `core/src/state/GameState.ts` | scenarioId, scenarioConfig, finalTurnsRemaining |
| Scenario end trigger | `core/src/engine/commands/exploreCommand.ts` | SCENARIO_END_TRIGGERED event |
| City revealed trigger | Same | END_TRIGGER_CITY_REVEALED detection |
| Fame on explore | Same | +1 fame per tile (configurable per scenario) |
| City entry block | `core/src/engine/validators/movementValidators.ts` | citiesCanBeEntered flag |
| Final turns countdown | `core/src/engine/commands/endTurnCommand.ts` | Game ends when finalTurnsRemaining = 0 |
| Round end during final turns | `core/src/engine/commands/endRoundCommand.ts` | Game ends immediately if round ends during final turns |
| Game end & scoring | `endTurnCommand.ts`, `endRoundCommand.ts` | GAME_ENDED event with final scores |

**Note:** First Reconnaissance is currently implemented for solo play only. The multiplayer variant (different tile counts and round limits for 2-4 players) is deferred.

**First Reconnaissance Solo — Known Gaps:**
- Skills disabled (`skillsEnabled: false`) — Rulebook doesn't explicitly disable skills, only Elite Units and PvP. Current implementation treats this as a training simplification.
- Scoring simplified — Rulebook says "Apply standard Achievements scoring" (6 categories + titles). Solo variant says "award no titles" but base scoring should still apply. Current implementation uses 3 simplified rules.
- Village icon unit setup — Rulebook: "For the first game, there should be at least one Unit in the offer with the village icon." Not enforced.
- Dummy player — Solo variant rulebook suggests using a Dummy player, but also says you can ignore it "to become familiar with the mechanics."

**Scenario Configuration Options:**
- Map shape (wedge/open), tile counts (countryside/core/city)
- Round limits (day/night/total)
- Player count limits, starting fame/reputation
- Feature flags: skills, elite units, PvP, spells, advanced actions
- Fame per tile explored (0 for Full Conquest, 1 for First Reconnaissance)
- City entry allowed (false for First Reconnaissance)
- End trigger (city revealed, city conquered, round limit)
- Scoring rules (per scenario)

### Modifier System ✅

| Feature | Location | Notes |
|---------|----------|-------|
| Modifier types | `core/src/types/modifiers.ts` | 6 types defined |
| Active modifiers | `core/src/state/GameState.ts` | Storage on state |
| Modifier lifecycle | `core/src/engine/modifiers.ts` | Add/remove/expire |
| Terrain cost mods | Same | ✅ Working |
| Sideways value mods | Same | ✅ Working |
| Enemy stat mods | Same | ✅ Working |
| Rule overrides | Same | ✅ Working |
| Combat value mods | Same | ✅ Working (with phase context) |
| Ability nullifier | Same | ✅ Working |
| ApplyModifierEffect | `resolveEffect.ts` | ✅ Now processed |

---

## In Progress / Partial

### Even Level Rewards
- Events fire for pending skill/card selection
- **Missing:** Skill deck, common skill pool, advanced action offer selection UI flow

---

## Not Yet Implemented

### High Priority (Core Gameplay)

| Feature | Complexity | Notes |
|---------|------------|-------|
| Skill system | High | Skill decks, selection, abilities |
| Spell cards | High | Different card type, night bonuses |
| Artifact cards | High | One-time use, special effects |

### Medium Priority (Complete Experience)

| Feature | Complexity | Notes |
|---------|------------|-------|
| Standard Achievements scoring | Medium | 6 categories: Knowledge, Leader, Adventurer, Loot, Conqueror, Beating + Greatest titles |
| Tactics cards | ✅ **PR #7** | Turn order selection — core logic implemented, effects not yet |
| Provoke mechanic | Medium | Adjacent-to-adjacent combat trigger |
| City defender bonuses | Low | +1 armor (white), +attack (red), etc. |
| Rewards at end of turn | Low | Claim artifacts/spells from victories |
| Reputation track | Low | Modifiers for interaction |
| PvP combat | High | Player vs player rules |

### Lower Priority (Polish)

| Feature | Complexity | Notes |
|---------|------------|-------|
| Tile rotation | Medium | Currently hardcoded to 0 |
| Face-down enemies | Low | Night visibility rules |
| Double fortification | Low | Enemy ability + site = untargetable |
| City multi-enemy setup | Medium | Multiple colors per city level |
| Summon ability | Medium | Spawn additional enemies |
| Solo dummy player | High | AI opponent for solo mode |
| First Recon multiplayer | Medium | 2-4 players: different tile counts (8/9/11), 3 rounds (2 day, 1 night) |
| Village icon unit setup | Low | Ensure village-recruitable unit in initial offer |

---

## Effect System Design

### Current CardEffect Types

```typescript
type CardEffect =
  | GainMoveEffect        // { type: "gain_move", amount }
  | GainInfluenceEffect   // { type: "gain_influence", amount }
  | GainAttackEffect      // { type: "gain_attack", amount, combatType, element? }
  | GainBlockEffect       // { type: "gain_block", amount, element? }
  | GainHealingEffect     // { type: "gain_healing", amount }
  | GainManaEffect        // { type: "gain_mana", color }
  | DrawCardsEffect       // { type: "draw_cards", amount }
  | ApplyModifierEffect   // { type: "apply_modifier", modifier, duration }
  | CompoundEffect        // { type: "compound", effects[] }
  | ChoiceEffect          // { type: "choice", options[] }
  | ConditionalEffect     // { type: "conditional", condition, thenEffect, elseEffect? }
  | ScalingEffect;        // { type: "scaling", baseEffect, scalingFactor, amountPerUnit, min?, max? }
```

### Conditional Effects ✅

ConditionalEffect enables effects that depend on game state. Unlocks ~20% more cards (phase-restricted, terrain-conditional, time-of-day).

**Supported Conditions:**
```typescript
type EffectCondition =
  | { type: "in_phase", phases: CombatPhase[] }        // Combat phase check
  | { type: "time_of_day", time: TimeOfDay }          // Day/night check
  | { type: "on_terrain", terrain: Terrain }          // Player terrain check
  | { type: "in_combat" }                              // In combat check
  | { type: "blocked_successfully" }                   // All damage blocked this phase
  | { type: "enemy_defeated_this_combat" }            // An enemy was defeated
  | { type: "mana_used_this_turn", color?: ManaColor } // Mana usage check
  | { type: "has_wounds_in_hand" }                     // Wounds in hand check
```

**Helper Functions:** (`core/src/data/effectHelpers.ts`)
- `conditional(condition, thenEffect, elseEffect?)` — Generic conditional
- `ifNight(thenEffect, elseEffect?)` — Night-time conditional
- `ifDay(thenEffect, elseEffect?)` — Daytime conditional
- `ifInPhase(phases, thenEffect, elseEffect?)` — Combat phase conditional
- `ifOnTerrain(terrain, thenEffect, elseEffect?)` — Terrain conditional
- `ifInCombat(thenEffect, elseEffect?)` — In combat conditional
- `ifBlockedSuccessfully(thenEffect, elseEffect?)` — Blocked all damage conditional
- `ifEnemyDefeated(thenEffect, elseEffect?)` — Enemy defeated conditional
- `ifManaUsed(thenEffect, elseEffect?, color?)` — Mana usage conditional
- `ifHasWoundsInHand(thenEffect, elseEffect?)` — Has wounds conditional

**State Tracking:**
- `CombatState.allDamageBlockedThisPhase` — Set after block phase if all damage blocked
- `Player.manaUsedThisTurn` — Tracks mana colors used, reset at turn end

### Scaling Effects ✅

ScalingEffect enables effects that scale based on game state (enemy count, wounds, units). Unlocks cards like Flame Wave, Blood Ritual, Shocktroops.

**Supported Scaling Factors:**
```typescript
type ScalingFactor =
  | { type: "per_enemy" }           // Count undefeated enemies in combat
  | { type: "per_wound_in_hand" }   // Count wounds in player's hand
  | { type: "per_unit" }            // Count non-wounded units
```

**ScalingEffect Structure:**
```typescript
interface ScalingEffect {
  type: "scaling";
  baseEffect: GainAttackEffect | GainBlockEffect | GainMoveEffect | GainInfluenceEffect;
  scalingFactor: ScalingFactor;
  amountPerUnit: number;  // Bonus per count (e.g., +2 per enemy)
  minimum?: number;       // Floor value
  maximum?: number;       // Cap value
}
```

**Helper Functions:** (`core/src/data/effectHelpers.ts`)
- `scaling(baseEffect, scalingFactor, amountPerUnit, options?)` — Generic scaling
- `scalingAttack(base, factor, perUnit, element?, combatType?, options?)` — Scaling attack
- `scalingBlock(base, factor, perUnit, element?, options?)` — Scaling block
- `fireAttackPerEnemy(base, perEnemy)` — Fire attack per enemy (e.g., Flame Wave)
- `fireBlockPerEnemy(base, perEnemy)` — Fire block per enemy (e.g., Flame Wave)
- `blockPerEnemy(base, perEnemy, element?)` — Block per enemy
- `attackPerWoundInHand(base, perWound)` — Attack per wound in hand
- `attackPerUnit(base, perUnit)` — Attack per unit (e.g., Shocktroops)
- `blockPerUnit(base, perUnit)` — Block per unit

**Example - Flame Wave (Red Spell):**
```typescript
// Basic (Flame Wall): Fire Attack 5 OR Fire Block 7
// Powered (Flame Wave): Same choice, +2 per enemy
const FLAME_WAVE = {
  basicEffect: choice([fireAttack(5), fireBlock(7)]),
  poweredEffect: choice([
    fireAttackPerEnemy(5, 2),   // With 3 enemies: 5 + (2×3) = 11
    fireBlockPerEnemy(7, 2),    // With 3 enemies: 7 + (2×3) = 13
  ]),
};
```

**Non-reversible:** Scaling effects cannot be undone because the scaling count may change after the effect is applied. Commands containing scaling effects should be marked non-reversible.

### Needed Effect Types (for spells/artifacts)

```typescript
// Triggered effects
| TriggeredEffect        // { type: "triggered", trigger, effect }

// Cost effects
| CostEffect             // { type: "cost", cost, effect }

// Unit manipulation
| ReadyUnitEffect        // { type: "ready_unit", level?: number }
| HealUnitEffect         // { type: "heal_unit" }
```

### Additional Condition Types (future)

```typescript
// Enemy-specific conditions (for combat cards)
| { type: "enemy_has_resistance", element: Element }
| { type: "enemy_has_ability", ability: EnemyAbilityType }

// Resource conditions
| { type: "player_has_mana", color: ManaColor }
| { type: "player_has_crystals", color: BasicManaColor, count: number }
```

### Additional Scaling Factors (future)

Based on spell reference (`docs/reference/spells.md`) and advanced actions reference (`docs/reference/advanced-actions.md`), these additional scaling patterns exist:

**From Spells:**

| Card | Pattern | Notes |
|------|---------|-------|
| **Sacrifice** (#11) | Per crystal pair | Attack per pair of crystals (one {green,white} + one {red,blue}) |
| **Wings of Night** (#23) | Cost scaling | Increasing Move cost per additional target (1, 2, 3...) |

**From Advanced Actions:**

| Card | Pattern | Notes |
|------|---------|-------|
| **Blood Rage** (#04) | Optional cost | Take wound for +3/+5 attack bonus |
| **In Need** (#19) | Per wound (hand + units) | Current `per_wound_in_hand` only counts hand, not unit wounds |
| **Counterattack** (#28) | Per enemy blocked | +2/+3 attack per enemy blocked this turn |
| **Power of Crystals** (#40) | Per crystal of color | +1/+2 per crystal matching card color |
| **Shield Bash** (#31) | Per excess block | Armor -1 per block point above requirement |

**From Artifacts:**

| Card | Pattern | Notes |
|------|---------|-------|
| **Banner of Glory** (#00) | Per unit acting | Fame +1 per unit that attacks/blocks this turn |
| **Sword of Justice** (#08) | Per card discarded | Attack 3 per card discarded (player chooses amount) |
| **Bow of Starsdawn** (#16) | Per card discarded | Ranged Attack 2 per card discarded |
| **Horn of Wrath** (#09) | Risk-based scaling | +1 to +5 Siege, roll die per +1, wound on black/red |
| **Golden Grail** (#12) | Per healing spent | Fame +1 per healing point used |
| **Soul Harvester** (#19) | Per enemy defeated | Crystal per enemy defeated this phase |

**From Units:**

| Unit | Pattern | Notes |
|------|---------|-------|
| **Shocktroops** (#10) | Per other unit | All other units get +1 Attack (uses existing `SCALING_PER_UNIT`) |
| **Altem Mages** (#01) | Mana payment tiers | Cold Fire 5, +2 for blue, +2 for red, +4 for both |
| **Northern Monks** (#05) | Triggered reward | Reputation +1 if this destroys an enemy |
| **Scouts** (#09) | Triggered reward | +1 Fame if you defeat scouted token this turn |
| **Heroes** (#08-11) | Triggered reward | Reputation +1 if used during interaction |

**Required new scaling factors:**
- `SCALING_PER_CRYSTAL_PAIR` — Count matching crystal pairs with color-pair logic
- `SCALING_PER_ENEMY_BLOCKED` — Count enemies blocked this combat (needs state tracking)
- `SCALING_PER_CRYSTAL_OF_COLOR` — Count crystals of a specific color (needs color parameter)
- `SCALING_PER_WOUND_TOTAL` — Extend wound counting to include unit wounds (or rename existing)
- `SCALING_PER_CARD_DISCARDED` — Player-chosen discard count (Sword of Justice, Bow of Starsdawn)
- `SCALING_PER_ENEMY_DEFEATED` — Count enemies defeated this phase/combat (Soul Harvester)

**Required new mechanisms:**
- Cost scaling — Affects resource spend, not effect value
- Optional cost triggers — "You may take a wound to..." pattern
- Excess value scaling — Bonus based on how much you exceeded a threshold
- Discard-as-cost scaling — Player chooses cards to discard, effect scales by count
- Triggered rewards — Effects that fire when events happen (unit attacks, enemy defeated, healing used)
- Risk-based scaling — Optional bonus with random negative outcome (Horn of Wrath)
- Mana payment tiers — Pay optional mana for stepped bonuses (Altem Mages: +2 blue, +2 red, +4 both)

---

## Key Files Reference

### Shared Package
- `packages/shared/src/actions.ts` — All player action types
- `packages/shared/src/events.ts` — All game events
- `packages/shared/src/units.ts` — Unit definitions and abilities
- `packages/shared/src/enemies.ts` — Enemy definitions
- `packages/shared/src/levels.ts` — Level thresholds and stats
- `packages/shared/src/mana.ts` — Mana colors and types
- `packages/shared/src/scenarios.ts` — Scenario types and constants
- `packages/shared/src/tactics.ts` — Tactic IDs, types, helpers
- `packages/shared/src/valueConstants.ts` — Combat types, elements, etc.

### Core Package
- `packages/core/src/state/GameState.ts` — Main state interface
- `packages/core/src/types/player.ts` — Player state
- `packages/core/src/types/combat.ts` — Combat state and accumulator
- `packages/core/src/types/map.ts` — Map, hex, site types
- `packages/core/src/types/modifiers.ts` — Modifier system types
- `packages/core/src/types/conditions.ts` — Condition types for conditional effects
- `packages/core/src/types/scaling.ts` — Scaling factor types for scaling effects
- `packages/core/src/engine/MageKnightEngine.ts` — Main engine entry
- `packages/core/src/engine/commands/` — All command implementations
- `packages/core/src/engine/validators/` — All validation logic
- `packages/core/src/engine/modifiers.ts` — Modifier queries and lifecycle
- `packages/core/src/engine/effects/resolveEffect.ts` — Card effect processing
- `packages/core/src/engine/effects/conditionEvaluator.ts` — Condition evaluation
- `packages/core/src/engine/effects/scalingEvaluator.ts` — Scaling factor evaluation
- `packages/core/src/engine/helpers/` — Various helper functions

### Data Files
- `packages/core/src/data/tiles.ts` — Tile definitions
- `packages/core/src/data/basicActions.ts` — Basic action card definitions
- `packages/core/src/data/siteProperties.ts` — Site type properties
- `packages/core/src/data/effectHelpers.ts` — Helper functions for card effects
- `packages/core/src/data/tactics.ts` — Tactic card definitions (effects, turn orders)
- `packages/core/src/data/scenarios/` — Scenario configurations (First Reconnaissance, etc.)

---

## Testing Patterns

### Test File Locations
```
packages/core/src/engine/__tests__/
├── combat.test.ts
├── combatTriggers.test.ts
├── conditionalEffects.test.ts   # 44 tests for conditional effects
├── scalingEffects.test.ts       # ~35 tests for scaling effects
├── tactics.test.ts              # 14 tests for tactics selection
├── conquest.test.ts
├── dungeonTombRestrictions.test.ts
├── enemiesOnMap.test.ts
├── enterSite.test.ts
├── levelUp.test.ts
├── modifiers.test.ts
├── movement.test.ts
├── roundCycle.test.ts
├── siteInteraction.test.ts
├── units.test.ts
└── ... more
```

### Test Helpers
- `packages/core/src/engine/__tests__/testHelpers.ts` — State builders

### Running Tests
```bash
pnpm test          # All tests
pnpm test:core     # Core package only
pnpm lint          # Linting
pnpm build         # Type checking + build
```

---

## Agent Workflow

When implementing new features:

1. **Rules Lawyer** — Ask rulebook questions first, get line references
2. **Code Auditor** — Check existing code before writing new
3. **Implementation Prompt** — Detailed task with:
   - Constants pattern reminder
   - What exists (don't duplicate)
   - Step by step parts
   - Test requirements
   - Validation checklist
4. **Rules Lawyer Review** — Check implementation against rules
5. **Fix prompt** — Address any issues found

---

## Known Issues / Tech Debt

1. **Tile rotation hardcoded** — `exploreCommand.ts:44` always uses rotation 0
2. **Special units have empty abilities** — Magic Familiars, Sorcerers, Delphana Masters need custom handling
3. **Some cards are placeholders** — Crystallize, Mana Draw have `drawCards(0)` placeholder effects
4. **Damage overflow auto-routes** — Should be player choice, currently auto-assigns to hero
5. **Enemy visibility not tracked** — See [Enemy Visibility & Undo Ticket](tickets/enemy-visibility-and-undo.md). Combat commands are overly restrictive with `isReversible: false` because we don't track whether enemies are face-up or face-down. Affects undo within combat and combat entry reversibility.
6. **Powered card play without mana selection** — See [Mana Selection Ticket](tickets/mana-selection-for-powered-cards.md). UI shows "Powered" options even when player can't pay mana cost. `validActions.mana` is not implemented (TODO Phase 3). Need mana source UI in combat and filtering of powered options.
7. **Combat accumulator not displayed** — When cards are played for block/attack, the accumulated values aren't shown in the combat UI. Only enemy blocked count is shown, not total block points accumulated.
8. **Event log hidden during combat** — Combat modal covers the event log, so error messages like "Powered play requires a mana source" are invisible to the player.

---

## Next Steps (Recommended Order)

1. ~~**Conditional effects**~~ ✅ — Completed (enables most spell implementations)
2. ~~**Scenario system**~~ ✅ — First Reconnaissance implemented (end trigger, city entry, fame on explore)
3. ~~**Tactics cards**~~ ✅ — Turn order selection implemented (PR #7), individual effects pending
4. **Spell definitions** — Start with simple spells, build up
5. **Skill system** — Skill decks, selection, hero abilities
6. **Tactics effects** — Implement individual tactic card effects (Rethink, Great Start, etc.)
7. ~~**Combat UI**~~ ✅ — Combat overlay, enemy cards, phase indicator, actions

---

## Rulebook Reference

The rulebook is at `docs/rulebook.md`. Key sections:

- Lines 53-110: Setup
- Lines 126-170: Round structure  
- Lines 222-260: Units
- Lines 379-420: Actions
- Lines 545-616: Interaction and combat triggers
- Lines 618-780: Combat phases
- Lines 788-830: Combat resolution
- Lines 860-930: Rewards and healing
- Lines 1189-1230: Solo rules

---

*This document should be updated as development progresses.*