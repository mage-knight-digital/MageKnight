/**
 * Mana Claim / Mana Curse effect handlers
 *
 * Handles the Mana Claim spell (Blue #110) which:
 *
 * Basic (Mana Claim):
 * - Take a basic color die from Source, keep until end of round
 * - Choose: 3 tokens now (burst) OR 1 token per turn (sustained)
 * - After end-of-round announced: does nothing
 *
 * Powered (Mana Curse):
 * - Same die claim and token choice as basic
 * - Additionally, until end of round other players take a wound
 *   when using mana of that color (max 1 wound per player per turn)
 * - After end-of-round announced: only applies to caster (no curse)
 *
 * @module effects/manaClaimEffects
 *
 * @remarks Resolution Flow
 * ```
 * EFFECT_MANA_CLAIM / EFFECT_MANA_CURSE
 *   └─► Generate die selection options (basic color dice only)
 *       └─► RESOLVE_MANA_CLAIM_DIE (player picks die)
 *           └─► Generate mode options (burst vs sustained)
 *               └─► RESOLVE_MANA_CLAIM_MODE (player picks mode)
 *                   ├─► burst: Grant 3 tokens immediately
 *                   └─► sustained: Add round-duration modifier for 1/turn
 *                   └─► (if curse): Add round-duration curse modifier
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  ManaClaimEffect,
  ResolveManaClaimDieEffect,
  ResolveManaClaimModeEffect,
  ManaCurseEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { BasicManaColor, CardId } from "@mage-knight/shared";
import {
  BASIC_MANA_COLORS,
  MANA_TOKEN_SOURCE_CARD,
  CARD_MANA_CLAIM,
} from "@mage-knight/shared";
import { updatePlayer } from "./atomicEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import {
  EFFECT_MANA_CLAIM,
  EFFECT_RESOLVE_MANA_CLAIM_DIE,
  EFFECT_RESOLVE_MANA_CLAIM_MODE,
  EFFECT_MANA_CURSE,
} from "../../types/effectTypes.js";
import {
  DURATION_ROUND,
  SCOPE_SELF,
  SCOPE_OTHER_PLAYERS,
  SOURCE_CARD,
  EFFECT_MANA_CLAIM_SUSTAINED,
  EFFECT_MANA_CURSE as MODIFIER_MANA_CURSE,
} from "../../types/modifierConstants.js";
import { addModifier } from "../modifiers/lifecycle.js";
import { processRushOfAdrenalineOnWound } from "./rushOfAdrenalineHelpers.js";
import { applyWoundsToHand } from "./woundApplicationHelpers.js";

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
 * Generate die selection options for the player.
 * Only basic color dice (not taken) are eligible.
 */
function generateDieOptions(
  state: GameState,
  withCurse: boolean
): ResolveManaClaimDieEffect[] {
  const availableDice = state.source.dice.filter(
    (d) => d.takenByPlayerId === null && BASIC_MANA_COLORS.includes(d.color as BasicManaColor)
  );

  return availableDice.map((die) => ({
    type: EFFECT_RESOLVE_MANA_CLAIM_DIE,
    dieId: die.id,
    dieColor: die.color,
    withCurse,
  }));
}

// ============================================================================
// MANA CLAIM (BASIC)
// ============================================================================

/**
 * Handle EFFECT_MANA_CLAIM entry point.
 * Presents player with choice of which basic color die to claim.
 */
export function handleManaClaim(
  state: GameState,
  _playerId: string,
  _effect: ManaClaimEffect
): EffectResolutionResult {
  // After end-of-round: does nothing
  if (isEndOfRoundAnnounced(state)) {
    return {
      state,
      description: "Mana Claim has no effect after end of round",
    };
  }

  const dieOptions = generateDieOptions(state, false);

  if (dieOptions.length === 0) {
    return {
      state,
      description: "No basic color dice available in the Source",
    };
  }

  return {
    state,
    description: "Choose a basic color die from the Source to claim",
    requiresChoice: true,
    dynamicChoiceOptions: dieOptions,
  };
}

// ============================================================================
// MANA CURSE (POWERED)
// ============================================================================

/**
 * Handle EFFECT_MANA_CURSE entry point.
 * Same as Mana Claim but with curse flag set.
 */
export function handleManaCurse(
  state: GameState,
  _playerId: string,
  _effect: ManaCurseEffect
): EffectResolutionResult {
  // After end-of-round: only basic effect for caster (no curse)
  const endOfRound = isEndOfRoundAnnounced(state);

  const dieOptions = generateDieOptions(state, !endOfRound);

  if (dieOptions.length === 0) {
    return {
      state,
      description: "No basic color dice available in the Source",
    };
  }

  return {
    state,
    description: endOfRound
      ? "Choose a basic color die from the Source to claim (no curse after end of round)"
      : "Choose a basic color die from the Source to claim and curse",
    requiresChoice: true,
    dynamicChoiceOptions: dieOptions,
  };
}

