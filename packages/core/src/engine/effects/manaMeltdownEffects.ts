/**
 * Mana Meltdown / Mana Radiance effect handlers
 *
 * Handles the Mana Meltdown spell (Red #109) which:
 *
 * Basic (Mana Meltdown):
 * - Each opponent randomly loses a crystal (weighted by crystal counts)
 * - Opponents with no crystals take a wound instead
 * - Caster chooses one crystal from the lost pool to gain (or skips)
 * - After end-of-round announced: does nothing
 *
 * Powered (Mana Radiance):
 * - Caster picks a basic mana color
 * - ALL players (including caster) take 1 wound per crystal of that color
 * - Caster gains 2 crystals of chosen color
 * - After end-of-round announced: only applies to caster (no wounds to others)
 *
 * @module effects/manaMeltdownEffects
 *
 * @remarks Resolution Flow
 * ```
 * EFFECT_MANA_MELTDOWN
 *   └─► Random crystal loss per opponent (or wound), collect lost pool
 *       └─► If pool non-empty: generate RESOLVE_MANA_MELTDOWN_CHOICE options
 *           └─► Player selects crystal color (or skip)
 *               └─► Gain chosen crystal
 *
 * EFFECT_MANA_RADIANCE
 *   └─► Generate RESOLVE_MANA_RADIANCE_COLOR options (4 basic colors)
 *       └─► Player selects color
 *           └─► All players: wound per crystal of that color
 *           └─► Caster gains 2 crystals of that color
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  ManaMeltdownEffect,
  ResolveManaMeltdownChoiceEffect,
  ManaRadianceEffect,
  ResolveManaRadianceColorEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { BasicManaColor, CardId } from "@mage-knight/shared";
import {
  BASIC_MANA_COLORS,
  CARD_WOUND,
} from "@mage-knight/shared";
import { updatePlayer } from "./atomicEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { gainCrystalWithOverflow } from "../helpers/crystalHelpers.js";
import {
  EFFECT_MANA_MELTDOWN,
  EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE,
  EFFECT_MANA_RADIANCE,
  EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
} from "../../types/effectTypes.js";
import { randomInt } from "../../utils/rng.js";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if end-of-round has been announced (or scenario end triggered).
 */
function isEndOfRoundAnnounced(state: GameState): boolean {
  return state.endOfRoundAnnouncedBy !== null || state.scenarioEndTriggered;
}

/**
 * Build a weighted array of crystal colors based on counts.
 * E.g., 2 blue + 1 red → ["blue", "blue", "red"]
 */
function buildCrystalPool(player: Player): BasicManaColor[] {
  const pool: BasicManaColor[] = [];
  for (const color of BASIC_MANA_COLORS) {
    const count = player.crystals[color];
    for (let i = 0; i < count; i++) {
      pool.push(color);
    }
  }
  return pool;
}

/**
 * Remove one crystal of a given color from a player.
 */
function removeCrystal(player: Player, color: BasicManaColor): Player {
  return {
    ...player,
    crystals: {
      ...player.crystals,
      [color]: player.crystals[color] - 1,
    },
  };
}

/**
 * Add wounds to a player's hand.
 */
function addWounds(player: Player, amount: number, woundPileCount: number | null): { player: Player; woundPileCount: number | null } {
  const woundsToAdd: CardId[] = Array(amount).fill(CARD_WOUND);
  const updatedPlayer: Player = {
    ...player,
    hand: [...player.hand, ...woundsToAdd],
    // Track wounds received this turn for Banner of Protection
    woundsReceivedThisTurn: {
      hand: player.woundsReceivedThisTurn.hand + amount,
      discard: player.woundsReceivedThisTurn.discard,
    },
  };
  const newWoundPileCount =
    woundPileCount === null ? null : Math.max(0, woundPileCount - amount);
  return { player: updatedPlayer, woundPileCount: newWoundPileCount };
}

// ============================================================================
// MANA MELTDOWN (BASIC)
// ============================================================================

