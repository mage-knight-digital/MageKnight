/**
 * Blue Advanced Action Cards
 *
 * Blue cards focus on defensive abilities, mana manipulation, and movement
 * through difficult terrain. Many provide ice-elemental effects or interact
 * with the mana/spell systems.
 *
 * @module data/advancedActions/blue
 *
 * @remarks Cards in this module:
 * - Ice Shield - Ice block with armor reduction
 * - Frost Bridge - Movement with swamp/lake traversal
 * - Pure Magic - Mana-color-dependent effect
 * - Steady Tempo - Movement with deck manipulation
 * - Crystal Mastery - Crystal duplication and recovery
 * - Magic Talent - Spell offer interaction
 * - Shield Bash - Block with swiftness counter
 * - Temporal Portal - Teleport with hand limit bonus
 * - Spell Forge - Crystal gain from spell offer colors
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CARD_CATEGORY_COMBAT,
  CARD_CATEGORY_SPECIAL,
  CARD_CATEGORY_MOVEMENT,
  CARD_CATEGORY_INFLUENCE,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../types/cards.js";
import {
  MANA_BLUE,
  CARD_ICE_SHIELD,
  CARD_FROST_BRIDGE,
  CARD_PURE_MAGIC,
  CARD_STEADY_TEMPO,
  CARD_CRYSTAL_MASTERY,
  CARD_MAGIC_TALENT,
  CARD_SHIELD_BASH,
  CARD_TEMPORAL_PORTAL,
  CARD_SPELL_FORGE,
  type AdvancedActionCardId,
} from "@mage-knight/shared";
import {
  attack,
  block,
  blockWithElement,
  move,
  influence,
  choice,
  gainCrystal,
  ELEMENT_ICE,
} from "./helpers.js";

/**
 * Blue advanced action card definitions.
 *
 * These cards emphasize defensive tactics, terrain manipulation,
 * and magical flexibility through mana and spell interactions.
 */
export const BLUE_ADVANCED_ACTIONS = {
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
} satisfies Partial<Record<AdvancedActionCardId, DeedCard>>;
