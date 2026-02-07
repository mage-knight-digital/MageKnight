/**
 * Hero (Red/Fire) unit definition
 *
 * Rulebook:
 * - Influence: 9 (with double reputation modifier per Heroes special rules)
 * - Armor: 4, Resistance: Fire
 * - Recruit: Keep, Village, City
 * - Attack OR Block 5 (choice, shared with all Heroes)
 * - Influence 5 (+1 Reputation when used in interaction, shared with all Heroes)
 * - (Red Mana) Cold Fire Attack 6 - unique mana-powered ability
 */

import { RESIST_FIRE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_HERO_RED } from "../ids.js";
import { MANA_RED } from "../../ids.js";

// Effect IDs reference effects defined in core/src/data/unitAbilityEffects.ts
const HERO_RED_ATTACK_OR_BLOCK = "hero_red_attack_or_block";
const HERO_RED_INFLUENCE_REP = "hero_red_influence_rep";
const HERO_RED_COLD_FIRE_ATTACK = "hero_red_cold_fire_attack";

export const HERO_RED: UnitDefinition = {
  id: UNIT_HERO_RED,
  name: "Hero (Red/Fire)",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 9,
  armor: 4,
  resistances: [RESIST_FIRE],
  recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
  abilities: [
    // Attack OR Block 5 (choice, shared with all Heroes)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERO_RED_ATTACK_OR_BLOCK,
      displayName: "Attack 5 OR Block 5",
    },
    // Influence 5 with +1 Reputation when used in interaction
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERO_RED_INFLUENCE_REP,
      displayName: "Influence 5 (+1 Reputation)",
      requiresCombat: false,
    },
    // (Red Mana) Cold Fire Attack 6
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERO_RED_COLD_FIRE_ATTACK,
      displayName: "Cold Fire Attack 6",
      manaCost: MANA_RED,
    },
  ],
  copies: 1,
};
