import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GRAY, type EnemyDefinition } from "../types.js";

export const ENEMY_SWORDSMEN = "swordsmen" as const;

export const SWORDSMEN: EnemyDefinition = {
  id: ENEMY_SWORDSMEN,
  name: "Swordsmen",
  color: ENEMY_COLOR_GRAY,
  attack: 6,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 4,
  resistances: [],
  abilities: [],
};
