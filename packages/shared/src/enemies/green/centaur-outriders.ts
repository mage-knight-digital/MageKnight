import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, FACTION_ELEMENTALIST, type EnemyDefinition } from "../types.js";
import { ABILITY_SWIFT } from "../abilities.js";

export const ENEMY_CENTAUR_OUTRIDERS = "centaur_outriders" as const;

export const CENTAUR_OUTRIDERS: EnemyDefinition = {
  id: ENEMY_CENTAUR_OUTRIDERS,
  name: "Centaur Outriders",
  color: ENEMY_COLOR_GREEN,
  attack: 3,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 2,
  resistances: [],
  abilities: [ABILITY_SWIFT],
  faction: FACTION_ELEMENTALIST,
};
