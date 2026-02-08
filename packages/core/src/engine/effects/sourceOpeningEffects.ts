/**
 * Source Opening effect handlers (Goldyx interactive skill)
 *
 * Implements the activation phase of Source Opening:
 * - Present available source dice for optional reroll
 * - Player selects a die to reroll (or skips)
 * - Place the skill in the center
 *
 * The return mechanic is handled in returnInteractiveSkillCommand.ts
 *
 * Flow diagram:
 * ```
 * EFFECT_SOURCE_OPENING_REROLL (entry point)
 *   ├─ No dice available? → skip reroll, done
 *   ├─ One die available? → auto-select (1 option + skip)
 *   └─ Multiple dice? → present choice (N options + skip)
 *         ↓
 *      EFFECT_SOURCE_OPENING_SELECT_DIE → reroll selected die → done
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { SourceOpeningSelectDieEffect } from "../../types/cards.js";
import type { SourceDieId } from "../../types/mana.js";
import type { EffectResolutionResult } from "./types.js";
import {
  EFFECT_SOURCE_OPENING_REROLL,
  EFFECT_SOURCE_OPENING_SELECT_DIE,
} from "../../types/effectTypes.js";
import { EFFECT_NOOP } from "../../types/effectTypes.js";
import { registerEffect } from "./effectRegistry.js";
import { rerollDie } from "../mana/manaSource.js";

// ============================================================================
// REROLL ENTRY POINT
// ============================================================================

/**
 * Entry point for Source Opening reroll.
 * Filters available source dice and presents choice to reroll one (or skip).
 */
function handleSourceOpeningReroll(state: GameState): EffectResolutionResult {
  // Find dice that can be rerolled (not taken, not depleted)
  const availableDice = state.source.dice.filter(
    (d) => d.takenByPlayerId === null && !d.isDepleted
  );

  if (availableDice.length === 0) {
    return {
      state,
      description: "No dice available to reroll",
    };
  }

  // Build choice options: one per available die + skip option
  const dieOptions: SourceOpeningSelectDieEffect[] = availableDice.map(
    (die) => ({
      type: EFFECT_SOURCE_OPENING_SELECT_DIE,
      dieId: die.id,
    })
  );

  // Add skip option (noop)
  const options = [
    ...dieOptions,
    { type: EFFECT_NOOP } as const,
  ];

  return {
    state,
    description: "Choose a Source die to reroll (or skip)",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

// ============================================================================
// DIE SELECTION HANDLER
// ============================================================================

/**
 * Handle die selection for Source Opening reroll.
 * Rerolls the selected die in the Source.
 */
function handleSourceOpeningSelectDie(
  state: GameState,
  _playerId: string,
  effect: SourceOpeningSelectDieEffect
): EffectResolutionResult {
  const { dieId } = effect;

  const { source: rerolledSource, rng: newRng } = rerollDie(
    state.source,
    dieId as SourceDieId,
    state.timeOfDay,
    state.rng
  );

  const updatedState: GameState = {
    ...state,
    source: rerolledSource,
    rng: newRng,
  };

  return {
    state: updatedState,
    description: "Rerolled a Source die",
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Source Opening effect handlers with the effect registry.
 */
export function registerSourceOpeningEffects(): void {
  registerEffect(EFFECT_SOURCE_OPENING_REROLL, (state, _playerId, _effect) =>
    handleSourceOpeningReroll(state)
  );

  registerEffect(EFFECT_SOURCE_OPENING_SELECT_DIE, (state, playerId, effect) =>
    handleSourceOpeningSelectDie(
      state,
      playerId,
      effect as SourceOpeningSelectDieEffect
    )
  );
}
