import type { TacticCard } from "@mage-knight/shared";
import {
  TACTIC_RETHINK,
  TACTIC_EFFECT_TYPE_ON_PICK,
  TIME_OF_DAY_DAY,
} from "@mage-knight/shared";

export const RETHINK: TacticCard = {
  id: TACTIC_RETHINK,
  name: "Rethink",
  turnOrder: 2,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_ON_PICK,
  effectDescription:
    "You may discard up to 3 cards from your hand (including Wounds). Shuffle your discard pile into your deck, then draw as many cards as you discarded.",
  implemented: false,
};
