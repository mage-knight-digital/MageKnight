# Incremental Combat Damage Allocation

## Overview

This document describes a refactor of the combat attack (and block) system to use **incremental damage assignment** instead of the current all-or-nothing approach. This change:

1. Enables proper multi-enemy damage allocation in the UI
2. Creates a clean, discrete action space for RL training
3. Keeps all game logic on the server (no client-side rule duplication)
4. Fixes the current broken attack UI

## Current Problems

### Problem 1: UI Can't Allocate Damage to Multiple Enemies

Currently, when you click "Attack" on an enemy, the client builds an attack action with ALL accumulated damage going to that single enemy. There's no way to say "send 3 fire to enemy A and 5 physical to enemy B."

### Problem 2: Client Has Game Logic

The fix I made to `CombatOverlay.tsx` has the client building `AttackSource[]` arrays and deciding which elements to use. This duplicates server logic and risks client/server disagreement.

### Problem 3: RL Action Space is Unclear

For AI training, the action space needs to be discrete and bounded. "Allocate X damage of type Y to enemy Z" is combinatorial. We need simpler atomic actions.

### Problem 4: Attack Command Takes Client-Specified Damage

Unlike block (which reads from server-side accumulator), the attack command trusts whatever `attacks[]` the client sends. This is inconsistent and error-prone.

## Solution: Incremental Assignment

Instead of one big "DECLARE_ATTACK" action, break it into small assignment steps:

```
PLAY_CARD (Swiftness) → accumulator.ranged += 3
ASSIGN_ATTACK(enemy_0, ranged, 1) → pendingDamage[enemy_0].physical += 1
ASSIGN_ATTACK(enemy_0, ranged, 1) → pendingDamage[enemy_0].physical += 1
ASSIGN_ATTACK(enemy_0, ranged, 1) → pendingDamage[enemy_0].physical += 1
END_PHASE → resolve pending damage, defeat enemy_0 (3 >= 3 armor)
```

## New State Structures

### CombatState Changes

```typescript
interface CombatState {
  // ... existing fields ...

  // NEW: Pending damage assigned to each enemy (before resolution)
  pendingDamage: {
    [enemyInstanceId: string]: {
      physical: number;
      fire: number;
      ice: number;
      coldFire: number;
    }
  };
}
```

### CombatAccumulator Changes

```typescript
interface CombatAccumulator {
  attack: AccumulatedAttack;      // What you've gained from cards
  assignedAttack: AccumulatedAttack;  // NEW: What's been assigned to enemies
  // Available = attack - assignedAttack

  block: number;
  blockElements: ElementalAttackValues;
  blockSources: BlockSource[];
}
```

## New Actions

### ASSIGN_ATTACK_ACTION

```typescript
interface AssignAttackAction {
  type: "ASSIGN_ATTACK";
  enemyInstanceId: string;
  attackType: "ranged" | "siege" | "melee";
  element: "physical" | "fire" | "ice" | "coldFire";
  amount: number;  // Usually 1 for AI, can be more for UI batching
}
```

### UNASSIGN_ATTACK_ACTION

```typescript
interface UnassignAttackAction {
  type: "UNASSIGN_ATTACK";
  enemyInstanceId: string;
  attackType: "ranged" | "siege" | "melee";
  element: "physical" | "fire" | "ice" | "coldFire";
  amount: number;
}
```

## New ValidActions Structure

### CombatOptions (Updated)

```typescript
interface CombatOptions {
  phase: CombatPhase;
  canEndPhase: boolean;

  // Available attack pool (what you can still assign)
  availableAttack: {
    ranged: number;
    siege: number;
    melee: number;
    fireRanged: number;
    fireSiege: number;
    fireMelee: number;
    iceRanged: number;
    iceSiege: number;
    iceMelee: number;
    coldFireMelee: number;
    // Note: physical is the base (non-elemental) for each type
  };

  // Enemy states with pending damage
  enemies: EnemyAttackState[];

  // Valid discrete actions
  assignableAttacks: AssignAttackOption[];
  unassignableAttacks: UnassignAttackOption[];
}
```

### EnemyAttackState

Server computes ALL effectiveness values - client just displays them.

```typescript
interface EnemyAttackState {
  enemyInstanceId: string;
  enemyName: string;
  armor: number;
  isDefeated: boolean;
  isFortified: boolean;
  requiresSiege: boolean;  // In ranged/siege phase

  // Raw pending damage (what's been assigned)
  pendingDamage: {
    physical: number;
    fire: number;
    ice: number;
    coldFire: number;
  };

  // Effective pending damage (after resistances applied)
  // Server calculates this - client does NOT duplicate resistance logic
  effectiveDamage: {
    physical: number;
    fire: number;
    ice: number;
    coldFire: number;
  };

  // Total effective damage (sum of effectiveDamage)
  totalEffectiveDamage: number;

  // Can this enemy be defeated with current pending?
  canDefeat: boolean;

  // Enemy resistances (for UI to show warnings)
  resistances: {
    physical: boolean;
    fire: boolean;
    ice: boolean;
  };
}
```

