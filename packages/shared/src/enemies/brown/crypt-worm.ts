import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_BROWN, type EnemyDefinition } from "../types.js";
import { ABILITY_FORTIFIED } from "../abilities.js";

export const ENEMY_CRYPT_WORM = "crypt_worm" as const;

export const CRYPT_WORM: EnemyDefinition = {
  id: ENEMY_CRYPT_WORM,
  name: "Crypt Worm",
  color: ENEMY_COLOR_BROWN,
  attack: 6,
  attackElement: ELEMENT_PHYSICAL,
  armor: 6,
  fame: 5,
  resistances: [],
  abilities: [ABILITY_FORTIFIED],
};
