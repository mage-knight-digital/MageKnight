import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ABILITY_DEFEND } from "../abilities.js";
import { RESIST_FIRE } from "../resistances.js";
import { ENEMY_COLOR_GREEN, FACTION_ELEMENTALIST, type EnemyDefinition } from "../types.js";

export const ENEMY_ELVEN_PROTECTORS = "elven_protectors" as const;

export const ELVEN_PROTECTORS: EnemyDefinition = {
  id: ENEMY_ELVEN_PROTECTORS,
  name: "Elven Protectors",
  color: ENEMY_COLOR_GREEN,
  attack: 3,
  attackElement: ELEMENT_PHYSICAL,
  armor: 4,
  fame: 2,
  resistances: [RESIST_FIRE],
  abilities: [ABILITY_DEFEND],
  faction: FACTION_ELEMENTALIST,
  defend: 2, // Defend(2)
};
