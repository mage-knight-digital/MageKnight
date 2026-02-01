import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_RED, FACTION_DARK_CRUSADERS, type EnemyDefinition } from "../types.js";
import { ABILITY_ASSASSINATION, ABILITY_PARALYZE } from "../abilities.js";

export const ENEMY_DEATH_DRAGON = "death_dragon" as const;

export const DEATH_DRAGON: EnemyDefinition = {
  id: ENEMY_DEATH_DRAGON,
  name: "Death Dragon",
  color: ENEMY_COLOR_RED,
  attack: 7,
  attackElement: ELEMENT_PHYSICAL,
  armor: 9,
  fame: 6,
  resistances: [],
  abilities: [ABILITY_ASSASSINATION, ABILITY_PARALYZE],
  faction: FACTION_DARK_CRUSADERS,
};
