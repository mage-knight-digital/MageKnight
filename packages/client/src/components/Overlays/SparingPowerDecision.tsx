import {
  RESOLVE_TACTIC_DECISION_ACTION,
  TACTIC_DECISION_SPARING_POWER,
  SPARING_POWER_CHOICE_STASH,
  SPARING_POWER_CHOICE_TAKE,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";

export function SparingPowerDecision() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  // Check if we have a pending Sparing Power decision
  const pendingDecision =
    state?.validActions?.mode === "pending_tactic_decision"
      ? state.validActions.tacticDecision
      : undefined;
  if (
    !pendingDecision ||
    pendingDecision.type !== TACTIC_DECISION_SPARING_POWER ||
    !player
  ) {
    return null;
  }

  const canStash = pendingDecision.canStash ?? false;
  const storedCount = pendingDecision.storedCount ?? 0;

  const handleStash = () => {
    sendAction({
      type: RESOLVE_TACTIC_DECISION_ACTION,
      decision: {
        type: TACTIC_DECISION_SPARING_POWER,
        choice: SPARING_POWER_CHOICE_STASH,
      },
    });
  };

  const handleTake = () => {
    sendAction({
      type: RESOLVE_TACTIC_DECISION_ACTION,
      decision: {
        type: TACTIC_DECISION_SPARING_POWER,
        choice: SPARING_POWER_CHOICE_TAKE,
      },
    });
  };

  return (
    <div className="overlay">
      <div className="overlay__content choice-selection">
        <h2 className="choice-selection__title">Sparing Power</h2>
        <p style={{ color: "#999", marginBottom: "1rem", textAlign: "center" }}>
          Before your turn, choose to stash a card from your deck,
          or take all stored cards into your hand.
        </p>
        <p style={{ color: "#3498db", marginBottom: "1rem", textAlign: "center" }}>
          Cards stored under tactic: {storedCount}
        </p>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <button
            type="button"
            onClick={handleStash}
            disabled={!canStash}
            style={{
              padding: "1rem 2rem",
              borderRadius: "6px",
              background: canStash ? "#2c3e50" : "#1a1a1a",
              color: canStash ? "#fff" : "#666",
              border: "none",
              cursor: canStash ? "pointer" : "not-allowed",
              fontSize: "1rem",
              fontWeight: 600,
              opacity: canStash ? 1 : 0.5,
            }}
            title={canStash ? "Take top card of deck and store under tactic" : "Deck is empty"}
          >
            Stash
            <div style={{ fontSize: "0.7rem", fontWeight: 400, marginTop: "0.25rem" }}>
              Store top card of deck
            </div>
          </button>

          <button
            type="button"
            onClick={handleTake}
            style={{
              padding: "1rem 2rem",
              borderRadius: "6px",
              background: storedCount > 0 ? "#27ae60" : "#2c3e50",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: 600,
            }}
            title="Take all stored cards into hand (flips tactic)"
          >
            Take
            <div style={{ fontSize: "0.7rem", fontWeight: 400, marginTop: "0.25rem" }}>
              {storedCount > 0
                ? `Draw ${storedCount} card${storedCount > 1 ? "s" : ""}`
                : "Flip tactic (no cards)"}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
