import { ELEMENT_FIRE } from "../../elements.js";
import { ENEMY_COLOR_RED, type EnemyDefinition } from "../types.js";
import { RESIST_PHYSICAL, RESIST_FIRE } from "../resistances.js";

export const ENEMY_FIRE_DRAGON = "fire_dragon" as const;

export const FIRE_DRAGON: EnemyDefinition = {
  id: ENEMY_FIRE_DRAGON,
  name: "Fire Dragon",
  color: ENEMY_COLOR_RED,
  attack: 9,
  attackElement: ELEMENT_FIRE,
  armor: 7,
  fame: 8,
  resistances: [RESIST_PHYSICAL, RESIST_FIRE],
  abilities: [],
};
