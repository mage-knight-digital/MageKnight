import { ELEMENT_COLD_FIRE } from "../../elements.js";
import { ENEMY_COLOR_BROWN, type EnemyDefinition } from "../types.js";

export const ENEMY_SHADOW = "shadow" as const;

export const SHADOW: EnemyDefinition = {
  id: ENEMY_SHADOW,
  name: "Shadow",
  color: ENEMY_COLOR_BROWN,
  attack: 4,
  attackElement: ELEMENT_COLD_FIRE,
  armor: 4,
  fame: 4,
  resistances: [],
  abilities: [], // Elusive, arcane immunity not modeled yet
};
