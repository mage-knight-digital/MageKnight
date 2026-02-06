/**
 * Altem Guardians unit definition
 *
 * Rulebook: Attack 5 (free), Block 8 (free) counts twice vs Swiftness,
 * Grant All Resistances (green mana) - all units you control gain all resistances this turn.
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { MANA_GREEN } from "../../ids.js";
import { UNIT_ALTEM_GUARDIANS } from "../ids.js";

const ALTEM_GUARDIANS_GRANT_RESISTANCES = "altem_guardians_grant_resistances";

export const ALTEM_GUARDIANS: UnitDefinition = {
  id: UNIT_ALTEM_GUARDIANS,
  name: "Altem Guardians",
  type: UNIT_TYPE_ELITE,
  level: 4,
  influence: 11,
  armor: 7,
  resistances: [],
  recruitSites: [RECRUIT_SITE_CITY],
  abilities: [
    { type: UNIT_ABILITY_ATTACK, value: 5, element: ELEMENT_PHYSICAL },
    {
      type: UNIT_ABILITY_BLOCK,
      value: 8,
      element: ELEMENT_PHYSICAL,
      countsTwiceAgainstSwift: true,
    },
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: ALTEM_GUARDIANS_GRANT_RESISTANCES,
      displayName: "Grant All Resistances",
      manaCost: MANA_GREEN,
    },
  ],
  copies: 3,
};
