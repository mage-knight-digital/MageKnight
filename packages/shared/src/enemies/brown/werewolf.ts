import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_BROWN, type EnemyDefinition } from "../types.js";
import { ABILITY_SWIFT } from "../abilities.js";

export const ENEMY_WEREWOLF = "werewolf" as const;

export const WEREWOLF: EnemyDefinition = {
  id: ENEMY_WEREWOLF,
  name: "Werewolf",
  color: ENEMY_COLOR_BROWN,
  attack: 7,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 5,
  resistances: [],
  abilities: [ABILITY_SWIFT],
};
