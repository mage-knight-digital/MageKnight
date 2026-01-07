# Ticket: Scenario End and Game End Flow Validation

**Created:** January 2025
**Priority:** Medium
**Complexity:** Medium
**Affects:** Game lifecycle, UI state, Client display
**Status:** Needs Investigation

---

## Problem Statement

When `SCENARIO_END_TRIGGERED` fires, the player can still move around freely. Is this correct behavior?

The current implementation seems to conflate two distinct concepts:
1. **Scenario End Triggered** - The condition that starts final turns countdown
2. **Game End** - The actual end where scoring happens and no more actions allowed

Need to validate that the flow works correctly and the UI reflects the game state properly.

---

## Rules Reference (Scenario End Conditions)

### General Rules (Line 171-174)
> c. At the end of each player's turn check the Scenario End description to see whether the conditions have been met. This will often involve all players having one last turn before the game then ends.
>
> d. If a player has announced the End of the Round and the Scenario End conditions have also been met then players get their final turn according to whichever occurred first.

---

### First Reconnaissance (Line 1425-1426)
- **Trigger:** City revealed
- **Final Turns:** All players (including revealer) get one last turn
- **Early End:** If Round ends during final turns, game ends immediately

### Full Conquest (Line 1454-1455)
- **Trigger:** All cities conquered
- **Final Turns:** All players (including conqueror) get one last turn
- **Early End:** If Round ends during final turns, game ends immediately

### Blitz Conquest (Line 1492-1493)
- **Trigger:** All cities conquered
- **Final Turns:** All players (including conqueror) get one last turn
- **Early End:** If Round ends during final turns, game ends immediately

### Solo Conquest (Line 1523-1524)
- **Trigger:** All cities conquered
- **Final Turns:** Player gets one last turn (Dummy does not)
- **Note:** Solo-specific, no Dummy final turn

### Full Cooperation (Line 1567-1568)
- **Trigger:** All cities conquered
- **Final Turns:** All players except Dummy get one last turn
- **Note:** Cooperative variant

### Mine Liberation (Line 1634-1635)
- **Trigger:** All tiles revealed AND all mines liberated
- **Final Turns:** All players (including liberator) get one last turn
- **Early End:** If Round ends during final turns, game ends immediately

### Dungeon Lords (Line 1706-1707)
- **Trigger:** All tiles revealed AND all dungeons/tombs conquered
- **Final Turns:** All players (including conqueror) get one last turn
- **Early End:** If Round ends during final turns, game ends immediately

### Druid Nights (Line 1667-1668)
- **Trigger:** All players performed incantation during second Night, OR end of second Night
- **Final Turns:** Each player gets one more turn after incantation
- **Note:** Round-based end condition

### Return of the Volkare / King's Ritual / Race scenarios (Line 1775)
- **Trigger:** End of second Night
- **Final Turns:** None (game ends at round end)
- **Winner:** Player on portal wins (no scoring)

---

### Common Patterns

| Pattern | Scenarios |
|---------|-----------|
| "All players get one last turn" | Most scenarios |
| "If Round ends during this, game ends immediately" | First Recon, Full Conquest, Blitz, Mine Liberation, Dungeon Lords |
| Round-based end (no final turns) | Druid Nights, Return of Volkare |
| Condition-based (no trigger event) | Race scenarios (position-based winner) |

---

## Current Implementation

### Implemented End Trigger Types
```typescript
// packages/shared/src/scenarios.ts
export const END_TRIGGER_CITY_REVEALED = "city_revealed" as const;   // First Recon
export const END_TRIGGER_CITY_CONQUERED = "city_conquered" as const; // Full Conquest (stub)
export const END_TRIGGER_ROUND_LIMIT = "round_limit" as const;       // Not used yet
```

### Missing End Trigger Types (for future scenarios)
- `END_TRIGGER_ALL_TILES_AND_MINES` - Mine Liberation
- `END_TRIGGER_ALL_TILES_AND_DUNGEONS` - Dungeon Lords
- `END_TRIGGER_INCANTATION_COMPLETE` - Druid Nights
- `END_TRIGGER_ROUND_END` - Race scenarios (no final turns)

### State Fields
```typescript
// In GameState
scenarioEndTriggered: boolean;     // True once end condition met
finalTurnsRemaining: number | null; // Countdown of remaining turns
gameEnded: boolean;                 // True when game is completely over
winningPlayerId: string | null;     // Set when game ends
```

### Events
| Event | When Fired | Purpose |
|-------|------------|---------|
| `SCENARIO_END_TRIGGERED` | When end condition met (city revealed, etc.) | Signals final turns begin |
| `GAME_ENDED` | When `finalTurnsRemaining` reaches 0 OR round ends during final turns | Actual game over |

### Current Flow (First Reconnaissance)
1. Player reveals city tile
2. `exploreCommand` sets `scenarioEndTriggered = true`
3. `finalTurnsRemaining` set to player count (1 for solo)
4. `SCENARIO_END_TRIGGERED` event emitted
5. Player can still take actions (movement, etc.) - **THIS IS THEIR FINAL TURN**
6. When `END_TURN` action processed, `finalTurnsRemaining` decrements
7. When it reaches 0, `gameEnded = true` and `GAME_ENDED` event fires
8. OR if round ends during final turns, game ends immediately

