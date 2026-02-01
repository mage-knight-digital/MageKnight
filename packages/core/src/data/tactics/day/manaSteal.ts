import type { TacticCard } from "@mage-knight/shared";
import {
  TACTIC_MANA_STEAL,
  TACTIC_EFFECT_TYPE_ON_PICK,
  TIME_OF_DAY_DAY,
} from "@mage-knight/shared";

export const MANA_STEAL: TacticCard = {
  id: TACTIC_MANA_STEAL,
  name: "Mana Steal",
  turnOrder: 3,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_ON_PICK,
  effectDescription:
    "Take a die from the Source and put it on this card. You may use it anytime during your turn. Return the die to the Source at end of your turn.",
  implemented: false,
};
