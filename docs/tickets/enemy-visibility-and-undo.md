# Ticket: Enemy Visibility Tracking & Combat Undo Reversibility

**Created:** January 2025
**Priority:** Medium
**Complexity:** Medium-High
**Affects:** Combat system, Undo system, Map state

---

## Problem Statement

Combat actions are currently marked as irreversible (`isReversible: false`) even when no hidden information is revealed. This is overly restrictive and doesn't match the physical board game experience.

The root cause is that we don't track whether enemies on a hex are face-up (visible) or face-down (hidden). Without this tracking, we can't determine if entering combat reveals new information.

---

## Current State

### Enemy Storage

| Field | Type | Notes |
|-------|------|-------|
| `HexState.rampagingEnemies` | `RampagingEnemyType[]` | Enum values (orc_marauder, draconum), not actual tokens |
| `HexState.enemies` | `EnemyTokenId[]` | Token IDs only, no visibility tracking |
| `CityState.garrison` | `EnemyTokenId[]` | Implicitly face-down (comment says "revealed during assault") |

### Combat Commands Reversibility

All combat commands are currently marked `isReversible: false`:

| Command | File | Current | Should Be |
|---------|------|---------|-----------|
| `enterCombatCommand` | `combat/enterCombatCommand.ts:25` | false | Depends on enemy visibility |
| `declareBlockCommand` | `combat/declareBlockCommand.ts:68` | false | true (no hidden info) |
| `declareAttackCommand` | `combat/declareAttackCommand.ts:34` | false | true (no hidden info) |
| `assignDamageCommand` | `combat/assignDamageCommand.ts:240` | false | true (no hidden info) |
| `endCombatPhaseCommand` | `combat/endCombatPhaseCommand.ts:54` | false | true for phase transitions, false for combat end |

---

## Rules Reference

From `docs/reference/sites.md`:

### Rampaging Enemies (Always Face-Up)

**Marauding Orcs (line 187):**
> Place a green orc enemy token **face up** on this space.

**Draconum (line 201):**
> Place a red Draconum enemy token **face up** on this space.

### Fortified Sites (Face-Down Initially)

**Keep (line 73):**
> Place a grey enemy token **face down** on this space. This token is revealed during the Day if a player is adjacent to it.

**Mage Tower (line 87):**
> Place a violet enemy token **face down** on this space. The token is revealed during the Day if a player is adjacent to it.

**City (line 283):**
> Draw enemy tokens... place them **face down** on the City card. Tokens are revealed during the Day if a player is adjacent to the city.

### Adventure Sites (Mixed)

**Monster Den (line 121):**
> If you fail to defeat it, **leave the enemy token face up** on the space. Next time a player chooses to enter the den, they fight this token.

**Spawning Grounds (line 131):**
> If you fail to defeat them both, any undefeated tokens **remain face up** on the space and any defeated enemies are replaced with a new **face down** brown enemy token.

---

## Expected Behavior

### Combat Reversibility Matrix

| Scenario | Enemies Initially | Combat Reversible? | Reason |
|----------|-------------------|-------------------|--------|
| Fight rampaging orcs/draconum | Face-up | ✅ Yes | Already visible |
| Assault unconquered keep (garrison hidden) | Face-down | ❌ No | Reveals hidden tokens |
| Assault keep (garrison already revealed by adjacency) | Face-up | ✅ Yes | Already visible |
| Re-enter Monster Den (previous failure) | Face-up | ✅ Yes | Already visible |
| Enter fresh Monster Den | N/A (drawn) | ❌ No | Draws new token |
| Assault city (garrison hidden) | Face-down | ❌ No | Reveals hidden tokens |
| Assault city (garrison revealed by adjacency) | Face-up | ✅ Yes | Already visible |

### Within Combat

Once combat starts (regardless of how), all phase transitions and actions within combat should be reversible:

| Action | Reversible? | Reason |
|--------|-------------|--------|
| Phase transition (ranged → block → damage → attack) | ✅ Yes | Just state change |
| Declare block | ✅ Yes | Player decision, no hidden info |
| Declare attack | ✅ Yes | Player decision, no hidden info |
| Assign damage | ✅ Yes | Player decision, no hidden info |
| **End combat** (after attack phase) | ❌ No | Finalizes fame, conquest, rewards |

---

## Proposed Solution

### Step 1: Add Enemy Visibility Tracking

Change `HexState.enemies` from `EnemyTokenId[]` to:

```typescript
interface HexEnemy {
  readonly tokenId: EnemyTokenId;
  readonly isRevealed: boolean;
}

interface HexState {
  // ...existing fields...
  readonly enemies: readonly HexEnemy[];  // Changed from EnemyTokenId[]
}
```

### Step 2: Update Enemy Placement Logic

| Scenario | `isRevealed` Value |
|----------|-------------------|
| Rampaging enemy placed on tile reveal | `true` |
| Fortified site garrison placed | `false` |
| Garrison revealed by adjacency during Day | `true` (update existing) |
| Failed Monster Den/Spawning Grounds | `true` (defeated stay face-up) |
| New token drawn at adventure site | `false` initially, `true` after combat starts |

### Step 3: Add Reveal Trigger for Adjacency

When a player moves adjacent to a fortified site during Day, reveal face-down enemies:

