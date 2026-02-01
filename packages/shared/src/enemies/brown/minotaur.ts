import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_BROWN, type EnemyDefinition } from "../types.js";
import { ABILITY_BRUTAL } from "../abilities.js";

export const ENEMY_MINOTAUR = "minotaur" as const;

export const MINOTAUR: EnemyDefinition = {
  id: ENEMY_MINOTAUR,
  name: "Minotaur",
  color: ENEMY_COLOR_BROWN,
  attack: 5,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 4,
  resistances: [],
  abilities: [ABILITY_BRUTAL],
};