/**
 * Handle EFFECT_MANA_MELTDOWN entry point.
 *
 * For each opponent:
 * - If they have crystals: randomly pick one (weighted) and remove it
 * - If they have no crystals: they take a wound
 *
 * Then present caster with choice of which lost crystal to gain.
 */
export function handleManaMeltdown(
  state: GameState,
  playerId: string,
  _effect: ManaMeltdownEffect
): EffectResolutionResult {
  // After end-of-round: does nothing
  if (isEndOfRoundAnnounced(state)) {
    return {
      state,
      description: "Mana Meltdown has no effect after end of round",
    };
  }

  const { playerIndex: casterIndex } = getPlayerContext(state, playerId);

  // Get opponents
  const opponents = state.players.filter((p) => p.id !== playerId);

  // In single-player, no opponents — no effect
  if (opponents.length === 0) {
    return {
      state,
      description: "No other players to affect",
    };
  }

  let currentState = state;
  let currentRng = state.rng;
  const lostCrystals: BasicManaColor[] = [];
  const descriptions: string[] = [];

  // Process each opponent
  const updatedPlayers = [...currentState.players];

  for (const opponent of opponents) {
    const opponentIndex = updatedPlayers.findIndex((p) => p.id === opponent.id);
    if (opponentIndex === -1) continue;

    const currentOpponent = updatedPlayers[opponentIndex]!;
    const crystalPool = buildCrystalPool(currentOpponent);

    if (crystalPool.length === 0) {
      // No crystals — take a wound
      const { player: woundedOpponent, woundPileCount } = addWounds(
        currentOpponent,
        1,
        currentState.woundPileCount
      );
      updatedPlayers[opponentIndex] = woundedOpponent;
      currentState = { ...currentState, woundPileCount };
      descriptions.push(`${currentOpponent.id} took a wound (no crystals)`);
    } else {
      // Randomly pick a crystal (weighted by counts)
      const { value: randomIndex, rng: newRng } = randomInt(
        currentRng,
        0,
        crystalPool.length - 1
      );
      currentRng = newRng;

      const lostColor = crystalPool[randomIndex]!;
      updatedPlayers[opponentIndex] = removeCrystal(currentOpponent, lostColor);
      lostCrystals.push(lostColor);
      descriptions.push(`${currentOpponent.id} lost a ${lostColor} crystal`);
    }
  }

  currentState = {
    ...currentState,
    players: updatedPlayers,
    rng: currentRng,
  };

  // If no crystals were lost, nothing for caster to choose
  if (lostCrystals.length === 0) {
    return {
      state: currentState,
      description: descriptions.join(". "),
    };
  }

  // Generate choice options for caster: unique colors + skip
  const uniqueColors = [...new Set(lostCrystals)];
  const choiceOptions: ResolveManaMeltdownChoiceEffect[] = uniqueColors.map(
    (color) => ({
      type: EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE,
      color,
    })
  );

  // The caster's pending choice is set by the calling code
  // We need to update the caster's player to reflect the choice context
  const caster = currentState.players[casterIndex]!;
  void caster; // Referenced by index in state

  return {
    state: currentState,
    description: descriptions.join(". ") + ". Choose a crystal to gain",
    requiresChoice: true,
    dynamicChoiceOptions: choiceOptions,
  };
}

// ============================================================================
// RESOLVE MANA MELTDOWN CHOICE
// ============================================================================

/**
 * Resolve after caster picks a crystal color to gain.
 */
export function resolveManaMeltdownChoice(
  state: GameState,
  playerId: string,
  effect: ResolveManaMeltdownChoiceEffect
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

  const { player: updatedPlayer, tokensGained } = gainCrystalWithOverflow(player, effect.color);

  const description = tokensGained > 0
    ? `${effect.color} crystal at max — gained ${effect.color} mana token from Mana Meltdown`
    : `Gained ${effect.color} crystal from Mana Meltdown`;

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description,
  };
}

// ============================================================================
// MANA RADIANCE (POWERED)
// ============================================================================

