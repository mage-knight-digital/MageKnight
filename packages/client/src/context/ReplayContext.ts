import { createContext } from "react";

export interface ReplayContextValue {
  /** Current frame index (0-based) */
  frameIndex: number;
  /** Total number of frames */
  totalFrames: number;
  /** Whether auto-playback is running */
  isPlaying: boolean;
  /** Playback speed multiplier */
  speed: number;
  /** Artifact run metadata (seed, outcome, steps) */
  runMetadata: {
    seed: number;
    outcome: string;
    steps: number;
    reason?: string;
  };
  /** Go to a specific frame */
  goToFrame: (index: number) => void;
  /** Step forward one frame */
  stepForward: () => void;
  /** Step backward one frame */
  stepBack: () => void;
  /** Toggle play/pause */
  togglePlay: () => void;
  /** Set playback speed */
  setSpeed: (speed: number) => void;
}

export const ReplayContext = createContext<ReplayContextValue | null>(null);
