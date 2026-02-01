/**
 * Assign damage command
 *
 * Handles damage assignment to hero and/or units.
 * Units can absorb damage based on their armor value.
 * Resistant units can absorb damage without being wounded if damage <= armor.
 *
 * Multi-attack support:
 * - For multi-attack enemies, attackIndex specifies which attack's damage to assign
 * - Each attack's damage is handled separately
 * - Enemy is only marked as "fully assigned" when all unblocked attacks have damage assigned
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { PlayerUnit } from "../../../types/unit.js";
import type { CombatEnemy } from "../../../types/combat.js";
import type { CardId, GameEvent, DamageAssignment, EnemyAbilityType } from "@mage-knight/shared";
import {
  DAMAGE_ASSIGNED,
  PLAYER_KNOCKED_OUT,
  PARALYZE_HAND_DISCARDED,
  CARD_WOUND,
  UNIT_WOUNDED,
  UNIT_DESTROYED,
  DAMAGE_TARGET_HERO,
  DAMAGE_TARGET_UNIT,
  UNIT_DESTROY_REASON_DOUBLE_WOUND,
  UNIT_DESTROY_REASON_POISON,
  UNIT_DESTROY_REASON_PARALYZE,
  ABILITY_BRUTAL,
  ABILITY_POISON,
  ABILITY_PARALYZE,
  getUnit,
} from "@mage-knight/shared";
import { isAttackResisted } from "../../combat/elementalCalc.js";
import { isAbilityNullified } from "../../modifiers/index.js";
import {
  getEnemyAttack,
  getEnemyAttacks,
  getEnemyAttackCount,
  isAttackBlocked,
  isAttackDamageAssigned,
} from "../../combat/enemyAttackHelpers.js";

export const ASSIGN_DAMAGE_COMMAND = "ASSIGN_DAMAGE" as const;

/**
 * Check if an enemy has a specific ability
 */
function hasAbility(enemy: CombatEnemy, abilityType: EnemyAbilityType): boolean {
  return enemy.definition.abilities.includes(abilityType);
}

/**
 * Check if enemy's brutal ability is active (not nullified)
 * Brutal: DOUBLES the damage dealt by the enemy attack
 */
function isBrutalActive(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): boolean {
  if (!hasAbility(enemy, ABILITY_BRUTAL)) return false;
  return !isAbilityNullified(state, playerId, enemy.instanceId, ABILITY_BRUTAL);
}

/**
 * Check if enemy's poison ability is active (not nullified)
 * Poison (hero): wounds go to hand AND matching wounds go to discard
 * Poison (unit): unit receives 2 wounds immediately = destroyed
 */
function isPoisonActive(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): boolean {
  if (!hasAbility(enemy, ABILITY_POISON)) return false;
  return !isAbilityNullified(state, playerId, enemy.instanceId, ABILITY_POISON);
}

/**
 * Check if enemy's paralyze ability is active (not nullified)
 * Paralyze (hero): discard all non-wound cards from hand when wounds are taken
 * Paralyze (unit): unit is immediately destroyed when it would be wounded
 */
function isParalyzeActive(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): boolean {
  if (!hasAbility(enemy, ABILITY_PARALYZE)) return false;
  return !isAbilityNullified(state, playerId, enemy.instanceId, ABILITY_PARALYZE);
}

/**
 * Get effective damage from a specific attack
 * Brutal: doubles the damage
 *
 * @param enemy - Combat enemy instance
 * @param attackIndex - Which attack's damage to calculate (0-indexed)
 * @param state - Game state
 * @param playerId - Player receiving damage
 */
function getEffectiveDamage(
  enemy: CombatEnemy,
  attackIndex: number,
  state: GameState,
  playerId: string
): number {
  const attacks = getEnemyAttacks(enemy);
  const attack = attacks[attackIndex];
  if (!attack) {
    throw new Error(
      `Attack index ${attackIndex} out of range (enemy has ${attacks.length} attacks)`
    );
  }

  let damage = attack.damage;

  // Brutal doubles the damage
  if (isBrutalActive(state, playerId, enemy)) {
    damage *= 2;
  }

  return damage;
}

