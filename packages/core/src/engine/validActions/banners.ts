/**
 * Banner Valid Actions
 *
 * Computes which banner assignment options are available to the player.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { BannerOptions } from "@mage-knight/shared";
import { getCard } from "../helpers/cardLookup.js";
import { isBannerArtifact } from "../rules/banners.js";

/**
 * Get banner assignment options for the current player.
 * Returns undefined if no banner actions are available.
 */
export function getBannerOptions(
  _state: GameState,
  player: Player
): BannerOptions | undefined {
  // Find banner cards in hand
  const bannerCardIds = player.hand.filter((cardId) => {
    const card = getCard(cardId);
    return card !== null && isBannerArtifact(card);
  });

  if (bannerCardIds.length === 0 || player.units.length === 0) {
    return undefined;
  }

  // All units can receive a banner
  const targetUnitInstanceIds = player.units.map((u) => u.instanceId);

  return {
    assignable: bannerCardIds.map((bannerCardId) => ({
      bannerCardId,
      targetUnits: targetUnitInstanceIds,
    })),
  };
}
