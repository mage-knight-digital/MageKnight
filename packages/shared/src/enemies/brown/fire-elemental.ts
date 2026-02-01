import { ELEMENT_FIRE } from "../../elements.js";
import { ENEMY_COLOR_BROWN, FACTION_ELEMENTALIST, type EnemyDefinition } from "../types.js";
import { RESIST_FIRE } from "../resistances.js";

export const ENEMY_FIRE_ELEMENTAL = "fire_elemental" as const;

export const FIRE_ELEMENTAL: EnemyDefinition = {
  id: ENEMY_FIRE_ELEMENTAL,
  name: "Fire Elemental",
  color: ENEMY_COLOR_BROWN,
  attack: 7,
  attackElement: ELEMENT_FIRE,
  armor: 6,
  fame: 4,
  resistances: [RESIST_FIRE],
  abilities: [],
  faction: FACTION_ELEMENTALIST,
};
