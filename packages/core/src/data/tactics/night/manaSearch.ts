import type { TacticCard } from "@mage-knight/shared";
import {
  TACTIC_MANA_SEARCH,
  TACTIC_EFFECT_TYPE_ONGOING,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";

export const MANA_SEARCH: TacticCard = {
  id: TACTIC_MANA_SEARCH,
  name: "Mana Search",
  turnOrder: 3,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ONGOING,
  effectDescription:
    "Once during your turn, before taking a die from the Source, you may re-roll any or all dice in the Source.",
  implemented: false,
};
