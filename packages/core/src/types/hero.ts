/**
 * Hero types and definitions for Mage Knight
 */

import type { CardId, SkillId, ManaColor } from "@mage-knight/shared";
import {
  BASIC_MANA_BLUE,
  BASIC_MANA_GREEN,
  BASIC_MANA_RED,
  BASIC_MANA_WHITE,
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
  CARD_CONCENTRATION,
  CARD_IMPROVISATION,
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
} from "@mage-knight/shared";

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

// Standard 16-card starting deck (before hero-specific replacements)
// Each hero replaces certain cards with their unique versions
const STANDARD_STARTING_DECK: readonly CardId[] = [
  // Combat (3)
  CARD_RAGE,
  CARD_RAGE,
  CARD_DETERMINATION,
  // Movement (6)
  CARD_SWIFTNESS,
  CARD_SWIFTNESS,
  CARD_MARCH,
  CARD_MARCH,
  CARD_STAMINA,
  CARD_STAMINA,
  // Influence (3)
  CARD_TRANQUILITY,
  CARD_PROMISE,
  CARD_THREATEN,
  // Mana/Special (4)
  CARD_CRYSTALLIZE,
  CARD_MANA_DRAW,
  CARD_CONCENTRATION,
  CARD_IMPROVISATION,
] as const;

/**
 * Replace first occurrence of a card in the deck with a replacement.
 */
function replaceCard(
  deck: readonly CardId[],
  toReplace: CardId,
  replacement: CardId
): CardId[] {
  const result = [...deck];
  const idx = result.indexOf(toReplace);
  if (idx !== -1) {
    result[idx] = replacement;
  }
  return result;
}

/**
 * Build a hero's starting deck by applying replacements to the standard deck.
 * Each hero has unique cards that replace specific standard cards.
 */
function buildStartingDeck(
  replacements: Array<{ replace: CardId; with: CardId }>
): CardId[] {
  let deck: CardId[] = [...STANDARD_STARTING_DECK];
  for (const { replace: toReplace, with: replacement } of replacements) {
    deck = replaceCard(deck, toReplace, replacement);
  }
  return deck;
}

// Hero definitions with starting decks
// Each hero starts with the standard 16-card deck but with hero-specific replacements
// Base game: Each hero replaces 1 card
// Expansion: Each hero replaces 1 additional card (2 total)
export const HEROES: Record<Hero, HeroDefinition> = {
  [Hero.Arythea]: {
    id: Hero.Arythea,
    name: "Arythea",
    // Base: Battle Versatility replaces Rage
    // Expansion: Mana Pull replaces Mana Draw
    startingCards: buildStartingDeck([
      { replace: CARD_RAGE, with: CARD_ARYTHEA_BATTLE_VERSATILITY },
      { replace: CARD_MANA_DRAW, with: CARD_ARYTHEA_MANA_PULL },
    ]),
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_RED, BASIC_MANA_RED, BASIC_MANA_WHITE],
  },
  [Hero.Tovak]: {
    id: Hero.Tovak,
    name: "Tovak",
    // Base: Cold Toughness replaces Determination
    // Expansion: Instinct replaces Improvisation
    startingCards: buildStartingDeck([
      { replace: CARD_DETERMINATION, with: CARD_TOVAK_COLD_TOUGHNESS },
      { replace: CARD_IMPROVISATION, with: CARD_TOVAK_INSTINCT },
    ]),
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_BLUE, BASIC_MANA_RED, BASIC_MANA_WHITE],
  },
  [Hero.Goldyx]: {
    id: Hero.Goldyx,
    name: "Goldyx",
    // Base: Will Focus replaces Concentration
    // Expansion: Crystal Joy replaces Crystallize
    startingCards: buildStartingDeck([
      { replace: CARD_CONCENTRATION, with: CARD_GOLDYX_WILL_FOCUS },
      { replace: CARD_CRYSTALLIZE, with: CARD_GOLDYX_CRYSTAL_JOY },
    ]),
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_BLUE, BASIC_MANA_BLUE, BASIC_MANA_WHITE],
  },
  [Hero.Norowas]: {
    id: Hero.Norowas,
    name: "Norowas",
    // Base: Noble Manners replaces Promise
    // Expansion: Rejuvenate replaces Tranquility
    startingCards: buildStartingDeck([
      { replace: CARD_PROMISE, with: CARD_NOROWAS_NOBLE_MANNERS },
      { replace: CARD_TRANQUILITY, with: CARD_NOROWAS_REJUVENATE },
    ]),
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_GREEN, BASIC_MANA_GREEN, BASIC_MANA_WHITE],
  },
  [Hero.Wolfhawk]: {
    id: Hero.Wolfhawk,
    name: "Wolfhawk",
    // Expansion only: Swift Reflexes replaces Swiftness, Tirelessness replaces Stamina
    startingCards: buildStartingDeck([
      { replace: CARD_SWIFTNESS, with: CARD_WOLFHAWK_SWIFT_REFLEXES },
      { replace: CARD_STAMINA, with: CARD_WOLFHAWK_TIRELESSNESS },
    ]),
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_GREEN, BASIC_MANA_WHITE, BASIC_MANA_WHITE],
  },
  [Hero.Krang]: {
    id: Hero.Krang,
    name: "Krang",
    // Expansion only: Savage Harvesting replaces March, Ruthless Coercion replaces Threaten
    startingCards: buildStartingDeck([
      { replace: CARD_MARCH, with: CARD_KRANG_SAVAGE_HARVESTING },
      { replace: CARD_THREATEN, with: CARD_KRANG_RUTHLESS_COERCION },
    ]),
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_RED, BASIC_MANA_GREEN, BASIC_MANA_WHITE],
  },
  [Hero.Braevalar]: {
    id: Hero.Braevalar,
    name: "Braevalar",
    // Expansion only: One With the Land replaces March, Druidic Paths replaces Stamina
    startingCards: buildStartingDeck([
      { replace: CARD_MARCH, with: CARD_BRAEVALAR_ONE_WITH_THE_LAND },
      { replace: CARD_STAMINA, with: CARD_BRAEVALAR_DRUIDIC_PATHS },
    ]),
    skills: [] as SkillId[],
    crystalColors: [BASIC_MANA_GREEN, BASIC_MANA_BLUE, BASIC_MANA_WHITE],
  },
};
