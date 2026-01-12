# Ticket: Auto-Advance Combat Phases When All Enemies Defeated

**Created:** January 2025
**Priority:** Low
**Complexity:** Low
**Affects:** Client UI, Combat flow
**Status:** Not Started

---

## Problem Statement

When all enemies are defeated in the Ranged/Siege phase, the player still has to manually click through:
1. "Skip Blocking"
2. "Continue" (assign damage)
3. "Skip Attack"

This is tedious - if all enemies are dead, there's nothing to do in those phases.

---

## Current Behavior

1. Player defeats all enemies with Fireball in Ranged/Siege phase
2. Player must click "Skip Blocking"
3. Player must click "Continue" (no damage to assign)
4. Player must click "Skip Attack" (no enemies left)
5. Combat ends

**Total clicks after defeating enemies:** 3

---

## Expected Behavior

1. Player defeats all enemies with Fireball in Ranged/Siege phase
2. Combat ends automatically (or shows "Finish Combat" button)

**Total clicks after defeating enemies:** 0-1

---

## Implementation Options

### Option A: Server-side auto-advance (Recommended)

When processing `END_COMBAT_PHASE_ACTION`, if all enemies are defeated, skip directly to combat end:

```typescript
// In endCombatPhaseCommand.ts or similar
if (combat.enemies.every(e => e.isDefeated)) {
  // Skip remaining phases, end combat
  return endCombat(state);
}
```

**Pros:** Clean, no wasted round-trips
**Cons:** Might skip phases where player could do other things (heal, etc.)

### Option B: Client-side auto-click

Client detects all enemies defeated and auto-sends `END_COMBAT_PHASE_ACTION`:

```typescript
useEffect(() => {
  if (combat.enemies.every(e => e.isDefeated) && canEndPhase) {
    sendAction({ type: END_COMBAT_PHASE_ACTION });
  }
}, [combat.enemies, canEndPhase]);
```

**Pros:** Simple
**Cons:** Multiple round-trips, visible phase flickering

### Option C: Smart button text + single action

Change the "Skip X" button to "Finish Combat" when all enemies defeated, and have that action end combat directly:

```typescript
const allDefeated = combat.enemies.every(e => e.isDefeated);
const buttonText = allDefeated ? "Finish Combat" : PHASE_ACTION_LABELS[phase];
const action = allDefeated
  ? { type: FINISH_COMBAT_ACTION }
  : { type: END_COMBAT_PHASE_ACTION };
```

**Pros:** Clear UX, single click
**Cons:** New action type needed

---

## Edge Cases to Consider

- What if player wants to play more cards in block phase even though enemies are dead? (healing, crystallize, etc.)
- What about fame/reputation tracking that happens at combat end?
- Multi-player: does this affect turn order?

---

## Files to Modify

**Option A:**
- `packages/core/src/engine/commands/combat/endCombatPhaseCommand.ts`

**Option B:**
- `packages/client/src/components/Combat/CombatOverlay.tsx`

**Option C:**
- `packages/client/src/components/Combat/CombatActions.tsx`
- `packages/core/src/engine/commands/index.ts` (new action)
- `packages/shared/src/actions.ts` (new action type)

---

## Acceptance Criteria

- [ ] Defeating all enemies in Ranged/Siege phase ends combat with minimal clicks
- [ ] Player can still play cards if they want to before ending
- [ ] Fame is correctly awarded
- [ ] No regression in normal combat flow
