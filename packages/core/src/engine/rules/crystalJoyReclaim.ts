/**
 * Crystal Joy reclaim rules - shared between validators and validActions.
 * Ensures consistent card eligibility checking for both enforcement and UI.
 */

import type { Card } from "../../types/cards.js";
import { CARD_WOUND } from "@mage-knight/shared";

/**
 * Check if a card is eligible to be reclaimed via Crystal Joy.
 * Basic version: non-wound cards only
 * Powered version: any card
 */
export function isCardEligibleForReclaim(
  card: Card,
  version: "basic" | "powered"
): boolean {
  if (version === "powered") {
    // Powered version allows any card including wounds
    return true;
  }

  // Basic version: must not be a wound card
  return card.id !== CARD_WOUND;
}
