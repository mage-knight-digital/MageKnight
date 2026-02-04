import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ABILITY_BRUTAL, ABILITY_CUMBERSOME, ABILITY_FORTIFIED } from "../abilities.js";
import { RESIST_PHYSICAL } from "../resistances.js";
import { ENEMY_COLOR_BROWN, FACTION_ELEMENTALIST, type EnemyDefinition } from "../types.js";

export const ENEMY_EARTH_ELEMENTAL = "earth_elemental" as const;

export const EARTH_ELEMENTAL: EnemyDefinition = {
  id: ENEMY_EARTH_ELEMENTAL,
  name: "Earth Elemental",
  color: ENEMY_COLOR_BROWN,
  attack: 4,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 4,
  resistances: [RESIST_PHYSICAL],
  abilities: [ABILITY_FORTIFIED, ABILITY_CUMBERSOME, ABILITY_BRUTAL],
  faction: FACTION_ELEMENTALIST,
};
