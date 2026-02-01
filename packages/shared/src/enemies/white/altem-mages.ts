import { ELEMENT_COLD_FIRE } from "../../elements.js";
import { ENEMY_COLOR_WHITE, type EnemyDefinition } from "../types.js";
import { ABILITY_BRUTAL, ABILITY_POISON } from "../abilities.js";
import { RESIST_PHYSICAL } from "../resistances.js";

export const ENEMY_ALTEM_MAGES = "altem_mages" as const;

export const ALTEM_MAGES: EnemyDefinition = {
  id: ENEMY_ALTEM_MAGES,
  name: "Altem Mages",
  color: ENEMY_COLOR_WHITE,
  attack: 4,
  attackElement: ELEMENT_COLD_FIRE,
  armor: 8,
  fame: 8,
  resistances: [RESIST_PHYSICAL],
  abilities: [ABILITY_BRUTAL, ABILITY_POISON],
};
