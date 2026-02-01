import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_VIOLET, type EnemyDefinition } from "../types.js";
import { ABILITY_UNFORTIFIED, ABILITY_BRUTAL } from "../abilities.js";

export const ENEMY_MAGIC_FAMILIARS = "magic_familiars" as const;

export const MAGIC_FAMILIARS: EnemyDefinition = {
  id: ENEMY_MAGIC_FAMILIARS,
  name: "Magic Familiars",
  color: ENEMY_COLOR_VIOLET,
  attack: 3, // Legacy field (first attack value)
  attackElement: ELEMENT_PHYSICAL,
  armor: 7,
  fame: 5,
  resistances: [],
  abilities: [ABILITY_UNFORTIFIED, ABILITY_BRUTAL],
  attacks: [
    { damage: 3, element: ELEMENT_PHYSICAL },
    { damage: 3, element: ELEMENT_PHYSICAL },
  ],
};