### AssignAttackOption

Each entry is ONE discrete action the AI/player can take.

```typescript
interface AssignAttackOption {
  enemyInstanceId: string;
  attackType: "ranged" | "siege" | "melee";
  element: "physical" | "fire" | "ice" | "coldFire";
  amount: number;  // Usually 1
}
```

## Server Logic

### Assign Attack Command

```typescript
// ASSIGN_ATTACK command
// isReversible: true (can undo until END_PHASE)

execute(state) {
  // 1. Validate: player has this attack type/element available
  // 2. Move from available → assigned in accumulator
  // 3. Add to combat.pendingDamage[enemyId]
  // 4. Return updated state
}

undo(state) {
  // Reverse: move from assigned → available, remove from pendingDamage
}
```

### End Combat Phase Resolution

When `END_COMBAT_PHASE` is called (transitioning out of RANGED_SIEGE or ATTACK):

```typescript
// For each enemy with pendingDamage:
//   1. Calculate effective damage (apply resistances)
//   2. If effective >= armor: mark defeated, grant fame
//   3. Clear pendingDamage for that enemy
//   4. Clear assignedAttack from accumulator

// If transitioning to next phase (not ending combat):
//   - Refund any unresolved pendingDamage back to available
//   - Or just clear it (design decision - see below)
```

### Effectiveness Calculation

Server uses existing `elementalCalc.ts` logic:

```typescript
function calculateEffectiveDamage(
  pending: ElementalDamage,
  resistances: Resistances
): ElementalDamage {
  return {
    physical: resistances.physical ? Math.floor(pending.physical / 2) : pending.physical,
    fire: resistances.fire ? Math.floor(pending.fire / 2) : pending.fire,
    ice: resistances.ice ? Math.floor(pending.ice / 2) : pending.ice,
    coldFire: (resistances.fire && resistances.ice)
      ? Math.floor(pending.coldFire / 2)
      : pending.coldFire,
  };
}
```

## Client UI

### No Game Logic in Client

Client receives all computed values from server:

```tsx
function EnemyDamageDisplay({ enemy }: { enemy: EnemyAttackState }) {
  const { pendingDamage, effectiveDamage, totalEffectiveDamage, armor, canDefeat, resistances } = enemy;

  return (
    <div>
      {/* Show each element's raw → effective */}
      {pendingDamage.fire > 0 && (
        <div className={resistances.fire ? "inefficient" : ""}>
          🔥 {pendingDamage.fire} → {effectiveDamage.fire}
          {resistances.fire && " (resisted!)"}
        </div>
      )}
      {pendingDamage.ice > 0 && (
        <div className={resistances.ice ? "inefficient" : ""}>
          ❄️ {pendingDamage.ice} → {effectiveDamage.ice}
          {resistances.ice && " (resisted!)"}
        </div>
      )}

      {/* Progress bar */}
      <div>{totalEffectiveDamage} / {armor}</div>

      {/* Defeat indicator */}
      {canDefeat && <div className="can-defeat">✓ Can Defeat!</div>}
    </div>
  );
}
```

### Inefficiency Feedback

Client can show "that was inefficient!" by comparing server values:

```tsx
const prevEffective = usePrevious(enemy.totalEffectiveDamage);
const gained = enemy.totalEffectiveDamage - (prevEffective ?? 0);
const assigned = /* track what we just assigned */;

if (assigned > 0 && gained < assigned) {
  // Show "resisted!" animation - damage was halved
}
```

No game logic - just comparing numbers.

## RL Action Space

During RANGED_SIEGE or ATTACK phase:

```python
actions = []

# Play cards (existing)
for card in validActions.playCard.cards:
    if card.canPlayBasic:
        actions.append(("PLAY_CARD", card.cardId, False))
    if card.canPlayPowered:
        actions.append(("PLAY_CARD", card.cardId, True))

# Assign attacks (from server-computed list)
for opt in validActions.combat.assignableAttacks:
    actions.append(("ASSIGN_ATTACK", opt.enemyInstanceId, opt.attackType, opt.element))

# Unassign (optional, for exploration)
for opt in validActions.combat.unassignableAttacks:
    actions.append(("UNASSIGN_ATTACK", opt.enemyInstanceId, opt.attackType, opt.element))

# End phase
if validActions.combat.canEndPhase:
    actions.append(("END_PHASE",))
```

