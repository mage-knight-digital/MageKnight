import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  narrateEvent,
  type ActivityMessage,
  type NarrationPlayer,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import "./ActivityFeed.css";

const MAX_MESSAGES = 50;

export function ActivityFeed() {
  const { state, events } = useGame();
  const [collapsed, setCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Build players list for narration from state
  const players: NarrationPlayer[] = useMemo(() => {
    if (!state) return [];
    return state.players.map((p) => ({ id: p.id, heroId: p.heroId }));
  }, [state]);

  // Derive messages from events — pure computation, no effect needed
  const messages: ActivityMessage[] = useMemo(() => {
    if (events.length === 0 || players.length === 0) return [];
    const result: ActivityMessage[] = [];
    for (const event of events) {
      const msg = narrateEvent(event, players);
      if (msg) result.push(msg);
    }
    return result.slice(-MAX_MESSAGES);
  }, [events, players]);

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Keyboard shortcut: L to toggle
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
    collapsed && "activity-feed--collapsed",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={feedClass}>
      <button className="activity-feed__toggle" onClick={toggle}>
        Log [L]
      </button>
      <div className="activity-feed__messages">
        {messages.length === 0 ? (
          <div className="activity-feed__empty">No events yet</div>
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
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
