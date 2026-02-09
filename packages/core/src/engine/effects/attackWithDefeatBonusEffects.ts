/**
 * Attack with defeat bonus effect handler
 *
 * Handles the AttackWithDefeatBonus effect used by Chivalry and Explosive Bolt.
 * Combines an attack with per-enemy-defeated bonuses:
 * - Reputation/fame tracking (Chivalry)
 * - Armor reduction on other enemies (Explosive Bolt)
 */

import type { AttackWithDefeatBonusEffect, GainAttackEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { AttackDefeatFameTracker } from "../../types/player.js";
import { EFFECT_ATTACK_WITH_DEFEAT_BONUS } from "../../types/effectTypes.js";
import { ATTACK_ELEMENT_PHYSICAL } from "@mage-knight/shared";
import { toAttackType } from "../combat/attackFameTracking.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { applyGainAttack } from "./atomicCombatEffects.js";
import { updatePlayer } from "./atomicHelpers.js";

export function registerAttackWithDefeatBonusEffects(): void {
  registerEffect(
    EFFECT_ATTACK_WITH_DEFEAT_BONUS,
    (state, playerId, effect): EffectResolutionResult => {
      const typedEffect = effect as AttackWithDefeatBonusEffect;

      // Step 1: Apply the attack via normal GainAttack logic
      const { playerIndex, player } = getPlayerContext(state, playerId);
      const attackEffect: GainAttackEffect = {
        type: "gain_attack",
        amount: typedEffect.amount,
        combatType: typedEffect.combatType,
      };

      const attackResult = applyGainAttack(state, playerIndex, player, attackEffect);

      // If attack resolution requires a choice (e.g., Bow of Starsdawn), return that
      if (attackResult.requiresChoice) {
        return attackResult;
      }

      // Step 2: Register a tracker for per-enemy-defeated bonuses
      const updatedState = attackResult.state;
      const { playerIndex: postIndex, player: postPlayer } = getPlayerContext(updatedState, playerId);

      const tracker: AttackDefeatFameTracker = {
        sourceCardId: null,
        attackType: toAttackType(typedEffect.combatType),
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: typedEffect.amount,
        remaining: typedEffect.amount,
        assignedByEnemy: {},
        fame: 0,
        reputationPerDefeat: typedEffect.reputationPerDefeat,
        famePerDefeat: typedEffect.famePerDefeat,
        armorReductionPerDefeat: typedEffect.armorReductionPerDefeat,
      };

      const updatedPlayer = {
        ...postPlayer,
        pendingAttackDefeatFame: [...postPlayer.pendingAttackDefeatFame, tracker],
      };

      const descParts: string[] = [];
      if (typedEffect.reputationPerDefeat) {
        descParts.push(`Rep +${typedEffect.reputationPerDefeat}`);
      }
      if (typedEffect.famePerDefeat) {
        descParts.push(`Fame +${typedEffect.famePerDefeat}`);
      }
      if (typedEffect.armorReductionPerDefeat) {
        descParts.push(`Armor -${typedEffect.armorReductionPerDefeat} on another enemy`);
      }
      const bonusDesc = descParts.length > 0 ? ` (${descParts.join(", ")} per enemy)` : "";

      return {
        state: updatePlayer(updatedState, postIndex, updatedPlayer),
        description: `Attack ${typedEffect.amount} with defeat bonuses${bonusDesc}`,
      };
    }
  );
}
