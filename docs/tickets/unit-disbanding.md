# Unit Disbanding When Recruiting at Command Limit

## Summary

Players should be able to recruit units even when at command limit by disbanding an existing unit. Currently, recruitment is blocked entirely when command slots are full.

## Rulebook Reference

**Line 232:** "If you want to gain a new Unit but all of your Command tokens are occupied, you must disband one of your Units."

**Line 868:** "If you do not have an open Command token for the Unit to occupy, you must disband one of your Units or forfeit the reward."

## Key Rules

1. **Disbanding is tied to gaining a unit** - Cannot disband arbitrarily to free up a slot
2. **Mandatory when gaining** - If recruiting and slots are full, must disband (or forfeit if reward)
3. **Removed from game** - Disbanded units are gone forever, NOT returned to deck
4. **Any unit can be disbanded** - Spent, wounded, ready - state doesn't matter
5. **Attached Banner** - Goes to discard pile (line 247) - not yet relevant since banners not implemented

## Current Behavior

- When at command limit (e.g., 1/1), `canAfford` is `false` even if player has enough influence
- UI shows "Need X Influence" but the real blocker is command tokens
- No way to disband and recruit

## Proposed Solution

### Server Changes

1. **Update `getUnitOptions`** in `validActions/units.ts`:
   - Add `requiresDisband: boolean` field to `RecruitableUnit`
   - Set `canAfford = true` if player has influence, regardless of command slots
   - Set `requiresDisband = true` if at command limit

2. **Modify recruit flow**:
   - Add `disbandUnitInstanceId?: string` to `RecruitUnitAction`
   - If recruiting at command limit without disband ID, reject
   - If disband ID provided, remove that unit from game before adding new one

3. **Add validation** in `unitValidators.ts`:
   - Verify disband target exists and belongs to player
   - Remove unit permanently (not to deck)

### Client Changes

1. **Update UnitOfferPanel**:
   - When `requiresDisband` is true, show "Recruit (requires disband)" or similar
   - Clicking recruit opens a selection UI for which unit to disband

2. **Add DisbandSelectionOverlay** or integrate into existing choice system:
   - Show player's units
   - Player selects one to disband
   - Confirm and proceed with recruitment

### Alternative: Choice System

Could use existing `PendingChoice` mechanism:
1. Player clicks recruit at command limit
2. Server returns `ChoiceRequiredEvent` with disband options
3. Player resolves choice
4. Server completes recruitment

## Out of Scope

- Combat reward disbanding (line 868) - separate ticket
- Banner handling - banners not implemented yet
- Voluntary disbanding outside recruitment - rules don't allow this

## Files to Modify

- `packages/core/src/engine/validActions/units.ts`
- `packages/core/src/engine/commands/units/recruitUnitCommand.ts`
- `packages/core/src/engine/validators/unitValidators.ts`
- `packages/shared/src/actions.ts` (add `disbandUnitInstanceId` field)
- `packages/shared/src/types/validActions.ts` (add `requiresDisband` field)
- `packages/client/src/components/Offers/UnitOfferPanel.tsx`

## Priority

Medium - Affects edge case of being at command limit and wanting different units

## Related

- Unit recruitment system (Done)
- OwnedUnitsPanel (Done)
- Combat rewards (Not Started)
- [unit-combat-integration.md](unit-combat-integration.md) - Broader unit combat features
