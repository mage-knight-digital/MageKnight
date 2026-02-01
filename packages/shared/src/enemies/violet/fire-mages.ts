import { ELEMENT_FIRE } from "../../elements.js";
import { ENEMY_COLOR_VIOLET, type EnemyDefinition } from "../types.js";
import { RESIST_FIRE } from "../resistances.js";

export const ENEMY_FIRE_MAGES = "fire_mages" as const;

export const FIRE_MAGES: EnemyDefinition = {
  id: ENEMY_FIRE_MAGES,
  name: "Fire Mages",
  color: ENEMY_COLOR_VIOLET,
  attack: 6,
  attackElement: ELEMENT_FIRE,
  armor: 5,
  fame: 5,
  resistances: [RESIST_FIRE],
  abilities: [],
};
