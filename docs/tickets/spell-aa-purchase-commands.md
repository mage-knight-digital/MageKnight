# Spell and Advanced Action Purchase Commands

## Status: COMPLETED

## Summary

Implemented backend commands for purchasing spells and learning advanced actions according to Mage Knight rules.

## What Was Implemented

### BUY_SPELL Command
- Purchase spells at **conquered Mage Towers only**
- Costs **7 influence** (not mana)
- Spell goes to player's discard pile
- Counts as the player's action for the turn

### LEARN_ADVANCED_ACTION Command
Two acquisition paths:

1. **Monastery Purchase** (`fromMonastery: true`)
   - Buy from AA offer at monasteries
   - Costs **6 influence**
   - Card goes to discard pile
   - Counts as action

2. **Level-Up Reward** (`fromMonastery: false`)
   - Select from AA offer during level-up
   - No influence cost
   - Requires pending AA reward
   - Card goes to **top of deed deck** (drawn next round)

### Validators Added
- `validateAtSpellSite` - Mage Tower only
- `validateAtMonasteryForAA` - Monastery only
- `validateHasInfluenceForSpell` - 7 influence check
- `validateHasInfluenceForMonasteryAA` - 6 influence check
- `validateInLevelUpContext` - Has pending AA reward
- `validateCardInSpellOffer` / `validateCardInAAOffer`

### Validation Codes Added
- `INSUFFICIENT_INFLUENCE_FOR_SPELL`
- `INSUFFICIENT_INFLUENCE_FOR_AA`
- `NOT_IN_LEVEL_UP_CONTEXT`
- `NOT_AT_MAGE_TOWER`
- `NOT_AT_MONASTERY`
- `CARD_NOT_IN_SPELL_OFFER`
- `CARD_NOT_IN_AA_OFFER`

## Tests

20 tests covering:
- Spell purchase at Mage Tower (success/failure cases)
- Monastery AA purchase (success/failure cases)
- Level-up AA selection (success/failure cases)
- Influence validation
- Site type validation
- Pending reward validation

## What's NOT Implemented (See offer-view-design.md)

- UI for offer views (the whole Inscryption-style tray design)
- Navigation to offer view (W/S keys)
- Carousel for Units/Spells/AAs
- Card rotation animations
- ValidActions integration for enabling/disabling purchase buttons

## Related Files

- `packages/core/src/engine/commands/buySpellCommand.ts`
- `packages/core/src/engine/commands/learnAdvancedActionCommand.ts`
- `packages/core/src/engine/validators/offerValidators.ts`
- `packages/core/src/engine/__tests__/spellAndAdvancedAction.test.ts`
