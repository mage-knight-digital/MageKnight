import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, type EnemyDefinition } from "../types.js";
import { ABILITY_SUMMON } from "../abilities.js";

export const ENEMY_ORC_SUMMONERS = "orc_summoners" as const;

export const ORC_SUMMONERS: EnemyDefinition = {
  id: ENEMY_ORC_SUMMONERS,
  name: "Orc Summoners",
  color: ENEMY_COLOR_GREEN,
  attack: 0, // Summoners don't attack directly
  attackElement: ELEMENT_PHYSICAL,
  armor: 4,
  fame: 4,
  resistances: [],
  abilities: [ABILITY_SUMMON], // Summons brown enemy
};
