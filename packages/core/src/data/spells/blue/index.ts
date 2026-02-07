/**
 * Blue spell card definitions
 *
 * Blue spells are powered by BLACK + BLUE mana.
 */

import type { DeedCard } from "../../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_SNOWSTORM, CARD_CHILL, CARD_MIST_FORM, CARD_MANA_CLAIM, CARD_SPACE_BENDING } from "@mage-knight/shared";
import { SNOWSTORM } from "./snowstorm.js";
import { CHILL } from "./chill.js";
import { MIST_FORM } from "./mistForm.js";
import { MANA_CLAIM } from "./manaClaim.js";
import { SPACE_BENDING } from "./spaceBending.js";

export const BLUE_SPELLS: Record<CardId, DeedCard> = {
  [CARD_SNOWSTORM]: SNOWSTORM,
  [CARD_CHILL]: CHILL,
  [CARD_MIST_FORM]: MIST_FORM,
  [CARD_MANA_CLAIM]: MANA_CLAIM,
  [CARD_SPACE_BENDING]: SPACE_BENDING,
};

export { SNOWSTORM, CHILL, MIST_FORM, MANA_CLAIM, SPACE_BENDING };
