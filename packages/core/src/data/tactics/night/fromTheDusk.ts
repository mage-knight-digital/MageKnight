import type { TacticCard } from "@mage-knight/shared";
import {
  TACTIC_FROM_THE_DUSK,
  TACTIC_EFFECT_TYPE_NONE,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";

export const FROM_THE_DUSK: TacticCard = {
  id: TACTIC_FROM_THE_DUSK,
  name: "From the Dusk",
  turnOrder: 1,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_NONE,
  effectDescription: "No special effect. Go first this round.",
  implemented: true, // Turn order is implemented
};
