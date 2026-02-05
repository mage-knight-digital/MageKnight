/**
 * Pure card lookup by ID. Lives here to avoid circular dependency between
 * engine/effects and engine/validActions (both need card lookup).
 */

import type { DeedCard } from "../../types/cards.js";
import { getBasicActionCard } from "../../data/basicActions/index.js";
import { getAdvancedActionCard } from "../../data/advancedActions/index.js";
import { getSpellCard } from "../../data/spells/index.js";
import { getArtifactCard } from "../../data/artifacts/index.js";

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
