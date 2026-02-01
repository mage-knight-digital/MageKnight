/**
 * Utem Guardsmen unit definition
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
} from "../constants.js";
import { UNIT_UTEM_GUARDSMEN } from "../ids.js";

export const UTEM_GUARDSMEN: UnitDefinition = {
  id: UNIT_UTEM_GUARDSMEN,
  name: "Utem Guardsmen",
  type: UNIT_TYPE_REGULAR,
  level: 2,
  influence: 5,
  armor: 5,
  resistances: [],
  recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP],
  abilities: [
    { type: UNIT_ABILITY_ATTACK, value: 2, element: ELEMENT_PHYSICAL },
    { type: UNIT_ABILITY_BLOCK, value: 4, element: ELEMENT_PHYSICAL },
  ],
  copies: 2,
};
