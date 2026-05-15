import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  narrateEvent,
  narrateRustEvent,
  isRustEvent,
  type RustEvent,
  type ActivityMessage,
  type NarrationPlayer,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import "./ActivityFeed.css";

const MAX_MESSAGES = 50;

const CHRONICLE_PANEL_ID = "activity-feed-chronicle" as const;
const CHRONICLE_TOGGLE_LABEL = "Chronicle" as const;
const CHRONICLE_EMPTY = "Nothing to report yet." as const;

export function ActivityFeed() {
  const { state, events } = useGame();
  const [collapsed, setCollapsed] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const inCombat = state?.combat != null;

  const players: NarrationPlayer[] = useMemo(() => {
    if (!state) return [];
    return state.players.map((p) => ({ id: p.id, hero: p.hero }));
  }, [state]);

  const messages: ActivityMessage[] = useMemo(() => {
    if (events.length === 0 || players.length === 0) return [];
    const result: ActivityMessage[] = [];
    for (const event of events) {
      const msg = isRustEvent(event)
        ? narrateRustEvent(event as RustEvent, players)
        : narrateEvent(event, players);
      if (msg) result.push(msg);
    }
    return result.slice(-MAX_MESSAGES);
  }, [events, players]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === "l" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        setCollapsed((c) => !c);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  const feedClass = [
    "activity-feed",
    inCombat && "activity-feed--combat",
    collapsed && "activity-feed--collapsed",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={feedClass} aria-label="Game chronicle">
      <button
        type="button"
        className="activity-feed__toggle"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-controls={CHRONICLE_PANEL_ID}
        title="Toggle chronicle (keyboard L)"
      >
        <span className="activity-feed__toggle-label">{CHRONICLE_TOGGLE_LABEL}</span>
        <kbd className="activity-feed__toggle-kbd" aria-hidden="true">
          L
        </kbd>
      </button>
      <div
        id={CHRONICLE_PANEL_ID}
        className="activity-feed__messages"
        ref={messagesContainerRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 ? (
          <div className="activity-feed__empty">{CHRONICLE_EMPTY}</div>
        ) : (
          messages.map((msg, i) => {
            const classes = [
              "activity-feed__msg",
              msg.isTurnBoundary && "activity-feed__msg--boundary",
              `activity-feed__msg--${msg.category}`,
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div key={i} className={classes}>
                {msg.text}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
