/**
 * Utem Swordsmen unit definition
 *
 * Abilities:
 * 1. Attack 3 OR Block 3 - choice ability (free)
 * 2. Attack 6 OR Block 6 - choice ability (free), this unit becomes wounded
 */

import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_KEEP,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_UTEM_SWORDSMEN } from "../ids.js";

// Effect ID references effects defined in core/src/data/unitAbilityEffects.ts
const UTEM_SWORDSMEN_ATTACK_OR_BLOCK = "utem_swordsmen_attack_or_block";
const UTEM_SWORDSMEN_ATTACK_OR_BLOCK_WOUND = "utem_swordsmen_attack_or_block_wound";

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
    // Ability 0: Attack 3 OR Block 3 (choice, free)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: UTEM_SWORDSMEN_ATTACK_OR_BLOCK,
      displayName: "Attack 3 OR Block 3",
    },
    // Ability 1: Attack 6 OR Block 6 (choice, free) — this unit becomes wounded
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: UTEM_SWORDSMEN_ATTACK_OR_BLOCK_WOUND,
      displayName: "Attack 6 OR Block 6 (wound self)",
    },
  ],
  copies: 2,
};
