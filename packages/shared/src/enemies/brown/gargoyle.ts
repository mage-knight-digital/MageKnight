import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_BROWN, type EnemyDefinition } from "../types.js";
import { RESIST_PHYSICAL } from "../resistances.js";

export const ENEMY_GARGOYLE = "gargoyle" as const;

export const GARGOYLE: EnemyDefinition = {
  id: ENEMY_GARGOYLE,
  name: "Gargoyle",
  color: ENEMY_COLOR_BROWN,
  attack: 5,
  attackElement: ELEMENT_PHYSICAL,
  armor: 4,
  fame: 4,
  resistances: [RESIST_PHYSICAL],
  abilities: [],
};
