import { ELEMENT_COLD_FIRE } from "../../elements.js";
import { ABILITY_ELUSIVE } from "../abilities.js";
import {
  ENEMY_COLOR_RED,
  FACTION_ELEMENTALIST,
  type EnemyDefinition,
} from "../types.js";
import { RESIST_FIRE, RESIST_ICE } from "../resistances.js";

export const ENEMY_LIGHTNING_DRAGON = "lightning_dragon" as const;

export const LIGHTNING_DRAGON: EnemyDefinition = {
  id: ENEMY_LIGHTNING_DRAGON,
  name: "Lightning Dragon",
  color: ENEMY_COLOR_RED,
  attack: 6,
  attackElement: ELEMENT_COLD_FIRE,
  armor: 7,
  armorElusive: 14, // Elusive: uses 14 normally, 7 if all attacks blocked
  fame: 7,
  resistances: [RESIST_FIRE, RESIST_ICE],
  abilities: [ABILITY_ELUSIVE],
  faction: FACTION_ELEMENTALIST,
};
