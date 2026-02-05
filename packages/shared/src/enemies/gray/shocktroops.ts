import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ABILITY_UNFORTIFIED, ABILITY_ELUSIVE } from "../abilities.js";
import { ENEMY_COLOR_GRAY, type EnemyDefinition } from "../types.js";

export const ENEMY_SHOCKTROOPS_GRAY = "shocktroops_gray" as const;

export const SHOCKTROOPS_GRAY: EnemyDefinition = {
  id: ENEMY_SHOCKTROOPS_GRAY,
  name: "Shocktroops",
  color: ENEMY_COLOR_GRAY,
  attack: 5,
  attackElement: ELEMENT_PHYSICAL,
  armor: 3,
  armorElusive: 6, // Elusive (6): uses 6 normally, 3 if all attacks blocked
  fame: 3,
  resistances: [],
  abilities: [ABILITY_UNFORTIFIED, ABILITY_ELUSIVE],
};
