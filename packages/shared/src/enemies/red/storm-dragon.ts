import { ELEMENT_ICE } from "../../elements.js";
import { ABILITY_ELUSIVE, ABILITY_SWIFT } from "../abilities.js";
import {
  ENEMY_COLOR_RED,
  FACTION_ELEMENTALIST,
  type EnemyDefinition,
} from "../types.js";
import { RESIST_ICE } from "../resistances.js";

export const ENEMY_STORM_DRAGON = "storm_dragon" as const;

export const STORM_DRAGON: EnemyDefinition = {
  id: ENEMY_STORM_DRAGON,
  name: "Storm Dragon",
  color: ENEMY_COLOR_RED,
  attack: 4,
  attackElement: ELEMENT_ICE,
  armor: 7,
  armorElusive: 14, // Elusive: uses 14 normally, 7 if all attacks blocked
  fame: 7,
  resistances: [RESIST_ICE],
  abilities: [ABILITY_ELUSIVE, ABILITY_SWIFT],
  faction: FACTION_ELEMENTALIST,
};
