/**
 * Elemental Value Helpers
 *
 * Utility functions for accessing and manipulating elemental attack/block values.
 * Used by combat assignment validators and commands.
 */

import type { AttackElement } from "@mage-knight/shared";
import {
  ATTACK_ELEMENT_FIRE,
  ATTACK_ELEMENT_ICE,
  ATTACK_ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import type { ElementalAttackValues } from "../../types/player.js";

/**
 * Get the value for a specific element from an ElementalAttackValues object.
 */
export function getElementalValue(
  elements: ElementalAttackValues,
  element: AttackElement
): number {
  switch (element) {
    case ATTACK_ELEMENT_FIRE:
      return elements.fire;
    case ATTACK_ELEMENT_ICE:
      return elements.ice;
    case ATTACK_ELEMENT_COLD_FIRE:
      return elements.coldFire;
    default:
      return elements.physical;
  }
}

/**
 * Create a new ElementalAttackValues with an amount added to a specific element.
 */
export function addToElementalValues(
  values: ElementalAttackValues,
  element: AttackElement,
  amount: number
): ElementalAttackValues {
  switch (element) {
    case ATTACK_ELEMENT_FIRE:
      return { ...values, fire: values.fire + amount };
    case ATTACK_ELEMENT_ICE:
      return { ...values, ice: values.ice + amount };
    case ATTACK_ELEMENT_COLD_FIRE:
      return { ...values, coldFire: values.coldFire + amount };
    default:
      return { ...values, physical: values.physical + amount };
  }
}
