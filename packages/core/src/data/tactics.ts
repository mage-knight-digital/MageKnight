/**
 * Tactic card definitions
 *
 * Each round, players select a tactic card. The number determines turn order
 * (lower = first). Some tactics have special effects.
 *
 * Effect types:
 * - none: No special effect, just determines turn order
 * - on_pick: Effect triggers immediately when selecting the tactic
 * - ongoing: Effect lasts for the entire round
 * - activated: One-time effect that can be used during the round (flip card to use)
 */

import {
  type TacticCard,
  type TacticId,
  TACTIC_EARLY_BIRD,
  TACTIC_RETHINK,
  TACTIC_MANA_STEAL,
  TACTIC_PLANNING,
  TACTIC_THE_RIGHT_MOMENT,
  TACTIC_GREAT_START,
  TACTIC_FROM_THE_DUSK,
  TACTIC_MIDNIGHT_MEDITATION,
  TACTIC_MANA_SEARCH,
  TACTIC_SPARING_POWER,
  TACTIC_LONG_NIGHT,
  TACTIC_PREPARATION,
  TACTIC_EFFECT_TYPE_NONE,
  TACTIC_EFFECT_TYPE_ON_PICK,
  TACTIC_EFFECT_TYPE_ONGOING,
  TACTIC_EFFECT_TYPE_ACTIVATED,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";

// === Day Tactics (1-6) ===

const EARLY_BIRD: TacticCard = {
  id: TACTIC_EARLY_BIRD,
  name: "Early Bird",
  turnOrder: 1,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_NONE,
  effectDescription: "No special effect. Go first this round.",
  implemented: true, // Turn order is implemented
};

const RETHINK: TacticCard = {
  id: TACTIC_RETHINK,
  name: "Rethink",
  turnOrder: 2,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_ON_PICK,
  effectDescription: "You may discard up to 3 cards from your hand (including Wounds). Shuffle your discard pile into your deck, then draw as many cards as you discarded.",
  implemented: false,
};

const MANA_STEAL: TacticCard = {
  id: TACTIC_MANA_STEAL,
  name: "Mana Steal",
  turnOrder: 3,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_ON_PICK,
  effectDescription: "Take a die from the Source and put it on this card. You may use it anytime during your turn. Return the die to the Source at end of your turn.",
  implemented: false,
};

const PLANNING: TacticCard = {
  id: TACTIC_PLANNING,
  name: "Planning",
  turnOrder: 4,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_ONGOING,
  effectDescription: "Your hand limit is increased by 1 this round, but only if you have at least 2 cards in your hand at the end of your turn.",
  implemented: false,
};

const GREAT_START: TacticCard = {
  id: TACTIC_GREAT_START,
  name: "Great Start",
  turnOrder: 5,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_ON_PICK,
  effectDescription: "Draw 2 cards.",
  implemented: false,
};

const THE_RIGHT_MOMENT: TacticCard = {
  id: TACTIC_THE_RIGHT_MOMENT,
  name: "The Right Moment",
  turnOrder: 6,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_ACTIVATED,
  effectDescription: "Flip this card to take another turn immediately after this one (cannot be used on your last turn of the round).",
  implemented: false,
};

// === Night Tactics (1-6) ===

const FROM_THE_DUSK: TacticCard = {
  id: TACTIC_FROM_THE_DUSK,
  name: "From the Dusk",
  turnOrder: 1,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_NONE,
  effectDescription: "No special effect. Go first this round.",
  implemented: true, // Turn order is implemented
};

const LONG_NIGHT: TacticCard = {
  id: TACTIC_LONG_NIGHT,
  name: "Long Night",
  turnOrder: 2,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ACTIVATED,
  effectDescription: "One time this Night, if your Deed deck is empty, you may shuffle your discard pile and put 3 cards at random back into your Deed deck. Then flip this card face down.",
  implemented: false,
};

const MANA_SEARCH: TacticCard = {
  id: TACTIC_MANA_SEARCH,
  name: "Mana Search",
  turnOrder: 3,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ONGOING,
  effectDescription: "Once during your turn, before taking a die from the Source, you may re-roll any or all dice in the Source.",
  implemented: false,
};

const MIDNIGHT_MEDITATION: TacticCard = {
  id: TACTIC_MIDNIGHT_MEDITATION,
  name: "Midnight Meditation",
  turnOrder: 4,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ACTIVATED,
  effectDescription: "One time this Night, before any of your turns, you may shuffle up to 5 cards (including Wounds) from your hand back into your Deed deck and then draw that many cards. Then flip this card face down.",
  implemented: false,
};

const PREPARATION: TacticCard = {
  id: TACTIC_PREPARATION,
  name: "Preparation",
  turnOrder: 5,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ON_PICK,
  effectDescription: "Search your Deed deck for any one card and put it in your hand, then shuffle your deck.",
  implemented: false,
};

const SPARING_POWER: TacticCard = {
  id: TACTIC_SPARING_POWER,
  name: "Sparing Power",
  turnOrder: 6,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ONGOING,
  effectDescription: "Once before the start of each of your turns, choose one: Put the top card of your Deed deck face down under this card, or flip this card face down and put all Deed cards under it into your hand.",
  implemented: false,
};

// === Exports ===

/**
 * All tactic cards indexed by ID
 */
export const TACTIC_CARDS: Readonly<Record<TacticId, TacticCard>> = {
  // Day tactics (1-6)
  [TACTIC_EARLY_BIRD]: EARLY_BIRD,
  [TACTIC_RETHINK]: RETHINK,
  [TACTIC_MANA_STEAL]: MANA_STEAL,
  [TACTIC_PLANNING]: PLANNING,
  [TACTIC_GREAT_START]: GREAT_START,
  [TACTIC_THE_RIGHT_MOMENT]: THE_RIGHT_MOMENT,
  // Night tactics (1-6)
  [TACTIC_FROM_THE_DUSK]: FROM_THE_DUSK,
  [TACTIC_LONG_NIGHT]: LONG_NIGHT,
  [TACTIC_MANA_SEARCH]: MANA_SEARCH,
  [TACTIC_MIDNIGHT_MEDITATION]: MIDNIGHT_MEDITATION,
  [TACTIC_PREPARATION]: PREPARATION,
  [TACTIC_SPARING_POWER]: SPARING_POWER,
};

/**
 * Get a tactic card by ID
 */
export function getTacticCard(id: TacticId): TacticCard {
  return TACTIC_CARDS[id];
}

/**
 * Get all tactic cards for a given time of day
 */
export function getTacticCardsForTimeOfDay(timeOfDay: "day" | "night"): readonly TacticCard[] {
  return Object.values(TACTIC_CARDS).filter(
    (card) => card.timeOfDay === timeOfDay
  );
}
