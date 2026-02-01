import { ELEMENT_ICE } from "../../elements.js";
import { ENEMY_COLOR_VIOLET, type EnemyDefinition } from "../types.js";
import { ABILITY_PARALYZE } from "../abilities.js";
import { RESIST_ICE, RESIST_PHYSICAL } from "../resistances.js";

export const ENEMY_ICE_GOLEMS = "ice_golems" as const;

export const ICE_GOLEMS: EnemyDefinition = {
  id: ENEMY_ICE_GOLEMS,
  name: "Ice Golems",
  color: ENEMY_COLOR_VIOLET,
  attack: 2,
  attackElement: ELEMENT_ICE,
  armor: 4,
  fame: 5,
  resistances: [RESIST_ICE, RESIST_PHYSICAL],
  abilities: [ABILITY_PARALYZE],
};
