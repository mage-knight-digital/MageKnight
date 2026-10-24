import { useState, useCallback, useMemo, useEffect } from "react";
import { PixiFloatingHand, type CardClickInfo } from "./PixiFloatingHand";
import { DeckDiscardIndicator } from "./DeckDiscardIndicator";
import "./PlayerHand.css";
import { PixiUnitCarousel, type UnitClickInfo } from "./PixiUnitCarousel";
import { PixiTacticCarousel } from "./PixiTacticCarousel";
import { UnitAbilityMenu } from "./UnitAbilityMenu";
import { type CardId, type UnitId, type ActivatableUnit } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useIsMyTurn } from "../../hooks/useIsMyTurn";
import { useCardInteraction } from "../CardInteraction";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { groupCardActions, extractTacticOptions, extractUnitActions } from "../../rust/legalActionUtils";
import { isEditableHotkeyTarget, matchesHotkey } from "../../utils/hotkeys";

// Menu state types
type MenuState =
  | { type: "none" }
  | { type: "card-action"; cardIndex: number; sourceRect: DOMRect }
  | { type: "unit-action"; unitIndex: number; unitInstanceId: string; unitId: UnitId; activatableInfo: ActivatableUnit; sourceRect: DOMRect };

const NO_MENU_STATE: MenuState = { type: "none" };

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
  const { state, legalActions } = useGame();
  const player = useMyPlayer();
  const isMyTurn = useIsMyTurn();
  const { state: cardInteractionState, dispatch: cardInteractionDispatch } = useCardInteraction();
  const [menuState, setMenuState] = useState<MenuState>({ type: "none" });
  const [handView, setHandView] = useState<HandView>("ready");
  // Default to tactics - most game loads are at round start with tactic selection
  // Render-time synchronization moves to cards when no tactic is pending.
  const [carouselPane, setCarouselPane] = useState<CarouselPane>("tactics");

  // Register focus mode as an overlay to suppress hex tooltips
  useRegisterOverlay(handView === "focus");

  // Derive tactic options from legalActions
  const tacticOptions = useMemo(
    () => extractTacticOptions(legalActions),
    [legalActions]
  );

  // Track whether we need tactic selection (for auto-navigation)
  const needsTacticSelection = tacticOptions.length > 0;

  // Track previous tactic selection state to detect when selection completes
  const [prevNeedsTacticSelection, setPrevNeedsTacticSelection] =
    useState<boolean | null>(null);

  // Track previous view mode (excluding offer) so children don't transition when entering offer view
  // This prevents expensive transform changes while the carousel is fading out
  const [prevViewMode, setPrevViewMode] = useState<Exclude<HandView, "offer">>("ready");

  if (handView !== "offer" && handView !== prevViewMode) {
    setPrevViewMode(handView);
  }

  // Derive the carousel pane from tactic availability during render so the UI
  // changes in the same commit as legalActions.
  if (prevNeedsTacticSelection !== needsTacticSelection) {
    if (needsTacticSelection) {
      setCarouselPane("tactics");
    } else if (prevNeedsTacticSelection === true) {
      setCarouselPane("cards");
    }
    setPrevNeedsTacticSelection(needsTacticSelection);
  } else if (!needsTacticSelection && carouselPane === "tactics") {
    setCarouselPane("cards");
  }

  // Notify parent when offer view state changes
  useEffect(() => {
    onOfferViewChange?.(handView === "offer");
  }, [handView, onOfferViewChange]);

  // Keyboard controls:
  // 1/2/3/4 = direct view mode selection (offer/board/ready/focus)
  // Q/W/E = direct carousel pane selection (tactics/cards/units) - disabled when in offer view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (isEditableHotkeyTarget(e.target)) {
        return;
      }

      // View mode keys: 1=focus, 2=ready, 3=board (map), 4=offer
      if (matchesHotkey(e, ["1"], ["Digit1", "Numpad1"])) {
        setHandView("focus");
      } else if (matchesHotkey(e, ["2"], ["Digit2", "Numpad2"])) {
        setHandView("ready");
      } else if (matchesHotkey(e, ["3"], ["Digit3", "Numpad3"])) {
        setHandView("board");
      } else if (matchesHotkey(e, ["4"], ["Digit4", "Numpad4"])) {
        setHandView("offer");
      } else if (
        matchesHotkey(e, ["q"], ["KeyQ"]) ||
        matchesHotkey(e, ["w"], ["KeyW"]) ||
        matchesHotkey(e, ["e"], ["KeyE"])
      ) {
        // Q/W/E carousel navigation - only when NOT in offer view
        // (Offer view has its own Q/W/E handling for Units/Spells/AAs)
        setHandView(current => {
          if (current === "offer") {
            // Don't handle carousel navigation when in offer view
            return current;
          }

          if (matchesHotkey(e, ["q"], ["KeyQ"])) {
            // Tactics pane - only if tactic selection is needed
            if (needsTacticSelection) {
              setCarouselPane("tactics");
            }
          } else if (matchesHotkey(e, ["w"], ["KeyW"])) {
            // Cards pane
            setCarouselPane("cards");
          } else if (matchesHotkey(e, ["e"], ["KeyE"])) {
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

  // Derive card action groups from legalActions
  const cardActions = useMemo(
    () => groupCardActions(legalActions),
    [legalActions]
  );

  // Get playable cards — convert CardActionGroup to a PlayableCard-compatible shape
  const playableCardMap = useMemo(() => {
    const map = new Map();
    for (const [cardId, group] of cardActions) {
      map.set(cardId, {
        cardId,
        handIndex: group.handIndex,
        canPlayBasic: !!group.basic,
        canPlayPowered: group.powered.length > 0,
        requiredMana: group.powered[0]?.manaColor ?? null,
        isSpell: false, // Rust doesn't distinguish — not needed for action dispatch
        canPlaySideways: group.sideways.length > 0,
        sidewaysOptions: group.sideways.map((s: { sidewaysAs: string }) => ({
          as: s.sidewaysAs,
          value: 1,
        })),
        // Carry the action group for UnifiedCardMenu to use
        _rustActions: group,
      });
    }
    return map;
  }, [cardActions]);

  // Cast hand to array - memoized for stable reference
  const handArray = useMemo(
    () => (player?.hand ?? []) as readonly CardId[],
    [player?.hand]
  );

  // Derive unit activations from legalActions
  const unitActions = useMemo(
    () => extractUnitActions(legalActions),
    [legalActions]
  );

  // Get activatable units — convert unit activation map to ActivatableUnit-compatible shape
  const activatableUnits = useMemo(() => {
    const result: ActivatableUnit[] = [];
    for (const [unitInstanceId, activations] of unitActions) {
      result.push({
        unitInstanceId,
        abilities: activations.map((a: { abilityIndex: number; action: unknown }) => ({
          abilityIndex: a.abilityIndex,
          canActivate: true,
          _rustAction: a.action,
        })),
      } as unknown as ActivatableUnit);
    }
    return result;
  }, [unitActions]);

  const cardMenuShouldClose =
    cardInteractionState.type === "idle" ||
    cardInteractionState.type === "completing" ||
    cardInteractionState.type === "effect-choice";
  const unitMenuIsStillAvailable =
    menuState.type !== "unit-action" ||
    activatableUnits.some(
      (unit) =>
        unit.unitInstanceId === menuState.unitInstanceId &&
        unit.abilities.some((ability) => ability.canActivate)
    );
  const activeMenuState: MenuState =
    (cardMenuShouldClose && menuState.type === "card-action") ||
    !unitMenuIsStillAvailable
      ? NO_MENU_STATE
      : menuState;

  useRegisterOverlay(activeMenuState.type === "unit-action");

  const selectedCardIndex =
    activeMenuState.type === "card-action" ? activeMenuState.cardIndex : null;
  const selectedUnitIndex =
    activeMenuState.type === "unit-action" ? activeMenuState.unitIndex : null;

  const handleCardClick = useCallback((info: CardClickInfo) => {
    // Block interaction if not player's turn
    if (!isMyTurn) return;

    const { index, rect } = info;
    const cardId = handArray[index];
    if (!cardId) return;

    const playability = playableCardMap.get(cardId);

    // Don't allow selecting non-playable cards
    if (!playability) {
      return;
    }

    if (activeMenuState.type === "card-action" && activeMenuState.cardIndex === index) {
      // Clicking same card again deselects
      setMenuState({ type: "none" });
      cardInteractionDispatch({ type: "CLOSE_MENU" });
    } else if (activeMenuState.type !== "card-action" || activeMenuState.cardIndex !== index) {
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
  }, [isMyTurn, handArray, playableCardMap, activeMenuState, cardInteractionDispatch]);

  // Handle unit click - show ability selection menu
  const handleUnitClick = useCallback((info: UnitClickInfo) => {
    // Block interaction if not player's turn
    if (!isMyTurn) return;

    const { unitIndex, unitInstanceId, rect } = info;
    const unit = player?.units[unitIndex];
    if (!unit) return;

    // Find activatable info for this unit
    const activatableInfo = activatableUnits.find(au => au.unitInstanceId === unitInstanceId);
    if (!activatableInfo) return;

    // Check if unit has any activatable abilities
    const hasActivatable = activatableInfo.abilities.some(a => a.canActivate);
    if (!hasActivatable) return;

    if (activeMenuState.type === "unit-action" && activeMenuState.unitInstanceId === unitInstanceId) {
      // Clicking same unit again closes menu
      setMenuState({ type: "none" });
    } else {
      // Show unit ability menu
      setMenuState({
        type: "unit-action",
        unitIndex,
        unitInstanceId,
        unitId: unit.unitId,
        activatableInfo,
        sourceRect: rect,
      });
    }
  }, [isMyTurn, player?.units, activatableUnits, activeMenuState]);

  // Close unit menu callback
  const handleCloseUnitMenu = useCallback(() => {
    setMenuState({ type: "none" });
  }, []);

  // Early return after all hooks
  if (!player || !Array.isArray(player.hand) || !state) {
    return null;
  }

  return (
    <>
      {/* PixiJS Tactic Carousel - renders to overlay layer, visibility controlled by isActive */}
      <PixiTacticCarousel
        viewMode={handView === "offer" ? prevViewMode : handView}
        isActive={carouselPane === "tactics"}
      />

      {/* PixiJS Floating Hand - renders to overlay layer, visibility controlled by isActive */}
      <PixiFloatingHand
        hand={handArray}
        playableCards={playableCardMap}
        selectedIndex={selectedCardIndex}
        onCardClick={handleCardClick}
        deckCount={player.deckCount}
        discardCount={player.discardCount}
        viewMode={handView === "offer" ? prevViewMode : handView}
        isActive={carouselPane === "cards"}
        inCombat={state.combat != null}
      />

      {/* PixiJS Unit Carousel - renders to overlay layer, visibility controlled by isActive */}
      <PixiUnitCarousel
        units={player.units}
        viewMode={handView === "offer" ? prevViewMode : handView}
        commandTokens={player.commandTokens}
        isActive={carouselPane === "units"}
        activatableUnits={activatableUnits}
        onUnitClick={handleUnitClick}
        selectedIndex={selectedUnitIndex}
      />

      {/* Unit Ability Menu - shown when a unit with activatable abilities is clicked */}
      {activeMenuState.type === "unit-action" && (
        <UnitAbilityMenu
          unitInstanceId={activeMenuState.unitInstanceId}
          unitId={activeMenuState.unitId}
          activatableInfo={activeMenuState.activatableInfo}
          sourceRect={activeMenuState.sourceRect}
          onClose={handleCloseUnitMenu}
        />
      )}

      {/* Carousel track - slides horizontally between tactics, cards, and units */}
      {/* All panes now render via PixiJS overlay; track is kept for structure but empty */}
      {/* Hidden when in offer view */}
      <div className={`carousel-track carousel-track--${carouselPane} ${handView === "offer" ? "carousel-track--hidden" : ""}`}>
        {/* Tactics pane (leftmost position) - rendered via PixiJS overlay */}
        <div className="carousel-track__pane carousel-track__pane--tactics">
          {/* PixiTacticCarousel renders above */}
        </div>

        {/* Cards pane (middle position) - rendered via PixiJS overlay */}
        <div className="carousel-track__pane carousel-track__pane--cards">
          {/* PixiFloatingHand renders above */}
        </div>

        {/* Units pane (rightmost position) - rendered via PixiJS overlay */}
        <div className="carousel-track__pane carousel-track__pane--units">
          {/* PixiUnitCarousel renders above */}
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
