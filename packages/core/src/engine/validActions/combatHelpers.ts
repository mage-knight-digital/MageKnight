/**
 * Combat helpers for ValidActions.
 *
 * Shared utility functions used across attack, block, and damage computation.
 */

import type {
  AttackElement,
  ElementalDamageValues,
} from "@mage-knight/shared";
import {
  ATTACK_ELEMENT_PHYSICAL,
  ATTACK_ELEMENT_FIRE,
  ATTACK_ELEMENT_ICE,
  ATTACK_ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import type { CombatEnemy } from "../../types/combat.js";
import type { GameState } from "../../state/GameState.js";
import { areResistancesRemoved } from "../modifiers/index.js";
import type { Resistances } from "../combat/elementalCalc.js";
import { isAttackResisted } from "../combat/elementalCalc.js";

// ============================================================================
// Enemy Resistance Helpers
// ============================================================================

/**
 * Get enemy resistances as Resistances type.
 * Returns empty array if resistances have been removed by a modifier (Expose spell).
 */
export function getEnemyResistances(state: GameState, enemy: CombatEnemy): Resistances {
  // Check if resistances have been removed by a modifier (Expose spell)
  if (areResistancesRemoved(state, enemy.instanceId)) {
    return [];
  }
  return enemy.definition.resistances;
}

// ============================================================================
// Element Type Conversion
// ============================================================================

/**
 * Map AttackElement to Element type for resistance calculation.
 */
export function attackElementToElement(element: AttackElement): "physical" | "fire" | "ice" | "cold_fire" {
  switch (element) {
    case ATTACK_ELEMENT_PHYSICAL:
      return "physical";
    case ATTACK_ELEMENT_FIRE:
      return "fire";
    case ATTACK_ELEMENT_ICE:
      return "ice";
    case ATTACK_ELEMENT_COLD_FIRE:
      return "cold_fire";
  }
}

// ============================================================================
// Effective Damage Computation
// ============================================================================

/**
 * Calculate effective damage for a single element, applying resistance halving.
 */
export function calculateEffectiveElement(
  rawValue: number,
  element: AttackElement,
  resistances: Resistances
): number {
  if (rawValue === 0) return 0;

  const elementType = attackElementToElement(element);
  const isResisted = isAttackResisted(elementType, resistances);

  return isResisted ? Math.floor(rawValue / 2) : rawValue;
}

/**
 * Calculate effective damage values from pending damage, applying resistances.
 */
export function calculateEffectiveDamage(
  pending: ElementalDamageValues,
  resistances: Resistances
): ElementalDamageValues {
  return {
    physical: calculateEffectiveElement(pending.physical, ATTACK_ELEMENT_PHYSICAL, resistances),
    fire: calculateEffectiveElement(pending.fire, ATTACK_ELEMENT_FIRE, resistances),
    ice: calculateEffectiveElement(pending.ice, ATTACK_ELEMENT_ICE, resistances),
    coldFire: calculateEffectiveElement(pending.coldFire, ATTACK_ELEMENT_COLD_FIRE, resistances),
  };
}
