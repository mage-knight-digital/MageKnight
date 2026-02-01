import type { TacticCard } from "@mage-knight/shared";
import {
  TACTIC_PLANNING,
  TACTIC_EFFECT_TYPE_ONGOING,
  TIME_OF_DAY_DAY,
} from "@mage-knight/shared";

export const PLANNING: TacticCard = {
  id: TACTIC_PLANNING,
  name: "Planning",
  turnOrder: 4,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_ONGOING,
  effectDescription:
    "Your hand limit is increased by 1 this round, but only if you have at least 2 cards in your hand at the end of your turn.",
  implemented: false,
};
