import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_BROWN, type EnemyDefinition } from "../types.js";
import { ABILITY_POISON } from "../abilities.js";
import { RESIST_ICE, RESIST_PHYSICAL } from "../resistances.js";

export const ENEMY_MUMMY = "mummy" as const;

export const MUMMY: EnemyDefinition = {
  id: ENEMY_MUMMY,
  name: "Mummy",
  color: ENEMY_COLOR_BROWN,
  attack: 4,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 4,
  resistances: [RESIST_ICE, RESIST_PHYSICAL],
  abilities: [ABILITY_POISON],
};
