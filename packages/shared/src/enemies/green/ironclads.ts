import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, type EnemyDefinition } from "../types.js";
import { ABILITY_BRUTAL } from "../abilities.js";
import { RESIST_PHYSICAL } from "../resistances.js";

export const ENEMY_IRONCLADS = "ironclads" as const;

export const IRONCLADS: EnemyDefinition = {
  id: ENEMY_IRONCLADS,
  name: "Ironclads",
  color: ENEMY_COLOR_GREEN,
  attack: 4,
  attackElement: ELEMENT_PHYSICAL,
  armor: 3,
  fame: 4,
  resistances: [RESIST_PHYSICAL],
  abilities: [ABILITY_BRUTAL],
};
