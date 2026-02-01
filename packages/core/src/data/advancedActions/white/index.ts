/**
 * White-powered advanced action cards (powered by white mana)
 */

import {
  CARD_AGILITY,
  CARD_SONG_OF_WIND,
  CARD_HEROIC_TALE,
  CARD_DIPLOMACY,
  CARD_MANA_STORM,
  CARD_LEARNING,
  CARD_CHIVALRY,
  CARD_PEACEFUL_MOMENT,
  CARD_DODGE_AND_WEAVE,
  CARD_SWIFT_BOLT,
} from "@mage-knight/shared";

// Re-export individual cards
export { AGILITY } from "./agility.js";
export { SONG_OF_WIND } from "./song-of-wind.js";
export { HEROIC_TALE } from "./heroic-tale.js";
export { DIPLOMACY } from "./diplomacy.js";
export { MANA_STORM } from "./mana-storm.js";
export { LEARNING } from "./learning.js";
export { CHIVALRY } from "./chivalry.js";
export { PEACEFUL_MOMENT } from "./peaceful-moment.js";
export { DODGE_AND_WEAVE } from "./dodge-and-weave.js";
export { SWIFT_BOLT } from "./swift-bolt.js";

// Import for aggregation
import { AGILITY } from "./agility.js";
import { SONG_OF_WIND } from "./song-of-wind.js";
import { HEROIC_TALE } from "./heroic-tale.js";
import { DIPLOMACY } from "./diplomacy.js";
import { MANA_STORM } from "./mana-storm.js";
import { LEARNING } from "./learning.js";
import { CHIVALRY } from "./chivalry.js";
import { PEACEFUL_MOMENT } from "./peaceful-moment.js";
import { DODGE_AND_WEAVE } from "./dodge-and-weave.js";
import { SWIFT_BOLT } from "./swift-bolt.js";

/** All white-powered advanced action cards */
export const WHITE_ADVANCED_ACTIONS = {
  [CARD_AGILITY]: AGILITY,
  [CARD_SONG_OF_WIND]: SONG_OF_WIND,
  [CARD_HEROIC_TALE]: HEROIC_TALE,
  [CARD_DIPLOMACY]: DIPLOMACY,
  [CARD_MANA_STORM]: MANA_STORM,
  [CARD_LEARNING]: LEARNING,
  [CARD_CHIVALRY]: CHIVALRY,
  [CARD_PEACEFUL_MOMENT]: PEACEFUL_MOMENT,
  [CARD_DODGE_AND_WEAVE]: DODGE_AND_WEAVE,
  [CARD_SWIFT_BOLT]: SWIFT_BOLT,
} as const;
