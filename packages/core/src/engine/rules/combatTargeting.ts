/**
 * Shared combat targeting rules.
 *
 * These helpers are used by both validators and ValidActions computation
 * to prevent rule drift.
 */

import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy } from "../../types/combat.js";
import {
  ABILITY_ASSASSINATION,
  ABILITY_FORTIFIED,
  ABILITY_UNFORTIFIED,
} from "@mage-knight/shared";
import { isAbilityNullified } from "../modifiers/index.js";

/**
 * Calculate fortification level for an enemy.
 * Returns 0 (not fortified), 1 (site or ability), or 2 (double fortified).
 *
 * Rules:
 * - Site fortification comes from Keeps, Mage Towers, Cities
 * - Enemy ability fortification from ABILITY_FORTIFIED
 * - ABILITY_UNFORTIFIED negates site fortification (e.g., Summoned enemies)
 * - Double fortified = site + ability (requires 2 Siege attacks)
 * - Provoked rampaging enemies (isRequiredForConquest: false) do NOT get site fortification
 * - EFFECT_ABILITY_NULLIFIER for ABILITY_FORTIFIED removes enemy's fortification ability
 *   and negates site fortification per Expose rules
 */
export function getFortificationLevel(
  enemy: CombatEnemy,
  isAtFortifiedSite: boolean,
  state: GameState,
  playerId: string
): number {
  const isFortifiedNullified = isAbilityNullified(
    state,
    playerId,
    enemy.instanceId,
    ABILITY_FORTIFIED
  );

  const hasAbilityFortified =
    enemy.definition.abilities.includes(ABILITY_FORTIFIED) && !isFortifiedNullified;
  const hasUnfortified = enemy.definition.abilities.includes(ABILITY_UNFORTIFIED);

  // Site fortification only applies to site defenders (isRequiredForConquest: true)
  // Provoked rampaging enemies do NOT get site fortification per rulebook
  const isSiteDefender = enemy.isRequiredForConquest;

  // ABILITY_UNFORTIFIED negates site fortification
  // ABILITY_NULLIFIER for FORTIFIED also negates site fortification per Expose rules
  const effectiveSiteFortification =
    isAtFortifiedSite && isSiteDefender && !hasUnfortified && !isFortifiedNullified;

  let level = 0;
  if (effectiveSiteFortification) level += 1;
  if (hasAbilityFortified) level += 1;

  return level;
}

/**
 * Check if an enemy's Assassination ability is active.
 * Active when the enemy has Assassination and it isn't nullified.
 */
export function isAssassinationActive(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): boolean {
  if (!enemy.definition.abilities.includes(ABILITY_ASSASSINATION)) {
    return false;
  }

  return !isAbilityNullified(
    state,
    playerId,
    enemy.instanceId,
    ABILITY_ASSASSINATION
  );
}
