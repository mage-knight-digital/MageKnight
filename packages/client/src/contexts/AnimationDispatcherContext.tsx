/**
 * Animation Event Dispatcher
 *
 * Coordinates animation sequences by allowing components to:
 * - Emit events when their animations complete
 * - Listen for events to trigger their own animations
 *
 * This replaces setTimeout-based timing with actual animation completion signals,
 * making the system resilient to CSS timing changes.
 *
 * Event flow for intro sequence:
 *   intro-start → tiles-complete → enemies-complete → hero-complete → tactics-complete → intro-complete
 */

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";

/**
 * Animation events that can be emitted/listened to.
 * Add new events here as new animation sequences are added.
 */
export type AnimationEvent =
  | "intro-start"        // Intro sequence begins (triggers tile animations)
  | "tiles-complete"     // All tile animations finished
  | "hero-complete"      // Hero reveal animation finished
  | "enemies-complete"   // All enemy animations finished
  | "tactics-complete"   // Tactic dealing animation finished
  | "ui-settle-start"    // UI elements begin animating in (mana, deck, seal)
  | "intro-complete";    // Entire intro sequence finished

type EventCallback = () => void;

interface AnimationDispatcherContextValue {
  /**
   * Emit an animation event to all listeners.
   * Logs the event for debugging.
   */
  emit: (event: AnimationEvent) => void;

  /**
   * Subscribe to an animation event.
   * Returns an unsubscribe function.
   */
  on: (event: AnimationEvent, callback: EventCallback) => () => void;

  /**
   * Check if an event has been emitted (useful for components that mount late).
   */
  hasEmitted: (event: AnimationEvent) => boolean;

  /**
   * Reset the dispatcher state (e.g., for new game).
   */
  reset: () => void;
}

const AnimationDispatcherContext =
  createContext<AnimationDispatcherContextValue | null>(null);

export function AnimationDispatcherProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Map of event -> Set of callbacks
  const listenersRef = useRef<Map<AnimationEvent, Set<EventCallback>>>(
    new Map()
  );

  // Track which events have been emitted (for late-mounting components)
  const emittedEventsRef = useRef<Set<AnimationEvent>>(new Set());

  const emit = useCallback((event: AnimationEvent) => {
    // Log for debugging
    console.log(`[AnimationDispatcher] 🎬 ${event}`);

    // Mark as emitted
    emittedEventsRef.current.add(event);

    // Notify all listeners
    const callbacks = listenersRef.current.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb();
        } catch (err) {
          console.error(
            `[AnimationDispatcher] Error in callback for ${event}:`,
            err
          );
        }
      });
    }
  }, []);

  const on = useCallback(
    (event: AnimationEvent, callback: EventCallback): (() => void) => {
      // Get or create the Set for this event
      let callbacks = listenersRef.current.get(event);
      if (!callbacks) {
        callbacks = new Set();
        listenersRef.current.set(event, callbacks);
      }
      callbacks.add(callback);

      // Return unsubscribe function
      return () => {
        callbacks.delete(callback);
      };
    },
    []
  );

  const hasEmitted = useCallback((event: AnimationEvent): boolean => {
    return emittedEventsRef.current.has(event);
  }, []);

  const reset = useCallback(() => {
    console.log("[AnimationDispatcher] 🔄 Reset");
    emittedEventsRef.current.clear();
  }, []);

  const value: AnimationDispatcherContextValue = {
    emit,
    on,
    hasEmitted,
    reset,
  };

  return (
    <AnimationDispatcherContext.Provider value={value}>
      {children}
    </AnimationDispatcherContext.Provider>
  );
}

/**
 * Hook to access the animation dispatcher.
 */
export function useAnimationDispatcher(): AnimationDispatcherContextValue {
  const context = useContext(AnimationDispatcherContext);
  if (!context) {
    throw new Error(
      "useAnimationDispatcher must be used within an AnimationDispatcherProvider"
    );
  }
  return context;
}

/**
 * Hook that triggers a callback when a specific animation event is emitted.
 * Also triggers immediately if the event was already emitted (for late-mounting components).
 */
export function useOnAnimationEvent(
  event: AnimationEvent,
  callback: EventCallback
): void {
  const { on, hasEmitted } = useAnimationDispatcher();

  useEffect(() => {
    // If event already happened, trigger immediately
    if (hasEmitted(event)) {
      callback();
      return;
    }

    // Otherwise, subscribe to future event
    const unsubscribe = on(event, callback);
    return unsubscribe;
  }, [event, callback, on, hasEmitted]);
}
