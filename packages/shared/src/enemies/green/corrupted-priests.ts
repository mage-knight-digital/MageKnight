import { ELEMENT_COLD_FIRE } from "../../elements.js";
import { ABILITY_DEFEND } from "../abilities.js";
import { ENEMY_COLOR_GREEN, FACTION_DARK_CRUSADERS, type EnemyDefinition } from "../types.js";

export const ENEMY_CORRUPTED_PRIESTS = "corrupted_priests" as const;

export const CORRUPTED_PRIESTS: EnemyDefinition = {
  id: ENEMY_CORRUPTED_PRIESTS,
  name: "Corrupted Priests",
  color: ENEMY_COLOR_GREEN,
  attack: 4,
  attackElement: ELEMENT_COLD_FIRE,
  armor: 5,
  fame: 3,
  resistances: [],
  abilities: [ABILITY_DEFEND],
  faction: FACTION_DARK_CRUSADERS,
  defend: 1, // Defend(1)
};
