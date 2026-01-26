# Ticket: Ranged/Siege Attack Phase - Group-Based Attack Pool System

**Created:** January 2025
**Updated:** January 2025
**Priority:** High
**Complexity:** High
**Status:** Not Started
**Affects:** Combat system, attack commands, validation, UI
**Authoritative:** Yes

---

## Summary

Implement the correct Ranged/Siege Attack Phase mechanics using a group-based attack pool system. Players must declare a target group BEFORE committing resources, attack damage pools against combined armor, and resolution is all-or-nothing for the entire group. Additionally, fortification and resistance contaminate entire groups.

## Problem Statement

The current combat implementation allows per-enemy damage assignment, which is incorrect. The rulebook specifies:

1. **Group targeting**: Player selects target group BEFORE playing cards
2. **Attack pool**: All attacks stack into a single pool compared against combined armor
3. **All-or-nothing**: Pool ≥ combined armor = ALL die; Pool < combined armor = NONE die
4. **Group contamination**: Fortification and resistance spread to entire group
5. **Multiple attacks**: Player can declare multiple separate attacks per phase

Current implementation gaps:
- ❌ Allows damage splitting/assignment to individual enemies
- ❌ Allows partial group kills (some die, some survive)
- ❌ Doesn't enforce group selection before card play
- ❌ Doesn't apply resistance contamination across group
- ❌ Doesn't apply fortification contamination across group

## Current Behavior

From `packages/core/src/types/combat.ts`:
- `pendingDamage: PendingDamageMap` - Per-enemy damage tracking
- `PendingElementalDamage` - Elemental damage per enemy

From `packages/core/src/engine/commands/combat/assignAttackCommand.ts`:
- Assigns damage point-by-point to individual enemies
- No concept of target groups or attack pools
- Resolution happens per-enemy, not per-group

Key files:
- `packages/core/src/types/combat.ts` - Combat state
- `packages/core/src/engine/commands/combat/assignAttackCommand.ts` - Current attack assignment
- `packages/core/src/engine/commands/combat/endCombatPhaseCommand.ts` - Phase resolution
- `packages/core/src/engine/combat/elementalCalc.ts` - Resistance calculations

## Expected Behavior

### Attack Declaration Flow

```
Player declares attack → Selects target group → Plays cards/abilities → Calculate pool → Resolve (all die or none)
```

**Critical**: Grouping happens BEFORE resource commitment, not after damage calculation.

### Attack Pool System

- All Ranged/Siege attacks played stack into a single pool value
- Pool is compared against SUM of all targeted enemies' armor
- Pool ≥ Combined Armor → ALL enemies in group defeated
- Pool < Combined Armor → NO enemies defeated, damage wasted
- No partial kills, no damage carryover

### Multiple Attacks Per Phase

Player can declare 0, 1, or multiple separate attacks during this phase. Each attack goes through complete declaration → resolution cycle:

```
Attack 1: Target [Enemy A] with 5 damage → resolve
Attack 2: Target [Enemy B, Enemy C] with 12 damage → resolve
Attack 3: Target [Enemy D] with 7 damage → resolve
```

### Undo Mechanism

Player can retract attack declaration if they realize insufficient damage:
- Take back all played cards
- Cancel current attack declaration
- Either play additional cards OR choose different target group OR move to next phase

### Group Contamination Rules

#### Fortification Contamination

**Rule**: If ANY enemy in group has fortification level X, entire group is treated as fortification level X.

Attack Type Restrictions:
- No fortification in group: Ranged OR Siege attacks allowed
- Any enemy has single fortification: ONLY Siege attacks allowed
- Any enemy has double fortification: NO attacks allowed in this phase

Fortification Sources:
- Site fortification (Keep, Mage Tower, City)
- Enemy token `fortified` ability
- Wall hexside (situational)
- Double = site + ability on same enemy (NOT different sources on different enemies)

**Examples**:

| Group | Fortification Level | Allowed Attacks |
|-------|---------------------|-----------------|
| [Fortified Enemy, Unfortified Enemy] | Single | Siege only |
| [Enemy in Keep, Enemy with fortified ability] | Single (different sources) | Siege only |
| [Enemy in Keep WITH fortified ability] | Double | None (this phase) |

