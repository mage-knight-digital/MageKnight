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
 * - GPU-rendered card images via PixiJS
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { CardId } from "@mage-knight/shared";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { PixiCardCanvas, type CardRenderInfo } from "../PixiCard/PixiCardCanvas";
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
  const [selectedCards, setSelectedCards] = useState<Set<CardId>>(new Set());
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

  // Handle card click
  const handleCardClick = useCallback(
    (cardId: string) => {
      const id = cardId as CardId;

      // Ignore clicks on non-selectable cards
      if (!selectableCards.has(id)) return;

      setSelectedCards((prev) => {
        const next = new Set(prev);

        if (next.has(id)) {
          // Deselect if already selected
          next.delete(id);
        } else if (next.size < maxSelect) {
          // Select if under limit
          next.add(id);
        } else if (maxSelect === 1) {
          // Single select mode: replace selection
          next.clear();
          next.add(id);
        }
        // If at max and multi-select, ignore (must deselect first)

        return next;
      });
    },
    [maxSelect, selectableCards]
  );

  // Handle confirm
  const handleConfirm = useCallback(() => {
    if (selectedCards.size >= minSelect) {
      onSelect(Array.from(selectedCards));
    }
  }, [selectedCards, minSelect, onSelect]);

  // Check if confirm should be enabled
  const canConfirm = selectedCards.size >= minSelect && selectedCards.size <= maxSelect;

  // Calculate canvas dimensions based on card count
  const cardsPerRow = Math.max(1, Math.min(cards.length, 4));
  const rows = cards.length > 0 ? Math.ceil(cards.length / cardsPerRow) : 0;
  const canvasWidth = cards.length > 0 ? cardsPerRow * (CARD_WIDTH + CARD_GAP) - CARD_GAP : 0;
  const canvasHeight = rows > 0 ? rows * (CARD_HEIGHT + CARD_GAP) - CARD_GAP : 0;

  // Build card render info with positions
  const cardRenderInfo: CardRenderInfo[] = useMemo(() => {
    return cards.map((cardId, index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;

      // Center incomplete rows
      const cardsInThisRow =
        row === rows - 1 ? cards.length - row * cardsPerRow : cardsPerRow;
      const rowOffset =
        ((cardsPerRow - cardsInThisRow) * (CARD_WIDTH + CARD_GAP)) / 2;

      return {
        id: cardId,
        x: rowOffset + col * (CARD_WIDTH + CARD_GAP),
        y: row * (CARD_HEIGHT + CARD_GAP),
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      };
    });
  }, [cards, cardsPerRow, rows]);

  // Determine selection indicator display (handled via CSS overlay)
  const isSelected = useCallback(
    (cardId: CardId) => selectedCards.has(cardId),
    [selectedCards]
  );

  const isSelectable = useCallback(
    (cardId: CardId) => selectableCards.has(cardId),
    [selectableCards]
  );

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
            ({selectedCards.size} selected)
          </span>
        </div>

        {cards.length > 0 ? (
          <div className="card-selection__cards">
            {/* Selection overlay layer on top of PixiJS canvas */}
            <div
              className="card-selection__overlay-layer"
              style={{ width: canvasWidth, height: canvasHeight }}
            >
              {cardRenderInfo.map((card) => (
                <div
                  key={card.id}
                  className={[
                    "card-selection__card-overlay",
                    isSelected(card.id as CardId)
                      ? "card-selection__card-overlay--selected"
                      : "",
                    !isSelectable(card.id as CardId)
                      ? "card-selection__card-overlay--disabled"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    left: card.x,
                    top: card.y,
                    width: card.width,
                    height: card.height,
                  }}
                  onClick={() => handleCardClick(card.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardClick(card.id);
                    }
                  }}
                  role="button"
                  tabIndex={isSelectable(card.id as CardId) ? 0 : -1}
                  aria-pressed={isSelected(card.id as CardId)}
                  aria-disabled={!isSelectable(card.id as CardId)}
                >
                  {isSelected(card.id as CardId) && (
                    <div className="card-selection__checkmark">✓</div>
                  )}
                </div>
              ))}
            </div>

            {/* PixiJS canvas for card rendering */}
            <PixiCardCanvas
              cards={cardRenderInfo}
              width={canvasWidth}
              height={canvasHeight}
              backgroundColor={0x16213e}
              className="card-selection__canvas"
            />
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
