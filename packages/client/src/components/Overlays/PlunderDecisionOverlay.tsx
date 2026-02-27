import { useCallback } from "react";
import { useGame } from "../../hooks/useGame";
import { findAction } from "../../rust/legalActionUtils";
import { useRegisterOverlay } from "../../contexts/OverlayContext";

export function PlunderDecisionOverlay() {
  const { legalActions, sendAction } = useGame();

  const plunderAction = findAction(legalActions, "PlunderSite");
  const declineAction = findAction(legalActions, "DeclinePlunder");
  const isActive = plunderAction != null || declineAction != null;

  useRegisterOverlay(isActive);

  const handlePlunder = useCallback(() => {
    if (plunderAction) sendAction(plunderAction);
  }, [sendAction, plunderAction]);

  const handleDecline = useCallback(() => {
    if (declineAction) sendAction(declineAction);
  }, [sendAction, declineAction]);

  if (!isActive) return null;

  return (
    <div className="overlay">
      <div className="overlay__content choice-selection">
        <h2 className="choice-selection__title">Plunder Site</h2>
        <p style={{ color: "#999", marginBottom: "1rem", textAlign: "center" }}>
          Plundering burns the site and costs 1 reputation.
        </p>
        <div
          className="choice-selection__options"
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {plunderAction && (
            <button
              className="choice-selection__option"
              onClick={handlePlunder}
              type="button"
              style={{
                padding: "1.5rem 2rem",
                borderRadius: "8px",
                background: "#8b1a1a",
                color: "#fff",
                fontWeight: 700,
                fontSize: "1rem",
                border: "3px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
                minWidth: "8rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = "3px solid #fff";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = "3px solid transparent";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Plunder
            </button>
          )}
          {declineAction && (
            <button
              className="choice-selection__option"
              onClick={handleDecline}
              type="button"
              style={{
                padding: "1.5rem 2rem",
                borderRadius: "8px",
                background: "#555",
                color: "#fff",
                fontWeight: 700,
                fontSize: "1rem",
                border: "3px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
                minWidth: "8rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = "3px solid #fff";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = "3px solid transparent";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Decline
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
