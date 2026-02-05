/**
 * Herbalist unit definition
 *
 * Abilities:
 * 1. (Green Mana) Heal 2 - mana-powered healing
 * 2. Ready a Level I/II Unit - free, no combat required
 * 3. Gain Green Mana Token - free, no combat required
 */

import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_MONASTERY,
  UNIT_ABILITY_HEAL,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_HERBALIST } from "../ids.js";
import { MANA_GREEN } from "../../ids.js";

// Effect IDs reference effects defined in core/src/data/unitAbilityEffects.ts
const HERBALIST_READY_UNIT = "herbalist_ready_unit";
const HERBALIST_GAIN_MANA = "herbalist_gain_mana";

export const HERBALIST: UnitDefinition = {
  id: UNIT_HERBALIST,
  name: "Herbalist",
  type: UNIT_TYPE_REGULAR,
  level: 1,
  influence: 3,
  armor: 2,
  resistances: [],
  recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_MONASTERY],
  abilities: [
    // Heal 2 (requires green mana)
    { type: UNIT_ABILITY_HEAL, value: 2, manaCost: MANA_GREEN },
    // Ready a Level I/II Unit (free, no combat required)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERBALIST_READY_UNIT,
      displayName: "Ready a Level I/II Unit",
      requiresCombat: false,
    },
    // Gain green mana token (free, no combat required)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERBALIST_GAIN_MANA,
      displayName: "Gain Green Mana",
      requiresCombat: false,
    },
  ],
  copies: 2,
};
