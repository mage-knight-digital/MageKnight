/**
 * Scouts unit definition
 */

import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_MOVE,
  UNIT_ABILITY_INFLUENCE,
} from "../constants.js";
import { UNIT_SCOUTS } from "../ids.js";

export const SCOUTS: UnitDefinition = {
  id: UNIT_SCOUTS,
  name: "Scouts",
  type: UNIT_TYPE_REGULAR,
  level: 1,
  influence: 4,
  armor: 2,
  resistances: [],
  recruitSites: [
    RECRUIT_SITE_VILLAGE,
    RECRUIT_SITE_KEEP,
    RECRUIT_SITE_MAGE_TOWER,
    RECRUIT_SITE_MONASTERY,
    RECRUIT_SITE_CITY,
  ],
  abilities: [
    { type: UNIT_ABILITY_MOVE, value: 2 },
    { type: UNIT_ABILITY_INFLUENCE, value: 2 },
  ],
  copies: 2,
};
