import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ABILITY_ELUSIVE, ABILITY_VAMPIRIC } from "../abilities.js";
import {
  ENEMY_COLOR_RED,
  FACTION_DARK_CRUSADERS,
  type EnemyDefinition,
} from "../types.js";

export const ENEMY_VAMPIRE_DRAGON = "vampire_dragon" as const;

export const VAMPIRE_DRAGON: EnemyDefinition = {
  id: ENEMY_VAMPIRE_DRAGON,
  name: "Vampire Dragon",
  color: ENEMY_COLOR_RED,
  attack: 8,
  attackElement: ELEMENT_PHYSICAL,
  armor: 8,
  armorElusive: 16, // Elusive: uses 16 normally, 8 if all attacks blocked
  fame: 7,
  resistances: [],
  abilities: [ABILITY_ELUSIVE, ABILITY_VAMPIRIC],
  faction: FACTION_DARK_CRUSADERS,
};