#### Resistance Contamination

**Rule**: If ANY enemy in group has resistance type X, ALL attacks of type X against the group are halved.

Halving Calculation:
1. Sum all attacks of resistant type
2. Divide by 2, round DOWN
3. Add to non-resistant attacks

**Cold Fire Special Case**: Halved ONLY if at least one enemy has BOTH Fire AND Ice resistance. One enemy with Fire + different enemy with Ice = Cold Fire NOT halved.

**Examples**:

```
Group: [Enemy A: 5 armor, Fire Resistant] + [Enemy B: 5 armor, no resistance]
Attack: Fire 10

Calculation:
- Any enemy has Fire Resistance? YES (Enemy A)
- All Fire attacks halved: 10 → 5
- 5 < 10 combined armor
- Result: Both survive
```

```
Group: [Enemy A: 5 armor, Fire Resistant] + [Enemy B: 5 armor, no resistance]
Attack: Ice 10

Calculation:
- Any enemy has Ice Resistance? NO
- Ice attacks at full strength: 10
- 10 = 10 combined armor
- Result: Both defeated
```

```
Group: [Enemy A: Fire Resistant] + [Enemy B: Ice Resistant]
Attack: Cold Fire 10

Calculation:
- Does any single enemy have BOTH Fire AND Ice? NO
- Cold Fire at full strength: 10
```

### What Does NOT Contaminate

These abilities stay on individual enemies only:
- Elusive (armor reduction)
- Defend (armor bonus)
- Arcane Immunity
- Unfortified ability
- Cumbersome
- Non-combat immunity (see addendum)

### Non-Combat Immunity vs Combat Resistance

**Important distinction** (from rulebook S12):

| Mechanic | Scope | Contamination |
|----------|-------|---------------|
| Combat Resistance (attack halving) | Attack damage calculations | YES - spreads to group |
| Non-Combat Immunity (effect blocking) | Non-Attack/Block effects from mana color | NO - per-enemy only |

Example:
```
Group: [Enemy A: Fire Resistant] + [Enemy B: No resistance]

Attack with Fire 10:
- Fire Resistance contaminates group
- All Fire attacks halved: 10 → 5 ✓

Play red mana ability "weaken target enemy":
- Fire Resistance does NOT contaminate
- Enemy A: immune to red ability ✓
- Enemy B: affected by red ability ✓
```

## Scope

### In Scope
- Group-based target selection before card play
- Attack pool accumulation system
- All-or-nothing group resolution
- Fortification contamination across groups
- Resistance contamination across groups
- Multiple attacks per phase
- Undo/cancel attack declaration
- UI for group selection and pool display

### Out of Scope
- Non-combat immunity contamination (separate ticket - already created)
- Attack phase (melee) - uses similar but distinct mechanics
- Block phase mechanics
- Individual enemy abilities (Elusive, Defend, etc.)

## Proposed Approach

### Phase 1: New State Model

Replace per-enemy damage tracking with attack declaration model:

```typescript
interface RangedSiegeAttackDeclaration {
  targetGroup: readonly string[]; // Enemy instance IDs
  attackPool: AttackPool;
  attackType: 'ranged' | 'siege';
  isCommitted: boolean; // True after cards played, before resolution
}

interface AttackPool {
  physical: number;
  fire: number;
  ice: number;
  coldFire: number;
}

// Add to CombatState
interface CombatState {
  // ... existing fields
  currentAttackDeclaration: RangedSiegeAttackDeclaration | null;
  completedAttacksThisPhase: number;
}
```

### Phase 2: Group Contamination Helpers

