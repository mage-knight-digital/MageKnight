# Ticket: Dummy Player for Solo & Cooperative Mode

**Created:** January 2025
**Updated:** January 2025
**Priority:** High
**Complexity:** High
**Status:** Not Started
**Affects:** Game state, turn management, round transitions, deck setup, offer management
**Authoritative:** Yes

---

## Summary

Implement the Dummy Player system for solo and cooperative scenarios. The dummy player is an automated opponent that affects game tempo by consuming cards from a deck and competing for turn order, without actually taking normal game actions.

## Problem Statement

Solo and cooperative scenarios require a dummy player to create time pressure and tactical decisions around turn order. The dummy player:
- Has a deck of basic action cards that depletes over rounds
- Triggers end of round when their deck empties
- Takes a position in turn order based on tactics
- Gains cards from the Advanced Action offer removal
- Gains crystals from the Spell offer removal
- Creates strategic decisions about which cards/colors to let them acquire

Currently, only the tactic selection portion is implemented (`dummyTacticOrder`, `dummyPlayerTactic`). The dummy player has no deck, no inventory, and doesn't actually take turns.

## Current Behavior

Partial infrastructure exists:

**Already implemented:**
- `Hero.crystalColors: [ManaColor, ManaColor, ManaColor]` - starting crystals for dummy player (`packages/core/src/types/hero.ts:55`)
- `ScenarioConfig.dummyTacticOrder` - when dummy selects tactic (`packages/shared/src/scenarios.ts:131`)
- `GameState.dummyPlayerTactic` - stores selected tactic (`packages/core/src/state/GameState.ts:68`)
- Tactic selection logic for `DUMMY_TACTIC_AFTER_HUMANS` mode (`packages/core/src/engine/commands/selectTacticCommand.ts:262`)
- `DUMMY_TACTIC_SELECTED` event (`packages/shared/src/events/tactics/selection.ts`)
- End round resets `dummyPlayerTactic` (`packages/core/src/engine/commands/endRoundCommand.ts:443`)

**Not implemented:**
- DummyPlayer state object (deck, discard, crystals)
- Dummy player turn execution
- Dummy player triggering end of round
- Integration with deck offer removal
- Integration with spell offer removal
- Skill offer integration for solo mode

## Expected Behavior

### Game Setup

1. After players choose heroes, randomly select an unused hero for the dummy player
2. Create dummy player with:
   - That hero's 16-card basic action deck (shuffled)
   - 3 crystals matching the hero's `crystalColors` property
   - No skills initially
3. Dummy player does NOT count toward mana dice or unit calculations

### Tactic Selection

Already partially implemented. Scenarios specify timing via `dummyTacticOrder`:
- `DUMMY_TACTIC_AFTER_HUMANS`: Human selects first, dummy gets random from remaining
- `DUMMY_TACTIC_BEFORE_HUMANS`: Dummy gets random first, then human selects

Dummy does NOT benefit from tactic effects - it only determines turn order position.

### Dummy Player Turn

When it's the dummy player's turn in the turn order:

1. **Check deck**: If deck is empty, announce End of Round
   - Other players get one more turn each
   - Round ends after final turns

2. **Flip cards**: If deck has cards:
   - Flip 3 cards from deck to discard pile
   - Check color of last flipped card (top of discard)
   - If dummy has crystals of that color: flip additional cards equal to crystal count of that color
   - Turn ends (crystal color check does NOT chain)

3. **Partial flips**: If deck has fewer cards than needed, flip all remaining. Next turn triggers End of Round.

### End of Round - Deck Offer Handling

When removing the lowest Advanced Action from the offer:
- Instead of removing to box, add to dummy player's deck
- Shuffle dummy player's deck

### End of Round - Spell Offer Handling

When removing the lowest Spell from the offer:
- Remove to bottom of spell deck (as usual)
- Additionally, add 1 crystal of that spell's color to dummy player's inventory
- Dummy player can have more than 3 crystals of the same color (no limit)

### Skills in Solo Mode (Optional Enhancement)

For solo games using skill tokens:
- Remove dummy hero's competitive interactive skill (⚔️ symbol)
- Randomize remaining skills into face-down pile
- When human gains a skill, also reveal one dummy skill to Common Skill offer
- If human takes skill from Common offer, must also take lowest Advanced Action

## Scope

### In Scope
- DummyPlayer state object with deck, discard, crystals
- Dummy player hero selection during game setup
- Dummy player turn execution (flip cards, check crystals)
- Dummy player end of round trigger
- Integration with Advanced Action offer removal
- Integration with Spell offer removal
- Events for dummy player actions
- Turn order integration (dummy takes turn in sequence)

### Out of Scope
- Volkare/Lost Legion (separate, more complex entity)
- Skills system for dummy player (can be separate ticket)
- UI representation of dummy player (can be separate ticket)
- DUMMY_TACTIC_BEFORE_HUMANS mode (can add later if needed)

## Proposed Approach

### Phase 1: State Structure

Create `DummyPlayer` interface:

```typescript
interface DummyPlayer {
  heroId: HeroId;
  deck: readonly CardId[];
  discard: readonly CardId[];
  crystals: Map<ManaColor, number>; // Color -> count (no max)
}
```