```typescript
// In moveCommand or a helper
function revealAdjacentGarrisons(state: GameState, playerPosition: HexCoord): GameState {
  if (state.timeOfDay !== TIME_OF_DAY_DAY) return state;

  // Find adjacent hexes with face-down enemies at fortified sites
  // Update them to isRevealed: true
  // Emit ENEMIES_REVEALED event
}
```

### Step 4: Update enterCombatCommand

```typescript
export function createEnterCombatCommand(params: EnterCombatCommandParams): Command {
  return {
    type: ENTER_COMBAT_COMMAND,
    playerId: params.playerId,
    // NEW: Determine reversibility based on whether enemies were already visible
    isReversible: params.enemiesWereRevealed ?? false,

    execute(state: GameState): CommandResult {
      // ...existing logic...
    },

    undo(state: GameState): CommandResult {
      // NEW: Actually implement undo - remove combat state, restore previous state
      return {
        state: { ...state, combat: null },
        events: [{ type: COMBAT_CANCELLED, playerId: params.playerId }],
      };
    },
  };
}
```

### Step 5: Update Combat Phase Commands

Make phase transitions reversible, but keep combat end irreversible:

```typescript
// endCombatPhaseCommand.ts
export function createEndCombatPhaseCommand(params): Command {
  return {
    type: END_COMBAT_PHASE_COMMAND,
    playerId: params.playerId,
    // Phase transitions are reversible; combat end is not
    get isReversible() {
      // Will be determined at execute time based on whether this ends combat
      // For now, mark as true and handle specially
      return true;
    },

    execute(state: GameState): CommandResult {
      const nextPhase = getNextPhase(state.combat.phase);

      if (nextPhase === null) {
        // Combat is ending - this should create a checkpoint
        // Return with special flag or emit checkpoint event
      }

      // Phase transition - reversible
      // ...
    },

    undo(state: GameState): CommandResult {
      // Revert to previous phase
      const previousPhase = getPreviousPhase(state.combat.phase);
      return {
        state: { ...state, combat: { ...state.combat, phase: previousPhase } },
        events: [{ type: COMBAT_PHASE_REVERTED, ... }],
      };
    },
  };
}
```

### Step 6: Make Block/Attack/Damage Commands Reversible

Each needs proper `undo()` implementation:

**declareBlockCommand:**
- Undo: Set `enemy.isBlocked = false`

**declareAttackCommand:**
- Undo: Set `enemy.isDefeated = false`, subtract fame from player, remove from `pendingLevelUps`

**assignDamageCommand:**
- Undo: Remove wounds from hero/unit, restore unit state

---

## Testing Plan

### New Test File: `combat-undo.test.ts`

```typescript
describe("Combat Undo", () => {
  describe("entering combat", () => {
    it("should be reversible when fighting face-up rampaging enemies");
    it("should be irreversible when assaulting keep with hidden garrison");
    it("should be reversible when assaulting keep with revealed garrison");
    it("should be irreversible when entering fresh dungeon (draws token)");
    it("should be reversible when re-entering monster den with face-up enemy");
  });

  describe("within combat", () => {
    it("should allow undo of phase transitions back to combat start");
    it("should allow undo of block declaration");
    it("should allow undo of attack declaration (restores enemy, removes fame)");
    it("should allow undo of damage assignment (removes wounds)");
    it("should NOT allow undo after combat ends (victory/defeat)");
  });

  describe("garrison reveal", () => {
    it("should reveal garrison when player moves adjacent during Day");
    it("should NOT reveal garrison when player moves adjacent during Night");
    it("should emit ENEMIES_REVEALED event on reveal");
  });
});
```

---

## Migration Notes

### Breaking Changes

- `HexState.enemies` type changes from `EnemyTokenId[]` to `HexEnemy[]`
- All code accessing `hex.enemies` needs to be updated to handle the new structure
- Client code needs to be updated to display face-down enemies differently

### Search for Affected Code

```bash
# Find all references to HexState.enemies
grep -r "\.enemies" packages/core/src/
grep -r "\.enemies" packages/server/src/
grep -r "\.enemies" packages/client/src/

# Find all places that create HexState
grep -r "enemies:" packages/core/src/types/
grep -r "enemies:" packages/core/src/engine/
```

---

## Related Issues

- `RampagingEnemyType` enum vs actual tokens: Currently rampaging enemies use enum values, not actual drawn tokens. The rules say they ARE drawn from token bags and placed face-up. Consider unifying to use `HexEnemy` for all enemy types.

---

## Acceptance Criteria

- [ ] `HexEnemy` type with `isRevealed` field exists
- [ ] `HexState.enemies` uses new type
- [ ] Rampaging enemies placed as `isRevealed: true`
- [ ] Fortified site garrisons placed as `isRevealed: false`
- [ ] Garrison reveal on adjacent movement during Day
- [ ] `enterCombatCommand.isReversible` depends on enemy visibility
- [ ] `enterCombatCommand.undo()` implemented
- [ ] Phase transition commands are reversible with proper undo
- [ ] Block/attack/damage commands are reversible with proper undo
- [ ] Combat end (after attack phase) creates checkpoint
- [ ] All tests pass
- [ ] Client displays face-down enemies differently (shows back color only)
