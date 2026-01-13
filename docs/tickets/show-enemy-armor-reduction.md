# Ticket: Show Enemy Armor Reduction in UI

**Created:** January 2025
**Priority:** Medium
**Complexity:** Low
**Affects:** Client UI, EnemyCard component
**Status:** Not Started

---

## Problem Statement

When spells like Tremor or Chill (powered) reduce enemy armor, the UI doesn't show this. The player only sees the original armor value. The only indication is that the "Attack" button shows the correct (reduced) armor requirement.

---

## Current Behavior

1. Play Tremor on enemy with Armor 3
2. Enemy card still shows "D 3" (original armor)
3. Attack button shows "Attack (5 → 1)" (correct reduced armor)
4. Player has to infer the reduction happened

---

## Expected Behavior

1. Play Tremor on enemy with Armor 3
2. Enemy card shows armor reduction: "D 1" (with strikethrough on original) or "D 3→1"
3. Visual indicator that a debuff is active (icon, color change, etc.)

---

## Design Options

### Option A: Strikethrough original + new value
```
D 3̶ → 1
```

### Option B: Color change + tooltip
- Show "D 1" in a different color (red/orange for debuffed)
- Tooltip shows "Base: 3, Modifier: -2 (Tremor)"

### Option C: Modifier icon
- Show "D 1" with a down-arrow icon indicating reduction
- Hover/click shows modifier details

---

## Implementation

The server already sends effective armor in `AttackOption.enemyArmor`. We need to:

1. Also send effective armor in `ClientCombatEnemy` (or compute it client-side)
2. Compare effective vs base armor
3. Display difference in EnemyCard

```typescript
// In EnemyCard.tsx
const hasArmorReduction = enemy.effectiveArmor < enemy.armor;

<div className="enemy-card__stat">
  <span className="enemy-card__stat-icon">D</span>
  <span className={`enemy-card__stat-value ${hasArmorReduction ? 'enemy-card__stat-value--reduced' : ''}`}>
    {hasArmorReduction ? (
      <>
        <span className="enemy-card__original-value">{enemy.armor}</span>
        <span className="enemy-card__arrow">→</span>
        {enemy.effectiveArmor}
      </>
    ) : (
      enemy.armor
    )}
  </span>
</div>
```

---

## Files to Modify

- `packages/shared/src/types/clientState.ts` - Add `effectiveArmor` to `ClientCombatEnemy`
- `packages/server/src/toClientState.ts` - Compute and include effective armor
- `packages/client/src/components/Combat/EnemyCard.tsx` - Display reduction

---

## Acceptance Criteria

- [ ] Enemy card shows reduced armor when modifier active
- [ ] Original armor is still visible (strikethrough or secondary display)
- [ ] Visual distinction between normal and reduced armor
- [ ] Works for Tremor, Chill (powered), and any future armor reduction effects
