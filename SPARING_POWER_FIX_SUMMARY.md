# Sparing Power Decision Timing Fix - Summary

## Problem
The Sparing Power tactic decision was not being enforced as a mandatory first action at the start of a player's turn. This allowed:
- Players to play cards/take actions before resolving sparing power
- Game state to become invalid (dead-end where only UNDO is valid)

## Root Cause
The pending tactic decision check was only done during the tactics phase, not during normal turn flow. This meant:
1. validActions advertised sparing power decision alongside other actions (play card, move, etc.)
2. Validators didn't block non-sparing-power actions when the decision was pending

## Solution
Created a shared rule in `core/src/engine/rules/tactics.ts` that determines if a pending tactic decision should block all other actions:

```typescript
export function doesPendingTacticDecisionBlockActions(player: Player): boolean {
  const pending = player.pendingTacticDecision;
  if (!pending) return false;

  // Sparing Power is a "before turn" decision - blocks all other actions
  if (pending.type === TACTIC_SPARING_POWER) return true;

  // Other tactic decisions (Rethink, Mana Steal, etc.) do not block actions
  return false;
}
```

## Changes Made

### 1. Added Rule (Single Source of Truth)
**File:** `packages/core/src/engine/rules/tactics.ts`
- Added `doesPendingTacticDecisionBlockActions()` function
- This is the single source of truth used by both validators and validActions

### 2. Updated ValidActions
**File:** `packages/core/src/engine/validActions/index.ts`
- Added check for blocking tactic decisions before normal turn flow
- When Sparing Power decision is pending, returns `mode: "pending_tactic_decision"` exclusively
- This prevents other actions from being advertised to the client

### 3. Updated Validators
Updated `validateNoTacticDecisionPending()` to use the shared rule:

**File:** `packages/core/src/engine/validators/choiceValidators.ts`
- Modified to only block when `doesPendingTacticDecisionBlockActions()` returns true
- This allows non-blocking tactic decisions (Rethink, Mana Steal) to coexist with other actions

**Files Updated to Include Validator:**
- `packages/core/src/engine/validators/routing/cards.ts` (PLAY_CARD, PLAY_CARD_SIDEWAYS)
- `packages/core/src/engine/validators/routing/movement.ts` (MOVE, EXPLORE)
- `packages/core/src/engine/validators/routing/rest.ts` (REST, DECLARE_REST, COMPLETE_REST)
- `packages/core/src/engine/validators/routing/sites.ts` (INTERACT, ENTER_SITE, BUY_SPELL, etc.)
- `packages/core/src/engine/validators/routing/combat.ts`
- `packages/core/src/engine/validators/routing/cooperative.ts`
- `packages/core/src/engine/validators/routing/skills.ts`
- `packages/core/src/engine/validators/routing/units.ts`

## Architecture Alignment
This fix follows the CLAUDE.md principle:
> **Rules** (`core/src/engine/rules/`) are the single source of truth containing pure functions that define game mechanics.
> **Validators** (`core/src/engine/validators/`) import rules and reject invalid actions.
> **ValidActions** (`core/src/engine/validActions/`) import the same rules to compute what options are available to the player.

## Expected Behavior After Fix
- At the START of each turn, if a player has Sparing Power selected, they MUST resolve the decision before taking any other actions
- validActions shows ONLY the sparing power decision until it's resolved
- All other actions are blocked by validators until sparing power is handled
- Once sparing power is resolved, normal actions become available

## Testing Recommendations
1. Start a turn with Sparing Power selected
2. Verify validActions shows only `pending_tactic_decision` mode
3. Verify attempting to play cards, move, etc. is rejected by validators
4. Resolve sparing power decision (stash or take)
5. Verify normal actions become available
