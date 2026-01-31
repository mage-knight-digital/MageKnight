/**
 * Validator routing index - combines all domain-specific routers
 */

import type { ValidatorRegistry } from "./types.js";
import { movementValidatorRegistry } from "./movement.js";
import { cardValidatorRegistry } from "./cards.js";
import { combatValidatorRegistry } from "./combat.js";
import { restValidatorRegistry } from "./rest.js";
import { unitValidatorRegistry } from "./units.js";
import { siteValidatorRegistry } from "./sites.js";
import { turnValidatorRegistry } from "./turn.js";
import { rewardValidatorRegistry } from "./rewards.js";
import { cooperativeValidatorRegistry } from "./cooperative.js";
import { skillValidatorRegistry } from "./skills.js";
import { debugValidatorRegistry } from "./debug.js";

/**
 * Combined validator registry from all domain-specific routers
 */
export const validatorRegistry: ValidatorRegistry = {
  ...movementValidatorRegistry,
  ...cardValidatorRegistry,
  ...combatValidatorRegistry,
  ...restValidatorRegistry,
  ...unitValidatorRegistry,
  ...siteValidatorRegistry,
  ...turnValidatorRegistry,
  ...rewardValidatorRegistry,
  ...cooperativeValidatorRegistry,
  ...skillValidatorRegistry,
  ...debugValidatorRegistry,
};

// Re-export types
export type { ValidatorRegistry } from "./types.js";

// Re-export individual registries for testing/introspection
export {
  movementValidatorRegistry,
  cardValidatorRegistry,
  combatValidatorRegistry,
  restValidatorRegistry,
  unitValidatorRegistry,
  siteValidatorRegistry,
  turnValidatorRegistry,
  rewardValidatorRegistry,
  cooperativeValidatorRegistry,
  skillValidatorRegistry,
  debugValidatorRegistry,
};
