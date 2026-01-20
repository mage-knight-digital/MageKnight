/**
 * EventLogTab - Debug view of all actions and server responses
 *
 * Shows a chronological log of:
 * - Actions sent to the server (blue)
 * - Events received from the server (green)
 *
 * Useful for debugging issues where the UI doesn't respond as expected.
 */

import { useRef, useEffect, useState } from "react";
import { useGame } from "../../hooks/useGame";
import type { ActionLogEntry } from "../../context/GameContext";
import type { PlayerAction, GameEvent } from "@mage-knight/shared";

export function EventLogTab() {
  const { actionLog, clearActionLog, isActionLogEnabled, setActionLogEnabled } = useGame();
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [actionLog, autoScroll]);

  const toggleEntry = (id: number) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedEntries(new Set(actionLog.map((e) => e.id)));
  };

  const collapseAll = () => {
    setExpandedEntries(new Set());
  };

  const copyLogToClipboard = () => {
    const logText = actionLog
      .map((entry) => {
        const time = entry.timestamp.toLocaleTimeString();
        const type = entry.type.toUpperCase();
        const data = JSON.stringify(entry.data, null, 2);
        return `[${time}] ${type}:\n${data}`;
      })
      .join("\n\n");
    navigator.clipboard.writeText(logText);
  };

  const formatActionSummary = (action: PlayerAction): string => {
    const type = action.type;
    // Extract key info based on action type
    if ("cardId" in action) {
      return `${type} (${action.cardId})`;
    }
    if ("targetHex" in action) {
      const hex = action.targetHex as { q: number; r: number };
      return `${type} (${hex.q},${hex.r})`;
    }
    return type;
  };

  const formatEventsSummary = (events: readonly GameEvent[]): string => {
    if (events.length === 0) return "No events";
    if (events.length === 1) {
      const event = events[0];
      return event ? event.type : "Unknown event";
    }
    // Show first event type and count
    const first = events[0];
    return `${first?.type || "Unknown"} +${events.length - 1} more`;
  };

  const renderEntry = (entry: ActionLogEntry) => {
    const isExpanded = expandedEntries.has(entry.id);
    const time = entry.timestamp.toLocaleTimeString();
    const isAction = entry.type === "action";

    const summary = isAction
      ? formatActionSummary(entry.data as PlayerAction)
      : formatEventsSummary(entry.data as readonly GameEvent[]);

    return (
      <div
        key={entry.id}
        className={`event-log-entry event-log-entry--${entry.type}`}
      >
        <div
          className="event-log-entry__header"
          onClick={() => toggleEntry(entry.id)}
          style={{ cursor: "pointer" }}
        >
          <span className="event-log-entry__expand">
            {isExpanded ? "▼" : "▶"}
          </span>
          <span className="event-log-entry__time">{time}</span>
          <span className={`event-log-entry__type event-log-entry__type--${entry.type}`}>
            {isAction ? "ACTION" : "EVENTS"}
          </span>
          <span className="event-log-entry__summary">{summary}</span>
        </div>
        {isExpanded && (
          <pre className="event-log-entry__data">
            {JSON.stringify(entry.data, null, 2)}
          </pre>
        )}
      </div>
    );
  };

  return (
    <div className="event-log-tab">
      <div className="event-log-tab__controls">
        <label className="event-log-tab__toggle">
          <input
            type="checkbox"
            checked={isActionLogEnabled}
            onChange={(e) => setActionLogEnabled(e.target.checked)}
          />
          Logging Enabled
        </label>
        <label className="event-log-tab__toggle">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
        <button type="button" onClick={expandAll}>
          Expand All
        </button>
        <button type="button" onClick={collapseAll}>
          Collapse All
        </button>
        <button type="button" onClick={copyLogToClipboard}>
          Copy Log
        </button>
        <button type="button" onClick={clearActionLog}>
          Clear
        </button>
      </div>

      <div className="event-log-tab__stats">
        {actionLog.length} entries ({actionLog.filter((e) => e.type === "action").length} actions,{" "}
        {actionLog.filter((e) => e.type === "events").length} event batches)
      </div>

      <div className="event-log-tab__log" ref={logContainerRef}>
        {actionLog.length === 0 ? (
          <div className="event-log-tab__empty">
            No log entries yet. Perform actions to see them logged here.
          </div>
        ) : (
          actionLog.map(renderEntry)
        )}
      </div>

      <style>{`
        .event-log-tab {
          display: flex;
          flex-direction: column;
          height: 100%;
          gap: 8px;
        }

        .event-log-tab__controls {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .event-log-tab__controls button {
          padding: 4px 8px;
          font-size: 12px;
        }

        .event-log-tab__toggle {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
        }

        .event-log-tab__stats {
          font-size: 11px;
          color: #888;
        }

        .event-log-tab__log {
          flex: 1;
          overflow-y: auto;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 4px;
          padding: 8px;
          font-family: monospace;
          font-size: 11px;
          min-height: 200px;
          max-height: 400px;
        }

        .event-log-tab__empty {
          color: #666;
          text-align: center;
          padding: 20px;
        }

        .event-log-entry {
          margin-bottom: 4px;
          border-radius: 4px;
          overflow: hidden;
        }

        .event-log-entry--action {
          background: rgba(100, 150, 255, 0.1);
          border-left: 3px solid #6496ff;
        }

        .event-log-entry--events {
          background: rgba(100, 255, 150, 0.1);
          border-left: 3px solid #64ff96;
        }

        .event-log-entry__header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
        }

        .event-log-entry__header:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .event-log-entry__expand {
          width: 12px;
          color: #888;
        }

        .event-log-entry__time {
          color: #888;
          min-width: 70px;
        }

        .event-log-entry__type {
          font-weight: bold;
          min-width: 60px;
        }

        .event-log-entry__type--action {
          color: #6496ff;
        }

        .event-log-entry__type--events {
          color: #64ff96;
        }

        .event-log-entry__summary {
          color: #ccc;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .event-log-entry__data {
          margin: 0;
          padding: 8px;
          background: rgba(0, 0, 0, 0.3);
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-all;
          color: #aaa;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
