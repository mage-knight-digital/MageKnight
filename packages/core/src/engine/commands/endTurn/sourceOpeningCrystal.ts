/**
 * Source Opening Crystal Grant - End of Turn Processing
 *
 * When Source Opening has been returned, the returning player gets an extra
 * Source die to use. At end of turn, if they used the extra die, the skill
 * owner (Goldyx) gets a crystal of that die's color.
 *
 * Also sets up the pending reroll choice for the extra die (FAQ S3):
 * The returning player decides whether to reroll the extra die before
 * other dice are rerolled.
 *
 * @module commands/endTurn/sourceOpeningCrystal
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { BasicManaColor } from "@mage-knight/shared";
import { BASIC_MANA_COLORS, MANA_TOKEN_SOURCE_SKILL } from "@mage-knight/shared";
import type { ManaColor } from "@mage-knight/shared";
import type { SourceDieId } from "../../../types/mana.js";
import { gainCrystalWithOverflow } from "../../helpers/crystalHelpers.js";

function isBasicColor(color: ManaColor): color is BasicManaColor {
  return (BASIC_MANA_COLORS as readonly ManaColor[]).includes(color);
}

export interface SourceOpeningCrystalResult {
  readonly state: GameState;
  /** The extra die ID if one was used (for reroll choice) */
  readonly extraDieId: SourceDieId | null;
}

/**
 * Process Source Opening crystal grant at end of turn.
 *
 * If the returning player used an extra Source die this turn, grant the
 * skill owner a crystal of that die's color. Also returns the extra die ID
 * so the end-of-turn flow can offer a reroll choice (FAQ S3).
 *
 * Clears the sourceOpeningCenter.
 *
 * @param state - Current game state (players may already be reset)
 * @param currentPlayerId - The player whose turn just ended
 * @param preResetPlayer - The player BEFORE state reset (still has usedDieIds)
 */
export function processSourceOpeningCrystal(
  state: GameState,
  currentPlayerId: string,
  preResetPlayer: Player
): SourceOpeningCrystalResult {
  const center = state.sourceOpeningCenter;
  if (!center || center.returningPlayerId !== currentPlayerId) {
    return { state, extraDieId: null };
  }

  // Check if the player used more dice than they had when the skill was returned.
  // If so, the extra die(s) were from Source Opening.
  const extraDiceUsed = preResetPlayer.usedDieIds.length - Math.max(center.usedDieCountAtReturn, 1);
  if (extraDiceUsed <= 0) {
    // Player didn't use the extra die — no crystal granted.
    // Clear the center state since the turn is over.
    return { state: { ...state, sourceOpeningCenter: null }, extraDieId: null };
  }

  // Find the color of the extra die used.
  // The extra die is the last one in usedDieIds (the one used after the initial die).
  const extraDieId = preResetPlayer.usedDieIds[preResetPlayer.usedDieIds.length - 1];
  if (!extraDieId) {
    return { state: { ...state, sourceOpeningCenter: null }, extraDieId: null };
  }

  // Look up the die color from the source
  const die = state.source.dice.find((d) => d.id === extraDieId);
  if (!die || !isBasicColor(die.color)) {
    // Die not found or not basic color — clear and move on
    return { state: { ...state, sourceOpeningCenter: null }, extraDieId: null };
  }

  // Grant the crystal to the skill owner (Goldyx)
  const ownerIndex = state.players.findIndex((p) => p.id === center.ownerId);
  if (ownerIndex === -1) {
    return { state: { ...state, sourceOpeningCenter: null }, extraDieId: null };
  }

  const owner = state.players[ownerIndex]!;
  const { player: updatedOwner } =
    gainCrystalWithOverflow(owner, die.color, 1, MANA_TOKEN_SOURCE_SKILL);

  const players = [...state.players];
  players[ownerIndex] = updatedOwner;

  return {
    state: {
      ...state,
      players,
      sourceOpeningCenter: null,
    },
    extraDieId: extraDieId as SourceDieId,
  };
}
