import type { TacticCard } from "@mage-knight/shared";
import {
  TACTIC_PREPARATION,
  TACTIC_EFFECT_TYPE_ON_PICK,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";

export const PREPARATION: TacticCard = {
  id: TACTIC_PREPARATION,
  name: "Preparation",
  turnOrder: 5,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ON_PICK,
  effectDescription:
    "Search your Deed deck for any one card and put it in your hand, then shuffle your deck.",
  implemented: false,
};
