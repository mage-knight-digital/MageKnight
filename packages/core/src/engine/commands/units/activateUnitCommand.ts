/**
 * Activate unit command
 *
 * Activates a unit's ability in combat, marking it as spent.
 * Unit abilities contribute to combat (attack/block values) and
 * must match the current combat phase.
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { GameEvent, ManaSourceInfo } from "@mage-knight/shared";
import {
  UNIT_ACTIVATED,
  getUnit,
  UNIT_STATE_SPENT,
  UNIT_STATE_READY,
  ELEMENT_PHYSICAL,
} from "@mage-knight/shared";
import {
  addAbilityToAccumulator,
  removeAbilityFromAccumulator,
} from "./helpers/combatAccumulatorHelpers.js";
import { applyNonCombatAbility } from "./helpers/nonCombatAbilityHelpers.js";
import { applyTerrainModifiers } from "./helpers/terrainModifierHelpers.js";
import {
  consumeManaForAbility,
  restoreManaForAbility,
} from "./helpers/manaConsumptionHelpers.js";

export const ACTIVATE_UNIT_COMMAND = "ACTIVATE_UNIT" as const;

export interface ActivateUnitCommandParams {
  readonly playerId: string;
  readonly unitInstanceId: string;
  readonly abilityIndex: number;
  /**
   * Mana source used to pay for abilities with manaCost.
   * Required when the ability has a manaCost defined.
   */
  readonly manaSource?: ManaSourceInfo;
}

export function createActivateUnitCommand(
  params: ActivateUnitCommandParams
): Command {
  // Store mana consumption info for undo
  let consumedManaSource: ManaSourceInfo | null = null;

  return {
    type: ACTIVATE_UNIT_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      let player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const unitIndex = player.units.findIndex(
        (u) => u.instanceId === params.unitInstanceId
      );
      if (unitIndex === -1) {
        throw new Error(`Unit not found: ${params.unitInstanceId}`);
      }

      const unit = player.units[unitIndex];
      if (!unit) {
        throw new Error(`Unit not found: ${params.unitInstanceId}`);
      }

      const unitDef = getUnit(unit.unitId);
      const ability = unitDef.abilities[params.abilityIndex];
      if (!ability) {
        throw new Error(`Invalid ability index: ${params.abilityIndex}`);
      }

      // Get the ability value (default to 0 for abilities without values)
      const abilityValue = ability.value ?? 0;

      // Track source updates (for die usage)
      let updatedSource = state.source;

      // Handle mana consumption if ability has mana cost
      if (ability.manaCost && params.manaSource) {
        consumedManaSource = params.manaSource;
        const manaResult = consumeManaForAbility(
          player,
          state.source,
          params.manaSource,
          params.playerId
        );
        player = manaResult.player;
        updatedSource = manaResult.source;
      }

      // Mark unit as spent
      const updatedUnits = [...player.units];
      updatedUnits[unitIndex] = {
        ...unit,
        state: UNIT_STATE_SPENT,
      };

      // Update combat accumulator (for combat abilities)
      const updatedAccumulator = addAbilityToAccumulator(
        player.combatAccumulator,
        ability.type,
        abilityValue,
        ability.element
      );

      // Apply non-combat ability effects (heal, move, influence)
      const nonCombatResult = applyNonCombatAbility(
        { ...player, units: updatedUnits, combatAccumulator: updatedAccumulator },
        ability.type,
        abilityValue
      );

      const updatedPlayer = nonCombatResult.player;

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      // Update wound pile if healing occurred
      const newWoundPileCount =
        state.woundPileCount === null
          ? null
          : state.woundPileCount + nonCombatResult.woundPileCountDelta;

      // Build intermediate state with player and wound updates
      let updatedState: GameState = {
        ...state,
        players,
        woundPileCount: newWoundPileCount,
      };

      // Apply terrain modifiers if the ability has them (e.g., Foresters)
      if (ability.terrainModifiers && ability.terrainModifiers.length > 0) {
        updatedState = applyTerrainModifiers(
          updatedState,
          params.playerId,
          unitIndex,
          ability.terrainModifiers
        );
      }

      const events: GameEvent[] = [
        {
          type: UNIT_ACTIVATED,
          playerId: params.playerId,
          unitInstanceId: params.unitInstanceId,
          abilityUsed: ability.type,
          abilityValue,
          element: ability.element ?? ELEMENT_PHYSICAL,
        },
      ];

      return {
        state: { ...updatedState, source: updatedSource },
        events,
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      let player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const unitIndex = player.units.findIndex(
        (u) => u.instanceId === params.unitInstanceId
      );
      if (unitIndex === -1) {
        throw new Error(`Unit not found: ${params.unitInstanceId}`);
      }

      const unit = player.units[unitIndex];
      if (!unit) {
        throw new Error(`Unit not found: ${params.unitInstanceId}`);
      }

      const unitDef = getUnit(unit.unitId);
      const ability = unitDef.abilities[params.abilityIndex];
      const abilityValue = ability?.value ?? 0;

      // Track source updates (for die restoration)
      let updatedSource = state.source;

      // Restore mana if it was consumed
      if (consumedManaSource) {
        const manaResult = restoreManaForAbility(
          player,
          state.source,
          consumedManaSource
        );
        player = manaResult.player;
        updatedSource = manaResult.source;
      }

      // Restore unit to ready
      const updatedUnits = [...player.units];
      updatedUnits[unitIndex] = {
        ...unit,
        state: UNIT_STATE_READY,
      };

      // Remove ability from combat accumulator
      const updatedAccumulator = ability
        ? removeAbilityFromAccumulator(
            player.combatAccumulator,
            ability.type,
            abilityValue,
            ability.element
          )
        : player.combatAccumulator;

      const updatedPlayer = {
        ...player,
        units: updatedUnits,
        combatAccumulator: updatedAccumulator,
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      return {
        state: { ...state, players, source: updatedSource },
        events: [],
      };
    },
  };
}
