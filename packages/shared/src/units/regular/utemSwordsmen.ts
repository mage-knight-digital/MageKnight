/**
 * Utem Swordsmen unit definition
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_KEEP,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
} from "../constants.js";
import { UNIT_UTEM_SWORDSMEN } from "../ids.js";

export const UTEM_SWORDSMEN: UnitDefinition = {
  id: UNIT_UTEM_SWORDSMEN,
  name: "Utem Swordsmen",
  type: UNIT_TYPE_REGULAR,
  level: 2,
  influence: 6,
  armor: 4,
  resistances: [],
  recruitSites: [RECRUIT_SITE_KEEP],
  abilities: [
    { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
    { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_PHYSICAL },
  ],
  copies: 2,
};
