import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_WHITE, type EnemyDefinition } from "../types.js";

export const ENEMY_THUGS = "thugs" as const;

export const THUGS: EnemyDefinition = {
  id: ENEMY_THUGS,
  name: "Thugs",
  color: ENEMY_COLOR_WHITE,
  attack: 6,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 5,
  resistances: [],
  abilities: [],
};
