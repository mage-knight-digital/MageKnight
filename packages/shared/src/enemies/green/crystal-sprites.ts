import { ELEMENT_ICE } from "../../elements.js";
import { ABILITY_DEFEND, ABILITY_ELUSIVE } from "../abilities.js";
import { RESIST_ICE } from "../resistances.js";
import { ENEMY_COLOR_GREEN, FACTION_ELEMENTALIST, type EnemyDefinition } from "../types.js";

export const ENEMY_CRYSTAL_SPRITES = "crystal_sprites" as const;

export const CRYSTAL_SPRITES: EnemyDefinition = {
  id: ENEMY_CRYSTAL_SPRITES,
  name: "Crystal Sprites",
  color: ENEMY_COLOR_GREEN,
  attack: 1,
  attackElement: ELEMENT_ICE,
  armor: 1,
  armorElusive: 2,
  fame: 1,
  resistances: [RESIST_ICE],
  abilities: [ABILITY_ELUSIVE, ABILITY_DEFEND],
  faction: FACTION_ELEMENTALIST,
  defend: 1,
};
