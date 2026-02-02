/**
 * Vampiric ability helper functions
 *
 * Vampiric: Enemy's armor increases by 1 for each wound it causes during combat
 * (to units or hero). Bonus persists through combat, resets when combat ends.
 *
 * Rules:
 * - Each wound to hero hand = +1 armor bonus
 * - Each wound to unit (wound or destruction) = +1 armor bonus
 * - Poison extra wounds to discard do NOT count (only wounds to hand)
 * - Bonus persists even if hero/unit is healed
 * - Bonus resets when combat ends (combat = null)
 *
 * @module engine/combat/vampiricHelpers
 */

import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy } from "../../types/combat.js";
import { ABILITY_VAMPIRIC } from "@mage-knight/shared";
import { ENEMY_ABILITY_VAMPIRIC } from "../../types/enemyConstants.js";
import { isAbilityNullified } from "../modifiers/index.js";

/**
 * Check if enemy has Vampiric ability and it's not nullified.
 *
 * @param state - Game state
 * @param playerId - Player facing the enemy
 * @param enemy - Combat enemy instance
 * @returns True if enemy has active Vampiric ability
 */
export function isVampiricActive(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): boolean {
  if (!enemy?.definition?.abilities) return false;
  if (!enemy.definition.abilities.includes(ABILITY_VAMPIRIC)) return false;
  return !isAbilityNullified(state, playerId, enemy.instanceId, ENEMY_ABILITY_VAMPIRIC);
}

/**
 * Get the current Vampiric armor bonus for an enemy.
 *
 * @param state - Game state
 * @param enemyInstanceId - Enemy instance ID
 * @returns Current armor bonus (0 if none)
 */
export function getVampiricArmorBonus(
  state: GameState,
  enemyInstanceId: string
): number {
  if (!state.combat) return 0;
  // Defensive check for combat states that may not have vampiricArmorBonus initialized
  if (!state.combat.vampiricArmorBonus) return 0;
  return state.combat.vampiricArmorBonus[enemyInstanceId] ?? 0;
}
