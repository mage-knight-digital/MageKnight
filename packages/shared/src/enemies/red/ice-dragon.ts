import { ELEMENT_ICE } from "../../elements.js";
import { ENEMY_COLOR_RED, type EnemyDefinition } from "../types.js";
import { ABILITY_PARALYZE } from "../abilities.js";
import { RESIST_PHYSICAL, RESIST_ICE } from "../resistances.js";

export const ENEMY_ICE_DRAGON = "ice_dragon" as const;

export const ICE_DRAGON: EnemyDefinition = {
  id: ENEMY_ICE_DRAGON,
  name: "Ice Dragon",
  color: ENEMY_COLOR_RED,
  attack: 6,
  attackElement: ELEMENT_ICE,
  armor: 7,
  fame: 8,
  resistances: [RESIST_PHYSICAL, RESIST_ICE],
  abilities: [ABILITY_PARALYZE],
};
