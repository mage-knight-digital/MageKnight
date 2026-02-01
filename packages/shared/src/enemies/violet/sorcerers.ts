import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_VIOLET, type EnemyDefinition } from "../types.js";
import { ABILITY_ASSASSINATION, ABILITY_POISON, ABILITY_ARCANE_IMMUNITY } from "../abilities.js";

export const ENEMY_SORCERERS = "sorcerers" as const;

export const SORCERERS: EnemyDefinition = {
  id: ENEMY_SORCERERS,
  name: "Sorcerers",
  color: ENEMY_COLOR_VIOLET,
  attack: 6,
  attackElement: ELEMENT_PHYSICAL,
  armor: 6,
  fame: 5,
  resistances: [],
  abilities: [ABILITY_ASSASSINATION, ABILITY_POISON, ABILITY_ARCANE_IMMUNITY],
};
