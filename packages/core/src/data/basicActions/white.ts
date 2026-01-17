/**
 * White-powered basic action cards (powered by white mana)
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CARD_CATEGORY_MOVEMENT,
  CARD_CATEGORY_COMBAT,
  CARD_CATEGORY_INFLUENCE,
  CARD_CATEGORY_SPECIAL,
  DEED_CARD_TYPE_BASIC_ACTION,
} from "../../types/cards.js";
import { COMBAT_TYPE_RANGED } from "../../types/effectTypes.js";
import {
  MANA_WHITE,
  CARD_SWIFTNESS,
  CARD_PROMISE,
  CARD_MANA_DRAW,
  CARD_ARYTHEA_MANA_PULL,
  CARD_NOROWAS_NOBLE_MANNERS,
} from "@mage-knight/shared";
import {
  move,
  influence,
  attack,
  grantExtraSourceDie,
  grantExtraSourceDieWithBlackAsAnyColor,
  manaDrawPowered,
  manaPullPowered,
} from "./helpers.js";

// === Shared White Cards ===

export const SWIFTNESS: DeedCard = {
  id: CARD_SWIFTNESS,
  name: "Swiftness",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CARD_CATEGORY_MOVEMENT, CARD_CATEGORY_COMBAT],
  // Basic: Move 2 | Powered: Ranged Attack 3
  basicEffect: move(2),
  poweredEffect: attack(3, COMBAT_TYPE_RANGED),
  sidewaysValue: 1,
};

export const PROMISE: DeedCard = {
  id: CARD_PROMISE,
  name: "Promise",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CARD_CATEGORY_INFLUENCE],
  // Basic: Influence 2 | Powered: Influence 4
  basicEffect: influence(2),
  poweredEffect: influence(4),
  sidewaysValue: 1,
};

export const MANA_DRAW: DeedCard = {
  id: CARD_MANA_DRAW,
  name: "Mana Draw",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CARD_CATEGORY_SPECIAL],
  // Basic: Use 1 additional mana die from Source this turn
  basicEffect: grantExtraSourceDie(),
  // Powered: Take a die, set to any basic color, gain 2 mana tokens of that color
  // Die is returned at end of turn WITHOUT rerolling (keeps chosen color)
  poweredEffect: manaDrawPowered(),
  sidewaysValue: 1,
};

// === Hero-Specific White Cards ===

/**
 * Arythea's Mana Pull (replaces Mana Draw)
 */
export const ARYTHEA_MANA_PULL: DeedCard = {
  id: CARD_ARYTHEA_MANA_PULL,
  name: "Mana Pull",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CARD_CATEGORY_SPECIAL],
  // Basic: Use 1 additional die from Source; if black, use as any color
  basicEffect: grantExtraSourceDieWithBlackAsAnyColor(),
  // Powered: Take 2 dice, set each to any non-gold color, gain 1 mana token of each
  // Dice don't reroll when returned
  poweredEffect: manaPullPowered(),
  sidewaysValue: 1,
};

/**
 * Norowas's Noble Manners (replaces Promise)
 */
export const NOROWAS_NOBLE_MANNERS: DeedCard = {
  id: CARD_NOROWAS_NOBLE_MANNERS,
  name: "Noble Manners",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CARD_CATEGORY_INFLUENCE],
  // Basic: Influence 2. If used during interaction: Fame +1 at end of turn
  // Powered: Influence 4. If used during interaction: Fame +1 and Reputation +1
  // Note: Fame/Rep bonuses not modeled
  basicEffect: influence(2),
  poweredEffect: influence(4),
  sidewaysValue: 1,
};

/** All white-powered basic action cards */
export const WHITE_BASIC_ACTIONS = {
  [CARD_SWIFTNESS]: SWIFTNESS,
  [CARD_PROMISE]: PROMISE,
  [CARD_MANA_DRAW]: MANA_DRAW,
  [CARD_ARYTHEA_MANA_PULL]: ARYTHEA_MANA_PULL,
  [CARD_NOROWAS_NOBLE_MANNERS]: NOROWAS_NOBLE_MANNERS,
} as const;
