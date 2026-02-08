/**
 * Standalone Mana Action Validators
 *
 * Validates USE_MANA_DIE and CONVERT_CRYSTAL actions.
 * These are standalone mana actions (not embedded in card play).
 *
 * @module validators/mana/standaloneManaValidators
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import {
  USE_MANA_DIE_ACTION,
  CONVERT_CRYSTAL_ACTION,
  MANA_GOLD,
  MANA_BLACK,
  BASIC_MANA_COLORS,
} from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  PLAYER_NOT_FOUND,
  DIE_NOT_FOUND,
  DIE_DEPLETED,
  DIE_TAKEN,
  DIE_COLOR_MISMATCH,
  NO_CRYSTAL,
  SOURCE_LIMIT_EXCEEDED,
  SOURCE_BLOCKED,
  MANA_COLOR_NOT_ALLOWED,
} from "../validationCodes.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";
import { isRuleActive, countRuleActive } from "../../modifiers/index.js";
import { RULE_BLACK_AS_ANY_COLOR, RULE_GOLD_AS_ANY_COLOR, RULE_EXTRA_SOURCE_DIE, RULE_SOURCE_BLOCKED } from "../../../types/modifierConstants.js";
import { isManaColorAllowed } from "../../rules/mana.js";

/**
 * Validate a USE_MANA_DIE action.
 *
 * Checks:
 * - Die exists in source
 * - Die is not already taken
 * - Die is not depleted
 * - Color matches die (including gold-as-wild, black-as-any modifiers)
 * - Source not blocked
 * - Die usage limit not exceeded
 */
export function validateUseManaDie(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== USE_MANA_DIE_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const { dieId, color: requestedColor } = action;

  // Check Mana Steal stored die separately
  const storedDie = player.tacticState.storedManaDie;
  if (storedDie && storedDie.dieId === dieId) {
    if (player.tacticState.manaStealUsedThisTurn) {
      return invalid(DIE_TAKEN, "Mana Steal die already used this turn");
    }
    // Validate color match for stored die
    if (!isColorMatchForDie(state, playerId, storedDie.color, requestedColor)) {
      return invalid(DIE_COLOR_MISMATCH, `Die color ${storedDie.color} does not match requested ${requestedColor}`);
    }
    return valid();
  }

  // Check if source is blocked
  if (isRuleActive(state, playerId, RULE_SOURCE_BLOCKED)) {
    return invalid(SOURCE_BLOCKED, "Mana source is blocked");
  }

  // Find the die in the source
  const die = state.source.dice.find((d) => d.id === dieId);
  if (!die) {
    return invalid(DIE_NOT_FOUND, `Die ${dieId} not found in source`);
  }

  if (die.takenByPlayerId !== null) {
    return invalid(DIE_TAKEN, `Die ${dieId} already taken`);
  }

  if (die.isDepleted) {
    return invalid(DIE_DEPLETED, `Die ${dieId} is depleted`);
  }

  // Check die usage limit
  if (player.usedManaFromSource) {
    const extraSourceDiceCount = countRuleActive(state, playerId, RULE_EXTRA_SOURCE_DIE);
    const maxDiceUsage = 1 + extraSourceDiceCount;
    if (Math.max(player.usedDieIds.length, 1) >= maxDiceUsage) {
      return invalid(SOURCE_LIMIT_EXCEEDED, "Already used maximum dice from source this turn");
    }
  }

  // Validate color match
  if (!isColorMatchForDie(state, playerId, die.color, requestedColor)) {
    return invalid(DIE_COLOR_MISMATCH, `Die color ${die.color} does not match requested ${requestedColor}`);
  }

  // Validate the requested color is allowed
  const blackAsAny = isRuleActive(state, playerId, RULE_BLACK_AS_ANY_COLOR);
  if (!isManaColorAllowed(state, requestedColor) && !(requestedColor === MANA_BLACK && blackAsAny)) {
    return invalid(MANA_COLOR_NOT_ALLOWED, `Mana color ${requestedColor} is not allowed`);
  }

  return valid();
}

/**
 * Check if a requested color matches a die color, considering modifiers.
 */
function isColorMatchForDie(
  state: GameState,
  playerId: string,
  dieColor: string,
  requestedColor: string
): boolean {
  // Exact match
  if (dieColor === requestedColor) return true;

  const blackAsAny = isRuleActive(state, playerId, RULE_BLACK_AS_ANY_COLOR);
  const goldAsAny = isRuleActive(state, playerId, RULE_GOLD_AS_ANY_COLOR);

  // Black die as any basic color (Mana Pull basic)
  if (dieColor === MANA_BLACK && blackAsAny) {
    return true;
  }

  // Gold die as any basic color (standard rule during day + Mana Storm)
  if (dieColor === MANA_GOLD) {
    const isBasic = (BASIC_MANA_COLORS as readonly string[]).includes(requestedColor);
    if (isBasic && (isManaColorAllowed(state, MANA_GOLD) || goldAsAny)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate a CONVERT_CRYSTAL action.
 *
 * Checks:
 * - Player has a crystal of the specified color
 */
export function validateConvertCrystal(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== CONVERT_CRYSTAL_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const { color } = action;
  if (player.crystals[color] <= 0) {
    return invalid(NO_CRYSTAL, `No ${color} crystal to convert`);
  }

  return valid();
}