/**
 * Handle EFFECT_MANA_RADIANCE entry point.
 * Presents the caster with a choice of basic mana color.
 */
export function handleManaRadiance(
  state: GameState,
  _playerId: string,
  _effect: ManaRadianceEffect
): EffectResolutionResult {
  // Generate color choice options
  const colorOptions: ResolveManaRadianceColorEffect[] = BASIC_MANA_COLORS.map(
    (color) => ({
      type: EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
      color,
    })
  );

  return {
    state,
    description: "Choose a basic mana color for Mana Radiance",
    requiresChoice: true,
    dynamicChoiceOptions: colorOptions,
  };
}

// ============================================================================
// RESOLVE MANA RADIANCE COLOR
// ============================================================================

/**
 * Resolve after caster picks a basic mana color.
 *
 * - All players take 1 wound per crystal of that color they own
 * - After end-of-round: only the caster takes wounds (not other players)
 * - Caster gains 2 crystals of chosen color
 */
export function resolveManaRadianceColor(
  state: GameState,
  playerId: string,
  effect: ResolveManaRadianceColorEffect
): EffectResolutionResult {
  const { playerIndex: casterIndex } = getPlayerContext(state, playerId);
  const chosenColor = effect.color;
  const endOfRound = isEndOfRoundAnnounced(state);

  let currentState = state;
  const descriptions: string[] = [];
  const updatedPlayers = [...currentState.players];

  // Apply wounds to each player based on crystals of chosen color
  for (let i = 0; i < updatedPlayers.length; i++) {
    const player = updatedPlayers[i]!;

    // After end-of-round, only caster is affected
    if (endOfRound && player.id !== playerId) continue;

    const crystalCount = player.crystals[chosenColor];
    if (crystalCount > 0) {
      const { player: woundedPlayer, woundPileCount } = addWounds(
        player,
        crystalCount,
        currentState.woundPileCount
      );
      updatedPlayers[i] = woundedPlayer;
      currentState = { ...currentState, woundPileCount };
      descriptions.push(
        `${player.id} took ${crystalCount} wound${crystalCount > 1 ? "s" : ""} (${crystalCount} ${chosenColor} crystal${crystalCount > 1 ? "s" : ""})`
      );
    }
  }

  // Caster gains 2 crystals of chosen color (with overflow protection)
  const caster = updatedPlayers[casterIndex]!;
  const { player: updatedCaster, crystalsGained, tokensGained } =
    gainCrystalWithOverflow(caster, chosenColor, 2);
  updatedPlayers[casterIndex] = updatedCaster;
  if (tokensGained > 0) {
    descriptions.push(
      `Gained ${crystalsGained} ${chosenColor} crystal${crystalsGained !== 1 ? "s" : ""} and ${tokensGained} ${chosenColor} mana token${tokensGained !== 1 ? "s" : ""} (overflow)`
    );
  } else {
    descriptions.push(`Gained 2 ${chosenColor} crystals`);
  }

  currentState = {
    ...currentState,
    players: updatedPlayers,
  };

  return {
    state: currentState,
    description: descriptions.join(". "),
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Mana Meltdown / Mana Radiance effect handlers with the effect registry.
 */
export function registerManaMeltdownEffects(): void {
  registerEffect(EFFECT_MANA_MELTDOWN, (state, playerId, effect) => {
    return handleManaMeltdown(
      state,
      playerId,
      effect as ManaMeltdownEffect
    );
  });

  registerEffect(
    EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE,
    (state, playerId, effect) => {
      return resolveManaMeltdownChoice(
        state,
        playerId,
        effect as ResolveManaMeltdownChoiceEffect
      );
    }
  );

  registerEffect(EFFECT_MANA_RADIANCE, (state, playerId, effect) => {
    return handleManaRadiance(
      state,
      playerId,
      effect as ManaRadianceEffect
    );
  });

  registerEffect(
    EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
    (state, playerId, effect) => {
      return resolveManaRadianceColor(
        state,
        playerId,
        effect as ResolveManaRadianceColorEffect
      );
    }
  );
}
