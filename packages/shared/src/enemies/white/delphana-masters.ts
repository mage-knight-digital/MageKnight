import { ELEMENT_COLD_FIRE } from "../../elements.js";
import { ENEMY_COLOR_WHITE, type EnemyDefinition } from "../types.js";
import { ABILITY_ASSASSINATION, ABILITY_PARALYZE } from "../abilities.js";
import { RESIST_FIRE, RESIST_ICE } from "../resistances.js";

export const ENEMY_DELPHANA_MASTERS = "delphana_masters" as const;

export const DELPHANA_MASTERS: EnemyDefinition = {
  id: ENEMY_DELPHANA_MASTERS,
  name: "Delphana Masters",
  color: ENEMY_COLOR_WHITE,
  attack: 5,
  attackElement: ELEMENT_COLD_FIRE,
  armor: 8,
  fame: 9,
  resistances: [RESIST_FIRE, RESIST_ICE],
  abilities: [ABILITY_ASSASSINATION, ABILITY_PARALYZE],
};
