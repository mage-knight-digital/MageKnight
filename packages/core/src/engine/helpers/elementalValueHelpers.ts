/**
 * Elemental Value Helpers
 *
 * Utility functions for accessing and manipulating elemental attack/block values.
 * Used by combat assignment validators and commands.
 *
 * Works with two types:
 * - ElementalAttackValues: player's accumulated/assigned attack/block
 * - PendingElementalDamage: damage/block assigned to specific enemies
 *
 * Both types have the same shape: { physical, fire, ice, coldFire }
 */

import type { AttackElement } from "@mage-knight/shared";
import {
  ATTACK_ELEMENT_FIRE,
  ATTACK_ELEMENT_ICE,
  ATTACK_ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import type { ElementalAttackValues } from "../../types/player.js";
import type { PendingElementalDamage } from "../../types/combat.js";

// ============================================================================
// ElementalAttackValues helpers (player accumulated/assigned values)
// ============================================================================

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

/**
 * Create a new ElementalAttackValues with an amount subtracted from a specific element.
 */
export function subtractFromElementalValues(
  values: ElementalAttackValues,
  element: AttackElement,
  amount: number
): ElementalAttackValues {
  switch (element) {
    case ATTACK_ELEMENT_FIRE:
      return { ...values, fire: values.fire - amount };
    case ATTACK_ELEMENT_ICE:
      return { ...values, ice: values.ice - amount };
    case ATTACK_ELEMENT_COLD_FIRE:
      return { ...values, coldFire: values.coldFire - amount };
    default:
      return { ...values, physical: values.physical - amount };
  }
}

// ============================================================================
// PendingElementalDamage helpers (damage/block assigned to enemies)
// ============================================================================

/**
 * Get the value for a specific element from a PendingElementalDamage object.
 * Returns 0 if pending is undefined.
 */
export function getPendingElementalValue(
  pending: PendingElementalDamage | undefined,
  element: AttackElement
): number {
  if (!pending) return 0;

  switch (element) {
    case ATTACK_ELEMENT_FIRE:
      return pending.fire;
    case ATTACK_ELEMENT_ICE:
      return pending.ice;
    case ATTACK_ELEMENT_COLD_FIRE:
      return pending.coldFire;
    default:
      return pending.physical;
  }
}

/**
 * Create a new PendingElementalDamage with an amount added to a specific element.
 */
export function addToPendingElemental(
  pending: PendingElementalDamage,
  element: AttackElement,
  amount: number
): PendingElementalDamage {
  switch (element) {
    case ATTACK_ELEMENT_FIRE:
      return { ...pending, fire: pending.fire + amount };
    case ATTACK_ELEMENT_ICE:
      return { ...pending, ice: pending.ice + amount };
    case ATTACK_ELEMENT_COLD_FIRE:
      return { ...pending, coldFire: pending.coldFire + amount };
    default:
      return { ...pending, physical: pending.physical + amount };
  }
}

/**
 * Create a new PendingElementalDamage with an amount subtracted from a specific element.
 */
export function subtractFromPendingElemental(
  pending: PendingElementalDamage,
  element: AttackElement,
  amount: number
): PendingElementalDamage {
  switch (element) {
    case ATTACK_ELEMENT_FIRE:
      return { ...pending, fire: pending.fire - amount };
    case ATTACK_ELEMENT_ICE:
      return { ...pending, ice: pending.ice - amount };
    case ATTACK_ELEMENT_COLD_FIRE:
      return { ...pending, coldFire: pending.coldFire - amount };
    default:
      return { ...pending, physical: pending.physical - amount };
  }
}

/**
 * Check if all values in a PendingElementalDamage are zero.
 */
export function isPendingElementalEmpty(pending: PendingElementalDamage): boolean {
  return (
    pending.physical === 0 &&
    pending.fire === 0 &&
    pending.ice === 0 &&
    pending.coldFire === 0
  );
}

/**
 * Sum a specific element's value across all enemies in a pending damage/block map.
 * Used for tracking swift block assignments across multiple enemies.
 */
export function sumPendingElementalForElement(
  pendingMap: Record<string, PendingElementalDamage>,
  element: AttackElement
): number {
  let total = 0;

  for (const pending of Object.values(pendingMap)) {
    total += getPendingElementalValue(pending, element);
  }

  return total;
}
