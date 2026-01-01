/**
 * Hero types and definitions for Mage Knight
 */

import type { CardId, SkillId, ManaColor } from "@mage-knight/shared";

export enum Hero {
  Arythea = "arythea",
  Tovak = "tovak",
  Goldyx = "goldyx",
  Norowas = "norowas",
  // Krang expansion heroes
  Wolfhawk = "wolfhawk",
  Braevalar = "braevalar",
}

export interface HeroDefinition {
  readonly id: Hero;
  readonly name: string;
  readonly startingCards: readonly CardId[];
  readonly skills: readonly SkillId[];
  readonly crystalColors: readonly [ManaColor, ManaColor, ManaColor]; // for dummy player
}

// Hero definitions will be populated when cards/skills are defined
export const HEROES: Record<Hero, HeroDefinition> = {
  [Hero.Arythea]: {
    id: Hero.Arythea,
    name: "Arythea",
    startingCards: [] as CardId[],
    skills: [] as SkillId[],
    crystalColors: ["red", "red", "white"],
  },
  [Hero.Tovak]: {
    id: Hero.Tovak,
    name: "Tovak",
    startingCards: [] as CardId[],
    skills: [] as SkillId[],
    crystalColors: ["blue", "red", "white"],
  },
  [Hero.Goldyx]: {
    id: Hero.Goldyx,
    name: "Goldyx",
    startingCards: [] as CardId[],
    skills: [] as SkillId[],
    crystalColors: ["blue", "blue", "white"],
  },
  [Hero.Norowas]: {
    id: Hero.Norowas,
    name: "Norowas",
    startingCards: [] as CardId[],
    skills: [] as SkillId[],
    crystalColors: ["green", "green", "white"],
  },
  [Hero.Wolfhawk]: {
    id: Hero.Wolfhawk,
    name: "Wolfhawk",
    startingCards: [] as CardId[],
    skills: [] as SkillId[],
    crystalColors: ["green", "white", "white"],
  },
  [Hero.Braevalar]: {
    id: Hero.Braevalar,
    name: "Braevalar",
    startingCards: [] as CardId[],
    skills: [] as SkillId[],
    crystalColors: ["green", "blue", "white"],
  },
};
