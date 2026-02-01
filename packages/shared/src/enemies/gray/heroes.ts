import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GRAY, type EnemyDefinition } from "../types.js";
import { ABILITY_FORTIFIED } from "../abilities.js";

export const ENEMY_HEROES = "heroes" as const;

export const HEROES: EnemyDefinition = {
  id: ENEMY_HEROES,
  name: "Heroes",
  color: ENEMY_COLOR_GRAY,
  attack: 5,
  attackElement: ELEMENT_PHYSICAL,
  armor: 4,
  fame: 5,
  resistances: [],
  abilities: [ABILITY_FORTIFIED],
  attacks: [
    { damage: 5, element: ELEMENT_PHYSICAL },
    { damage: 3, element: ELEMENT_PHYSICAL },
  ],
  reputationPenalty: 1,
};
