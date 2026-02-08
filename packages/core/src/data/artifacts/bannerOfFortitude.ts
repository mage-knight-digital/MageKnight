/**
 * Banner of Fortitude artifact
 * Card #18 (305/377)
 *
 * Basic: Assign to a Unit. Once per Round, when Unit would be wounded,
 *        flip to ignore wound and any additional effects. Unit can still
 *        only be assigned damage once.
 * Powered (Any): Heal all Units completely (anytime except combat).
 *                Artifact is destroyed after use.
 *
 * FAQ:
 * - "Flip" = mark isUsedThisRound = true
 * - "Additional effects" includes Paralyze, Poison, Vampiric
 * - Does NOT prevent Brutal (doubles damage BEFORE assignment)
 * - Using Banner to ignore wound counts as unit's damage assignment
 * - THUGS require 2 influence to use Banner of Fortitude
 */

import type { DeedCard } from "../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import {
  CATEGORY_BANNER,
  CATEGORY_HEALING,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import { EFFECT_NOOP, EFFECT_HEAL_ALL_UNITS } from "../../types/effectTypes.js";
import {
  CARD_BANNER_OF_FORTITUDE,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";

const BANNER_OF_FORTITUDE: DeedCard = {
  id: CARD_BANNER_OF_FORTITUDE,
  name: "Banner of Fortitude",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_BANNER, CATEGORY_HEALING],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  // Basic: assign to unit (wound prevention handled in damage assignment)
  basicEffect: { type: EFFECT_NOOP },
  // Powered: heal all units completely
  poweredEffect: { type: EFFECT_HEAL_ALL_UNITS },
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const BANNER_OF_FORTITUDE_CARDS: Record<CardId, DeedCard> = {
  [CARD_BANNER_OF_FORTITUDE]: BANNER_OF_FORTITUDE,
};
