/**
 * Banner validators.
 *
 * Validates banner assignment and Banner of Fear cancel attack actions.
 */

import type { Validator } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  BANNER_NOT_IN_HAND,
  BANNER_NOT_A_BANNER,
  BANNER_TARGET_UNIT_NOT_FOUND,
  BANNER_NO_UNITS,
  BANNER_FEAR_NOT_IN_COMBAT,
  BANNER_FEAR_NOT_BLOCK_PHASE,
  BANNER_FEAR_UNIT_NOT_FOUND,
  BANNER_FEAR_NO_BANNER,
  BANNER_FEAR_UNIT_NOT_READY,
  BANNER_FEAR_UNIT_WOUNDED,
  BANNER_FEAR_ENEMY_NOT_FOUND,
  BANNER_FEAR_ENEMY_ARCANE_IMMUNE,
  BANNER_FEAR_ATTACK_ALREADY_CANCELLED,
  BANNER_FEAR_INVALID_ATTACK_INDEX,
} from "./validationCodes.js";
import {
  ABILITY_ARCANE_IMMUNITY,
  ASSIGN_BANNER_ACTION,
  CARD_BANNER_OF_FEAR,
  UNIT_STATE_READY,
  USE_BANNER_FEAR_ACTION,
} from "@mage-knight/shared";
import { getCard } from "../helpers/cardLookup.js";
import { isBannerArtifact, getBannerForUnit } from "../rules/banners.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import { getEnemyAttackCount, isAttackCancelled } from "../combat/enemyAttackHelpers.js";

/**
 * Validate that the banner card is in the player's hand.
 */
export const validateBannerInHand: Validator = (state, playerId, action) => {
  if (action.type !== ASSIGN_BANNER_ACTION) return valid();
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return valid(); // Other validators handle this

  if (!player.hand.includes(action.bannerCardId)) {
    return invalid(BANNER_NOT_IN_HAND, "Banner card is not in hand");
  }
  return valid();
};

/**
 * Validate that the card is actually a banner artifact.
 */
export const validateIsBannerArtifact: Validator = (_state, _playerId, action) => {
  if (action.type !== ASSIGN_BANNER_ACTION) return valid();

  const card = getCard(action.bannerCardId);
  if (!card || !isBannerArtifact(card)) {
    return invalid(BANNER_NOT_A_BANNER, "Card is not a banner artifact");
  }
  return valid();
};

/**
 * Validate that the player has at least one unit.
 */
export const validateHasUnits: Validator = (state, playerId, action) => {
  if (action.type !== ASSIGN_BANNER_ACTION) return valid();
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return valid();

  if (player.units.length === 0) {
    return invalid(BANNER_NO_UNITS, "No units to assign banner to");
  }
  return valid();
};

/**
 * Validate that the target unit exists and belongs to the player.
 */
export const validateBannerTargetUnit: Validator = (state, playerId, action) => {
  if (action.type !== ASSIGN_BANNER_ACTION) return valid();
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return valid();

  const unit = player.units.find(
    (u) => u.instanceId === action.targetUnitInstanceId
  );
  if (!unit) {
    return invalid(
      BANNER_TARGET_UNIT_NOT_FOUND,
      "Target unit not found"
    );
  }
  return valid();
};

// ============================================================================
// Banner of Fear: Cancel Attack Validators
// ============================================================================

/**
 * Validate that player is in combat during block phase.
 */
export const validateBannerFearInCombatBlockPhase: Validator = (state, _playerId, action) => {
  if (action.type !== USE_BANNER_FEAR_ACTION) return valid();

  if (!state.combat) {
    return invalid(BANNER_FEAR_NOT_IN_COMBAT, "Not in combat");
  }
  if (state.combat.phase !== COMBAT_PHASE_BLOCK) {
    return invalid(BANNER_FEAR_NOT_BLOCK_PHASE, "Not in block phase");
  }
  return valid();
};

/**
 * Validate that the unit exists, has Banner of Fear, is ready, and is unwounded.
 */
export const validateBannerFearUnit: Validator = (state, playerId, action) => {
  if (action.type !== USE_BANNER_FEAR_ACTION) return valid();
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return valid();

  const unit = player.units.find((u) => u.instanceId === action.unitInstanceId);
  if (!unit) {
    return invalid(BANNER_FEAR_UNIT_NOT_FOUND, "Unit not found");
  }

  const banner = getBannerForUnit(player, action.unitInstanceId);
  if (!banner || banner.bannerId !== CARD_BANNER_OF_FEAR) {
    return invalid(BANNER_FEAR_NO_BANNER, "Unit does not have Banner of Fear attached");
  }

  if (unit.state !== UNIT_STATE_READY) {
    return invalid(BANNER_FEAR_UNIT_NOT_READY, "Unit is not ready (already spent)");
  }

  if (unit.wounded) {
    return invalid(BANNER_FEAR_UNIT_WOUNDED, "Wounded units cannot use Banner of Fear");
  }

  return valid();
};

/**
 * Validate that the target enemy exists, is not Arcane Immune,
 * and the specified attack is valid and not already cancelled.
 */
export const validateBannerFearEnemy: Validator = (state, _playerId, action) => {
  if (action.type !== USE_BANNER_FEAR_ACTION) return valid();
  if (!state.combat) return valid(); // Other validator handles this

  const enemy = state.combat.enemies.find(
    (e) => e.instanceId === action.targetEnemyInstanceId
  );
  if (!enemy || enemy.isDefeated) {
    return invalid(BANNER_FEAR_ENEMY_NOT_FOUND, "Target enemy not found");
  }

  if (enemy.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY)) {
    return invalid(BANNER_FEAR_ENEMY_ARCANE_IMMUNE, "Cannot cancel attack of Arcane Immune enemy");
  }

  const attackIndex = action.attackIndex ?? 0;
  const attackCount = getEnemyAttackCount(enemy);
  if (attackIndex < 0 || attackIndex >= attackCount) {
    return invalid(BANNER_FEAR_INVALID_ATTACK_INDEX, "Invalid attack index");
  }

  if (isAttackCancelled(enemy, attackIndex)) {
    return invalid(BANNER_FEAR_ATTACK_ALREADY_CANCELLED, "Attack already cancelled");
  }

  return valid();
};
