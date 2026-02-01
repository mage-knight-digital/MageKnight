import { ELEMENT_FIRE } from "../../elements.js";
import { ENEMY_COLOR_VIOLET, type EnemyDefinition } from "../types.js";
import { ABILITY_BRUTAL } from "../abilities.js";
import { RESIST_FIRE, RESIST_PHYSICAL } from "../resistances.js";

export const ENEMY_FIRE_GOLEMS = "fire_golems" as const;

export const FIRE_GOLEMS: EnemyDefinition = {
  id: ENEMY_FIRE_GOLEMS,
  name: "Fire Golems",
  color: ENEMY_COLOR_VIOLET,
  attack: 3,
  attackElement: ELEMENT_FIRE,
  armor: 4,
  fame: 5,
  resistances: [RESIST_FIRE, RESIST_PHYSICAL],
  abilities: [ABILITY_BRUTAL],
};
