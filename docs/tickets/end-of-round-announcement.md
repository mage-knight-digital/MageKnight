# Ticket: End of Round Announcement Should Forfeit Turn Immediately

**Created:** January 2025
**Priority:** Medium
**Complexity:** Low
**Affects:** Turn management, Round flow, Solo/Multiplayer handling

---

## Problem Statement

When a player announces End of Round, they currently get another turn (must click "End Turn" again). This is incorrect behavior per the rulebook.

**Current behavior:**
1. Player announces End of Round
2. Player still has an active turn
3. Player must click "End Turn" to actually end their turn

**Expected behavior:**
1. Player announces End of Round
2. Turn immediately forfeits (no further actions allowed)
3. Solo: Round ends immediately
4. Multiplayer: Other players each get one more turn, then round ends

---

## Rulebook References

### Forfeit on Announcement

> "If your Deed deck is empty at the start of your turn, and if the End of the Round has not been announced yet, you may **forfeit your turn** and announce the End of the Round." (Line 379)

> "If you forfeit your turn, your turn ends immediately; you cannot even use the benefits of a map space you occupy" (Line 389)

### Other Players Get One More Turn

> "If you do, each other player takes one more turn, and then the Round is over." (Line 379)

### No Actions After Announcement

> "Players may not play any effects after their last turn in a round, not even those usable in another player's turn." (Line 175)

### Conditions for Announcing

- **May announce:** Deed deck empty at start of turn (Line 381)
- **Must announce:** Deed deck empty AND no cards in hand (Line 383)
- **Cannot announce:** If already announced by someone else (Line 387-388)

---

## Current Implementation

The `announceEndOfRound` action sets `state.roundEndAnnounced = true` but does not automatically end the player's turn.

**Relevant files:**
- Turn/round state management
- `ValidActions` computation (should remove all options except maybe viewing state)

---

## Proposed Solution

### Step 1: End Turn Immediately on Announcement

When `announceEndOfRound` action is processed:
1. Set `roundEndAnnounced = true`
2. Set `roundEndAnnouncedBy = playerId`
3. **Immediately trigger end-of-turn logic** (return mana dice, advance to next player)
4. Mark players who haven't had their "last turn" yet

### Step 2: Track "Final Turn" State

```typescript
// Add to GameState or round-level state
roundEndAnnounced: boolean;
roundEndAnnouncedBy: PlayerId;
playersWithFinalTurnRemaining: Set<PlayerId>;  // Everyone except announcer
```

### Step 3: Handle Solo vs Multiplayer

**Solo:**
- When solo player announces End of Round, `playersWithFinalTurnRemaining` is empty
- Round ends immediately → transition to Night phase

**Multiplayer:**
- All players except announcer get added to `playersWithFinalTurnRemaining`
- After each player's turn, remove them from the set
- When set is empty, round ends → transition to Night phase

### Step 4: Update ValidActions

When `roundEndAnnounced = true` and it's a player's final turn:
- Disable `canAnnounceEndOfRound` (already announced)
- Disable PvP combat (Line 536: "End of Round has been called, and each player has their last turn this Round")

---

## Edge Cases

### Forced Announcement

> "You must announce End of Round if your Deed deck is empty and you have no cards in your hand at the start of your turn." (Line 383)

If deck is empty AND hand is empty at turn start, the only valid action should be "Announce End of Round" (or nothing if already announced).

### Already Announced

> "If you have no cards in your hand and Deed deck, but the End of the Round has already been announced by another player, you must forfeit your turn." (Line 387)

If round end already announced and player has no cards/deck, auto-forfeit their turn.

### Scenario End vs Round End

> "If a player has announced the End of the Round and the Scenario End conditions have also been met then players get their final turn according to whichever occurred first." (Line 173)

If both are triggered, use whichever was announced first for determining turn order.

---

## Testing Plan

```typescript
describe('End of Round Announcement', () => {
  describe('announcement behavior', () => {
    it('should forfeit turn immediately when announcing end of round');
    it('should NOT allow any actions after announcing');
    it('should NOT allow using map space benefits (mine, magical glade)');
    it('should return mana dice and advance to next player');
  });

  describe('solo play', () => {
    it('should end round immediately when solo player announces');
    it('should transition to Night phase after solo announcement');
  });

  describe('multiplayer', () => {
    it('should give each other player one more turn');
    it('should end round after all other players have taken final turn');
    it('should track which players still have final turns');
  });

  describe('forced announcement', () => {
    it('should require announcement when deck empty AND hand empty');
    it('should auto-forfeit if announcement already made and player has no cards');
  });

  describe('restrictions during final turns', () => {
    it('should disable PvP combat during final turns');
    it('should disable announce end of round (already announced)');
  });
});
```

---

## Related Files

**State:**
- `packages/core/src/types/gameState.ts` - Round state tracking
- `packages/core/src/types/player.ts` - Player turn state

**Commands:**
- `packages/core/src/engine/commands/` - announceEndOfRound, endTurn

**Validation:**
- `packages/core/src/engine/validActions/turn.ts` - Turn options

**Related Tickets:**
- `turn-structure-and-phases.md` - General turn flow (may overlap)

---

## Acceptance Criteria

- [ ] Announcing End of Round immediately forfeits the player's turn
- [ ] Solo: Round ends immediately after announcement
- [ ] Multiplayer: Other players each get exactly one more turn
- [ ] No actions allowed after announcing (not even map space benefits)
- [ ] Mana dice returned and next player starts immediately
- [ ] PvP combat disabled during final turns
- [ ] Forced announcement when deck and hand both empty
- [ ] Auto-forfeit if already announced and player has no cards
- [ ] Tests cover all solo and multiplayer scenarios
