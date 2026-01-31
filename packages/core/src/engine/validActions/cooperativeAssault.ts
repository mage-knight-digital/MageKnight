/**
 * Cooperative assault valid actions computation.
 *
 * Computes what cooperative assault actions are available to a player.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  CooperativeAssaultOptions,
  EligibleInvitee,
} from "@mage-knight/shared";
import type { CityColor as SharedCityColor } from "@mage-knight/shared";
import { CARD_WOUND, getAllNeighbors } from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { CityColor as CoreCityColor } from "../../types/map.js";

/**
 * Helper to find the city hex for a given color.
 */
function findCityHex(
  state: GameState,
  cityColor: CoreCityColor
): { q: number; r: number } | null {
  for (const [, hex] of Object.entries(state.map.hexes)) {
    if (hex.site?.type === SiteType.City && hex.site.cityColor === cityColor) {
      return hex.coord;
    }
  }
  return null;
}

/**
 * Check if a player position is adjacent to a city of the given color.
 */
function isAdjacentToCity(
  state: GameState,
  playerPosition: { q: number; r: number },
  cityColor: CoreCityColor
): boolean {
  const cityHex = findCityHex(state, cityColor);
  if (!cityHex) return false;

  const neighbors = getAllNeighbors(playerPosition);
  return neighbors.some((n) => n.q === cityHex.q && n.r === cityHex.r);
}

/**
 * Check if a player has at least one non-wound card in hand.
 */
function hasNonWoundCard(player: Player): boolean {
  return player.hand.some((cardId) => cardId !== CARD_WOUND);
}

/**
 * Get the list of city colors that are revealed (have state).
 */
function getRevealedCityColors(state: GameState): CoreCityColor[] {
  return Object.keys(state.cities) as CoreCityColor[];
}

/**
 * Get cooperative assault options for a player.
 */
export function getCooperativeAssaultOptions(
  state: GameState,
  player: Player
): CooperativeAssaultOptions | undefined {
  // Check if there's a pending proposal
  const pendingProposal = state.pendingCooperativeAssault;

  if (pendingProposal) {
    // Someone has a pending proposal
    const isInitiator = pendingProposal.initiatorId === player.id;
    const isInvitee = pendingProposal.invitedPlayerIds.includes(player.id);
    const hasResponded = pendingProposal.acceptedPlayerIds.includes(player.id);

    // Calculate enemy count assigned to this player
    const assignedEnemyCount = pendingProposal.distribution.reduce(
      (count, entry) => (entry.playerId === player.id ? count + entry.enemyCount : count),
      0
    );

    return {
      targetableCities: [], // Can't propose while proposal pending
      eligibleInvitees: {},
      garrisonSizes: {},
      canCancelProposal: isInitiator,
      canRespondToProposal: isInvitee && !hasResponded,
      pendingProposal: {
        initiatorId: pendingProposal.initiatorId,
        targetCity: pendingProposal.targetCity as SharedCityColor,
        distribution: pendingProposal.distribution,
        assignedEnemyCount,
      },
    };
  }

  // Check if player can initiate a proposal

  // Must not have announced end of round
  if (state.endOfRoundAnnouncedBy !== null) {
    return undefined;
  }

  // Must not have scenario end triggered
  if (state.scenarioEndTriggered) {
    return undefined;
  }

  // Must not have taken action this turn
  if (player.hasTakenActionThisTurn) {
    return undefined;
  }

  // Must not have Round Order token flipped
  if (player.roundOrderTokenFlipped) {
    return undefined;
  }

  // Player must be on the map
  if (!player.position) {
    return undefined;
  }

  // Capture position for use in closures (TypeScript narrowing)
  const playerPosition = player.position;

  // Check if another player is on the same space
  const otherPlayersOnSpace = state.players.filter(
    (p) =>
      p.id !== player.id &&
      p.position !== null &&
      p.position.q === playerPosition.q &&
      p.position.r === playerPosition.r
  );

  if (otherPlayersOnSpace.length > 0) {
    return undefined;
  }

  // Find targetable cities (adjacent to player)
  const revealedCities = getRevealedCityColors(state);
  const targetableCities: SharedCityColor[] = [];
  const eligibleInvitees: Partial<Record<SharedCityColor, readonly EligibleInvitee[]>> =
    {};
  const garrisonSizes: Partial<Record<SharedCityColor, number>> = {};

  for (const cityColor of revealedCities) {
    const cityState = state.cities[cityColor];
    if (!cityState || cityState.isConquered) {
      continue; // Skip conquered cities
    }

    if (!isAdjacentToCity(state, playerPosition, cityColor)) {
      continue; // Player not adjacent
    }

    // This city is targetable - find eligible invitees
    const invitees: EligibleInvitee[] = [];

    for (const otherPlayer of state.players) {
      if (otherPlayer.id === player.id) continue;

      // Player must be on the map
      if (!otherPlayer.position) {
        continue;
      }

      // Check if other player is adjacent to this city
      if (!isAdjacentToCity(state, otherPlayer.position, cityColor)) {
        continue;
      }

      // Check if Round Order token is not flipped
      if (otherPlayer.roundOrderTokenFlipped) {
        continue;
      }

      // Check if they have at least one non-wound card
      if (!hasNonWoundCard(otherPlayer)) {
        continue;
      }

      invitees.push({
        playerId: otherPlayer.id,
        // Use hero name as player name (capitalize first letter)
        playerName: otherPlayer.hero.charAt(0).toUpperCase() + otherPlayer.hero.slice(1),
      });
    }

    // Only add city if there are eligible invitees
    if (invitees.length > 0) {
      targetableCities.push(cityColor as SharedCityColor);
      eligibleInvitees[cityColor as SharedCityColor] = invitees;
      garrisonSizes[cityColor as SharedCityColor] = cityState.garrison.length;
    }
  }

  // If no targetable cities, don't show cooperative assault options
  if (targetableCities.length === 0) {
    return undefined;
  }

  return {
    targetableCities,
    eligibleInvitees,
    garrisonSizes,
    canCancelProposal: false,
    canRespondToProposal: false,
  };
}
