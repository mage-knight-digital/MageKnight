/**
 * Red-powered basic action cards (powered by red mana)
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_COMBAT,
  CATEGORY_INFLUENCE,
  CATEGORY_MOVEMENT,
  DEED_CARD_TYPE_BASIC_ACTION,
} from "../../types/cards.js";
import { COMBAT_TYPE_MELEE, COMBAT_TYPE_RANGED, COMBAT_TYPE_SIEGE } from "../../types/effectTypes.js";
import { ELEMENT_FIRE } from "../../types/modifierConstants.js";
import {
  MANA_RED,
  CARD_RAGE,
  CARD_THREATEN,
  CARD_IMPROVISATION,
  CARD_ARYTHEA_BATTLE_VERSATILITY,
  CARD_TOVAK_INSTINCT,
  CARD_KRANG_RUTHLESS_COERCION,
} from "@mage-knight/shared";
import {
  move,
  influence,
  attack,
  attackWithElement,
  block,
  blockWithElement,
  choice,
  compound,
  changeReputation,
} from "./helpers.js";

// === Shared Red Cards ===

export const RAGE: DeedCard = {
  id: CARD_RAGE,
  name: "Rage",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_COMBAT],
  // Basic: Attack or Block 2 | Powered: Attack 4
  basicEffect: choice(attack(2), block(2)),
  poweredEffect: attack(4),
  sidewaysValue: 1,
};

export const THREATEN: DeedCard = {
  id: CARD_THREATEN,
  name: "Threaten",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_INFLUENCE],
  // Basic: Influence 2 | Powered: Influence 5, Reputation -1
  basicEffect: influence(2),
  poweredEffect: compound(influence(5), changeReputation(-1)),
  sidewaysValue: 1,
};

export const IMPROVISATION: DeedCard = {
  id: CARD_IMPROVISATION,
  name: "Improvisation",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT, CATEGORY_INFLUENCE],
  // Basic: Discard a card → Move 3, Influence 3, Attack 3, or Block 3
  // Powered: Discard a card → Move 5, Influence 5, Attack 5, or Block 5
  // Note: Discard cost not modeled
  basicEffect: choice(move(3), influence(3), attack(3), block(3)),
  poweredEffect: choice(move(5), influence(5), attack(5), block(5)),
  sidewaysValue: 1,
};

// === Hero-Specific Red Cards ===

/**
 * Arythea's Battle Versatility (replaces Rage)
 */
export const ARYTHEA_BATTLE_VERSATILITY: DeedCard = {
  id: CARD_ARYTHEA_BATTLE_VERSATILITY,
  name: "Battle Versatility",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_COMBAT],
  // Basic: Attack 2, Block 2, or Ranged Attack 1
  // Powered: Attack 4, Block 4, Fire Attack 3, Fire Block 3, Ranged Attack 3, or Siege Attack 2
  basicEffect: choice(attack(2), block(2), attack(1, COMBAT_TYPE_RANGED)),
  poweredEffect: choice(
    attack(4),
    block(4),
    attackWithElement(3, COMBAT_TYPE_MELEE, ELEMENT_FIRE),
    blockWithElement(3, ELEMENT_FIRE),
    attack(3, COMBAT_TYPE_RANGED),
    attack(2, COMBAT_TYPE_SIEGE)
  ),
  sidewaysValue: 1,
};

/**
 * Tovak's Instinct (replaces Improvisation)
 */
export const TOVAK_INSTINCT: DeedCard = {
  id: CARD_TOVAK_INSTINCT,
  name: "Instinct",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_MOVEMENT, CATEGORY_INFLUENCE, CATEGORY_COMBAT],
  // Basic: Move 2, Influence 2, Attack 2, or Block 2 (no discard required!)
  // Powered: Move 4, Influence 4, Attack 4, or Block 4
  basicEffect: choice(move(2), influence(2), attack(2), block(2)),
  poweredEffect: choice(move(4), influence(4), attack(4), block(4)),
  sidewaysValue: 1,
};

/**
 * Krang's Ruthless Coercion (replaces Threaten)
 */
export const KRANG_RUTHLESS_COERCION: DeedCard = {
  id: CARD_KRANG_RUTHLESS_COERCION,
  name: "Ruthless Coercion",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_INFLUENCE],
  // Basic: Influence 2. May get -2 discount to recruit one Unit; if recruited, Reputation -1
  // Powered: Influence 6, Reputation -1. May ready Level I and II Units for 2 Influence/level
  // Note: Recruitment/ready mechanics not modeled
  basicEffect: influence(2),
  poweredEffect: influence(6),
  sidewaysValue: 1,
};

/** All red-powered basic action cards */
export const RED_BASIC_ACTIONS = {
  [CARD_RAGE]: RAGE,
  [CARD_THREATEN]: THREATEN,
  [CARD_IMPROVISATION]: IMPROVISATION,
  [CARD_ARYTHEA_BATTLE_VERSATILITY]: ARYTHEA_BATTLE_VERSATILITY,
  [CARD_TOVAK_INSTINCT]: TOVAK_INSTINCT,
  [CARD_KRANG_RUTHLESS_COERCION]: KRANG_RUTHLESS_COERCION,
} as const;
