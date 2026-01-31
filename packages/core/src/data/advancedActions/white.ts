/**
 * White Advanced Action Cards
 *
 * White cards focus on versatility, speed, and reputation-positive effects.
 * Many provide movement bonuses, influence with combat crossover, or
 * terrain cost reductions.
 *
 * @module data/advancedActions/white
 *
 * @remarks Cards in this module:
 * - Agility - Movement with attack conversion
 * - Song of Wind - Movement with terrain cost reduction
 * - Heroic Tale - Influence with recruitment bonuses
 * - Diplomacy - Influence usable as block
 * - Mana Storm - Source die manipulation
 * - Learning - Influence with AA purchase discount
 * - Chivalry - Attack with reputation/fame on defeat
 * - Peaceful Moment - Influence with healing conversion
 * - Dodge and Weave - Damage reduction with conditional attack
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_COMBAT,
  CATEGORY_SPECIAL,
  CATEGORY_MOVEMENT,
  CATEGORY_INFLUENCE,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../types/cards.js";
import {
  MANA_WHITE,
  CARD_AGILITY,
  CARD_SONG_OF_WIND,
  CARD_HEROIC_TALE,
  CARD_DIPLOMACY,
  CARD_MANA_STORM,
  CARD_LEARNING,
  CARD_CHIVALRY,
  CARD_PEACEFUL_MOMENT,
  CARD_DODGE_AND_WEAVE,
  type AdvancedActionCardId,
} from "@mage-knight/shared";
import {
  attack,
  block,
  move,
  influence,
  choice,
  gainCrystal,
} from "./helpers.js";

/**
 * White advanced action card definitions.
 *
 * These cards emphasize versatility, speed, and positive reputation
 * mechanics. Many combine movement with combat or provide unique
 * conversion abilities.
 */
export const WHITE_ADVANCED_ACTIONS = {
  [CARD_AGILITY]: {
    id: CARD_AGILITY,
    name: "Agility",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_WHITE],
    categories: [CATEGORY_COMBAT],
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
    categories: [CATEGORY_MOVEMENT],
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
    categories: [CATEGORY_INFLUENCE],
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
    categories: [CATEGORY_INFLUENCE, CATEGORY_COMBAT],
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
    categories: [CATEGORY_SPECIAL],
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
    categories: [CATEGORY_INFLUENCE, CATEGORY_SPECIAL],
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
    categories: [CATEGORY_COMBAT],
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
    categories: [CATEGORY_INFLUENCE, CATEGORY_SPECIAL],
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
    categories: [CATEGORY_COMBAT],
    // Basic: Reduce one enemy attack by 2. Gain Attack 1 in the Attack phase if you did not add any Wounds to your hand in the previous combat phases.
    // Powered: Reduce one enemy attack by 4 or two attacks of one or two enemies by 2. Gain Attack 2 in the Attack phase if you did not add any Wounds to your hand in the previous combat phases.
    // TODO: Implement damage reduction and conditional attack bonus
    basicEffect: block(2),
    poweredEffect: block(4),
    sidewaysValue: 1,
  },
} satisfies Partial<Record<AdvancedActionCardId, DeedCard>>;
