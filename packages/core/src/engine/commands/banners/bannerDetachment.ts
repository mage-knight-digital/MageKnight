/**
 * Banner Detachment Helpers
 *
 * Pure functions to handle banner detachment when units are
 * destroyed, disbanded, or at end of round.
 *
 * @module commands/banners/bannerDetachment
 */

import type { Player, BannerAttachment } from "../../../types/player.js";
import type { GameEvent, CardId } from "@mage-knight/shared";
import {
  BANNER_DETACHED,
  type BannerDetachReason,
} from "@mage-knight/shared";

export interface BannerDetachResult {
  readonly updatedAttachedBanners: readonly BannerAttachment[];
  readonly updatedDiscard: readonly CardId[];
  readonly events: readonly GameEvent[];
}

/**
 * Detach a banner from a unit and move it to the player's discard.
 * Returns updated attachedBanners, discard, and events.
 */
export function detachBannerFromUnit(
  player: Player,
  unitInstanceId: string,
  reason: BannerDetachReason
): BannerDetachResult {
  const banner = player.attachedBanners.find(
    (b) => b.unitInstanceId === unitInstanceId
  );

  if (!banner) {
    return {
      updatedAttachedBanners: player.attachedBanners,
      updatedDiscard: player.discard,
      events: [],
    };
  }

  const updatedAttachedBanners = player.attachedBanners.filter(
    (b) => b.unitInstanceId !== unitInstanceId
  );
  const updatedDiscard = [...player.discard, banner.bannerId];
  const events: GameEvent[] = [
    {
      type: BANNER_DETACHED,
      playerId: player.id,
      bannerCardId: banner.bannerId,
      unitInstanceId,
      reason,
      destination: "discard",
    },
  ];

  return { updatedAttachedBanners, updatedDiscard, events };
}
