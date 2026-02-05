/**
 * Elemental calculation helpers for combat
 *
 * Handles block efficiency, attack resistances, and elemental interactions.
 * Also provides final value calculations that incorporate combat modifiers.
 */

import type { Element, AttackSource, BlockSource, CombatType, ResistanceType } from "@mage-knight/shared";
import {
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  RESIST_PHYSICAL,
  RESIST_FIRE,
  RESIST_ICE,
} from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import { getEffectiveCombatBonus } from "../modifiers/index.js";
import {
  COMBAT_VALUE_ATTACK,
  COMBAT_VALUE_BLOCK,
  COMBAT_VALUE_RANGED,
  COMBAT_VALUE_SIEGE,
} from "../../types/modifierConstants.js";

/**
 * Resistances type - an array of individual resistance types.
 * This replaces the previous object-based Resistances interface.
 */
export type Resistances = readonly ResistanceType[];

/**
 * Empty resistances array - use when there are no resistances.
 */
export const NO_RESISTANCES: Resistances = [] as const;

/**
 * Determine if a block element is efficient against an attack element.
 * Efficient blocks count at full value; inefficient blocks are halved.
 *
 * Rules (rulebook lines 698-702):
 * - Any block is efficient against Physical attacks
 * - Ice or Cold Fire blocks are efficient against Fire attacks
 * - Fire or Cold Fire blocks are efficient against Ice attacks
 * - Only Cold Fire blocks are efficient against Cold Fire attacks
 */
export function isBlockEfficient(
  blockElement: Element,
  attackElement: Element
): boolean {
  switch (attackElement) {
    case ELEMENT_PHYSICAL:
      return true;

    case ELEMENT_FIRE:
      return blockElement === ELEMENT_ICE || blockElement === ELEMENT_COLD_FIRE;

    case ELEMENT_ICE:
      return blockElement === ELEMENT_FIRE || blockElement === ELEMENT_COLD_FIRE;

    case ELEMENT_COLD_FIRE:
      return blockElement === ELEMENT_COLD_FIRE;

    default:
      return false;
  }
}

/**
 * Calculate total block value considering efficiency.
 * Inefficient blocks are halved (rounded down), then added to efficient blocks.
 *
 * Rule (line 704): "total the values of all inefficient Blocks, divide by two
 * (round down) and then add the full values of all efficient Blocks."
 */
export function calculateTotalBlock(
  blocks: readonly { element: Element; value: number }[],
  attackElement: Element
): number {
  let efficientTotal = 0;
  let inefficientTotal = 0;

  for (const block of blocks) {
    if (isBlockEfficient(block.element, attackElement)) {
      efficientTotal += block.value;
    } else {
      inefficientTotal += block.value;
    }
  }

  return efficientTotal + Math.floor(inefficientTotal / 2);
}

/**
 * Determine if an attack element is resisted by enemy resistances.
 * Resisted attacks are halved.
 *
 * Rules (lines 656-657, 1911-1914):
 * - Physical Resistance halves Physical attacks
 * - Fire Resistance halves Fire attacks
 * - Ice Resistance halves Ice attacks
 * - Cold Fire is halved ONLY if enemy has BOTH Fire AND Ice Resistance
 */
export function isAttackResisted(
  attackElement: Element,
  resistances: Resistances
): boolean {
  switch (attackElement) {
    case ELEMENT_PHYSICAL:
      return resistances.includes(RESIST_PHYSICAL);

    case ELEMENT_FIRE:
      return resistances.includes(RESIST_FIRE);

    case ELEMENT_ICE:
      return resistances.includes(RESIST_ICE);

    case ELEMENT_COLD_FIRE:
      return resistances.includes(RESIST_FIRE) && resistances.includes(RESIST_ICE);

    default:
      return false;
  }
}

/**
 * Calculate effective attack value against enemies with resistances.
 * Resisted attacks are halved (rounded down).
 */
export function calculateEffectiveAttack(
  attacks: readonly { element: Element; value: number }[],
  targetResistances: Resistances
): number {
  let efficientTotal = 0;
  let inefficientTotal = 0;

  for (const attack of attacks) {
    if (isAttackResisted(attack.element, targetResistances)) {
      inefficientTotal += attack.value;
    } else {
      efficientTotal += attack.value;
    }
  }

  return efficientTotal + Math.floor(inefficientTotal / 2);
}

/**
 * Combine resistances from multiple enemies.
 * If ANY enemy has a resistance, it applies to the whole attack.
 */
export function combineResistances(
  enemies: readonly { resistances: Resistances }[]
): Resistances {
  const combined: ResistanceType[] = [];

  if (enemies.some((e) => e.resistances.includes(RESIST_PHYSICAL))) {
    combined.push(RESIST_PHYSICAL);
  }
  if (enemies.some((e) => e.resistances.includes(RESIST_FIRE))) {
    combined.push(RESIST_FIRE);
  }
  if (enemies.some((e) => e.resistances.includes(RESIST_ICE))) {
    combined.push(RESIST_ICE);
  }

  return combined;
}

// === Final value calculations with modifiers ===

/**
 * Calculate final attack value including combat modifiers.
 * Used when resolving attack declarations to determine if enemies are defeated.
 *
 * Sums up:
 * - Base attack from calculateEffectiveAttack (considering resistances)
 * - Attack bonus from active modifiers (always applies)
 * - Ranged bonus from active modifiers (only for ranged or siege attacks)
 * - Siege bonus from active modifiers (only for siege attacks)
 */
export function getFinalAttackValue(
  attacks: readonly AttackSource[],
  targetResistances: Resistances,
  state: GameState,
  playerId: string,
  attackType: CombatType
): number {
  const baseAttack = calculateEffectiveAttack(attacks, targetResistances);

  // Always apply general attack bonus
  let bonus = getEffectiveCombatBonus(state, playerId, COMBAT_VALUE_ATTACK);

  // Ranged bonus only applies to ranged or siege attacks
  if (attackType === COMBAT_TYPE_RANGED || attackType === COMBAT_TYPE_SIEGE) {
    bonus += getEffectiveCombatBonus(state, playerId, COMBAT_VALUE_RANGED);
  }

  // Siege bonus only applies to siege attacks
  if (attackType === COMBAT_TYPE_SIEGE) {
    bonus += getEffectiveCombatBonus(state, playerId, COMBAT_VALUE_SIEGE);
  }

  return baseAttack + bonus;
}

/**
 * Calculate final block value including combat modifiers.
 * Used when resolving block declarations to determine if enemy attack is blocked.
 *
 * Sums up:
 * - Base block from calculateTotalBlock (considering elemental efficiency)
 * - Block bonus from active modifiers
 */
export function getFinalBlockValue(
  blocks: readonly BlockSource[],
  attackElement: Element,
  state: GameState,
  playerId: string
): number {
  const baseBlock = calculateTotalBlock(blocks, attackElement);
  const blockBonus = getEffectiveCombatBonus(state, playerId, COMBAT_VALUE_BLOCK);

  return baseBlock + blockBonus;
}
