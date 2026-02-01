import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, type EnemyDefinition } from "../types.js";
import { ABILITY_SWIFT } from "../abilities.js";

export const ENEMY_WOLF_RIDERS = "wolf_riders" as const;

export const WOLF_RIDERS: EnemyDefinition = {
  id: ENEMY_WOLF_RIDERS,
  name: "Wolf Riders",
  color: ENEMY_COLOR_GREEN,
  attack: 3,
  attackElement: ELEMENT_PHYSICAL,
  armor: 4,
  fame: 3,
  resistances: [],
  abilities: [ABILITY_SWIFT],
};
