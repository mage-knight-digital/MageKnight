import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, type EnemyDefinition } from "../types.js";
import { ABILITY_FORTIFIED } from "../abilities.js";

export const ENEMY_DIGGERS = "diggers" as const;

export const DIGGERS: EnemyDefinition = {
  id: ENEMY_DIGGERS,
  name: "Diggers",
  color: ENEMY_COLOR_GREEN,
  attack: 3,
  attackElement: ELEMENT_PHYSICAL,
  armor: 3,
  fame: 2,
  resistances: [],
  abilities: [ABILITY_FORTIFIED],
};
