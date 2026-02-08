/**
 * Meditation / Trance (Green Spell #06)
 *
 * Basic (Meditation): Randomly pick 2 cards from discard pile → place on top or bottom of deck.
 *   Hand limit +2 on next draw.
 * Powered (Trance): Choose 2 cards from discard pile → place on top or bottom of deck.
 *   Hand limit +2 on next draw.
 *
 * Effect uses NOOP — actual logic is in playCardCommand.ts (sets pendingMeditation state)
 * and resolveMeditationCommand.ts (resolves placement choice).
 */

import type { DeedCard } from "../../../types/cards.js";
import { DEED_CARD_TYPE_SPELL } from "../../../types/cards.js";
import { MANA_GREEN, MANA_BLACK, CARD_MEDITATION } from "@mage-knight/shared";
import { EFFECT_NOOP } from "../../../types/effectTypes.js";

export const MEDITATION: DeedCard = {
  id: CARD_MEDITATION,
  name: "Meditation",
  poweredName: "Trance",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [],
  poweredBy: [MANA_BLACK, MANA_GREEN],
  basicEffect: { type: EFFECT_NOOP },
  poweredEffect: { type: EFFECT_NOOP },
  sidewaysValue: 1,
};
