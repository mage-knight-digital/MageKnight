# Ticket: End of Round Announcement Forfeits Turn

**Created:** January 2025
**Updated:** January 2025
**Priority:** Medium
**Complexity:** Low
**Status:** Not Started
**Affects:** Turn management, round flow
**Authoritative:** Yes

---

## Summary

Announcing end of round should immediately forfeit the announcer’s turn. The current implementation sets flags but still leaves the player with an active turn.

## Problem Statement

Rulebook says announcing end of round forfeits the current turn immediately. Today, `announceEndOfRound` only sets state and does not trigger end-turn flow, so the announcer can still act.

## Current Behavior

- `createAnnounceEndOfRoundCommand` sets `endOfRoundAnnouncedBy` and `playersWithFinalTurn`, and marks `hasTakenActionThisTurn`.
- The player is still in an active turn unless they manually end turn.
- End turn logic handles auto-announce when deck+hand are empty (`packages/core/src/engine/commands/endTurn/index.ts`).

## Expected Behavior

- Announcing end of round immediately ends the announcing player’s turn.
- Other players each get one final turn, then round ends.
- Solo: round ends immediately after announcement.

## Scope

### In Scope
- Auto-end the announcer’s turn as part of the announce command.
- Ensure final-turn tracking works with immediate forfeiture.

### Out of Scope
- Changes to announce eligibility rules (already validated).

## Proposed Approach

- After processing `ANNOUNCE_END_OF_ROUND`, immediately invoke end-turn flow for the announcing player (or embed the same logic in the command).

## Implementation Notes

- `packages/core/src/engine/commands/announceEndOfRoundCommand.ts`
- `packages/core/src/engine/commands/endTurn/index.ts`
- `packages/core/src/state/GameState.ts` (final turn tracking already present)

## Acceptance Criteria

- [ ] Announcing end of round immediately forfeits the announcer’s turn.
- [ ] Solo: round ends immediately after announcement.
- [ ] Multiplayer: remaining players each get one final turn.

## Test Plan

### Manual
1. Announce end of round with empty deck; confirm your turn ends immediately.
2. Verify other players get one last turn before round end.

## Open Questions

- None.
