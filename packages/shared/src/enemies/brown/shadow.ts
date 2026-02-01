import { ELEMENT_COLD_FIRE } from "../../elements.js";
import { ABILITY_ARCANE_IMMUNITY, ABILITY_ELUSIVE } from "../abilities.js";
import { ENEMY_COLOR_BROWN, type EnemyDefinition } from "../types.js";

export const ENEMY_SHADOW = "shadow" as const;

export const SHADOW: EnemyDefinition = {
  id: ENEMY_SHADOW,
  name: "Shadow",
  color: ENEMY_COLOR_BROWN,
  attack: 4,
  attackElement: ELEMENT_COLD_FIRE,
  armor: 4,
  armorElusive: 8, // Elusive: uses 8 normally, 4 if all attacks blocked
  fame: 4,
  resistances: [],
  abilities: [ABILITY_ELUSIVE, ABILITY_ARCANE_IMMUNITY],
};
