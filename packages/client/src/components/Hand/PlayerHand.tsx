import { useState } from "react";
import { FloatingHand } from "./FloatingHand";
import { ExpandedCard } from "./ExpandedCard";
import { RadialMenu, type RadialMenuItem } from "../RadialMenu";
import {
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  PLAY_SIDEWAYS_AS_MOVE,
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

// Format card ID for display (convert snake_case to Title Case)
function formatCardName(cardId: CardId): string {
  return cardId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Menu state types
type MenuState =
  | { type: "none" }
  | { type: "play-mode"; cardIndex: number }
  | { type: "mana-select"; cardIndex: number; requiredColor: ManaColor; sources: ManaSourceInfo[] }
  | { type: "spell-mana-select"; cardIndex: number; step: "black" | "color"; spellColor: ManaColor; blackSource?: ManaSourceInfo };

export function PlayerHand() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const [menuState, setMenuState] = useState<MenuState>({ type: "none" });

  if (!player || !Array.isArray(player.hand) || !state) {
    return null;
  }

  // Get playable cards from validActions
  const playableCards = state.validActions.playCard?.cards ?? [];
  const playableCardMap = new Map(playableCards.map(c => [c.cardId, c]));

  // Check if we're in combat
  const isInCombat = state.combat !== null;
  const combatPhase = state.combat?.phase;

  // Cast hand to array since we've already checked it's an array above
  const handArray = player.hand as readonly CardId[];

  // Get selected card info from menu state
  const selectedIndex = menuState.type !== "none" ? menuState.cardIndex : null;
  const selectedCard = selectedIndex !== null ? handArray[selectedIndex] : null;
  const selectedPlayability = selectedCard ? playableCardMap.get(selectedCard) ?? null : null;

  const handleCardClick = (index: number) => {
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
      // Show play mode menu for this card
      setMenuState({ type: "play-mode", cardIndex: index });
    }
  };

  const handlePlay = (mode: "basic" | "powered" | { sideways: SidewaysAs }) => {
    if (selectedCard === null || selectedCard === undefined || selectedIndex === null) return;

    if (typeof mode === "object" && "sideways" in mode) {
      // Sideways play - no mana needed
      sendAction({
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: selectedCard,
        as: mode.sideways,
      });
      setMenuState({ type: "none" });
    } else if (mode === "powered") {
      // Powered play - need to select mana source(s)
      const playability = playableCardMap.get(selectedCard);
      const requiredMana = playability?.requiredMana;

      if (requiredMana) {
        // Check if this is a spell (requires black + color mana)
        if (playability?.isSpell) {
          // Spells need two mana sources: black first, then the spell's color
          const blackSources = getAvailableManaSources(state, player, MANA_BLACK);

          if (blackSources.length === 0) {
            console.error("No black mana source found for spell");
            return;
          }

          // Start two-step spell mana selection (black first)
          setMenuState({
            type: "spell-mana-select",
            cardIndex: selectedIndex,
            step: "black",
            spellColor: requiredMana,
          });
        } else {
          // Regular action card - single mana source
          const sources = getAvailableManaSources(state, player, requiredMana);

          if (sources.length === 0) {
            // This shouldn't happen - UI shouldn't show powered option if no mana available
            console.error("No mana source found for powered card");
            return;
          }

          if (sources.length === 1) {
            // Only one option - auto-select it
            sendAction({
              type: PLAY_CARD_ACTION,
              cardId: selectedCard,
              powered: true,
              manaSource: sources[0],
            });
            setMenuState({ type: "none" });
          } else {
            // Multiple options - show mana source selection menu
            setMenuState({
              type: "mana-select",
              cardIndex: selectedIndex,
              requiredColor: requiredMana,
              sources,
            });
          }
        }
      }
    } else {
      // Basic play - no mana source needed
      sendAction({
        type: PLAY_CARD_ACTION,
        cardId: selectedCard,
        powered: false,
      });
      setMenuState({ type: "none" });
    }
  };

  const handleManaSourceSelect = (source: ManaSourceInfo) => {
    if (selectedCard === null || selectedCard === undefined) return;

    sendAction({
      type: PLAY_CARD_ACTION,
      cardId: selectedCard,
      powered: true,
      manaSource: source,
    });
    setMenuState({ type: "none" });
  };

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

  const handleCancel = () => {
    setMenuState({ type: "none" });
  };

  const handleBackToPlayMode = () => {
    if (menuState.type === "mana-select") {
      setMenuState({ type: "play-mode", cardIndex: menuState.cardIndex });
    } else if (menuState.type === "spell-mana-select") {
      if (menuState.step === "color") {
        // Go back to black mana selection
        setMenuState({
          type: "spell-mana-select",
          cardIndex: menuState.cardIndex,
          step: "black",
          spellColor: menuState.spellColor,
        });
      } else {
        // Go back to play mode menu
        setMenuState({ type: "play-mode", cardIndex: menuState.cardIndex });
      }
    }
  };

  return (
    <>
      {/* Expanded card view for play selection */}
      {menuState.type === "play-mode" && selectedCard && selectedPlayability && (
        <ExpandedCard
          cardId={selectedCard}
          playability={selectedPlayability}
          isInCombat={isInCombat}
          onPlayBasic={() => handlePlay("basic")}
          onPlayPowered={() => handlePlay("powered")}
          onPlaySideways={(as) => handlePlay({ sideways: as })}
          onCancel={handleCancel}
        />
      )}

      {/* Mana source selection - radial menu */}
      {menuState.type === "mana-select" && selectedCard && (
        <RadialMenu
          items={menuState.sources.map((source, idx) => manaSourceToRadialItem(source, idx))}
          onSelect={(id) => {
            // Find the source by matching the id
            const idx = menuState.sources.findIndex((s, i) =>
              manaSourceToRadialItem(s, i).id === id
            );
            const source = menuState.sources[idx];
            if (idx !== -1 && source) {
              handleManaSourceSelect(source);
            }
          }}
          onCancel={handleBackToPlayMode}
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
            onCancel={handleBackToPlayMode}
          />
        );
      })()}

    {/* Floating card hand - renders at fixed position at bottom of screen */}
    <FloatingHand
      hand={handArray}
      playableCards={playableCardMap}
      selectedIndex={selectedIndex}
      onCardClick={handleCardClick}
    />
  </>
  );
}
