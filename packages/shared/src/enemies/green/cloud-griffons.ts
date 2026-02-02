import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_GREEN, FACTION_ELEMENTALIST, type EnemyDefinition } from "../types.js";
import { ABILITY_ELUSIVE, ABILITY_SWIFT, ABILITY_UNFORTIFIED } from "../abilities.js";

export const ENEMY_CLOUD_GRIFFONS = "cloud_griffons" as const;

export const CLOUD_GRIFFONS: EnemyDefinition = {
  id: ENEMY_CLOUD_GRIFFONS,
  name: "Cloud Griffons",
  color: ENEMY_COLOR_GREEN,
  attack: 4,
  attackElement: ELEMENT_PHYSICAL,
  armor: 4,
  fame: 3,
  resistances: [],
  abilities: [ABILITY_UNFORTIFIED, ABILITY_SWIFT, ABILITY_ELUSIVE],
  faction: FACTION_ELEMENTALIST,
};
