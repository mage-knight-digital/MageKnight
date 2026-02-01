import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, type EnemyDefinition } from "../types.js";

export const ENEMY_ORC_SKIRMISHERS = "orc_skirmishers" as const;

export const ORC_SKIRMISHERS: EnemyDefinition = {
  id: ENEMY_ORC_SKIRMISHERS,
  name: "Orc Skirmishers",
  color: ENEMY_COLOR_GREEN,
  attack: 0, // Multiple attacks - use attacks array
  attackElement: ELEMENT_PHYSICAL,
  armor: 4,
  fame: 2,
  resistances: [],
  abilities: [],
  attacks: [
    { damage: 1, element: ELEMENT_PHYSICAL },
    { damage: 1, element: ELEMENT_PHYSICAL },
  ],
};
