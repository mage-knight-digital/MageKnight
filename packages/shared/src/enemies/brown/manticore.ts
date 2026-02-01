import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_BROWN, type EnemyDefinition } from "../types.js";
import { ABILITY_SWIFT, ABILITY_ASSASSINATION, ABILITY_POISON } from "../abilities.js";
import { RESIST_FIRE } from "../resistances.js";

export const ENEMY_MANTICORE = "manticore" as const;

export const MANTICORE: EnemyDefinition = {
  id: ENEMY_MANTICORE,
  name: "Manticore",
  color: ENEMY_COLOR_BROWN,
  attack: 4,
  attackElement: ELEMENT_PHYSICAL,
  armor: 6,
  fame: 5,
  resistances: [RESIST_FIRE],
  abilities: [ABILITY_SWIFT, ABILITY_ASSASSINATION, ABILITY_POISON],
};
