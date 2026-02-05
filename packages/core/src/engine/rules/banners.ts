/**
 * Banner rules.
 *
 * Pure functions defining banner-related game mechanics.
 * Shared by validators, validActions, and commands.
 */

import type { DeedCard } from "../../types/cards.js";
import type { Player, BannerAttachment } from "../../types/player.js";
import type { CardId } from "@mage-knight/shared";
import { DEED_CARD_TYPE_ARTIFACT, CATEGORY_BANNER } from "../../types/cards.js";

/**
 * Check if a card is a banner artifact (artifact with banner category).
 */
export function isBannerArtifact(card: DeedCard): boolean {
  return (
    card.cardType === DEED_CARD_TYPE_ARTIFACT &&
    card.categories.includes(CATEGORY_BANNER)
  );
}

/**
 * Get the banner attachment for a specific unit, if any.
 */
export function getBannerForUnit(
  player: Player,
  unitInstanceId: string
): BannerAttachment | undefined {
  return player.attachedBanners.find(
    (b) => b.unitInstanceId === unitInstanceId
  );
}

/**
 * Check if a banner has been used this round.
 */
export function isBannerUsedThisRound(
  player: Player,
  bannerId: CardId
): boolean {
  const attachment = player.attachedBanners.find(
    (b) => b.bannerId === bannerId
  );
  return attachment?.isUsedThisRound ?? false;
}

/**
 * Mark a banner as used this round. Returns the updated attachedBanners array.
 */
export function markBannerUsed(
  attachedBanners: readonly BannerAttachment[],
  bannerId: CardId
): readonly BannerAttachment[] {
  return attachedBanners.map((b) =>
    b.bannerId === bannerId ? { ...b, isUsedThisRound: true } : b
  );
}
