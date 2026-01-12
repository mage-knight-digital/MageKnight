# Ticket: Auto-Select When Choice is Meaningless

**Created:** January 2025
**Priority:** Low
**Complexity:** Medium
**Affects:** Core engine, Choice resolution
**Status:** Not Started

---

## Problem Statement

When a player is presented with a choice that has an objectively better option, the game should auto-select it instead of making the player click through a meaningless choice.

**Example:** Playing Tremor spell with 1 enemy in combat:
- Option 1: "Target enemy gets Armor -3"
- Option 2: "All enemies get Armor -2"

With only 1 enemy, "-3 to one" is strictly better than "-2 to all" - there's no strategic decision to make.

---

## Current Behavior

1. Player plays Tremor
2. Player sees choice: "Target enemy -3" vs "All enemies -2"
3. Player must click to select option 0
4. Player sees enemy selection (only 1 enemy)
5. Player must click to select the enemy
6. Effect is applied

**Total clicks:** 3 (play card, select option, select enemy)

---

## Expected Behavior

1. Player plays Tremor
2. System detects: only 1 enemy, option 0 is strictly better
3. System auto-selects option 0
4. System auto-selects the only enemy
5. Effect is applied

**Total clicks:** 1 (play card)

---

## Scenarios to Handle

| Scenario | Auto-Select? | Reason |
|----------|--------------|--------|
| 1 enemy, "-3 to one" vs "-2 to all" | Yes | -3 > -2 for same target |
| 2+ enemies, "-3 to one" vs "-2 to all" | No | Strategic choice: focus vs spread |
| 1 enemy for enemy selection | Yes | Already implemented in resolveChoiceCommand |
| Mana color choice with only 1 option | Yes | Already implemented |

---

## Implementation Notes

### Where Auto-Resolve Already Happens

`resolveChoiceCommand.ts:141-163` already auto-resolves when there's only 1 resolvable option:

```typescript
// If only one option, auto-resolve it
if (resolvableOptions.length === 1) {
  const singleOption = resolvableOptions[0];
  const autoResolveResult = resolveEffect(
    effectResult.state,
    params.playerId,
    singleOption
  );
  // ...
}
```

### The Challenge

The tricky part is detecting when one option is "strictly better" than another. This requires:

1. **Semantic understanding** of what the options do
2. **Context awareness** (how many enemies, etc.)

Possible approaches:

### Option A: Effect Comparison (Complex)

```typescript
function isStrictlyBetter(optionA: CardEffect, optionB: CardEffect, state: GameState): boolean {
  // Compare effects semantically
  // e.g., if both target same scope but A has higher value
}
```

**Pros:** General solution
**Cons:** Complex to implement, many edge cases

### Option B: Annotate Effects (Simpler)

Add metadata to choice effects indicating when they're comparable:

```typescript
{
  type: EFFECT_CHOICE,
  options: [
    { ...targetOneEffect, scalingValue: 3, scalingScope: "one" },
    { ...targetAllEffect, scalingValue: 2, scalingScope: "all" },
  ],
  autoSelectWhen: "single_target_scope_match"
}
```

**Pros:** Explicit, predictable
**Cons:** Requires updating effect definitions

### Option C: Special Case Tremor Pattern (Pragmatic)

Detect the specific "target one vs all" pattern:

```typescript
function shouldAutoSelectTargetOne(
  options: CardEffect[],
  state: GameState
): number | null {
  // Check if pattern is:
  // - Option 0: EFFECT_SELECT_COMBAT_ENEMY (target one)
  // - Option 1: EFFECT_APPLY_MODIFIER with SCOPE_ALL_ENEMIES
  // - Only 1 enemy in combat
  // If so, return 0 (auto-select target one if value is better)
}
```

**Pros:** Solves immediate problem
**Cons:** Not general, but can expand later

---

## Files to Modify

- `packages/core/src/engine/commands/resolveChoiceCommand.ts` - Add auto-select logic
- Possibly `packages/core/src/types/cards.ts` - Add metadata for comparison

---

## Testing

```typescript
describe("auto-select meaningless choices", () => {
  it("should auto-select 'target one -3' over 'all -2' when only 1 enemy", () => {
    // Set up combat with 1 enemy
    // Play Tremor
    // Verify no CHOICE_REQUIRED event for the first choice
    // Verify modifier was applied with -3 (not -2)
  });

  it("should NOT auto-select when there are 2+ enemies", () => {
    // Set up combat with 2 enemies
    // Play Tremor
    // Verify CHOICE_REQUIRED event is emitted
  });
});
```

---

## Acceptance Criteria

- [ ] Playing Tremor with 1 enemy auto-resolves to "-3 to target"
- [ ] Playing Tremor with 2+ enemies still presents choice
- [ ] Enemy selection with 1 enemy still auto-resolves (existing behavior)
- [ ] No regression in other choice flows
