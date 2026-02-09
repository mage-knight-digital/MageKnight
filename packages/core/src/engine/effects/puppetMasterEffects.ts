/**
 * Puppet Master Effect Handlers
 *
 * Handles the two custom effect types for the Puppet Master skill:
 * - EFFECT_PUPPET_MASTER_KEEP: Keep a defeated enemy token
 * - EFFECT_PUPPET_MASTER_EXPEND: Discard a kept token (creates sub-choice for attack/block)
 *
 * @module effects/puppetMasterEffects
 */

import { registerEffect } from "./effectRegistry.js";
import {
  EFFECT_PUPPET_MASTER_KEEP,
  EFFECT_PUPPET_MASTER_EXPEND,
} from "../../types/effectTypes.js";
import {
  resolveKeepEnemyToken,
  resolveExpendTokenChoice,
} from "../commands/skills/puppetMasterEffect.js";
import type { PuppetMasterKeepEffect, PuppetMasterExpendEffect } from "../../types/cards.js";

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerPuppetMasterEffects(): void {
  // Keep enemy token effect
  registerEffect(EFFECT_PUPPET_MASTER_KEEP, (state, playerId, effect) => {
    const keepEffect = effect as PuppetMasterKeepEffect;
    const newState = resolveKeepEnemyToken(state, playerId, keepEffect.token);
    return {
      state: newState,
      description: `Kept ${keepEffect.token.name} token`,
    };
  });

  // Expend token effect - creates a sub-choice for attack or block
  registerEffect(EFFECT_PUPPET_MASTER_EXPEND, (state, playerId, effect) => {
    const expendEffect = effect as PuppetMasterExpendEffect;
    const newState = resolveExpendTokenChoice(
      state,
      playerId,
      expendEffect.token
    );

    // This creates a new pending choice (attack vs block), so it requires choice
    return {
      state: newState,
      requiresChoice: true,
      description: `Discarding ${expendEffect.token.name} token - choose Attack or Block`,
    };
  });
}
