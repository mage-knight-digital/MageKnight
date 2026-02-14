/**
 * Card playability computation for combat.
 *
 * Determines which cards in the player's hand can be played during each combat phase.
 * Delegates to the unified evaluateHandPlayability function.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { CombatState } from "../../../types/combat.js";
import type { PlayCardOptions, PlayableCard } from "@mage-knight/shared";
import { buildCombatPlayContext, evaluateHandPlayability } from "./cardPlayability.js";
import { toPlayableCard } from "./playableCardBuilder.js";

/**
 * Get playable cards for combat based on the current phase.
 */
export function getPlayableCardsForCombat(
  state: GameState,
  player: Player,
  combat: CombatState
): PlayCardOptions {
  const ctx = buildCombatPlayContext(state, player, combat);
  const results = evaluateHandPlayability(state, player, ctx);
  const cards = results
    .map(toPlayableCard)
    .filter((c): c is PlayableCard => c !== null);
  return { cards };
}
