/**
 * Converts a CardPlayabilityResult into the PlayableCard shape
 * sent to the client via @mage-knight/shared.
 *
 * @module validActions/cards/playableCardBuilder
 */

import type { PlayableCard, ManaColor, ManaSourceInfo, SidewaysOption } from "@mage-knight/shared";
import { DEED_CARD_TYPE_SPELL } from "../../../types/cards.js";
import type { CardPlayabilityResult } from "./cardPlayability.js";

/**
 * Convert a CardPlayabilityResult to the PlayableCard shape for the client.
 *
 * Returns null if the card has no playable option (basic, powered, or sideways).
 */
export function toPlayableCard(result: CardPlayabilityResult): PlayableCard | null {
  const canPlayBasic = result.basic.playable;
  const canPlayPowered = result.powered.playable;
  const canPlaySideways = result.sideways.canPlay;

  if (!canPlayBasic && !canPlayPowered && !canPlaySideways) {
    return null;
  }

  const playableCard: PlayableCard = {
    cardId: result.cardId,
    name: result.card.name,
    canPlayBasic,
    canPlayPowered,
    canPlaySideways,
    basicEffectDescription: result.basicEffectDescription,
    poweredEffectDescription: result.poweredEffectDescription,
  };

  if (canPlayPowered && result.powered.manaColor) {
    (playableCard as { requiredMana?: ManaColor }).requiredMana = result.powered.manaColor;
    if (result.poweredManaOptions) {
      (playableCard as { poweredManaOptions?: readonly ManaSourceInfo[] }).poweredManaOptions = result.poweredManaOptions;
    }
  }

  if (result.card.cardType === DEED_CARD_TYPE_SPELL) {
    (playableCard as { isSpell?: boolean }).isSpell = true;
  }

  if (canPlaySideways && result.sideways.options.length > 0) {
    (playableCard as { sidewaysOptions?: readonly SidewaysOption[] }).sidewaysOptions = result.sideways.options;
  }

  return playableCard;
}
