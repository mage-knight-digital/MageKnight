import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, FACTION_DARK_CRUSADERS, type EnemyDefinition } from "../types.js";
import { ABILITY_FORTIFIED, ABILITY_SUMMON_GREEN } from "../abilities.js";

export const ENEMY_SHROUDED_NECROMANCERS = "shrouded_necromancers" as const;

export const SHROUDED_NECROMANCERS: EnemyDefinition = {
  id: ENEMY_SHROUDED_NECROMANCERS,
  name: "Shrouded Necromancers",
  color: ENEMY_COLOR_GREEN,
  attack: 0, // Summoners don't attack directly
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 3,
  resistances: [],
  abilities: [ABILITY_FORTIFIED, ABILITY_SUMMON_GREEN], // Summons green enemy
  faction: FACTION_DARK_CRUSADERS,
};
