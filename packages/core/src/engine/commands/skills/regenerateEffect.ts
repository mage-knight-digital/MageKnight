/**
 * Regenerate skill effect handlers.
 *
 * Shared rules:
 * - Once per turn, healing effect (cannot be used during combat)
 * - Pay one mana and discard one Wound from hand
 * - Black mana is only permitted at night
 *
 * Hero-specific card draw bonus:
 * - Braevalar: green mana OR strictly lowest fame
 * - Krang: red mana OR strictly lowest fame
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { ManaSourceInfo } from "@mage-knight/shared";
import { CARD_WOUND, MANA_GREEN, MANA_RED, MANA_BLUE, MANA_WHITE, MANA_GOLD } from "@mage-knight/shared";
import { getPlayerIndexByIdOrThrow } from "../../helpers/playerHelpers.js";
import { consumeMana } from "../helpers/manaConsumptionHelpers.js";
import { isManaColorAllowed } from "../../rules/mana.js";

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
 * 3. Has usable mana available
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
  const crystalColors = [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE] as const;

  // Check pure mana tokens (includes black/gold via shared mana rules)
  for (const token of player.pureMana) {
    if (isManaColorAllowed(state, token.color, player.id)) {
      return true;
    }
  }

  // Check crystals (basic colors only - no black crystals)
  for (const color of crystalColors) {
    if (player.crystals[color] > 0) {
      return true;
    }
  }

  // Check source dice (if not blocked and available)
  if (!player.usedManaFromSource) {
    for (const die of state.source.dice) {
      if (die.takenByPlayerId === null && !die.isDepleted) {
        if (
          die.color !== MANA_GOLD &&
          isManaColorAllowed(state, die.color, player.id)
        ) {
          return true;
        }
        if (
          die.color === MANA_GOLD &&
          isManaColorAllowed(state, MANA_GOLD, player.id)
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

function applyRegenerateEffectWithBonusMana(
  state: GameState,
  playerId: string,
  manaSource: ManaSourceInfo,
  bonusManaColor: typeof MANA_GREEN | typeof MANA_RED
): GameState {
  if (!isManaColorAllowed(state, manaSource.color, playerId)) {
    throw new Error(`Regenerate cannot use ${manaSource.color} mana right now`);
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
  const usedBonusMana = manaSource.color === bonusManaColor;
  const lowestFame = hasStrictlyLowestFame(state, playerId);

  if (usedBonusMana || lowestFame) {
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
 * Braevalar Regenerate:
 * Draw a card when green mana was spent OR player has strictly lowest fame.
 */
export function applyRegenerateEffect(
  state: GameState,
  playerId: string,
  manaSource?: ManaSourceInfo
): GameState {
  if (!manaSource) {
    throw new Error("Regenerate requires a mana source");
  }
  return applyRegenerateEffectWithBonusMana(
    state,
    playerId,
    manaSource,
    MANA_GREEN
  );
}

/**
 * Krang Regenerate:
 * Draw a card when red mana was spent OR player has strictly lowest fame.
 */
export function applyKrangRegenerateEffect(
  state: GameState,
  playerId: string,
  manaSource?: ManaSourceInfo
): GameState {
  if (!manaSource) {
    throw new Error("Regenerate requires a mana source");
  }
  return applyRegenerateEffectWithBonusMana(
    state,
    playerId,
    manaSource,
    MANA_RED
  );
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

export function removeKrangRegenerateEffect(
  state: GameState,
  playerId: string
): GameState {
  return removeRegenerateEffect(state, playerId);
}
