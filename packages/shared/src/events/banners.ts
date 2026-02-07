/**
 * Banner Events
 *
 * Events related to banner artifact assignment, detachment, and round reset.
 *
 * @module events/banners
 */

import type { CardId } from "../ids.js";

// ============================================================================
// BANNER_ASSIGNED
// ============================================================================

export const BANNER_ASSIGNED = "BANNER_ASSIGNED" as const;

export interface BannerAssignedEvent {
  readonly type: typeof BANNER_ASSIGNED;
  readonly playerId: string;
  readonly bannerCardId: CardId;
  readonly unitInstanceId: string;
}

// ============================================================================
// BANNER_DETACHED
// ============================================================================

export const BANNER_DETACHED = "BANNER_DETACHED" as const;

export const BANNER_DETACH_REASON_UNIT_DESTROYED = "unit_destroyed" as const;
export const BANNER_DETACH_REASON_UNIT_DISBANDED = "unit_disbanded" as const;
export const BANNER_DETACH_REASON_REPLACED = "replaced" as const;
export const BANNER_DETACH_REASON_ROUND_END = "round_end" as const;

export type BannerDetachReason =
  | typeof BANNER_DETACH_REASON_UNIT_DESTROYED
  | typeof BANNER_DETACH_REASON_UNIT_DISBANDED
  | typeof BANNER_DETACH_REASON_REPLACED
  | typeof BANNER_DETACH_REASON_ROUND_END;

export interface BannerDetachedEvent {
  readonly type: typeof BANNER_DETACHED;
  readonly playerId: string;
  readonly bannerCardId: CardId;
  readonly unitInstanceId: string;
  readonly reason: BannerDetachReason;
  /** Where the banner goes: "discard" or "deck" */
  readonly destination: "discard" | "deck";
}

// ============================================================================
// BANNER_FEAR_CANCEL_ATTACK
// ============================================================================

export const BANNER_FEAR_CANCEL_ATTACK = "BANNER_FEAR_CANCEL_ATTACK" as const;

export interface BannerFearCancelAttackEvent {
  readonly type: typeof BANNER_FEAR_CANCEL_ATTACK;
  readonly playerId: string;
  readonly unitInstanceId: string;
  readonly enemyInstanceId: string;
  readonly attackIndex: number;
  readonly fameGained: number;
}

// ============================================================================
// BANNERS_RESET
// ============================================================================

export const BANNERS_RESET = "BANNERS_RESET" as const;

export interface BannersResetEvent {
  readonly type: typeof BANNERS_RESET;
  readonly playerId: string;
  readonly bannerCount: number;
}
