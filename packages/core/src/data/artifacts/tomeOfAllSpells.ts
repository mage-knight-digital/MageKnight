/**
 * Tome of All Spells artifact
 * Card #23 (310/377)
 *
 * Basic: Discard card of any color. Use basic effect of Spell
 *        of same color from offer without paying mana.
 * Powered: Discard card. Use stronger effect of Spell of same color
 *          from offer without mana cost. Works even during Day.
 *          Artifact is destroyed after powered use.
 */

import type { DeedCard } from "../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ARTIFACT } from "../../types/cards.js";
import {
  CARD_TOME_OF_ALL_SPELLS,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import { EFFECT_TOME_OF_ALL_SPELLS } from "../../types/effectTypes.js";

export const TOME_OF_ALL_SPELLS: DeedCard = {
  id: CARD_TOME_OF_ALL_SPELLS,
  name: "Tome of All Spells",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  categories: [CATEGORY_SPECIAL],
  basicEffect: { type: EFFECT_TOME_OF_ALL_SPELLS, mode: "basic" },
  poweredEffect: { type: EFFECT_TOME_OF_ALL_SPELLS, mode: "powered" },
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const TOME_OF_ALL_SPELLS_CARDS: Record<CardId, DeedCard> = {
  [CARD_TOME_OF_ALL_SPELLS]: TOME_OF_ALL_SPELLS,
};
