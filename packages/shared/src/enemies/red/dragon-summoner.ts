import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_RED, type EnemyDefinition } from "../types.js";
import { RESIST_PHYSICAL } from "../resistances.js";
import { ABILITY_ARCANE_IMMUNITY, ABILITY_SUMMON } from "../abilities.js";

export const ENEMY_DRAGON_SUMMONER = "dragon_summoner" as const;

/**
 * Dragon Summoner - A powerful Draconum that summons two brown dungeon enemies.
 *
 * Per FAQ: "DRAGON SUMMONERS draws two MONSTER tokens and uses the attack
 * of each MONSTER token once; it doesn't draw one MONSTER token and use
 * its attack twice."
 *
 * Each attack has ABILITY_SUMMON, resulting in two separate summons.
 */
export const DRAGON_SUMMONER: EnemyDefinition = {
  id: ENEMY_DRAGON_SUMMONER,
  name: "Dragon Summoner",
  color: ENEMY_COLOR_RED,
  attack: 0, // Multiple attacks - use attacks array
  attackElement: ELEMENT_PHYSICAL,
  armor: 8,
  fame: 9,
  resistances: [RESIST_PHYSICAL],
  abilities: [ABILITY_ARCANE_IMMUNITY],
  attacks: [
    { damage: 0, element: ELEMENT_PHYSICAL, ability: ABILITY_SUMMON },
    { damage: 0, element: ELEMENT_PHYSICAL, ability: ABILITY_SUMMON },
  ],
};
