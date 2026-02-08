/**
 * Soul Harvester artifact
 * Card #19 (306/377)
 *
 * Basic: Attack 3. For one enemy defeated by this attack, gain one crystal
 *        (red if Fire resistant, blue if Ice resistant, green if Physical
 *        resistant, or white). Crystal gained immediately.
 * Powered (any color, destroy): Attack 8. Gain one crystal per enemy defeated
 *        in the current phase of combat. Same color rules as basic.
 *
 * FAQ S1: Crystal rewards gained IMMEDIATELY. Cannot gain for summoned Monsters.
 * FAQ S2: Basic cannot be played in Ranged/Siege (it's Attack, not Ranged/Siege).
 *         Powered CAN be played in Ranged/Siege, forego Attack 8, still gain crystals.
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import {
  EFFECT_APPLY_MODIFIER,
  EFFECT_COMPOUND,
  EFFECT_GAIN_ATTACK,
  COMBAT_TYPE_MELEE,
} from "../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING,
  SCOPE_SELF,
} from "../../types/modifierConstants.js";
import {
  CARD_SOUL_HARVESTER,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

const SOUL_HARVESTER: DeedCard = {
  id: CARD_SOUL_HARVESTER,
  name: "Soul Harvester",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // Attack 3 (melee)
      { type: EFFECT_GAIN_ATTACK, amount: 3, combatType: COMBAT_TYPE_MELEE },
      // Crystal for one defeated enemy (based on resistances)
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING,
          limit: 1,
          trackByAttack: false,
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        description: "Gain 1 crystal for one enemy defeated (by resistance)",
      },
    ],
  },
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // Attack 8 (melee)
      { type: EFFECT_GAIN_ATTACK, amount: 8, combatType: COMBAT_TYPE_MELEE },
      // Crystal per enemy defeated in current phase (based on resistances)
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING,
          limit: 99,
          trackByAttack: false,
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        description: "Gain 1 crystal per enemy defeated this phase (by resistance)",
      },
    ],
  },
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const SOUL_HARVESTER_CARDS: Record<CardId, DeedCard> = {
  [CARD_SOUL_HARVESTER]: SOUL_HARVESTER,
};
