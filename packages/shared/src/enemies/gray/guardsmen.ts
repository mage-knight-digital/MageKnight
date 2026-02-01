import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GRAY, type EnemyDefinition } from "../types.js";
import { ABILITY_FORTIFIED } from "../abilities.js";

export const ENEMY_GUARDSMEN = "guardsmen" as const;

export const GUARDSMEN: EnemyDefinition = {
  id: ENEMY_GUARDSMEN,
  name: "Guardsmen",
  color: ENEMY_COLOR_GRAY,
  attack: 3,
  attackElement: ELEMENT_PHYSICAL,
  armor: 7,
  fame: 3,
  resistances: [],
  abilities: [ABILITY_FORTIFIED],
};
