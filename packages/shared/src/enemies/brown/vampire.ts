import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ABILITY_ELUSIVE, ABILITY_VAMPIRIC } from "../abilities.js";
import {
  ENEMY_COLOR_BROWN,
  FACTION_DARK_CRUSADERS,
  type EnemyDefinition,
} from "../types.js";

export const ENEMY_VAMPIRE = "vampire" as const;

export const VAMPIRE: EnemyDefinition = {
  id: ENEMY_VAMPIRE,
  name: "Vampire",
  color: ENEMY_COLOR_BROWN,
  attack: 5,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  armorElusive: 10, // Elusive: uses 10 normally, 5 if all attacks blocked
  fame: 4,
  resistances: [],
  abilities: [ABILITY_ELUSIVE, ABILITY_VAMPIRIC],
  faction: FACTION_DARK_CRUSADERS,
};
