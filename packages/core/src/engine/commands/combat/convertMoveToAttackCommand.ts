/**
 * Convert Move to Attack Command
 *
 * Allows player to spend accumulated move points during RANGED_SIEGE or ATTACK
 * phases to gain attack when the Agility move-to-attack conversion modifier is active.
 *
 * Basic Agility: 1 move = 1 melee attack (ATTACK phase)
 * Powered Agility: 1 move = 1 melee attack OR 2 move = 1 ranged attack
 *
 * REVERSIBLE: Can be undone until the phase is committed.
 *
 * @module engine/commands/combat/convertMoveToAttackCommand
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { MoveToAttackConversionModifier, ActiveModifier } from "../../../types/modifiers.js";
import type { AccumulatedAttack } from "../../../types/player.js";
import type { MoveToAttackConversionType } from "@mage-knight/shared";
import {
  CONVERSION_TYPE_RANGED,
  MOVE_CONVERTED_TO_ATTACK,
} from "@mage-knight/shared";
import {
  COMBAT_VALUE_RANGED,
  EFFECT_MOVE_TO_ATTACK_CONVERSION,
} from "../../../types/modifierConstants.js";
import { getModifiersForPlayer } from "../../modifiers/index.js";

export const CONVERT_MOVE_TO_ATTACK_COMMAND = "CONVERT_MOVE_TO_ATTACK" as const;

export interface ConvertMoveToAttackCommandParams {
  readonly playerId: string;
  readonly movePointsToSpend: number;
  readonly conversionType: MoveToAttackConversionType;
}

function findConversionModifier(
  modifiers: readonly ActiveModifier[],
  conversionType: MoveToAttackConversionType
): ActiveModifier | undefined {
  return modifiers.find((m) => {
    if (m.effect.type !== EFFECT_MOVE_TO_ATTACK_CONVERSION) return false;
    const effect = m.effect as MoveToAttackConversionModifier;
    if (conversionType === CONVERSION_TYPE_RANGED) {
      return effect.attackType === COMBAT_VALUE_RANGED;
    }
    return effect.attackType !== COMBAT_VALUE_RANGED;
  });
}

export function createConvertMoveToAttackCommand(
  params: ConvertMoveToAttackCommandParams
): Command {
  let previousMovePoints = 0;
  let previousAttack: AccumulatedAttack;

  return {
    type: CONVERT_MOVE_TO_ATTACK_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }
      const playerIndex = state.players.indexOf(player);

      const modifiers = getModifiersForPlayer(state, params.playerId);
      const modifier = findConversionModifier(modifiers, params.conversionType);

      if (!modifier) {
        throw new Error("No active move-to-attack conversion modifier");
      }

      const effect = modifier.effect as MoveToAttackConversionModifier;
      const attackGained = Math.floor(params.movePointsToSpend / effect.costPerPoint);

      // Capture for undo
      previousMovePoints = player.movePoints;
      previousAttack = player.combatAccumulator.attack;

      // Deduct move points
      const updatedMovePoints = player.movePoints - params.movePointsToSpend;

      // Add attack to accumulator based on conversion type
      let updatedAttack: AccumulatedAttack;
      if (params.conversionType === CONVERSION_TYPE_RANGED) {
        updatedAttack = {
          ...previousAttack,
          ranged: previousAttack.ranged + attackGained,
          rangedElements: {
            ...previousAttack.rangedElements,
            physical: previousAttack.rangedElements.physical + attackGained,
          },
        };
      } else {
        updatedAttack = {
          ...previousAttack,
          normal: previousAttack.normal + attackGained,
          normalElements: {
            ...previousAttack.normalElements,
            physical: previousAttack.normalElements.physical + attackGained,
          },
        };
      }

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              movePoints: updatedMovePoints,
              combatAccumulator: {
                ...p.combatAccumulator,
                attack: updatedAttack,
              },
            }
          : p
      );

      return {
        state: { ...state, players: updatedPlayers },
        events: [
          {
            type: MOVE_CONVERTED_TO_ATTACK,
            movePointsSpent: params.movePointsToSpend,
            attackGained,
            attackType: params.conversionType,
          },
        ],
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              movePoints: previousMovePoints,
              combatAccumulator: {
                ...p.combatAccumulator,
                attack: previousAttack,
              },
            }
          : p
      );

      return {
        state: { ...state, players: updatedPlayers },
        events: [],
      };
    },
  };
}
