/**
 * Illusionists unit definition
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import { RESIST_PHYSICAL } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  UNIT_ABILITY_INFLUENCE,
  UNIT_ABILITY_BLOCK,
} from "../constants.js";
import { UNIT_ILLUSIONISTS } from "../ids.js";

export const ILLUSIONISTS: UnitDefinition = {
  id: UNIT_ILLUSIONISTS,
  name: "Illusionists",
  type: UNIT_TYPE_REGULAR,
  level: 2,
  influence: 7,
  armor: 2,
  resistances: [RESIST_PHYSICAL],
  recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_MONASTERY],
  abilities: [
    { type: UNIT_ABILITY_INFLUENCE, value: 4 },
    { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_PHYSICAL },
  ],
  copies: 2,
};
