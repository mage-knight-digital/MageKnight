import { useState, useCallback, useMemo, useEffect } from "react";
import { FloatingHand, DeckDiscardIndicator, type CardClickInfo } from "./FloatingHand";
import { FloatingUnitCarousel } from "./FloatingUnitCarousel";
import { CardActionMenu } from "../CardActionMenu";
import { RadialMenu, type RadialMenuItem } from "../RadialMenu";
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
  // Tokens of the same color are fungible - only add one entry regardless of count
  const hasMatchingToken = player.pureMana.some((t) => t.color === requiredColor);
  if (hasMatchingToken) {
    sources.push({ type: MANA_SOURCE_TOKEN, color: requiredColor });
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

    // Gold dice (wildcard for any basic color during day)
    const goldDice = manaOptions.availableDice.filter((d) => d.color === "gold");
    for (const die of goldDice) {
      sources.push({
        type: MANA_SOURCE_DIE,
        color: "gold",
        dieId: die.dieId,
      });
    }
  }

  return sources;
}

function getColorEmoji(color: ManaColor): string {
  switch (color) {
    case MANA_RED: return "🔴";
    case MANA_BLUE: return "🔵";
    case MANA_GREEN: return "🟢";
    case MANA_WHITE: return "⚪";
    case MANA_GOLD: return "🟡";
    case MANA_BLACK: return "⚫";
    default: return "⬜";
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert mana sources to radial menu items
 */
function manaSourceToRadialItem(source: ManaSourceInfo, index: number): RadialMenuItem {
  const colorEmoji = getColorEmoji(source.color);

  switch (source.type) {
    case MANA_SOURCE_CRYSTAL:
      return {
        id: `crystal-${source.color}-${index}`,
        icon: "💎",
        label: capitalize(source.color),
        sublabel: "Crystal",
      };
    case MANA_SOURCE_TOKEN:
      return {
        id: `token-${source.color}-${index}`,
        icon: colorEmoji,
        label: capitalize(source.color),
        sublabel: "Token",
      };
    case MANA_SOURCE_DIE:
      if (source.color === MANA_GOLD) {
        return {
          id: `die-gold-${index}`,
          icon: "🎲",
          label: "Gold",
          sublabel: "Wild Die",
        };
      }
      return {
        id: `die-${source.color}-${index}`,
        icon: "🎲",
        label: capitalize(source.color),
        sublabel: "Die",
      };
    default:
      return {
        id: `unknown-${index}`,
        icon: colorEmoji,
        label: capitalize(source.color),
      };
  }
}

// Menu state types
type MenuState =
  | { type: "none" }
  | { type: "card-action"; cardIndex: number; sourceRect: DOMRect }
  | { type: "spell-mana-select"; cardIndex: number; step: "black" | "color"; spellColor: ManaColor; blackSource?: ManaSourceInfo; sourceRect: DOMRect };

// Hand view modes (Inscryption style)
// board: cards completely hidden, full board view
// ready: cards peeking ~33%, ready to play
// focus: cards large ~80%, studying hand
type HandView = "board" | "ready" | "focus";
const HAND_VIEWS: HandView[] = ["board", "ready", "focus"];

// Carousel axis: cards vs units
type CarouselPane = "cards" | "units";
const CAROUSEL_PANES: CarouselPane[] = ["cards", "units"];

export function PlayerHand() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const [menuState, setMenuState] = useState<MenuState>({ type: "none" });
  const [handView, setHandView] = useState<HandView>("ready");
  const [carouselPane, setCarouselPane] = useState<CarouselPane>("cards");
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(0);

  // Get unit count for A/D navigation bounds
  const unitCount = player?.units.length ?? 0;

  // Keyboard controls:
  // W/S = vertical view modes (board/ready/focus)
  // A/D = horizontal carousel (cards/units) OR cycle through units when in units pane
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();

      if (key === "s") {
        // Move toward hand (board -> ready -> focus)
        setHandView(current => {
          const idx = HAND_VIEWS.indexOf(current);
          return HAND_VIEWS[Math.min(idx + 1, HAND_VIEWS.length - 1)] ?? current;
        });
      } else if (key === "w") {
        // Move toward board (focus -> ready -> board)
        setHandView(current => {
          const idx = HAND_VIEWS.indexOf(current);
          return HAND_VIEWS[Math.max(idx - 1, 0)] ?? current;
        });
      } else if (key === "a") {
        // A key behavior depends on current pane
        if (carouselPane === "units" && unitCount > 1) {
          // In units pane: cycle left through units
          setSelectedUnitIndex(current =>
            current > 0 ? current - 1 : unitCount - 1
          );
        } else {
          // Switch to cards pane (or stay if already there)
          setCarouselPane("cards");
        }
      } else if (key === "d") {
        // D key behavior depends on current pane
        if (carouselPane === "units" && unitCount > 1) {
          // In units pane: cycle right through units
          setSelectedUnitIndex(current =>
            current < unitCount - 1 ? current + 1 : 0
          );
        } else if (carouselPane === "cards") {
          // Switch to units pane
          setCarouselPane("units");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [carouselPane, unitCount]);

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
    if (selectedCard === null || selectedCard === undefined) return;
    if (menuState.type !== "spell-mana-select") return;

    if (menuState.step === "black") {
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
      if (!blackSource) {
        console.error("Missing black mana source for spell");
        return;
      }

      sendAction({
        type: PLAY_CARD_ACTION,
        cardId: selectedCard,
        powered: true,
        manaSources: [blackSource, source],
      });
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
      {/* Card Action Menu - for non-spell cards */}
      {menuState.type === "card-action" && selectedCard && selectedPlayability && !selectedPlayability.isSpell && (
        <CardActionMenu
          cardId={selectedCard}
          playability={selectedPlayability}
          isInCombat={isInCombat}
          sourceRect={menuState.sourceRect}
          manaSources={manaSources}
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
          onPlayBasic={handlePlayBasic}
          onPlayPowered={() => {
            // Transition to spell mana selection
            if (selectedPlayability.requiredMana && selectedIndex !== null) {
              setMenuState({
                type: "spell-mana-select",
                cardIndex: selectedIndex,
                step: "black",
                spellColor: selectedPlayability.requiredMana,
                sourceRect: menuState.sourceRect,
              });
            }
          }}
          onPlaySideways={handlePlaySideways}
          onCancel={handleCancel}
        />
      )}

      {/* Spell mana source selection - radial menu (two-step: black then color) */}
      {menuState.type === "spell-mana-select" && selectedCard && (() => {
        const sources = getAvailableManaSources(
          state,
          player,
          menuState.step === "black" ? MANA_BLACK : menuState.spellColor
        );
        return (
          <RadialMenu
            items={sources.map((source, idx) => manaSourceToRadialItem(source, idx))}
            onSelect={(id) => {
              const idx = sources.findIndex((s, i) =>
                manaSourceToRadialItem(s, i).id === id
              );
              const source = sources[idx];
              if (idx !== -1 && source) {
                handleSpellManaSourceSelect(source);
              }
            }}
            onCancel={handleSpellBackToBlack}
          />
        );
      })()}

      {/* Carousel track - slides horizontally between cards and units */}
      {/* Both panes are always rendered, positioned side by side */}
      <div className={`carousel-track carousel-track--${carouselPane}`}>
        {/* Cards pane (left position) */}
        <div className="carousel-track__pane carousel-track__pane--cards">
          <FloatingHand
            hand={handArray}
            playableCards={playableCardMap}
            selectedIndex={selectedIndex}
            onCardClick={handleCardClick}
            deckCount={player.deckCount}
            discardCount={player.discardCount}
            viewMode={handView}
          />
        </div>

        {/* Units pane (right position) */}
        <div className="carousel-track__pane carousel-track__pane--units">
          <FloatingUnitCarousel
            units={player.units}
            selectedIndex={selectedUnitIndex}
            onSelectUnit={setSelectedUnitIndex}
            viewMode={handView}
            commandTokens={player.commandTokens}
          />
        </div>
      </div>

      {/* Carousel pane indicator */}
      <div className="carousel-pane-indicator">
        <span className={`carousel-pane-indicator__item ${carouselPane === "cards" ? "carousel-pane-indicator__item--active" : ""}`}>
          Cards
        </span>
        <span className="carousel-pane-indicator__divider">|</span>
        <span className={`carousel-pane-indicator__item ${carouselPane === "units" ? "carousel-pane-indicator__item--active" : ""}`}>
          Units
        </span>
      </div>

      {/* Deck/Discard - fixed position outside carousel */}
      <DeckDiscardIndicator
        deckCount={player.deckCount}
        discardCount={player.discardCount}
        isHidden={handView === "focus"}
      />
    </>
  );
}
