import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GRAY, type EnemyDefinition } from "../types.js";
import { ABILITY_BRUTAL } from "../abilities.js";

export const ENEMY_THUGS_GRAY = "thugs_gray" as const;

export const THUGS_GRAY: EnemyDefinition = {
  id: ENEMY_THUGS_GRAY,
  name: "Thugs",
  color: ENEMY_COLOR_GRAY,
  attack: 3,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 2,
  resistances: [],
  abilities: [ABILITY_BRUTAL],
  reputationBonus: 1,
};
