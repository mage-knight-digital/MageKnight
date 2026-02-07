/**
 * Delphana Masters unit definition
 *
 * Rulebook abilities (each costs a different mana color):
 * 1. Cancel Attack (blue mana) - target enemy does not attack this combat
 * 2. Destroy if Blocked (red mana) - target enemy destroyed if fully blocked
 * 3. Armor Reduction (green mana) - target enemy armor -5 (min 1)
 * 4. Strip Defenses (white mana) - remove target's fortification + resistances
 *
 * Special activation rule: can use multiple different abilities per activation,
 * each ability usable once per turn.
 *
 * Special recruitment: interaction only (City or Refugee Camp).
 * Cannot be recruited via Call to Glory, Banner of Command, or combat rewards.
 * CAN be recruited via Bonds of Loyalty (normal pathway with discount).
 */

import { RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE } from "../../enemies/index.js";
import type { UnitDefinition } from "../types.js";
import { UNIT_TYPE_ELITE, RECRUIT_SITE_CITY, UNIT_ABILITY_EFFECT } from "../constants.js";
import { UNIT_DELPHANA_MASTERS } from "../ids.js";
import { MANA_BLUE, MANA_RED, MANA_GREEN, MANA_WHITE } from "../../ids.js";

/** Effect ID: Cancel Attack - target enemy does not attack this combat */
export const DELPHANA_MASTERS_CANCEL_ATTACK = "delphana_masters_cancel_attack" as const;
/** Effect ID: Destroy if Blocked - target enemy destroyed if fully blocked */
export const DELPHANA_MASTERS_DESTROY_IF_BLOCKED = "delphana_masters_destroy_if_blocked" as const;
/** Effect ID: Armor Reduction - target enemy armor -5 (min 1) */
export const DELPHANA_MASTERS_REDUCE_ARMOR = "delphana_masters_reduce_armor" as const;
/** Effect ID: Strip Defenses - remove fortification + all resistances */
export const DELPHANA_MASTERS_STRIP_DEFENSES = "delphana_masters_strip_defenses" as const;

export const DELPHANA_MASTERS: UnitDefinition = {
  id: UNIT_DELPHANA_MASTERS,
  name: "Delphana Masters",
  type: UNIT_TYPE_ELITE,
  level: 4,
  influence: 13,
  armor: 3,
  resistances: [RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE],
  recruitSites: [RECRUIT_SITE_CITY],
  abilities: [
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: DELPHANA_MASTERS_CANCEL_ATTACK,
      displayName: "Cancel Attack",
      manaCost: MANA_BLUE,
    },
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: DELPHANA_MASTERS_DESTROY_IF_BLOCKED,
      displayName: "Destroy if Blocked",
      manaCost: MANA_RED,
    },
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: DELPHANA_MASTERS_REDUCE_ARMOR,
      displayName: "Armor -5",
      manaCost: MANA_GREEN,
    },
    {
      type: UNIT_ABILITY_EFFECT,
      effectId: DELPHANA_MASTERS_STRIP_DEFENSES,
      displayName: "Strip Defenses",
      manaCost: MANA_WHITE,
    },
  ],
  copies: 2,
  interactionOnly: true,
  multiAbility: true,
};
