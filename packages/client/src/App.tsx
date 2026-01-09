import { useEffect, useRef, useState } from "react";
import { GameProvider } from "./context/GameContext";
import { useGame } from "./hooks/useGame";
import { useMyPlayer } from "./hooks/useMyPlayer";
import { HexGrid } from "./components/GameBoard/HexGrid";
import { PlayerHand } from "./components/Hand/PlayerHand";
import { TacticSelection } from "./components/Overlays/TacticSelection";
import { ChoiceSelection } from "./components/Overlays/ChoiceSelection";
import { ActionBar } from "./components/Overlays/ActionBar";
import { CombatOverlay } from "./components/Combat";
import { UnitOfferPanel, OwnedUnitsPanel } from "./components/Offers";
import type { GameEvent } from "@mage-knight/shared";
import {
  CARD_PLAYED,
  COMBAT_STARTED,
  ENEMY_DEFEATED,
  FAME_GAINED,
  INVALID_ACTION,
  LEVEL_UP,
  MANA_BLACK,
  MANA_BLUE,
  MANA_GOLD,
  MANA_GREEN,
  MANA_RED,
  MANA_WHITE,
  PLAYER_MOVED,
  TACTIC_SELECTED,
  TILE_EXPLORED,
  TURN_ENDED,
  UNDO_CHECKPOINT_SET,
  WOUND_RECEIVED,
} from "@mage-knight/shared";

// Get seed from URL param (?seed=12345) or use current time
// This allows reproducible games for testing and debugging
function getGameSeed(): number {
  const urlParams = new URLSearchParams(window.location.search);
  const seedParam = urlParams.get("seed");
  if (seedParam) {
    const seed = parseInt(seedParam, 10);
    if (!isNaN(seed)) {
      console.log("Game seed (from URL):", seed);
      return seed;
    }
  }
  const seed = Date.now();
  console.log("Game seed (random):", seed);
  return seed;
}

const GAME_SEED = getGameSeed();

function ResourcePanel() {
  const player = useMyPlayer();

  if (!player) return null;

  return (
    <div className="panel">
      <h3 className="panel__title">Player Info</h3>
      <div className="resources">
        <div className="resource">
          <span className="resource__label">Hero</span>
          <span className="resource__value">{player.heroId}</span>
        </div>
        <div className="resource">
          <span className="resource__label">Level</span>
          <span className="resource__value">{player.level}</span>
        </div>
        <div className="resource">
          <span className="resource__label">Fame</span>
          <span className="resource__value">{player.fame}</span>
        </div>
        <div className="resource">
          <span className="resource__label">Reputation</span>
          <span className="resource__value">{player.reputation}</span>
        </div>
        <div className="resource">
          <span className="resource__label">Armor</span>
          <span className="resource__value">{player.armor}</span>
        </div>
        <div className="resource">
          <span className="resource__label">Move Points</span>
          <span className="resource__value">{player.movePoints}</span>
        </div>
        <div className="resource">
          <span className="resource__label">Deck</span>
          <span className="resource__value">{player.deckCount} cards</span>
        </div>
        <div className="resource">
          <span className="resource__label">Discard</span>
          <span className="resource__value">{player.discardCount} cards</span>
        </div>
      </div>
    </div>
  );
}

function CrystalsPanel() {
  const player = useMyPlayer();

  if (!player) return null;

  return (
    <div className="panel">
      <h3 className="panel__title">Crystals</h3>
      <div className="resources">
        <div className="resource">
          <span className="resource__label" style={{ color: "#e74c3c" }}>
            Red
          </span>
          <span className="resource__value">{player.crystals.red}</span>
        </div>
        <div className="resource">
          <span className="resource__label" style={{ color: "#3498db" }}>
            Blue
          </span>
          <span className="resource__value">{player.crystals.blue}</span>
        </div>
        <div className="resource">
          <span className="resource__label" style={{ color: "#2ecc71" }}>
            Green
          </span>
          <span className="resource__value">{player.crystals.green}</span>
        </div>
        <div className="resource">
          <span className="resource__label" style={{ color: "#ecf0f1" }}>
            White
          </span>
          <span className="resource__value">{player.crystals.white}</span>
        </div>
      </div>
    </div>
  );
}

