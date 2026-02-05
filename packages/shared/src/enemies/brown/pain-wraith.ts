import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ABILITY_ELUSIVE, ABILITY_PARALYZE } from "../abilities.js";
import {
  ENEMY_COLOR_BROWN,
  FACTION_DARK_CRUSADERS,
  type EnemyDefinition,
} from "../types.js";

export const ENEMY_PAIN_WRAITH = "pain_wraith" as const;

export const PAIN_WRAITH: EnemyDefinition = {
  id: ENEMY_PAIN_WRAITH,
  name: "Pain Wraith",
  color: ENEMY_COLOR_BROWN,
  attack: 4,
  attackElement: ELEMENT_PHYSICAL,
  armor: 4,
  armorElusive: 8, // Elusive: uses 8 normally, 4 if all attacks blocked
  fame: 3,
  resistances: [],
  abilities: [ABILITY_ELUSIVE, ABILITY_PARALYZE],
  faction: FACTION_DARK_CRUSADERS,
};
