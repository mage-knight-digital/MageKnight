import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ABILITY_VAMPIRIC } from "../abilities.js";
import { ENEMY_COLOR_GREEN, FACTION_DARK_CRUSADERS, type EnemyDefinition } from "../types.js";

export const ENEMY_GIBBERING_GHOULS = "gibbering_ghouls" as const;

export const GIBBERING_GHOULS: EnemyDefinition = {
  id: ENEMY_GIBBERING_GHOULS,
  name: "Gibbering Ghouls",
  color: ENEMY_COLOR_GREEN,
  attack: 4,
  attackElement: ELEMENT_PHYSICAL,
  armor: 4,
  fame: 2,
  resistances: [],
  abilities: [ABILITY_VAMPIRIC],
  faction: FACTION_DARK_CRUSADERS,
};
