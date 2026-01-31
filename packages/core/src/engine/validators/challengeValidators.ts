/**
 * Challenge rampaging enemy validators.
 *
 * Validates the CHALLENGE_RAMPAGING_ACTION:
 * - Player must be on the map
 * - Player must not already be in combat
 * - Player must not have already combatted this turn
 * - Target hex must be adjacent to player
 * - Target hex must contain rampaging enemies
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, HexCoord, ChallengeRampagingAction } from "@mage-knight/shared";
import { CHALLENGE_RAMPAGING_ACTION, hexKey } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  ALREADY_COMBATTED,
  ALREADY_IN_COMBAT,
  INVALID_ACTION_CODE,
  NOT_ADJACENT_TO_TARGET,
  NOT_ON_MAP,
  PLAYER_NOT_FOUND,
  TARGET_NOT_RAMPAGING,
  HEX_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";

/**
 * Type guard to extract target hex from action.
 */
function getChallengeTarget(action: PlayerAction): HexCoord | null {
  if (action.type === CHALLENGE_RAMPAGING_ACTION && "targetHex" in action) {
    return (action as ChallengeRampagingAction).targetHex;
  }
  return null;
}

/**
 * Check hex adjacency (copied from movementValidators for now).
 */
function isAdjacent(a: HexCoord, b: HexCoord): boolean {
  const dq = b.q - a.q;
  const dr = b.r - a.r;
  const adjacentOffsets = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];
  return adjacentOffsets.some((o) => o.q === dq && o.r === dr);
}

/**
 * Validate player is on the map.
 */
export function validateChallengePlayerOnMap(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }
  if (!player.position) {
    return invalid(NOT_ON_MAP, "Player is not on the map");
  }
  return valid();
}

/**
 * Validate player is not already in combat.
 */
export function validateNotInCombat(
  state: GameState,
  _playerId: string,
  _action: PlayerAction
): ValidationResult {
  if (state.combat !== null) {
    return invalid(ALREADY_IN_COMBAT, "Already in combat");
  }
  return valid();
}

/**
 * Validate player has not already completed combat this turn.
 */
export function validateNoCombatThisTurn(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }
  if (player.hasCombattedThisTurn) {
    return invalid(ALREADY_COMBATTED, "Already completed combat this turn");
  }
  return valid();
}

/**
 * Validate target hex is adjacent to player.
 */
export function validateAdjacentToTarget(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const player = getPlayerById(state, playerId);
  const target = getChallengeTarget(action);

  if (!player?.position || !target) {
    return invalid(INVALID_ACTION_CODE, "Invalid challenge action");
  }

  if (!isAdjacent(player.position, target)) {
    return invalid(NOT_ADJACENT_TO_TARGET, "Target hex is not adjacent");
  }
  return valid();
}

/**
 * Validate target hex has rampaging enemies.
 *
 * Key distinction (per rules):
 * - rampagingEnemies[] on hex = enemies that ARRIVED as rampaging (can be challenged)
 * - enemies[] without rampagingEnemies[] = site defenders (cannot be challenged from adjacent)
 */
export function validateTargetHasRampagingEnemies(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const target = getChallengeTarget(action);
  if (!target) {
    return invalid(INVALID_ACTION_CODE, "Invalid challenge action");
  }

  const hex = state.map.hexes[hexKey(target)];
  if (!hex) {
    return invalid(HEX_NOT_FOUND, "Target hex not found");
  }

  // Check if hex has rampaging enemies (not just any enemies)
  if (hex.rampagingEnemies.length === 0 || hex.enemies.length === 0) {
    return invalid(TARGET_NOT_RAMPAGING, "Target hex has no rampaging enemies to challenge");
  }

  return valid();
}
