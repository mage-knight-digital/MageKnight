/**
 * Assign damage command
 *
 * Handles damage assignment to hero and/or units.
 * Units can absorb damage based on their armor value.
 * Resistant units can absorb damage without being wounded if damage <= armor.
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { PlayerUnit } from "../../../types/unit.js";
import type { CardId, GameEvent, DamageAssignment } from "@mage-knight/shared";
import {
  DAMAGE_ASSIGNED,
  PLAYER_KNOCKED_OUT,
  CARD_WOUND,
  UNIT_WOUNDED,
  UNIT_DESTROYED,
  DAMAGE_TARGET_HERO,
  DAMAGE_TARGET_UNIT,
  UNIT_DESTROY_REASON_DOUBLE_WOUND,
  getUnit,
} from "@mage-knight/shared";
import { isAttackResisted } from "../../combat/elementalCalc.js";

export const ASSIGN_DAMAGE_COMMAND = "ASSIGN_DAMAGE" as const;

export interface AssignDamageCommandParams {
  readonly playerId: string;
  readonly enemyInstanceId: string;
  readonly assignments?: readonly DamageAssignment[];
}

/**
 * Process damage assigned to a unit.
 * Returns the updated unit, any remaining damage, and events.
 */
function processUnitDamage(
  unit: PlayerUnit,
  damageAmount: number,
  attackElement: import("@mage-knight/shared").Element,
  playerId: string
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

  if (isResistant && !unit.wounded && !unit.usedResistanceThisCombat) {
    // Resistant unit (not previously wounded, hasn't used resistance this combat):
    // First, reduce damage by armor
    damageRemaining = Math.max(0, damageRemaining - unitDef.armor);

    if (damageRemaining > 0) {
      // Still damage remaining after first armor reduction: wound the unit
      unitWounded = true;
      // Apply armor reduction again for wounded unit
      damageRemaining = Math.max(0, damageRemaining - unitDef.armor);
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
      damageRemaining = Math.max(0, damageRemaining - unitDef.armor);
    }
  }

  // Generate events
  const damageAbsorbed = damageAmount - damageRemaining;

  if (destroyed) {
    events.push({
      type: UNIT_DESTROYED,
      playerId,
      unitInstanceId: unit.instanceId,
      reason: UNIT_DESTROY_REASON_DOUBLE_WOUND,
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

      if (enemy.isBlocked || enemy.isDefeated) {
        throw new Error("Enemy is blocked or defeated");
      }

      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const totalDamage = enemy.definition.attack;
      const attackElement = enemy.definition.attackElement;
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
            params.playerId
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
      if (heroWounds > 0) {
        const newWounds: CardId[] = Array(heroWounds).fill(CARD_WOUND);
        const newHand: CardId[] = [...updatedPlayer.hand, ...newWounds];

        // Update wounds this combat for knockout tracking
        const totalWoundsThisCombat = state.combat.woundsThisCombat + heroWounds;

        // Check for knockout (wounds this combat >= hand limit)
        const isKnockedOut = totalWoundsThisCombat >= updatedPlayer.handLimit;

        let finalHand: readonly CardId[] = newHand;
        if (isKnockedOut) {
          // Discard all non-wound cards from hand
          finalHand = newHand.filter((cardId) => cardId === CARD_WOUND);
          events.push({
            type: PLAYER_KNOCKED_OUT,
            playerId: params.playerId,
            woundsThisCombat: totalWoundsThisCombat,
          });
        }

        updatedPlayer = {
          ...updatedPlayer,
          hand: finalHand,
          knockedOut: isKnockedOut,
        };
      }

      // Emit the main damage assigned event
      events.unshift({
        type: DAMAGE_ASSIGNED,
        enemyInstanceId: params.enemyInstanceId,
        damage: totalDamage,
        woundsTaken: heroWounds,
      });

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

      // Mark enemy as having damage assigned
      const updatedEnemies = state.combat.enemies.map((e) =>
        e.instanceId === params.enemyInstanceId
          ? { ...e, damageAssigned: true }
          : e
      );

      // Track wounds from hero only for knockout purposes
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
