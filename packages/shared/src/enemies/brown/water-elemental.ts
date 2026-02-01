import { ELEMENT_ICE } from "../../elements.js";
import { ENEMY_COLOR_BROWN, FACTION_ELEMENTALIST, type EnemyDefinition } from "../types.js";
import { RESIST_ICE } from "../resistances.js";

export const ENEMY_WATER_ELEMENTAL = "water_elemental" as const;

export const WATER_ELEMENTAL: EnemyDefinition = {
  id: ENEMY_WATER_ELEMENTAL,
  name: "Water Elemental",
  color: ENEMY_COLOR_BROWN,
  attack: 6,
  attackElement: ELEMENT_ICE,
  armor: 7,
  fame: 4,
  resistances: [RESIST_ICE],
  abilities: [],
  faction: FACTION_ELEMENTALIST,
};
