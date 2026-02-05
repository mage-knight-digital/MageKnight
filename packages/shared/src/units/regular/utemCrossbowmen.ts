/**
 * Utem Crossbowmen unit definition
 *
 * Abilities:
 * 1. Attack 3 OR Block 3 - choice ability (free)
 * 2. Ranged Attack 2 (free)
 */

import { ELEMENT_PHYSICAL } from "../../elements.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  UNIT_ABILITY_EFFECT,
  UNIT_ABILITY_RANGED_ATTACK,
} from "../constants.js";
import { UNIT_UTEM_CROSSBOWMEN } from "../ids.js";

// Effect ID references effect defined in core/src/data/unitAbilityEffects.ts
const UTEM_CROSSBOWMEN_ATTACK_OR_BLOCK = "utem_crossbowmen_attack_or_block";

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
    // Basic: Attack 3 OR Block 3 (choice, no mana cost)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: UTEM_CROSSBOWMEN_ATTACK_OR_BLOCK,
      displayName: "Attack 3 OR Block 3",
    },
    // Ranged Attack 2 (free)
    { type: UNIT_ABILITY_RANGED_ATTACK, value: 2, element: ELEMENT_PHYSICAL },
  ],
  copies: 2,
};
