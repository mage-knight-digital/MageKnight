/**
 * Card playability module.
 *
 * This module determines which cards in a player's hand can be played
 * and how (basic, powered, or sideways) based on the current game state.
 */

import type { DeedCard } from "../../../types/cards.js";
import { getBasicActionCard } from "../../../data/basicActions/index.js";
import { getAdvancedActionCard } from "../../../data/advancedActions/index.js";
import { getSpellCard } from "../../../data/spells/index.js";
import { getArtifactCard } from "../../../data/artifacts.js";

// Re-export combat playability
export { getPlayableCardsForCombat } from "./combat.js";

// Re-export normal turn playability
export { getPlayableCardsForNormalTurn } from "./normalTurn.js";

// Re-export effect detection functions (for use by other modules if needed)
export {
  effectHasRangedOrSiege,
  effectHasBlock,
  effectHasAttack,
  effectHasMove,
  effectHasInfluence,
  effectHasHeal,
  effectHasDraw,
  effectHasModifier,
  effectHasManaGain,
  effectHasManaDrawPowered,
  effectHasCrystal,
  effectHasCardBoost,
  effectHasEnemyTargeting,
  effectIsUtility,
} from "./effectDetection/index.js";

// Re-export mana payment functions (for use by other modules if needed)
export { canPayForSpellBasic, findPayableManaColor } from "./manaPayment.js";

/**
 * Get a card definition by ID.
 * Supports basic action, advanced action, and spell cards.
 */
export function getCard(cardId: string): DeedCard | null {
  // Try basic action cards first
  try {
    return getBasicActionCard(cardId as Parameters<typeof getBasicActionCard>[0]);
  } catch {
    // Not a basic action, continue
  }

  // Try advanced action cards
  try {
    return getAdvancedActionCard(cardId as Parameters<typeof getAdvancedActionCard>[0]);
  } catch {
    // Not an advanced action either
  }

  // Try spell cards
  const spell = getSpellCard(cardId as Parameters<typeof getSpellCard>[0]);
  if (spell) {
    return spell;
  }

  // Try artifact cards
  const artifact = getArtifactCard(cardId as Parameters<typeof getArtifactCard>[0]);
  if (artifact) {
    return artifact;
  }

  // Card not found
  return null;
}
