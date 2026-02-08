import type { DeedCard, DecomposeEffect } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_DECOMPOSE } from "@mage-knight/shared";
import { EFFECT_DECOMPOSE } from "../../../types/effectTypes.js";

const basicEffect: DecomposeEffect = {
  type: EFFECT_DECOMPOSE,
  mode: "basic",
};

const poweredEffect: DecomposeEffect = {
  type: EFFECT_DECOMPOSE,
  mode: "powered",
};

export const DECOMPOSE: DeedCard = {
  id: CARD_DECOMPOSE,
  name: "Decompose",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_SPECIAL],
  // Basic: Throw away an Action card from hand → gain 2 crystals of matching color
  // Powered: Throw away an Action card from hand → gain 1 crystal of each non-matching basic color
  basicEffect,
  poweredEffect,
  sidewaysValue: 1,
};
