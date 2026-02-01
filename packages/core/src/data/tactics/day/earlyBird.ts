import type { TacticCard } from "@mage-knight/shared";
import {
  TACTIC_EARLY_BIRD,
  TACTIC_EFFECT_TYPE_NONE,
  TIME_OF_DAY_DAY,
} from "@mage-knight/shared";

export const EARLY_BIRD: TacticCard = {
  id: TACTIC_EARLY_BIRD,
  name: "Early Bird",
  turnOrder: 1,
  timeOfDay: TIME_OF_DAY_DAY,
  effectType: TACTIC_EFFECT_TYPE_NONE,
  effectDescription: "No special effect. Go first this round.",
  implemented: true, // Turn order is implemented
};
