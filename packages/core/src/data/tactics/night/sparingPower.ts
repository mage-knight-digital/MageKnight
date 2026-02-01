import type { TacticCard } from "@mage-knight/shared";
import {
  TACTIC_SPARING_POWER,
  TACTIC_EFFECT_TYPE_ONGOING,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";

export const SPARING_POWER: TacticCard = {
  id: TACTIC_SPARING_POWER,
  name: "Sparing Power",
  turnOrder: 6,
  timeOfDay: TIME_OF_DAY_NIGHT,
  effectType: TACTIC_EFFECT_TYPE_ONGOING,
  effectDescription:
    "Once before the start of each of your turns, choose one: Put the top card of your Deed deck face down under this card, or flip this card face down and put all Deed cards under it into your hand.",
  implemented: false,
};
