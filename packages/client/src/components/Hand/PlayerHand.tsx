import { useState } from "react";
import {
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_RANGED_SIEGE,
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
  type PlayableCard,
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
  const matchingTokens = player.pureMana.filter((t) => t.color === requiredColor);
  for (let i = 0; i < matchingTokens.length; i++) {
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

/**
 * Get a human-readable label for a mana source option.
 */
function getManaSourceLabel(source: ManaSourceInfo): string {
  const colorEmoji = getColorEmoji(source.color);

  switch (source.type) {
    case MANA_SOURCE_CRYSTAL:
      return `${colorEmoji} ${capitalize(source.color)} Crystal`;
    case MANA_SOURCE_TOKEN:
      return `${colorEmoji} ${capitalize(source.color)} Token`;
    case MANA_SOURCE_DIE:
      if (source.color === MANA_GOLD) {
        return `🎲 Gold Die (wild)`;
      }
      return `🎲 ${capitalize(source.color)} Die`;
    default:
      return `${colorEmoji} ${capitalize(source.color)}`;
  }
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

// Format card ID for display (convert snake_case to Title Case)
function formatCardName(cardId: CardId): string {
  return cardId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface CardProps {
  cardId: CardId;
  isSelected: boolean;
  isPlayable: boolean;
  isInCombat: boolean;
  onClick: () => void;
}

function Card({ cardId, isSelected, isPlayable, isInCombat, onClick }: CardProps) {
  const classNames = [
    "card",
    isSelected ? "card--selected" : "",
    isPlayable ? "card--playable" : "card--not-playable",
    isInCombat ? "card--in-combat" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      className={classNames}
      onClick={onClick}
      type="button"
      disabled={!isPlayable}
      data-testid={`hand-card-${cardId}`}
    >
      <div className="card__name">{formatCardName(cardId)}</div>
      {!isPlayable && <div className="card__disabled-overlay" />}
    </button>
  );
}

// Get label for sideways play based on context
function getSidewaysLabel(as: SidewaysAs, value: number, isInCombat: boolean, _combatPhase?: string): string {
  if (!isInCombat) {
    switch (as) {
      case PLAY_SIDEWAYS_AS_MOVE:
        return `+${value} Move`;
      case PLAY_SIDEWAYS_AS_INFLUENCE:
        return `+${value} Influence`;
      default:
        return `+${value}`;
    }
  }

  // During combat, sideways options are attack or block
  switch (as) {
    case PLAY_SIDEWAYS_AS_BLOCK:
      return `+${value} Block`;
    case PLAY_SIDEWAYS_AS_ATTACK:
      return `+${value} Attack`;
    default:
      return `+${value}`;
  }
}

// Get label for basic effect based on combat phase
function getBasicLabel(isInCombat: boolean, combatPhase?: import("@mage-knight/shared").CombatPhase): string {
  if (!isInCombat) {
    return "Basic Effect";
  }

  switch (combatPhase) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return "Ranged/Siege Attack";
    case COMBAT_PHASE_BLOCK:
      return "Block";
    case COMBAT_PHASE_ATTACK:
      return "Attack";
    default:
      return "Basic Effect";
  }
}

interface ManaSourceMenuProps {
  cardId: CardId;
  requiredColor: ManaColor;
  sources: ManaSourceInfo[];
  isInCombat: boolean;
  combatPhase?: import("@mage-knight/shared").CombatPhase;
  onSelect: (source: ManaSourceInfo) => void;
  onBack: () => void;
}

function ManaSourceMenu({
  cardId,
  requiredColor,
  sources,
  isInCombat,
  combatPhase,
  onSelect,
  onBack
}: ManaSourceMenuProps) {
  const poweredLabel = isInCombat
    ? `Powered ${getBasicLabel(isInCombat, combatPhase)}`
    : "Powered Effect";

  return (
    <div className="play-mode-menu" data-testid="mana-source-menu">
      <div className="play-mode-menu__title">
        {formatCardName(cardId)} - {poweredLabel}
      </div>
      <div className="play-mode-menu__subtitle">
        Choose {getColorEmoji(requiredColor)} {capitalize(requiredColor)} mana source:
      </div>
      <div className="play-mode-menu__options">
        {sources.map((source, idx) => (
          <button
            key={`${source.type}-${source.color}-${source.dieId ?? idx}`}
            className="play-mode-menu__btn play-mode-menu__btn--mana"
            onClick={() => onSelect(source)}
            type="button"
            data-testid={`mana-source-option-${idx}`}
          >
            {getManaSourceLabel(source)}
          </button>
        ))}
        <button
          className="play-mode-menu__btn play-mode-menu__btn--cancel"
          onClick={onBack}
          type="button"
        >
          Back
        </button>
      </div>
    </div>
  );
}

interface PlayModeMenuProps {
  cardId: CardId;
  playability: PlayableCard | null;
  isInCombat: boolean;
  combatPhase?: import("@mage-knight/shared").CombatPhase;
  onPlay: (mode: "basic" | "powered" | { sideways: SidewaysAs }) => void;
  onCancel: () => void;
}

function PlayModeMenu({ cardId, playability, isInCombat, combatPhase, onPlay, onCancel }: PlayModeMenuProps) {
  const menuOptions: Array<{ label: string; action: () => void; className: string }> = [];

  // Add basic effect option if available
  if (playability?.canPlayBasic) {
    menuOptions.push({
      label: getBasicLabel(isInCombat, combatPhase),
      action: () => onPlay("basic"),
      className: "play-mode-menu__btn--basic",
    });
  }

  // Add powered effect option if available
  if (playability?.canPlayPowered) {
    const poweredLabel = isInCombat
      ? `Powered ${getBasicLabel(isInCombat, combatPhase)}`
      : "Powered Effect";
    menuOptions.push({
      label: poweredLabel,
      action: () => onPlay("powered"),
      className: "play-mode-menu__btn--powered",
    });
  }

  // Add sideways options if available
  if (playability?.canPlaySideways && playability.sidewaysOptions) {
    for (const option of playability.sidewaysOptions) {
      menuOptions.push({
        label: getSidewaysLabel(option.as, option.value, isInCombat, combatPhase),
        action: () => onPlay({ sideways: option.as }),
        className: "play-mode-menu__btn--sideways",
      });
    }
  } else if (playability?.canPlaySideways && !isInCombat) {
    // Fallback for non-combat sideways (move/influence)
    menuOptions.push({
      label: "+1 Move",
      action: () => onPlay({ sideways: PLAY_SIDEWAYS_AS_MOVE }),
      className: "play-mode-menu__btn--sideways",
    });
  }

  return (
    <div className="play-mode-menu" data-testid="card-play-menu">
      <div className="play-mode-menu__title">Play {formatCardName(cardId)}</div>
      <div className="play-mode-menu__options">
        {menuOptions.map((opt, idx) => (
          <button
            key={idx}
            className={`play-mode-menu__btn ${opt.className}`}
            onClick={opt.action}
            type="button"
            data-testid={`card-menu-option-${idx}`}
          >
            {opt.label}
          </button>
        ))}
        <button
          className="play-mode-menu__btn play-mode-menu__btn--cancel"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Menu state types
type MenuState =
  | { type: "none" }
  | { type: "play-mode"; cardIndex: number }
  | { type: "mana-select"; cardIndex: number; requiredColor: ManaColor; sources: ManaSourceInfo[] };

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
      // Powered play - need to select mana source
      const playability = playableCardMap.get(selectedCard);
      const requiredMana = playability?.requiredMana;

      if (requiredMana) {
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

  const handleCancel = () => {
    setMenuState({ type: "none" });
  };

  const handleBackToPlayMode = () => {
    if (menuState.type === "mana-select") {
      setMenuState({ type: "play-mode", cardIndex: menuState.cardIndex });
    }
  };

  return (
    <div className="player-hand" data-testid="player-hand">
      <div className="player-hand__header">
        <h3 className="panel__title">Hand ({player.hand.length} cards)</h3>
        <div className="player-hand__stats">
          Move: {player.movePoints} | Influence: {player.influencePoints}
          {player.pureMana.length > 0 && (
            <span className="player-hand__mana-tokens">
              {" | Mana: "}
              {player.pureMana.map((token, i) => (
                <span key={i} title={`${token.color} mana token`}>
                  {getColorEmoji(token.color)}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>

      {/* Play mode menu */}
      {menuState.type === "play-mode" && selectedCard && selectedPlayability && (
        <PlayModeMenu
          cardId={selectedCard}
          playability={selectedPlayability}
          isInCombat={isInCombat}
          combatPhase={combatPhase}
          onPlay={handlePlay}
          onCancel={handleCancel}
        />
      )}

      {/* Mana source selection menu */}
      {menuState.type === "mana-select" && selectedCard && (
        <ManaSourceMenu
          cardId={selectedCard}
          requiredColor={menuState.requiredColor}
          sources={menuState.sources}
          isInCombat={isInCombat}
          combatPhase={combatPhase}
          onSelect={handleManaSourceSelect}
          onBack={handleBackToPlayMode}
        />
      )}

      <div className="player-hand__cards">
        {handArray.map((cardId, index) => {
          const playability = playableCardMap.get(cardId);
          const isPlayable = playability !== undefined;

          return (
            <Card
              key={`${cardId}-${index}`}
              cardId={cardId}
              isSelected={selectedIndex === index}
              isPlayable={isPlayable}
              isInCombat={isInCombat}
              onClick={() => handleCardClick(index)}
            />
          );
        })}
      </div>
    </div>
  );
}
