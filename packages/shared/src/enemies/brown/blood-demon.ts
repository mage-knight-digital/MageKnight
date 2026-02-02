import { ELEMENT_PHYSICAL } from "../../elements.js";
import {
  ABILITY_BRUTAL,
  ABILITY_ASSASSINATION,
  ABILITY_ARCANE_IMMUNITY,
} from "../abilities.js";
import { RESIST_FIRE } from "../resistances.js";
import {
  ENEMY_COLOR_BROWN,
  FACTION_DARK_CRUSADERS,
  type EnemyDefinition,
} from "../types.js";

export const ENEMY_BLOOD_DEMON = "blood_demon" as const;

export const BLOOD_DEMON: EnemyDefinition = {
  id: ENEMY_BLOOD_DEMON,
  name: "Blood Demon",
  color: ENEMY_COLOR_BROWN,
  attack: 6,
  attackElement: ELEMENT_PHYSICAL,
  armor: 6,
  fame: 5,
  resistances: [RESIST_FIRE],
  abilities: [ABILITY_BRUTAL, ABILITY_ASSASSINATION, ABILITY_ARCANE_IMMUNITY],
  faction: FACTION_DARK_CRUSADERS,
};
