/**
 * Cold Toughness block bonus calculation helpers.
 *
 * Tovak's Cold Toughness powered effect grants +1 ice block per ability,
 * attack color, and resistance depicted on the enemy token being blocked.
 * Arcane Immunity negates the bonus entirely (only base 5 applies).
 *
 * @module combat/coldToughnessHelpers
 */

import type { Element, EnemyAbilityType } from "@mage-knight/shared";
import {
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
  ABILITY_ARCANE_IMMUNITY,
} from "@mage-knight/shared";
import type { CombatEnemy } from "../../types/combat.js";
import type { GameState } from "../../state/GameState.js";
import { getModifiersForPlayer } from "../modifiers/queries.js";
import { EFFECT_COLD_TOUGHNESS_BLOCK } from "../../types/modifierConstants.js";

/**
 * Count the attack color icons on an enemy token.
 *
 * - Physical attack: 0 (no color icon)
 * - Fire attack: 1
 * - Ice attack: 1
 * - Cold Fire attack: 2 (counts as both fire and ice)
 */
export function countAttackColors(attackElement: Element): number {
  switch (attackElement) {
    case ELEMENT_COLD_FIRE:
      return 2;
    case ELEMENT_FIRE:
    case ELEMENT_ICE:
      return 1;
    default:
      return 0;
  }
}

/**
 * Check if an ability counts toward the Cold Toughness bonus.
 * All abilities count except Arcane Immunity (which negates the bonus entirely).
 */
export function isCountableAbility(ability: EnemyAbilityType): boolean {
  return ability !== ABILITY_ARCANE_IMMUNITY;
}

/**
 * Calculate Cold Toughness scaling block bonus for a specific enemy.
 *
 * Counts:
 * - Each ability on the token (except Arcane Immunity)
 * - Each attack color (Cold Fire = 2, Fire/Ice = 1, Physical = 0)
 * - Each resistance (Physical, Fire, Ice)
 *
 * Returns 0 if enemy has Arcane Immunity.
 *
 * @param enemy - The combat enemy being blocked
 * @returns The bonus block value (+1 per counted feature)
 */
export function calculateColdToughnessBonus(enemy: CombatEnemy): number {
  const definition = enemy.definition;

  // Arcane Immunity negates the bonus entirely
  if (definition.abilities.includes(ABILITY_ARCANE_IMMUNITY)) {
    return 0;
  }

  let bonus = 0;

  // Count abilities (all except Arcane Immunity, which we already checked)
  for (const ability of definition.abilities) {
    if (isCountableAbility(ability)) {
      bonus++;
    }
  }

  // Count attack colors
  bonus += countAttackColors(definition.attackElement);

  // Count resistances
  bonus += definition.resistances.length;

  return bonus;
}

/**
 * Check if Cold Toughness block modifier is active for a player and return
 * the bonus for a specific enemy.
 *
 * @returns The per-enemy bonus, or 0 if modifier not active
 */
export function getColdToughnessBlockBonus(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): number {
  const modifiers = getModifiersForPlayer(state, playerId);
  const hasColdToughness = modifiers.some(
    (m) => m.effect.type === EFFECT_COLD_TOUGHNESS_BLOCK
  );

  if (!hasColdToughness) return 0;

  return calculateColdToughnessBonus(enemy);
}
