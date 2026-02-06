/**
 * Amotep Freezers unit definition
 *
 * Rulebook abilities:
 * - Ability 1: Attack OR Block 5 (choice, free, physical)
 * - Ability 2: Freeze (blue mana) — target enemy does not attack this combat
 *   and gets Armor -3 (min 1). No effect on Ice Resistant enemies.
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { MANA_BLUE } from "../../ids.js";
import { UNIT_AMOTEP_FREEZERS } from "../ids.js";

/** Effect ID for Freeze: target enemy skip attack + Armor -3 (min 1), no effect vs Ice Resistant */
export const AMOTEP_FREEZERS_FREEZE = "amotep_freezers_freeze" as const;

export const AMOTEP_FREEZERS: UnitDefinition = {
  id: UNIT_AMOTEP_FREEZERS,
  name: "Amotep Freezers",
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
    // Ability 2: Freeze (blue mana) — skip attack + Armor -3, no effect on Ice Resistant
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: AMOTEP_FREEZERS_FREEZE,
      displayName: "Freeze enemy",
      manaCost: MANA_BLUE,
    },
  ],
  copies: 2,
};
