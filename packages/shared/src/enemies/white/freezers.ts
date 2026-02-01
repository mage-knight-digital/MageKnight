import { ELEMENT_ICE } from "../../elements.js";
import { ENEMY_COLOR_WHITE, type EnemyDefinition } from "../types.js";
import { ABILITY_PARALYZE, ABILITY_SWIFT } from "../abilities.js";
import { RESIST_FIRE } from "../resistances.js";

export const ENEMY_FREEZERS = "freezers" as const;

export const FREEZERS: EnemyDefinition = {
  id: ENEMY_FREEZERS,
  name: "Freezers",
  color: ENEMY_COLOR_WHITE,
  attack: 3,
  attackElement: ELEMENT_ICE,
  armor: 7,
  fame: 7,
  resistances: [RESIST_FIRE],
  abilities: [ABILITY_PARALYZE, ABILITY_SWIFT],
};
