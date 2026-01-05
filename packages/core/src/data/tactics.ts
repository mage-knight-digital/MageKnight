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
  TACTIC_GREAT_START_NIGHT,
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
  effectDescription: "Discard any number of non-Wound cards from hand, then draw that many cards.",
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
  effectDescription: "Your hand limit is increased by 1 this round.",
  implemented: false,
};

const THE_RIGHT_MOMENT: TacticCard = {
  id: TACTIC_THE_RIGHT_MOMENT,
  name: "The Right Moment",
  turnOrder: 5,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_ACTIVATED,
  effectDescription: "Flip this card to take another turn immediately after this one (cannot be used on your last turn of the round).",
  implemented: false,
};

const GREAT_START: TacticCard = {
  id: TACTIC_GREAT_START,
  name: "Great Start",
  turnOrder: 6,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_ON_PICK,
  effectDescription: "Draw 2 cards.",
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

const MIDNIGHT_MEDITATION: TacticCard = {
  id: TACTIC_MIDNIGHT_MEDITATION,
  name: "Midnight Meditation",
  turnOrder: 2,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ON_PICK,
  effectDescription: "Discard any number of non-Wound cards from hand, then draw that many cards.",
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

const SPARING_POWER: TacticCard = {
  id: TACTIC_SPARING_POWER,
  name: "Sparing Power",
  turnOrder: 4,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ONGOING,
  effectDescription: "At the end of your turn, you may put one card from your hand under this card. At the start of your next turn, add it back to your hand.",
  implemented: false,
};

const LONG_NIGHT: TacticCard = {
  id: TACTIC_LONG_NIGHT,
  name: "Long Night",
  turnOrder: 5,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ACTIVATED,
  effectDescription: "Flip this card to take another turn immediately after this one (cannot be used on your last turn of the round).",
  implemented: false,
};

const GREAT_START_NIGHT: TacticCard = {
  id: TACTIC_GREAT_START_NIGHT,
  name: "Great Start",
  turnOrder: 6,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ON_PICK,
  effectDescription: "Draw 2 cards.",
  implemented: false,
};

// === Exports ===

/**
 * All tactic cards indexed by ID
 */
export const TACTIC_CARDS: Readonly<Record<TacticId, TacticCard>> = {
  // Day tactics
  [TACTIC_EARLY_BIRD]: EARLY_BIRD,
  [TACTIC_RETHINK]: RETHINK,
  [TACTIC_MANA_STEAL]: MANA_STEAL,
  [TACTIC_PLANNING]: PLANNING,
  [TACTIC_THE_RIGHT_MOMENT]: THE_RIGHT_MOMENT,
  [TACTIC_GREAT_START]: GREAT_START,
  // Night tactics
  [TACTIC_FROM_THE_DUSK]: FROM_THE_DUSK,
  [TACTIC_MIDNIGHT_MEDITATION]: MIDNIGHT_MEDITATION,
  [TACTIC_MANA_SEARCH]: MANA_SEARCH,
  [TACTIC_SPARING_POWER]: SPARING_POWER,
  [TACTIC_LONG_NIGHT]: LONG_NIGHT,
  [TACTIC_GREAT_START_NIGHT]: GREAT_START_NIGHT,
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
