import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, type EnemyDefinition } from "../types.js";
import { ABILITY_FORTIFIED, ABILITY_CUMBERSOME } from "../abilities.js";
import { RESIST_PHYSICAL } from "../resistances.js";

export const ENEMY_ORC_STONETHROWERS = "orc_stonethrowers" as const;

export const ORC_STONETHROWERS: EnemyDefinition = {
  id: ENEMY_ORC_STONETHROWERS,
  name: "Orc Stonethrowers",
  color: ENEMY_COLOR_GREEN,
  attack: 7,
  attackElement: ELEMENT_PHYSICAL,
  armor: 2,
  fame: 4,
  resistances: [RESIST_PHYSICAL],
  abilities: [ABILITY_FORTIFIED, ABILITY_CUMBERSOME],
};
