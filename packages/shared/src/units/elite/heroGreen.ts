/**
 * Hero (Green/Physical) unit definition
 *
 * Rulebook:
 * - Influence: 9 (with double reputation modifier per Heroes special rules)
 * - Armor: 3, Resistance: Physical
 * - Recruit: Keep, Village, City
 * - Attack OR Block 5 (choice, shared with all Heroes)
 * - Influence 5 (+1 Reputation when used in interaction, shared with all Heroes)
 * - (Green Mana) Heal 4 - unique mana-powered ability
 */

import { RESIST_PHYSICAL } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_CITY,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_HERO_GREEN } from "../ids.js";
import { MANA_GREEN } from "../../ids.js";

// Effect IDs reference effects defined in core/src/data/unitAbilityEffects.ts
const HERO_GREEN_ATTACK_OR_BLOCK = "hero_green_attack_or_block";
const HERO_GREEN_INFLUENCE_REP = "hero_green_influence_rep";
const HERO_GREEN_HEAL = "hero_green_heal";

export const HERO_GREEN: UnitDefinition = {
  id: UNIT_HERO_GREEN,
  name: "Hero (Green/Physical)",
  type: UNIT_TYPE_ELITE,
  level: 3,
  influence: 9,
  armor: 3,
  resistances: [RESIST_PHYSICAL],
  recruitSites: [RECRUIT_SITE_VILLAGE, RECRUIT_SITE_KEEP, RECRUIT_SITE_CITY],
  abilities: [
    // Attack OR Block 5 (choice, shared with all Heroes)
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERO_GREEN_ATTACK_OR_BLOCK,
      displayName: "Attack 5 OR Block 5",
    },
    // Influence 5 with +1 Reputation when used in interaction
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERO_GREEN_INFLUENCE_REP,
      displayName: "Influence 5 (+1 Reputation)",
      requiresCombat: false,
    },
    // (Green Mana) Heal 4
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: HERO_GREEN_HEAL,
      displayName: "Heal 4",
      manaCost: MANA_GREEN,
      requiresCombat: false,
    },
  ],
  copies: 1,
};
