/**
 * Shocktroops unit definition
 *
 * Abilities:
 * 1. Ranged Attack 1 + all other units get +1 to all attacks this combat
 * 2. Weaken Enemy: reduce target enemy armor by 1 and one attack by 1
 * 3. Taunt + Reduce Attack: reduce enemy attack by 3, damage redirect to this unit
 */

import type { UnitDefinition } from "../types.js";
import {
  UNIT_TYPE_REGULAR,
  RECRUIT_SITE_KEEP,
  UNIT_ABILITY_EFFECT,
} from "../constants.js";
import { UNIT_SHOCKTROOPS } from "../ids.js";

/** Effect IDs - referenced in core's unitAbilityEffects registry */
export const SHOCKTROOPS_COORDINATED_FIRE = "shocktroops_coordinated_fire" as const;
export const SHOCKTROOPS_WEAKEN_ENEMY = "shocktroops_weaken_enemy" as const;
export const SHOCKTROOPS_TAUNT = "shocktroops_taunt" as const;

export const SHOCKTROOPS: UnitDefinition = {
  id: UNIT_SHOCKTROOPS,
  name: "Shocktroops",
  type: UNIT_TYPE_REGULAR,
  level: 2,
  influence: 6,
  armor: 3,
  resistances: [],
  recruitSites: [RECRUIT_SITE_KEEP],
  abilities: [
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: SHOCKTROOPS_COORDINATED_FIRE,
      displayName: "Ranged Attack 1 + Buff Units",
    },
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: SHOCKTROOPS_WEAKEN_ENEMY,
      displayName: "Weaken Enemy",
    },
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: SHOCKTROOPS_TAUNT,
      displayName: "Taunt + Reduce Attack",
    },
  ],
  copies: 2,
};
