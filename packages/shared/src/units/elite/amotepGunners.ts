/**
 * Amotep Gunners unit definition
 *
 * Rulebook abilities:
 * - Ability 1: Attack OR Block 5 (choice, free, physical)
 * - Ability 2: Ranged Fire Attack 6 (costs red mana)
 */

import { ELEMENT_FIRE, ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
} from "../constants.js";
import { MANA_RED } from "../../ids.js";
import { UNIT_AMOTEP_GUNNERS } from "../ids.js";

export const AMOTEP_GUNNERS: UnitDefinition = {
  id: UNIT_AMOTEP_GUNNERS,
  name: "Amotep Gunners",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 8,
  armor: 6,
  resistances: [],
  recruitSites: [RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
  abilities: [
    // Ability 1: Attack OR Block 5 (choice, free, physical)
    { type: UNIT_ABILITY_ATTACK, value: 5, element: ELEMENT_PHYSICAL },
    { type: UNIT_ABILITY_BLOCK, value: 5, element: ELEMENT_PHYSICAL },
    // Ability 2: Ranged Fire Attack 6 (costs red mana)
    {
      type: UNIT_ABILITY_RANGED_ATTACK,
      value: 6,
      element: ELEMENT_FIRE,
      manaCost: MANA_RED,
    },
  ],
  copies: 2,
};
