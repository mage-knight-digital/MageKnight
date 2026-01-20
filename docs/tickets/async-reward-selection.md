# Ticket: Async Reward Selection for Multiplayer

**Created:** January 2025
**Updated:** January 2025
**Priority:** Low
**Complexity:** Medium
**Status:** Not Started
**Affects:** Site rewards, turn flow, multiplayer UX
**Authoritative:** No

---

## Summary

Reward selection is currently forced before end of turn. This diverges from tabletop timing, where selections can occur during other players’ turns. Decide if/when to support async reward selection.

## Problem Statement

`pendingRewards` must be resolved before ending a turn, which blocks async selection and removes offer race dynamics present in physical play.

## Current Behavior

- Rewards that require choice are queued to `player.pendingRewards`.
- End turn is blocked while `pendingRewards` exist (`packages/core/src/engine/validators/rewardValidators.ts`).
- Selection is only validated against current offers/decks in `selectRewardCommand`.

## Expected Behavior

- Optionally allow reward selection after the turn ends (ideally before the player’s next turn), matching tabletop flexibility and offer competition.

## Scope

### In Scope
- Decide async policy (allow during other turns vs force at next turn start).
- Adjust validation gates for `END_TURN_ACTION` and `SELECT_REWARD_ACTION` accordingly.

### Out of Scope
- Full multiplayer UI/notification system unless required for the selected option.

## Proposed Approach

- **Option A (closest to tabletop):** allow `SELECT_REWARD_ACTION` out of turn; enforce a deadline before the player’s next turn.
- **Option B (simpler):** allow end turn with pending rewards; block the player at next turn start until rewards are chosen.
- **Option C (status quo):** keep current behavior for now.

## Implementation Notes

- Files:
  - `packages/core/src/types/player.ts` (pending rewards)
  - `packages/core/src/engine/validators/rewardValidators.ts`
  - `packages/core/src/engine/commands/selectRewardCommand.ts`
- Race condition handling is already partially covered by `validateCardInOffer`.

## Acceptance Criteria

- [ ] Chosen async policy is implemented and documented.
- [ ] Reward selection remains validated against current offers/decks.
- [ ] Pending rewards do not block gameplay outside the chosen policy.

## Test Plan

### Manual
1. Conquer a site that grants a spell/AA reward.
2. Verify end turn behavior matches chosen policy.
3. Select reward while offers are changing; ensure invalid selections are rejected.

## Open Questions

- Which policy do we want for multiplayer (Option A vs B vs C)?
