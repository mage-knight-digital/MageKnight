# Ticket: Async Reward Selection for Multiplayer

**Created:** January 2025
**Priority:** Low
**Complexity:** Medium
**Affects:** Site rewards, Multiplayer timing, Turn flow

---

## Problem Statement

When a player conquers a site, they receive rewards (spell, artifact, advanced action). Currently, reward selection is forced at end of turn. In physical Mage Knight, reward selection can happen during other players' turns (truly async).

**Current behavior:**
1. Player conquers site, reward is queued to `pendingRewards`
2. Player MUST select reward before end turn (validated)
3. Selected card goes to top of deed deck (will draw next round)

**Correct physical game behavior:**
1. Player conquers site
2. Player can select from offer at any time (even during opponent's turn)
3. Must select before next turn starts
4. Cards can be taken from the offer by other players racing you

---

## Rulebook References

### Reward Timing

> "After each combat at an adventure site, take one of the offered Artifacts (from the top three cards of the Artifact deck)." (General reward pattern)

### Spell/Advanced Action Selection

> "Take one Spell card from the Spell offer" - Players choose from the visible offer, not immediately.

### Race Condition

In physical play, if multiple players have pending rewards, there's a race for who selects first from limited offers.

---

## Current Implementation

The reward system currently:
1. Queues choice-based rewards to `player.pendingRewards` at conquest time
2. Immediately grants non-choice rewards (fame, crystals)
3. Blocks END_TURN action if `pendingRewards.length > 0`
4. Uses SELECT_REWARD action to pick from offer and move to discard

**Relevant files:**
- `packages/core/src/types/player.ts` - `pendingRewards` field
- `packages/core/src/engine/helpers/rewardHelpers.ts` - `queueSiteReward()`
- `packages/core/src/engine/commands/selectRewardCommand.ts`
- `packages/core/src/engine/validators/rewardValidators.ts`

---

## Proposed Future Enhancement

### Option A: Async Selection During Any Player's Turn

Allow SELECT_REWARD action even when it's not your turn:
1. Remove `validateIsPlayersTurn` from SELECT_REWARD_ACTION validators
2. Add turn-based deadline (must select before your next turn starts)
3. Handle race conditions for limited offers

**Pros:** Most accurate to physical game
**Cons:** Complex race condition handling, requires multiplayer testing

### Option B: Block at Start of Next Turn

1. Allow end turn without selecting
2. At start of next turn, force selection before any action
3. Simpler than true async

**Pros:** Simpler to implement
**Cons:** Not exactly like physical game

### Option C: Keep Current Behavior (End of Turn)

Current implementation is valid for solo play. Leave as-is until multiplayer becomes priority.

**Pros:** Already working
**Cons:** Doesn't match physical game exactly

---

## Implementation Notes

### Race Condition Handling (Option A)

If two players have pending spell rewards:
1. Both see spell offer with cards A, B, C
2. Player 1 selects card A
3. Offer replenishes to B, C, D
4. Player 2's selection must revalidate - if they selected A, reject

```typescript
// In selectRewardCommand
// Before executing, re-validate card is still in offer
if (!offer.includes(cardId)) {
  throw new Error("Card no longer available - another player selected it");
}
```

### UI Considerations

- Show "You have pending rewards" notification
- Allow selecting even during opponent's turn
- Update offer display in real-time as cards are taken

---

## Testing Plan

```typescript
describe('Async Reward Selection', () => {
  describe('option A - true async', () => {
    it('should allow reward selection when not your turn');
    it('should handle race conditions for limited offers');
    it('should reject selection if card no longer in offer');
    it('should force selection before your next turn starts');
  });

  describe('multiplayer scenarios', () => {
    it('should allow multiple players to have pending rewards');
    it('should update offers in real-time as cards are taken');
    it('should notify when selected card was taken by another');
  });
});
```

---

## Related Files

**Current Implementation:**
- `packages/core/src/types/player.ts` - pendingRewards
- `packages/core/src/engine/helpers/rewardHelpers.ts`
- `packages/core/src/engine/commands/selectRewardCommand.ts`
- `packages/core/src/engine/validators/rewardValidators.ts`

**Related Tickets:**
- `turn-structure-and-phases.md` - Turn flow

---

## Acceptance Criteria

For Option A (full async):
- [ ] Players can select rewards during any player's turn
- [ ] Race conditions handled gracefully
- [ ] Selection must complete before your next turn
- [ ] UI shows pending rewards notification
- [ ] Real-time offer updates when cards are taken

For Option B (block at turn start):
- [ ] End turn allowed with pending rewards
- [ ] Start of turn blocks until rewards selected
- [ ] Simpler than Option A

Current Implementation (Option C):
- [x] Rewards queued at conquest
- [x] Must select before end turn
- [x] Cards go to top of deed deck
- [x] Validators prevent end turn with pending rewards
