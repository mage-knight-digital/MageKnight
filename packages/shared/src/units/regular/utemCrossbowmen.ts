/**
 * Utem Crossbowmen unit definition
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_RANGED_ATTACK,
} from "../constants.js";
import { UNIT_UTEM_CROSSBOWMEN } from "../ids.js";

export const UTEM_CROSSBOWMEN: UnitDefinition = {
  id: UNIT_UTEM_CROSSBOWMEN,
  name: "Utem Crossbowmen",
  type: UNIT_TYPE_REGULAR,
  level: 2,
  influence: 6,
  armor: 4,
  resistances: [],
  recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP],
  abilities: [
    { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
    { type: UNIT_ABILITY_RANGED_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
  ],
  copies: 2,
};