function ManaSourcePanel() {
  const { state } = useGame();
  const player = useMyPlayer();

  if (!state) return null;

  const myId = player?.id;

  return (
    <div className="panel">
      <h3 className="panel__title">Mana Source</h3>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {state.source.dice.map((die) => {
          const isTakenByMe = die.takenByPlayerId === myId;
          const isTakenByOther = die.takenByPlayerId !== null && !isTakenByMe;
          const isUnavailable = die.isDepleted || isTakenByMe || isTakenByOther;

          return (
            <div
              key={die.id}
              style={{
                padding: "0.5rem",
                borderRadius: "4px",
                background: isUnavailable ? "#333" : getManaColor(die.color),
                color: isUnavailable ? "#888" : "#fff",
                fontWeight: 600,
                fontSize: "0.75rem",
                opacity: isUnavailable ? 0.5 : 1,
                position: "relative",
                minWidth: "3rem",
                textAlign: "center",
              }}
              title={
                die.isDepleted
                  ? `${die.color} (depleted)`
                  : isTakenByMe
                    ? `${die.color} (used by you)`
                    : isTakenByOther
                      ? `${die.color} (taken)`
                      : die.color
              }
            >
              {die.color.toUpperCase()}
              {isTakenByMe && (
                <div style={{ fontSize: "0.5rem", marginTop: "2px" }}>USED</div>
              )}
              {isTakenByOther && (
                <div style={{ fontSize: "0.5rem", marginTop: "2px" }}>TAKEN</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

function formatEventDetails(event: GameEvent): string {
  switch (event.type) {
    case PLAYER_MOVED:
      return `(${event.from.q},${event.from.r}) → (${event.to.q},${event.to.r})`;
    case CARD_PLAYED:
      return `${event.cardId}${event.powered ? " [powered]" : ""}${event.sideways ? " [sideways]" : ""} - ${event.effect}`;
    case INVALID_ACTION:
      return `${event.actionType}: ${event.reason}`;
    case TACTIC_SELECTED:
      return `${event.tacticId} (turn order: ${event.turnOrder})`;
    case TURN_ENDED:
      return `discarded ${event.cardsDiscarded}, drew ${event.cardsDrawn}`;
    case FAME_GAINED:
      return `+${event.amount} (now ${event.newTotal}) - ${event.source}`;
    case COMBAT_STARTED:
      return event.enemies.map(e => `${e.name} (${e.attack}/${e.armor})`).join(", ");
    case ENEMY_DEFEATED:
      return `${event.enemyName} (+${event.fameGained} fame)`;
    case WOUND_RECEIVED:
      return `from ${event.source}`;
    case LEVEL_UP:
      return `${event.oldLevel} → ${event.newLevel}`;
    case TILE_EXPLORED:
      return `${event.tileId} at (${event.position.q},${event.position.r})`;
    case UNDO_CHECKPOINT_SET:
      return event.reason;
    default:
      return "";
  }
}

const SAVE_SLOT_COUNT = 3;
const SAVE_KEY_PREFIX = "mageKnight_save_";
const SAVE_META_KEY = "mageKnight_saveMeta";

interface SaveSlotMeta {
  timestamp: number;
  round: number;
  timeOfDay: string;
}

function SaveLoadControls() {
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

function EventLog() {
  const { events } = useGame();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="panel">
      <h3 className="panel__title">Recent Events ({events.length})</h3>
      <div ref={scrollRef} className="debug-state" style={{ maxHeight: "200px" }}>
        {events.length === 0 ? (
          <div style={{ color: "#666" }}>No events yet</div>
        ) : (
          events.map((event, i) => {
            const details = formatEventDetails(event);
            return (
              <div key={i} style={{ marginBottom: "0.5rem", fontSize: "0.7rem" }}>
                <div style={{ fontWeight: 600, color: event.type === INVALID_ACTION ? "#e74c3c" : "#3498db" }}>
                  {event.type}
                </div>
                {details && (
                  <div style={{ color: "#999", paddingLeft: "0.5rem" }}>
                    {details}
                  </div>
                )}
                <pre style={{ color: "#666", paddingLeft: "0.5rem", margin: "0.25rem 0", fontSize: "0.65rem", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {JSON.stringify(event, null, 2)}
                </pre>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function GameView() {
  const { state } = useGame();
  const player = useMyPlayer();

  if (!state) {
    return <div className="loading">Loading game state...</div>;
  }

  // Show combat overlay when in combat
  const inCombat = state.combat && state.validActions.combat;

  return (
    <div className="app">
      {/* Overlays */}
      <TacticSelection />
      <ChoiceSelection />
      {inCombat && (
        <CombatOverlay
          combat={state.combat}
          combatOptions={state.validActions.combat}
        />
      )}

      <header className="app__header">
        <h1 className="app__title">Mage Knight</h1>
        <SaveLoadControls />
        <div>
          Round {state.round} | {state.timeOfDay} |{" "}
          {player?.selectedTacticId
            ? `Tactic: ${player.selectedTacticId}`
            : "Select Tactic"}
        </div>
      </header>

      <main className="app__main">
        <div className="app__board">
          <HexGrid />
        </div>

        <aside className="app__sidebar">
          <ResourcePanel />
          <CrystalsPanel />
          <ManaSourcePanel />
          <UnitOfferPanel />
          <OwnedUnitsPanel />
          <EventLog />
        </aside>
      </main>

      <PlayerHand />
      <ActionBar />
    </div>
  );
}

export function App() {
  return (
    <GameProvider seed={GAME_SEED}>
      <GameView />
    </GameProvider>
  );
}
