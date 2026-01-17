/**
 * Green Advanced Action Cards
 *
 * Green cards focus on healing, movement efficiency, and nature-based
 * abilities. Many provide recovery mechanics, terrain benefits, or
 * wound-based scaling effects.
 *
 * @module data/advancedActions/green
 *
 * @remarks Cards in this module:
 * - Refreshing Walk - Movement with healing
 * - Path Finding - Movement with terrain cost reduction
 * - Regeneration - Healing with unit readying
 * - In Need - Influence scaling with wounds
 * - Ambush - Movement with first-strike bonus
 * - Training - Card upgrade via throw-away
 * - Stout Resolve - Versatile effect with wound discard bonus
 * - Force of Nature - Unit resistance or siege/block
 * - Mountain Lore - Movement with terrain-based hand limit
 * - Power of Crystals - Crystal-set based scaling
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CARD_CATEGORY_COMBAT,
  CARD_CATEGORY_SPECIAL,
  CARD_CATEGORY_MOVEMENT,
  CARD_CATEGORY_INFLUENCE,
  CARD_CATEGORY_HEALING,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../types/cards.js";
import {
  MANA_GREEN,
  MANA_BLUE,
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
  type AdvancedActionCardId,
} from "@mage-knight/shared";
import {
  attack,
  block,
  move,
  influence,
  heal,
  choice,
  compound,
  siegeAttack,
  gainCrystal,
} from "./helpers.js";

/**
 * Green advanced action card definitions.
 *
 * These cards emphasize recovery, efficient movement, and nature-based
 * abilities. Many provide healing or scale with wounds/crystals.
 */
export const GREEN_ADVANCED_ACTIONS = {
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
} satisfies Partial<Record<AdvancedActionCardId, DeedCard>>;
