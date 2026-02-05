/**
 * White spell card definitions
 *
 * White spells are powered by BLACK + WHITE mana.
 */

import type { DeedCard } from "../../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_WHIRLWIND, CARD_EXPOSE, CARD_CURE } from "@mage-knight/shared";
import { WHIRLWIND } from "./whirlwind.js";
import { EXPOSE } from "./expose.js";
import { CURE } from "./cure.js";

export const WHITE_SPELLS: Record<CardId, DeedCard> = {
  [CARD_WHIRLWIND]: WHIRLWIND,
  [CARD_EXPOSE]: EXPOSE,
  [CARD_CURE]: CURE,
};

export { WHIRLWIND, EXPOSE, CURE };
