import { useCallback, useEffect } from "react";
import { UNDO_ACTION } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useRegisterOverlay } from "../../contexts/OverlayContext";

export function HexCostReductionOverlay() {
  const { state, sendAction } = useGame();

  const options =
    state?.validActions?.mode === "pending_hex_cost_reduction"
      ? state.validActions.hexCostReduction
      : undefined;

  const canUndo =
    state?.validActions?.mode === "pending_hex_cost_reduction"
      ? state.validActions.turn.canUndo
      : false;

  useRegisterOverlay(!!options);

  const handleUndo = useCallback(() => {
    sendAction({ type: UNDO_ACTION });
  }, [sendAction]);

  // Escape key for undo
  useEffect(() => {
    if (!options || !canUndo) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options, canUndo, handleUndo]);

  if (!options) return null;

  const { reduction, minimumCost } = options;

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
          Reduces terrain cost by {Math.abs(reduction)} (minimum {minimumCost})
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
