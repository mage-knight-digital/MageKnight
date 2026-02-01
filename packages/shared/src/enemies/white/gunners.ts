import { ELEMENT_FIRE } from "../../elements.js";
import { ENEMY_COLOR_WHITE, type EnemyDefinition } from "../types.js";
import { ABILITY_BRUTAL } from "../abilities.js";
import { RESIST_ICE } from "../resistances.js";

export const ENEMY_GUNNERS = "gunners" as const;

export const GUNNERS: EnemyDefinition = {
  id: ENEMY_GUNNERS,
  name: "Gunners",
  color: ENEMY_COLOR_WHITE,
  attack: 6,
  attackElement: ELEMENT_FIRE,
  armor: 6,
  fame: 7,
  resistances: [RESIST_ICE],
  abilities: [ABILITY_BRUTAL],
};
