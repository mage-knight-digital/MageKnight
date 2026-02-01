import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_RED, type EnemyDefinition } from "../types.js";
import { ABILITY_SWIFT, ABILITY_PARALYZE } from "../abilities.js";

export const ENEMY_SWAMP_DRAGON = "swamp_dragon" as const;

export const SWAMP_DRAGON: EnemyDefinition = {
  id: ENEMY_SWAMP_DRAGON,
  name: "Swamp Dragon",
  color: ENEMY_COLOR_RED,
  attack: 5,
  attackElement: ELEMENT_PHYSICAL,
  armor: 9,
  fame: 7,
  resistances: [],
  abilities: [ABILITY_SWIFT, ABILITY_PARALYZE],
};
