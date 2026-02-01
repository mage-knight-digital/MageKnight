import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GRAY, type EnemyDefinition } from "../types.js";
import { ABILITY_SWIFT } from "../abilities.js";

export const ENEMY_CROSSBOWMEN = "crossbowmen" as const;

export const CROSSBOWMEN: EnemyDefinition = {
  id: ENEMY_CROSSBOWMEN,
  name: "Crossbowmen",
  color: ENEMY_COLOR_GRAY,
  attack: 4,
  attackElement: ELEMENT_PHYSICAL,
  armor: 4,
  fame: 3,
  resistances: [],
  abilities: [ABILITY_SWIFT],
};
