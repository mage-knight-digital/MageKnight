import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, FACTION_DARK_CRUSADERS, type EnemyDefinition } from "../types.js";
import { RESIST_FIRE } from "../resistances.js";

export const ENEMY_SKELETAL_WARRIORS = "skeletal_warriors" as const;

export const SKELETAL_WARRIORS: EnemyDefinition = {
  id: ENEMY_SKELETAL_WARRIORS,
  name: "Skeletal Warriors",
  color: ENEMY_COLOR_GREEN,
  attack: 3,
  attackElement: ELEMENT_PHYSICAL,
  armor: 4,
  fame: 1,
  resistances: [RESIST_FIRE],
  abilities: [],
  faction: FACTION_DARK_CRUSADERS,
};