export interface AssignDamageCommandParams {
  readonly playerId: string;
  readonly enemyInstanceId: string;
  /**
   * For multi-attack enemies, specifies which attack's damage to assign (0-indexed).
   * Defaults to 0 for single-attack enemies or when not specified.
   */
  readonly attackIndex?: number;
  readonly assignments?: readonly DamageAssignment[];
}

/**
 * Process damage assigned to a unit.
 * Returns the updated unit, any remaining damage, and events.
 *
 * Poison: If a unit would be wounded by a poison attack, it receives 2 wounds
 * and is immediately destroyed (since units can only take 1 wound before death).
 *
 * Paralyze: If a unit would be wounded by a paralyze attack, it is immediately
 * destroyed (similar to poison, but the unit still absorbs its armor value).
 */
function processUnitDamage(
  unit: PlayerUnit,
  damageAmount: number,
  attackElement: import("@mage-knight/shared").Element,
  playerId: string,
  isPoisoned: boolean,
  isParalyzed: boolean
): {
  unit: PlayerUnit;
  damageRemaining: number;
  events: GameEvent[];
  destroyed: boolean;
} {
  const unitDef = getUnit(unit.unitId);
  const events: GameEvent[] = [];

  // Check if unit has resistance to this attack element
  const isResistant = isAttackResisted(attackElement, unitDef.resistances);

  let damageRemaining = damageAmount;
  let unitWounded = unit.wounded;
  let usedResistance = unit.usedResistanceThisCombat;
  let destroyed = false;
  let destroyReason: typeof UNIT_DESTROY_REASON_DOUBLE_WOUND | typeof UNIT_DESTROY_REASON_POISON | typeof UNIT_DESTROY_REASON_PARALYZE =
    UNIT_DESTROY_REASON_DOUBLE_WOUND;

  if (isResistant && !unit.wounded && !unit.usedResistanceThisCombat) {
    // Resistant unit (not previously wounded, hasn't used resistance this combat):
    // First, reduce damage by armor
    damageRemaining = Math.max(0, damageRemaining - unitDef.armor);

    if (damageRemaining > 0) {
      // Still damage remaining after first armor reduction: wound the unit
      unitWounded = true;

      // Paralyze: if unit would be wounded, it is immediately destroyed
      if (isParalyzed) {
        destroyed = true;
        destroyReason = UNIT_DESTROY_REASON_PARALYZE;
        damageRemaining = Math.max(0, damageRemaining - unitDef.armor);
      // Poison: if unit would be wounded, it gets 2 wounds = destroyed
      } else if (isPoisoned) {
        destroyed = true;
        destroyReason = UNIT_DESTROY_REASON_POISON;
        damageRemaining = Math.max(0, damageRemaining - unitDef.armor);
      } else {
        // Apply armor reduction again for wounded unit
        damageRemaining = Math.max(0, damageRemaining - unitDef.armor);
      }
    } else {
      // Absorbed without wound, mark resistance as used for this combat
      usedResistance = true;
    }
  } else {
    // Non-resistant OR already wounded/used resistance:
    // If already wounded, this is a second wound = destroyed
    if (unit.wounded) {
      destroyed = true;
      // Destroyed units don't absorb anything beyond what causes destruction
      damageRemaining = Math.max(0, damageRemaining - unitDef.armor);
    } else {
      // First wound: apply armor and wound
      unitWounded = true;

      // Paralyze: if unit would be wounded, it is immediately destroyed
      if (isParalyzed) {
        destroyed = true;
        destroyReason = UNIT_DESTROY_REASON_PARALYZE;
        damageRemaining = Math.max(0, damageRemaining - unitDef.armor);
      // Poison: if unit would be wounded, it gets 2 wounds = destroyed
      } else if (isPoisoned) {
        destroyed = true;
        destroyReason = UNIT_DESTROY_REASON_POISON;
        damageRemaining = Math.max(0, damageRemaining - unitDef.armor);
      } else {
        damageRemaining = Math.max(0, damageRemaining - unitDef.armor);
      }
    }
  }

  // Generate events
  const damageAbsorbed = damageAmount - damageRemaining;

  if (destroyed) {
    events.push({
      type: UNIT_DESTROYED,
      playerId,
      unitInstanceId: unit.instanceId,
      reason: destroyReason,
    });
  } else if (unitWounded && !unit.wounded) {
    // Only emit wound event if unit wasn't already wounded
    events.push({
      type: UNIT_WOUNDED,
      playerId,
      unitInstanceId: unit.instanceId,
      damageAbsorbed,
    });
  }

  const updatedUnit: PlayerUnit = {
    ...unit,
    wounded: unitWounded,
    usedResistanceThisCombat: usedResistance,
  };

  return {
    unit: updatedUnit,
    damageRemaining,
    events,
    destroyed,
  };
}

