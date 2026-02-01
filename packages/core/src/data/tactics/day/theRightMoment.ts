import type { TacticCard } from "@mage-knight/shared";
import {
  TACTIC_THE_RIGHT_MOMENT,
  TACTIC_EFFECT_TYPE_ACTIVATED,
  TIME_OF_DAY_DAY,
} from "@mage-knight/shared";

export const THE_RIGHT_MOMENT: TacticCard = {
  id: TACTIC_THE_RIGHT_MOMENT,
  name: "The Right Moment",
  turnOrder: 6,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_ACTIVATED,
  effectDescription:
    "Flip this card to take another turn immediately after this one (cannot be used on your last turn of the round).",
  implemented: false,
};
