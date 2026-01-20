/**
 * DebugPanel - Development tools for testing the game
 *
 * Tabbed interface providing debug controls for:
 * - Gameplay: Combat, cards, mana, units, level, movement
 * - Save/Load: Quick slots, import/export
 * - Audio: Sound effects, ambient music
 */

import { useState } from "react";
import { useGame } from "../../hooks/useGame";
import { GameplayTab } from "./GameplayTab";
import { SaveLoadTab } from "./SaveLoadTab";
import { AudioTab } from "./AudioTab";
import { DisplayTab } from "./DisplayTab";
import { EventLogTab } from "./EventLogTab";
import { TABS, type TabId } from "./types";

export function DebugPanel() {
  const { state, saveGame, loadGame } = useGame();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("gameplay");

  if (!state) return null;

  if (!isOpen) {
    return (
      <button
        className="debug-panel__toggle"
        onClick={() => setIsOpen(true)}
        title="Open Debug Panel"
        type="button"
      >
        Debug
      </button>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case "gameplay":
        return <GameplayTab state={state} saveGame={saveGame} loadGame={loadGame} />;
      case "saveload":
        return <SaveLoadTab state={state} saveGame={saveGame} loadGame={loadGame} />;
      case "audio":
        return <AudioTab />;
      case "display":
        return <DisplayTab />;
      case "eventlog":
        return <EventLogTab />;
      default:
        return null;
    }
  };

  return (
    <div className="debug-panel">
      <div className="debug-panel__header">
        <h3>Debug Panel</h3>
        <button type="button" onClick={() => setIsOpen(false)}>X</button>
      </div>

      <div className="debug-panel__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`debug-panel__tab ${activeTab === tab.id ? "debug-panel__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="debug-panel__content">
        {renderTab()}
      </div>
    </div>
  );
}
