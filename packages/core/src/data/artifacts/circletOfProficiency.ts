/**
 * Circlet of Proficiency artifact
 * Card #22 (309/377)
 *
 * Basic: Use any non-interactive Skill from Common Skills offer.
 *        If usable each turn (doesn't flip), use effect twice.
 * Powered: Take any Skill from offer and keep permanently.
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import {
  EFFECT_CIRCLET_OF_PROFICIENCY_BASIC,
  EFFECT_CIRCLET_OF_PROFICIENCY_POWERED,
} from "../../types/effectTypes.js";
import type { CardId } from "@mage-knight/shared";
import {
  CARD_CIRCLET_OF_PROFICIENCY,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";

export const CIRCLET_OF_PROFICIENCY: DeedCard = {
  id: CARD_CIRCLET_OF_PROFICIENCY,
  name: "Circlet of Proficiency",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  categories: [CATEGORY_SPECIAL],
  basicEffect: { type: EFFECT_CIRCLET_OF_PROFICIENCY_BASIC },
  poweredEffect: { type: EFFECT_CIRCLET_OF_PROFICIENCY_POWERED },
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const CIRCLET_OF_PROFICIENCY_CARDS: Record<CardId, DeedCard> = {
  [CARD_CIRCLET_OF_PROFICIENCY]: CIRCLET_OF_PROFICIENCY,
};
