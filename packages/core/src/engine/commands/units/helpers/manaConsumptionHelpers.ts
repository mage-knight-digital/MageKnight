/**
 * Mana consumption helpers for unit ability activation
 *
 * Re-exports shared mana consumption helpers with unit-specific aliases.
 */

import {
  consumeMana,
  restoreMana,
  type ManaConsumptionResult,
} from "../../helpers/manaConsumptionHelpers.js";

// Re-export the type
export type { ManaConsumptionResult };

// Re-export with original names for backwards compatibility
export { consumeMana as consumeManaForAbility };
export { restoreMana as restoreManaForAbility };
