/**
 * Blue-powered advanced action cards (powered by blue mana)
 */

import {
  CARD_ICE_SHIELD,
  CARD_FROST_BRIDGE,
  CARD_PURE_MAGIC,
  CARD_STEADY_TEMPO,
  CARD_CRYSTAL_MASTERY,
  CARD_MAGIC_TALENT,
  CARD_SHIELD_BASH,
  CARD_TEMPORAL_PORTAL,
  CARD_SPELL_FORGE,
  CARD_ICE_BOLT,
} from "@mage-knight/shared";

// Re-export individual cards
export { ICE_SHIELD } from "./ice-shield.js";
export { FROST_BRIDGE } from "./frost-bridge.js";
export { PURE_MAGIC } from "./pure-magic.js";
export { STEADY_TEMPO } from "./steady-tempo.js";
export { CRYSTAL_MASTERY } from "./crystal-mastery.js";
export { MAGIC_TALENT } from "./magic-talent.js";
export { SHIELD_BASH } from "./shield-bash.js";
export { TEMPORAL_PORTAL } from "./temporal-portal.js";
export { SPELL_FORGE } from "./spell-forge.js";
export { ICE_BOLT } from "./ice-bolt.js";

// Import for aggregation
import { ICE_SHIELD } from "./ice-shield.js";
import { FROST_BRIDGE } from "./frost-bridge.js";
import { PURE_MAGIC } from "./pure-magic.js";
import { STEADY_TEMPO } from "./steady-tempo.js";
import { CRYSTAL_MASTERY } from "./crystal-mastery.js";
import { MAGIC_TALENT } from "./magic-talent.js";
import { SHIELD_BASH } from "./shield-bash.js";
import { TEMPORAL_PORTAL } from "./temporal-portal.js";
import { SPELL_FORGE } from "./spell-forge.js";
import { ICE_BOLT } from "./ice-bolt.js";

/** All blue-powered advanced action cards */
export const BLUE_ADVANCED_ACTIONS = {
  [CARD_ICE_SHIELD]: ICE_SHIELD,
  [CARD_FROST_BRIDGE]: FROST_BRIDGE,
  [CARD_PURE_MAGIC]: PURE_MAGIC,
  [CARD_STEADY_TEMPO]: STEADY_TEMPO,
  [CARD_CRYSTAL_MASTERY]: CRYSTAL_MASTERY,
  [CARD_MAGIC_TALENT]: MAGIC_TALENT,
  [CARD_SHIELD_BASH]: SHIELD_BASH,
  [CARD_TEMPORAL_PORTAL]: TEMPORAL_PORTAL,
  [CARD_SPELL_FORGE]: SPELL_FORGE,
  [CARD_ICE_BOLT]: ICE_BOLT,
} as const;
