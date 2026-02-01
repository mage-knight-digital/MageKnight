import { ELEMENT_COLD_FIRE } from "../../elements.js";
import { ENEMY_COLOR_RED, type EnemyDefinition } from "../types.js";
import { ABILITY_BRUTAL } from "../abilities.js";
import { RESIST_FIRE, RESIST_ICE } from "../resistances.js";

export const ENEMY_HIGH_DRAGON = "high_dragon" as const;

export const HIGH_DRAGON: EnemyDefinition = {
  id: ENEMY_HIGH_DRAGON,
  name: "High Dragon",
  color: ENEMY_COLOR_RED,
  attack: 6,
  attackElement: ELEMENT_COLD_FIRE,
  armor: 9,
  fame: 9,
  resistances: [RESIST_FIRE, RESIST_ICE],
  abilities: [ABILITY_BRUTAL],
};
