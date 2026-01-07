# Unit Combat Integration

## Summary

Units can be recruited but cannot yet be used in combat. This ticket tracks all remaining unit functionality needed for full combat integration.

## Current State

**Working:**
- Unit definitions (all 27 units with abilities, stats, recruit sites)
- Unit deck initialization and offer population
- Unit recruitment at valid sites (Village, Monastery, Keep, Mage Tower, City)
- Site-type filtering (only matching units shown)
- Reputation cost modifier
- Influence deduction on recruit
- Unit removed from offer (offer does NOT replenish until round end)
- Undo support for recruitment
- Round refresh of unit offer (Elite/Regular alternating after core tile revealed)

**Not Working:**
- No UI to display owned units
- No combat usage

## Tasks

### 1. UI: Display Owned Units
- Add panel showing player's recruited units
- Show unit state (ready/spent/wounded)
- Show abilities and stats

### 2. Combat: Unit Activation
- Activate unit ability during combat (Attack, Block, Ranged, Siege)
- Mark unit as "spent" after activation
- Validate ability matches current combat phase
- Handle elemental abilities

### 3. Combat: Damage Assignment to Units
- UI for player to choose: damage to hero vs unit
- Unit armor reduces incoming damage
- Resistant units double armor vs matching element
- Track wounds on units

### 4. Combat: Unit Wounding
- First wound: unit becomes "wounded" (still usable)
- Second wound: unit destroyed
- Poison ability: 2 wounds from single poison attack = destroyed
- Paralyze ability: any wound = immediately destroyed

### 5. Combat: Passive Abilities
- Swift units: attack before block phase
- Brutal units: deal double damage when attacking
- Poison units: wounds go to hand AND discard (hero) or 2 wounds (unit)
- Paralyze units: discard non-wound cards (hero) or destroy (unit)

### 6. Unit Management
- Command token limit enforcement (can't recruit if at max for level)
- **See [unit-disbanding.md](unit-disbanding.md)** for detailed disband-on-recruit implementation

### 7. Unit Healing
- Target unit with healing effect (vs hero)
- Remove wounded status from unit
- Healing at inhabited sites can target units

### 8. Ready at Round End
- All units (including wounded) become ready at round start
- Already implemented in `endRoundCommand.ts`

### 9. Special Unit Abilities
These units have custom abilities not covered by standard Attack/Block:
- **Magic Familiars** - Custom mana generation ability
- **Sorcerers** - Custom spell-like ability
- **Delphana Masters** - Custom ability
- **Altem Mages** - Tiered mana payment for Cold Fire attack

## Files to Modify

- `packages/core/src/engine/validActions/units.ts` - Add `activatable` units logic
- `packages/core/src/engine/commands/units/activateUnitCommand.ts` - Enhance activation
- `packages/core/src/engine/commands/combat/assignDamageCommand.ts` - Unit targeting
- `packages/core/src/types/unit.ts` - State management
- `packages/client/src/components/` - New owned units panel

## Acceptance Criteria

- [ ] Player can see their recruited units in UI
- [ ] Player can activate unit abilities during combat
- [ ] Player can assign damage to units instead of hero
- [ ] Units properly wound and get destroyed
- [ ] Command token limit prevents over-recruiting
- [ ] Wounded units can still be used
- [ ] All units ready at round start

## Priority

Medium - Units are optional for First Reconnaissance but important for Full Conquest scenarios.

## Related

- Unit definitions: `packages/shared/src/units.ts`
- Unit deck setup: `packages/core/src/data/unitDeckSetup.ts`
- Recruit command: `packages/core/src/engine/commands/units/recruitUnitCommand.ts`
