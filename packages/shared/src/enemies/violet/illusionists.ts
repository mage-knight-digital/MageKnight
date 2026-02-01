import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_VIOLET, type EnemyDefinition } from "../types.js";
import { ABILITY_SUMMON } from "../abilities.js";
import { RESIST_PHYSICAL } from "../resistances.js";

export const ENEMY_ILLUSIONISTS = "illusionists" as const;

export const ILLUSIONISTS: EnemyDefinition = {
  id: ENEMY_ILLUSIONISTS,
  name: "Illusionists",
  color: ENEMY_COLOR_VIOLET,
  attack: 0, // Summoners don't attack directly
  attackElement: ELEMENT_PHYSICAL,
  armor: 3,
  fame: 4,
  resistances: [RESIST_PHYSICAL],
  abilities: [ABILITY_SUMMON], // Summons brown enemy
};
