import { ELEMENT_COLD_FIRE } from "../../elements.js";
import { ABILITY_ELUSIVE, ABILITY_SWIFT } from "../abilities.js";
import { RESIST_FIRE, RESIST_ICE } from "../resistances.js";
import { ENEMY_COLOR_BROWN, FACTION_ELEMENTALIST, type EnemyDefinition } from "../types.js";

export const ENEMY_AIR_ELEMENTAL = "air_elemental" as const;

export const AIR_ELEMENTAL: EnemyDefinition = {
  id: ENEMY_AIR_ELEMENTAL,
  name: "Air Elemental",
  color: ENEMY_COLOR_BROWN,
  attack: 3,
  attackElement: ELEMENT_COLD_FIRE,
  armor: 4,
  armorElusive: 8, // Elusive: uses 8 normally, 4 if all attacks blocked
  fame: 4,
  resistances: [RESIST_FIRE, RESIST_ICE],
  abilities: [ABILITY_SWIFT, ABILITY_ELUSIVE],
  faction: FACTION_ELEMENTALIST,
};
