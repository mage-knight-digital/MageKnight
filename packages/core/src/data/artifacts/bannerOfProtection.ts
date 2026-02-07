/**
 * Banner of Protection artifact
 * Card #02 (115/377)
 *
 * Basic: Assign to a Unit. Unit gets Armor +1, fire resistance, ice resistance.
 * Powered (Any): At end of turn, you may throw away all Wounds received this turn.
 *                Artifact is destroyed after use.
 *
 * FAQ:
 * - "Received this turn" includes wounds to hand AND discard (poison, effects)
 * - Does NOT include wounds drawn from deck (already existed)
 * - Does NOT include wounds on units
 * - Player can choose which received wounds to throw away ("may")
 * - Has Attack category (crossed swords) - can be played during combat
 * - Playing it doesn't prevent knockout
 * - Wound removal happens at end of turn
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_BANNER,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import { EFFECT_NOOP, EFFECT_ACTIVATE_BANNER_PROTECTION } from "../../types/effectTypes.js";
import { CARD_BANNER_OF_PROTECTION, MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

const BANNER_OF_PROTECTION: DeedCard = {
  id: CARD_BANNER_OF_PROTECTION,
  name: "Banner of Protection",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_BANNER, CATEGORY_COMBAT],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  // Basic: assign to unit (armor +1, fire/ice resistance handled by banner system)
  basicEffect: { type: EFFECT_NOOP },
  // Powered: activates Banner of Protection flag; wound removal happens at end of turn
  poweredEffect: { type: EFFECT_ACTIVATE_BANNER_PROTECTION },
  sidewaysValue: 0,
  destroyOnPowered: true,
};

export const BANNER_OF_PROTECTION_CARDS: Record<CardId, DeedCard> = {
  [CARD_BANNER_OF_PROTECTION]: BANNER_OF_PROTECTION,
};
