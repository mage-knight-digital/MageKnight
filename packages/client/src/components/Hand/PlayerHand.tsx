import { useState } from "react";
import {
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  type CardId,
  type PlayableCard,
  type SidewaysAs,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";

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
function getBasicLabel(isInCombat: boolean, combatPhase?: string): string {
  if (!isInCombat) {
    return "Basic Effect";
  }

  switch (combatPhase) {
    case "ranged_siege":
      return "Ranged/Siege Attack";
    case "block":
      return "Block";
    case "attack":
      return "Attack";
    default:
      return "Basic Effect";
  }
}

interface PlayModeMenuProps {
  cardId: CardId;
  playability: PlayableCard | null;
  isInCombat: boolean;
  combatPhase?: string;
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

export function PlayerHand() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  // Track selection by index to handle duplicate cards correctly
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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

    if (selectedIndex === index) {
      // Clicking again deselects
      setSelectedIndex(null);
    } else {
      setSelectedIndex(index);
    }
  };

  const handlePlay = (mode: "basic" | "powered" | { sideways: SidewaysAs }) => {
    if (selectedCard === null || selectedCard === undefined) return;

    if (typeof mode === "object" && "sideways" in mode) {
      sendAction({
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: selectedCard,
        as: mode.sideways,
      });
    } else {
      sendAction({
        type: PLAY_CARD_ACTION,
        cardId: selectedCard,
        powered: mode === "powered",
      });
    }
    setSelectedIndex(null);
  };

  const handleCancel = () => {
    setSelectedIndex(null);
  };

  return (
    <div className="player-hand" data-testid="player-hand">
      <div className="player-hand__header">
        <h3 className="panel__title">Hand ({player.hand.length} cards)</h3>
        <div className="player-hand__stats">
          Move: {player.movePoints} | Influence: {player.influencePoints}
        </div>
      </div>

      {selectedCard && selectedPlayability && (
        <PlayModeMenu
          cardId={selectedCard}
          playability={selectedPlayability}
          isInCombat={isInCombat}
          combatPhase={combatPhase}
          onPlay={handlePlay}
          onCancel={handleCancel}
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
