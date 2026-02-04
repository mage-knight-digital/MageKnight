/**
 * Combat fortification validators
 *
 * Validators for fortification rules and siege requirements.
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  DECLARE_ATTACK_ACTION,
  COMBAT_TYPE_SIEGE,
} from "@mage-knight/shared";
import { COMBAT_PHASE_RANGED_SIEGE } from "../../../types/combat.js";
import { getTotalElementalValue } from "../../../types/player.js";
import {
  FORTIFIED_NEEDS_SIEGE,
  NO_SIEGE_ATTACK_ACCUMULATED,
} from "../validationCodes.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";
import { getFortificationLevel } from "../../rules/combatTargeting.js";

/**
 * Calculate fortification level for an enemy.
 * Returns 0 (not fortified), 1 (site or ability), or 2 (double fortified)
 *
 * Rules:
 * - Site fortification comes from Keeps, Mage Towers, Cities
 * - Enemy ability fortification from ABILITY_FORTIFIED
 * - ABILITY_UNFORTIFIED negates site fortification (e.g., Summoned enemies)
 * - Double fortified = site + ability (requires 2 Siege attacks)
 * - Provoked rampaging enemies (isRequiredForConquest: false) do NOT get site fortification
 * - EFFECT_ABILITY_NULLIFIER for ABILITY_FORTIFIED removes enemy's fortification ability (Expose spell)
 *
 * @param enemy - The combat enemy to check
 * @param isAtFortifiedSite - Whether the combat is at a fortified site
 * @param state - Game state for checking ability nullifier modifiers
 * @param playerId - Player ID for checking ability nullifier modifiers
 */
export { getFortificationLevel };

// Fortified enemies can only be attacked with Siege in Ranged/Siege phase
export function validateFortification(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_ATTACK_ACTION) return valid();

  // Only applies in Ranged/Siege phase
  if (state.combat?.phase !== COMBAT_PHASE_RANGED_SIEGE) return valid();

  // Get target enemies
  const targetIds = action.targetEnemyInstanceIds;
  const targets = state.combat.enemies.filter((e) =>
    targetIds.includes(e.instanceId)
  );

  // Check if any target is fortified (level > 0)
  // Pass state and playerId to check for fortification-removing modifiers (Expose spell)
  const isAtFortifiedSite = state.combat.isAtFortifiedSite;
  const fortifiedTargets = targets.filter(
    (e) => getFortificationLevel(e, isAtFortifiedSite, state, playerId) > 0
  );
  if (fortifiedTargets.length === 0) return valid();

  // Fortified enemies require Siege attack in Ranged/Siege phase
  // Ranged attacks won't work, only Siege
  if (action.attackType !== COMBAT_TYPE_SIEGE) {
    const names = fortifiedTargets.map((e) => e.definition.name).join(", ");
    return invalid(
      FORTIFIED_NEEDS_SIEGE,
      `Fortified enemies (${names}) can only be attacked with Siege in Ranged/Siege phase`
    );
  }

  return valid();
}

// When attacking fortified enemies with siege type, player must have siege attack accumulated
export function validateHasSiegeAttack(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_ATTACK_ACTION) return valid();

  // Only applies when using siege attack type
  if (action.attackType !== COMBAT_TYPE_SIEGE) return valid();

  // Find the player
  const player = getPlayerById(state, playerId);
  if (!player) return valid();

  // Calculate total siege attack (base + elemental)
  const siegeBase = player.combatAccumulator.attack.siege;
  const siegeElemental = getTotalElementalValue(
    player.combatAccumulator.attack.siegeElements
  );
  const totalSiege = siegeBase + siegeElemental;

  if (totalSiege <= 0) {
    return invalid(
      NO_SIEGE_ATTACK_ACCUMULATED,
      "Cannot use Siege attack type without any accumulated Siege attack"
    );
  }

  return valid();
}
