import { ELEMENT_FIRE, ELEMENT_ICE, ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, FACTION_ELEMENTALIST, type EnemyDefinition } from "../types.js";
import { RESIST_FIRE, RESIST_ICE } from "../resistances.js";

export const ENEMY_ELEMENTAL_PRIESTS = "elemental_priests" as const;

export const ELEMENTAL_PRIESTS: EnemyDefinition = {
  id: ENEMY_ELEMENTAL_PRIESTS,
  name: "Elemental Priests",
  color: ENEMY_COLOR_GREEN,
  attack: 0, // Multiple attacks - use attacks array
  attackElement: ELEMENT_PHYSICAL,
  armor: 4,
  fame: 3,
  resistances: [RESIST_FIRE, RESIST_ICE],
  abilities: [],
  faction: FACTION_ELEMENTALIST,
  attacks: [
    { damage: 3, element: ELEMENT_FIRE },
    { damage: 3, element: ELEMENT_ICE },
  ],
};
