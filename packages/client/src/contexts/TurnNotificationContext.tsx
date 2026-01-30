/**
 * Turn Notification Context
 *
 * Provides turn change notifications by listening to game events.
 * Displays toast-style notifications when:
 * - A turn starts (e.g., "Your turn" or "Player 2's turn")
 * - A round ends
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useGame } from "../hooks/useGame";
import { TURN_ENDED } from "@mage-knight/shared";
import "./TurnNotificationToast.css";

/** Duration in ms before toast auto-dismisses */
const TOAST_DURATION = 3000;

interface TurnNotification {
  /** Unique ID for the notification */
  id: number;
  /** Message to display */
  message: string;
  /** Type affects styling */
  type: "turn-change" | "round-end";
}

interface TurnNotificationContextValue {
  /** Current notification (if any) */
  notification: TurnNotification | null;
  /** Manually dismiss the notification */
  dismiss: () => void;
}

const TurnNotificationContext =
  createContext<TurnNotificationContextValue | null>(null);

let notificationId = 0;

/**
 * Capitalize the first letter of a string for display.
 * Converts "arythea" to "Arythea"
 */
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function TurnNotificationProvider({ children }: { children: ReactNode }) {
  const { state, events, myPlayerId } = useGame();
  const [notification, setNotification] = useState<TurnNotification | null>(
    null
  );
  const lastProcessedEventCount = useRef(0);
  const dismissTimeoutRef = useRef<number | null>(null);

  // Dismiss the notification
  const dismiss = useCallback(() => {
    setNotification(null);
    if (dismissTimeoutRef.current !== null) {
      clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }
  }, []);

  // Process new events to show turn notifications
  useEffect(() => {
    if (!state || events.length === lastProcessedEventCount.current) {
      return;
    }

    // Get only new events since last check
    const newEvents = events.slice(lastProcessedEventCount.current);
    lastProcessedEventCount.current = events.length;

    // Look for TURN_ENDED events (which indicate a turn change)
    for (const event of newEvents) {
      if (event.type === TURN_ENDED && event.nextPlayerId) {
        const isMyTurn = event.nextPlayerId === myPlayerId;

        // Find the next player's hero
        const nextPlayer = state.players.find(
          (p) => p.id === event.nextPlayerId
        );
        // Use capitalized heroId for display (e.g., "arythea" -> "Arythea")
        const heroName = nextPlayer?.heroId
          ? capitalize(nextPlayer.heroId)
          : event.nextPlayerId;

        const message = isMyTurn ? "Your turn" : `${heroName}'s turn`;

        // Clear any existing timeout
        if (dismissTimeoutRef.current !== null) {
          clearTimeout(dismissTimeoutRef.current);
        }

        // Set new notification
        const newNotification: TurnNotification = {
          id: ++notificationId,
          message,
          type: "turn-change",
        };
        setNotification(newNotification);

        // Auto-dismiss after duration
        dismissTimeoutRef.current = window.setTimeout(() => {
          setNotification((current) =>
            current?.id === newNotification.id ? null : current
          );
          dismissTimeoutRef.current = null;
        }, TOAST_DURATION);

        break; // Only show one notification per batch
      }
    }
  }, [events, state, myPlayerId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current !== null) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      notification,
      dismiss,
    }),
    [notification, dismiss]
  );

  return (
    <TurnNotificationContext.Provider value={value}>
      {children}
      {/* Render the toast directly in the provider */}
      <TurnNotificationToast />
    </TurnNotificationContext.Provider>
  );
}

export function useTurnNotification(): TurnNotificationContextValue {
  const context = useContext(TurnNotificationContext);
  if (!context) {
    throw new Error(
      "useTurnNotification must be used within a TurnNotificationProvider"
    );
  }
  return context;
}

/**
 * Toast component for displaying turn notifications
 */
function TurnNotificationToast() {
  const { notification, dismiss } = useTurnNotification();

  if (!notification) {
    return null;
  }

  return (
    <div
      className={`turn-notification-toast turn-notification-toast--${notification.type}`}
      onClick={dismiss}
      data-testid="turn-notification-toast"
    >
      <span className="turn-notification-toast__message">
        {notification.message}
      </span>
    </div>
  );
}
