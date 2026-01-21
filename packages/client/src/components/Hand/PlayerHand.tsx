import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { PixiFloatingHand, DeckDiscardIndicator, type CardClickInfo } from "./PixiFloatingHand";
import { FloatingUnitCarousel } from "./FloatingUnitCarousel";
import { TacticCarouselPane } from "./TacticCarouselPane";
import { CardActionMenu, PixiCardActionMenu, PieMenu, type PieMenuItem } from "../CardActionMenu";
import {
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  MANA_BLACK,
  MANA_BLUE,
  MANA_GOLD,
  MANA_GREEN,
  MANA_RED,
  MANA_WHITE,
  MANA_SOURCE_DIE,
  MANA_SOURCE_CRYSTAL,
  MANA_SOURCE_TOKEN,
  type CardId,
  type SidewaysAs,
  type ManaSourceInfo,
  type ManaColor,
  type ClientGameState,
  type ClientPlayer,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";

/**
 * Get all available mana sources that can pay for a specific color.
 * Returns an array of options the player can choose from.
 */
function getAvailableManaSources(
  state: ClientGameState,
  player: ClientPlayer,
  requiredColor: ManaColor
): ManaSourceInfo[] {
  const sources: ManaSourceInfo[] = [];

  // 1. Check crystals (player's inventory)
  if (player.crystals[requiredColor as keyof typeof player.crystals] > 0) {
    sources.push({ type: MANA_SOURCE_CRYSTAL, color: requiredColor });
  }

  // 2. Check pure mana tokens (already in play area)
  // Track which token colors we've already added (tokens of same color are fungible)
  const addedTokenColors = new Set<string>();

  for (const token of player.pureMana) {
    // Exact color match
    if (token.color === requiredColor && !addedTokenColors.has(token.color)) {
      sources.push({ type: MANA_SOURCE_TOKEN, color: token.color });
      addedTokenColors.add(token.color);
    }
    // Gold tokens can substitute for basic colors (red, blue, green, white)
    // Note: Black mana is NOT wild - it's only used specifically for powering spells
    const isBasic = requiredColor === MANA_RED || requiredColor === MANA_BLUE ||
                    requiredColor === MANA_GREEN || requiredColor === MANA_WHITE;
    if (token.color === MANA_GOLD && isBasic && !addedTokenColors.has(MANA_GOLD)) {
      sources.push({ type: MANA_SOURCE_TOKEN, color: MANA_GOLD });
      addedTokenColors.add(MANA_GOLD);
    }
  }

  // 3. Check available dice from the source
  const manaOptions = state.validActions.mana;
  if (manaOptions) {
    // Matching color dice
    const matchingDice = manaOptions.availableDice.filter(
      (d) => d.color === requiredColor
    );
    for (const die of matchingDice) {
      sources.push({
        type: MANA_SOURCE_DIE,
        color: requiredColor,
        dieId: die.dieId,
      });
    }

    // Gold dice (wildcard for basic colors ONLY - not for black or gold)
    // Basic colors are: red, blue, green, white
    const isBasicColor = requiredColor === MANA_RED || requiredColor === MANA_BLUE ||
                         requiredColor === MANA_GREEN || requiredColor === MANA_WHITE;
    if (isBasicColor) {
      const goldDice = manaOptions.availableDice.filter((d) => d.color === "gold");
      for (const die of goldDice) {
        sources.push({
          type: MANA_SOURCE_DIE,
          color: "gold",
          dieId: die.dieId,
        });
      }
    }
  }

  return sources;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get wedge color for mana - matches the combat mana theme from CombatOverlay
 */
function getManaWedgeColor(color: ManaColor): string {
  switch (color) {
    case MANA_RED: return "rgba(160, 64, 64, 0.95)";    // Deep ruby
    case MANA_BLUE: return "rgba(74, 112, 144, 0.95)";  // Steel blue
    case MANA_GREEN: return "rgba(58, 128, 96, 0.95)";  // Forest green
    case MANA_WHITE: return "rgba(200, 192, 176, 0.95)"; // Ivory
    case MANA_GOLD: return "rgba(212, 165, 116, 0.95)"; // Antique gold
    case MANA_BLACK: return "rgba(80, 85, 96, 0.95)";   // Dark gray
    default: return "rgba(70, 70, 80, 0.95)";
  }
}

/**
 * Convert mana sources to pie menu items with proper styling
 */
function manaSourceToPieItem(source: ManaSourceInfo, index: number): PieMenuItem {
  const baseColor = getManaWedgeColor(source.color);

  switch (source.type) {
    case MANA_SOURCE_CRYSTAL:
      return {
        id: `crystal-${source.color}-${index}`,
        icon: "💎",
        label: capitalize(source.color),
        sublabel: "Crystal",
        color: baseColor,
      };
    case MANA_SOURCE_TOKEN:
      return {
        id: `token-${source.color}-${index}`,
        icon: "✦",
        label: capitalize(source.color),
        sublabel: "Token",
        color: baseColor,
      };
    case MANA_SOURCE_DIE:
      if (source.color === MANA_GOLD) {
        return {
          id: `die-gold-${index}`,
          icon: "🎲",
          label: "Gold",
          sublabel: "Wild Die",
          color: baseColor,
        };
      }
      return {
        id: `die-${source.color}-${index}`,
        icon: "🎲",
        label: capitalize(source.color),
        sublabel: "Die",
        color: baseColor,
      };
    default:
      return {
        id: `unknown-${index}`,
        icon: "✦",
        label: capitalize(source.color),
        color: baseColor,
      };
  }
}

// Menu state types
type MenuState =
  | { type: "none" }
  | { type: "card-action"; cardIndex: number; sourceRect: DOMRect }
  | { type: "spell-mana-select"; cardIndex: number; step: "black" | "color"; spellColor: ManaColor; blackSource?: ManaSourceInfo; sourceRect: DOMRect };

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
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
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

  // Check if we're in combat
  const isInCombat = state?.combat !== null;

  // Cast hand to array - memoized for stable reference
  const handArray = useMemo(
    () => (player?.hand ?? []) as readonly CardId[],
    [player?.hand]
  );

  // Get selected card info from menu state
  const selectedIndex = menuState.type !== "none" ? menuState.cardIndex : null;
  const selectedCard = selectedIndex !== null ? handArray[selectedIndex] : null;
  const selectedPlayability = selectedCard ? playableCardMap.get(selectedCard) ?? null : null;

  // Get available mana sources for the selected card
  const manaSources = useMemo(() => {
    if (!selectedPlayability?.requiredMana || !state || !player) return [];
    return getAvailableManaSources(state, player, selectedPlayability.requiredMana);
  }, [selectedPlayability?.requiredMana, state, player]);

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
    } else {
      // Show card action menu
      setMenuState({ type: "card-action", cardIndex: index, sourceRect: rect });
    }
  }, [handArray, playableCardMap, menuState]);

  // Handlers for CardActionMenu
  const handlePlayBasic = useCallback(() => {
    if (!selectedCard) return;
    sendAction({
      type: PLAY_CARD_ACTION,
      cardId: selectedCard,
      powered: false,
    });
    setMenuState({ type: "none" });
  }, [selectedCard, sendAction]);

  const handlePlayPowered = useCallback((manaSource: ManaSourceInfo) => {
    if (!selectedCard) return;
    sendAction({
      type: PLAY_CARD_ACTION,
      cardId: selectedCard,
      powered: true,
      manaSource,
    });
    setMenuState({ type: "none" });
  }, [selectedCard, sendAction]);

  const handlePlaySideways = useCallback((as: SidewaysAs) => {
    if (!selectedCard) return;
    sendAction({
      type: PLAY_CARD_SIDEWAYS_ACTION,
      cardId: selectedCard,
      as,
    });
    setMenuState({ type: "none" });
  }, [selectedCard, sendAction]);

  const handleCancel = useCallback(() => {
    setMenuState({ type: "none" });
  }, []);

  // Early return after all hooks
  if (!player || !Array.isArray(player.hand) || !state) {
    return null;
  }

  // Spell handling (two-step mana selection) - kept separate for now
  const handleSpellManaSourceSelect = (source: ManaSourceInfo) => {
    console.log("[Spell Mana Select] Called with source:", source);
    console.log("[Spell Mana Select] selectedCard:", selectedCard);
    console.log("[Spell Mana Select] menuState:", menuState);

    if (selectedCard === null || selectedCard === undefined) {
      console.warn("[Spell Mana Select] selectedCard is null/undefined, returning");
      return;
    }
    if (menuState.type !== "spell-mana-select") {
      console.warn("[Spell Mana Select] menuState.type is not spell-mana-select:", menuState.type);
      return;
    }

    if (menuState.step === "black") {
      console.log("[Spell Mana Select] Step is 'black', transitioning to 'color' step");
      // Black mana selected, now need to select the spell's color
      setMenuState({
        type: "spell-mana-select",
        cardIndex: menuState.cardIndex,
        step: "color",
        spellColor: menuState.spellColor,
        blackSource: source,
        sourceRect: menuState.sourceRect,
      });
    } else {
      // Color mana selected, send the action with both sources
      const blackSource = menuState.blackSource;
      console.log("[Spell Mana Select] Step is 'color', blackSource:", blackSource);
      if (!blackSource) {
        console.error("[Spell Mana Select] Missing black mana source for spell");
        return;
      }

      const action = {
        type: PLAY_CARD_ACTION,
        cardId: selectedCard,
        powered: true,
        manaSources: [blackSource, source],
      };
      console.log("[Spell Mana Select] Sending action:", action);
      sendAction(action);
      setMenuState({ type: "none" });
    }
  };

  const handleSpellBackToBlack = () => {
    if (menuState.type !== "spell-mana-select") return;
    if (menuState.step === "color") {
      setMenuState({
        type: "spell-mana-select",
        cardIndex: menuState.cardIndex,
        step: "black",
        spellColor: menuState.spellColor,
        sourceRect: menuState.sourceRect,
      });
    } else {
      // Go back to card action menu
      setMenuState({
        type: "card-action",
        cardIndex: menuState.cardIndex,
        sourceRect: menuState.sourceRect,
      });
    }
  };

  return (
    <>
      {/* Card Action Menu - for non-spell cards (PixiJS version with full juice) */}
      {menuState.type === "card-action" && selectedCard && selectedPlayability && !selectedPlayability.isSpell && (
        <PixiCardActionMenu
          cardId={selectedCard}
          playability={selectedPlayability}
          isInCombat={isInCombat}
          sourceRect={menuState.sourceRect}
          manaSources={manaSources}
          sizeMultiplier={handView === "focus" ? 1.4 : 1}
          onPlayBasic={handlePlayBasic}
          onPlayPowered={handlePlayPowered}
          onPlaySideways={handlePlaySideways}
          onCancel={handleCancel}
        />
      )}

      {/* Spell cards still use the old flow for now (two-step mana selection) */}
      {menuState.type === "card-action" && selectedCard && selectedPlayability && selectedPlayability.isSpell && (
        <CardActionMenu
          cardId={selectedCard}
          playability={selectedPlayability}
          isInCombat={isInCombat}
          sourceRect={menuState.sourceRect}
          manaSources={[]} // Empty - spell handling is separate
          sizeMultiplier={handView === "focus" ? 1.4 : 1}
          onPlayBasic={handlePlayBasic}
          onPlayPowered={() => {
            console.log("[Spell Powered] onPlayPowered called");
            console.log("[Spell Powered] selectedPlayability:", selectedPlayability);
            console.log("[Spell Powered] selectedIndex:", selectedIndex);
            console.log("[Spell Powered] requiredMana:", selectedPlayability?.requiredMana);

            // Transition to spell mana selection - but first check if black mana is available
            if (selectedPlayability?.requiredMana && selectedIndex !== null) {
              const blackSources = getAvailableManaSources(state, player, MANA_BLACK);

              // Debug: Log available mana sources for spell powered play
              console.log("[Spell Powered] Black mana sources:", blackSources);
              console.log("[Spell Powered] Player pureMana:", player.pureMana);
              console.log("[Spell Powered] Available dice:", state.validActions.mana?.availableDice);
              console.log("[Spell Powered] Full validActions.mana:", state.validActions.mana);

              if (blackSources.length === 0) {
                // No black mana available - this shouldn't happen if canPlayPowered is true
                // but handle gracefully by staying on card-action menu
                console.warn("[Spell Powered] No black mana sources found, but canPlayPowered was true. Possible mismatch.");
                return;
              }

              console.log("[Spell Powered] Transitioning to spell-mana-select state");
              setMenuState({
                type: "spell-mana-select",
                cardIndex: selectedIndex,
                step: "black",
                spellColor: selectedPlayability.requiredMana,
                sourceRect: menuState.sourceRect,
              });
            } else {
              console.warn("[Spell Powered] Condition not met - requiredMana:", selectedPlayability?.requiredMana, "selectedIndex:", selectedIndex);
            }
          }}
          onPlaySideways={handlePlaySideways}
          onCancel={handleCancel}
        />
      )}

      {/* Spell mana source selection - PieMenu (two-step: black then color) */}
      {menuState.type === "spell-mana-select" && selectedCard && (() => {
        const sources = getAvailableManaSources(
          state,
          player,
          menuState.step === "black" ? MANA_BLACK : menuState.spellColor
        );

        // No sources available - shouldn't happen but handle gracefully
        if (sources.length === 0) {
          return null;
        }

        const stepLabel = menuState.step === "black"
          ? "Select Black Mana"
          : `Select ${capitalize(menuState.spellColor)} Mana`;

        // Use subtle overlay in combat so combat scene stays visible
        const overlayBackground = isInCombat
          ? "radial-gradient(ellipse at center, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.5) 100%)"
          : "radial-gradient(ellipse at center, rgba(15, 10, 5, 0.5) 0%, rgba(10, 8, 5, 0.7) 100%)";

        return (
          <div
            className="spell-mana-overlay"
            onClick={handleSpellBackToBlack}
            style={{
              position: "fixed",
              inset: 0,
              background: overlayBackground,
              zIndex: 250,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div
              style={{
                color: "#fff",
                fontSize: "1.1rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)",
              }}
            >
              {stepLabel}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <PieMenu
                items={sources.map((source, idx) => manaSourceToPieItem(source, idx))}
                onSelect={(id) => {
                  const idx = sources.findIndex((s, i) =>
                    manaSourceToPieItem(s, i).id === id
                  );
                  const source = sources[idx];
                  if (idx !== -1 && source) {
                    handleSpellManaSourceSelect(source);
                  }
                }}
                onCancel={handleSpellBackToBlack}
                size={320}
                centerContent={<span style={{ fontSize: "0.75rem", color: "#888" }}>Back</span>}
              />
            </div>
          </div>
        );
      })()}

      {/* Carousel track - slides horizontally between tactics, cards, and units */}
      {/* All panes are always rendered, positioned side by side */}
      {/* Hidden when in offer view - children keep their current viewMode to avoid transform jank */}
      <div className={`carousel-track carousel-track--${carouselPane} ${handView === "offer" ? "carousel-track--hidden" : ""}`}>
        {/* Tactics pane (leftmost position) */}
        <div className="carousel-track__pane carousel-track__pane--tactics">
          <TacticCarouselPane viewMode={handView === "offer" ? prevViewModeRef.current : handView} />
        </div>

        {/* Cards pane (middle position) */}
        <div className="carousel-track__pane carousel-track__pane--cards">
          <PixiFloatingHand
            hand={handArray}
            playableCards={playableCardMap}
            selectedIndex={selectedIndex}
            onCardClick={handleCardClick}
            deckCount={player.deckCount}
            discardCount={player.discardCount}
            viewMode={handView === "offer" ? prevViewModeRef.current : handView}
          />
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
