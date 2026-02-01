import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, type EnemyDefinition } from "../types.js";
import { ABILITY_UNFORTIFIED, ABILITY_BRUTAL } from "../abilities.js";
import { RESIST_FIRE, RESIST_ICE } from "../resistances.js";

export const ENEMY_ORC_WAR_BEASTS = "orc_war_beasts" as const;

export const ORC_WAR_BEASTS: EnemyDefinition = {
  id: ENEMY_ORC_WAR_BEASTS,
  name: "Orc War Beasts",
  color: ENEMY_COLOR_GREEN,
  attack: 3,
  attackElement: ELEMENT_PHYSICAL,
  armor: 5,
  fame: 3,
  resistances: [RESIST_FIRE, RESIST_ICE],
  abilities: [ABILITY_UNFORTIFIED, ABILITY_BRUTAL],
};
