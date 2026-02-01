import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_BROWN, type EnemyDefinition } from "../types.js";
import { ABILITY_PARALYZE } from "../abilities.js";

export const ENEMY_MEDUSA = "medusa" as const;

export const MEDUSA: EnemyDefinition = {
  id: ENEMY_MEDUSA,
  name: "Medusa",
  color: ENEMY_COLOR_BROWN,
  attack: 6,
  attackElement: ELEMENT_PHYSICAL,
  armor: 4,
  fame: 5,
  resistances: [],
  abilities: [ABILITY_PARALYZE],
};
