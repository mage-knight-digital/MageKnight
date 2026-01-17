/**
 * SaveLoadTab - Debug controls for save/load operations
 *
 * Provides controls for:
 * - Quick save slots (localStorage)
 * - Export/import server state
 * - Log/download client state
 */

import type { DebugTabProps } from "./types";

export function SaveLoadTab({ state, saveGame, loadGame }: DebugTabProps) {
  const handleExportState = () => {
    const json = saveGame();
    if (!json) return;

    const formatted = JSON.stringify(JSON.parse(json), null, 2);
    const blob = new Blob([formatted], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mage-knight-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportState = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      try {
        JSON.parse(json); // Validate JSON
        loadGame(json);
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      {/* Client State Section */}
      <section className="debug-panel__section">
        <h4>Client State</h4>
        <div className="debug-panel__row">
          <button
            type="button"
            onClick={() => {
              console.log("=== CLIENT STATE (with validActions) ===");
              console.log(state);
              console.log("=== validActions.move ===");
              console.log(state.validActions?.move);
            }}
            title="Log client state to console (includes validActions)"
          >
            Log to Console
          </button>
          <button
            type="button"
            onClick={() => {
              const formatted = JSON.stringify(state, null, 2);
              const blob = new Blob([formatted], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `mage-knight-client-state-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            title="Download client state as JSON (includes validActions)"
          >
            Download JSON
          </button>
        </div>
      </section>

      {/* Quick Save Slots Section */}
      <section className="debug-panel__section">
        <h4>Quick Save Slots</h4>
        <div className="debug-panel__row">
          {[0, 1, 2].map((slotIndex) => {
            const slotKey = `mageKnight_save_${slotIndex}`;
            const hasSave = localStorage.getItem(slotKey) !== null;
            return (
              <div key={slotIndex} className="debug-panel__save-slot">
                <span className="debug-panel__slot-label">Slot {slotIndex + 1}</span>
                <button
                  type="button"
                  onClick={() => {
                    const json = saveGame();
                    if (json) {
                      localStorage.setItem(slotKey, json);
                      alert(`Saved to slot ${slotIndex + 1}`);
                    }
                  }}
                  title={`Save to slot ${slotIndex + 1}`}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const json = localStorage.getItem(slotKey);
                    if (json) loadGame(json);
                  }}
                  disabled={!hasSave}
                  title={hasSave ? `Load slot ${slotIndex + 1}` : "Empty slot"}
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(slotKey);
                    alert(`Cleared slot ${slotIndex + 1}`);
                  }}
                  disabled={!hasSave}
                  title="Clear this slot"
                  className="debug-panel__clear-btn"
                >
                  X
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Server State Section */}
      <section className="debug-panel__section">
        <h4>Server State</h4>
        <div className="debug-panel__row">
          <button type="button" onClick={handleExportState} title="Download server state (for save/load)">
            Export to File
          </button>
          <label className="debug-panel__file-input">
            Import from File
            <input
              type="file"
              accept=".json"
              onChange={handleImportState}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </section>
    </>
  );
}
