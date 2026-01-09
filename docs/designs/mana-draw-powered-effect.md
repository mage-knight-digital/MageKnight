# Design: Mana Draw Powered Effect

**Status:** Approved for Implementation
**Date:** January 2026
**Contributors:** Claude Sub-Agent, GPT-5.2, Gemini 3 Pro (design review)

## Overview

Implement the powered effect for the Mana Draw card:

> "Take a mana die from the Source and set it to any color except gold. Gain two mana tokens of that color. Do not reroll this die when you return it to the Source."

## Key Insight: "No Reroll" Timing

The "do not reroll" refers to the **end-of-turn** reroll, NOT the round-end reroll:

1. Play Mana Draw powered
2. Take a die from source, set it to chosen color
3. Gain 2 mana tokens of that color
4. Die is returned to source immediately with new color
5. **End of turn**: This die is NOT rerolled (unlike normal die usage)
6. **End of round**: ALL dice reroll normally (including this one)

**Implementation insight**: Since the die is returned immediately and we don't set `player.usedDieId`, there's nothing to reroll at turn end. No special flag needed!

## Effect Type Design

Use **three effect types** following the existing `EFFECT_CARD_BOOST` pattern:

```typescript
// Entry point effect (used in card definition)
export const EFFECT_MANA_DRAW_POWERED = "mana_draw_powered" as const;

// Internal: Player has selected which die to take
export const EFFECT_MANA_DRAW_PICK_DIE = "mana_draw_pick_die" as const;

// Internal: Final resolution with die and color chosen
export const EFFECT_MANA_DRAW_SET_COLOR = "mana_draw_set_color" as const;
```

### Interfaces

```typescript
/**
 * Mana Draw powered effect entry point.
 * Triggers die selection from the source.
 */
export interface ManaDrawPoweredEffect {
  readonly type: typeof EFFECT_MANA_DRAW_POWERED;
}

/**
 * Internal: Player selected a die. Triggers color selection.
 */
export interface ManaDrawPickDieEffect {
  readonly type: typeof EFFECT_MANA_DRAW_PICK_DIE;
  readonly dieId: string;
}

/**
 * Internal: Final resolution - set die color and gain mana tokens.
 */
export interface ManaDrawSetColorEffect {
  readonly type: typeof EFFECT_MANA_DRAW_SET_COLOR;
  readonly dieId: string;
  readonly color: BasicManaColor; // red, blue, green, white only (no gold, no black)
}
```

## State Changes

### No Changes Needed to SourceDie!

The die is returned immediately with its new color. Since we don't track it in `player.usedDieId`, it won't be rerolled at turn end. Round end rerolls everything normally.

The existing `SourceDie` interface is sufficient:
```typescript
export interface SourceDie {
  readonly id: string;
  readonly color: ManaColor;
  readonly isDepleted: boolean;
  readonly takenByPlayerId: string | null;
}
```

## Resolution Flow

### Step 1: EFFECT_MANA_DRAW_POWERED

1. Compute selectable dice: `source.dice.filter(d => d.takenByPlayerId === null)`
2. Outcomes:
   - **0 dice**: Return no-op with description "No dice available in the Source"
   - **1 die**: Auto-select, skip to Step 2 (return color choice options)
   - **N dice**: Return `requiresChoice: true` with `dynamicChoiceOptions` containing one `EFFECT_MANA_DRAW_PICK_DIE` per available die

### Step 2: EFFECT_MANA_DRAW_PICK_DIE

1. Validate the die is still available
2. Return `requiresChoice: true` with `dynamicChoiceOptions` containing 4 options:
   - `EFFECT_MANA_DRAW_SET_COLOR { dieId, color: "red" }`
   - `EFFECT_MANA_DRAW_SET_COLOR { dieId, color: "blue" }`
   - `EFFECT_MANA_DRAW_SET_COLOR { dieId, color: "green" }`
   - `EFFECT_MANA_DRAW_SET_COLOR { dieId, color: "white" }`

### Step 3: EFFECT_MANA_DRAW_SET_COLOR

1. Update the die in `state.source.dice`:
   - `color` = chosen color
   - `isDepleted` = false (basic colors are never depleted)
   - `takenByPlayerId` = null (returned immediately - available to others)
2. Add 2 mana tokens of chosen color to player's `manaTokens`
3. Do NOT set `player.usedDieId` (prevents end-of-turn reroll)
4. Return updated state with description "Set die to {color}, gained 2 {color} mana"

## Edge Cases

| Case | Handling |
|------|----------|
| No dice in source | `isEffectResolvable` returns false |
| All dice taken by other players | Filter them out; if none remain, not resolvable |
| Multiple Mana Draw powered in same turn | Each targets a different die; works naturally |
| Same die used for normal mana + Mana Draw | The normal usage sets `usedDieId`, Mana Draw doesn't interfere |

## Effect Descriptions (for UI)

```typescript
case EFFECT_MANA_DRAW_POWERED:
  return "Take a die from Source, set its color, gain 2 mana";

case EFFECT_MANA_DRAW_PICK_DIE:
  return `Take the ${dieColor} die`;

case EFFECT_MANA_DRAW_SET_COLOR:
  return `Set die to ${color}, gain 2 ${color} mana`;
```

## Implementation Checklist

1. [x] Add constants to `packages/core/src/types/effectTypes.ts`
2. [x] ~~Add `lockedUntilRoundEnd` to `SourceDie`~~ NOT NEEDED
3. [ ] Add effect interfaces to `packages/core/src/types/cards.ts`
4. [ ] Implement resolution in `packages/core/src/engine/effects/resolveEffect.ts`
5. [ ] Add descriptions in `packages/core/src/engine/effects/describeEffect.ts`
6. [ ] Update Mana Draw card definition in `packages/core/src/data/basicActions.ts`
7. [ ] Write tests in `packages/core/src/engine/__tests__/manaDrawPowered.test.ts`
8. [ ] Run full test suite and lint

## Files to Modify

- `packages/core/src/types/effectTypes.ts` - Add 3 new constants ✅
- `packages/core/src/types/cards.ts` - Add 3 new interfaces, update CardEffect union
- `packages/core/src/engine/effects/resolveEffect.ts` - Main implementation
- `packages/core/src/engine/effects/describeEffect.ts` - Effect descriptions
- `packages/core/src/data/basicActions.ts` - Update card definition
- `packages/core/src/engine/__tests__/manaDrawPowered.test.ts` - New test file
