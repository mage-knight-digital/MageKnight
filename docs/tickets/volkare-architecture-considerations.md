# Volkare Architecture Considerations

## Summary

Volkare (from The Lost Legion expansion) is an AI-controlled antagonist that replaces the dummy player in solo/cooperative play. Supporting Volkare requires architectural changes because the current codebase assumes all turn-takers are full `Player` objects.

## What Volkare Is

- **AI-controlled general** with a figure that moves around the map
- **Has an army** (6-11 enemy tokens that follow him, unfortified)
- **Uses a deck** but interprets cards differently (color = direction, spell = 2x movement, red = attack)
- **Has a fortified camp** (special site on the map)
- **Ignores terrain** - moves freely, auto-reveals tiles

## Key Mechanics

### Movement
- Card color determines hex direction (reference card maps colors to directions)
- Actions = 1 hex, Spells = 2 hexes
- Red cards = attack nearest player (actions: adjacent, spells: 2-range)
- Wound cards = rest, but can steal unclaimed units from offer

### Combat
- Players can attack Volkare (fight entire army, unfortified)
- Volkare can attack players (fight all or flee taking wounds based on round: 2/3/4)
- Volkare adds a random attack to every combat

### Phases (Volkare's Return scenario)
1. **Wandering** - random movement until city revealed
2. **Targeting** - beeline to city
3. **Assaulting** - players defend city from his army

## Current Architecture Gaps

### Turn System
- `currentPlayerIndex` indexes into `turnOrder: string[]`
- `validateIsPlayersTurn()` assumes actor is in player array
- **Need**: Support non-player turn actors

### Player Object is Monolithic
- All actors assumed to have `hand`, `deck`, `crystals`, `reputation`, etc.
- **Need**: Lightweight entity interface or abstract actor type

### Combat is Player-Centric
- `CombatState` has no initiator/defender tracking
- Damage targets hardcoded to "hero" or "hero's units"
- **Need**: Track combat participants, support NPC initiators

### Movement Validation
- Validators check `Player.movePoints` and `Player.hero`
- **Need**: Volkare bypasses validation entirely (ignores terrain)

### Position Tracking
- Players have `Player.position`
- Enemies stored in `HexState.enemies[]`
- **Need**: Persistent position for entities that aren't players or enemy tokens

## Recommended Approach

### Minimal Changes Now
When implementing new features, keep these patterns in mind:

1. **Use type aliases for actor IDs** - prefer `ActorId` over hardcoded `PlayerId` where it makes sense
2. **Keep combat state extensible** - consider optional `initiator`/`defender` fields
3. **Don't assume Player object exists** in new validation code without considering entity case

### Future Implementation
When Volkare is implemented:

1. Add `VolkareState` to `GameState` (optional, only for Volkare scenarios)
2. Abstract turn actor concept (`TurnActor = PlayerId | "volkare"`)
3. Add separate `moveVolkare()` that bypasses terrain validation
4. Extend `CombatState` with initiator/defender tracking
5. Gate end-turn cleanup behind entity type check

## Files That Will Need Changes

**High impact:**
- `packages/core/src/state/GameState.ts` - add entity state
- `packages/core/src/engine/validators/turnValidators.ts` - abstract actor check
- `packages/core/src/types/combat.ts` - add initiator/defender

**Medium impact:**
- `packages/core/src/engine/commands/endTurnCommand.ts` - gate player cleanup
- `packages/core/src/engine/validActions/helpers.ts` - handle non-player actors

## Existing Precedent

`GameState.dummyPlayerTactic: TacticId | null` already exists - proof that non-player entity state at game level is viable. Volkare extends this pattern.

## References

- [Volkare's Camp Wiki](https://unofficialmageknighttheboardgame.fandom.com/wiki/Volkare's_Camp)
- [BGG Volkare Rules Discussions](https://boardgamegeek.com/thread/928498/2-volkare-rules-clarifications-end-of-round)
- Lost Legion rulebook (PDF)
