/**
 * White spell card definitions
 *
 * White spells are powered by BLACK + WHITE mana.
 */

import type { DeedCard } from "../../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_WHIRLWIND, CARD_EXPOSE } from "@mage-knight/shared";
import { WHIRLWIND } from "./whirlwind.js";
import { EXPOSE } from "./expose.js";

export const WHITE_SPELLS: Record<CardId, DeedCard> = {
  [CARD_WHIRLWIND]: WHIRLWIND,
  [CARD_EXPOSE]: EXPOSE,
};

export { WHIRLWIND, EXPOSE };
