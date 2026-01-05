import { useState } from "react";
import {
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  PLAY_SIDEWAYS_AS_MOVE,
  type CardId,
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
  onClick: () => void;
}

function Card({ cardId, isSelected, onClick }: CardProps) {
  return (
    <button
      className={`card ${isSelected ? "card--selected" : ""}`}
      onClick={onClick}
      type="button"
    >
      <div className="card__name">{formatCardName(cardId)}</div>
    </button>
  );
}

interface PlayModeMenuProps {
  cardId: CardId;
  onPlay: (mode: "basic" | "powered" | "sideways") => void;
  onCancel: () => void;
}

function PlayModeMenu({ cardId, onPlay, onCancel }: PlayModeMenuProps) {
  return (
    <div className="play-mode-menu">
      <div className="play-mode-menu__title">Play {formatCardName(cardId)}</div>
      <div className="play-mode-menu__options">
        <button
          className="play-mode-menu__btn play-mode-menu__btn--basic"
          onClick={() => onPlay("basic")}
          type="button"
        >
          Basic Effect
        </button>
        <button
          className="play-mode-menu__btn play-mode-menu__btn--sideways"
          onClick={() => onPlay("sideways")}
          type="button"
        >
          Sideways (+1 Move)
        </button>
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
  const { sendAction } = useGame();
  const player = useMyPlayer();
  // Track selection by index to handle duplicate cards correctly
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!player || !Array.isArray(player.hand)) {
    return null;
  }

  const selectedCard = selectedIndex !== null ? player.hand[selectedIndex] : null;

  const handleCardClick = (index: number) => {
    if (selectedIndex === index) {
      // Clicking again deselects
      setSelectedIndex(null);
    } else {
      setSelectedIndex(index);
    }
  };

  const handlePlay = (mode: "basic" | "powered" | "sideways") => {
    if (selectedCard === null || selectedCard === undefined) return;

    if (mode === "sideways") {
      sendAction({
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: selectedCard,
        as: PLAY_SIDEWAYS_AS_MOVE,
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
    <div className="player-hand">
      <div className="player-hand__header">
        <h3 className="panel__title">Hand ({player.hand.length} cards)</h3>
        <div className="player-hand__stats">
          Move: {player.movePoints} | Influence: {player.influencePoints}
        </div>
      </div>

      {selectedCard && (
        <PlayModeMenu
          cardId={selectedCard}
          onPlay={handlePlay}
          onCancel={handleCancel}
        />
      )}

      <div className="player-hand__cards">
        {player.hand.map((cardId, index) => (
          <Card
            key={`${cardId}-${index}`}
            cardId={cardId}
            isSelected={selectedIndex === index}
            onClick={() => handleCardClick(index)}
          />
        ))}
      </div>
    </div>
  );
}
