/**
 * Magic Familiars unit definition
 */

import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_MONASTERY,
  RECRUIT_SITE_MAGE_TOWER,
} from "../constants.js";
import { UNIT_MAGIC_FAMILIARS } from "../ids.js";

export const MAGIC_FAMILIARS: UnitDefinition = {
  id: UNIT_MAGIC_FAMILIARS,
  name: "Magic Familiars",
  type: UNIT_TYPE_REGULAR,
  level: 2,
  influence: 6,
  armor: 5,
  resistances: [],
  recruitSites: [RECRUIT_SITE_MONASTERY, RECRUIT_SITE_MAGE_TOWER],
  abilities: [], // Special: provides bonus mana
  copies: 2,
};
