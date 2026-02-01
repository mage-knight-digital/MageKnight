/**
 * Thugs unit definition
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  UNIT_ABILITY_ATTACK,
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
    { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
  ],
  copies: 2,
};
