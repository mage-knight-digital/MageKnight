import type { CardId, PlayableCard, SidewaysAs } from "@mage-knight/shared";
import {
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
} from "@mage-knight/shared";
import { getCardSpriteStyle } from "../../utils/cardAtlas";
import "./ExpandedCard.css";

interface ExpandedCardProps {
  cardId: CardId;
  playability: PlayableCard;
  isInCombat: boolean;
  onPlayBasic: () => void;
  onPlayPowered: () => void;
  onPlaySideways: (as: SidewaysAs) => void;
  onCancel: () => void;
}

export function ExpandedCard({
  cardId,
  playability,
  isInCombat,
  onPlayBasic,
  onPlayPowered,
  onPlaySideways,
  onCancel,
}: ExpandedCardProps) {
  const spriteStyle = getCardSpriteStyle(cardId, 400);

  // Determine available sideways options
  const sidewaysOptions = playability.sidewaysOptions ?? [];
  const canPlayBasic = playability.canPlayBasic;
  const canPlayPowered = playability.canPlayPowered;

  return (
    <div className="expanded-card-overlay" onClick={onCancel}>
      <div className="expanded-card" onClick={(e) => e.stopPropagation()}>
        {/* The card image with clickable zones */}
        <div className="expanded-card__image" style={spriteStyle ?? undefined}>
          {/* Basic effect zone - upper portion of card */}
          {canPlayBasic && (
            <button
              className="expanded-card__zone expanded-card__zone--basic"
              onClick={onPlayBasic}
              type="button"
              aria-label="Play Basic"
            />
          )}

          {/* Powered effect zone - lower portion of card */}
          {canPlayPowered && (
            <button
              className="expanded-card__zone expanded-card__zone--powered"
              onClick={onPlayPowered}
              type="button"
              aria-label="Play Powered"
            />
          )}
        </div>

        {/* Sideways options - beside the card */}
        {playability.canPlaySideways && sidewaysOptions.length > 0 && (
          <div className="expanded-card__sideways">
            {sidewaysOptions.map((option, idx) => (
              <button
                key={idx}
                className="expanded-card__sideways-btn"
                onClick={() => onPlaySideways(option.as)}
                type="button"
              >
                +{option.value} {getSidewaysLabel(option.as, isInCombat)}
              </button>
            ))}
          </div>
        )}

        {/* Fallback sideways for non-combat if no explicit options */}
        {playability.canPlaySideways && sidewaysOptions.length === 0 && !isInCombat && (
          <div className="expanded-card__sideways">
            <button
              className="expanded-card__sideways-btn"
              onClick={() => onPlaySideways(PLAY_SIDEWAYS_AS_MOVE)}
              type="button"
            >
              +1 Move
            </button>
            <button
              className="expanded-card__sideways-btn"
              onClick={() => onPlaySideways(PLAY_SIDEWAYS_AS_INFLUENCE)}
              type="button"
            >
              +1 Influence
            </button>
          </div>
        )}

        {/* Cancel button */}
        <button
          className="expanded-card__cancel"
          onClick={onCancel}
          type="button"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function getSidewaysLabel(as: SidewaysAs, isInCombat: boolean): string {
  if (!isInCombat) {
    switch (as) {
      case PLAY_SIDEWAYS_AS_MOVE:
        return "Move";
      case PLAY_SIDEWAYS_AS_INFLUENCE:
        return "Influence";
      default:
        return "";
    }
  }
  switch (as) {
    case PLAY_SIDEWAYS_AS_ATTACK:
      return "Attack";
    case PLAY_SIDEWAYS_AS_BLOCK:
      return "Block";
    default:
      return "";
  }
}
