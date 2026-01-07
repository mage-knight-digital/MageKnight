# Ticket: Challenge Rampaging Enemies Action

**Created:** January 2025
**Priority:** Medium
**Complexity:** Medium
**Affects:** Combat system, Valid actions, Movement system
**Status:** Not Started

---

## Problem Statement

Players cannot voluntarily challenge rampaging enemies from an adjacent hex. Currently, the only ways to fight rampaging enemies are:
1. Provoking them by skirting (moving from one adjacent hex to another adjacent hex) - **implemented**
2. Being blocked from entering their hex - **implemented**

Missing: The ability to voluntarily initiate combat with adjacent rampaging enemies as an action.

---

## Rules Reference

From `docs/rules/rulebook.md`:

**Line 412 (Voluntary Actions):**
> If there are rampaging enemies (orc marauders, draconum) in one or more adjacent spaces, you can decide to challenge one or more of them in combat.

**Line 600 (Combat Triggers):**
> If you are standing adjacent to a rampaging enemy token (orc marauder or draconum), you can challenge it to combat. If there are rampaging enemies on multiple adjacent spaces, you can choose to challenge one or more of them to combat.

**Line 610-612 (Combining with other combat):**
> If your move started a combat and there are one or more rampaging enemies adjacent to the space you moved into, you may challenge them to join the fight. This means:
> - You may provoke a rampaging enemy by your move, then challenge one or more rampaging enemies adjacent to the space you moved into, and then fight them all.
> - When assaulting a fortified site, you may also challenge any rampaging enemies adjacent to that site. They join the defenders in combat, but are not fortified and you do not need to defeat them in order to conquer the site.

---

## Current State

### What Works

| Scenario | Status | Implementation |
|----------|--------|----------------|
| Cannot enter rampaging enemy hex | ✅ Working | `validateNotBlockedByRampaging()` in movement validation |
| Provoking (skirting around) triggers combat | ✅ Working | `findProvokedRampagingEnemies()` in `moveCommand.ts` |

### What's Missing

| Scenario | Status | Notes |
|----------|--------|-------|
| Challenge from adjacent hex | ❌ Missing | No action type, no UI |
| Challenge multiple rampaging enemies | ❌ Missing | Should allow selecting which to fight |
| Challenge during assault | ❌ Missing | Add rampaging to fortified combat |
| Challenge after provoking | ❌ Missing | Add more rampaging to existing combat |

---

## Expected Behavior

### Basic Challenge

1. Player is adjacent to one or more hexes with rampaging enemies
2. Player has not combatted this turn (`hasCombattedThisTurn === false`)
3. Valid actions includes `CHALLENGE_RAMPAGING_ACTION` with list of challengeable enemies
4. Player selects which enemy/enemies to challenge
5. Combat starts with selected enemies (not fortified)

### Challenge During Existing Combat

Per the rules, if combat was already triggered (by provoking or assault), you can add adjacent rampaging enemies:

1. Combat is active (`state.combat !== null`)
2. Combat was triggered this turn (movement → provoke or assault)
3. There are rampaging enemies adjacent to player's current position
4. Player can choose to add them to the current combat
5. Added enemies are not fortified

---

## Proposed Solution

### Step 1: Add Action Type

```typescript
// packages/shared/src/types/actions.ts
export const CHALLENGE_RAMPAGING_ACTION = "challenge_rampaging" as const;

export interface ChallengeRampagingAction {
  readonly type: typeof CHALLENGE_RAMPAGING_ACTION;
  readonly targetHexes: readonly HexCoord[];  // Which rampaging hexes to challenge
}
```

### Step 2: Add Valid Action Computation

```typescript
// packages/core/src/engine/validActions/combat.ts

export function getChallengeableRampagingEnemies(
  state: GameState,
  player: Player
): ValidChallengeRampaging | null {
  // Can't challenge if already combatted (unless adding to existing combat)
  if (player.hasCombattedThisTurn && !state.combat) {
    return null;
  }

  // Find adjacent hexes with rampaging enemies
  const adjacentHexes = getAllNeighbors(player.position);
  const challengeable: ChallengeableEnemy[] = [];

  for (const coord of adjacentHexes) {
    const hex = state.map.hexes[hexKey(coord)];
    if (hex?.rampagingEnemies.length > 0 && hex.enemies.length > 0) {
      challengeable.push({
        hexCoord: coord,
        enemies: hex.enemies,
        rampagingType: hex.rampagingEnemies[0],
      });
    }
  }

  if (challengeable.length === 0) {
    return null;
  }

  return {
    type: CHALLENGE_RAMPAGING_ACTION,
    challengeable,
    canAddToExistingCombat: state.combat !== null,
  };
}
```

### Step 3: Create Challenge Command

