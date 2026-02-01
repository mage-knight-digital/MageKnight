/**
 * Propose cooperative assault validators
 *
 * Validates the proposal action for cooperative city assaults.
 * Per the rules, players can propose a cooperative assault on a city when:
 * - They are adjacent to the city
 * - End of round has not been announced
 * - Scenario end condition is not fulfilled
 * - They have not taken an action this turn
 * - No other hero is on their space
 *
 * Invitees must meet these requirements:
 * - Adjacent to the same city
 * - Round Order token not flipped
 * - Has at least one non-wound card in hand
 */

import type { GameState } from "../../../state/GameState.js";
import type {
  PlayerAction,
  ProposeCooperativeAssaultAction,
} from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import { PROPOSE_COOPERATIVE_ASSAULT_ACTION } from "@mage-knight/shared";
import type { CityColor as CoreCityColor } from "../../../types/map.js";
import {
  PLAYER_NOT_FOUND,
  ALREADY_ANNOUNCED,
  ALREADY_ACTED,
  NOT_ADJACENT_TO_CITY,
  SCENARIO_END_FULFILLED,
  OTHER_HERO_ON_SPACE,
  INVITEE_NOT_ADJACENT,
  INVITEE_TOKEN_FLIPPED,
  INVITEE_NO_CARDS,
  INVALID_ENEMY_DISTRIBUTION,
  CITY_NOT_FOUND,
  MUST_INVITE_AT_LEAST_ONE,
  INITIATOR_TOKEN_FLIPPED,
} from "../validationCodes.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";
import { isAdjacentToCity, hasNonWoundCard } from "./helpers.js";

// ============================================================================
// Initiator State Validators
// ============================================================================

/**
 * Initiator must be adjacent to the target city.
 */
export function validateInitiatorAdjacentToCity(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PROPOSE_COOPERATIVE_ASSAULT_ACTION) return valid();

  const proposeAction = action as ProposeCooperativeAssaultAction;
  const player = getPlayerById(state, playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");
  if (!player.position)
    return invalid(PLAYER_NOT_FOUND, "Player is not on the map");

  const cityColor = proposeAction.targetCity as CoreCityColor;

  if (!isAdjacentToCity(state, player.position, cityColor)) {
    return invalid(
      NOT_ADJACENT_TO_CITY,
      "You must be adjacent to the city to propose a cooperative assault"
    );
  }

  return valid();
}

/**
 * Initiator must not have taken an action this turn.
 */
export function validateInitiatorNotActed(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PROPOSE_COOPERATIVE_ASSAULT_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.hasTakenActionThisTurn) {
    return invalid(
      ALREADY_ACTED,
      "Cannot propose cooperative assault after taking an action"
    );
  }

  return valid();
}

/**
 * Initiator's Round Order token must not be flipped.
 */
export function validateInitiatorTokenNotFlipped(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PROPOSE_COOPERATIVE_ASSAULT_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.roundOrderTokenFlipped) {
    return invalid(
      INITIATOR_TOKEN_FLIPPED,
      "Cannot propose cooperative assault when your Round Order token is flipped"
    );
  }

  return valid();
}

/**
 * No other hero can be on the initiator's space.
 */
export function validateNoOtherPlayerOnSpace(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PROPOSE_COOPERATIVE_ASSAULT_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");
  if (!player.position)
    return invalid(PLAYER_NOT_FOUND, "Player is not on the map");

  const playerPosition = player.position;

  const otherPlayersOnSpace = state.players.filter(
    (p) =>
      p.id !== playerId &&
      p.position !== null &&
      p.position.q === playerPosition.q &&
      p.position.r === playerPosition.r
  );

  if (otherPlayersOnSpace.length > 0) {
    return invalid(
      OTHER_HERO_ON_SPACE,
      "Cannot propose cooperative assault when another hero is on your space"
    );
  }

  return valid();
}

// ============================================================================
// Game State Validators
// ============================================================================

/**
 * End of round must not have been announced.
 */
export function validateEndOfRoundNotAnnounced(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PROPOSE_COOPERATIVE_ASSAULT_ACTION) return valid();

  if (state.endOfRoundAnnouncedBy !== null) {
    return invalid(
      ALREADY_ANNOUNCED,
      "Cannot propose cooperative assault after end of round has been announced"
    );
  }

  return valid();
}

/**
 * Scenario end condition must not be fulfilled.
 */
