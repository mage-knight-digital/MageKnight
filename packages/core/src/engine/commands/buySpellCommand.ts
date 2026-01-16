/**
 * Buy Spell command
 *
 * Handles purchasing a spell from the spell offer:
 * - Consumes mana of the specified color
 * - Removes the spell from the offer
 * - Adds the spell to the player's discard pile
 * - Replenishes the offer from the spell deck
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState, ManaSource } from "../../state/GameState.js";
import type { CardId, ManaColor, GameEvent } from "@mage-knight/shared";
import type { ManaToken } from "../../types/player.js";
import type { SourceDieId } from "../../types/mana.js";
import {
  CARD_GAINED,
  CARD_GAIN_SOURCE_OFFER,
  OFFER_CARD_TAKEN,
  OFFER_TYPE_SPELLS,
  OFFER_REFRESHED,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";

export const BUY_SPELL_COMMAND = "BUY_SPELL" as const;

export interface BuySpellCommandParams {
  readonly playerId: string;
  readonly cardId: CardId;
  readonly manaPaid: ManaColor;
}

/**
 * Remove a spell from the offer and replenish from deck
 */
function removeSpellAndReplenish(
  offers: GameState["offers"],
  decks: GameState["decks"],
  cardId: CardId
): { offers: GameState["offers"]; decks: GameState["decks"]; replenished: boolean } {
  // Remove from offer
  const newCards = offers.spells.cards.filter((id) => id !== cardId);

  // Replenish from deck if available
  const spellDeck = decks.spells;
  const newCard = spellDeck[0];

  if (newCard !== undefined) {
    // Add top card from deck to offer
    const remainingDeck = spellDeck.slice(1);

    return {
      offers: {
        ...offers,
        spells: { cards: [...newCards, newCard] },
      },
      decks: {
        ...decks,
        spells: remainingDeck,
      },
      replenished: true,
    };
  }

  return {
    offers: {
      ...offers,
      spells: { cards: newCards },
    },
    decks,
    replenished: false,
  };
}

export function createBuySpellCommand(params: BuySpellCommandParams): Command {
  // Store previous state for undo
  let previousOffers: GameState["offers"] | null = null;
  let previousDecks: GameState["decks"] | null = null;
  let previousDiscard: readonly CardId[] = [];
  let previousHasTakenAction = false;
  let consumedManaToken: ManaToken | null = null;
  let consumedCrystalColor: keyof typeof crystalColors | null = null;
  let consumedDieId: SourceDieId | null = null;

  const crystalColors = {
    [MANA_RED]: "red" as const,
    [MANA_BLUE]: "blue" as const,
    [MANA_GREEN]: "green" as const,
    [MANA_WHITE]: "white" as const,
  };

  return {
    type: BUY_SPELL_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Store previous state for undo
      previousOffers = state.offers;
      previousDecks = state.decks;
      previousDiscard = player.discard;
      previousHasTakenAction = player.hasTakenActionThisTurn;

      // Find and consume mana source
      let updatedPlayer = { ...player };
      let updatedSource: ManaSource = state.source;

      // Try mana tokens first
      const tokenIndex = player.pureMana.findIndex(
        (t) => t.color === params.manaPaid
      );
      if (tokenIndex !== -1) {
        consumedManaToken = player.pureMana[tokenIndex] ?? null;
        updatedPlayer = {
          ...updatedPlayer,
          pureMana: [
            ...player.pureMana.slice(0, tokenIndex),
            ...player.pureMana.slice(tokenIndex + 1),
          ],
        };
      } else {
        // Try crystals (basic colors only)
        const crystalKey = crystalColors[params.manaPaid as keyof typeof crystalColors];
        if (crystalKey && player.crystals[crystalKey] > 0) {
          consumedCrystalColor = params.manaPaid as keyof typeof crystalColors;
          updatedPlayer = {
            ...updatedPlayer,
            crystals: {
              ...player.crystals,
              [crystalKey]: player.crystals[crystalKey] - 1,
            },
          };
        } else {
          // Try mana die from source
          const dieIndex = state.source.dice.findIndex(
            (d) =>
              d.color === params.manaPaid &&
              d.takenByPlayerId === null &&
              !d.isDepleted
          );
          if (dieIndex !== -1) {
            const die = state.source.dice[dieIndex];
            if (die) {
              consumedDieId = die.id;
              updatedSource = {
                ...state.source,
                dice: state.source.dice.map((d, i) =>
                  i === dieIndex ? { ...d, takenByPlayerId: params.playerId } : d
                ),
              };
            }
          }
        }
      }

      // Add spell to discard pile
      updatedPlayer = {
        ...updatedPlayer,
        discard: [...updatedPlayer.discard, params.cardId],
        hasTakenActionThisTurn: true,
      };

      const players = state.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

      // Remove spell from offer and replenish
      const { offers, decks, replenished } = removeSpellAndReplenish(
        state.offers,
        state.decks,
        params.cardId
      );

      const events: GameEvent[] = [
        {
          type: CARD_GAINED,
          playerId: params.playerId,
          cardId: params.cardId,
          source: CARD_GAIN_SOURCE_OFFER,
        },
        {
          type: OFFER_CARD_TAKEN,
          offerType: OFFER_TYPE_SPELLS,
          cardId: params.cardId,
        },
      ];

      if (replenished) {
        events.push({
          type: OFFER_REFRESHED,
          offerType: OFFER_TYPE_SPELLS,
        });
      }

      return {
        state: {
          ...state,
          players,
          offers,
          decks,
          source: updatedSource,
        },
        events,
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Restore player state
      let updatedPlayer = {
        ...player,
        discard: previousDiscard,
        hasTakenActionThisTurn: previousHasTakenAction,
      };

      // Restore mana source
      let updatedSource: ManaSource = state.source;

      if (consumedManaToken) {
        updatedPlayer = {
          ...updatedPlayer,
          pureMana: [...updatedPlayer.pureMana, consumedManaToken],
        };
      } else if (consumedCrystalColor) {
        const crystalKey = crystalColors[consumedCrystalColor];
        updatedPlayer = {
          ...updatedPlayer,
          crystals: {
            ...updatedPlayer.crystals,
            [crystalKey]: updatedPlayer.crystals[crystalKey] + 1,
          },
        };
      } else if (consumedDieId) {
        updatedSource = {
          ...state.source,
          dice: state.source.dice.map((d) =>
            d.id === consumedDieId ? { ...d, takenByPlayerId: null } : d
          ),
        };
      }

      const players = state.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

      return {
        state: {
          ...state,
          players,
          offers: previousOffers ?? state.offers,
          decks: previousDecks ?? state.decks,
          source: updatedSource,
        },
        events: [],
      };
    },
  };
}
