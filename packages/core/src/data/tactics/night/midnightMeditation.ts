import type { TacticCard } from "@mage-knight/shared";
import {
  TACTIC_MIDNIGHT_MEDITATION,
  TACTIC_EFFECT_TYPE_ACTIVATED,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";

export const MIDNIGHT_MEDITATION: TacticCard = {
  id: TACTIC_MIDNIGHT_MEDITATION,
  name: "Midnight Meditation",
  turnOrder: 4,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ACTIVATED,
  effectDescription:
    "One time this Night, before any of your turns, you may shuffle up to 5 cards (including Wounds) from your hand back into your Deed deck and then draw that many cards. Then flip this card face down.",
  implemented: false,
};