---

## Questions to Investigate

### 1. Is the current behavior correct?
**Expected:** YES - after `SCENARIO_END_TRIGGERED`, the triggering player gets to finish their turn, then all other players get one turn each.

**Current behavior:** After revealing city, player can still move. This seems correct because:
- "all players (including themselves) have one last turn"
- The city reveal happens mid-turn, they should finish it

### 2. Does the client know about final turns?
Need to check if `ClientGameState` includes:
- `scenarioEndTriggered`
- `finalTurnsRemaining`
- `gameEnded`

### 3. Does the UI show final turns status?
Should display something like "FINAL TURN" or "Last turn remaining" to the player.

### 4. Are actions blocked after game ends?
When `gameEnded = true`, all actions should be rejected.

### 5. What about multiplayer final turns?
For 2+ players:
- Player A reveals city, `finalTurnsRemaining = 2`
- Player A finishes turn, decrement to 1
- Player B takes turn, decrement to 0
- Game ends

Is this implemented correctly?

---

## Test Plan

### Core Unit Tests: Existing Coverage
The tests in `scenarioSystem.test.ts` already cover:
- ✅ `finalTurnsRemaining` decrements on end turn
- ✅ Game ends when `finalTurnsRemaining` reaches 0
- ✅ Game ends immediately if round ends during final turns
- ✅ Scenario end only triggers once

### Tests to Add

#### 1. Actions During Final Turn
```typescript
it("should allow actions during final turn after scenario end triggered", () => {
  // Set up: city just revealed, scenarioEndTriggered = true, finalTurnsRemaining = 1
  // Player should still be able to move, play cards, etc.
});
```

#### 2. Actions Blocked After Game End
```typescript
it("should reject all actions when gameEnded is true", () => {
  // Set up: gameEnded = true
  // Try move, play card, end turn - all should fail
});
```

#### 3. Multiplayer Final Turns
```typescript
it("should give each player one final turn (2 players)", () => {
  // Player 1 reveals city
  // finalTurnsRemaining = 2
  // Player 1 ends turn -> remaining = 1
  // Player 2 ends turn -> remaining = 0, game ends
});
```

#### 4. Round End During Final Turns (Multiplayer)
```typescript
it("should end game if round ends before all final turns taken", () => {
  // Player 1 reveals city on turn 1, finalTurnsRemaining = 2
  // Round ends (deck depleted, all players pass)
  // Game should end immediately
});
```

### E2E Tests

```typescript
test.describe("Scenario End Flow", () => {
  test("First Reconnaissance - city reveal triggers final turn", async ({ page }) => {
    // Find seed where city is revealable
    // Reveal city
    // Verify SCENARIO_END_TRIGGERED shown
    // Verify player can still move
    // End turn
    // Verify GAME_ENDED shown
    // Verify score screen or game over state
  });

  test("cannot take actions after game ends", async ({ page }) => {
    // Trigger game end
    // Try to click hex to move
    // Verify action rejected / UI prevents it
  });
});
```

---

## UI Considerations

### During Final Turns
Show banner or status indicator:
- "FINAL TURN" when it's your last turn
- "X final turns remaining" for multiplayer

### After Game End
- Show score screen / game summary
- Disable all action buttons
- Possibly show "New Game" option

---

## Implementation Tasks

### Phase 1: Investigation
- [ ] Verify `ClientGameState` includes scenario end fields
- [ ] Check if client displays final turn status
- [ ] Test current behavior manually in browser
- [ ] Document any bugs found

### Phase 2: Fix Any Issues
- [ ] Add validation to reject actions when `gameEnded = true`
- [ ] Ensure `finalTurnsRemaining` calculated correctly for player count
- [ ] Fix any round-end-during-final-turns edge cases

### Phase 3: UI Enhancement
- [ ] Add "Final Turn" indicator to UI
- [ ] Add game end screen / scoring display
- [ ] Disable action UI when game ended

### Phase 4: Testing
- [ ] Add missing unit tests
- [ ] Add E2E tests for scenario end flow
- [ ] Test multiplayer scenarios (when implemented)

---

## Acceptance Criteria

- [ ] `SCENARIO_END_TRIGGERED` fires at correct time for each scenario type
- [ ] `finalTurnsRemaining` correctly counts down
- [ ] Players can take actions during their final turn
- [ ] `GAME_ENDED` fires when final turns exhausted OR round ends during final turns
- [ ] Actions are rejected after `gameEnded = true`
- [ ] UI shows final turn status
- [ ] UI shows game end state with scoring
- [ ] All unit tests pass
- [ ] E2E tests pass

---

## Notes

Your observation is correct - `SCENARIO_END_TRIGGERED` fires and you can still move. This is **expected behavior** because:

1. `SCENARIO_END_TRIGGERED` = "final turns have begun" (not "game over")
2. The player who triggered it gets to finish their turn
3. Each other player gets one turn
4. `GAME_ENDED` = actual game over

The confusion might be that the UI doesn't make this clear. We should show "FINAL TURN" prominently so players know the game is ending soon but they still get to act.

Think of it like:
- `SCENARIO_END_TRIGGERED` → "Last call for drinks!"
- `GAME_ENDED` → "Bar is closed, go home"
