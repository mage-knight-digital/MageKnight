/**
 * Attack-based fame tracking effects
 *
 * Handles effects that register an attack to grant fame if it defeats
 * at least one enemy (e.g., Axe Throw powered effect).
 */

import type { CardId } from "@mage-knight/shared";
import type { TrackAttackDefeatFameEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { EFFECT_TRACK_ATTACK_DEFEAT_FAME } from "../../types/effectTypes.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { updatePlayer } from "./atomicHelpers.js";
import { createAttackDefeatFameTracker } from "../combat/attackFameTracking.js";

export function registerAttackFameEffects(): void {
  registerEffect(
    EFFECT_TRACK_ATTACK_DEFEAT_FAME,
    (state, playerId, effect, sourceCardId): EffectResolutionResult => {
      const { playerIndex, player } = getPlayerContext(state, playerId);
      const typedEffect = effect as TrackAttackDefeatFameEffect;
      const trackerSource =
        typedEffect.sourceCardId ?? (sourceCardId as CardId | undefined) ?? null;

      if (typedEffect.amount <= 0 || typedEffect.fame <= 0) {
        return {
          state,
          description: "No fame tracking applied",
        };
      }

      const tracker = createAttackDefeatFameTracker(typedEffect, trackerSource);
      const updatedPlayer = {
        ...player,
        pendingAttackDefeatFame: [...player.pendingAttackDefeatFame, tracker],
      };

      return {
        state: updatePlayer(state, playerIndex, updatedPlayer),
        description: `Track fame +${typedEffect.fame} on ${typedEffect.combatType} defeat`,
      };
    }
  );
}
