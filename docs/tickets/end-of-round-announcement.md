# Ticket: End of Round Announcement & Turn Forfeit System

**Created:** January 2025
**Updated:** January 2025
**Priority:** High
**Complexity:** Medium
**Status:** Not Started
**Affects:** Turn management, round flow, UI
**Authoritative:** Yes

---

## Summary

Implement the full end-of-round announcement rules from the rulebook. Currently players can get soft-locked when they have unplayable cards (e.g., wounds) in hand with an empty deck - there's no way to announce end of round or forfeit their turn.

## Problem Statement

The rulebook specifies these end-of-round rules:

1. **Optional announcement**: If your Deed deck is empty at the start of your turn (and End of Round hasn't been announced yet), you MAY forfeit your turn and announce End of Round.
2. **Mandatory announcement**: If your Deed deck AND hand are both empty at the start of your turn, you MUST announce End of Round.
3. **Choice when hand has cards**: If you have cards in hand but empty deck, it's your choice whether to announce or play your turn.
4. **Mandatory forfeit after announcement**: If you have no cards in hand AND deck, but End of Round was already announced by another player, you MUST forfeit your turn.

**Critical issue**: A player with wounds in hand and an empty deck has no way to announce end of round. They can play their non-wound cards, but then they're stuck - hitting "End Turn" repeatedly doesn't help because the game doesn't recognize this as an end-of-round trigger. The player is effectively soft-locked.

## Current Behavior

- `canAnnounceEndOfRound` exists in `turn.ts` (checks empty deck, not already announced)
- `ANNOUNCE_END_OF_ROUND` action exists but:
  - No UI surfaces this option to players
  - Announcing does NOT forfeit the turn (player can still act)
  - No mandatory announcement logic when deck+hand are empty
  - No mandatory forfeit when another player announced and you have no cards
- End turn flow has some auto-announce logic but it's incomplete

Key files:
- `packages/core/src/engine/validActions/turn.ts` - `checkCanAnnounceEndOfRound()`
- `packages/core/src/engine/commands/factories/turn.ts` - command factories
- `packages/core/src/engine/commands/announceEndOfRoundCommand.ts` - current command
- `packages/core/src/engine/commands/endTurn/index.ts` - end turn flow

## Expected Behavior

### When deck is empty at turn start (before any action):

| Hand state | End of Round announced? | Required action |
|------------|------------------------|-----------------|
| Empty | No | MUST announce (forfeit turn) |
| Empty | Yes (by someone else) | MUST forfeit turn |
| Has cards | No | MAY announce OR play normally |
| Has cards | Yes (by someone else) | Play normally (final turn) |

### When announcing:
- Turn immediately ends (forfeit)
- Other players each get one final turn
- Solo mode: round ends immediately

### UI requirements:
- Show "Announce End of Round" button when available (deck empty, not announced)
- Show "Forfeit Turn" button when required (no cards, already announced)
- Auto-trigger mandatory announcements/forfeits at turn start

## Scope

### In Scope
- Add "Announce End of Round" to valid actions UI
- Announcing immediately forfeits the turn
- Mandatory announcement when deck+hand empty
- Mandatory forfeit when no cards and round ending
- Turn start phase to check/enforce these rules
- Solo mode: round ends immediately on announcement

### Out of Scope
- Dummy player for solo (separate ticket)
- Multiple scenarios with different end conditions

## Proposed Approach

### Phase 1: Turn Start Checks
Add a "turn start" phase that runs before the player can take any actions:

```typescript
function checkTurnStartConditions(state: GameState, player: Player): TurnStartResult {
  const deckEmpty = player.deck.length === 0;
  const handEmpty = player.hand.length === 0;
  const roundEnding = state.endOfRoundAnnouncedBy !== null;

  if (deckEmpty && handEmpty) {
    if (roundEnding) {
      return { action: "MUST_FORFEIT" };
    } else {
      return { action: "MUST_ANNOUNCE" };
    }
  }

  if (deckEmpty && !roundEnding) {
    return { action: "MAY_ANNOUNCE" };
  }

  return { action: "NORMAL_TURN" };
}
```

### Phase 2: Announce Command Updates
Modify `createAnnounceEndOfRoundCommand` to:
1. Set announcement state
2. Immediately trigger end-turn flow (forfeit)

### Phase 3: Forfeit Turn Action
Add new `FORFEIT_TURN` action for when end of round already announced and player must pass.

### Phase 4: UI Integration
- Surface "Announce End of Round" in turn options
- Surface "Forfeit Turn" when required
- Add visual indicator when end of round has been announced

## Implementation Notes

### New/Modified Actions
- `ANNOUNCE_END_OF_ROUND` - exists, needs to forfeit turn
- `FORFEIT_TURN` - new action for mandatory forfeits

### State Changes
- Consider `turnStartPhase` flag to track if turn-start checks have been resolved
- Or handle synchronously at turn transition

### Files to modify
- `packages/shared/src/actions.ts` - add FORFEIT_TURN_ACTION
- `packages/shared/src/types/validActions.ts` - add canForfeitTurn, mustAnnounce flags
- `packages/core/src/engine/validActions/turn.ts` - turn start logic
- `packages/core/src/engine/commands/announceEndOfRoundCommand.ts` - forfeit on announce
- `packages/core/src/engine/commands/endTurn/index.ts` - handle forfeits
- `packages/client/` - UI for announce/forfeit buttons

### Edge cases
- Player draws into wound-only hand mid-turn (can still end turn normally)
- Announcement check is at turn START, not mid-turn
- If player undoes to before their turn started, re-check conditions

## Acceptance Criteria

- [ ] Player with empty deck sees "Announce End of Round" option
- [ ] Announcing end of round immediately ends that player's turn
- [ ] Player with empty deck AND hand is forced to announce (if not announced)
- [ ] Player with no cards is forced to forfeit (if already announced by another)
- [ ] Other players get exactly one final turn after announcement
- [ ] Solo mode: round ends immediately on announcement
- [ ] Player with wounds in hand + empty deck can announce and end the round

## Test Plan

### Manual
1. Play until deck is empty with wounds in hand
2. Verify "Announce End of Round" option appears
3. Click announce, verify turn ends immediately
4. Verify next round starts correctly

### Automated
- Unit test: `checkCanAnnounceEndOfRound` with various deck/hand states
- Unit test: Announcing triggers turn forfeit
- Integration test: Full round-end flow with announcement
- Integration test: Mandatory announce when deck+hand empty

## Open Questions

- Should we show a confirmation dialog before announcing? (Probably not - it's clearly labeled)
- How to handle undo when turn was forfeited? (Probably: can undo to before forfeit, then can take actions instead)

## Related Tickets

- Dummy player for solo mode (not yet created)
- `scenario-end-game-flow.md` (may have overlap with round end handling)
