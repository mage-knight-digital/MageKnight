/**
 * CardSelectionOverlay - Reusable modal for selecting cards from hand
 *
 * Used for:
 * - Rest completion (select cards to discard)
 * - Discard-as-cost effects (Improvisation, Ritual Attack, etc.)
 * - Any "select card(s) from hand" mechanic
 *
 * Features:
 * - Single and multi-select modes
 * - Skip button for optional selections
 * - Escape key triggers undo
 * - Card images via CSS sprite backgrounds (shared atlas, no second WebGL context)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { CardId } from "@mage-knight/shared";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { getCardSpriteStyle } from "../../utils/cardAtlas";
import "./CardSelectionOverlay.css";

export interface CardSelectionOverlayProps {
  /** Cards available to select */
  cards: readonly CardId[];
  /** Instruction text (e.g., "Select a card to discard") */
  instruction: string;
  /** Minimum cards to select (default 1) */
  minSelect?: number;
  /** Maximum cards to select (default 1) */
  maxSelect?: number;
  /** Show skip button for optional selections */
  canSkip?: boolean;
  /** Text for skip button (default "Skip") */
  skipText?: string;
  /** Called when selection is confirmed with selected cards */
  onSelect: (cards: readonly CardId[]) => void;
  /** Called when skip is clicked */
  onSkip?: () => void;
  /** Called when undo/cancel is triggered */
  onUndo?: () => void;
  /** Optional filter for which cards can be selected (returns true if selectable) */
  cardFilter?: (cardId: CardId) => boolean;
  /** Optional message explaining why filtered cards can't be selected */
  filterMessage?: string;
}

// Card dimensions for rendering
const CARD_WIDTH = 140;
const CARD_HEIGHT = 200;
const CARD_GAP = 16;

export function CardSelectionOverlay({
  cards,
  instruction,
  minSelect = 1,
  maxSelect = 1,
  canSkip = false,
  skipText = "Skip",
  onSelect,
  onSkip,
  onUndo,
  cardFilter,
  filterMessage,
}: CardSelectionOverlayProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Register this overlay to disable background interactions
  useRegisterOverlay(true);

  // Calculate which cards are selectable
  const selectableCards = useMemo(() => {
    if (!cardFilter) return new Set(cards);
    return new Set(cards.filter(cardFilter));
  }, [cards, cardFilter]);

  // Handle escape key for undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onUndo) {
        e.preventDefault();
        onUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onUndo]);

  // Focus the first selectable card when overlay opens
  useEffect(() => {
    // Delay focus to allow render to complete
    const timer = setTimeout(() => {
      const firstSelectable = containerRef.current?.querySelector(
        ".card-selection__card-overlay:not(.card-selection__card-overlay--disabled)"
      ) as HTMLElement | null;
      firstSelectable?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle card click by index (supports duplicate CardIds in hand)
  const handleCardClick = useCallback(
    (index: number) => {
      const cardId = cards[index] as CardId;

      // Ignore clicks on non-selectable cards
      if (!selectableCards.has(cardId)) return;

      setSelectedIndices((prev) => {
        const next = new Set(prev);

        if (next.has(index)) {
          // Deselect if already selected
          next.delete(index);
        } else if (next.size < maxSelect) {
          // Select if under limit
          next.add(index);
        } else if (maxSelect === 1) {
          // Single select mode: replace selection
          next.clear();
          next.add(index);
        }
        // If at max and multi-select, ignore (must deselect first)

        return next;
      });
    },
    [cards, maxSelect, selectableCards]
  );

  // Handle confirm - convert selected indices back to CardIds
  const handleConfirm = useCallback(() => {
    if (selectedIndices.size >= minSelect) {
      const selectedCardIds = Array.from(selectedIndices).map(
        (i) => cards[i] as CardId
      );
      onSelect(selectedCardIds);
    }
  }, [selectedIndices, minSelect, onSelect, cards]);

  // Check if confirm should be enabled
  const canConfirm = selectedIndices.size >= minSelect && selectedIndices.size <= maxSelect;

  // Calculate grid dimensions based on card count
  const cardsPerRow = Math.max(1, Math.min(cards.length, 4));
  const rows = cards.length > 0 ? Math.ceil(cards.length / cardsPerRow) : 0;

  // Build card positions
  const cardPositions = useMemo(() => {
    return cards.map((cardId, index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;

      // Center incomplete rows
      const cardsInThisRow =
        row === rows - 1 ? cards.length - row * cardsPerRow : cardsPerRow;
      const rowOffset =
        ((cardsPerRow - cardsInThisRow) * (CARD_WIDTH + CARD_GAP)) / 2;

      return {
        cardId,
        x: rowOffset + col * (CARD_WIDTH + CARD_GAP),
        y: row * (CARD_HEIGHT + CARD_GAP),
      };
    });
  }, [cards, cardsPerRow, rows]);

  // Determine selection indicator display
  const isSelectedAt = useCallback(
    (index: number) => selectedIndices.has(index),
    [selectedIndices]
  );

  const isSelectable = useCallback(
    (cardId: CardId) => selectableCards.has(cardId),
    [selectableCards]
  );

  const gridWidth = cards.length > 0 ? cardsPerRow * (CARD_WIDTH + CARD_GAP) - CARD_GAP : 0;
  const gridHeight = rows > 0 ? rows * (CARD_HEIGHT + CARD_GAP) - CARD_GAP : 0;

  return (
    <div className="overlay card-selection-overlay" ref={containerRef}>
      <div className="overlay__content card-selection">
        <h2 className="card-selection__title">{instruction}</h2>

        {filterMessage && (
          <p className="card-selection__filter-message">{filterMessage}</p>
        )}

        <div className="card-selection__info">
          {minSelect === maxSelect ? (
            <span>
              Select {minSelect} card{minSelect !== 1 ? "s" : ""}
            </span>
          ) : (
            <span>
              Select {minSelect}-{maxSelect} cards
            </span>
          )}
          <span className="card-selection__count">
            ({selectedIndices.size} selected)
          </span>
        </div>

        {cards.length > 0 ? (
          <div
            className="card-selection__cards"
            style={{ width: gridWidth, height: gridHeight }}
          >
            {cardPositions.map((card, index) => {
              const spriteStyle = getCardSpriteStyle(card.cardId, CARD_HEIGHT);

              return (
                <div
                  key={`${card.cardId}:${index}`}
                  className={[
                    "card-selection__card",
                    isSelectedAt(index)
                      ? "card-selection__card--selected"
                      : "",
                    !isSelectable(card.cardId)
                      ? "card-selection__card--disabled"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    left: card.x,
                    top: card.y,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    ...(spriteStyle ?? {}),
                  }}
                  onClick={() => handleCardClick(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardClick(index);
                    }
                  }}
                  role="button"
                  tabIndex={isSelectable(card.cardId) ? 0 : -1}
                  aria-pressed={isSelectedAt(index)}
                  aria-disabled={!isSelectable(card.cardId)}
                >
                  {isSelectedAt(index) && (
                    <div className="card-selection__checkmark">✓</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="card-selection__empty">No cards available to select.</p>
        )}

        <div className="card-selection__actions">
          {onUndo && (
            <button
              type="button"
              className="card-selection__button card-selection__button--secondary"
              onClick={onUndo}
            >
              Cancel
            </button>
          )}

          {canSkip && onSkip && (
            <button
              type="button"
              className="card-selection__button card-selection__button--secondary"
              onClick={onSkip}
            >
              {skipText}
            </button>
          )}

          <button
            type="button"
            className="card-selection__button card-selection__button--primary"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
