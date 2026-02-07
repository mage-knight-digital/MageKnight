/**
 * Hero (White) unit definition
 *
 * Rulebook:
 * - Influence: 9 (with double reputation modifier per Heroes special rules)
 * - Armor: 6, Resistance: None
 * - Recruit: Keep, Village, City
 * - Attack OR Block 5 (choice, shared with all Heroes)
 * - Influence 5 (+1 Reputation when used in interaction, shared with all Heroes)
 * - (White Mana) Ranged Attack 7 - unique mana-powered ability
 */

import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_HERO_WHITE } from "../ids.js";
import { MANA_WHITE } from "../../ids.js";

// Effect IDs reference effects defined in core/src/data/unitAbilityEffects.ts
const HERO_WHITE_ATTACK_OR_BLOCK = "hero_white_attack_or_block";
const HERO_WHITE_INFLUENCE_REP = "hero_white_influence_rep";
const HERO_WHITE_RANGED_ATTACK = "hero_white_ranged_attack";

export const HERO_WHITE: UnitDefinition = {
  id: UNIT_HERO_WHITE,
  name: "Hero (White)",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 9,
  armor: 6,
  resistances: [],
  recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
  abilities: [
    // Attack OR Block 5 (choice, shared with all Heroes)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERO_WHITE_ATTACK_OR_BLOCK,
      displayName: "Attack 5 OR Block 5",
    },
    // Influence 5 with +1 Reputation when used in interaction
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERO_WHITE_INFLUENCE_REP,
      displayName: "Influence 5 (+1 Reputation)",
      requiresCombat: false,
    },
    // (White Mana) Ranged Attack 7
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERO_WHITE_RANGED_ATTACK,
      displayName: "Ranged Attack 7",
      manaCost: MANA_WHITE,
    },
  ],
  copies: 1,
};
