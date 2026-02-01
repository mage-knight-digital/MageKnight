/**
 * Shocktroops unit definition
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_KEEP,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_SWIFT,
  UNIT_ABILITY_BRUTAL,
} from "../constants.js";
import { UNIT_SHOCKTROOPS } from "../ids.js";

export const SHOCKTROOPS: UnitDefinition = {
  id: UNIT_SHOCKTROOPS,
  name: "Shocktroops",
  type: UNIT_TYPE_REGULAR,
  level: 2,
  influence: 6,
  armor: 3,
  resistances: [],
  recruitSites: [RECRUIT_SITE_KEEP],
  abilities: [
    { type: UNIT_ABILITY_ATTACK, value: 3, element: ELEMENT_PHYSICAL },
    { type: UNIT_ABILITY_SWIFT },
    { type: UNIT_ABILITY_BRUTAL },
  ],
  copies: 2,
};
