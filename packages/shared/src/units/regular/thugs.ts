/**
 * Thugs unit definition
 *
 * Per rulebook:
 * - Block 3 (free)
 * - Attack 3 (free) with Reputation -1 side effect
 * - Influence 4 (free) with Reputation -1 side effect
 * - Reversed reputation modifier during recruitment
 * - Must pay 2 Influence to assign combat damage to this unit
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_THUGS } from "../ids.js";

export const THUGS: UnitDefinition = {
  id: UNIT_THUGS,
  name: "Thugs",
  type: UNIT_TYPE_REGULAR,
  level: 1,
  influence: 5,
  armor: 5,
  resistances: [],
  recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP],
  abilities: [
    { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_PHYSICAL },
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: "thugs_attack",
      displayName: "Attack 3 (Reputation -1)",
      requiresCombat: true,
    },
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: "thugs_influence",
      displayName: "Influence 4 (Reputation -1)",
      requiresCombat: false,
    },
  ],
  copies: 2,
  reversedReputation: true,
  damageInfluenceCost: 2,
};
