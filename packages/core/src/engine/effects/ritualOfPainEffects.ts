/**
 * Ritual of Pain effect handlers
 *
 * Handles skill-specific effects for Arythea's Ritual of Pain:
 * - Discard wound cards from hand (return to wound pile)
 * - Place the skill in the center for other players to use
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  DiscardWoundsEffect,
  PlaceSkillInCenterEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { CARD_WOUND } from "@mage-knight/shared";
import { updatePlayer } from "./atomicEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { addModifier } from "../modifiers/index.js";
import {
  EFFECT_DISCARD_WOUNDS,
  EFFECT_PLACE_SKILL_IN_CENTER,
} from "../../types/effectTypes.js";
import {
  DURATION_ROUND,
  EFFECT_RULE_OVERRIDE,
  EFFECT_SIDEWAYS_VALUE,
  RULE_WOUNDS_PLAYABLE_SIDEWAYS,
  SCOPE_OTHER_PLAYERS,
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";

// ============================================================================
// DISCARD WOUNDS EFFECT
// ============================================================================

/**
 * Discard a number of wound cards from hand (return to wound pile).
 */
export function handleDiscardWounds(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: DiscardWoundsEffect
): EffectResolutionResult {
  const count = Math.max(0, effect.count);
  if (count === 0) {
    return {
      state,
      description: "Discarded 0 Wounds",
    };
  }

  const woundsInHand = player.hand.filter((cardId) => cardId === CARD_WOUND);
  if (woundsInHand.length < count) {
    return {
      state,
      description: `Not enough Wounds to discard (need ${count}, have ${woundsInHand.length})`,
    };
  }

  const newHand = [...player.hand];
  let removed = 0;
  for (let i = newHand.length - 1; i >= 0 && removed < count; i--) {
    if (newHand[i] === CARD_WOUND) {
      newHand.splice(i, 1);
      removed += 1;
    }
  }

  const updatedPlayer: Player = {
    ...player,
    hand: newHand,
  };

  const updatedState = updatePlayer(state, playerIndex, updatedPlayer);
  const newWoundPileCount =
    updatedState.woundPileCount === null
      ? null
      : updatedState.woundPileCount + count;

  return {
    state: {
      ...updatedState,
      woundPileCount: newWoundPileCount,
    },
    description: `Discarded ${count} Wound${count === 1 ? "" : "s"}`,
  };
}

// ============================================================================
// PLACE SKILL IN CENTER EFFECT
// ============================================================================

/**
 * Place an interactive skill token in the center for other players to use.
 */
export function handlePlaceSkillInCenter(
  state: GameState,
  playerId: string,
  effect: PlaceSkillInCenterEffect
): EffectResolutionResult {
  const skillId = effect.skillId;

  // Remove any existing center modifiers for this skill before adding fresh ones
  const filteredModifiers = state.activeModifiers.filter(
    (modifier) =>
      !(
        modifier.source.type === SOURCE_SKILL &&
        modifier.source.skillId === skillId &&
        modifier.source.playerId === playerId
      )
  );

  let updatedState: GameState = {
    ...state,
    activeModifiers: filteredModifiers,
  };

  updatedState = addModifier(updatedState, {
    source: { type: SOURCE_SKILL, skillId, playerId },
    duration: DURATION_ROUND,
    scope: { type: SCOPE_OTHER_PLAYERS },
    effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_WOUNDS_PLAYABLE_SIDEWAYS },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  updatedState = addModifier(updatedState, {
    source: { type: SOURCE_SKILL, skillId, playerId },
    duration: DURATION_ROUND,
    scope: { type: SCOPE_OTHER_PLAYERS },
    effect: { type: EFFECT_SIDEWAYS_VALUE, newValue: 3, forWounds: true },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  return {
    state: updatedState,
    description: "Placed skill in center",
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Ritual of Pain effect handlers with the effect registry.
 */
export function registerRitualOfPainEffects(): void {
  registerEffect(EFFECT_DISCARD_WOUNDS, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handleDiscardWounds(state, playerIndex, player, effect as DiscardWoundsEffect);
  });

  registerEffect(EFFECT_PLACE_SKILL_IN_CENTER, (state, playerId, effect) =>
    handlePlaceSkillInCenter(state, playerId, effect as PlaceSkillInCenterEffect)
  );
}
