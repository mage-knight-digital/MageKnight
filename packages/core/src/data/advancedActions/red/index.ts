/**
 * Red-powered advanced action cards (powered by red mana)
 */

import {
  CARD_BLOOD_RAGE,
  CARD_INTIMIDATE,
  CARD_BLOOD_RITUAL,
  CARD_INTO_THE_HEAT,
  CARD_DECOMPOSE,
  CARD_MAXIMAL_EFFECT,
  CARD_COUNTERATTACK,
  CARD_RITUAL_ATTACK,
  CARD_BLOOD_OF_ANCIENTS,
  CARD_EXPLOSIVE_BOLT,
  CARD_FIRE_BOLT,
} from "@mage-knight/shared";

// Re-export individual cards
export { BLOOD_RAGE } from "./blood-rage.js";
export { INTIMIDATE } from "./intimidate.js";
export { BLOOD_RITUAL } from "./blood-ritual.js";
export { INTO_THE_HEAT } from "./into-the-heat.js";
export { DECOMPOSE } from "./decompose.js";
export { MAXIMAL_EFFECT } from "./maximal-effect.js";
export { COUNTERATTACK } from "./counterattack.js";
export { RITUAL_ATTACK } from "./ritual-attack.js";
export { BLOOD_OF_ANCIENTS } from "./blood-of-ancients.js";
export { EXPLOSIVE_BOLT } from "./explosive-bolt.js";
export { FIRE_BOLT } from "./fire-bolt.js";

// Import for aggregation
import { BLOOD_RAGE } from "./blood-rage.js";
import { INTIMIDATE } from "./intimidate.js";
import { BLOOD_RITUAL } from "./blood-ritual.js";
import { INTO_THE_HEAT } from "./into-the-heat.js";
import { DECOMPOSE } from "./decompose.js";
import { MAXIMAL_EFFECT } from "./maximal-effect.js";
import { COUNTERATTACK } from "./counterattack.js";
import { RITUAL_ATTACK } from "./ritual-attack.js";
import { BLOOD_OF_ANCIENTS } from "./blood-of-ancients.js";
import { EXPLOSIVE_BOLT } from "./explosive-bolt.js";
import { FIRE_BOLT } from "./fire-bolt.js";

/** All red-powered advanced action cards */
export const RED_ADVANCED_ACTIONS = {
  [CARD_BLOOD_RAGE]: BLOOD_RAGE,
  [CARD_INTIMIDATE]: INTIMIDATE,
  [CARD_BLOOD_RITUAL]: BLOOD_RITUAL,
  [CARD_INTO_THE_HEAT]: INTO_THE_HEAT,
  [CARD_DECOMPOSE]: DECOMPOSE,
  [CARD_MAXIMAL_EFFECT]: MAXIMAL_EFFECT,
  [CARD_COUNTERATTACK]: COUNTERATTACK,
  [CARD_RITUAL_ATTACK]: RITUAL_ATTACK,
  [CARD_BLOOD_OF_ANCIENTS]: BLOOD_OF_ANCIENTS,
  [CARD_EXPLOSIVE_BOLT]: EXPLOSIVE_BOLT,
  [CARD_FIRE_BOLT]: FIRE_BOLT,
} as const;