export function createAssignDamageCommand(
  params: AssignDamageCommandParams
): Command {
  return {
    type: ASSIGN_DAMAGE_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      const enemy = state.combat.enemies.find(
        (e) => e.instanceId === params.enemyInstanceId
      );
      if (!enemy) {
        throw new Error(`Enemy not found: ${params.enemyInstanceId}`);
      }

      // Get the attack index (default to 0 for single-attack enemies)
      const attackIndex = params.attackIndex ?? 0;
      const attackCount = getEnemyAttackCount(enemy);

      // Validate attack index
      if (attackIndex < 0 || attackIndex >= attackCount) {
        throw new Error(
          `Attack index ${attackIndex} out of range (enemy has ${attackCount} attacks)`
        );
      }

      // Check if this specific attack is blocked
      if (isAttackBlocked(enemy, attackIndex)) {
        throw new Error(`Attack ${attackIndex} is blocked - no damage to assign`);
      }

      // Check if this specific attack already has damage assigned
      if (isAttackDamageAssigned(enemy, attackIndex)) {
        throw new Error(`Attack ${attackIndex} already has damage assigned`);
      }

      if (enemy.isDefeated) {
        throw new Error("Enemy is defeated");
      }

      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Get the attack being resolved
      const attackBeingResolved = getEnemyAttack(enemy, attackIndex);

      // Get effective damage (Brutal doubles damage)
      const totalDamage = getEffectiveDamage(enemy, attackIndex, state, params.playerId);
      const attackElement = attackBeingResolved.element;
      const isPoisoned = isPoisonActive(state, params.playerId, enemy);
      const isParalyzed = isParalyzeActive(state, params.playerId, enemy);
      const events: GameEvent[] = [];

      let updatedPlayer: Player = player;
      let heroWounds = 0;

      // If no assignments provided, all damage goes to hero (backwards compatible)
      const assignments: readonly DamageAssignment[] = params.assignments ?? [
        { target: DAMAGE_TARGET_HERO, amount: totalDamage },
      ];

      // Process each assignment
      for (const assignment of assignments) {
        if (assignment.target === DAMAGE_TARGET_UNIT) {
          if (!assignment.unitInstanceId) {
            throw new Error("Unit instance ID required for unit damage");
          }

          const unitIndex = updatedPlayer.units.findIndex(
            (u) => u.instanceId === assignment.unitInstanceId
          );
          if (unitIndex === -1) {
            throw new Error(`Unit not found: ${assignment.unitInstanceId}`);
          }

          const unit = updatedPlayer.units[unitIndex];
          if (!unit) {
            throw new Error(`Unit not found at index: ${unitIndex}`);
          }
          const result = processUnitDamage(
            unit,
            assignment.amount,
            attackElement,
            params.playerId,
            isPoisoned,
            isParalyzed
          );

          events.push(...result.events);

          if (result.destroyed) {
            // Remove destroyed unit
            updatedPlayer = {
              ...updatedPlayer,
              units: updatedPlayer.units.filter(
                (_, i) => i !== unitIndex
              ),
            };
          } else {
            // Update unit state
            const updatedUnits = [...updatedPlayer.units];
            updatedUnits[unitIndex] = result.unit;
            updatedPlayer = { ...updatedPlayer, units: updatedUnits };
          }

          // Any remaining damage after unit absorption goes to hero
          if (result.damageRemaining > 0) {
            heroWounds += Math.ceil(result.damageRemaining / updatedPlayer.armor);
          }
        } else {
          // Hero damage
          heroWounds += Math.ceil(assignment.amount / updatedPlayer.armor);
        }
      }

      // Apply hero wounds
      // Poison (hero): wounds go to hand AND matching wounds go to discard
      if (heroWounds > 0) {
        const woundsToHand: CardId[] = Array(heroWounds).fill(CARD_WOUND);
        const woundsToDiscard: CardId[] = isPoisoned
          ? Array(heroWounds).fill(CARD_WOUND)
          : [];

        let newHand: CardId[] = [...updatedPlayer.hand, ...woundsToHand];
        let newDiscard: CardId[] = [...updatedPlayer.discard, ...woundsToDiscard];

        // Paralyze (hero): discard all non-wound cards from hand when wounds are taken
        if (isParalyzed) {
          const nonWoundsInHand = newHand.filter((cardId) => cardId !== CARD_WOUND);
          const woundsInHand = newHand.filter((cardId) => cardId === CARD_WOUND);

          if (nonWoundsInHand.length > 0) {
            newHand = woundsInHand;
            newDiscard = [...newDiscard, ...nonWoundsInHand];
            events.push({
              type: PARALYZE_HAND_DISCARDED,
              playerId: params.playerId,
              cardsDiscarded: nonWoundsInHand.length,
            });
          }
        }

        // Only wounds to HAND count for knockout tracking
        // Poison wounds to discard are extra punishment but don't count toward knockout threshold
        const totalWoundsThisCombat = state.combat.woundsThisCombat + heroWounds;

        // Check for knockout (wounds this combat >= hand limit)
        const isKnockedOut = totalWoundsThisCombat >= updatedPlayer.handLimit;

        let finalHand: readonly CardId[] = newHand;
        let finalDiscard: readonly CardId[] = newDiscard;
        if (isKnockedOut) {
          // Discard all non-wound cards from hand
          const nonWoundsToDiscard = newHand.filter((cardId) => cardId !== CARD_WOUND);
          finalHand = newHand.filter((cardId) => cardId === CARD_WOUND);
          finalDiscard = [...newDiscard, ...nonWoundsToDiscard];
          events.push({
            type: PLAYER_KNOCKED_OUT,
            playerId: params.playerId,
            woundsThisCombat: totalWoundsThisCombat,
          });
        }

        updatedPlayer = {
          ...updatedPlayer,
          hand: finalHand,
          discard: finalDiscard,
          knockedOut: isKnockedOut,
        };
      }

      // Emit the main damage assigned event (include attackIndex)
      // woundsTaken reflects wounds to hand (poison adds equal wounds to discard)
      events.unshift({
        type: DAMAGE_ASSIGNED,
        enemyInstanceId: params.enemyInstanceId,
        attackIndex,
        damage: totalDamage,
        woundsTaken: heroWounds,
      });

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

      // Mark attack as having damage assigned (update per-attack state for multi-attack enemies)
      const updatedEnemies = state.combat.enemies.map((e) => {
        if (e.instanceId !== params.enemyInstanceId) return e;

        // For multi-attack enemies, update the attacksDamageAssigned array
        if (attackCount > 1) {
          // Initialize attacksDamageAssigned if not present
          const currentAttacksDamageAssigned = e.attacksDamageAssigned ?? new Array(attackCount).fill(false);
          const newAttacksDamageAssigned = [...currentAttacksDamageAssigned];
          newAttacksDamageAssigned[attackIndex] = true;

          // Check if ALL unblocked attacks now have damage assigned
          // We need to check all attacks: blocked attacks don't need damage assigned
          let allUnblockedAssigned = true;
          for (let i = 0; i < attackCount; i++) {
            if (!isAttackBlocked(e, i) && !newAttacksDamageAssigned[i]) {
              allUnblockedAssigned = false;
              break;
            }
          }

          return {
            ...e,
            attacksDamageAssigned: newAttacksDamageAssigned,
            damageAssigned: allUnblockedAssigned, // Legacy flag: true only when all unblocked attacks assigned
          };
        }

        // For single-attack enemies, just set damageAssigned
        return { ...e, damageAssigned: true };
      });

      // Only wounds to HAND count for knockout tracking
      // Poison wounds to discard are extra punishment but don't count toward knockout threshold
      const combatWoundsThisCombat = state.combat.woundsThisCombat + heroWounds;

      const updatedCombat = {
        ...state.combat,
        enemies: updatedEnemies,
        woundsThisCombat: combatWoundsThisCombat,
      };

      return {
        state: { ...state, combat: updatedCombat, players: updatedPlayers },
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo ASSIGN_DAMAGE");
    },
  };
}
