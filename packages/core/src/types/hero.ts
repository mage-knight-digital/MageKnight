/**
 * Hero types and definitions for Mage Knight
 */

import type { CardId, SkillId, ManaColor } from "@mage-knight/shared";
import { BASIC_MANA_BLUE, BASIC_MANA_GREEN, BASIC_MANA_RED, BASIC_MANA_WHITE } from "@mage-knight/shared";
import {
  // Shared basic actions
  CARD_RAGE,
  CARD_DETERMINATION,
  CARD_SWIFTNESS,
  CARD_MARCH,
  CARD_STAMINA,
  CARD_TRANQUILITY,
  CARD_PROMISE,
  CARD_THREATEN,
  CARD_CRYSTALLIZE,
  CARD_MANA_DRAW,
  // Hero-specific cards
  CARD_ARYTHEA_BATTLE_VERSATILITY,
  CARD_ARYTHEA_MANA_PULL,
  CARD_GOLDYX_CRYSTAL_JOY,
  CARD_GOLDYX_WILL_FOCUS,
  CARD_NOROWAS_NOBLE_MANNERS,
  CARD_NOROWAS_REJUVENATE,
  CARD_TOVAK_COLD_TOUGHNESS,
  CARD_TOVAK_INSTINCT,
  CARD_WOLFHAWK_SWIFT_REFLEXES,
  CARD_WOLFHAWK_TIRELESSNESS,
  CARD_KRANG_SAVAGE_HARVESTING,
  CARD_KRANG_RUTHLESS_COERCION,
  CARD_BRAEVALAR_DRUIDIC_PATHS,
  CARD_BRAEVALAR_ONE_WITH_THE_LAND,
} from "./cardIds.js";

export enum Hero {
  Arythea = "arythea",
  Tovak = "tovak",
  Goldyx = "goldyx",
  Norowas = "norowas",
  // Lost Legion expansion heroes
  Wolfhawk = "wolfhawk",
  Krang = "krang",
  // Shades of Tezla expansion hero
  Braevalar = "braevalar",
}

export interface HeroDefinition {
  readonly id: Hero;
  readonly name: string;
  readonly startingCards: readonly CardId[];
  readonly skills: readonly SkillId[];
  readonly crystalColors: readonly [ManaColor, ManaColor, ManaColor]; // for dummy player
}

// Shared basic action cards (14 cards in every starting deck)
// Each hero gets these 14 cards plus 2 hero-specific cards = 16 total
// The card inventory lists these as the "standard cards shared by all heroes"
const SHARED_BASIC_ACTIONS: readonly CardId[] = [
  // Combat
  CARD_RAGE,
  CARD_RAGE,
  CARD_DETERMINATION,
  // Movement
  CARD_SWIFTNESS,
  CARD_SWIFTNESS,
  CARD_MARCH,
  CARD_MARCH,
  CARD_STAMINA,
  CARD_STAMINA,
  // Healing/Influence
  CARD_TRANQUILITY,
  CARD_PROMISE,
  CARD_THREATEN,
  // Mana/Special
  CARD_CRYSTALLIZE,
  CARD_MANA_DRAW,
] as const;

// Hero definitions with starting decks (14 shared + 2 hero-specific = 16 cards)
export const HEROES: Record<Hero, HeroDefinition> = {
  [Hero.Arythea]: {
    id: Hero.Arythea,
    name: "Arythea",
    startingCards: [
      ...SHARED_BASIC_ACTIONS,
      CARD_ARYTHEA_BATTLE_VERSATILITY,
      CARD_ARYTHEA_MANA_PULL,
    ],
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_RED, BASIC_MANA_RED, BASIC_MANA_WHITE],
  },
  [Hero.Tovak]: {
    id: Hero.Tovak,
    name: "Tovak",
    startingCards: [
      ...SHARED_BASIC_ACTIONS,
      CARD_TOVAK_COLD_TOUGHNESS,
      CARD_TOVAK_INSTINCT,
    ],
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_BLUE, BASIC_MANA_RED, BASIC_MANA_WHITE],
  },
  [Hero.Goldyx]: {
    id: Hero.Goldyx,
    name: "Goldyx",
    startingCards: [
      ...SHARED_BASIC_ACTIONS,
      CARD_GOLDYX_CRYSTAL_JOY,
      CARD_GOLDYX_WILL_FOCUS,
    ],
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_BLUE, BASIC_MANA_BLUE, BASIC_MANA_WHITE],
  },
  [Hero.Norowas]: {
    id: Hero.Norowas,
    name: "Norowas",
    startingCards: [
      ...SHARED_BASIC_ACTIONS,
      CARD_NOROWAS_NOBLE_MANNERS,
      CARD_NOROWAS_REJUVENATE,
    ],
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_GREEN, BASIC_MANA_GREEN, BASIC_MANA_WHITE],
  },
  [Hero.Wolfhawk]: {
    id: Hero.Wolfhawk,
    name: "Wolfhawk",
    startingCards: [
      ...SHARED_BASIC_ACTIONS,
      CARD_WOLFHAWK_SWIFT_REFLEXES,
      CARD_WOLFHAWK_TIRELESSNESS,
    ],
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_GREEN, BASIC_MANA_WHITE, BASIC_MANA_WHITE],
  },
  [Hero.Krang]: {
    id: Hero.Krang,
    name: "Krang",
    startingCards: [
      ...SHARED_BASIC_ACTIONS,
      CARD_KRANG_SAVAGE_HARVESTING,
      CARD_KRANG_RUTHLESS_COERCION,
    ],
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_RED, BASIC_MANA_GREEN, BASIC_MANA_WHITE],
  },
  [Hero.Braevalar]: {
    id: Hero.Braevalar,
    name: "Braevalar",
    startingCards: [
      ...SHARED_BASIC_ACTIONS,
      CARD_BRAEVALAR_DRUIDIC_PATHS,
      CARD_BRAEVALAR_ONE_WITH_THE_LAND,
    ],
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_GREEN, BASIC_MANA_BLUE, BASIC_MANA_WHITE],
  },
};
