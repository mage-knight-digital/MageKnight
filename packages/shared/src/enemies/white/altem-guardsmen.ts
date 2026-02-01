import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_WHITE, type EnemyDefinition } from "../types.js";
import { ABILITY_FORTIFIED } from "../abilities.js";
import { RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE } from "../resistances.js";

export const ENEMY_ALTEM_GUARDSMEN = "altem_guardsmen" as const;

export const ALTEM_GUARDSMEN: EnemyDefinition = {
  id: ENEMY_ALTEM_GUARDSMEN,
  name: "Altem Guardsmen",
  color: ENEMY_COLOR_WHITE,
  attack: 5,
  attackElement: ELEMENT_PHYSICAL,
  armor: 7,
  fame: 8,
  resistances: [RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE],
  abilities: [ABILITY_FORTIFIED],
};
