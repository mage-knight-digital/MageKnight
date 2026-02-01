/**
 * Red Cape Monks unit definition
 */

import { ELEMENT_FIRE } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_MONASTERY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
} from "../constants.js";
import { UNIT_RED_CAPE_MONKS } from "../ids.js";

export const RED_CAPE_MONKS: UnitDefinition = {
  id: UNIT_RED_CAPE_MONKS,
  name: "Red Cape Monks",
  type: UNIT_TYPE_REGULAR,
  level: 2,
  influence: 7,
  armor: 4,
  resistances: [],
  recruitSites: [RECRUIT_SITE_MONASTERY],
  abilities: [
    { type: UNIT_ABILITY_ATTACK, value: 4, element: ELEMENT_FIRE },
    { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_FIRE },
  ],
  copies: 1,
};
