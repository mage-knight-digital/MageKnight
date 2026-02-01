/**
 * Peasants unit definition
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_VILLAGE,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_INFLUENCE,
  UNIT_ABILITY_MOVE,
} from "../constants.js";
import { UNIT_PEASANTS } from "../ids.js";

export const PEASANTS: UnitDefinition = {
  id: UNIT_PEASANTS,
  name: "Peasants",
  type: UNIT_TYPE_REGULAR,
  level: 1,
  influence: 4,
  armor: 3,
  resistances: [],
  recruitSites: [RECRUIT_SITE_VILLAGE],
  abilities: [
    { type: UNIT_ABILITY_ATTACK, value: 2, element: ELEMENT_PHYSICAL },
    { type: UNIT_ABILITY_BLOCK, value: 2, element: ELEMENT_PHYSICAL },
    { type: UNIT_ABILITY_INFLUENCE, value: 2 },
    { type: UNIT_ABILITY_MOVE, value: 2 },
  ],
  copies: 3,
};
