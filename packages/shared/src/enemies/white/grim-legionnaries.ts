import { ELEMENT_PHYSICAL } from "../../elements.js";
import { ENEMY_COLOR_WHITE, type EnemyDefinition } from "../types.js";
import { ABILITY_UNFORTIFIED, ABILITY_ARCANE_IMMUNITY } from "../abilities.js";

export const ENEMY_GRIM_LEGIONNARIES = "grim_legionnaries" as const;

export const GRIM_LEGIONNARIES: EnemyDefinition = {
  id: ENEMY_GRIM_LEGIONNARIES,
  name: "Grim Legionnaries",
  color: ENEMY_COLOR_WHITE,
  attack: 11,
  attackElement: ELEMENT_PHYSICAL,
  armor: 10,
  fame: 8,
  resistances: [],
  abilities: [ABILITY_UNFORTIFIED, ABILITY_ARCANE_IMMUNITY],
};
