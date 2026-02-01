import type { TacticCard } from "@mage-knight/shared";
import {
  TACTIC_LONG_NIGHT,
  TACTIC_EFFECT_TYPE_ACTIVATED,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";

export const LONG_NIGHT: TacticCard = {
  id: TACTIC_LONG_NIGHT,
  name: "Long Night",
  turnOrder: 2,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ACTIVATED,
  effectDescription:
    "One time this Night, if your Deed deck is empty, you may shuffle your discard pile and put 3 cards at random back into your Deed deck. Then flip this card face down.",
  implemented: false,
};
