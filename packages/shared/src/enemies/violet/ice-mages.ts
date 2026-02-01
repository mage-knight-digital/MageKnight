import { ELEMENT_ICE } from "../../elements.js";
import { ENEMY_COLOR_VIOLET, type EnemyDefinition } from "../types.js";
import { RESIST_ICE } from "../resistances.js";

export const ENEMY_ICE_MAGES = "ice_mages" as const;

export const ICE_MAGES: EnemyDefinition = {
  id: ENEMY_ICE_MAGES,
  name: "Ice Mages",
  color: ENEMY_COLOR_VIOLET,
  attack: 5,
  attackElement: ELEMENT_ICE,
  armor: 6,
  fame: 5,
  resistances: [RESIST_ICE],
  abilities: [],
};
