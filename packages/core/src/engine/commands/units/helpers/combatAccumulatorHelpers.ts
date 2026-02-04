/**
 * Combat accumulator helpers for unit ability activation
 *
 * Handles adding and removing unit ability values to/from
 * the combat accumulator during combat phases.
 */

import type { Element, UnitAbilityType } from "@mage-knight/shared";
import {
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
} from "@mage-knight/shared";
import type { CombatAccumulator } from "../../../../types/player.js";
import {
  getElementKey,
  addToElementalValues,
  subtractFromElementalValues,
} from "./elementalHelpers.js";

/**
 * Add unit ability value to combat accumulator
 */
export function addAbilityToAccumulator(
  accumulator: CombatAccumulator,
  abilityType: UnitAbilityType,
  value: number,
  element: Element | undefined,
  countsTwiceAgainstSwift?: boolean
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
        swiftBlockElements: countsTwiceAgainstSwift
          ? addToElementalValues(accumulator.swiftBlockElements, elementKey, value)
          : accumulator.swiftBlockElements,
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
 * Remove unit ability value from combat accumulator (for undo)
 */
export function removeAbilityFromAccumulator(
  accumulator: CombatAccumulator,
  abilityType: UnitAbilityType,
  value: number,
  element: Element | undefined,
  countsTwiceAgainstSwift?: boolean
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
        swiftBlockElements: countsTwiceAgainstSwift
          ? subtractFromElementalValues(
              accumulator.swiftBlockElements,
              elementKey,
              value
            )
          : accumulator.swiftBlockElements,
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
