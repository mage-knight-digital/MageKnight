import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_BASIC_ACTION,
} from "../../../types/cards.js";
import {
  COMBAT_TYPE_RANGED,
  EFFECT_SELECT_COMBAT_ENEMY,
} from "../../../types/effectTypes.js";
import { MANA_BLUE, CARD_WOLFHAWK_SWIFT_REFLEXES } from "@mage-knight/shared";
import { move, attack, choice } from "../helpers.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ATTACK,
} from "../../../types/modifierConstants.js";
import { COMBAT_PHASE_BLOCK } from "../../../types/combat.js";

/**
 * Wolfhawk's Swift Reflexes (replaces Swiftness)
 *
 * Basic: Move 2, Ranged Attack 1, OR Reduce one enemy attack by 1
 * Powered (Blue): Move 4, Ranged Attack 3, OR Reduce one enemy attack by 2
 *
 * Attack reduction is only available during the Block phase.
 * If enemy attack is reduced to 0, it is treated as "successfully blocked"
 * (the enemy is filtered from block options as non-threatening).
 */
export const WOLFHAWK_SWIFT_REFLEXES: DeedCard = {
  id: CARD_WOLFHAWK_SWIFT_REFLEXES,
  name: "Swift Reflexes",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT],
  basicEffect: choice(
    move(2),
    attack(1, COMBAT_TYPE_RANGED),
    {
      type: EFFECT_SELECT_COMBAT_ENEMY,
      template: {
        modifiers: [
          {
            modifier: {
              type: EFFECT_ENEMY_STAT,
              stat: ENEMY_STAT_ATTACK,
              amount: -1,
              minimum: 0,
            },
            duration: DURATION_COMBAT,
            description: "Reduce enemy attack by 1",
          },
        ],
      },
      requiredPhase: COMBAT_PHASE_BLOCK,
    }
  ),
  poweredEffect: choice(
    move(4),
    attack(3, COMBAT_TYPE_RANGED),
    {
      type: EFFECT_SELECT_COMBAT_ENEMY,
      template: {
        modifiers: [
          {
            modifier: {
              type: EFFECT_ENEMY_STAT,
              stat: ENEMY_STAT_ATTACK,
              amount: -2,
              minimum: 0,
            },
            duration: DURATION_COMBAT,
            description: "Reduce enemy attack by 2",
          },
        ],
      },
      requiredPhase: COMBAT_PHASE_BLOCK,
    }
  ),
  sidewaysValue: 1,
};
