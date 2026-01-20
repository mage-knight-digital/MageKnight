# Design: Adding New Card Effects

**Status:** Reference Documentation
**Date:** January 2026
**Purpose:** Comprehensive guide for adding new card effect types to the engine

## Overview

This document describes the complete flow for adding a new card effect type to the Mage Knight engine. It covers all the integration points that must be updated to ensure the effect works correctly in all contexts: card playability, effect resolution, undo support, UI display, and testing.

**Why this matters:** Missing any integration point can cause subtle bugs where cards appear unplayable, effects don't resolve, or undo breaks. This document serves as a checklist to prevent such issues.

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT FLOW                                        │
│                                                                              │
│  Client sends PlayerAction (PLAY_CARD) → Server validates → Command created │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VALID ACTIONS LAYER                                  │
│                                                                              │
│  getValidActions() → getPlayableCardsForNormalTurn() / getPlayableCards... │
│                                    │                                         │
│                      ┌─────────────┴─────────────┐                          │
│                      │                           │                           │
│              effectHas*() checks          isEffectResolvable()              │
│         "Does effect type match?"     "Can effect actually execute?"        │
│                      │                           │                           │
│                      └─────────────┬─────────────┘                          │
│                                    │                                         │
│                     Both must return true for card to be playable           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMMAND LAYER                                      │
│                                                                              │
│  playCardCommand.execute() → resolveEffect() → state changes + events       │
│                                    │                                         │
│                              (may require choices)                           │
│                                    │                                         │
│  playCardCommand.undo()   → reverseEffect() → restore previous state        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             UI LAYER                                         │
│                                                                              │
│  describeEffect() → Human-readable description for events/choices           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## The Two-Gate System: effectHas*() and isEffectResolvable()

Understanding this is **critical**. A card effect must pass two independent checks to be playable:

### Gate 1: `effectHas*()` Functions

**Location:** `packages/core/src/engine/validActions/cards.ts`

**Purpose:** Determine if an effect TYPE is relevant for the current context (normal turn, combat phase, etc.)

**How it works:**
```typescript
// For normal turns, these check if the effect is "useful"
const poweredHasUsefulEffect =
  effectHasMove(card.poweredEffect) ||
  effectHasInfluence(card.poweredEffect) ||
  effectHasHeal(card.poweredEffect) ||
  effectHasDraw(card.poweredEffect) ||
  effectHasManaGain(card.poweredEffect) ||
  effectHasModifier(card.poweredEffect) ||
  effectHasManaDrawPowered(card.poweredEffect);
```

Each `effectHas*()` function recursively checks the effect and any nested effects (choice, compound, conditional, scaling).

**CRITICAL:** If you add a new effect type, you must either:
1. Add a new `effectHas*()` function and include it in the playability check, OR
2. Ensure an existing `effectHas*()` function covers your new effect type

### Gate 2: `isEffectResolvable()`

**Location:** `packages/core/src/engine/effects/resolveEffect.ts`

**Purpose:** Determine if the effect can actually DO something given the current game state

**Examples:**
- `EFFECT_DRAW_CARDS`: Only resolvable if `player.deck.length > 0`
- `EFFECT_GAIN_HEALING`: Only resolvable if player has wounds in hand or wounded units
- `EFFECT_MANA_DRAW_POWERED`: Only resolvable if there are available dice in source

**CRITICAL:** If your effect has state-dependent conditions, you must add a case in `isEffectResolvable()`.

### Common Bug: Passing Gate 2 but Failing Gate 1

This was the bug with Mana Draw powered effect (fixed January 2026):

```typescript
// isEffectResolvable() had the correct check (Gate 2 passed):
case EFFECT_MANA_DRAW_POWERED: {
  const availableDice = state.source.dice.filter(d => d.takenByPlayerId === null);
  return availableDice.length > 0;
}

// But effectHas*() checks didn't include it (Gate 1 failed):
const poweredHasUsefulEffect =
  effectHasMove(...) ||
  effectHasInfluence(...) ||
  // ... NO effectHasManaDrawPowered()!  <-- BUG: Missing check
```

Result: The effect was "resolvable" but never considered "useful", so the card never appeared as playable.

**Fix:** Added `effectHasManaDrawPowered()` function and included it in the playability check (see `cards.ts:536-557`). This document exists to prevent similar bugs in the future.

## Step-by-Step Checklist for Adding a New Effect

### Step 1: Define the Effect Type Constant

**File:** `packages/core/src/types/effectTypes.ts`

```typescript
// Add the constant with proper typing
export const EFFECT_MY_NEW_EFFECT = "my_new_effect" as const;
```

### Step 2: Define the Effect Interface

**File:** `packages/core/src/types/cards.ts`

