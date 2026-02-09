/**
 * Peaceful Moment (White Advanced Action)
 *
 * Basic: Influence 3. You may play this as your action for the turn: if you
 *        do, you may get Heal 1 for each 2 Influence you spend.
 *
 * Powered: Influence 6. You may play this as your action for the turn: if you
 *          do, you may get Heal 1 for each 2 Influence you spend and/or
 *          refresh a Unit by paying 2 Influence per level of the Unit.
 *
 * Implementation Notes:
 * - Player chooses between immediate mode (just Influence) or action mode
 *   (Influence + conversion abilities, consumes turn action).
 * - Action mode sets hasTakenActionThisTurn directly in the effect handler
 *   rather than using CATEGORY_ACTION (since the player chooses the mode).
 * - Healing conversion: 2 Influence → 1 Heal (repeatable).
 * - Unit refresh (powered only): 2 Influence per unit level, max 1 unit.
 * - Action mode: No reputation bonus/penalty (not an Interaction).
 * - Can combine with other Influence sources for more conversions.
 */

import type { DeedCard, CardEffect } from "../../../types/cards.js";
import {
  CATEGORY_INFLUENCE,
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import {
  EFFECT_CHOICE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_PEACEFUL_MOMENT_ACTION,
} from "../../../types/effectTypes.js";
import { MANA_WHITE, CARD_PEACEFUL_MOMENT } from "@mage-knight/shared";

/**
 * Basic effect: Choice between Influence 3 (immediate) or play as action
 * with influence-to-heal conversion.
 */
const peacefulMomentBasicEffect: CardEffect = {
  type: EFFECT_CHOICE,
  options: [
    // Option 1: Immediate influence (no action consumption)
    { type: EFFECT_GAIN_INFLUENCE, amount: 3 },
    // Option 2: Play as action — gain Influence 3, consume action, enable heal conversion
    { type: EFFECT_PEACEFUL_MOMENT_ACTION, influenceAmount: 3, allowUnitRefresh: false },
  ],
};

/**
 * Powered effect: Choice between Influence 6 (immediate) or play as action
 * with influence-to-heal conversion AND unit refresh.
 */
const peacefulMomentPoweredEffect: CardEffect = {
  type: EFFECT_CHOICE,
  options: [
    // Option 1: Immediate influence (no action consumption)
    { type: EFFECT_GAIN_INFLUENCE, amount: 6 },
    // Option 2: Play as action — gain Influence 6, consume action, enable heal + unit refresh
    { type: EFFECT_PEACEFUL_MOMENT_ACTION, influenceAmount: 6, allowUnitRefresh: true },
  ],
};

export const PEACEFUL_MOMENT: DeedCard = {
  id: CARD_PEACEFUL_MOMENT,
  name: "Peaceful Moment",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_INFLUENCE, CATEGORY_SPECIAL],
  basicEffect: peacefulMomentBasicEffect,
  poweredEffect: peacefulMomentPoweredEffect,
  sidewaysValue: 1,
};
