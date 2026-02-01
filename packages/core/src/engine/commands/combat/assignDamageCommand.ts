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
import type { GameEvent, DamageAssignment } from "@mage-knight/shared";
import {
  DAMAGE_ASSIGNED,
  DAMAGE_TARGET_HERO,
  DAMAGE_TARGET_UNIT,
} from "@mage-knight/shared";
import {
  getEnemyAttack,
  getEnemyAttackCount,
  isAttackBlocked,
  isAttackDamageAssigned,
} from "../../combat/enemyAttackHelpers.js";
import {
  getEffectiveDamage,
  isPoisonActive,
  isParalyzeActive,
} from "./abilityHelpers.js";
import { processUnitDamage } from "./unitDamageProcessing.js";
import { applyHeroWounds } from "./heroDamageProcessing.js";

export const ASSIGN_DAMAGE_COMMAND = "ASSIGN_DAMAGE" as const;

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
      const totalDamage = getEffectiveDamage(
        enemy,
        attackIndex,
        state,
        params.playerId
      );
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
          const result = processUnitAssignment(
            updatedPlayer,
            assignment,
            attackElement,
            params.playerId,
            isPoisoned,
            isParalyzed
          );
          updatedPlayer = result.player;
          heroWounds += result.heroWounds;
          events.push(...result.events);
        } else {
          // Hero damage
          heroWounds += Math.ceil(assignment.amount / updatedPlayer.armor);
        }
      }

      // Apply hero wounds
      if (heroWounds > 0) {
        const woundResult = applyHeroWounds(
          updatedPlayer,
          heroWounds,
          params.playerId,
          isPoisoned,
          isParalyzed,
          state.combat.woundsThisCombat
        );
        updatedPlayer = woundResult.player;
        events.push(...woundResult.events);
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

      // Mark attack as having damage assigned
      const updatedEnemies = updateEnemyDamageAssigned(
        state.combat.enemies,
        params.enemyInstanceId,
        attackIndex,
        attackCount
      );

      // Only wounds to HAND count for knockout tracking
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

// ============================================================================
// Helper Functions
// ============================================================================

interface UnitAssignmentResult {
  player: Player;
  heroWounds: number;
  events: GameEvent[];
}

/**
 * Process a damage assignment to a unit.
 */
function processUnitAssignment(
  player: Player,
  assignment: DamageAssignment,
  attackElement: import("@mage-knight/shared").Element,
  playerId: string,
  isPoisoned: boolean,
  isParalyzed: boolean
): UnitAssignmentResult {
  if (!assignment.unitInstanceId) {
    throw new Error("Unit instance ID required for unit damage");
  }

  const unitIndex = player.units.findIndex(
    (u) => u.instanceId === assignment.unitInstanceId
  );
  if (unitIndex === -1) {
    throw new Error(`Unit not found: ${assignment.unitInstanceId}`);
  }

  const unit = player.units[unitIndex];
  if (!unit) {
    throw new Error(`Unit not found at index: ${unitIndex}`);
  }

  const result = processUnitDamage(
    unit,
    assignment.amount,
    attackElement,
    playerId,
    isPoisoned,
    isParalyzed
  );

  let updatedPlayer: Player;
  if (result.destroyed) {
    // Remove destroyed unit
    updatedPlayer = {
      ...player,
      units: player.units.filter((_, i) => i !== unitIndex),
    };
  } else {
    // Update unit state
    const updatedUnits = [...player.units];
    updatedUnits[unitIndex] = result.unit;
    updatedPlayer = { ...player, units: updatedUnits };
  }

  // Any remaining damage after unit absorption goes to hero
  const heroWounds =
    result.damageRemaining > 0
      ? Math.ceil(result.damageRemaining / player.armor)
      : 0;

  return {
    player: updatedPlayer,
    heroWounds,
    events: result.events,
  };
}

/**
 * Update enemy state to mark attack damage as assigned.
 */
function updateEnemyDamageAssigned(
  enemies: readonly import("../../../types/combat.js").CombatEnemy[],
  enemyInstanceId: string,
  attackIndex: number,
  attackCount: number
): import("../../../types/combat.js").CombatEnemy[] {
  return enemies.map((e) => {
    if (e.instanceId !== enemyInstanceId) return e;

    // For multi-attack enemies, update the attacksDamageAssigned array
    if (attackCount > 1) {
      // Initialize attacksDamageAssigned if not present
      const currentAttacksDamageAssigned =
        e.attacksDamageAssigned ?? new Array(attackCount).fill(false);
      const newAttacksDamageAssigned = [...currentAttacksDamageAssigned];
      newAttacksDamageAssigned[attackIndex] = true;

      // Check if ALL unblocked attacks now have damage assigned
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
}
