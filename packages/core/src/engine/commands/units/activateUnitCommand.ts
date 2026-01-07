/**
 * Activate unit command
 *
 * Activates a unit's ability in combat, marking it as spent.
 * Unit abilities contribute to combat (attack/block values) and
 * must match the current combat phase.
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { GameEvent, UnitAbilityType, Element } from "@mage-knight/shared";
import {
  UNIT_ACTIVATED,
  getUnit,
  UNIT_STATE_SPENT,
  UNIT_STATE_READY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
  UNIT_ABILITY_HEAL,
  UNIT_ABILITY_MOVE,
  UNIT_ABILITY_INFLUENCE,
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
  CARD_WOUND,
} from "@mage-knight/shared";
import type { CombatAccumulator, ElementalAttackValues, Player } from "../../../types/player.js";

export const ACTIVATE_UNIT_COMMAND = "ACTIVATE_UNIT" as const;

export interface ActivateUnitCommandParams {
  readonly playerId: string;
  readonly unitInstanceId: string;
  readonly abilityIndex: number;
}

/**
 * Get the element key for the ElementalAttackValues interface
 */
function getElementKey(element: Element | undefined): keyof ElementalAttackValues {
  switch (element) {
    case ELEMENT_FIRE:
      return "fire";
    case ELEMENT_ICE:
      return "ice";
    case ELEMENT_COLD_FIRE:
      return "coldFire";
    case ELEMENT_PHYSICAL:
    default:
      return "physical";
  }
}

/**
 * Add value to elemental attack values
 */
function addToElementalValues(
  values: ElementalAttackValues,
  elementKey: keyof ElementalAttackValues,
  amount: number
): ElementalAttackValues {
  return {
    ...values,
    [elementKey]: values[elementKey] + amount,
  };
}

/**
 * Subtract value from elemental attack values (for undo)
 */
function subtractFromElementalValues(
  values: ElementalAttackValues,
  elementKey: keyof ElementalAttackValues,
  amount: number
): ElementalAttackValues {
  return {
    ...values,
    [elementKey]: Math.max(0, values[elementKey] - amount),
  };
}

/**
 * Add unit ability value to combat accumulator
 */
function addAbilityToAccumulator(
  accumulator: CombatAccumulator,
  abilityType: UnitAbilityType,
  value: number,
  element: Element | undefined
): CombatAccumulator {
  const elementKey = getElementKey(element);

  switch (abilityType) {
    case UNIT_ABILITY_ATTACK:
      return {
        ...accumulator,
        attack: {
          ...accumulator.attack,
          normal: accumulator.attack.normal + value,
          normalElements: addToElementalValues(
            accumulator.attack.normalElements,
            elementKey,
            value
          ),
        },
      };

    case UNIT_ABILITY_BLOCK:
      return {
        ...accumulator,
        block: accumulator.block + value,
        blockElements: addToElementalValues(
          accumulator.blockElements,
          elementKey,
          value
        ),
      };

    case UNIT_ABILITY_RANGED_ATTACK:
      return {
        ...accumulator,
        attack: {
          ...accumulator.attack,
          ranged: accumulator.attack.ranged + value,
          rangedElements: addToElementalValues(
            accumulator.attack.rangedElements,
            elementKey,
            value
          ),
        },
      };

    case UNIT_ABILITY_SIEGE_ATTACK:
      return {
        ...accumulator,
        attack: {
          ...accumulator.attack,
          siege: accumulator.attack.siege + value,
          siegeElements: addToElementalValues(
            accumulator.attack.siegeElements,
            elementKey,
            value
          ),
        },
      };

    default:
      // Non-combat abilities (move, influence, heal, etc.) don't affect accumulator
      return accumulator;
  }
}

/**
 * Apply non-combat ability effects (move, influence, heal)
 * Returns updated player and state changes
 */
interface NonCombatAbilityResult {
  readonly player: Player;
  readonly woundPileCountDelta: number;
}

function applyNonCombatAbility(
  player: Player,
  abilityType: UnitAbilityType,
  value: number
): NonCombatAbilityResult {
  switch (abilityType) {
    case UNIT_ABILITY_HEAL: {
      // Count wounds in hand
      const woundsInHand = player.hand.filter((c) => c === CARD_WOUND).length;
      const woundsToHeal = Math.min(value, woundsInHand);

      if (woundsToHeal === 0) {
        return { player, woundPileCountDelta: 0 };
      }

      // Remove wound cards from hand
      const newHand = [...player.hand];
      for (let i = 0; i < woundsToHeal; i++) {
        const woundIndex = newHand.indexOf(CARD_WOUND);
        if (woundIndex !== -1) {
          newHand.splice(woundIndex, 1);
        }
      }

      return {
        player: { ...player, hand: newHand },
        woundPileCountDelta: woundsToHeal, // Return healed wounds to pile
      };
    }

    case UNIT_ABILITY_MOVE: {
      // Add move points
      return {
        player: {
          ...player,
          movePoints: player.movePoints + value,
        },
        woundPileCountDelta: 0,
      };
    }

    case UNIT_ABILITY_INFLUENCE: {
      // Add influence points
      return {
        player: {
          ...player,
          influencePoints: player.influencePoints + value,
        },
        woundPileCountDelta: 0,
      };
    }

    default:
      // Combat abilities handled elsewhere
      return { player, woundPileCountDelta: 0 };
  }
}

/**
 * Remove unit ability value from combat accumulator (for undo)
 */
function removeAbilityFromAccumulator(
  accumulator: CombatAccumulator,
  abilityType: UnitAbilityType,
  value: number,
  element: Element | undefined
): CombatAccumulator {
  const elementKey = getElementKey(element);

  switch (abilityType) {
    case UNIT_ABILITY_ATTACK:
      return {
        ...accumulator,
        attack: {
          ...accumulator.attack,
          normal: Math.max(0, accumulator.attack.normal - value),
          normalElements: subtractFromElementalValues(
            accumulator.attack.normalElements,
            elementKey,
            value
          ),
        },
      };

    case UNIT_ABILITY_BLOCK:
      return {
        ...accumulator,
        block: Math.max(0, accumulator.block - value),
        blockElements: subtractFromElementalValues(
          accumulator.blockElements,
          elementKey,
          value
        ),
      };

    case UNIT_ABILITY_RANGED_ATTACK:
      return {
        ...accumulator,
        attack: {
          ...accumulator.attack,
          ranged: Math.max(0, accumulator.attack.ranged - value),
          rangedElements: subtractFromElementalValues(
            accumulator.attack.rangedElements,
            elementKey,
            value
          ),
        },
      };

    case UNIT_ABILITY_SIEGE_ATTACK:
      return {
        ...accumulator,
        attack: {
          ...accumulator.attack,
          siege: Math.max(0, accumulator.attack.siege - value),
          siegeElements: subtractFromElementalValues(
            accumulator.attack.siegeElements,
            elementKey,
            value
          ),
        },
      };

    default:
      return accumulator;
  }
}

export function createActivateUnitCommand(
  params: ActivateUnitCommandParams
): Command {
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

      const player = state.players[playerIndex];
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
      const newWoundPileCount = state.woundPileCount + nonCombatResult.woundPileCountDelta;

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
        state: { ...state, players, woundPileCount: newWoundPileCount },
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

      const player = state.players[playerIndex];
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
        state: { ...state, players },
        events: [],
      };
    },
  };
}
