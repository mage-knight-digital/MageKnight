/**
 * Swift ability helpers
 *
 * Centralizes checks for whether Swift is active for a given enemy,
 * including ability nullification.
 */

import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy } from "../../types/combat.js";
import { ABILITY_SWIFT } from "@mage-knight/shared";
import { isAbilityNullified } from "../modifiers/index.js";

/**
 * Returns true when the enemy has Swift and it is not nullified.
 */
export function isSwiftActive(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): boolean {
  if (!enemy.definition.abilities.includes(ABILITY_SWIFT)) return false;
  return !isAbilityNullified(state, playerId, enemy.instanceId, ABILITY_SWIFT);
}
