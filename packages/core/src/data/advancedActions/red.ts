/**
 * Red Advanced Action Cards
 *
 * Red cards focus on aggressive combat and high-risk/high-reward mechanics.
 * Many involve taking wounds for powerful bonuses or reputation penalties
 * for combat/influence flexibility.
 *
 * @module data/advancedActions/red
 *
 * @remarks Cards in this module:
 * - Blood Rage - Attack with wound-for-bonus option
 * - Intimidate - Influence or Attack with reputation cost
 * - Blood Ritual - Wound for mana/crystals
 * - Into the Heat - Unit buff modifier
 * - Decompose - Discard wounds for benefits
 * - Maximal Effect - Boost card values
 * - Counterattack - Block that converts to attack
 * - Ritual Attack - Sacrifice units for damage
 * - Blood of Ancients - Powerful mana generation
 * - Explosive Bolt - Ranged fire with splash potential
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_COMBAT,
  CATEGORY_SPECIAL,
  CATEGORY_INFLUENCE,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../types/cards.js";
import {
  MANA_RED,
  MANA_WHITE,
  CARD_BLOOD_RAGE,
  CARD_INTIMIDATE,
  CARD_BLOOD_RITUAL,
  CARD_INTO_THE_HEAT,
  CARD_DECOMPOSE,
  CARD_MAXIMAL_EFFECT,
  CARD_COUNTERATTACK,
  CARD_RITUAL_ATTACK,
  CARD_BLOOD_OF_ANCIENTS,
  CARD_EXPLOSIVE_BOLT,
  type AdvancedActionCardId,
} from "@mage-knight/shared";
import {
  attack,
  attackWithElement,
  influence,
  rangedAttack,
  choice,
  compound,
  changeReputation,
  gainCrystal,
  ELEMENT_FIRE,
} from "./helpers.js";

/**
 * Red advanced action card definitions.
 *
 * These cards emphasize aggressive combat tactics and often involve
 * taking risks (wounds, reputation loss) for powerful effects.
 */
