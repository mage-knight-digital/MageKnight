# Hero Selection and Expansion-Aware Starting Decks

## Summary

Wire up the expansion system to properly control hero availability and starting deck composition based on `ScenarioConfig.enabledExpansions`.

## Current State

- `ExpansionId` type exists with `lost_legion`, `krang`, `shades_of_tezla`
- `ScenarioConfig.enabledExpansions` array is in place
- Hero definitions exist with all card replacements pre-applied
- Standard 16-card starting deck is defined

## Requirements

### Hero Availability

Heroes should only be selectable if their required expansion is enabled:

| Hero | Required Expansion |
|------|-------------------|
| Arythea | Base game |
| Goldyx | Base game |
| Norowas | Base game |
| Tovak | Base game |
| Wolfhawk | `lost_legion` |
| Krang | `krang` |
| Braevalar | `shades_of_tezla` |

### Starting Deck Composition

Each hero's starting deck depends on which expansions are enabled:

**Base game only (`enabledExpansions: []`):**
- Standard 16-card deck
- Base hero gets their 1 unique card replacement:
  - Arythea: Battle Versatility replaces Rage
  - Goldyx: Will Focus replaces Concentration
  - Norowas: Noble Manners replaces Promise
  - Tovak: Cold Toughness replaces Determination

**With Lost Legion (`enabledExpansions: ["lost_legion"]`):**
- Base heroes get their expansion card replacement too:
  - Arythea: Mana Pull replaces Mana Draw
  - Goldyx: Crystal Joy replaces Crystallize
  - Norowas: Rejuvenate replaces Tranquility
  - Tovak: Instinct replaces Improvisation
- Wolfhawk available with:
  - Swift Reflexes replaces Swiftness
  - Tirelessness replaces Stamina

**With Krang (`enabledExpansions: ["krang"]`):**
- Krang available with:
  - Savage Harvesting replaces March
  - Ruthless Coercion replaces Threaten

**With Shades of Tezla (`enabledExpansions: ["shades_of_tezla"]`):**
- Braevalar available with:
  - One With the Land replaces March
  - Druidic Paths replaces Stamina

## Implementation Tasks

1. **Create `getAvailableHeroes(enabledExpansions)` function**
   - Returns list of heroes that can be selected given enabled expansions

2. **Create `getStartingDeckForHero(hero, enabledExpansions)` function**
   - Builds the correct starting deck based on hero and enabled expansions
   - Replaces the current pre-built `startingCards` on `HeroDefinition`

3. **Update player creation to use these functions**
   - Find where player deck is initialized
   - Pass `scenarioConfig.enabledExpansions` to deck builder

4. **Add hero selection validation**
   - Reject hero selection if expansion not enabled

5. **Update tests**
   - Test various expansion combinations
   - Verify correct cards in starting decks

## Notes

- First Reconnaissance uses `enabledExpansions: []` (base game only)
- Full Conquest stub uses all expansions for testing
- The UI will eventually need to show which heroes are available based on config
