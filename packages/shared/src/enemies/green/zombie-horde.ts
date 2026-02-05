import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ABILITY_CUMBERSOME } from "../abilities.js";
import { ENEMY_COLOR_GREEN, FACTION_DARK_CRUSADERS, type EnemyDefinition } from "../types.js";
import { RESIST_ICE } from "../resistances.js";

export const ENEMY_ZOMBIE_HORDE = "zombie_horde" as const;

export const ZOMBIE_HORDE: EnemyDefinition = {
  id: ENEMY_ZOMBIE_HORDE,
  name: "Zombie Horde",
  color: ENEMY_COLOR_GREEN,
  attack: 0, // Multiple attacks - use attacks array
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 2,
  resistances: [RESIST_ICE],
  abilities: [ABILITY_CUMBERSOME],
  faction: FACTION_DARK_CRUSADERS,
  attacks: [
    { damage: 1, element: ELEMENT_PHYSICAL },
    { damage: 1, element: ELEMENT_PHYSICAL },
    { damage: 1, element: ELEMENT_PHYSICAL },
  ],
};
