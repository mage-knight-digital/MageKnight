import { RESOLVE_CHOICE_ACTION } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";

// Format card ID for display (convert snake_case to Title Case)
function formatCardName(cardId: string): string {
  return cardId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function ChoiceSelection() {
  const { sendAction } = useGame();
  const player = useMyPlayer();

  // Don't show if no pending choice
  if (!player || !player.pendingChoice) {
    return null;
  }

  const { cardId, options } = player.pendingChoice;

  const handleSelectChoice = (choiceIndex: number) => {
    sendAction({
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex,
    });
  };

  return (
    <div className="overlay">
      <div className="overlay__content choice-selection">
        <h2 className="choice-selection__title">
          Choose an Effect for {formatCardName(cardId)}
        </h2>
        <div className="choice-selection__options">
          {options.map((option, index) => (
            <button
              key={index}
              className="choice-selection__option"
              onClick={() => handleSelectChoice(index)}
              type="button"
            >
              <div className="choice-selection__option-description">
                {option.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
