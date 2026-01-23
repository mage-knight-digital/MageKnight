import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { PixiFloatingHand, DeckDiscardIndicator, type CardClickInfo } from "./PixiFloatingHand";
import { FloatingUnitCarousel } from "./FloatingUnitCarousel";
import { PixiTacticCarousel } from "./PixiTacticCarousel";
import { type CardId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useCardInteraction } from "../CardInteraction";

// Menu state types
type MenuState =
  | { type: "none" }
  | { type: "card-action"; cardIndex: number; sourceRect: DOMRect };

// Hand view modes (Inscryption style)
// offer: looking up at offer tray (above board)
// board: cards completely hidden, full board view
// ready: cards peeking ~33%, ready to play
// focus: cards large ~80%, studying hand
type HandView = "offer" | "board" | "ready" | "focus";

// Carousel axis: tactics -> cards -> units
type CarouselPane = "tactics" | "cards" | "units";

// Export hand view type for other components
export type { HandView };

export interface PlayerHandProps {
  onOfferViewChange?: (isVisible: boolean) => void;
}

export function PlayerHand({ onOfferViewChange }: PlayerHandProps = {}) {
  const { state } = useGame();
  const player = useMyPlayer();
  const { state: cardInteractionState, dispatch: cardInteractionDispatch } = useCardInteraction();
  const [menuState, setMenuState] = useState<MenuState>({ type: "none" });
  const [handView, setHandView] = useState<HandView>("ready");
  // Default to tactics - most game loads are at round start with tactic selection
  // The useEffect below handles moving to cards if tactic is already selected
  const [carouselPane, setCarouselPane] = useState<CarouselPane>("tactics");

  // Track whether we need tactic selection (for auto-navigation)
  const needsTacticSelection = !!(
    player &&
    player.selectedTacticId === null &&
    state?.validActions.tactics
  );

  // Track previous tactic selection state to detect when selection completes
  const prevNeedsTacticRef = useRef<boolean | null>(null); // null = not yet initialized

  // Track previous view mode (excluding offer) so children don't transition when entering offer view
  // This prevents expensive transform changes while the carousel is fading out
  const prevViewModeRef = useRef<Exclude<HandView, "offer">>("ready");

  // Update prevViewModeRef when handView changes to a non-offer mode
  useEffect(() => {
    if (handView !== "offer") {
      prevViewModeRef.current = handView as Exclude<HandView, "offer">;
    }
  }, [handView]);

  // Auto-navigate to tactics pane when tactic selection is needed (start of round)
  // Auto-navigate away from tactics pane when tactic is selected
  useEffect(() => {
    const isFirstRun = prevNeedsTacticRef.current === null;

    if (isFirstRun && needsTacticSelection) {
      // Initial load and tactic selection is needed - start on tactics pane
      setCarouselPane("tactics");
    } else if (needsTacticSelection && prevNeedsTacticRef.current === false) {
      // Tactic selection just became needed (new round started)
      setCarouselPane("tactics");
    } else if (!needsTacticSelection && prevNeedsTacticRef.current === true) {
      // Tactic was just selected, move to cards
      setCarouselPane("cards");
    } else if (!needsTacticSelection && carouselPane === "tactics") {
      // Edge case: on tactics pane but shouldn't be (e.g., page load after selection)
      setCarouselPane("cards");
    }
    prevNeedsTacticRef.current = needsTacticSelection;
  }, [needsTacticSelection, carouselPane]);

  // Notify parent when offer view state changes
  useEffect(() => {
    onOfferViewChange?.(handView === "offer");
  }, [handView, onOfferViewChange]);

  // Sync local menuState with CardInteraction context state
  // Clear menuState when:
  // - context returns to idle (action completed)
  // - context transitions to completing/effect-choice (card has been played, no longer in hand)
  useEffect(() => {
    const shouldClearMenu =
      cardInteractionState.type === "idle" ||
      cardInteractionState.type === "completing" ||
      cardInteractionState.type === "effect-choice";

    if (shouldClearMenu && menuState.type !== "none") {
      setMenuState({ type: "none" });
    }
  }, [cardInteractionState.type, menuState.type]);

  // Keyboard controls:
  // 1/2/3/4 = direct view mode selection (offer/board/ready/focus)
  // Q/W/E = direct carousel pane selection (tactics/cards/units) - disabled when in offer view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();

      // View mode keys: 1=focus, 2=ready, 3=board (map), 4=offer
      if (key === "1") {
        setHandView("focus");
      } else if (key === "2") {
        setHandView("ready");
      } else if (key === "3") {
        setHandView("board");
      } else if (key === "4") {
        setHandView("offer");
      } else if (key === "q" || key === "w" || key === "e") {
        // Q/W/E carousel navigation - only when NOT in offer view
        // (Offer view has its own Q/W/E handling for Units/Spells/AAs)
        setHandView(current => {
          if (current === "offer") {
            // Don't handle carousel navigation when in offer view
            return current;
          }

          if (key === "q") {
            // Tactics pane - only if tactic selection is needed
            if (needsTacticSelection) {
              setCarouselPane("tactics");
            }
          } else if (key === "w") {
            // Cards pane
            setCarouselPane("cards");
          } else if (key === "e") {
            // Units pane
            setCarouselPane("units");
          }

          return current;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [needsTacticSelection]);

  // Get playable cards from validActions - memoized to avoid hook dependency issues
  const playableCardMap = useMemo(() => {
    if (!state) return new Map();
    const playableCards = state.validActions.playCard?.cards ?? [];
    return new Map(playableCards.map(c => [c.cardId, c]));
  }, [state]);

  // Cast hand to array - memoized for stable reference
  const handArray = useMemo(
    () => (player?.hand ?? []) as readonly CardId[],
    [player?.hand]
  );

  // Get selected card info from menu state
  const selectedIndex = menuState.type !== "none" ? menuState.cardIndex : null;

  const handleCardClick = useCallback((info: CardClickInfo) => {
    const { index, rect } = info;
    const cardId = handArray[index];
    if (!cardId) return;

    const playability = playableCardMap.get(cardId);

    // Don't allow selecting non-playable cards
    if (!playability) {
      return;
    }

    if (menuState.type !== "none" && menuState.cardIndex === index) {
      // Clicking same card again deselects
      setMenuState({ type: "none" });
      cardInteractionDispatch({ type: "CLOSE_MENU" });
    } else {
      // Show card action menu - dispatch to new unified system
      setMenuState({ type: "card-action", cardIndex: index, sourceRect: rect });
      cardInteractionDispatch({
        type: "OPEN_MENU",
        cardId,
        cardIndex: index,
        playability,
        sourceRect: rect,
      });
    }
  }, [handArray, playableCardMap, menuState, cardInteractionDispatch]);

  // Early return after all hooks
  if (!player || !Array.isArray(player.hand) || !state) {
    return null;
  }

  return (
    <>
      {/* PixiJS Tactic Carousel - renders to overlay layer, visibility controlled by isActive */}
      <PixiTacticCarousel
        viewMode={handView === "offer" ? prevViewModeRef.current : handView}
        isActive={carouselPane === "tactics"}
      />

      {/* PixiJS Floating Hand - renders to overlay layer, visibility controlled by isActive */}
      <PixiFloatingHand
        hand={handArray}
        playableCards={playableCardMap}
        selectedIndex={selectedIndex}
        onCardClick={handleCardClick}
        deckCount={player.deckCount}
        discardCount={player.discardCount}
        viewMode={handView === "offer" ? prevViewModeRef.current : handView}
        isActive={carouselPane === "cards"}
      />

      {/* Carousel track - slides horizontally between tactics, cards, and units */}
      {/* PixiJS components render independently; this track handles DOM-based panes (units) */}
      {/* Hidden when in offer view - children keep their current viewMode to avoid transform jank */}
      <div className={`carousel-track carousel-track--${carouselPane} ${handView === "offer" ? "carousel-track--hidden" : ""}`}>
        {/* Tactics pane (leftmost position) - rendered via PixiJS overlay */}
        <div className="carousel-track__pane carousel-track__pane--tactics">
          {/* PixiTacticCarousel renders above */}
        </div>

        {/* Cards pane (middle position) - rendered via PixiJS overlay */}
        <div className="carousel-track__pane carousel-track__pane--cards">
          {/* PixiFloatingHand renders above */}
        </div>

        {/* Units pane (rightmost position) */}
        <div className="carousel-track__pane carousel-track__pane--units">
          <FloatingUnitCarousel
            units={player.units}
            viewMode={handView === "offer" ? prevViewModeRef.current : handView}
            commandTokens={player.commandTokens}
          />
        </div>
      </div>

      {/* Deck/Discard - fixed position outside carousel, hidden in offer/board/focus view */}
      <DeckDiscardIndicator
        deckCount={player.deckCount}
        discardCount={player.discardCount}
        isHidden={handView === "focus" || handView === "offer" || handView === "board"}
      />
    </>
  );
}
