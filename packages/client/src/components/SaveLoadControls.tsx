/**
 * SaveLoadControls - Save/Load game state controls
 *
 * Provides 3 save slots with save/load/export functionality.
 * Can be used in main header or combat overlay.
 */

import { useState } from "react";
import { useGame } from "../hooks/useGame";
import "./SaveLoadControls.css";

const SAVE_SLOT_COUNT = 3;
const SAVE_KEY_PREFIX = "mageKnight_save_";
const SAVE_META_KEY = "mageKnight_saveMeta";

interface SaveSlotMeta {
  timestamp: number;
  round: number;
  timeOfDay: string;
}

interface SaveLoadControlsProps {
  compact?: boolean; // Compact mode for combat overlay
}

export function SaveLoadControls({ compact = false }: SaveLoadControlsProps) {
  const { saveGame, loadGame, state } = useGame();
  const [slotMeta, setSlotMeta] = useState<(SaveSlotMeta | null)[]>(() => {
    const saved = localStorage.getItem(SAVE_META_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as (SaveSlotMeta | null)[];
      } catch {
        return Array(SAVE_SLOT_COUNT).fill(null);
      }
    }
    return Array(SAVE_SLOT_COUNT).fill(null);
  });

  const handleSave = (slotIndex: number) => {
    const json = saveGame();
    if (!json || !state) return;

    localStorage.setItem(`${SAVE_KEY_PREFIX}${slotIndex}`, json);

    const meta: SaveSlotMeta = {
      timestamp: Date.now(),
      round: state.round,
      timeOfDay: state.timeOfDay,
    };

    const newMeta = [...slotMeta];
    newMeta[slotIndex] = meta;
    setSlotMeta(newMeta);
    localStorage.setItem(SAVE_META_KEY, JSON.stringify(newMeta));
  };

  const handleLoad = (slotIndex: number) => {
    const json = localStorage.getItem(`${SAVE_KEY_PREFIX}${slotIndex}`);
    if (json) {
      loadGame(json);
    }
  };

  const handleExport = (slotIndex: number) => {
    const json = localStorage.getItem(`${SAVE_KEY_PREFIX}${slotIndex}`);
    if (!json) return;

    // Pretty-print the JSON for readability
    const formatted = JSON.stringify(JSON.parse(json), null, 2);
    const blob = new Blob([formatted], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mage-knight-save-${slotIndex + 1}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (compact) {
    // Compact mode: just show save buttons with slot numbers
    return (
      <div className="save-load-controls save-load-controls--compact">
        {Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => {
          const meta = slotMeta[i];
          return (
            <div key={i} className="save-slot save-slot--compact">
              <button
                className="save-slot__btn save-slot__btn--save"
                onClick={() => handleSave(i)}
                title={meta
                  ? `Save to slot ${i + 1} (R${meta.round} ${meta.timeOfDay})`
                  : `Save to slot ${i + 1}`}
              >
                S{i + 1}
              </button>
              <button
                className="save-slot__btn save-slot__btn--load"
                onClick={() => handleLoad(i)}
                disabled={!meta}
                title={meta ? `Load R${meta.round} ${meta.timeOfDay}` : "Empty slot"}
              >
                L{i + 1}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="save-load-controls">
      {Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => {
        const meta = slotMeta[i];
        return (
          <div key={i} className="save-slot">
            <span className="save-slot__label">
              {meta
                ? `R${meta.round} ${meta.timeOfDay} (${formatTime(meta.timestamp)})`
                : `Slot ${i + 1}`}
            </span>
            <button
              className="save-slot__btn save-slot__btn--save"
              onClick={() => handleSave(i)}
              title={`Save to slot ${i + 1}`}
            >
              Save
            </button>
            <button
              className="save-slot__btn save-slot__btn--load"
              onClick={() => handleLoad(i)}
              disabled={!meta}
              title={meta ? `Load from slot ${i + 1}` : "Empty slot"}
            >
              Load
            </button>
            <button
              className="save-slot__btn save-slot__btn--export"
              onClick={() => handleExport(i)}
              disabled={!meta}
              title={meta ? `Export slot ${i + 1} as JSON` : "Empty slot"}
            >
              ↓
            </button>
          </div>
        );
      })}
    </div>
  );
}
