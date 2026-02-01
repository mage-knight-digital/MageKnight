import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, type EnemyDefinition } from "../types.js";
import { ABILITY_POISON } from "../abilities.js";

export const ENEMY_CURSED_HAGS = "cursed_hags" as const;

export const CURSED_HAGS: EnemyDefinition = {
  id: ENEMY_CURSED_HAGS,
  name: "Cursed Hags",
  color: ENEMY_COLOR_GREEN,
  attack: 3,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 3,
  resistances: [],
  abilities: [ABILITY_POISON],
};
