/**
 * End Turn Command
 *
 * Handles ending a player's turn. This command is irreversible and:
 * - Clears the command stack (no more undo)
 * - Expires "turn" duration modifiers
 * - Moves play area cards to discard
 * - Draws cards up to hand limit (no mid-round reshuffle)
 * - Resets turn state (movePoints, mana, combat accumulator, etc.)
 * - Advances to next player (or triggers round end if final turns complete)
 *
 * @module commands/endTurn
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { SourceDieId } from "../../../types/mana.js";
import type { CardEffect } from "../../../types/cards.js";
import type { GameEvent } from "@mage-knight/shared";
import { TURN_ENDED, GAME_ENDED, GAME_PHASE_END } from "@mage-knight/shared";
import { expireModifiers } from "../../modifiers/index.js";
import { EXPIRATION_TURN_END } from "../../../types/modifierConstants.js";
import { END_TURN_COMMAND } from "../commandTypes.js";
import { createEndRoundCommand } from "../endRound/index.js";
import { isDummyPlayer } from "../../../types/dummyPlayer.js";
import { executeDummyPlayerTurn } from "../dummyTurnCommand.js";
import { applyRoundAnnouncement } from "../roundAnnouncement.js";

import type { EndTurnCommandParams } from "./types.js";
import { checkMagicalGladeWound, processMineRewards, checkCrystalJoyReclaim, checkSteadyTempoDeckPlacement, checkBannerProtectionWoundRemoval } from "./siteChecks.js";
import { processCardFlow, processTimeBendingCardFlow, getPlayAreaCardCount } from "./cardFlow.js";
import { createResetPlayer } from "./playerReset.js";
import { processDiceReturn } from "./diceManagement.js";
import { determineNextPlayer, setupNextPlayer } from "./turnAdvancement.js";
import { resetManaCurseWoundTracking } from "../../effects/manaClaimEffects.js";
import { returnSpentCrystals } from "../../effects/crystalMasteryEffects.js";
import { processLevelUps } from "./levelUp.js";
import { calculateRingFameBonus } from "./ringFameBonus.js";
import { isRuleActive } from "../../modifiers/index.js";
import { RULE_TIME_BENDING_ACTIVE } from "../../../types/modifierConstants.js";
import { processSourceOpeningCrystal } from "./sourceOpeningCrystal.js";
import { applyMountainLoreEndTurnBonus } from "./mountainLoreBonus.js";
import { processMysteriousBoxCleanup } from "./mysteriousBoxCleanup.js";
import { expireManaEnhancementAtTurnStart } from "../skills/index.js";
import { EFFECT_NOOP } from "../../../types/effectTypes.js";

export { END_TURN_COMMAND };
export type { EndTurnCommandParams };

export function createEndTurnCommand(params: EndTurnCommandParams): Command {
  return {
    type: END_TURN_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      // Find current player
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const currentPlayer = state.players[playerIndex];
      if (!currentPlayer) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Minimum turn requirement fallback:
      // If no card was played/discarded yet and cards remain in hand, force a
      // mandatory 1-card discard before completing end-of-turn processing.
      const isForfeitingViaRoundAnnouncement =
        state.endOfRoundAnnouncedBy === params.playerId && currentPlayer.deck.length === 0;

      if (
        !isForfeitingViaRoundAnnouncement &&
        !currentPlayer.playedCardFromHandThisTurn &&
        currentPlayer.hand.length > 0 &&
        currentPlayer.pendingDiscard === null
      ) {
        const noopEffect: CardEffect = { type: EFFECT_NOOP };
        const sourceCardId = currentPlayer.hand[0];
        if (!sourceCardId) {
          throw new Error("Expected a card in hand for mandatory end-turn discard");
        }

        const updatedPlayers = [...state.players];
        updatedPlayers[playerIndex] = {
          ...currentPlayer,
          pendingDiscard: {
            sourceCardId,
            count: 1,
            optional: false,
            filterWounds: false,
            thenEffect: noopEffect,
            satisfiesMinimumTurnRequirementOnResolve: true,
          },
        };

        return {
          state: { ...state, players: updatedPlayers },
          events: [],
        };
      }

      // Check for Magical Glade wound discard opportunity
      const gladeCheck = checkMagicalGladeWound(
        state,
        currentPlayer,
        params.skipGladeWoundCheck ?? false
      );
      if (gladeCheck.pendingChoice) {
        return {
          state: {
            ...state,
            players: state.players.map((p) =>
              p.id === params.playerId ? gladeCheck.player : p
            ),
          },
          events: [],
        };
      }

      // Auto-announce end of round if deck and hand are both empty
      if (
        !(params.skipAutoAnnounce ?? false) &&
        currentPlayer.deck.length === 0 &&
        currentPlayer.hand.length === 0 &&
        state.endOfRoundAnnouncedBy === null
      ) {
        const announcement = applyRoundAnnouncement(state, params.playerId);
        const forfeitedTurnResult = createEndTurnCommand({
          ...params,
          skipAutoAnnounce: true,
        }).execute(announcement.state);
        return {
          state: forfeitedTurnResult.state,
          events: [announcement.event, ...forfeitedTurnResult.events],
        };
      }

      // Check for mine crystal rewards
      const mineCheck = processMineRewards(
        state,
        currentPlayer,
        params.skipDeepMineCheck ?? false
      );
      if (mineCheck.pendingChoice) {
        return {
          state: {
            ...state,
            players: state.players.map((p) =>
              p.id === params.playerId ? mineCheck.player : p
            ),
          },
          events: [],
        };
      }

      const playerWithCrystal = mineCheck.player;
      const crystalEvents = mineCheck.events;

      // Check for Crystal Joy reclaim choice (before step 3: discard down)
      const joyReclaimCheck = checkCrystalJoyReclaim(
        state,
        playerWithCrystal,
        params.skipCrystalJoyReclaim ?? false
      );
      if (joyReclaimCheck.pendingChoice) {
        return {
          state: {
            ...state,
            players: state.players.map((p) =>
              p.id === params.playerId ? joyReclaimCheck.player : p
            ),
          },
          events: [],
        };
      }

      // Check for Steady Tempo deck placement (step 3b: before card flow)
      const steadyTempoCheck = checkSteadyTempoDeckPlacement(
        state,
        playerWithCrystal,
        params.skipSteadyTempo ?? false
      );
      if (steadyTempoCheck.pendingChoice) {
        return {
          state: {
            ...state,
            players: state.players.map((p) =>
              p.id === params.playerId ? steadyTempoCheck.player : p
            ),
          },
          events: [],
        };
      }

      // Check for Banner of Protection wound removal (step 3c: before card flow)
      const bannerProtectionCheck = checkBannerProtectionWoundRemoval(
        state,
        playerWithCrystal,
        params.skipBannerProtection ?? false
      );
      if (bannerProtectionCheck.pendingChoice) {
        return {
          state: {
            ...state,
            players: state.players.map((p) =>
              p.id === params.playerId ? bannerProtectionCheck.player : p
            ),
          },
          events: [],
        };
      }

      // Mysterious Box: apply per-turn card-fate cleanup and restore revealed artifact to deck.
      // This happens before draw-up so "unused" can return to hand in time to affect hand limit.
      const stateWithSiteUpdates = {
        ...state,
        players: state.players.map((p) =>
          p.id === params.playerId ? playerWithCrystal : p
        ),
      };
      const mysteriousBoxCleanup = processMysteriousBoxCleanup(
        stateWithSiteUpdates,
        playerWithCrystal
      );
      const stateAfterMysteriousBox = mysteriousBoxCleanup.state;
      const playerAfterMysteriousBox = mysteriousBoxCleanup.player;

      // Crystal Mastery: return spent crystals before reset clears tracking
      const playerAfterCrystalReturn = returnSpentCrystals(playerAfterMysteriousBox);

      // Calculate Ring artifacts fame bonus before reset clears spell tracking
      // This grants fame for each spell of the ring's color cast this turn
      const ringFameResult = calculateRingFameBonus(
        stateAfterMysteriousBox,
        playerAfterCrystalReturn
      );
      const playerWithRingFame = ringFameResult.player;

      // Process pending level-ups BEFORE card flow so we know if we should draw
      const playerForLevelUpCheck = playerWithRingFame;
      const levelUpResult = playerForLevelUpCheck.pendingLevelUps.length > 0
        ? processLevelUps(playerForLevelUpCheck, state.rng)
        : { player: playerForLevelUpCheck, events: [], rng: state.rng };

      const playerAfterLevelUp = levelUpResult.player;
      const hasPendingEvenLevelReward = playerAfterLevelUp.pendingLevelUpRewards.length > 0;

      // Check if Time Bending (Space Bending powered) is active
      // Must check BEFORE modifiers are expired (they expire later)
      const isTimeBendingActive = isRuleActive(
        stateAfterMysteriousBox,
        params.playerId,
        RULE_TIME_BENDING_ACTIVE
      );

      // Mountain Lore: if ending in hills/mountains, apply next-draw hand limit bonus.
      // This must happen before card flow so draw-up uses the updated hand limit.
      const mountainLoreResult = applyMountainLoreEndTurnBonus(
        stateAfterMysteriousBox,
        playerAfterLevelUp
      );
      const stateForCardFlow = mountainLoreResult.state;
      const playerForCardFlow = mountainLoreResult.player;

      // Process card flow (play area to discard, draw cards)
      // Skip drawing if player has pending level-up rewards - they'll draw after selecting
      const playAreaCount = getPlayAreaCardCount(currentPlayer);
      let cardFlow: ReturnType<typeof processCardFlow>;
      if (isTimeBendingActive) {
        // Time Bending: return played cards to hand, set aside Space Bending, skip draw
        cardFlow = processTimeBendingCardFlow(stateForCardFlow, playerForCardFlow);
      } else if (hasPendingEvenLevelReward) {
        // Just move play area to discard, don't draw yet
        cardFlow = {
          cardsDrawn: 0,
          hand: playerForCardFlow.hand,
          deck: playerForCardFlow.deck,
          playArea: [],
          discard: [...playerForCardFlow.discard, ...playerForCardFlow.playArea],
        };
      } else {
        cardFlow = processCardFlow(stateForCardFlow, playerForCardFlow);
      }

      // Reset player state
      const resetPlayer = createResetPlayer(playerAfterLevelUp, cardFlow);

      // Update players array
      const updatedPlayers: Player[] = [...state.players];
      updatedPlayers[playerIndex] = resetPlayer;

      // Process Source Opening crystal grant.
      // Uses currentPlayer (pre-reset) whose usedDieIds are still available.
      // Pass a copy of updatedPlayers to avoid shared-reference mutation.
      const sourceOpeningResult = processSourceOpeningCrystal(
        { ...stateAfterMysteriousBox, players: [...updatedPlayers] },
        params.playerId,
        currentPlayer
      );
      const stateWithSourceOpeningCrystal = sourceOpeningResult.state;
      // Re-extract the players array (crystal may have been granted to owner)
      updatedPlayers.length = 0;
      updatedPlayers.push(...stateWithSourceOpeningCrystal.players);

      // Check for Source Opening reroll choice (FAQ S3: player chooses before other dice reroll)
      if (
        sourceOpeningResult.extraDieId &&
        !(params.skipSourceOpeningReroll ?? false)
      ) {
        // Set pending choice on the returning player
        const returningPlayerIdx = updatedPlayers.findIndex(
          (p) => p.id === params.playerId
        );
        if (returningPlayerIdx !== -1) {
          updatedPlayers[returningPlayerIdx] = {
            ...updatedPlayers[returningPlayerIdx]!,
            pendingSourceOpeningRerollChoice: sourceOpeningResult.extraDieId,
          };
          return {
            state: {
              ...stateWithSourceOpeningCrystal,
              players: updatedPlayers,
            },
            events: [],
          };
        }
      }

      // Process dice (reroll used, return mana draw, handle mana steal)
      // If Source Opening reroll was already handled, exclude that die from auto-reroll
      const skipRerollDieIds = params.sourceOpeningDieHandled
        ? new Set<SourceDieId>([params.sourceOpeningDieHandled as SourceDieId])
        : undefined;
      const diceResult = processDiceReturn(
        stateWithSourceOpeningCrystal,
        currentPlayer,
        updatedPlayers,
        skipRerollDieIds
      );

      // Expire turn-duration modifiers
      let newState = expireModifiers(
        {
          ...stateWithSourceOpeningCrystal,
          players: diceResult.players,
          source: diceResult.source,
          rng: diceResult.rng,
        },
        { type: EXPIRATION_TURN_END, playerId: params.playerId }
      );

      // Determine next player and track final turns
      // Pass isTimeBendingActive since the modifier was already expired above
      let nextPlayerResult = determineNextPlayer(newState, params.playerId, isTimeBendingActive);

      newState = {
        ...newState,
        playersWithFinalTurn: nextPlayerResult.playersWithFinalTurn,
        finalTurnsRemaining: nextPlayerResult.finalTurnsRemaining,
        currentPlayerIndex: nextPlayerResult.currentPlayerIndex,
      };

      // Handle dummy player turns: if the next player is the dummy,
      // execute dummy turns automatically until a human is next or round ends.
      let dummyEvents: GameEvent[] = [];
      if (
        !nextPlayerResult.shouldTriggerRoundEnd &&
        nextPlayerResult.nextPlayerId &&
        isDummyPlayer(nextPlayerResult.nextPlayerId)
      ) {
        const dummyResult = executeDummyPlayerTurn(newState);
        newState = dummyResult.state;
        dummyEvents = dummyResult.events;

        if (dummyResult.announcedEndOfRound) {
          // Dummy announced end of round — advance past dummy to next human
          const dummyIdx = newState.turnOrder.indexOf(nextPlayerResult.nextPlayerId);
          const nextIdx = (dummyIdx + 1) % newState.turnOrder.length;
          nextPlayerResult = {
            ...nextPlayerResult,
            nextPlayerId: newState.turnOrder[nextIdx] ?? null,
            currentPlayerIndex: nextIdx,
          };
        } else {
          // Dummy took a turn — advance to next player after dummy
          const dummyIdx = newState.turnOrder.indexOf(nextPlayerResult.nextPlayerId);
          const nextIdx = (dummyIdx + 1) % newState.turnOrder.length;
          nextPlayerResult = {
            ...nextPlayerResult,
            nextPlayerId: newState.turnOrder[nextIdx] ?? null,
            currentPlayerIndex: nextIdx,
          };
        }
      }

      // Set up next player if not ending round
      let gladeManaEvent: GameEvent | null = null;
      if (
        !nextPlayerResult.shouldTriggerRoundEnd &&
        nextPlayerResult.nextPlayerId &&
        !isDummyPlayer(nextPlayerResult.nextPlayerId)
      ) {
        newState = expireManaEnhancementAtTurnStart(
          newState,
          nextPlayerResult.nextPlayerId
        );

        const currentPlayerAfterReset = newState.players.find(
          (p) => p.id === params.playerId
        );
        const isExtraTurn =
          currentPlayerAfterReset?.tacticState?.extraTurnPending === true ||
          isTimeBendingActive;

        const setupResult = setupNextPlayer(
          newState,
          nextPlayerResult.nextPlayerId,
          isExtraTurn,
          params.playerId,
          isTimeBendingActive
        );
        newState = { ...newState, players: setupResult.players };
        gladeManaEvent = setupResult.gladeManaEvent;

        // Reset Mana Curse per-turn wound tracking for the new turn
        newState = resetManaCurseWoundTracking(newState);
      }

      // Update currentPlayerIndex from nextPlayerResult
      newState = {
        ...newState,
        currentPlayerIndex: nextPlayerResult.currentPlayerIndex,
      };

      // Build events
      const events: GameEvent[] = [
        ...crystalEvents,
        {
          type: TURN_ENDED,
          playerId: params.playerId,
          nextPlayerId: nextPlayerResult.nextPlayerId,
          cardsDiscarded: playAreaCount,
          cardsDrawn: cardFlow.cardsDrawn,
        },
        ...dummyEvents,
        ...(gladeManaEvent ? [gladeManaEvent] : []),
        ...levelUpResult.events,
      ];

      // Update state with level-up result (already processed above)
      newState = {
        ...newState,
        rng: levelUpResult.rng,
      };

      // Trigger game end if scenario final turns complete
      if (nextPlayerResult.shouldTriggerGameEnd) {
        const finalScores = newState.players.map((p) => ({
          playerId: p.id,
          score: p.fame,
        }));
        finalScores.sort((a, b) => b.score - a.score);
        const winningPlayerId = finalScores[0]?.playerId ?? null;

        newState = {
          ...newState,
          phase: GAME_PHASE_END,
          gameEnded: true,
          winningPlayerId,
        };

        events.push({
          type: GAME_ENDED,
          winningPlayerId,
          finalScores,
        });

        return { state: newState, events };
      }

      // Trigger round end if all final turns complete
      if (nextPlayerResult.shouldTriggerRoundEnd) {
        const endRoundCommand = createEndRoundCommand();
        const roundEndResult = endRoundCommand.execute(newState);
        return {
          state: roundEndResult.state,
          events: [...events, ...roundEndResult.events],
        };
      }

      return { state: newState, events };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo END_TURN");
    },
  };
}
