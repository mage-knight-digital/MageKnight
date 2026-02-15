/**
 * Heroes Assault Validators
 *
 * Validators for the PAY_HEROES_ASSAULT_INFLUENCE_ACTION.
 * Heroes units cannot use abilities in fortified site assaults unless
 * 2 Influence is paid once per combat.
 *
 * @module validators/combatValidators/heroesAssaultValidators
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import { PAY_HEROES_ASSAULT_INFLUENCE_ACTION } from "@mage-knight/shared";
import { isHeroUnitId } from "@mage-knight/shared";
import {
  NOT_IN_COMBAT,
  PLAYER_NOT_FOUND,
  INSUFFICIENT_INFLUENCE,
  HEROES_ASSAULT_INFLUENCE_ALREADY_PAID,
  HEROES_ASSAULT_NOT_APPLICABLE,
} from "../validationCodes.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";
import { HEROES_ASSAULT_INFLUENCE_COST } from "../../commands/combat/payHeroesAssaultInfluenceCommand.js";

/**
 * Validate player is in combat for Heroes assault payment.
 */
export function validateHeroesPaymentInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PAY_HEROES_ASSAULT_INFLUENCE_ACTION) return valid();

  if (!state.combat) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }

  return valid();
}

/**
 * Validate this is a fortified site assault (not defense or dungeon/tomb).
 */
export function validateHeroesAssaultApplicable(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PAY_HEROES_ASSAULT_INFLUENCE_ACTION) return valid();
  if (!state.combat) return valid(); // Other validator handles

  // Must be a fortified site assault (not defense)
  if (!state.combat.isAtFortifiedSite || state.combat.assaultOrigin === null) {
    return invalid(
      HEROES_ASSAULT_NOT_APPLICABLE,
      "Heroes assault influence only applies to fortified site assaults"
    );
  }

  return valid();
}

/**
 * Validate influence has not already been paid this combat.
 */
export function validateHeroesInfluenceNotAlreadyPaid(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PAY_HEROES_ASSAULT_INFLUENCE_ACTION) return valid();
  if (!state.combat) return valid(); // Other validator handles

  if (state.combat.paidHeroesAssaultInfluence) {
    return invalid(
      HEROES_ASSAULT_INFLUENCE_ALREADY_PAID,
      "Heroes assault influence has already been paid this combat"
    );
  }

  return valid();
}

/**
 * Validate player has enough influence to pay for Heroes assault.
 */
export function validateHeroesInfluenceAvailable(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PAY_HEROES_ASSAULT_INFLUENCE_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (player.influencePoints < HEROES_ASSAULT_INFLUENCE_COST) {
    return invalid(
      INSUFFICIENT_INFLUENCE,
      `Insufficient influence (need ${HEROES_ASSAULT_INFLUENCE_COST}, have ${player.influencePoints})`
    );
  }

  return valid();
}

/**
 * Validate player actually has Heroes units that would benefit from payment.
 */
export function validatePlayerHasHeroesUnits(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PAY_HEROES_ASSAULT_INFLUENCE_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const hasHeroes = player.units.some((u) => isHeroUnitId(u.unitId));
  if (!hasHeroes) {
    return invalid(
      HEROES_ASSAULT_NOT_APPLICABLE,
      "Player has no Heroes units to benefit from this payment"
    );
  }

  return valid();
}
