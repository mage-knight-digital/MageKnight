import { ELEMENT_FIRE } from "../../elements.js";
import { ENEMY_COLOR_RED, type EnemyDefinition } from "../types.js";
import { ABILITY_FORTIFIED, ABILITY_BRUTAL } from "../abilities.js";
import { RESIST_FIRE } from "../resistances.js";

export const ENEMY_LAVA_DRAGON = "lava_dragon" as const;

export const LAVA_DRAGON: EnemyDefinition = {
  id: ENEMY_LAVA_DRAGON,
  name: "Lava Dragon",
  color: ENEMY_COLOR_RED,
  attack: 6,
  attackElement: ELEMENT_FIRE,
  armor: 8,
  fame: 8,
  resistances: [RESIST_FIRE],
  abilities: [ABILITY_FORTIFIED, ABILITY_BRUTAL],
};
