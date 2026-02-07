/**
 * Magic Familiars unit definition
 *
 * Abilities (enhanced by mana token color):
 * 1. Attack 3 (5 with red token)
 * 2. Block 4 (7 with blue token)
 * 3. Move OR Influence 3 (5 with white token) - effect-based choice
 * 4. Heal 2 (3 with green token)
 *
 * Special:
 * - Requires mana payment on recruit (1 basic mana → token placed on unit)
 * - Cannot be recruited via Call to Arms/Glory/combat rewards/Banner of Command
 * - Round-start maintenance: pay crystal to keep or disband
 */

import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_MONASTERY,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MAGICAL_GLADE,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_HEAL,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_MAGIC_FAMILIARS } from "../ids.js";
import { MANA_RED, MANA_BLUE, MANA_WHITE, MANA_GREEN } from "../../ids.js";

// Effect ID for the Move/Influence choice ability
const MAGIC_FAMILIARS_MOVE_OR_INFLUENCE = "magic_familiars_move_or_influence";

export const MAGIC_FAMILIARS: UnitDefinition = {
  id: UNIT_MAGIC_FAMILIARS,
  name: "Magic Familiars",
  type: UNIT_TYPE_REGULAR,
  level: 2,
  influence: 6,
  armor: 5,
  resistances: [],
  recruitSites: [RECRUIT_SITE_MONASTERY, RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_MAGICAL_GLADE],
  abilities: [
    // Attack 3 (5 with red mana token)
    {
      type: UNIT_ABILITY_ATTACK,
      value: 3,
      bonusValue: 5,
      bonusManaColor: MANA_RED,
    },
    // Block 4 (7 with blue mana token)
    {
      type: UNIT_ABILITY_BLOCK,
      value: 4,
      bonusValue: 7,
      bonusManaColor: MANA_BLUE,
    },
    // Move OR Influence 3 (5 with white mana token) - choice effect
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: MAGIC_FAMILIARS_MOVE_OR_INFLUENCE,
      displayName: "Move OR Influence 3",
      requiresCombat: false,
      bonusValue: 5,
      bonusManaColor: MANA_WHITE,
    },
    // Heal 2 (3 with green mana token)
    {
      type: UNIT_ABILITY_HEAL,
      value: 2,
      bonusValue: 3,
      bonusManaColor: MANA_GREEN,
    },
  ],
  copies: 2,
  restrictedFromFreeRecruit: true,
};
