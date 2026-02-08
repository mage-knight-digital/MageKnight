/**
 * Regenerate skill effect handler
 *
 * Braevalar's skill: Once per turn, except in combat (healing effect):
 * Pay a mana of any color and throw away a Wound from hand.
 * If green mana was used, or player has the least Fame (not tied), draw a card.
 *
 * FAQ rulings:
 * S1: Must throw away a Wound - cannot just pay mana to draw.
 * S2: Black mana is permitted at night.
 * S3: Healing effect - cannot be used during combat.
 *
 * Implementation:
 * - Consumes 1 mana from the specified source (UI handles color selection)
 * - Removes one Wound from hand and returns it to wound pile
 * - Conditionally draws one card (green mana OR strictly lowest fame)
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { ManaSourceInfo } from "@mage-knight/shared";
import { CARD_WOUND, MANA_GREEN, MANA_RED, MANA_BLUE, MANA_WHITE, MANA_BLACK } from "@mage-knight/shared";
import { getPlayerIndexByIdOrThrow } from "../../helpers/playerHelpers.js";
import { consumeMana } from "../helpers/manaConsumptionHelpers.js";

/**
 * Check if the player has the strictly lowest fame (not tied with anyone).
 * In solo play, this never qualifies (no other player to compare against).
 */
function hasStrictlyLowestFame(state: GameState, playerId: string): boolean {
  if (state.players.length <= 1) {
    return false;
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;

  const otherPlayers = state.players.filter((p) => p.id !== playerId);
  return otherPlayers.every((p) => p.fame > player.fame);
}

/**
 * Check if the player can activate Regenerate.
 * Requires:
 * 1. Has at least one Wound in hand
 * 2. Not in combat (healing effect, S3)
 * 3. Has mana available (basic colors + black at night)
 */
export function canActivateRegenerate(
  state: GameState,
  player: Player
): boolean {
  // Must have a wound in hand
  if (!player.hand.some((c) => c === CARD_WOUND)) {
    return false;
  }

  // Cannot use during combat (healing effect, S3)
  if (state.combat !== null) {
    return false;
  }

  // Must have at least 1 mana available
  const basicColors: readonly string[] = [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE];
  const isNight = state.timeOfDay === "night";

  // Check pure mana tokens
  for (const token of player.pureMana) {
    if (basicColors.includes(token.color)) {
      return true;
    }
    if (isNight && token.color === MANA_BLACK) {
      return true;
    }
  }

  // Check crystals (basic colors only - no black crystals)
  for (const color of [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE] as const) {
    if (player.crystals[color] > 0) {
      return true;
    }
  }

  // Check source dice (if not blocked and available)
  if (!player.usedManaFromSource) {
    for (const die of state.source.dice) {
      if (die.takenByPlayerId === null && !die.isDepleted) {
        if (basicColors.includes(die.color)) {
          return true;
        }
        if (isNight && die.color === MANA_BLACK) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Apply the Regenerate skill effect.
 *
 * 1. Consume mana from the specified source
 * 2. Remove one Wound from hand, return to wound pile
 * 3. If green mana was spent OR player has strictly lowest fame: draw a card
 */
export function applyRegenerateEffect(
  state: GameState,
  playerId: string,
  manaSource?: ManaSourceInfo
): GameState {
  if (!manaSource) {
    throw new Error("Regenerate requires a mana source");
  }

  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // 1. Consume the mana
  const manaResult = consumeMana(player, state.source, manaSource, playerId);
  let updatedPlayer = manaResult.player;
  state = { ...state, source: manaResult.source };

  // 2. Remove one Wound from hand
  const woundIndex = updatedPlayer.hand.indexOf(CARD_WOUND);
  if (woundIndex === -1) {
    throw new Error("No wound in hand to discard");
  }

  const newHand = [...updatedPlayer.hand];
  newHand.splice(woundIndex, 1);
  updatedPlayer = { ...updatedPlayer, hand: newHand };

  // Return wound to wound pile
  const newWoundPileCount =
    state.woundPileCount === null ? null : state.woundPileCount + 1;
  state = { ...state, woundPileCount: newWoundPileCount };

  // 3. Check if bonus card draw is triggered
  const usedGreenMana = manaSource.color === MANA_GREEN;
  const lowestFame = hasStrictlyLowestFame(state, playerId);

  if (usedGreenMana || lowestFame) {
    // Draw one card from deck
    const cardToDraw = updatedPlayer.deck[0];
    if (cardToDraw !== undefined) {
      const newDeck = updatedPlayer.deck.slice(1);
      updatedPlayer = {
        ...updatedPlayer,
        hand: [...updatedPlayer.hand, cardToDraw],
        deck: newDeck,
      };
    }
  }

  // Update player in state
  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}

/**
 * Remove the Regenerate skill effect for undo.
 *
 * Note: Regenerate is marked isReversible: false because it draws cards,
 * so the checkpoint mechanism handles full state restoration.
 * This is a best-effort undo that restores the wound to hand.
 * Mana restoration is handled by useSkillCommand.
 */
export function removeRegenerateEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Add wound back to hand
  const newHand = [...player.hand, CARD_WOUND];

  // Decrement wound pile
  const newWoundPileCount =
    state.woundPileCount === null ? null : Math.max(0, state.woundPileCount - 1);

  const updatedPlayer: Player = {
    ...player,
    hand: newHand,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return {
    ...state,
    players,
    woundPileCount: newWoundPileCount,
  };
}
