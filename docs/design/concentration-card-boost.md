# Design: Concentration Card Boost Effect

## Overview
Implementation design for Concentration's powered effect: "Play another Action card with this. Get its strong (powered) effect for free. If the effect is Move, Influence, Block, or Attack, get +2."

This design was created by comparing proposals from three AI models and combining the best ideas.

## Core Approach
- **New effect type** `EFFECT_CARD_BOOST` for the card definition
- **Reuse choice system** to select which card to boost (no new action type)
- **Effect transformation** to apply +2 bonus before resolution (no modifier pollution)
- **Fix choice chaining** so boosted cards with choices work correctly

## Data Model Changes

### 1. New Effect Type Constant (`effectTypes.ts`)
```typescript
export const EFFECT_CARD_BOOST = "card_boost" as const;
```

### 2. New Effect Interface (`cards.ts`)
```typescript
export interface CardBoostEffect {
  readonly type: typeof EFFECT_CARD_BOOST;
  readonly bonus: number;  // +2 for Concentration, +3 for Will Focus
}
```

### 3. Internal Effect for Choice Options
```typescript
// Used internally by resolveEffect for dynamic choice generation
interface ResolveBoostTargetEffect {
  readonly type: "resolve_boost_target";
  readonly targetCardId: CardId;
  readonly bonus: number;
}
```

### 4. Extend EffectResolutionResult
```typescript
interface EffectResolutionResult {
  // existing...
  readonly state: GameState;
  readonly description: string;
  readonly requiresChoice?: boolean;
  // new - allows effects to generate dynamic choices
  readonly dynamicChoiceOptions?: readonly CardEffect[];
}
```

## Flow

1. **Player plays Concentration powered** (with green mana)
2. **Effect resolution** detects `EFFECT_CARD_BOOST`:
   - Scans hand for eligible Action cards
   - Returns `requiresChoice: true` with `dynamicChoiceOptions` containing one `ResolveBoostTargetEffect` per eligible card
3. **Engine** sets `player.pendingChoice` with these options, emits `CHOICE_REQUIRED`
4. **Player** sends `ResolveChoiceAction` selecting which card
5. **Choice resolution** executes `ResolveBoostTargetEffect`:
   - Moves target card from hand → playArea
   - Gets target card's `poweredEffect`
   - Applies `addBonusToEffect(poweredEffect, +2)`
   - Resolves the boosted effect
6. **If boosted effect is a choice**, set another `pendingChoice` (choice chaining fix)

## Bonus Application (Pure Function)

```typescript
function addBonusToEffect(effect: CardEffect, bonus: number): CardEffect {
  switch (effect.type) {
    case EFFECT_GAIN_MOVE:
    case EFFECT_GAIN_INFLUENCE:
    case EFFECT_GAIN_ATTACK:
    case EFFECT_GAIN_BLOCK:
      return { ...effect, amount: effect.amount + bonus };
    case EFFECT_CHOICE:
      return { ...effect, options: effect.options.map(e => addBonusToEffect(e, bonus)) };
    case EFFECT_COMPOUND:
      return { ...effect, effects: effect.effects.map(e => addBonusToEffect(e, bonus)) };
    case EFFECT_CONDITIONAL:
      return {
        ...effect,
        thenEffect: addBonusToEffect(effect.thenEffect, bonus),
        elseEffect: effect.elseEffect ? addBonusToEffect(effect.elseEffect, bonus) : undefined,
      };
    case EFFECT_SCALING:
      return { ...effect, baseEffect: addBonusToEffect(effect.baseEffect, bonus) };
    default:
      return effect; // Other effects (heal, draw, mana) unchanged
  }
}
```

## Card Definitions

```typescript
[CARD_CONCENTRATION]: {
  id: CARD_CONCENTRATION,
  name: "Concentration",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CARD_CATEGORY_SPECIAL],
  basicEffect: choice(gainMana(MANA_BLUE), gainMana(MANA_WHITE), gainMana(MANA_RED)),
  poweredEffect: { type: EFFECT_CARD_BOOST, bonus: 2 },
  sidewaysValue: 1,
},

[CARD_GOLDYX_WILL_FOCUS]: {
  // ...
  poweredEffect: { type: EFFECT_CARD_BOOST, bonus: 3 },
},
```

## Files to Modify

1. `packages/core/src/types/effectTypes.ts` - Add `EFFECT_CARD_BOOST` constant
2. `packages/core/src/types/cards.ts` - Add `CardBoostEffect` interface, extend `CardEffect` union
3. `packages/core/src/engine/effects/resolveEffect.ts` - Handle new effect type, add `addBonusToEffect` transformer
4. `packages/core/src/data/basicActions.ts` - Update Concentration (and Will Focus) definition
5. `packages/core/src/engine/commands/resolveChoiceCommand.ts` - Fix choice chaining
6. `packages/core/src/engine/commands/playCardCommand.ts` - Handle `dynamicChoiceOptions` in result

## Eligible Cards for Boosting

Action cards that can be boosted:
- Basic Action cards (except Wounds)
- Advanced Action cards

NOT eligible:
- Wounds (can't be played)
- Spells (per card text: "another Action card")
- Artifacts (not Action cards)

## Risks & Tradeoffs

1. **Choice chaining** - If boosted card's powered effect is itself a choice, we need to support nested `pendingChoice`. This requires fixing `resolveChoiceCommand` to propagate choices.

2. **Undo complexity** - Undoing choice resolution when the boosted card had side effects (like draws) may need checkpoint markers.

3. **Combat phase restrictions** - If played during combat, only cards valid for current phase should be eligible.

4. **Effect type coverage** - Bonus only applies to Move/Influence/Attack/Block. Other effects (heal, draw, mana gain) pass through unchanged, which matches the card rules.

## Design Alternatives Considered

### Alternative A: Modifier-based (Gemini)
Use `RULE_FREE_POWERED_PLAY` + `EFFECT_ACTION_BONUS` modifiers.
- **Pro**: Simpler, reuses existing systems
- **Con**: Doesn't enforce "play together" timing, spreads bonus logic across multiple functions
- **Rejected**: Timing hole is problematic

### Alternative B: New Action Type (Sonnet)
Create `PlayBoostedCardAction` and `pendingBoost` state.
- **Pro**: Very explicit, clean separation
- **Con**: More surface area (new action, new event, new state field)
- **Rejected**: Choice system reuse is cleaner

### Alternative C: This Design (Hybrid)
Reuse choice system with dynamic options + effect transformation.
- **Pro**: Minimal new types, enforces timing, clean bonus application
- **Con**: Needs choice chaining fix
- **Selected**: Best balance of simplicity and correctness

---

*Design doc created: 2026-01-07*
*Status: Ready for implementation*
