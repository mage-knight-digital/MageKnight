import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_WHITE, type EnemyDefinition } from "../types.js";
import { ABILITY_SWIFT, ABILITY_BRUTAL } from "../abilities.js";

export const ENEMY_SHOCKTROOPS = "shocktroops" as const;

export const SHOCKTROOPS: EnemyDefinition = {
  id: ENEMY_SHOCKTROOPS,
  name: "Shocktroops",
  color: ENEMY_COLOR_WHITE,
  attack: 5,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 5,
  resistances: [],
  abilities: [ABILITY_SWIFT, ABILITY_BRUTAL],
};
