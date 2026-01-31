/**
 * Cooperative Assault types for Mage Knight
 *
 * Cooperative assaults allow multiple players to jointly attack a city.
 * This module defines the proposal and agreement system.
 */

// City colors for targeting (matches core's CityColor)
export const CITY_COLOR_RED = "red" as const;
export const CITY_COLOR_BLUE = "blue" as const;
export const CITY_COLOR_GREEN = "green" as const;
export const CITY_COLOR_WHITE = "white" as const;

export type CityColor =
  | typeof CITY_COLOR_RED
  | typeof CITY_COLOR_BLUE
  | typeof CITY_COLOR_GREEN
  | typeof CITY_COLOR_WHITE;

/**
 * Enemy distribution assignment for a cooperative assault.
 * Each participating player must receive at least 1 enemy.
 */
export interface EnemyDistribution {
  readonly playerId: string;
  readonly enemyCount: number;
}

/**
 * Cooperative assault proposal state.
 *
 * Lifecycle:
 * 1. Initiator creates proposal with target city, invitees, enemy distribution
 * 2. All invitees must accept or proposal is rejected
 * 3. If all accept: combat begins, initiator's action consumed, invitees' tokens flipped
 * 4. If any reject: proposal cleared, initiator can propose again or take other action
 */
export interface CooperativeAssaultProposal {
  /** Player who initiated the proposal */
  readonly initiatorId: string;

  /** City being targeted */
  readonly targetCity: CityColor;

  /** Players invited to join (subset of eligible heroes) */
  readonly invitedPlayerIds: readonly string[];

  /** How enemies will be distributed among participants */
  readonly distribution: readonly EnemyDistribution[];

  /** Invitees who have accepted (subset of invitedPlayerIds) */
  readonly acceptedPlayerIds: readonly string[];
}

/**
 * Create a new cooperative assault proposal.
 */
export function createCooperativeAssaultProposal(
  initiatorId: string,
  targetCity: CityColor,
  invitedPlayerIds: readonly string[],
  distribution: readonly EnemyDistribution[]
): CooperativeAssaultProposal {
  return {
    initiatorId,
    targetCity,
    invitedPlayerIds,
    distribution,
    acceptedPlayerIds: [],
  };
}

/**
 * Check if all invitees have accepted the proposal.
 */
export function isProposalFullyAccepted(
  proposal: CooperativeAssaultProposal
): boolean {
  return proposal.acceptedPlayerIds.length === proposal.invitedPlayerIds.length;
}

/**
 * Check if a player is an invitee who hasn't responded yet.
 */
export function isPendingResponse(
  proposal: CooperativeAssaultProposal,
  playerId: string
): boolean {
  return (
    proposal.invitedPlayerIds.includes(playerId) &&
    !proposal.acceptedPlayerIds.includes(playerId)
  );
}
