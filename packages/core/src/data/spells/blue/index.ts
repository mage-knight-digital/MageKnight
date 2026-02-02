/**
 * Blue spell card definitions
 *
 * Blue spells are powered by BLACK + BLUE mana.
 */

import type { DeedCard } from "../../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_SNOWSTORM, CARD_CHILL, CARD_MIST_FORM } from "@mage-knight/shared";
import { SNOWSTORM } from "./snowstorm.js";
import { CHILL } from "./chill.js";
import { MIST_FORM } from "./mistForm.js";

export const BLUE_SPELLS: Record<CardId, DeedCard> = {
  [CARD_SNOWSTORM]: SNOWSTORM,
  [CARD_CHILL]: CHILL,
  [CARD_MIST_FORM]: MIST_FORM,
};

export { SNOWSTORM, CHILL, MIST_FORM };
