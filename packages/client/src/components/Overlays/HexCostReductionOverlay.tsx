import { useCallback, useEffect } from "react";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { hasAction, findAction } from "../../rust/legalActionUtils";

export function HexCostReductionOverlay() {
  const { sendAction, legalActions } = useGame();
  const player = useMyPlayer();

  // Active when pending state is hex cost reduction (user clicks highlighted hex on map)
  const isActive = player?.pending?.kind === "terrain_cost_reduction"
    || legalActions.some((a) => typeof a !== "string" && "ResolveHexCostReduction" in a);

  const canUndo = hasAction(legalActions, "Undo");

  useRegisterOverlay(isActive);

  const handleUndo = useCallback(() => {
    const action = findAction(legalActions, "Undo");
    if (action) sendAction(action);
  }, [sendAction, legalActions]);

  // Escape key for undo
  useEffect(() => {
    if (!isActive || !canUndo) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, canUndo, handleUndo]);

  if (!isActive) return null;

  // Reduction/minimumCost are display-only; derive from pending label or use defaults
  const reduction = -1;
  const minimumCost = 0;

  return (
    <div
      className="overlay"
      style={{ background: "rgba(0, 0, 0, 0.5)", pointerEvents: "none" }}
    >
      <div
        className="overlay__content"
        style={{
          pointerEvents: "auto",
          position: "absolute",
          top: "1.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          padding: "1rem 2rem",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem", color: "#c8b8ff" }}>
          Select Hex for Cost Reduction
        </h2>
        <p style={{ margin: "0 0 0.5rem", color: "#aaa", fontSize: "0.9rem" }}>
          {player?.pending?.label ?? "Reduces terrain cost for a hex"}
        </p>
        <p style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}>
          Click a highlighted hex
        </p>
        {canUndo && (
          <button
            type="button"
            onClick={handleUndo}
            style={{
              marginTop: "0.75rem",
              padding: "0.4rem 1.2rem",
              borderRadius: "6px",
              background: "#444",
              color: "#fff",
              border: "1px solid #666",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Undo (Esc)
          </button>
        )}
      </div>
    </div>
  );
}
