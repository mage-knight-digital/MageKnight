/**
 * Advanced action card definitions for Mage Knight
 *
 * Advanced actions are powerful cards acquired during the game from the
 * Advanced Actions offer. Each has a basic effect (top) and powered effect (bottom).
 *
 * NOTE: Many advanced actions have complex effects that require special handling
 * beyond the basic effect system. These are marked with TODO comments and use
 * placeholder effects that capture the primary value but may not fully implement
 * the card's abilities.
 */

import type { DeedCard, CardEffect } from "../types/cards.js";
import {
  CARD_CATEGORY_COMBAT,
  CARD_CATEGORY_SPECIAL,
  CARD_CATEGORY_MOVEMENT,
  CARD_CATEGORY_INFLUENCE,
  CARD_CATEGORY_HEALING,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../types/cards.js";
import {
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_CHANGE_REPUTATION,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../types/effectTypes.js";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  // Bolt cards
  CARD_FIRE_BOLT,
  CARD_ICE_BOLT,
  CARD_SWIFT_BOLT,
  CARD_CRUSHING_BOLT,
  // Red advanced actions
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
  // Blue advanced actions
  CARD_ICE_SHIELD,
  CARD_FROST_BRIDGE,
  CARD_PURE_MAGIC,
  CARD_STEADY_TEMPO,
  CARD_CRYSTAL_MASTERY,
  CARD_MAGIC_TALENT,
  CARD_SHIELD_BASH,
  CARD_TEMPORAL_PORTAL,
  CARD_SPELL_FORGE,
  // White advanced actions
  CARD_AGILITY,
  CARD_SONG_OF_WIND,
  CARD_HEROIC_TALE,
  CARD_DIPLOMACY,
  CARD_MANA_STORM,
  CARD_LEARNING,
  CARD_CHIVALRY,
  CARD_PEACEFUL_MOMENT,
  CARD_DODGE_AND_WEAVE,
  // Green advanced actions
  CARD_REFRESHING_WALK,
  CARD_PATH_FINDING,
  CARD_REGENERATION,
  CARD_IN_NEED,
  CARD_AMBUSH,
  CARD_TRAINING,
  CARD_STOUT_RESOLVE,
  CARD_FORCE_OF_NATURE,
  CARD_MOUNTAIN_LORE,
  CARD_POWER_OF_CRYSTALS,
  // Dual-color advanced actions
  CARD_RUSH_OF_ADRENALINE,
  CARD_CHILLING_STARE,
  type AdvancedActionCardId,
  type BasicManaColor,
} from "@mage-knight/shared";
import { ELEMENT_FIRE, ELEMENT_ICE } from "../types/modifierConstants.js";

// === Effect Helpers ===

function gainCrystal(color: BasicManaColor): CardEffect {
  return { type: EFFECT_GAIN_CRYSTAL, color };
}

function attack(amount: number): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_MELEE };
}

function attackWithElement(
  amount: number,
  element: typeof ELEMENT_FIRE | typeof ELEMENT_ICE
): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_MELEE, element };
}

function rangedAttack(amount: number): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_RANGED };
}

function rangedAttackWithElement(
  amount: number,
  element: typeof ELEMENT_FIRE | typeof ELEMENT_ICE
): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_RANGED, element };
}

function siegeAttack(amount: number): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_SIEGE };
}

// Reserved for future use when implementing siege attacks with elements
// function siegeAttackWithElement(
//   amount: number,
//   element: typeof ELEMENT_FIRE | typeof ELEMENT_ICE
// ): CardEffect {
//   return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_SIEGE, element };
// }

function block(amount: number): CardEffect {
  return { type: EFFECT_GAIN_BLOCK, amount };
}

function blockWithElement(
  amount: number,
  element: typeof ELEMENT_ICE | typeof ELEMENT_FIRE
): CardEffect {
  return { type: EFFECT_GAIN_BLOCK, amount, element };
}

function move(amount: number): CardEffect {
  return { type: EFFECT_GAIN_MOVE, amount };
}

