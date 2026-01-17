/**
 * Cinematic Sequence System
 *
 * Manages "cinematic mode" - a state where:
 * - Player input is disabled
 * - UI elements fade/hide
 * - Camera moves to focus on action
 * - Scripted animation sequences play
 * - Control returns when complete
 *
 * Used for:
 * - Tile exploration reveals
 * - Combat start/end
 * - Boss/city reveals
 * - Round transitions
 *
 * Each cinematic is a sequence of steps that execute in order.
 * Steps can be parallel (multiple animations at once) or sequential.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

/**
 * A single step in a cinematic sequence.
 * Steps run in order. Each step can contain multiple parallel actions.
 */
export interface CinematicStep {
  /** Unique identifier for this step */
  id: string;
  /** Human-readable description for debugging */
  description: string;
  /** Duration in ms (0 = instant, waits for onComplete callback) */
  duration: number;
  /** Called when step starts. Optionally return a cleanup function. */
  execute: () => void;
  /** Optional: called when step should complete early (e.g., skip button) */
  skip?: () => void;
}

/**
 * A complete cinematic sequence definition.
 */
export interface CinematicSequence {
  /** Unique identifier for this sequence type */
  id: string;
  /** Human-readable name */
  name: string;
  /** Steps to execute in order */
  steps: CinematicStep[];
  /** Called when entire sequence completes */
  onComplete?: () => void;
}

/**
 * State of the currently playing cinematic.
 */
interface CinematicState {
  /** Currently playing sequence, or null if none */
  sequence: CinematicSequence | null;
  /** Index of current step */
  currentStepIndex: number;
  /** Whether cinematic is actively playing */
  isPlaying: boolean;
  /** Whether skip was requested */
  skipRequested: boolean;
}

interface CinematicContextValue {
  /** Whether a cinematic is currently playing */
  isInCinematic: boolean;
  /** Current cinematic ID (for components to check if they should animate) */
  currentCinematicId: string | null;
  /** Current step ID within the cinematic */
  currentStepId: string | null;
  /** Start playing a cinematic sequence */
  playCinematic: (sequence: CinematicSequence) => void;
  /** Signal that the current step is complete (for async steps) */
  completeStep: () => void;
  /** Request to skip the current cinematic (if skippable) */
  requestSkip: () => void;
  /** Check if cinematics are blocked (e.g., during rapid actions) */
  areCinematicsBlocked: boolean;
  /** Temporarily block cinematics (returns unblock function) */
  blockCinematics: () => () => void;
}

const CinematicContext = createContext<CinematicContextValue | null>(null);

export function CinematicProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CinematicState>({
    sequence: null,
    currentStepIndex: 0,
    isPlaying: false,
    skipRequested: false,
  });

  // Track step completion timer
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if cinematics are blocked
  const blockCountRef = useRef(0);

  // Use a ref to break the circular dependency between executeStep and advanceToNextStep
  const advanceToNextStepRef = useRef<(sequence: CinematicSequence, currentIndex: number) => void>(() => {});

  /**
   * Execute a single step
   */
  const executeStep = useCallback((sequence: CinematicSequence, stepIndex: number) => {
    const step = sequence.steps[stepIndex];
    if (!step) {
      // No more steps - complete the sequence
      setState({
        sequence: null,
        currentStepIndex: 0,
        isPlaying: false,
        skipRequested: false,
      });
      sequence.onComplete?.();
      return;
    }

    console.log(`[Cinematic] Step ${stepIndex + 1}/${sequence.steps.length}: ${step.description}`);

    // Execute the step
    step.execute();

    // If step has a duration, auto-advance after that time
    if (step.duration > 0) {
      stepTimerRef.current = setTimeout(() => {
        stepTimerRef.current = null;
        advanceToNextStepRef.current(sequence, stepIndex);
      }, step.duration);
    }
    // If duration is 0, step must call completeStep() manually
  }, []);

  /**
   * Advance to the next step in the sequence
   */
  const advanceToNextStep = useCallback((sequence: CinematicSequence, currentIndex: number) => {
    // Clean up any pending timer
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }

    const nextIndex = currentIndex + 1;

    setState(prev => ({
      ...prev,
      currentStepIndex: nextIndex,
    }));

    // Execute next step
    executeStep(sequence, nextIndex);
  }, [executeStep]);

  // Keep the ref in sync with the latest callback
  advanceToNextStepRef.current = advanceToNextStep;

  /**
   * Start playing a cinematic sequence
   */
  const playCinematic = useCallback((sequence: CinematicSequence) => {
    // Don't start if blocked
    if (blockCountRef.current > 0) {
      console.log(`[Cinematic] Blocked, skipping: ${sequence.name}`);
      sequence.onComplete?.();
      return;
    }

    // Don't interrupt existing cinematic
    if (state.isPlaying) {
      console.warn(`[Cinematic] Already playing ${state.sequence?.name}, queueing ${sequence.name}`);
      // TODO: Could implement a queue here
      return;
    }

    console.log(`[Cinematic] Starting: ${sequence.name}`);

    setState({
      sequence,
      currentStepIndex: 0,
      isPlaying: true,
      skipRequested: false,
    });

    // Start first step
    executeStep(sequence, 0);
  }, [state.isPlaying, state.sequence?.name, executeStep]);

  /**
   * Signal that the current async step is complete
   */
  const completeStep = useCallback(() => {
    if (!state.sequence || !state.isPlaying) return;
    advanceToNextStep(state.sequence, state.currentStepIndex);
  }, [state.sequence, state.isPlaying, state.currentStepIndex, advanceToNextStep]);

  /**
   * Request to skip the current cinematic
   */
  const requestSkip = useCallback(() => {
    if (!state.sequence || !state.isPlaying) return;

    setState(prev => ({ ...prev, skipRequested: true }));

    const currentStep = state.sequence.steps[state.currentStepIndex];
    if (currentStep?.skip) {
      currentStep.skip();
    }

    // Fast-forward through remaining steps
    // For now, just complete immediately
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }

    setState({
      sequence: null,
      currentStepIndex: 0,
      isPlaying: false,
      skipRequested: false,
    });

    state.sequence.onComplete?.();
  }, [state.sequence, state.isPlaying, state.currentStepIndex]);

  /**
   * Block cinematics temporarily
   */
  const blockCinematics = useCallback((): (() => void) => {
    blockCountRef.current += 1;
    return () => {
      blockCountRef.current -= 1;
    };
  }, []);

  const currentStep = state.sequence?.steps[state.currentStepIndex];

  const value: CinematicContextValue = {
    isInCinematic: state.isPlaying,
    currentCinematicId: state.sequence?.id ?? null,
    currentStepId: currentStep?.id ?? null,
    playCinematic,
    completeStep,
    requestSkip,
    areCinematicsBlocked: blockCountRef.current > 0,
    blockCinematics,
  };

  return (
    <CinematicContext.Provider value={value}>
      {children}
    </CinematicContext.Provider>
  );
}

export function useCinematic(): CinematicContextValue {
  const context = useContext(CinematicContext);
  if (!context) {
    throw new Error("useCinematic must be used within a CinematicProvider");
  }
  return context;
}

/**
 * Hook that returns whether input should be blocked.
 * Use this in components that handle user input.
 */
export function useIsInputBlocked(): boolean {
  const { isInCinematic } = useCinematic();
  return isInCinematic;
}
