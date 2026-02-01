import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_VIOLET, type EnemyDefinition } from "../types.js";
import { ABILITY_POISON } from "../abilities.js";

export const ENEMY_MONKS = "monks" as const;

export const MONKS: EnemyDefinition = {
  id: ENEMY_MONKS,
  name: "Monks",
  color: ENEMY_COLOR_VIOLET,
  attack: 5,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 4,
  resistances: [],
  abilities: [ABILITY_POISON],
};
