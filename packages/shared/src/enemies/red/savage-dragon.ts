import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_RED, FACTION_ELEMENTALIST, type EnemyDefinition } from "../types.js";
import { ABILITY_BRUTAL } from "../abilities.js";
import { RESIST_PHYSICAL } from "../resistances.js";

export const ENEMY_SAVAGE_DRAGON = "savage_dragon" as const;

export const SAVAGE_DRAGON: EnemyDefinition = {
  id: ENEMY_SAVAGE_DRAGON,
  name: "Savage Dragon",
  color: ENEMY_COLOR_RED,
  attack: 5,
  attackElement: ELEMENT_PHYSICAL,
  armor: 7,
  fame: 6,
  resistances: [RESIST_PHYSICAL],
  abilities: [ABILITY_BRUTAL],
  faction: FACTION_ELEMENTALIST,
};