```typescript
// packages/core/src/engine/commands/combat/challengeRampagingCommand.ts

export interface ChallengeRampagingParams {
  readonly playerId: string;
  readonly targetHexes: readonly HexCoord[];
}

export function createChallengeRampagingCommand(params: ChallengeRampagingParams): Command {
  return {
    type: CHALLENGE_RAMPAGING_COMMAND,
    playerId: params.playerId,
    isReversible: true,  // No hidden info revealed

    execute(state: GameState): CommandResult {
      // Collect all enemy tokens from target hexes
      const allEnemyTokens: EnemyTokenId[] = [];
      for (const coord of params.targetHexes) {
        const hex = state.map.hexes[hexKey(coord)];
        if (hex) {
          allEnemyTokens.push(...hex.enemies);
        }
      }

      // If combat already exists, add to it
      if (state.combat) {
        const updatedCombat = addEnemiesToCombat(state.combat, allEnemyTokens, false);
        return {
          state: { ...state, combat: updatedCombat },
          events: [createEnemiesChallengedEvent(params.playerId, allEnemyTokens)],
        };
      }

      // Otherwise, create new combat
      const combatState = createCombatState(
        allEnemyTokens.map(getEnemyIdFromToken),
        false  // Not fortified
      );

      const player = state.players.find(p => p.id === params.playerId);
      const updatedPlayer = { ...player, hasCombattedThisTurn: true };

      return {
        state: {
          ...state,
          combat: combatState,
          players: state.players.map(p => p.id === params.playerId ? updatedPlayer : p),
        },
        events: [
          createCombatTriggeredEvent(
            params.playerId,
            COMBAT_TRIGGER_CHALLENGE_RAMPAGING,
            params.targetHexes[0],
            allEnemyTokens
          ),
        ],
      };
    },

    undo(state: GameState): CommandResult {
      // Remove combat state or remove challenged enemies from existing combat
      // ...
    },
  };
}
```

### Step 4: Add UI for Challenge Action

```typescript
// packages/client/src/components/ChallengeRampagingButton.tsx

// Show button when adjacent to rampaging enemies
// If multiple adjacent, show selection UI
// If combat already active, show "Add to combat" variant
```

---

## Testing Plan

### RED Tests (Write First)

#### Core Unit Tests: `challengeRampaging.test.ts`

```typescript
describe("Challenge Rampaging Enemies", () => {
  describe("valid action computation", () => {
    it("should include challenge action when adjacent to rampaging enemy");
    it("should NOT include challenge action when not adjacent to any rampaging");
    it("should NOT include challenge action when already combatted this turn");
    it("should list all adjacent rampaging hexes as challengeable");
    it("should allow challenge even if combat is active (add to combat)");
  });

  describe("challenge command execution", () => {
    it("should start combat with challenged enemy");
    it("should allow challenging multiple rampaging enemies at once");
    it("should mark player as hasCombattedThisTurn");
    it("should NOT mark enemies as fortified");
    it("should add to existing combat if combat already active");
  });

  describe("challenge command undo", () => {
    it("should remove combat state when undoing fresh challenge");
    it("should remove challenged enemies when undoing add-to-combat");
    it("should restore hasCombattedThisTurn flag");
  });
});
```

#### Server Integration Tests: `GameServer.test.ts`

```typescript
describe("challenge rampaging via server", () => {
  it("should trigger combat when challenging adjacent rampaging enemy");
  it("should allow challenging rampaging after moving adjacent");
  it("should reject challenge when not adjacent to rampaging");
});
```

#### E2E Tests: `challenge-rampaging.spec.ts`

```typescript
test.describe("Challenge Rampaging Enemies", () => {
  test("can challenge rampaging enemy from adjacent hex", async ({ page }) => {
    // Use seed 123 which has rampaging at (3,-4)
    // Move to (2,-3) which is adjacent
    // Click challenge button
    // Verify combat starts
  });

  test("challenge button not shown when not adjacent", async ({ page }) => {
    // Stay at starting position
    // Verify no challenge button
  });

  test("can challenge multiple rampaging enemies", async ({ page }) => {
    // Find seed with multiple adjacent rampaging
    // Or use test setup
    // Select multiple, verify all in combat
  });
});
```

---

## Implementation Order

1. **Add constants and types** - `CHALLENGE_RAMPAGING_ACTION`, `ChallengeRampagingAction`, event types
2. **Write RED tests** - All test files with failing tests
3. **Implement valid action computation** - `getChallengeableRampagingEnemies()`
4. **Implement command** - `createChallengeRampagingCommand()`
5. **Wire into action processor** - Handle in `processAction()`
6. **Add client UI** - Button and selection UI
7. **Run tests GREEN** - All should pass
8. **E2E tests** - Verify full flow

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Challenge when hasCombattedThisTurn is true | Block unless adding to existing combat |
| Challenge hex with 0 enemies (defeated) | Don't show as challengeable |
| Challenge during Night | Allowed (rampaging are always face-up) |
| Provoke + challenge same turn | Allowed - add challenged to provoked combat |
| Assault + challenge same turn | Allowed - add challenged to assault combat |
| Challenge after combat ended | Not allowed (already combatted) |

---

## Acceptance Criteria

- [ ] `CHALLENGE_RAMPAGING_ACTION` constant and type exist
- [ ] `getChallengeableRampagingEnemies()` returns valid targets
- [ ] `createChallengeRampagingCommand()` creates/extends combat
- [ ] Command is reversible (proper undo implementation)
- [ ] Server processes challenge action correctly
- [ ] UI shows challenge button when adjacent to rampaging
- [ ] UI allows selecting multiple rampaging enemies
- [ ] UI shows "Add to combat" when combat already active
- [ ] `validActions.enterCombat` is implemented (currently `undefined` / TODO in `validActions/index.ts`)
  - Returns available enemies that can be fought (hex enemies, rampaging, etc.)
  - Respects `hasCombattedThisTurn` and `hasTakenActionThisTurn` flags
  - Client uses this to show combat entry options instead of ad-hoc logic
- [ ] All unit tests pass
- [ ] All E2E tests pass

---

## Related Issues

- Provoking rampaging enemies (DONE - commit `096041c`)
- Cannot enter rampaging hex (DONE - commit `ba3b873`)
- Enemy visibility tracking (see `enemy-visibility-and-undo.md`)
