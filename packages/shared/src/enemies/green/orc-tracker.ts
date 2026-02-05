import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ABILITY_ASSASSINATION, ABILITY_ELUSIVE } from "../abilities.js";
import { ENEMY_COLOR_GREEN, type EnemyDefinition } from "../types.js";

export const ENEMY_ORC_TRACKER = "orc_tracker" as const;

export const ORC_TRACKER: EnemyDefinition = {
  id: ENEMY_ORC_TRACKER,
  name: "Orc Tracker",
  color: ENEMY_COLOR_GREEN,
  attack: 4,
  attackElement: ELEMENT_PHYSICAL,
  armor: 3,
  armorElusive: 6, // Elusive (6): uses 6 normally, 3 if all attacks blocked
  fame: 3,
  resistances: [],
  abilities: [ABILITY_ELUSIVE, ABILITY_ASSASSINATION],
};
