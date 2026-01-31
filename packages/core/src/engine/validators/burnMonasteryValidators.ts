/**
 * Burn monastery validators
 *
 * Validators for the burn monastery action.
 */

import type { ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { BURN_MONASTERY_ACTION, hexKey } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import { NOT_AT_MONASTERY, MONASTERY_BURNED, ALREADY_COMBATTED } from "./validationCodes.js";
import { SiteType } from "../../types/map.js";
import { getPlayerById } from "../helpers/playerHelpers.js";

/**
 * Must be at a monastery site
 */
export function validateAtMonastery(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== BURN_MONASTERY_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player?.position) {
    return invalid(NOT_AT_MONASTERY, "You are not at a monastery");
  }

  const hex = state.map.hexes[hexKey(player.position)];
  if (!hex?.site || hex.site.type !== SiteType.Monastery) {
    return invalid(NOT_AT_MONASTERY, "You are not at a monastery");
  }

  return valid();
}

/**
 * Monastery must not already be burned
 */
export function validateMonasteryNotBurned(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== BURN_MONASTERY_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player?.position) return valid(); // Handled by validateAtMonastery

  const hex = state.map.hexes[hexKey(player.position)];
  if (!hex?.site) return valid(); // Handled by validateAtMonastery

  if (hex.site.isBurned) {
    return invalid(MONASTERY_BURNED, "This monastery has already been burned");
  }

  return valid();
}

/**
 * Can only have one combat per turn (burn monastery starts combat)
 */
export function validateNoCombatThisTurnForBurn(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== BURN_MONASTERY_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return valid();

  if (player.hasCombattedThisTurn) {
    return invalid(ALREADY_COMBATTED, "You can only have one combat per turn");
  }

  return valid();
}
