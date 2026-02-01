import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, type EnemyDefinition } from "../types.js";

export const ENEMY_PROWLERS = "prowlers" as const;

export const PROWLERS: EnemyDefinition = {
  id: ENEMY_PROWLERS,
  name: "Prowlers",
  color: ENEMY_COLOR_GREEN,
  attack: 4,
  attackElement: ELEMENT_PHYSICAL,
  armor: 3,
  fame: 2,
  resistances: [],
  abilities: [],
};