function influence(amount: number): CardEffect {
  return { type: EFFECT_GAIN_INFLUENCE, amount };
}

function heal(amount: number): CardEffect {
  return { type: EFFECT_GAIN_HEALING, amount };
}

function choice(...options: CardEffect[]): CardEffect {
  return { type: EFFECT_CHOICE, options };
}

function compound(...effects: CardEffect[]): CardEffect {
  return { type: EFFECT_COMPOUND, effects };
}

function changeReputation(amount: number): CardEffect {
  return { type: EFFECT_CHANGE_REPUTATION, amount };
}

// === Advanced Action Card Definitions ===

export const ADVANCED_ACTION_CARDS = {
  // ═══════════════════════════════════════════════════════════════════════════
  // BOLT CARDS (gain crystal basic / ranged attack powered)
  // ═══════════════════════════════════════════════════════════════════════════

  [CARD_FIRE_BOLT]: {
    id: CARD_FIRE_BOLT,
    name: "Fire Bolt",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED],
    categories: [CARD_CATEGORY_SPECIAL, CARD_CATEGORY_COMBAT],
    // Basic: Gain a red crystal to your Inventory
    // Powered: Ranged Fire Attack 3
    basicEffect: gainCrystal(MANA_RED),
    poweredEffect: rangedAttackWithElement(3, ELEMENT_FIRE),
    sidewaysValue: 1,
  },

  [CARD_ICE_BOLT]: {
    id: CARD_ICE_BOLT,
    name: "Ice Bolt",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_BLUE],
    categories: [CARD_CATEGORY_SPECIAL, CARD_CATEGORY_COMBAT],
    // Basic: Gain a blue crystal to your Inventory
    // Powered: Ranged Ice Attack 3
    basicEffect: gainCrystal(MANA_BLUE),
    poweredEffect: rangedAttackWithElement(3, ELEMENT_ICE),
    sidewaysValue: 1,
  },

  [CARD_SWIFT_BOLT]: {
    id: CARD_SWIFT_BOLT,
    name: "Swift Bolt",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_WHITE],
    categories: [CARD_CATEGORY_SPECIAL, CARD_CATEGORY_COMBAT],
    // Basic: Gain a white crystal to your Inventory
    // Powered: Ranged Attack 4
    basicEffect: gainCrystal(MANA_WHITE),
    poweredEffect: rangedAttack(4),
    sidewaysValue: 1,
  },

  [CARD_CRUSHING_BOLT]: {
    id: CARD_CRUSHING_BOLT,
    name: "Crushing Bolt",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN],
    categories: [CARD_CATEGORY_SPECIAL, CARD_CATEGORY_COMBAT],
    // Basic: Gain a green crystal to your Inventory
    // Powered: Siege Attack 3
    basicEffect: gainCrystal(MANA_GREEN),
    poweredEffect: siegeAttack(3),
    sidewaysValue: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RED ADVANCED ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  [CARD_BLOOD_RAGE]: {
    id: CARD_BLOOD_RAGE,
    name: "Blood Rage",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED],
    categories: [CARD_CATEGORY_COMBAT],
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
    categories: [CARD_CATEGORY_INFLUENCE, CARD_CATEGORY_COMBAT],
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
    categories: [CARD_CATEGORY_SPECIAL],
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
    categories: [CARD_CATEGORY_COMBAT],
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
    categories: [CARD_CATEGORY_SPECIAL],
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
    categories: [CARD_CATEGORY_SPECIAL],
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
    categories: [CARD_CATEGORY_COMBAT],
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
    categories: [CARD_CATEGORY_COMBAT],
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
    categories: [CARD_CATEGORY_SPECIAL],
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
    categories: [CARD_CATEGORY_SPECIAL, CARD_CATEGORY_COMBAT],
    // Basic: Take a Wound. Gain a white and a red crystal to your Inventory.
    // Powered: Ranged Attack 3. For each enemy defeated by this attack, another enemy gets Armor -1 (to a minimum of 1).
    // TODO: Implement wound-taking, dual crystal gain, and armor reduction on defeat
    basicEffect: gainCrystal(MANA_RED),
    poweredEffect: rangedAttack(3),
    sidewaysValue: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLUE ADVANCED ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  [CARD_ICE_SHIELD]: {
    id: CARD_ICE_SHIELD,
    name: "Ice Shield",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_BLUE],
    categories: [CARD_CATEGORY_COMBAT],
    // Basic: Ice Block 3
    // Powered: Ice Block 3. Reduce the Armor of one enemy blocked this way by 3. Armor cannot be reduced below 1.
    // TODO: Implement armor reduction on block
    basicEffect: blockWithElement(3, ELEMENT_ICE),
    poweredEffect: blockWithElement(3, ELEMENT_ICE),
    sidewaysValue: 1,
  },

  [CARD_FROST_BRIDGE]: {
    id: CARD_FROST_BRIDGE,
    name: "Frost Bridge",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_BLUE],
    categories: [CARD_CATEGORY_MOVEMENT],
    // Basic: Move 2. The Move cost of swamps is reduced to 1 this turn.
    // Powered: Move 4. You are able to travel through lakes, and the Move cost of lakes and swamps is reduced to 1 this turn.
    // TODO: Implement terrain cost modifier
    basicEffect: move(2),
    poweredEffect: move(4),
    sidewaysValue: 1,
  },

  [CARD_PURE_MAGIC]: {
    id: CARD_PURE_MAGIC,
    name: "Pure Magic",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_BLUE],
    categories: [CARD_CATEGORY_MOVEMENT, CARD_CATEGORY_INFLUENCE, CARD_CATEGORY_COMBAT],
    // Basic: When you play this, pay a mana. If you paid green, Move 4. If you paid white, Influence 4. If you paid blue, Block 4. If you paid red, Attack 4.
    // Powered: When you play this, pay a mana. If you paid green, Move 7. If you paid white, Influence 7. If you paid blue, Block 7. If you paid red, Attack 7.
    // TODO: Implement mana-color-dependent effect
    basicEffect: choice(move(4), influence(4), block(4), attack(4)),
    poweredEffect: choice(move(7), influence(7), block(7), attack(7)),
    sidewaysValue: 1,
  },

  [CARD_STEADY_TEMPO]: {
    id: CARD_STEADY_TEMPO,
    name: "Steady Tempo",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_BLUE],
    categories: [CARD_CATEGORY_MOVEMENT],
    // Basic: Move 2. At the end of your turn, instead of putting this card in your discard pile, you may place it on the bottom of your Deed deck as long as it is not empty.
    // Powered: Move 4. At the end of your turn, instead of putting this card in your discard pile, you may place it on top of your Deed deck.
    // TODO: Implement deck placement modifier
    basicEffect: move(2),
    poweredEffect: move(4),
    sidewaysValue: 1,
  },

  [CARD_CRYSTAL_MASTERY]: {
    id: CARD_CRYSTAL_MASTERY,
    name: "Crystal Mastery",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_BLUE],
    categories: [CARD_CATEGORY_SPECIAL],
    // Basic: Gain a crystal to your Inventory of the same color as a crystal you already own.
    // Powered: At the end of the turn, any crystals you have spent this turn are returned to your Inventory.
    // TODO: Implement crystal duplication and crystal return mechanic
    basicEffect: gainCrystal(MANA_BLUE),
    poweredEffect: gainCrystal(MANA_BLUE),
    sidewaysValue: 1,
  },

  [CARD_MAGIC_TALENT]: {
    id: CARD_MAGIC_TALENT,
    name: "Magic Talent",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_BLUE],
    categories: [CARD_CATEGORY_SPECIAL],
    // Basic: Discard a card of any color. You may play one Spell card of the same color in the Spells offer this turn as if it were in your hand. That card remains in the Spells offer.
    // Powered: When you play this, pay a mana of any color. Gain a Spell card of that color from the Spells Offer and put it in your discard pile.
    // TODO: Implement spell offer interaction
    basicEffect: influence(2),
    poweredEffect: influence(4),
    sidewaysValue: 1,
  },

  [CARD_SHIELD_BASH]: {
    id: CARD_SHIELD_BASH,
    name: "Shield Bash",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_BLUE],
    categories: [CARD_CATEGORY_COMBAT],
    // Basic: Block 3. Counts twice against an attack with Swiftness.
    // Powered: Block 5. Counts twice against an attack with Swiftness. Blocked enemy gets Armor -1 for each point of block higher than needed (to a minimum of 1).
    // TODO: Implement swiftness counter and armor reduction
    basicEffect: block(3),
    poweredEffect: block(5),
    sidewaysValue: 1,
  },

  [CARD_TEMPORAL_PORTAL]: {
    id: CARD_TEMPORAL_PORTAL,
    name: "Temporal Portal",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_BLUE],
    categories: [CARD_CATEGORY_SPECIAL],
    // Basic: Play as your action for this turn. You may move to an adjacent revealed safe space (without provoking rampaging monsters). Whether you move or not, your Hand limit is higher by 1 the next time you draw cards.
    // Powered: As above, except you can either move two spaces to a revealed safe space instead of one, or get your Hand limit increased by 2 instead of 1.
    // TODO: Implement teleport and hand limit modifier
    basicEffect: move(1),
    poweredEffect: move(2),
    sidewaysValue: 1,
  },

  [CARD_SPELL_FORGE]: {
    id: CARD_SPELL_FORGE,
    name: "Spell Forge",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_BLUE],
    categories: [CARD_CATEGORY_SPECIAL],
    // Basic: Gain one crystal to your Inventory of the same color as one of the Spell cards in the Spells offer.
    // Powered: Gain two crystals to your Inventory of the same colors as two different Spell cards in the Spells offer.
    // TODO: Implement spell offer interaction for crystal gain
    basicEffect: gainCrystal(MANA_BLUE),
    poweredEffect: gainCrystal(MANA_BLUE),
    sidewaysValue: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WHITE ADVANCED ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  [CARD_AGILITY]: {
    id: CARD_AGILITY,
    name: "Agility",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_WHITE],
    categories: [CARD_CATEGORY_COMBAT],
    // Basic: Move 2. During combat this turn, you may spend Move points to get Attack 1 for each.
    // Powered: Move 4. During combat this turn you may spend any amount of Move points: 1 to get Attack 1 and/or 2 to get Ranged Attack 1.
    // TODO: Implement move-to-attack conversion modifier
    basicEffect: move(2),
    poweredEffect: move(4),
    sidewaysValue: 1,
  },

  [CARD_SONG_OF_WIND]: {
    id: CARD_SONG_OF_WIND,
    name: "Song of Wind",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_WHITE],
    categories: [CARD_CATEGORY_MOVEMENT],
    // Basic: Move 2. The Move cost of plains, deserts, and wastelands is reduced by 1, to a minimum of 0 this turn.
    // Powered: Move 2. The Move cost of plains, deserts, and wastelands is reduced by 2, to a minimum of 0. You may pay a blue mana to be able to travel through lakes for Move cost 0 this turn.
    // TODO: Implement terrain cost modifier with optional blue mana lake travel
    basicEffect: move(2),
    poweredEffect: move(2),
    sidewaysValue: 1,
  },

  [CARD_HEROIC_TALE]: {
    id: CARD_HEROIC_TALE,
    name: "Heroic Tale",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_WHITE],
    categories: [CARD_CATEGORY_INFLUENCE],
    // Basic: Influence 3. Reputation +1 for each Unit you recruit this turn.
    // Powered: Influence 6. Fame +1 and Reputation +1 for each Unit you recruit this turn.
    // TODO: Implement recruitment bonus modifier
    basicEffect: influence(3),
    poweredEffect: influence(6),
    sidewaysValue: 1,
  },

  [CARD_DIPLOMACY]: {
    id: CARD_DIPLOMACY,
    name: "Diplomacy",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_WHITE],
    categories: [CARD_CATEGORY_INFLUENCE, CARD_CATEGORY_COMBAT],
    // Basic: Influence 2. You may use Influence as Block this turn.
    // Powered: Influence 4. Choose Ice or Fire. You may use Influence as Block of the chosen element this turn.
    // TODO: Implement influence-as-block modifier
    basicEffect: influence(2),
    poweredEffect: influence(4),
    sidewaysValue: 1,
  },

  [CARD_MANA_STORM]: {
    id: CARD_MANA_STORM,
    name: "Mana Storm",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_WHITE],
    categories: [CARD_CATEGORY_SPECIAL],
    // Basic: Choose a mana die in the Source that is showing a basic color. Gain a crystal of that color to your Inventory, then immediately reroll that die and return it to the Source.
    // Powered: Reroll all dice in the Source. You can use three extra dice from the Source, and you can use dice showing black or gold as mana of any basic color, regardless of the Round.
    // TODO: Implement source manipulation
    basicEffect: gainCrystal(MANA_WHITE),
    poweredEffect: gainCrystal(MANA_WHITE),
    sidewaysValue: 1,
  },

  [CARD_LEARNING]: {
    id: CARD_LEARNING,
    name: "Learning",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_WHITE],
    categories: [CARD_CATEGORY_INFLUENCE, CARD_CATEGORY_SPECIAL],
    // Basic: Influence 2. Once during this turn, you may pay Influence 6 to gain an Advanced Action card from the Advanced Actions offer to your discard pile.
    // Powered: Influence 4. Once during this turn, you may pay Influence 9 to gain an Advanced Action card from the Advanced Actions offer to your hand.
    // TODO: Implement advanced action purchase at discount
    basicEffect: influence(2),
    poweredEffect: influence(4),
    sidewaysValue: 1,
  },

  [CARD_CHIVALRY]: {
    id: CARD_CHIVALRY,
    name: "Chivalry",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_WHITE],
    categories: [CARD_CATEGORY_COMBAT],
    // Basic: Attack 3, or Attack 2 and Reputation +1 for each enemy defeated by this attack.
    // Powered: Attack 6, or Attack 4 and Reputation +1 and Fame +1 for each enemy defeated by this attack.
    // TODO: Implement reputation/fame on defeat
    basicEffect: choice(attack(3), attack(2)),
    poweredEffect: choice(attack(6), attack(4)),
    sidewaysValue: 1,
  },

  [CARD_PEACEFUL_MOMENT]: {
    id: CARD_PEACEFUL_MOMENT,
    name: "Peaceful Moment",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_WHITE],
    categories: [CARD_CATEGORY_INFLUENCE, CARD_CATEGORY_SPECIAL],
    // Basic: Influence 3. You may play this as your action for the turn: if you do, you may get Heal 1 for each 2 Influence you spend.
    // Powered: Influence 6. You may play this as your action for the turn: if you do, you may get Heal 1 for each 2 Influence you spend and/or refresh a Unit by paying 2 Influence per level of the Unit.
    // TODO: Implement influence-to-heal conversion and unit refresh
    basicEffect: influence(3),
    poweredEffect: influence(6),
    sidewaysValue: 1,
  },

  [CARD_DODGE_AND_WEAVE]: {
    id: CARD_DODGE_AND_WEAVE,
    name: "Dodge and Weave",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_WHITE],
    categories: [CARD_CATEGORY_COMBAT],
    // Basic: Reduce one enemy attack by 2. Gain Attack 1 in the Attack phase if you did not add any Wounds to your hand in the previous combat phases.
    // Powered: Reduce one enemy attack by 4 or two attacks of one or two enemies by 2. Gain Attack 2 in the Attack phase if you did not add any Wounds to your hand in the previous combat phases.
    // TODO: Implement damage reduction and conditional attack bonus
    basicEffect: block(2),
    poweredEffect: block(4),
    sidewaysValue: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GREEN ADVANCED ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  [CARD_REFRESHING_WALK]: {
    id: CARD_REFRESHING_WALK,
    name: "Refreshing Walk",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN],
    categories: [CARD_CATEGORY_MOVEMENT, CARD_CATEGORY_HEALING],
    // Basic: Move 2 and Heal 1. If played during combat, Move 2 only.
    // Powered: Move 4 and Heal 2. If played during combat, Move 4 only.
    // TODO: Implement combat context check
    basicEffect: compound(move(2), heal(1)),
    poweredEffect: compound(move(4), heal(2)),
    sidewaysValue: 1,
  },

  [CARD_PATH_FINDING]: {
    id: CARD_PATH_FINDING,
    name: "Path Finding",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN],
    categories: [CARD_CATEGORY_MOVEMENT],
    // Basic: Move 2. The Move cost of all terrains is reduced by 1, to a minimum of 2, this turn.
    // Powered: Move 4. The Move cost of all terrains is reduced to 2 this turn.
    // TODO: Implement terrain cost modifier
    basicEffect: move(2),
    poweredEffect: move(4),
    sidewaysValue: 1,
  },

  [CARD_REGENERATION]: {
    id: CARD_REGENERATION,
    name: "Regeneration",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN],
    categories: [CARD_CATEGORY_HEALING],
    // Basic: Heal 1. Ready a Level I or II Unit you control.
    // Powered: Heal 2. Ready a Level I, II or III Unit you control.
    // TODO: Implement unit readying
    basicEffect: heal(1),
    poweredEffect: heal(2),
    sidewaysValue: 1,
  },

  [CARD_IN_NEED]: {
    id: CARD_IN_NEED,
    name: "In Need",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN],
    categories: [CARD_CATEGORY_INFLUENCE],
    // Basic: Influence 3. Get an additional Influence 1 for each Wound card in your hand and on Units you control.
    // Powered: Influence 5. Get an additional Influence 2 for each Wound card in your hand and on Units you control.
    // TODO: Implement wound-count scaling
    basicEffect: influence(3),
    poweredEffect: influence(5),
    sidewaysValue: 1,
  },

  [CARD_AMBUSH]: {
    id: CARD_AMBUSH,
    name: "Ambush",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN],
    categories: [CARD_CATEGORY_MOVEMENT],
    // Basic: Move 2. Add +1 to your first Attack card of any type or +2 to your first Block card of any type, whichever you play first this turn.
    // Powered: Move 4. Add +2 to your first Attack card of any type or +4 to your first Block card of any type, whichever you play first this turn.
    // TODO: Implement first-card bonus modifier
    basicEffect: move(2),
    poweredEffect: move(4),
    sidewaysValue: 1,
  },

  [CARD_TRAINING]: {
    id: CARD_TRAINING,
    name: "Training",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN],
    categories: [CARD_CATEGORY_SPECIAL],
    // Basic: Throw away an Action card from your hand, then take a card of the same color from the Advanced Actions offer and put it into your discard pile.
    // Powered: Throw away an Action card from your hand, then take a card of the same color from the Advanced Actions offer and put it into your hand.
    // TODO: Implement throw-away and card acquisition
    basicEffect: influence(3),
    poweredEffect: influence(5),
    sidewaysValue: 1,
  },

  [CARD_STOUT_RESOLVE]: {
    id: CARD_STOUT_RESOLVE,
    name: "Stout Resolve",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN],
    categories: [CARD_CATEGORY_MOVEMENT, CARD_CATEGORY_INFLUENCE, CARD_CATEGORY_COMBAT],
    // Basic: Move 2, Influence 2, Attack 2 or Block 2. You may discard a Wound to increase the effect by 1.
    // Powered: Move 3, Influence 3, Attack 3 or Block 3. You may discard any number of cards, including one Wound, to increase the effect by 2 for each.
    // TODO: Implement wound-discard bonus
    basicEffect: choice(move(2), influence(2), attack(2), block(2)),
    poweredEffect: choice(move(3), influence(3), attack(3), block(3)),
    sidewaysValue: 1,
  },

  [CARD_FORCE_OF_NATURE]: {
    id: CARD_FORCE_OF_NATURE,
    name: "Force of Nature",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN],
    categories: [CARD_CATEGORY_COMBAT],
    // Basic: Chosen Unit gains Physical resistance this combat.
    // Powered: Siege Attack 3 or Block 6
    // TODO: Implement unit resistance modifier
    basicEffect: block(2),
    poweredEffect: choice(siegeAttack(3), block(6)),
    sidewaysValue: 1,
  },

  [CARD_MOUNTAIN_LORE]: {
    id: CARD_MOUNTAIN_LORE,
    name: "Mountain Lore",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN],
    categories: [CARD_CATEGORY_MOVEMENT],
    // Basic: Move 3. If you end your turn in hills, your Hand limit is higher by 1 the next time you draw cards.
    // Powered: Move 5. You can enter mountains at a Move cost of 5 and they are considered a safe space for you at the end of this turn. If you end your turn in mountains/hills, your Hand limit is higher by 2/1 the next time you draw cards.
    // TODO: Implement terrain-based hand limit modifier
    basicEffect: move(3),
    poweredEffect: move(5),
    sidewaysValue: 1,
  },

  [CARD_POWER_OF_CRYSTALS]: {
    id: CARD_POWER_OF_CRYSTALS,
    name: "Power of Crystals",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN, MANA_BLUE], // Dual-color: can be powered by green OR blue
    categories: [CARD_CATEGORY_MOVEMENT, CARD_CATEGORY_HEALING, CARD_CATEGORY_SPECIAL],
    // Basic: Gain a crystal to your Inventory of a basic color you do not already own.
    // Powered: Move 4, or Heal 2, or draw two cards. For each set of four different color crystals in your Inventory: Move 2, or Heal 1, or draw a card.
    // TODO: Implement crystal-set scaling and card draw
    basicEffect: gainCrystal(MANA_GREEN),
    poweredEffect: choice(move(4), heal(2)),
    sidewaysValue: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DUAL-COLOR ADVANCED ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  [CARD_RUSH_OF_ADRENALINE]: {
    id: CARD_RUSH_OF_ADRENALINE,
    name: "Rush of Adrenaline",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN, MANA_RED], // Can be powered by green OR red
    categories: [CARD_CATEGORY_SPECIAL],
    // Basic: For each of the first three Wounds you take to your hand this turn, draw a card.
    // Powered: After taking the first Wound to your hand this turn, throw it away and draw a card. For each of the next three Wounds you take, draw a card.
    // TODO: Implement wound-triggered card draw
    basicEffect: heal(1),
    poweredEffect: heal(2),
    sidewaysValue: 1,
  },

  [CARD_CHILLING_STARE]: {
    id: CARD_CHILLING_STARE,
    name: "Chilling Stare",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_BLUE, MANA_WHITE], // Can be powered by blue OR white
    categories: [CARD_CATEGORY_COMBAT],
    // Basic: Influence 3, or a chosen enemy attack loses all attack abilities (but not its color).
    // Powered: Influence 5, or a chosen enemy does not attack this turn.
    // TODO: Implement enemy attack cancellation
    basicEffect: choice(influence(3), block(3)),
    poweredEffect: choice(influence(5), block(5)),
    sidewaysValue: 1,
  },
} satisfies Record<AdvancedActionCardId, DeedCard>;

// === Helper to get a card by ID ===
export function getAdvancedActionCard(id: AdvancedActionCardId): DeedCard {
  const card = ADVANCED_ACTION_CARDS[id];
  if (!card) {
    throw new Error(`Unknown advanced action card: ${String(id)}`);
  }
  return card;
}
