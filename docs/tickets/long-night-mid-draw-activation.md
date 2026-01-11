# Long Night Mid-Draw Activation

## Status: Backlog

## Summary

The Long Night tactic (Night 2) should be activatable during end-of-turn card drawing if the deck empties mid-draw, but the current implementation only supports activation as a standalone action.

## Rules Reference

From rulebook (line 894-895):
> "The Long Night Tactic can be used even during card drawing: once your Deed deck is empty, follow its instructions and then continue drawing."

## Current Behavior

1. Player ends turn and starts drawing cards
2. Deck empties mid-draw (e.g., needed 2 cards, only 1 in deck)
3. Drawing stops
4. Long Night must be activated on the next turn (if there is one)

## Expected Behavior

1. Player ends turn and starts drawing cards
2. Deck empties mid-draw
3. Game pauses and offers Long Night activation
4. If activated: shuffle discard, put 3 cards in deck, continue drawing remaining cards
5. If declined: drawing stops as normal

## Impact

Low - This is a rare edge case requiring:
- Deck emptying specifically mid-draw (not before)
- Having the Long Night tactic selected and not yet flipped
- Wanting to use it at that moment

The tactic is still fully functional, just with slightly different timing.

## Implementation Notes

Would require:
1. Refactoring `endTurnCommand.ts` draw logic to support interruption
2. Adding a new pending state for "mid-draw tactic activation opportunity"
3. Handling the continuation of drawing after tactic resolution
4. UI changes to present the activation choice during draw

## Related Files

- `packages/core/src/engine/commands/endTurnCommand.ts` - Draw logic
- `packages/core/src/engine/commands/activateTacticCommand.ts` - Long Night activation

## Priority

Low - MVP simplification is acceptable. Consider implementing if players report confusion or frustration with the timing limitation.
