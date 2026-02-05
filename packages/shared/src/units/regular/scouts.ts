/**
 * Scouts unit definition
 *
 * Abilities:
 * 1. Siege Attack 1 (free) - basic siege combat
 * 2. Scout (free) - Look at face-down tokens within 3 spaces. +1 Fame if defeated this turn.
 * 3. Move 2 (free) - May reveal a new tile at distance 2 instead of 1.
 */

import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_SIEGE_ATTACK,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_SCOUTS } from "../ids.js";
import { ELEMENT_PHYSICAL } from "../../elements.js";

// Effect IDs reference effects defined in core/src/data/unitAbilityEffects.ts
const SCOUTS_SCOUT_PEEK = "scouts_scout_peek";
const SCOUTS_EXTENDED_MOVE = "scouts_extended_move";

export const SCOUTS: UnitDefinition = {
  id: UNIT_SCOUTS,
  name: "Scouts",
  type: UNIT_TYPE_REGULAR,
  level: 1,
  influence: 4,
  armor: 2,
  resistances: [],
  recruitSites: [
    RECRUIT_SITE_VILLAGE,
    RECRUIT_SITE_KEEP,
    RECRUIT_SITE_MAGE_TOWER,
    RECRUIT_SITE_MONASTERY,
    RECRUIT_SITE_CITY,
  ],
  abilities: [
    // Siege Attack 1 (free)
    { type: UNIT_ABILITY_SIEGE_ATTACK, value: 1, element: ELEMENT_PHYSICAL },
    // Scout peek ability - reveal face-down tokens within 3 spaces (free, non-combat)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: SCOUTS_SCOUT_PEEK,
      displayName: "Scout (Reveal nearby tokens)",
      requiresCombat: false,
    },
    // Move 2 with extended reveal (can reveal tiles at distance 2 instead of 1)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: SCOUTS_EXTENDED_MOVE,
      displayName: "Move 2 (Extended Explore)",
      requiresCombat: false,
    },
  ],
  copies: 2,
};