// ============================================================================
// RESOLVE MANA CLAIM DIE
// ============================================================================

/**
 * Player has selected which die to claim.
 * Present mode choice: burst (3 now) or sustained (1 per turn).
 */
export function resolveManaClaimDie(
  state: GameState,
  _playerId: string,
  effect: ResolveManaClaimDieEffect
): EffectResolutionResult {
  const { dieId, dieColor, withCurse } = effect;

  // Verify die is still available
  const die = state.source.dice.find((d) => d.id === dieId);
  if (!die || die.takenByPlayerId !== null) {
    return {
      state,
      description: "Selected die is no longer available",
    };
  }

  // The die color is always a basic color (ensured by generateDieOptions)
  const color = dieColor as BasicManaColor;

  // Generate mode choice options
  const modeOptions: ResolveManaClaimModeEffect[] = [
    {
      type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
      dieId,
      color,
      mode: "burst",
      withCurse,
    },
    {
      type: EFFECT_RESOLVE_MANA_CLAIM_MODE,
      dieId,
      color,
      mode: "sustained",
      withCurse,
    },
  ];

  return {
    state,
    description: `Claimed ${color} die. Choose: 3 ${color} mana now OR 1 ${color} mana each turn`,
    requiresChoice: true,
    dynamicChoiceOptions: modeOptions,
  };
}

// ============================================================================
// RESOLVE MANA CLAIM MODE
// ============================================================================

/**
 * Player has chosen burst or sustained mode.
 * - burst: Grant 3 tokens immediately
 * - sustained: Add round-duration modifier for 1 token per turn
 * - If curse: Add round-duration curse modifier
 */
export function resolveManaClaimMode(
  state: GameState,
  playerId: string,
  effect: ResolveManaClaimModeEffect
): EffectResolutionResult {
  const { dieId, color, mode, withCurse } = effect;
  const { playerIndex, player } = getPlayerContext(state, playerId);

  // Claim the die: set takenByPlayerId (keeps it out of Source)
  const dieIndex = state.source.dice.findIndex((d) => d.id === dieId);
  if (dieIndex === -1) {
    return {
      state,
      description: `Die not found: ${dieId}`,
    };
  }

  const originalDie = state.source.dice[dieIndex]!;
  const updatedDice = [...state.source.dice];
  updatedDice[dieIndex] = {
    ...originalDie,
    color,
    isDepleted: false,
    takenByPlayerId: playerId,
  };

  let currentState: GameState = {
    ...state,
    source: {
      ...state.source,
      dice: updatedDice,
    },
  };

  const descriptions: string[] = [];

  if (mode === "burst") {
    // Grant 3 tokens immediately
    const newTokens = Array.from({ length: 3 }, () => ({
      color,
      source: MANA_TOKEN_SOURCE_CARD,
    }));

    const updatedPlayer: Player = {
      ...player,
      pureMana: [...player.pureMana, ...newTokens],
    };

    currentState = updatePlayer(currentState, playerIndex, updatedPlayer);
    descriptions.push(`Gained 3 ${color} mana tokens`);
  } else {
    // Sustained mode: add round-duration modifier for 1 token per turn
    // Token is NOT granted this turn — starts from next turn
    currentState = addModifier(currentState, {
      source: { type: SOURCE_CARD, cardId: CARD_MANA_CLAIM as CardId, playerId },
      duration: DURATION_ROUND,
      scope: { type: SCOPE_SELF },
      effect: {
        type: EFFECT_MANA_CLAIM_SUSTAINED,
        color,
        claimedDieId: dieId,
      },
      createdAtRound: currentState.round,
      createdByPlayerId: playerId,
    });
    descriptions.push(`Will gain 1 ${color} mana each turn for remainder of round`);
  }

  // If curse: add round-duration curse modifier targeting other players
  if (withCurse) {
    currentState = addModifier(currentState, {
      source: { type: SOURCE_CARD, cardId: CARD_MANA_CLAIM as CardId, playerId },
      duration: DURATION_ROUND,
      scope: { type: SCOPE_OTHER_PLAYERS },
      effect: {
        type: MODIFIER_MANA_CURSE,
        color,
        claimedDieId: dieId,
        woundedPlayerIdsThisTurn: [],
      },
      createdAtRound: currentState.round,
      createdByPlayerId: playerId,
    });
    descriptions.push(`Other players take a wound when using ${color} mana`);
  }

  return {
    state: currentState,
    description: descriptions.join(". "),
  };
}

// ============================================================================
// MANA CURSE WOUND CHECK
// ============================================================================

