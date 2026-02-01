/**
 * Elemental value helpers for unit ability activation
 *
 * Handles mapping between Element types and ElementalAttackValues keys,
 * and arithmetic operations on elemental value objects.
 */

import type { Element } from "@mage-knight/shared";
import {
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
  ELEMENT_PHYSICAL,
} from "@mage-knight/shared";
import type { ElementalAttackValues } from "../../../../types/player.js";

/**
 * Get the element key for the ElementalAttackValues interface
 */
export function getElementKey(
  element: Element | undefined
): keyof ElementalAttackValues {
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
export function addToElementalValues(
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
export function subtractFromElementalValues(
  values: ElementalAttackValues,
  elementKey: keyof ElementalAttackValues,
  amount: number
): ElementalAttackValues {
  return {
    ...values,
    [elementKey]: Math.max(0, values[elementKey] - amount),
  };
}
