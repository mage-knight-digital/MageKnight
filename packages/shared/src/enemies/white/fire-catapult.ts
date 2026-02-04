import { ELEMENT_FIRE } from "../../elements.js";
import { ENEMY_COLOR_WHITE, type EnemyDefinition } from "../types.js";
import { ABILITY_FORTIFIED, ABILITY_CUMBERSOME } from "../abilities.js";

export const ENEMY_FIRE_CATAPULT = "fire_catapult" as const;

export const FIRE_CATAPULT: EnemyDefinition = {
  id: ENEMY_FIRE_CATAPULT,
  name: "Fire Catapult",
  color: ENEMY_COLOR_WHITE,
  attack: 8,
  attackElement: ELEMENT_FIRE,
  armor: 7,
  fame: 7,
  resistances: [],
  abilities: [ABILITY_FORTIFIED, ABILITY_CUMBERSOME],
};
