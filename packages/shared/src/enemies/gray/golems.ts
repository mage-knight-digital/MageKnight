import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GRAY, type EnemyDefinition } from "../types.js";
import { RESIST_PHYSICAL } from "../resistances.js";

export const ENEMY_GOLEMS = "golems" as const;

export const GOLEMS: EnemyDefinition = {
  id: ENEMY_GOLEMS,
  name: "Golems",
  color: ENEMY_COLOR_GRAY,
  attack: 2,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 4,
  resistances: [RESIST_PHYSICAL],
  abilities: [],
};