```typescript
export interface MyNewEffect {
  readonly type: typeof EFFECT_MY_NEW_EFFECT;
  // Add any parameters the effect needs
  readonly amount: number;
  readonly targetType: "unit" | "player";
}
```

Then add it to the `CardEffect` union:

```typescript
export type CardEffect =
  | GainMoveEffect
  | GainInfluenceEffect
  // ... existing effects ...
  | MyNewEffect;  // <-- Add here
```

### Step 3: Add effectHas*() Function (if needed)

**File:** `packages/core/src/engine/validActions/cards.ts`

If your effect represents a new category of action (not covered by existing checks), add a helper:

```typescript
/**
 * Check if an effect is/contains your new effect type.
 */
function effectHasMyNewEffect(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_MY_NEW_EFFECT:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasMyNewEffect(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasMyNewEffect(eff));

    case EFFECT_CONDITIONAL:
      return effectHasMyNewEffect(effect.thenEffect) ||
        (effect.elseEffect ? effectHasMyNewEffect(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasMyNewEffect(effect.baseEffect);

    default:
      return false;
  }
}
```

Then add it to the appropriate playability check:

```typescript
// In getCardPlayabilityForNormalTurn():
const poweredHasUsefulEffect =
  effectHasMove(card.poweredEffect) ||
  // ... existing checks ...
  effectHasMyNewEffect(card.poweredEffect);  // <-- Add here

// In getCardPlayabilityForPhase() if relevant for combat
```

### Step 4: Add isEffectResolvable() Case

**File:** `packages/core/src/engine/effects/resolveEffect.ts`

```typescript
case EFFECT_MY_NEW_EFFECT: {
  // Return true if the effect can actually do something
  // Example: check if targets exist, resources available, etc.
  const targets = findValidTargets(state, playerId, effect);
  return targets.length > 0;
}
```

**Note:** If your effect is always resolvable (like `EFFECT_GAIN_MOVE`), you can add it to the "always resolvable" case list or let it fall through to the default `return true`.

### Step 5: Implement resolveEffect() Case

**File:** `packages/core/src/engine/effects/resolveEffect.ts`

```typescript
case EFFECT_MY_NEW_EFFECT: {
  // Implement the actual effect logic
  // Return EffectResolutionResult with:
  // - state: the updated GameState
  // - description: human-readable result
  // - requiresChoice?: true if player needs to make a selection
  // - dynamicChoiceOptions?: array of effect options for choice

  const newState = applyMyNewEffect(state, playerIndex, player, effect);
  return {
    state: newState,
    description: `Applied ${effect.type} effect`,
  };
}
```

### Step 6: Add reverseEffect() Case (for undo support)

**File:** `packages/core/src/engine/effects/resolveEffect.ts`

```typescript
case EFFECT_MY_NEW_EFFECT:
  // If reversible, implement the undo logic
  return {
    ...player,
    someProperty: player.someProperty - effect.amount,
  };

  // If NOT reversible (reveals hidden info, random, etc.):
  // Return player unchanged and mark command as non-reversible
```

**CRITICAL:** This applies to ALL effect types that can be resolved, including:
- **Entry effects** (the ones used in card definitions)
- **Intermediate effects** (internal effects used in multi-step choice chains)
- **Final effects** (the effect that actually applies the result)

For example, `EFFECT_CRYSTALLIZE_COLOR` is an internal effect that consumes a mana token and grants a crystal. Even though it's never used directly in card definitions, it MUST have a `reverseEffect()` case because it's the effect that actually modifies player state.

**What to reverse:**
- Undo ALL state changes the effect made
- If the effect consumed resources AND granted something, reverse BOTH:
  ```typescript
  case EFFECT_CRYSTALLIZE_COLOR:
    // Reverse crystallize: remove the crystal AND restore the mana token
    return {
      ...player,
      crystals: {
        ...player.crystals,
        [effect.color]: Math.max(0, player.crystals[effect.color] - 1),
      },
      pureMana: [...player.pureMana, { color: effect.color, source: "card" as const }],
    };
  ```

**When NOT to make an effect reversible:**

