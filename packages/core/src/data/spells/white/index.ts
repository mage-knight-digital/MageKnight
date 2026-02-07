/**
 * White spell card definitions
 *
 * White spells are powered by BLACK + WHITE mana.
 */

import type { DeedCard } from "../../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_WHIRLWIND, CARD_EXPOSE, CARD_CURE, CARD_CALL_TO_ARMS, CARD_MIND_READ, CARD_WINGS_OF_WIND } from "@mage-knight/shared";
import { WHIRLWIND } from "./whirlwind.js";
import { EXPOSE } from "./expose.js";
import { CURE } from "./cure.js";
import { CALL_TO_ARMS } from "./callToArms.js";
import { MIND_READ } from "./mindRead.js";
import { WINGS_OF_WIND } from "./wingsOfWind.js";

export const WHITE_SPELLS: Record<CardId, DeedCard> = {
  [CARD_WHIRLWIND]: WHIRLWIND,
  [CARD_EXPOSE]: EXPOSE,
  [CARD_CURE]: CURE,
  [CARD_CALL_TO_ARMS]: CALL_TO_ARMS,
  [CARD_MIND_READ]: MIND_READ,
  [CARD_WINGS_OF_WIND]: WINGS_OF_WIND,
};

export { WHIRLWIND, EXPOSE, CURE, CALL_TO_ARMS, MIND_READ, WINGS_OF_WIND };
