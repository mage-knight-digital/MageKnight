# Ticket: Mandatory Card Play/Discard Per Turn

**Created:** January 2026
**Updated:**
**Priority:** High
**Complexity:** Low
**Status:** Not Started
**Affects:** Turn management, end-turn validation, card system
**Authoritative:** Yes

---

## Summary

The engine does not enforce the "minimum turn" requirement: every turn a player must play at least one card from their hand, or discard one unplayed card if they don't. Currently, players can end turns without playing or discarding any cards.

## Problem Statement

Per the rulebook (Minimum Turn S1, p.30): "Every turn you must play at least one card from your hand. Failing that, you must discard one unplayed card from your hand."

### What DOES Count as Playing a Card

Per Minimum Turn S2:
- Using Power of Pain to play a wound card sideways for 2 Move points
- Playing a Banner from your hand onto a Unit
- Playing an Artifact from your hand for its strong effect (then thrown away)

### What DOES NOT Count

Per Minimum Turn S1 and S3:
- Using a Unit, Skill, or Site to heal a wound, move, or block
- "Using a Skill as your Action" (like flipping Shamanic Ritual)
- Having a Unit disband or die, even if the Unit had a Banner
- Skills that discard wounds from hand:
  - I Feel No Pain: Discard one wound from hand
  - Invocation: Discard a wound card to gain a mana token
  - Healing Ritual: Throw away up to two wounds from hand
  - Regenerate: Throw away a wound from hand
  - Ritual of Pain: Throw away up to two wounds from hand
  - **Exception**: The second part of Ritual of Pain ("play a wound sideways") DOES count

## Current Behavior

- `playArea: readonly CardId[]` tracks cards played this turn (`player.ts:213`)
- End-of-turn has no validation requiring cards to have been played
- A player can END_TURN with an empty playArea and cards remaining in hand
- No forced discard mechanism exists

Key files:
- `packages/core/src/engine/commands/playCardCommand.ts` — plays cards to playArea
- `packages/core/src/engine/commands/endTurn/cardFlow.ts` — moves playArea to discard
- `packages/core/src/engine/validators/turnValidators.ts` — no mandatory card play validator

## Expected Behavior

1. Track whether at least one card was played from hand this turn
2. At end-of-turn, if no card was played AND hand is non-empty:
   - Block END_TURN or create pending mandatory discard state
   - Player must discard one card from hand
3. Resting satisfies this requirement (rest involves discarding cards from hand)

## Scope

### In Scope

- Add `playedCardFromHandThisTurn: boolean` tracking to player state
- Add end-of-turn validation for mandatory card play/discard
- Handle the mandatory discard flow (pending state or blocking validation)

### Out of Scope

- Rest mechanics (separate ticket: `resting-state-and-card-play.md`)
- Turn phase structure (separate ticket: turn-structure-and-phases.md)

## Proposed Approach

1. Add `playedCardFromHandThisTurn: boolean` to `Player` type
2. Set to `true` in `playCardCommand.ts` when a card is played from hand
3. Reset to `false` in `playerReset.ts` at turn start
4. For END_TURN:
   - If `playedCardFromHandThisTurn === false` AND hand has cards, require discard
   - **Option A**: Block END_TURN until discard action is taken
   - **Option B**: Create `pendingMandatoryDiscard` state with discard choice

## Implementation Notes

### Files to Modify

- `packages/core/src/types/player.ts` — add `playedCardFromHandThisTurn`
- `packages/shared/src/types/clientState.ts` — expose flag if needed
- `packages/core/src/engine/commands/playCardCommand.ts` — set flag
- `packages/core/src/engine/commands/endTurn/playerReset.ts` — reset flag
- `packages/core/src/engine/validators/turnValidators.ts` — add validator
- `packages/core/src/engine/validators/validationCodes.ts` — add code

### New Validation Code

- `MUST_PLAY_OR_DISCARD_CARD` — for end-turn without card play

## Acceptance Criteria

- [ ] Tracking when a card is played from hand (not via skill/unit)
- [ ] Player cannot END_TURN without playing or discarding at least one card
- [ ] Resting satisfies the minimum turn requirement
- [ ] Using skills/units alone does not satisfy the requirement
- [ ] Playing a wound sideways (via Power of Pain or similar) counts

## Test Plan

### Manual

1. Start turn, move using a skill, try to END_TURN — should require discard
2. Start turn, play one card, END_TURN — should succeed
3. Start turn, REST — should succeed (rest discards cards)
4. Start turn, use Unit ability only, END_TURN — should require discard

### Automated

- Add tests to `packages/core/src/engine/__tests__/endTurn.test.ts`

## Open Questions

1. **UX for mandatory discard**: Should we block END_TURN with an error, or create a pending discard choice? (Recommend: pending choice for better UX)

## Rulebook References

- Minimum Turn S1, p.30: "Every turn you must play at least one card from your hand. Failing that, you must discard one unplayed card from your hand."
- Minimum Turn S2: Lists what counts as playing a card
- Minimum Turn S3: Lists skills that do NOT count