/**
 * Check if a player should take a wound from a Mana Curse after using mana.
 * Called from manaConsumptionHelpers when mana is consumed.
 *
 * Returns updated state with wound applied and modifier updated (if triggered).
 */
export function checkManaCurseWound(
  state: GameState,
  playerId: string,
  manaColor: string
): GameState {
  // Find active Mana Curse modifiers for this color targeting other players
  const curseModifiers = state.activeModifiers.filter(
    (m) =>
      m.effect.type === MODIFIER_MANA_CURSE &&
      m.effect.color === manaColor &&
      m.createdByPlayerId !== playerId // Curse doesn't affect caster
  );

  if (curseModifiers.length === 0) {
    return state;
  }

  let currentState = state;

  for (const curseMod of curseModifiers) {
    const curseEffect = curseMod.effect as import("../../types/modifiers.js").ManaCurseModifier;

    // Check if this player has already been wounded by this curse this turn
    if (curseEffect.woundedPlayerIdsThisTurn.includes(playerId)) {
      continue;
    }

    // Apply wound to the player
    const playerIndex = currentState.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) continue;

    currentState = applyWoundsToHand(currentState, playerIndex, 1);

    // Update the modifier to track this player as wounded this turn
    const updatedModifiers = currentState.activeModifiers.map((m) =>
      m.id === curseMod.id
        ? {
            ...m,
            effect: {
              ...curseEffect,
              woundedPlayerIdsThisTurn: [
                ...curseEffect.woundedPlayerIdsThisTurn,
                playerId,
              ],
            },
          }
        : m
    );

    currentState = {
      ...currentState,
      activeModifiers: updatedModifiers,
    };

    // Rush of Adrenaline: draw cards when wounds are taken to hand
    const rushResult = processRushOfAdrenalineOnWound(
      currentState,
      playerIndex,
      currentState.players[playerIndex]!,
      1
    );
    currentState = rushResult.state;
  }

  return currentState;
}

/**
 * Grant sustained Mana Claim token at start of turn.
 * Called from turn advancement when a player's turn begins.
 *
 * Returns updated player with the token added (or unchanged if no modifier).
 */
export function grantManaClaimSustainedToken(
  state: GameState,
  player: Player
): Player {
  // Find active sustained Mana Claim modifiers for this player
  const sustainedModifiers = state.activeModifiers.filter(
    (m) =>
      m.effect.type === EFFECT_MANA_CLAIM_SUSTAINED &&
      m.createdByPlayerId === player.id
  );

  if (sustainedModifiers.length === 0) {
    return player;
  }

  let updatedPlayer = player;

  for (const mod of sustainedModifiers) {
    const effect = mod.effect as import("../../types/modifiers.js").ManaClaimSustainedModifier;
    updatedPlayer = {
      ...updatedPlayer,
      pureMana: [
        ...updatedPlayer.pureMana,
        { color: effect.color, source: MANA_TOKEN_SOURCE_CARD },
      ],
    };
  }

  return updatedPlayer;
}

/**
 * Reset Mana Curse per-turn wound tracking at turn start.
 * Called when a new turn begins so all players can be wounded again.
 */
export function resetManaCurseWoundTracking(state: GameState): GameState {
  const curseModifiers = state.activeModifiers.filter(
    (m) => m.effect.type === MODIFIER_MANA_CURSE
  );

  if (curseModifiers.length === 0) {
    return state;
  }

  const updatedModifiers = state.activeModifiers.map((m) => {
    if (m.effect.type === MODIFIER_MANA_CURSE) {
      return {
        ...m,
        effect: {
          ...(m.effect as import("../../types/modifiers.js").ManaCurseModifier),
          woundedPlayerIdsThisTurn: [] as readonly string[],
        },
      };
    }
    return m;
  });

  return {
    ...state,
    activeModifiers: updatedModifiers,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Mana Claim / Mana Curse effect handlers with the effect registry.
 */
export function registerManaClaimEffects(): void {
  registerEffect(EFFECT_MANA_CLAIM, (state, playerId, effect) => {
    return handleManaClaim(state, playerId, effect as ManaClaimEffect);
  });

  registerEffect(EFFECT_RESOLVE_MANA_CLAIM_DIE, (state, playerId, effect) => {
    return resolveManaClaimDie(
      state,
      playerId,
      effect as ResolveManaClaimDieEffect
    );
  });

  registerEffect(EFFECT_RESOLVE_MANA_CLAIM_MODE, (state, playerId, effect) => {
    return resolveManaClaimMode(
      state,
      playerId,
      effect as ResolveManaClaimModeEffect
    );
  });

  registerEffect(EFFECT_MANA_CURSE, (state, playerId, effect) => {
    return handleManaCurse(state, playerId, effect as ManaCurseEffect);
  });
}
