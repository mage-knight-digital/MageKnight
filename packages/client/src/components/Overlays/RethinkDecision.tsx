import { useCallback, useMemo } from "react";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { extractSubsetSelectOptions, findAction } from "../../rust/legalActionUtils";

// Format card ID for display (convert snake_case to Title Case)
function formatCardName(cardId: string): string {
  return cardId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function RethinkDecision() {
  const { legalActions, sendAction } = useGame();
  const player = useMyPlayer();

  const isActive =
    player?.pending?.kind === "rethink" && legalActions.length > 0;

  const subsetOptions = useMemo(
    () => extractSubsetSelectOptions(legalActions),
    [legalActions],
  );
  const confirmAction = findAction(legalActions, "SubsetConfirm");

  // Build lookup: hand index → SubsetSelect action (only for unselected items)
  const optionByIndex = useMemo(() => {
    const map = new Map<number, (typeof subsetOptions)[number]>();
    for (const opt of subsetOptions) {
      map.set(opt.index, opt);
    }
    return map;
  }, [subsetOptions]);

  const handleCardClick = useCallback(
    (index: number) => {
      const opt = optionByIndex.get(index);
      if (opt) sendAction(opt.action);
    },
    [optionByIndex, sendAction],
  );

  const handleConfirm = useCallback(() => {
    if (confirmAction) sendAction(confirmAction);
  }, [confirmAction, sendAction]);

  if (!isActive || !player) {
    return null;
  }

  const hand = Array.isArray(player.hand) ? player.hand : [];
  const selected = new Set(player.pending?.selected ?? []);
  const maxCards = 3;

  return (
    <div className="overlay">
      <div className="overlay__content choice-selection">
        <h2 className="choice-selection__title">Rethink</h2>
        <p
          style={{ color: "#999", marginBottom: "1rem", textAlign: "center" }}
        >
          Select up to {maxCards} cards to discard and redraw.
        </p>
        <p
          style={{
            color: "#3498db",
            marginBottom: "1rem",
            textAlign: "center",
          }}
        >
          Selected: {selected.size} / {maxCards}
        </p>

        {hand.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center" }}>
            Your hand is empty.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              justifyContent: "center",
              marginBottom: "1rem",
              maxWidth: "600px",
            }}
          >
            {hand.map((cardId, index) => {
              const isSelected = selected.has(index);
              const isSelectable = optionByIndex.has(index);
              const isWound = cardId.includes("wound");
              return (
                <button
                  key={`${cardId}-${index}`}
                  type="button"
                  onClick={() => handleCardClick(index)}
                  disabled={!isSelectable}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    background: isSelected
                      ? "#1a237e"
                      : isWound
                        ? "#8b4513"
                        : "#2c3e50",
                    color: "#fff",
                    border: isSelected
                      ? "2px solid #fff"
                      : "2px solid transparent",
                    cursor: isSelectable ? "pointer" : "not-allowed",
                    opacity: isSelectable ? 1 : 0.5,
                    fontSize: "0.85rem",
                    fontWeight: isSelected ? 700 : 400,
                    transition: "all 0.2s ease",
                  }}
                >
                  {formatCardName(cardId)}
                  {isWound && " (Wound)"}
                </button>
              );
            })}
          </div>
        )}

        {confirmAction && (
          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={handleConfirm}
              style={{
                padding: "0.75rem 2rem",
                borderRadius: "6px",
                background: "#1a237e",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              {selected.size === 0
                ? "Skip (Discard Nothing)"
                : `Confirm ${selected.size} Card${selected.size > 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
