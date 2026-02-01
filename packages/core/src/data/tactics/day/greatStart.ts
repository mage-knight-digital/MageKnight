import type { TacticCard } from "@mage-knight/shared";
import {
  TACTIC_GREAT_START,
  TACTIC_EFFECT_TYPE_ON_PICK,
  TIME_OF_DAY_DAY,
} from "@mage-knight/shared";

export const GREAT_START: TacticCard = {
  id: TACTIC_GREAT_START,
  name: "Great Start",
  turnOrder: 5,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_ON_PICK,
  effectDescription: "Draw 2 cards.",
  implemented: false,
};
