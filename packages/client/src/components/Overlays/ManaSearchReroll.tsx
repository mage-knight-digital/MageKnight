import { useState } from "react";
import {
  REROLL_SOURCE_DICE_ACTION,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";

function getManaColor(color: string): string {
  switch (color) {
    case MANA_RED:
      return "#e74c3c";
    case MANA_BLUE:
      return "#3498db";
    case MANA_GREEN:
      return "#2ecc71";
    case MANA_WHITE:
      return "#bdc3c7";
    case MANA_GOLD:
      return "#f39c12";
    case MANA_BLACK:
      return "#2c3e50";
    default:
      return "#666";
  }
}

export function ManaSearchReroll() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const [selectedDice, setSelectedDice] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Check if Mana Search reroll is available
  const canRerollSourceDice = state?.validActions.tacticEffects?.canRerollSourceDice;
  if (!canRerollSourceDice || !player || !state) {
    return null;
  }

  const maxDice = canRerollSourceDice.maxDice;
  const mustPickDepletedFirst = canRerollSourceDice.mustPickDepletedFirst;
  const availableDiceIds = canRerollSourceDice.availableDiceIds ?? [];

  // Get the dice info from state
  const availableDice = state.source.dice.filter(
    (d) => availableDiceIds.includes(d.id)
  );

  const toggleDie = (dieId: string) => {
    if (selectedDice.includes(dieId)) {
      setSelectedDice(selectedDice.filter((id) => id !== dieId));
    } else if (selectedDice.length < maxDice) {
      setSelectedDice([...selectedDice, dieId]);
    }
  };

  const handleReroll = () => {
    if (selectedDice.length > 0) {
      sendAction({
        type: REROLL_SOURCE_DICE_ACTION,
        dieIds: selectedDice,
      });
      setSelectedDice([]);
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setSelectedDice([]);
    setIsOpen(false);
  };

  // Show button when closed
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
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

  return (
    <div className="overlay">
      <div className="overlay__content choice-selection">
        <h2 className="choice-selection__title">Mana Search</h2>
        <p style={{ color: "#999", marginBottom: "1rem", textAlign: "center" }}>
          Select up to {maxDice} dice to reroll.
          {mustPickDepletedFirst && (
            <span style={{ color: "#e74c3c", display: "block" }}>
              Must include gold/depleted dice if present.
            </span>
          )}
        </p>
        <p style={{ color: "#3498db", marginBottom: "1rem", textAlign: "center" }}>
          Selected: {selectedDice.length} / {maxDice}
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            justifyContent: "center",
            marginBottom: "1rem",
          }}
        >
          {availableDice.map((die) => {
            const isSelected = selectedDice.includes(die.id);
            const isRestricted = die.isDepleted || die.color === MANA_GOLD;
            return (
              <button
                key={die.id}
                type="button"
                onClick={() => toggleDie(die.id)}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "6px",
                  background: isSelected
                    ? "#8e44ad"
                    : getManaColor(die.color),
                  color: "#fff",
                  border: isSelected
                    ? "3px solid #fff"
                    : isRestricted
                      ? "3px dashed #e74c3c"
                      : "3px solid transparent",
                  cursor:
                    selectedDice.length >= maxDice && !isSelected
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    selectedDice.length >= maxDice && !isSelected ? 0.5 : 1,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  minWidth: "4rem",
                }}
              >
                {die.color.toUpperCase()}
                {die.isDepleted && (
                  <div style={{ fontSize: "0.6rem" }}>DEPLETED</div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "6px",
              background: "#7f8c8d",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReroll}
            disabled={selectedDice.length === 0}
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "6px",
              background: selectedDice.length > 0 ? "#8e44ad" : "#333",
              color: "#fff",
              border: "none",
              cursor: selectedDice.length > 0 ? "pointer" : "not-allowed",
              fontSize: "1rem",
              fontWeight: 600,
              opacity: selectedDice.length > 0 ? 1 : 0.5,
            }}
          >
            Reroll {selectedDice.length} Die{selectedDice.length !== 1 ? "ce" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
