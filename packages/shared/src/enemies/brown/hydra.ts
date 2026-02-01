import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_BROWN, type EnemyDefinition } from "../types.js";
import { RESIST_ICE } from "../resistances.js";

export const ENEMY_HYDRA = "hydra" as const;

export const HYDRA: EnemyDefinition = {
  id: ENEMY_HYDRA,
  name: "Hydra",
  color: ENEMY_COLOR_BROWN,
  attack: 2,
  attackElement: ELEMENT_PHYSICAL,
  armor: 6,
  fame: 5,
  resistances: [RESIST_ICE],
  abilities: [],
  attacks: [
    { damage: 2, element: ELEMENT_PHYSICAL },
    { damage: 2, element: ELEMENT_PHYSICAL },
    { damage: 2, element: ELEMENT_PHYSICAL },
  ],
};