```typescript
function getGroupFortificationLevel(
  group: CombatEnemy[],
  isAtFortifiedSite: boolean
): 0 | 1 | 2 {
  return Math.max(...group.map(e =>
    getEnemyFortificationLevel(e, isAtFortifiedSite)
  ));
}

function canAttackGroup(
  group: CombatEnemy[],
  attackType: 'ranged' | 'siege',
  isAtFortifiedSite: boolean
): boolean {
  const fortLevel = getGroupFortificationLevel(group, isAtFortifiedSite);
  if (fortLevel === 2) return false;
  if (fortLevel === 1 && attackType === 'ranged') return false;
  return true;
}

function getGroupResistances(group: CombatEnemy[]): GroupResistances {
  return {
    physical: group.some(e => e.definition.abilities?.physicalResistance),
    fire: group.some(e => e.definition.abilities?.fireResistance),
    ice: group.some(e => e.definition.abilities?.iceResistance),
    hasBothFireAndIce: group.some(e =>
      e.definition.abilities?.fireResistance &&
      e.definition.abilities?.iceResistance
    ),
  };
}

function calculateEffectiveAttack(
  pool: AttackPool,
  groupResistances: GroupResistances
): number {
  let total = 0;
  total += groupResistances.physical
    ? Math.floor(pool.physical / 2)
    : pool.physical;
  total += groupResistances.fire
    ? Math.floor(pool.fire / 2)
    : pool.fire;
  total += groupResistances.ice
    ? Math.floor(pool.ice / 2)
    : pool.ice;
  total += groupResistances.hasBothFireAndIce
    ? Math.floor(pool.coldFire / 2)
    : pool.coldFire;
  return total;
}
```

### Phase 3: New Commands

**DECLARE_ATTACK_TARGET** - Start attack, select group
```typescript
interface DeclareAttackTargetParams {
  playerId: string;
  targetEnemyIds: string[];
  attackType: 'ranged' | 'siege';
}
```

**ADD_TO_ATTACK_POOL** - Play card/ability, add to pool
```typescript
interface AddToAttackPoolParams {
  playerId: string;
  element: AttackElement;
  amount: number;
}
```

**RESOLVE_ATTACK** - Commit and resolve current attack
```typescript
interface ResolveAttackParams {
  playerId: string;
}
```

**CANCEL_ATTACK** - Undo current attack declaration
```typescript
interface CancelAttackParams {
  playerId: string;
}
```

### Phase 4: Resolution Logic

```typescript
function resolveAttack(
  state: GameState,
  declaration: RangedSiegeAttackDeclaration
): AttackResolution {
  const group = declaration.targetGroup.map(id =>
    state.combat!.enemies.find(e => e.instanceId === id)!
  );

  const combinedArmor = group.reduce(
    (sum, e) => sum + e.definition.armor, 0
  );

  const groupResistances = getGroupResistances(group);
  const effectiveAttack = calculateEffectiveAttack(
    declaration.attackPool,
    groupResistances
  );

  const isSuccessful = effectiveAttack >= combinedArmor;

  return {
    isSuccessful,
    defeatedEnemies: isSuccessful ? group : [],
    fameAwarded: isSuccessful
      ? group.reduce((sum, e) => sum + e.definition.fame, 0)
      : 0,
    effectiveAttack,
    combinedArmor,
  };
}
```

### Phase 5: Validation Updates

- Validate group selection is valid (enemies exist, not already defeated)
- Validate attack type allowed for group fortification level
- Validate player has attack resources before allowing ADD_TO_ATTACK_POOL
- Validate attack declaration exists before RESOLVE_ATTACK

### Phase 6: UI Requirements

**Target Selection**:
1. Player clicks "New Attack"
2. Player selects one or more enemy tokens to form group
3. Before any cards played: Display group contamination warnings
   - "Group contains fortified enemy - only Siege attacks allowed"
   - "Group contains Fire Resistant enemy - Fire attacks halved"
   - "Group contains doubly fortified enemy - cannot attack in this phase"
4. Player commits to group or cancels

**Attack Building**:
- Display running total of attack pool by element type
- Show armor totals (individual + combined)
- Real-time calculation: base values → halved values → final total vs combined armor
- Visual indicator: "Sufficient to defeat" vs "Insufficient"

**Undo Flow**:
- "Cancel Attack" button available until attack resolves
- Returns all played cards to appropriate zones
- Clears target selection
- Player can start new attack declaration

## Implementation Notes

### Migration Path

The current per-enemy assignment system needs significant refactoring:
1. Remove `pendingDamage` map from CombatState
2. Add `currentAttackDeclaration` to CombatState
3. Replace `assignAttackCommand` with new command set
4. Update `endCombatPhaseCommand` to use new resolution
5. Update all validators and valid actions