export const RED_ADVANCED_ACTIONS = {
  [CARD_BLOOD_RAGE]: {
    id: CARD_BLOOD_RAGE,
    name: "Blood Rage",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED],
    categories: [CATEGORY_COMBAT],
    // Basic: Attack 2. You can take a Wound to increase this to Attack 5.
    // Powered: Attack 4. You can take a Wound to increase this to Attack 9.
    // TODO: Implement wound-for-bonus mechanic
    basicEffect: attack(2),
    poweredEffect: attack(4),
    sidewaysValue: 1,
  },

  [CARD_INTIMIDATE]: {
    id: CARD_INTIMIDATE,
    name: "Intimidate",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED],
    categories: [CATEGORY_INFLUENCE, CATEGORY_COMBAT],
    // Basic: Influence 4 or Attack 3. Reputation -1.
    // Powered: Influence 8 or Attack 7. Reputation -2.
    basicEffect: compound(choice(influence(4), attack(3)), changeReputation(-1)),
    poweredEffect: compound(choice(influence(8), attack(7)), changeReputation(-2)),
    sidewaysValue: 1,
  },

  [CARD_BLOOD_RITUAL]: {
    id: CARD_BLOOD_RITUAL,
    name: "Blood Ritual",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED],
    categories: [CATEGORY_SPECIAL],
    // Basic: Take a Wound. Gain a red crystal to your Inventory and a mana token of any color (including non-basic).
    // Powered: Take a Wound. Gain three mana tokens of any colors (including non-basic). You may pay one mana of a basic color to gain a crystal of that color to your Inventory.
    // TODO: Implement wound-taking and mana token generation
    basicEffect: gainCrystal(MANA_RED),
    poweredEffect: gainCrystal(MANA_RED),
    sidewaysValue: 1,
  },

  [CARD_INTO_THE_HEAT]: {
    id: CARD_INTO_THE_HEAT,
    name: "Into the Heat",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED],
    categories: [CATEGORY_COMBAT],
    // Basic: Play this card at the start of combat. All of your Units get their Attack and Block values increased by 2 this combat. You cannot assign damage to your Units this turn.
    // Powered: Play this card at the start of combat. All of your Units get their Attack and Block values increased by 3 this combat. You cannot assign damage to your Units this turn.
    // TODO: Implement unit buff modifier and damage assignment restriction
    basicEffect: attack(2),
    poweredEffect: attack(3),
    sidewaysValue: 1,
  },

  [CARD_DECOMPOSE]: {
    id: CARD_DECOMPOSE,
    name: "Decompose",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED],
    categories: [CATEGORY_SPECIAL],
    // Basic: When you play this card, throw away an Action card from hand. Gain two crystals to your Inventory that are the same color as the thrown away card.
    // Powered: When you play this card, throw away an Action card from hand. Gain a crystal to your Inventory of each basic color that does not match the color of the thrown away card.
    // TODO: Implement throw-away mechanic and crystal generation based on discarded card
    basicEffect: gainCrystal(MANA_RED),
    poweredEffect: gainCrystal(MANA_RED),
    sidewaysValue: 1,
  },

  [CARD_MAXIMAL_EFFECT]: {
    id: CARD_MAXIMAL_EFFECT,
    name: "Maximal Effect",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED],
    categories: [CATEGORY_SPECIAL],
    // Basic: When you play this, throw away another Action card from your hand. Use the basic effect of that card three times.
    // Powered: When you play this, throw away another Action card from your hand. Use the stronger effect of that card two times (for free).
    // TODO: Implement throw-away mechanic and effect multiplication
    basicEffect: attack(3),
    poweredEffect: attack(6),
    sidewaysValue: 1,
  },

  [CARD_COUNTERATTACK]: {
    id: CARD_COUNTERATTACK,
    name: "Counterattack",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED],
    categories: [CATEGORY_COMBAT],
    // Basic: Attack 2. Get an additional Attack 2 for each enemy blocked this turn.
    // Powered: Attack 4. Get an additional Attack 3 for each enemy blocked this turn.
    // TODO: Implement scaling based on blocked enemies
    basicEffect: attack(2),
    poweredEffect: attack(4),
    sidewaysValue: 1,
  },

  [CARD_RITUAL_ATTACK]: {
    id: CARD_RITUAL_ATTACK,
    name: "Ritual Attack",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED],
    categories: [CATEGORY_COMBAT],
    // Basic: Throw away another Action card. Depending on its color, you get: Attack 5 for red, Ice Attack 3 for blue, Ranged Attack 3 for white, Siege Attack 2 for green.
    // Powered: Throw away another Action card. Depending on its color, you get: Fire Attack 6 for red, Cold Fire Attack 4 for blue, Ranged Fire Attack 4 for white, Siege Fire Attack 3 for green.
    // TODO: Implement throw-away mechanic with color-dependent attack
    basicEffect: attack(5),
    poweredEffect: attackWithElement(6, ELEMENT_FIRE),
    sidewaysValue: 1,
  },

  [CARD_BLOOD_OF_ANCIENTS]: {
    id: CARD_BLOOD_OF_ANCIENTS,
    name: "Blood of Ancients",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED],
    categories: [CATEGORY_SPECIAL],
    // Basic: Gain a Wound. Pay one mana of any color. Gain a card of that color from the Advanced Actions offer and put it into your hand.
    // Powered: Gain a Wound to your hand or discard pile. Use the stronger effect of any card from the Advanced Actions offer without paying its mana cost. The card remains in the offer.
    // TODO: Implement wound-taking, mana payment, and advanced action acquisition
    basicEffect: influence(3),
    poweredEffect: influence(6),
    sidewaysValue: 1,
  },

  [CARD_EXPLOSIVE_BOLT]: {
    id: CARD_EXPLOSIVE_BOLT,
    name: "Explosive Bolt",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED, MANA_WHITE], // Dual-color: can be powered by red OR white
    categories: [CATEGORY_SPECIAL, CATEGORY_COMBAT],
    // Basic: Take a Wound. Gain a white and a red crystal to your Inventory.
    // Powered: Ranged Attack 3. For each enemy defeated by this attack, another enemy gets Armor -1 (to a minimum of 1).
    // TODO: Implement wound-taking, dual crystal gain, and armor reduction on defeat
    basicEffect: gainCrystal(MANA_RED),
    poweredEffect: rangedAttack(3),
    sidewaysValue: 1,
  },
} satisfies Partial<Record<AdvancedActionCardId, DeedCard>>;
