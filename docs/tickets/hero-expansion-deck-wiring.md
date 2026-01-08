# Hero Selection and Expansion-Aware Starting Decks

## Summary

Wire up the expansion system to properly control hero availability and starting deck composition based on `ScenarioConfig.enabledExpansions`.

## Current State

- `ExpansionId` type exists with `lost_legion`, `krang`, `shades_of_tezla`
- `ScenarioConfig.enabledExpansions` array is in place
- Hero definitions exist with base game card replacements only
- Standard 16-card starting deck is defined

## Expansion Modularity

Expansions are designed to be modular. Most components can be mixed and matched independently:

### Lost Legion - Modular Components
- **Wolfhawk hero** - "Treat Wolfhawk as any other hero in the game"
- **Second unique cards for base heroes** - Can be used independently
- **New Advanced Actions, Spells, Artifacts** - "just get shuffled into the original decks"
- **New map tiles** - "just add to the original piles"
- **New enemy tokens** - "just add to the corresponding piles"
- **Cooperative Skills** - can replace competitive skills in any cooperative/solo game
- **Volkare** - Can be used in any scenario with cities via "Volkare's Camp in Place of a City" variant

### Krang Expansion - Modular Components
- **Krang hero** - Standalone character, fully modular

### Shades of Tezla - Modular Components
- **Braevalar hero** - Standalone character, fully modular

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

## Future Considerations

Since expansions are modular, we may want finer-grained control:
- Toggle individual components (e.g., use Lost Legion cards but not Volkare)
- Could evolve `enabledExpansions` into a more granular module system
- For now, enabling an expansion enables all its modular components

## Notes

- First Reconnaissance uses `enabledExpansions: []` (base game only)
- Full Conquest stub uses all expansions for testing
- The UI will eventually need to show which heroes are available based on config
