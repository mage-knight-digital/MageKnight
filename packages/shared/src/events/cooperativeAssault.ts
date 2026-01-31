/**
 * Cooperative assault events
 *
 * Events for the proposal and agreement system of cooperative city assaults.
 */

import type { CityColor, EnemyDistribution } from "../cooperativeAssault.js";

// Event type constants
export const COOPERATIVE_ASSAULT_PROPOSED = "COOPERATIVE_ASSAULT_PROPOSED" as const;
export const COOPERATIVE_ASSAULT_RESPONSE = "COOPERATIVE_ASSAULT_RESPONSE" as const;
export const COOPERATIVE_ASSAULT_AGREED = "COOPERATIVE_ASSAULT_AGREED" as const;
export const COOPERATIVE_ASSAULT_REJECTED = "COOPERATIVE_ASSAULT_REJECTED" as const;
export const COOPERATIVE_ASSAULT_CANCELLED = "COOPERATIVE_ASSAULT_CANCELLED" as const;

/**
 * Event when a player proposes a cooperative assault.
 */
export interface CooperativeAssaultProposedEvent {
  readonly type: typeof COOPERATIVE_ASSAULT_PROPOSED;
  readonly initiatorId: string;
  readonly targetCity: CityColor;
  readonly invitedPlayerIds: readonly string[];
  readonly distribution: readonly EnemyDistribution[];
}

/**
 * Event when an invited player responds to a proposal.
 */
export interface CooperativeAssaultResponseEvent {
  readonly type: typeof COOPERATIVE_ASSAULT_RESPONSE;
  readonly playerId: string;
  readonly accepted: boolean;
}

/**
 * Event when all invitees accept and the assault is agreed upon.
 */
export interface CooperativeAssaultAgreedEvent {
  readonly type: typeof COOPERATIVE_ASSAULT_AGREED;
  readonly initiatorId: string;
  readonly participantIds: readonly string[];
  readonly targetCity: CityColor;
}

/**
 * Event when an invitee declines and the proposal is rejected.
 */
export interface CooperativeAssaultRejectedEvent {
  readonly type: typeof COOPERATIVE_ASSAULT_REJECTED;
  readonly initiatorId: string;
  readonly rejectingPlayerId: string;
}

/**
 * Event when the initiator cancels the proposal.
 */
export interface CooperativeAssaultCancelledEvent {
  readonly type: typeof COOPERATIVE_ASSAULT_CANCELLED;
  readonly initiatorId: string;
}

// Factory functions

export function createCooperativeAssaultProposedEvent(
  initiatorId: string,
  targetCity: CityColor,
  invitedPlayerIds: readonly string[],
  distribution: readonly EnemyDistribution[]
): CooperativeAssaultProposedEvent {
  return {
    type: COOPERATIVE_ASSAULT_PROPOSED,
    initiatorId,
    targetCity,
    invitedPlayerIds,
    distribution,
  };
}

export function createCooperativeAssaultResponseEvent(
  playerId: string,
  accepted: boolean
): CooperativeAssaultResponseEvent {
  return {
    type: COOPERATIVE_ASSAULT_RESPONSE,
    playerId,
    accepted,
  };
}

export function createCooperativeAssaultAgreedEvent(
  initiatorId: string,
  participantIds: readonly string[],
  targetCity: CityColor
): CooperativeAssaultAgreedEvent {
  return {
    type: COOPERATIVE_ASSAULT_AGREED,
    initiatorId,
    participantIds,
    targetCity,
  };
}

export function createCooperativeAssaultRejectedEvent(
  initiatorId: string,
  rejectingPlayerId: string
): CooperativeAssaultRejectedEvent {
  return {
    type: COOPERATIVE_ASSAULT_REJECTED,
    initiatorId,
    rejectingPlayerId,
  };
}

export function createCooperativeAssaultCancelledEvent(
  initiatorId: string
): CooperativeAssaultCancelledEvent {
  return {
    type: COOPERATIVE_ASSAULT_CANCELLED,
    initiatorId,
  };
}

// Type guards

export function isCooperativeAssaultProposedEvent(
  event: unknown
): event is CooperativeAssaultProposedEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    (event as { type: unknown }).type === COOPERATIVE_ASSAULT_PROPOSED
  );
}

export function isCooperativeAssaultResponseEvent(
  event: unknown
): event is CooperativeAssaultResponseEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    (event as { type: unknown }).type === COOPERATIVE_ASSAULT_RESPONSE
  );
}

export function isCooperativeAssaultAgreedEvent(
  event: unknown
): event is CooperativeAssaultAgreedEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    (event as { type: unknown }).type === COOPERATIVE_ASSAULT_AGREED
  );
}

export function isCooperativeAssaultRejectedEvent(
  event: unknown
): event is CooperativeAssaultRejectedEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    (event as { type: unknown }).type === COOPERATIVE_ASSAULT_REJECTED
  );
}

export function isCooperativeAssaultCancelledEvent(
  event: unknown
): event is CooperativeAssaultCancelledEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    (event as { type: unknown }).type === COOPERATIVE_ASSAULT_CANCELLED
  );
}
