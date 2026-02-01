/**
 * Savage Monks unit definition
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_MONASTERY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_POISON,
} from "../constants.js";
import { UNIT_SAVAGE_MONKS } from "../ids.js";

export const SAVAGE_MONKS: UnitDefinition = {
  id: UNIT_SAVAGE_MONKS,
  name: "Savage Monks",
  type: UNIT_TYPE_REGULAR,
  level: 2,
  influence: 7,
  armor: 4,
  resistances: [],
  recruitSites: [RECRUIT_SITE_MONASTERY],
  abilities: [
    { type: UNIT_ABILITY_ATTACK, value: 4, element: ELEMENT_PHYSICAL },
    { type: UNIT_ABILITY_POISON },
  ],
  copies: 1,
};