export function validateScenarioNotFulfilled(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PROPOSE_COOPERATIVE_ASSAULT_ACTION) return valid();

  if (state.scenarioEndTriggered) {
    return invalid(
      SCENARIO_END_FULFILLED,
      "Cannot propose cooperative assault after scenario end condition is fulfilled"
    );
  }

  return valid();
}

// ============================================================================
// Invitee Validators
// ============================================================================

/**
 * All invitees must be adjacent to the target city.
 */
export function validateInviteesAdjacentToCity(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PROPOSE_COOPERATIVE_ASSAULT_ACTION) return valid();

  const proposeAction = action as ProposeCooperativeAssaultAction;
  const cityColor = proposeAction.targetCity as CoreCityColor;

  for (const inviteeId of proposeAction.invitedPlayerIds) {
    const invitee = state.players.find((p) => p.id === inviteeId);
    if (!invitee) {
      return invalid(PLAYER_NOT_FOUND, `Invited player ${inviteeId} not found`);
    }
    if (!invitee.position) {
      return invalid(
        INVITEE_NOT_ADJACENT,
        `Player ${inviteeId} is not on the map`
      );
    }

    if (!isAdjacentToCity(state, invitee.position, cityColor)) {
      return invalid(
        INVITEE_NOT_ADJACENT,
        `Player ${inviteeId} is not adjacent to the target city`
      );
    }
  }

  return valid();
}

/**
 * All invitees must have their Round Order token not flipped.
 */
export function validateInviteesTokensNotFlipped(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PROPOSE_COOPERATIVE_ASSAULT_ACTION) return valid();

  const proposeAction = action as ProposeCooperativeAssaultAction;

  for (const inviteeId of proposeAction.invitedPlayerIds) {
    const invitee = state.players.find((p) => p.id === inviteeId);
    if (!invitee) {
      return invalid(PLAYER_NOT_FOUND, `Invited player ${inviteeId} not found`);
    }

    if (invitee.roundOrderTokenFlipped) {
      return invalid(
        INVITEE_TOKEN_FLIPPED,
        `Player ${inviteeId}'s Round Order token is flipped`
      );
    }
  }

  return valid();
}

/**
 * All invitees must have at least one non-wound card in hand.
 */
export function validateInviteesHaveCards(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PROPOSE_COOPERATIVE_ASSAULT_ACTION) return valid();

  const proposeAction = action as ProposeCooperativeAssaultAction;

  for (const inviteeId of proposeAction.invitedPlayerIds) {
    if (!hasNonWoundCard(state, inviteeId)) {
      return invalid(
        INVITEE_NO_CARDS,
        `Player ${inviteeId} has no non-wound cards in hand`
      );
    }
  }

  return valid();
}

// ============================================================================
// Distribution Validators
// ============================================================================

/**
 * Must invite at least one player.
 */
export function validateAtLeastOneInvitee(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PROPOSE_COOPERATIVE_ASSAULT_ACTION) return valid();

  const proposeAction = action as ProposeCooperativeAssaultAction;

  if (proposeAction.invitedPlayerIds.length === 0) {
    return invalid(
      MUST_INVITE_AT_LEAST_ONE,
      "Must invite at least one player to a cooperative assault"
    );
  }

  return valid();
}

/**
 * Enemy distribution must be valid (correct number of enemies, valid assignments).
 */
export function validateEnemyDistribution(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PROPOSE_COOPERATIVE_ASSAULT_ACTION) return valid();

  const proposeAction = action as ProposeCooperativeAssaultAction;
  const cityColor = proposeAction.targetCity as CoreCityColor;

  const cityState = state.cities[cityColor];
  if (!cityState) {
    return invalid(CITY_NOT_FOUND, "Target city not found");
  }

  const garrisonSize = cityState.garrison.length;
  const distribution = proposeAction.distribution;

  const validPlayerIds = new Set([playerId, ...proposeAction.invitedPlayerIds]);

  let totalAssigned = 0;
  for (const entry of distribution) {
    if (!validPlayerIds.has(entry.playerId)) {
      return invalid(
        INVALID_ENEMY_DISTRIBUTION,
        `Player ${entry.playerId} is not a participant in the assault`
      );
    }

    if (entry.enemyCount < 1) {
      return invalid(
        INVALID_ENEMY_DISTRIBUTION,
        `Each participant must be assigned at least 1 enemy`
      );
    }

    totalAssigned += entry.enemyCount;
  }

  if (totalAssigned !== garrisonSize) {
    return invalid(
      INVALID_ENEMY_DISTRIBUTION,
      `Distribution must assign all ${garrisonSize} enemies (got ${totalAssigned})`
    );
  }

  return valid();
}