Add to `GameState`:
```typescript
dummyPlayer: DummyPlayer | null;
```

### Phase 2: Game Setup Integration

Modify scenario setup to:
1. Pick random unused hero for dummy player
2. Initialize deck with hero's basic actions
3. Initialize crystals from hero's `crystalColors`

### Phase 3: Turn Order Integration

Modify turn management to:
1. Include dummy player in turn order calculation
2. When `currentPlayerIndex` reaches dummy player's position, execute dummy turn
3. Dummy turn is automated (no player actions)

### Phase 4: Dummy Turn Execution

Create `executeDummyTurnCommand`:
1. Check deck empty → trigger end of round announcement
2. Flip 3 cards (or all remaining)
3. Check last card color, count matching crystals
4. Flip additional cards if crystals match
5. Advance to next player

### Phase 5: Offer Integration

Modify `endRoundCommand`:
1. When removing lowest AA: add to dummy deck, shuffle
2. When removing lowest Spell: add crystal of spell color to dummy

### Phase 6: Events

New events:
- `DUMMY_TURN_STARTED`
- `DUMMY_CARDS_FLIPPED` (cards: CardId[], bonusCards: CardId[], matchingColor: ManaColor | null)
- `DUMMY_END_OF_ROUND_ANNOUNCED`
- `DUMMY_GAINED_CARD` (cardId: CardId)
- `DUMMY_GAINED_CRYSTAL` (color: ManaColor)

## Implementation Notes

### Key Files

**New files:**
- `packages/core/src/types/dummyPlayer.ts` - DummyPlayer interface
- `packages/core/src/engine/commands/executeDummyTurnCommand.ts` - Turn execution

**Modified files:**
- `packages/core/src/state/GameState.ts` - Add dummyPlayer field
- `packages/core/src/engine/commands/startGameCommand.ts` - Setup dummy player
- `packages/core/src/engine/commands/endRoundCommand.ts` - Card/crystal integration
- `packages/core/src/engine/commands/endTurnCommand.ts` - Check if next is dummy
- `packages/shared/src/events/` - New event types

### Turn Order Representation

Options:
1. **Virtual turn index**: Dummy has a turn order position but isn't in `players` array
2. **Entity abstraction**: Abstract `TurnActor` that can be Player or Dummy

Recommend option 1 for simplicity. Store `dummyTurnOrderPosition: number | null` and check when advancing turns.

### RNG Threading

Card flips must use `state.rng`:
```typescript
const { result: flippedCards, rng: newRng } = drawCardsWithRng(
  dummyPlayer.deck,
  count,
  state.rng
);
```

### Relation to Volkare

This is simpler than Volkare (Lost Legion expansion):
- Dummy player doesn't move on map
- Dummy player doesn't fight or interact with sites
- Dummy player has no units, fame, or inventory beyond crystals

The architecture should remain compatible but doesn't need full entity abstraction yet.

## Acceptance Criteria

- [ ] Solo game creates dummy player from random unused hero
- [ ] Dummy player starts with correct 16-card deck
- [ ] Dummy player starts with 3 crystals matching hero colors
- [ ] Dummy player appears in turn order based on tactic
- [ ] Dummy turn flips 3 cards automatically
- [ ] Dummy turn flips bonus cards when last card matches crystal color
- [ ] Dummy announces end of round when deck empties
- [ ] Lowest Advanced Action goes to dummy deck at round end
- [ ] Dummy gains crystal when lowest Spell is removed
- [ ] Appropriate events emitted for all dummy actions
- [ ] Dummy does not count toward mana dice calculation
- [ ] Game functions correctly without dummy player in non-solo scenarios

## Test Plan

### Manual
1. Start solo scenario (First Reconnaissance)
2. Verify dummy player appears with correct hero
3. Complete tactic selection, verify turn order includes dummy
4. When dummy's turn arrives, observe 3 cards flipped
5. If last card matches crystal color, verify bonus flips
6. Play until dummy deck empties, verify end of round triggers
7. Complete round, verify lowest AA goes to dummy deck
8. Verify spell removal gives dummy a crystal

### Automated
- Unit test: Dummy turn with no matching crystals (exactly 3 flips)
- Unit test: Dummy turn with matching crystals (3 + bonus flips)
- Unit test: Dummy turn with partial deck (flip all, next turn announces)
- Unit test: Dummy end of round trigger
- Unit test: AA offer removal adds to dummy deck
- Unit test: Spell offer removal adds crystal
- Integration test: Full round with dummy player turns
- Integration test: Multi-round game with dummy accumulating cards/crystals

## Open Questions

- Should DUMMY_TACTIC_BEFORE_HUMANS mode be implemented? (Rulebook mentions it but unclear which scenarios use it)
- How should the UI represent the dummy player? (Card count, crystal count, current discard top?)
- Should dummy player skills be part of this ticket or separate?

## Related Tickets

- `end-of-round-announcement.md` - End of round mechanics (dummy triggers same flow)
- `volkare-architecture-considerations.md` - Future entity abstraction
- `tactic-scenario-rules.md` - Tactic handling details
