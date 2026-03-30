import { useGame } from "../../hooks/useGame";
import { hasAction, findAction } from "../../rust/legalActionUtils";

export function ManaSearchReroll() {
  const { sendAction, legalActions } = useGame();

  // Show "Mana Search" button when InitiateManaSearch is in the legal action set
  const canInitiate = hasAction(legalActions, "InitiateManaSearch");

  if (!canInitiate) {
    return null;
  }

  const handleInitiate = () => {
    const action = findAction(legalActions, "InitiateManaSearch");
    if (action) sendAction(action);
  };

  // Just show the trigger button — once initiated, the SubsetSelection pending
  // will be handled by the existing subset selection overlay system
  return (
    <button
      type="button"
      onClick={handleInitiate}
      style={{
        position: "fixed",
        bottom: "80px",
        right: "20px",
        padding: "0.75rem 1.5rem",
        borderRadius: "6px",
        background: "#8e44ad",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        fontSize: "0.9rem",
        fontWeight: 600,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        zIndex: 100,
      }}
      title="Reroll up to 2 source dice (Mana Search)"
    >
      Mana Search
    </button>
  );
}
