/**
 * Card playability computation for normal (non-combat) turns.
 *
 * Determines which cards in the player's hand can be played during
 * movement, interaction, and other non-combat phases.
 * Delegates to the unified evaluateHandPlayability function.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { PlayCardOptions, PlayableCard } from "@mage-knight/shared";
import { buildPlayContext, evaluateHandPlayability } from "./cardPlayability.js";
import { toPlayableCard } from "./playableCardBuilder.js";

/**
 * Get playable cards for normal (non-combat) turns.
 *
 * During a normal turn, cards can provide:
 * - Move points
 * - Influence points
 * - Healing
 * - Sideways: +1 Move/Influence
 */
export function getPlayableCardsForNormalTurn(
  state: GameState,
  player: Player
): PlayCardOptions {
  const ctx = buildPlayContext(state, player);
  const results = evaluateHandPlayability(state, player, ctx);
  const cards = results
    .map(toPlayableCard)
    .filter((c): c is PlayableCard => c !== null);
  return { cards };
}
