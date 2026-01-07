# Ticket: Combat Button Text - "Skip Combat" vs "Finish Combat"

**Created:** January 2025
**Priority:** Low
**Complexity:** Low
**Affects:** Client UI, Combat overlay
**Status:** Not Started

---

## Problem Statement

In the attack phase, when all enemies have been assigned enough attack to defeat them, the button still shows "Skip Combat". This is misleading - the player isn't skipping anything, they're finishing a successful combat.

---

## Current Behavior

| Scenario | Button Text | Expected |
|----------|-------------|----------|
| Attack phase, enemies still alive | "Skip Combat" | ✅ Correct (withdrawing) |
| Attack phase, all enemies will be defeated | "Skip Combat" | ❌ Should say "Finish Combat" |
| Any phase, no actions taken | "Skip Combat" | ✅ Correct |

---

## Expected Behavior

Button text should reflect what will actually happen:

| Scenario | Button Text |
|----------|-------------|
| All enemies will be defeated (attack ≥ armor for all) | "Finish Combat" or "Continue" |
| Some enemies surviving (withdrawing/fleeing) | "Withdraw" or "Skip Combat" |
| Block/Damage phase with more phases to come | "Continue" or "Next Phase" |

---

## Implementation

### Option 1: Simple - Just change text based on enemies defeated

```typescript
// In CombatOverlay.tsx or similar
const allEnemiesDefeated = combat.enemies.every(e => e.isDefeated || e.pendingAttack >= e.armor);

const buttonText = allEnemiesDefeated ? "Finish Combat" : "Skip Combat";
```

### Option 2: Context-aware button text

```typescript
function getCombatButtonText(combat: CombatState): string {
  const allDefeated = combat.enemies.every(e => e.isDefeated);
  const allWillBeDefeated = combat.enemies.every(e => e.isDefeated || e.pendingAttack >= e.armor);

  if (allDefeated || allWillBeDefeated) {
    return "Finish Combat";
  }

  if (combat.phase === "attack" && !allWillBeDefeated) {
    return "Withdraw";  // More accurate than "Skip"
  }

  return "Continue";
}
```

---

## Files to Modify

- `packages/client/src/components/Combat/CombatOverlay.tsx` (or wherever the button is)

---

## Testing

### Manual Testing
1. Enter combat with single enemy
2. Assign enough attack to defeat it
3. Verify button says "Finish Combat" not "Skip Combat"
4. Click button, verify combat ends with victory

### E2E Test (Optional)
```typescript
test("shows 'Finish Combat' when all enemies defeated", async ({ page }) => {
  // Enter combat
  // Assign attack to defeat enemy
  // Check button text
  await expect(page.locator(".combat-action-button")).toHaveText("Finish Combat");
});
```

---

## Acceptance Criteria

- [ ] Button shows "Finish Combat" when all enemies will be defeated
- [ ] Button shows "Withdraw" or "Skip Combat" when enemies will survive
- [ ] Button behavior unchanged (just text)
