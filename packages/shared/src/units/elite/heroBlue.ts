/**
 * Hero (Blue/Ice) unit definition
 *
 * Rulebook:
 * - Influence: 9 (with double reputation modifier per Heroes special rules)
 * - Armor: 4, Resistance: Ice
 * - Recruit: Keep, Village, City
 * - Attack OR Block 5 (choice, shared with all Heroes)
 * - Influence 5 (+1 Reputation when used in interaction, shared with all Heroes)
 * - (Blue Mana) Cold Fire Block 8 - unique mana-powered ability
 */

import { RESIST_ICE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_HERO_BLUE } from "../ids.js";
import { MANA_BLUE } from "../../ids.js";

// Effect IDs reference effects defined in core/src/data/unitAbilityEffects.ts
const HERO_BLUE_ATTACK_OR_BLOCK = "hero_blue_attack_or_block";
const HERO_BLUE_INFLUENCE_REP = "hero_blue_influence_rep";
const HERO_BLUE_COLD_FIRE_BLOCK = "hero_blue_cold_fire_block";

export const HERO_BLUE: UnitDefinition = {
  id: UNIT_HERO_BLUE,
  name: "Hero (Blue/Ice)",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 9,
  armor: 4,
  resistances: [RESIST_ICE],
  recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
  abilities: [
    // Attack OR Block 5 (choice, shared with all Heroes)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERO_BLUE_ATTACK_OR_BLOCK,
      displayName: "Attack 5 OR Block 5",
    },
    // Influence 5 with +1 Reputation when used in interaction
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERO_BLUE_INFLUENCE_REP,
      displayName: "Influence 5 (+1 Reputation)",
      requiresCombat: false,
    },
    // (Blue Mana) Cold Fire Block 8
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERO_BLUE_COLD_FIRE_BLOCK,
      displayName: "Cold Fire Block 8",
      manaCost: MANA_BLUE,
    },
  ],
  copies: 1,
};