AI learns:
- Assigning fire to fire-resistant enemy → sees effectiveDamage is half → learns to avoid
- Needs to reach armor threshold → learns to accumulate enough before END_PHASE
- Can undo assignments → can explore different allocations

## Implementation Phases

### Phase 1: Foundation (State + Types) ✅ COMPLETE
**Goal**: Add new state structures without breaking anything

- [x] Add `pendingDamage` to `CombatState` in `core/src/types/combat.ts`
- [x] Add `assignedAttack` to `CombatAccumulator` in `core/src/types/player.ts`
- [x] Add `ASSIGN_ATTACK_ACTION`, `UNASSIGN_ATTACK_ACTION` to `shared/src/actions.ts`
- [x] Add new ValidActions types to `shared/src/types/validActions.ts`
- [x] Update `createCombatState()` to initialize `pendingDamage: {}`
- [x] Update `createEmptyCombatAccumulator()` to include `assignedAttack`

**Validation**: ✅ `pnpm build && pnpm test` passes, no behavior changes

### Phase 2: Server Commands ✅ COMPLETE
**Goal**: Implement new commands (don't require them yet)

- [x] Create `assignAttackCommand.ts` in `core/src/engine/commands/combat/`
- [x] Create `unassignAttackCommand.ts`
- [x] Add command factory in `core/src/engine/commands/factories/combat.ts`
- [x] Add validators in `core/src/engine/validators/combatValidators.ts`
  - `validateAssignAttackInCombat` - Must be in combat
  - `validateAssignAttackPhase` - Only in RANGED_SIEGE or ATTACK phases
  - `validateAssignAttackTargetEnemy` - Enemy exists, not defeated
  - `validateUnassignAttackTargetEnemy` - Enemy exists
  - `validateHasAvailableAttack` - Player has enough attack to assign
  - `validateHasAssignedToUnassign` - Enough assigned to unassign
  - `validateAssignAttackTypeForPhase` - Attack type matches phase rules
  - `validateAssignAttackFortification` - Fortified enemies need siege in ranged phase
- [x] Write unit tests for new commands (17 tests in `incrementalAttack.test.ts`)
- [x] Add new events: `ATTACK_ASSIGNED`, `ATTACK_UNASSIGNED`
- [x] Remove legacy `attacks` field from `CombatOptions` (fixing forward, not backwards compat)

**Validation**: ✅ New command tests pass, 807 total tests passing

### Phase 3: ValidActions Update ✅ COMPLETE
**Goal**: Server computes and sends new assignment info

- [x] Update `getCombatOptions()` in `core/src/engine/validActions/combat.ts`
- [x] Add helper to compute `availableAttack` (accumulated - assigned)
- [x] Add helper to compute `effectiveDamage` per enemy
- [x] Generate `assignableAttacks` list based on available attack and phase rules
- [x] Generate `unassignableAttacks` list based on pending damage

**Validation**: ✅ 22 tests in `combatValidActions.test.ts`, 804 total tests passing

### Phase 4: End Phase Resolution ✅ COMPLETE
**Goal**: END_COMBAT_PHASE resolves pending damage

- [x] Modify `endCombatPhaseCommand.ts` to resolve `pendingDamage`
- [x] Apply resistance calculations at resolution time
- [x] Defeat enemies where effective >= armor
- [x] Clear pending and assigned after resolution
- [x] Handle refund/clear of unresolved damage on phase transition

**Validation**: ✅ 11 tests in `endPhaseResolution.test.ts`, 815 total tests passing

### Phase 5: UI Migration ✅ COMPLETE
**Goal**: Client uses new incremental flow

- [x] Update `CombatOverlay.tsx` to show pending damage per enemy
- [x] Add +/- controls or input for damage assignment
- [x] Show effective damage (from server) vs raw
- [x] Show resistance warnings when assigning to resistant enemy
- [x] Show "Can Defeat!" when `canDefeat: true`
- [x] Remove old `buildAttackAction()` code
- [x] Remove `LegacyAttackOption` placeholder from `EnemyCard.tsx`

**Validation**: ✅ EnemyCard renders incremental allocation UI, CombatOverlay passes props

### Phase 6: Block Phase ⏸️ DEFERRED
**Status**: Deferred - current block system works well

**Rationale**: Unlike attacks, blocking is fundamentally different:
- **Single-target**: Block applies to one enemy at a time (no allocation problem)
- **All-or-nothing**: Either meet threshold or fail (no partial assignment)
- **Current UI works**: Shows accumulated vs required, assigns when sufficient

The incremental attack system solved **multi-enemy damage allocation**. Since blocking doesn't have this complexity, the existing system suffices. Consider revisiting if:
- RL training reveals block action space issues
- UX feedback suggests reversible blocking would help

Original tasks (for future reference):
- [ ] Add `pendingBlock` to `CombatState`
- [ ] Add `assignedBlock` to `CombatAccumulator`
- [ ] Create `ASSIGN_BLOCK_ACTION`, `UNASSIGN_BLOCK_ACTION`
- [ ] Update block resolution in END_COMBAT_PHASE
- [ ] Update UI for incremental block assignment

### Phase 7: Cleanup ✅ COMPLETE
**Goal**: Mark deprecated code, ensure clean separation

- [x] Mark `DECLARE_ATTACK_ACTION` as deprecated (kept for tests, removed from UI)
- [x] Remove old `buildAttackAction()` from client (done in Phase 5)
- [x] Verify client uses only incremental actions
- [~] Update all tests to use new flow (deferred - existing tests still validate game rules)

**Decisions**:
- `DECLARE_ATTACK_ACTION` kept for tests: Tests validate core game rules (resistances, armor, multi-target). Converting them provides little benefit since both systems work correctly.
- Client exclusively uses incremental: `ASSIGN_ATTACK_ACTION` / `UNASSIGN_ATTACK_ACTION`
- Tests can use either: Legacy action for quick single-enemy tests, incremental for allocation tests

**Validation**: ✅ Build passes, client has no legacy attack code

## Progress Summary

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Foundation | ✅ Complete | State structures in place |
| Phase 2: Server Commands | ✅ Complete | Commands, validators, tests done |
| Phase 3: ValidActions | ✅ Complete | availableAttack, enemies, assignableAttacks, unassignableAttacks |
| Phase 4: End Phase Resolution | ✅ Complete | Damage resolution, resistance calcs, 11 tests |
| Phase 5: UI Migration | ✅ Complete | EnemyCard +/- controls, pending damage display |
| Phase 6: Block Phase | ⏸️ Deferred | Single-target blocking doesn't need allocation |
| Phase 7: Cleanup | ✅ Complete | Legacy action deprecated, client uses incremental |

## Design Decisions

### Q: What happens to unresolved pendingDamage on phase transition?

**Option A: Refund** - Move back to available pool
- Forgiving, lets player reallocate
- Might be confusing ("where did my assignment go?")

**Option B: Clear** - Just discard it
- Matches rulebook ("if insufficient, don't play them")
- Punishes mistakes more

**Decision**: Option B (Clear). Pending damage is resolved at phase transition - enemies are defeated if damage >= armor, otherwise damage is discarded. This matches the rulebook where you must commit enough to defeat, and the UI will show real-time effective damage so players know before committing.

### Q: Should ASSIGN_ATTACK be reversible?

**Yes** - Assignment is tentative until END_PHASE. Players should be able to freely adjust allocation before committing. The "commit" point is END_PHASE, which is irreversible.

### Q: Granularity - always +1 or allow amounts?

**Both** - Server accepts any valid amount. AI sends +1 for simple action space. UI can batch for better UX. Server just validates total doesn't exceed available.

### Q: Do we keep old DECLARE_ATTACK_ACTION?

**During transition**: Yes, for backwards compat
**Eventually**: Remove or keep for special cases (single-target quick attack?)

## File Locations

| What | Where |
|------|-------|
| CombatState type | `core/src/types/combat.ts` |
| CombatAccumulator type | `core/src/types/player.ts` |
| Action types | `shared/src/actions.ts` |
| ValidActions types | `shared/src/types/validActions.ts` |
| Combat ValidActions computation | `core/src/engine/validActions/combat.ts` |
| ValidActions tests | `core/src/engine/validActions/__tests__/combatValidActions.test.ts` |
| Assign attack command | `core/src/engine/commands/combat/assignAttackCommand.ts` |
| Unassign attack command | `core/src/engine/commands/combat/unassignAttackCommand.ts` |
| Incremental attack tests | `core/src/engine/commands/combat/__tests__/incrementalAttack.test.ts` |
| End phase command | `core/src/engine/commands/combat/endCombatPhaseCommand.ts` |
| Combat validators | `core/src/engine/validators/combatValidators.ts` |
| Elemental calc | `core/src/engine/combat/elementalCalc.ts` |
| Combat UI | `client/src/components/Combat/CombatOverlay.tsx` |
| Enemy card UI | `client/src/components/Combat/EnemyCard.tsx` |