Effects should NOT be reversible (return player unchanged, and ensure command sets `isReversible: false`) when they:
- **Reveal hidden information** (drawing cards shows deck contents, revealing tiles)
- **Involve randomness** (rolling dice - the outcome can't be "un-rolled")
- **Affect other players** (can't undo something that changed their state)
- **Have side effects outside player state** (modifying shared game state like the source)

For non-reversible effects, the command system handles this by creating checkpoints. See `CHECKPOINT_REASON_CARD_DRAWN` for an example.

### Step 7: Add Effect Description

**File:** `packages/core/src/engine/effects/describeEffect.ts`

```typescript
case EFFECT_MY_NEW_EFFECT:
  return `Do something with amount ${effect.amount}`;
```

### Step 8: Use the Effect in Card Definitions

**File:** `packages/core/src/data/basicActions.ts` or `advancedActions.ts`

```typescript
[CARD_MY_CARD]: {
  id: CARD_MY_CARD,
  name: "My Card",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CARD_CATEGORY_SPECIAL],
  basicEffect: { type: EFFECT_MY_NEW_EFFECT, amount: 2 },
  poweredEffect: { type: EFFECT_MY_NEW_EFFECT, amount: 4 },
  sidewaysValue: 1,
},
```

### Step 9: Write Tests

**File:** `packages/core/src/engine/__tests__/myNewEffect.test.ts`

Test all scenarios:
1. Effect appears in playable cards when resolvable
2. Effect does NOT appear when not resolvable
3. Effect resolves correctly
4. Effect undo works (if reversible)
5. Effect choice flow works (if multi-step)

### Step 10: Build and Test

```bash
pnpm build && pnpm lint && pnpm test
```

## Complete Integration Point Checklist

Use this checklist when adding ANY new effect type:

```
[ ] 1. effectTypes.ts - Add constant (EFFECT_MY_NEW_EFFECT)
[ ] 2. cards.ts - Add interface (MyNewEffectInterface)
[ ] 3. cards.ts - Add to CardEffect union type
[ ] 4. validActions/cards.ts - Add effectHas*() function (if new category)
[ ] 5. validActions/cards.ts - Add to playability checks (basic AND powered)
[ ] 6. resolveEffect.ts - Add isEffectResolvable() case
[ ] 7. resolveEffect.ts - Add resolveEffect() case
[ ] 8. resolveEffect.ts - Add reverseEffect() case (or mark non-reversible)
[ ] 9. describeEffect.ts - Add description case
[ ] 10. Card definition file - Use effect in actual card
[ ] 11. Tests - Write comprehensive tests
[ ] 12. Build - Run pnpm build && pnpm lint && pnpm test
```

## Multi-Step Effects (Choice Chains)

Some effects require multiple player choices. Pattern used by `EFFECT_CARD_BOOST`, `EFFECT_MANA_DRAW_POWERED`, and `EFFECT_CONVERT_MANA_TO_CRYSTAL`:

1. **Entry Effect** - The effect type used in card definitions
2. **Intermediate Effects** - Internal effects representing each choice step
3. **Final Effect** - The effect that actually applies the result

Example flow for Mana Draw Powered:
```
EFFECT_MANA_DRAW_POWERED (card plays this)
    → requiresChoice: true, dynamicChoiceOptions: [EFFECT_MANA_DRAW_PICK_DIE for each die]

EFFECT_MANA_DRAW_PICK_DIE (player picks a die)
    → requiresChoice: true, dynamicChoiceOptions: [EFFECT_MANA_DRAW_SET_COLOR for each color]

EFFECT_MANA_DRAW_SET_COLOR (player picks a color)
    → Actually applies: sets die color, grants mana tokens
```

Example flow for Crystallize Basic:
```
EFFECT_CONVERT_MANA_TO_CRYSTAL (card plays this)
    → If only 1 color available: auto-resolve to EFFECT_CRYSTALLIZE_COLOR
    → If multiple colors: requiresChoice: true, dynamicChoiceOptions: [EFFECT_CRYSTALLIZE_COLOR for each color]

EFFECT_CRYSTALLIZE_COLOR (player picks a color OR auto-resolved)
    → Actually applies: removes mana token, grants crystal
```

All intermediate/final effect types need their own:
- Interface in cards.ts
- Case in CardEffect union
- Case in isEffectResolvable() (usually `return true` for internal effects)
- Case in resolveEffect()
- **Case in reverseEffect()** - CRITICAL: the final effect that modifies state MUST be undoable
- Case in describeEffect()

**Common pitfall:** Forgetting `reverseEffect()` for internal effects. The entry effect often just generates choices and doesn't modify state, but the FINAL effect does modify state and needs undo support.

## Common Pitfalls

### 1. Internal Auto-Resolution Without Tracking (The "resolvedEffect" Problem)

**Symptom:** Undo doesn't work correctly after an effect auto-resolves internally. Player keeps resources gained even after undo.

**Root cause:** When `resolveEffect()` internally chains to a different effect (e.g., `EFFECT_CONVERT_MANA_TO_CRYSTAL` auto-resolving to `EFFECT_CRYSTALLIZE_COLOR`), the command layer doesn't know what actually ran. It calls `reverseEffect()` with the original entry effect, which has no undo logic.

**Example bug flow:**
```
1. Card has basicEffect: { type: EFFECT_CONVERT_MANA_TO_CRYSTAL }
2. Command stores appliedEffect = EFFECT_CONVERT_MANA_TO_CRYSTAL
3. resolveEffect() sees only 1 color, internally chains to EFFECT_CRYSTALLIZE_COLOR
4. State changes: mana token removed, crystal gained
5. User clicks undo
6. Command calls reverseEffect(player, EFFECT_CONVERT_MANA_TO_CRYSTAL)
7. reverseEffect has no case for this entry effect → falls through to default → NO-OP!
8. BUG: Crystal stays, card returns to hand = infinite crystal exploit
```

**Solution:** When auto-resolving internally, return `resolvedEffect` in the result:

```typescript
if (availableColors.size === 1) {
  const crystallizeEffect = { type: EFFECT_CRYSTALLIZE_COLOR, color };
  const result = resolveEffect(state, playerId, crystallizeEffect);
  // CRITICAL: Tell command what actually resolved
  return { ...result, resolvedEffect: crystallizeEffect };
}
```

The command layer checks for this and updates `appliedEffect`:
```typescript
if (effectResult.resolvedEffect) {
  appliedEffect = effectResult.resolvedEffect;
}
```

**Key insight:** This bug class occurs when:
1. An entry effect (in card definitions) delegates to an internal effect
2. The delegation happens inside `resolveEffect()` without the command knowing
3. The entry effect has no `reverseEffect()` case (because it doesn't modify state directly)

**Prevention:**
- Always return `resolvedEffect` when internally chaining to a different effect
- OR structure like Mana Draw: always return `requiresChoice: true` with `dynamicChoiceOptions`, letting the command layer handle auto-resolution

### 2. Forgetting effectHas*() Check
**Symptom:** Card doesn't appear as playable even though isEffectResolvable() returns true
**Solution:** Add effectHas*() function and include in playability checks

### 3. Not Handling Nested Effects
**Symptom:** Effect works standalone but not inside choice/compound effects
**Solution:** Ensure effectHas*() recursively checks EFFECT_CHOICE, EFFECT_COMPOUND, EFFECT_CONDITIONAL, EFFECT_SCALING

### 4. Missing Import
**Symptom:** TypeScript error about missing type
**Solution:** Import the constant from effectTypes.ts in all files that use it

### 5. Combat vs Normal Turn Context
**Symptom:** Effect works during normal turn but not in combat (or vice versa)
**Solution:** Effects relevant for combat need checks in `getCardPlayabilityForPhase()` as well as `getCardPlayabilityForNormalTurn()`

### 7. Utility Effects Not Playable in Combat
**Symptom:** Cards with non-combat effects (mana gain, healing, card draw) can't be played during combat phases even though they should always be useful.

**Root cause:** `getCardPlayabilityForPhase()` only checks for combat-specific effects (attack, block, ranged/siege) and ignores "utility" effects.

**Solution:** Use `effectIsUtility()` in combat phase playability checks:

```typescript
// In getCardPlayabilityForPhase():
case COMBAT_PHASE_ATTACK:
  return {
    canPlayBasic: effectHasAttack(card.basicEffect) || effectIsUtility(card.basicEffect),
    canPlayPowered: effectHasAttack(card.poweredEffect) || effectIsUtility(card.poweredEffect),
    // ...
  };
```

**What counts as a utility effect:** Effects that are always useful regardless of combat phase:
- `effectHasManaGain()` - Gaining mana tokens
- `effectHasDraw()` - Drawing cards
- `effectHasHeal()` - Healing wounds
- `effectHasModifier()` - Applying modifiers (like armor)
- `effectHasManaDrawPowered()` - Mana Draw/Pull powered effects
- `effectHasCardBoost()` - Boosting other cards
- `effectHasCrystal()` - Gaining crystals (Crystallize)

**When adding a new effect type:** If your effect is always useful (not combat-phase-specific), add it to the `effectIsUtility()` function so cards with that effect can be played during any combat phase

### 6. Undo Breaks After Effect
**Symptom:** Undo button doesn't work after playing card with new effect
**Solution:** Either implement reverseEffect() properly OR mark the command as non-reversible

## File Reference

| File | Purpose |
|------|---------|
| `packages/core/src/types/effectTypes.ts` | Effect type constants |
| `packages/core/src/types/cards.ts` | Effect interfaces, CardEffect union, DeedCard type |
| `packages/core/src/engine/validActions/cards.ts` | Card playability (effectHas*, getPlayableCards*) |
| `packages/core/src/engine/effects/resolveEffect.ts` | Effect resolution and undo (isEffectResolvable, resolveEffect, reverseEffect) |
| `packages/core/src/engine/effects/describeEffect.ts` | Human-readable effect descriptions |
| `packages/core/src/data/basicActions.ts` | Basic action card definitions |
| `packages/core/src/data/advancedActions.ts` | Advanced action card definitions |
| `packages/core/src/engine/commands/playCardCommand.ts` | Card play command (uses resolveEffect) |

## Related Documents

- `docs/design/mana-draw-powered-effect.md` - Example of a complex multi-step effect
- `CLAUDE.md` - Project conventions and build commands
