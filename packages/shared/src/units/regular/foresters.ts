/**
 * Foresters unit definition
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_VILLAGE,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_MOVE,
} from "../constants.js";
import { UNIT_FORESTERS } from "../ids.js";

export const FORESTERS: UnitDefinition = {
  id: UNIT_FORESTERS,
  name: "Foresters",
  type: UNIT_TYPE_REGULAR,
  level: 1,
  influence: 5,
  armor: 4,
  resistances: [],
  recruitSites: [RECRUIT_SITE_VILLAGE],
  abilities: [
    { type: UNIT_ABILITY_BLOCK, value: 3, element: ELEMENT_PHYSICAL },
    {
      type: UNIT_ABILITY_MOVE,
      value: 2,
      terrainModifiers: [
        { terrain: "forest", amount: -1, minimum: 0 },
        { terrain: "hills", amount: -1, minimum: 0 },
        { terrain: "swamp", amount: -1, minimum: 0 },
      ],
    },
  ],
  copies: 2,
};
