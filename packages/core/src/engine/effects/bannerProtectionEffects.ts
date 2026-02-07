/**
 * Banner of Protection effect handler
 *
 * Handles the EFFECT_ACTIVATE_BANNER_PROTECTION effect which sets the
 * bannerOfProtectionActive flag on the player. At end of turn, the player
 * may then throw away all wounds received during that turn.
 *
 * @module effects/bannerProtectionEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { ActivateBannerProtectionEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { updatePlayer } from "./atomicEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { EFFECT_ACTIVATE_BANNER_PROTECTION } from "../../types/effectTypes.js";

/**
 * Handle EFFECT_ACTIVATE_BANNER_PROTECTION.
 * Sets bannerOfProtectionActive flag on the player.
 * Wound removal is handled at end of turn by the end turn command.
 */
export function handleActivateBannerProtection(
  state: GameState,
  playerId: string,
  _effect: ActivateBannerProtectionEffect
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

  const updatedPlayer = {
    ...player,
    bannerOfProtectionActive: true,
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: "Banner of Protection activated — wounds received this turn may be thrown away at end of turn",
  };
}

/**
 * Register Banner of Protection effect handler with the effect registry.
 */
export function registerBannerProtectionEffects(): void {
  registerEffect(EFFECT_ACTIVATE_BANNER_PROTECTION, (state, playerId, effect) => {
    return handleActivateBannerProtection(
      state,
      playerId,
      effect as ActivateBannerProtectionEffect
    );
  });
}
