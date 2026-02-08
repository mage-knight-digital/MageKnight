/**
 * Dummy Player Helpers
 *
 * Pure functions for creating and simulating the solo-mode dummy player.
 * The dummy player flips 3 cards per turn from its deck, with bonus flips
 * when the last card's color matches one of its crystals.
 */

import type { CardId, BasicManaColor, HeroId } from "@mage-knight/shared";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import type { DummyPlayer, PrecomputedDummyTurn } from "../../types/dummyPlayer.js";
import type { RngState } from "../../utils/rng.js";
import { shuffleWithRng, randomElement } from "../../utils/rng.js";
import { HEROES, Hero } from "../../types/hero.js";
import { getActionCardColor } from "./cardColor.js";
import type { BasicCardColor } from "../../types/effectTypes.js";

/** Base number of cards flipped per dummy turn */
const DUMMY_CARDS_PER_TURN = 3;

/**
 * Map a BasicCardColor to a BasicManaColor.
 * Both have the same string values so this is a safe cast.
 */
function cardColorToManaColor(color: BasicCardColor): BasicManaColor {
  return color as BasicManaColor;
}

/**
 * Select a random hero not already chosen by a human player.
 */
export function selectDummyHero(
  usedHeroIds: readonly HeroId[],
  rng: RngState
): { heroId: HeroId; rng: RngState } {
  const allHeroes = Object.values(Hero) as HeroId[];
  const available = allHeroes.filter((h) => !usedHeroIds.includes(h));
  const { value, rng: newRng } = randomElement(available, rng);
  return { heroId: value as HeroId, rng: newRng };
}

/**
 * Create a fresh dummy player from a hero definition.
 * Builds the starting deck and initial crystal inventory, then shuffles.
 */
export function createDummyPlayer(
  heroId: HeroId,
  rng: RngState
): { dummyPlayer: DummyPlayer; rng: RngState } {
  const hero = HEROES[heroId as Hero];

  // Build crystal inventory from hero's 3 starting crystal colors
  const crystals: Record<BasicManaColor, number> = {
    [MANA_RED]: 0,
    [MANA_BLUE]: 0,
    [MANA_GREEN]: 0,
    [MANA_WHITE]: 0,
  };
  for (const color of hero.crystalColors) {
    // hero.crystalColors are ManaColor but always basic for crystals
    const basicColor = color as BasicManaColor;
    crystals[basicColor] = (crystals[basicColor] ?? 0) + 1;
  }

  // Shuffle the starting deck
  const { result: shuffledDeck, rng: rngAfterShuffle } = shuffleWithRng(
    hero.startingCards,
    rng
  );

  const dummyPlayer: DummyPlayer = {
    heroId,
    deck: shuffledDeck,
    discard: [],
    crystals,
    precomputedTurns: [],
    currentTurnIndex: 0,
  };

  // Pre-compute turns for the first round
  const withTurns: DummyPlayer = {
    ...dummyPlayer,
    precomputedTurns: precomputeDummyTurns(dummyPlayer),
  };

  return { dummyPlayer: withTurns, rng: rngAfterShuffle };
}

/**
 * Simulate all dummy turns for a round (deterministic once deck is shuffled).
 *
 * Each turn the dummy flips 3 cards. If the last card's color matches one of
 * its crystals, bonus cards equal to that crystal count are flipped.
 */
export function precomputeDummyTurns(
  dummy: DummyPlayer
): PrecomputedDummyTurn[] {
  const turns: PrecomputedDummyTurn[] = [];
  let remaining = [...dummy.deck];

  while (remaining.length > 0) {
    // Flip up to 3 base cards
    const baseFlip = Math.min(DUMMY_CARDS_PER_TURN, remaining.length);
    const flipped = remaining.splice(0, baseFlip);

    // Check the last flipped card for crystal color match
    const lastCard = flipped[flipped.length - 1];
    let bonusFlipped = 0;
    let matchedColor: BasicManaColor | null = null;

    if (lastCard) {
      const cardColor = getActionCardColor(lastCard);
      if (cardColor !== null) {
        const manaColor = cardColorToManaColor(cardColor);
        const crystalCount = dummy.crystals[manaColor] ?? 0;
        if (crystalCount > 0) {
          matchedColor = manaColor;
          bonusFlipped = Math.min(crystalCount, remaining.length);
          remaining.splice(0, bonusFlipped);
        }
      }
    }

    turns.push({
      cardsFlipped: baseFlip,
      bonusFlipped,
      matchedColor,
      deckRemainingAfter: remaining.length,
    });
  }

  return turns;
}

/**
 * Compute the estimated turn range for the dummy player.
 *
 * max = ceil(deckSize / 3) — no crystal bonuses
 * min = accounts for maximum crystal bonus each turn
 */
export function computeDummyTurnRange(
  deckSize: number,
  crystals: Readonly<Record<BasicManaColor, number>>
): { min: number; max: number } {
  if (deckSize <= 0) return { min: 0, max: 0 };

  const max = Math.ceil(deckSize / DUMMY_CARDS_PER_TURN);

  // Maximum possible crystal bonus per turn = max crystal count across all colors
  const maxCrystalBonus = Math.max(
    crystals[MANA_RED] ?? 0,
    crystals[MANA_BLUE] ?? 0,
    crystals[MANA_GREEN] ?? 0,
    crystals[MANA_WHITE] ?? 0,
  );

  const cardsPerTurnWithBonus = DUMMY_CARDS_PER_TURN + maxCrystalBonus;
  const min = Math.ceil(deckSize / cardsPerTurnWithBonus);

  return { min, max };
}

/**
 * Execute one pre-computed dummy turn: advance the index and move cards
 * from deck to discard for state consistency.
 */
export function executeDummyTurn(
  dummy: DummyPlayer
): { dummy: DummyPlayer; turn: PrecomputedDummyTurn | null } {
  const turn = dummy.precomputedTurns[dummy.currentTurnIndex];
  if (!turn) {
    return { dummy, turn: null };
  }

  const totalCards = turn.cardsFlipped + turn.bonusFlipped;
  const movedCards = dummy.deck.slice(0, totalCards);
  const remainingDeck = dummy.deck.slice(totalCards);

  return {
    dummy: {
      ...dummy,
      deck: remainingDeck,
      discard: [...dummy.discard, ...movedCards],
      currentTurnIndex: dummy.currentTurnIndex + 1,
    },
    turn,
  };
}

/**
 * Prepare the dummy player for a new round:
 * - Combine deck + discard
 * - Shuffle
 * - Pre-compute turns
 * - Reset turn index
 */
export function resetDummyForNewRound(
  dummy: DummyPlayer,
  rng: RngState
): { dummy: DummyPlayer; rng: RngState } {
  const allCards: CardId[] = [...dummy.deck, ...dummy.discard];
  const { result: shuffledDeck, rng: newRng } = shuffleWithRng(allCards, rng);

  const reset: DummyPlayer = {
    ...dummy,
    deck: shuffledDeck,
    discard: [],
    currentTurnIndex: 0,
    precomputedTurns: [],
  };

  return {
    dummy: {
      ...reset,
      precomputedTurns: precomputeDummyTurns(reset),
    },
    rng: newRng,
  };
}
