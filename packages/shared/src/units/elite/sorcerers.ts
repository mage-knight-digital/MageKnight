/**
 * Sorcerers unit definition
 */

import { RESIST_FIRE, RESIST_ICE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
} from "../constants.js";
import { UNIT_SORCERERS } from "../ids.js";

export const SORCERERS: UnitDefinition = {
  id: UNIT_SORCERERS,
  name: "Sorcerers",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 9,
  armor: 4,
  resistances: [RESIST_FIRE, RESIST_ICE],
  recruitSites: [RECRUIT_SITE_MAGE_TOWER, RECRUIT_SITE_MONASTERY],
  abilities: [], // Special: provides two mana tokens
  copies: 2,
};
