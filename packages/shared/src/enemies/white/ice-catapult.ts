import { ELEMENT_ICE } from "../../elements.js";
import { ENEMY_COLOR_WHITE, type EnemyDefinition } from "../types.js";
import { ABILITY_FORTIFIED, ABILITY_CUMBERSOME } from "../abilities.js";

export const ENEMY_ICE_CATAPULT = "ice_catapult" as const;

export const ICE_CATAPULT: EnemyDefinition = {
  id: ENEMY_ICE_CATAPULT,
  name: "Ice Catapult",
  color: ENEMY_COLOR_WHITE,
  attack: 9,
  attackElement: ELEMENT_ICE,
  armor: 6,
  fame: 7,
  resistances: [],
  abilities: [ABILITY_FORTIFIED, ABILITY_CUMBERSOME],
};