### Backward Compatibility

This is a breaking change to combat mechanics. Tests will need updating to use new flow.

### Files to Modify

**Core changes**:
- `packages/core/src/types/combat.ts` - New state model
- `packages/core/src/engine/commands/combat/` - New command files
- `packages/core/src/engine/combat/elementalCalc.ts` - Group resistance helpers
- `packages/core/src/engine/validators/combatValidators/` - New validators
- `packages/core/src/engine/validActions/combat.ts` - Valid actions for new flow

**Test updates**:
- All `packages/core/src/engine/__tests__/combat*.test.ts` files

### Edge Cases

- **Empty group attack**: Not allowed, must target at least one enemy
- **Player has insufficient cards**: Undo mechanism handles this
- **Mixed fortification sources**: Single fort from site + single fort from ability on different enemies = both singly fortified, NOT double
- **Unfortified ability**: Cancels fortification on that specific token, doesn't affect group contamination from other tokens

## Acceptance Criteria

### Attack Pool System
- [ ] Player must select target group before playing attack cards
- [ ] All attack cards/abilities add to single pool
- [ ] Pool compared against combined armor of group
- [ ] Pool ≥ combined armor → ALL enemies defeated
- [ ] Pool < combined armor → NO enemies defeated

### Multiple Attacks
- [ ] Player can declare multiple separate attacks per phase
- [ ] Each attack resolves independently
- [ ] Defeated enemies removed from subsequent attack options

### Fortification Contamination
- [ ] Group fortification = max of any member's fortification
- [ ] Single fortification blocks Ranged attacks
- [ ] Double fortification blocks all Ranged/Siege attacks
- [ ] Site + enemy ability on same enemy = double fortification
- [ ] Site + enemy ability on different enemies = both single (not double)

### Resistance Contamination
- [ ] Group resistance = any member has resistance
- [ ] Matching attacks halved against group
- [ ] Cold Fire halved only if single enemy has both resistances
- [ ] Non-combat immunity does NOT contaminate (per-enemy)

### Undo/Cancel
- [ ] Can cancel attack before resolution
- [ ] Cards returned to hand/zone on cancel
- [ ] Can start new attack after cancel

### UI
- [ ] Group selection interface
- [ ] Contamination warnings displayed
- [ ] Attack pool running total shown
- [ ] Effective damage vs armor comparison shown

## Test Plan

### Manual
1. Start combat with multiple enemies
2. Declare attack targeting 2+ enemies
3. Play attack cards, observe pool accumulation
4. Verify all-or-nothing resolution
5. Test fortification blocking (single and double)
6. Test resistance halving across group
7. Test cancel/undo mid-attack

### Automated

**Basic Pool System**:
- 10 damage vs [5 armor, 5 armor] → both die
- 9 damage vs [5 armor, 5 armor] → neither dies
- Sequential attacks: 5 vs [5], then 5 vs [5] → both die

**Fortification**:
- Ranged blocked against [fortified, unfortified] group
- Siege allowed against [fortified, unfortified] group
- No attacks against [double fortified, unfortified] group

**Resistance Contamination**:
- Fire 10 vs [Fire Res 5 armor, No Res 5 armor] = 5 total → both survive
- Ice 10 vs [Fire Res 5 armor, No Res 5 armor] = 10 total → both die
- Cold Fire NOT halved when Fire Res and Ice Res on different enemies
- Cold Fire halved when single enemy has both Fire AND Ice Res

**Undo Mechanism**:
- Cards returned correctly when attack cancelled
- Can change target group after undo
- Can play different cards after undo

## Open Questions

- Should attack phase (melee) use similar group mechanics? (Probably yes, but separate ticket)
- How should Elusive/Defend modifiers display in UI when they don't contaminate?
- Should there be a confirmation before resolving insufficient attacks?

## Related Tickets

- `elemental-resistance-blocks-non-combat-effects.md` - Non-combat immunity (does NOT contaminate)
- `auto-advance-combat-phases.md` - Phase advancement logic
- `unit-combat-integration.md` - Unit attacks in pool
