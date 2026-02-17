import { useEffect, useCallback, type ChangeEvent } from "react";
import { useReplay } from "../../hooks/useReplay";
import { SPEED_OPTIONS } from "../../context/ReplayProvider";
import "./ReplayControls.css";

export function ReplayControls() {
  const replay = useReplay();

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!replay) return;

      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "SELECT") return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          replay.togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          replay.stepBack();
          break;
        case "ArrowRight":
          e.preventDefault();
          replay.stepForward();
          break;
        case "ArrowUp": {
          e.preventDefault();
          const currentIdx = SPEED_OPTIONS.indexOf(replay.speed as typeof SPEED_OPTIONS[number]);
          if (currentIdx < SPEED_OPTIONS.length - 1) {
            replay.setSpeed(SPEED_OPTIONS[currentIdx + 1]);
          }
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const currentIdx = SPEED_OPTIONS.indexOf(replay.speed as typeof SPEED_OPTIONS[number]);
          if (currentIdx > 0) {
            replay.setSpeed(SPEED_OPTIONS[currentIdx - 1]);
          }
          break;
        }
      }
    },
    [replay]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Set document title to artifact name for easy identification
  const artifactName = replay?.artifactName;
  useEffect(() => {
    if (artifactName) {
      document.title = `Replay: ${artifactName}`;
      return () => { document.title = "Mage Knight"; };
    }
  }, [artifactName]);

  // Self-suppress when not in replay mode
  if (!replay) return null;

  const {
    frameIndex,
    totalFrames,
    isPlaying,
    speed,
    runMetadata,
    goToFrame,
    stepBack,
    stepForward,
    togglePlay,
    setSpeed,
  } = replay;

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    goToFrame(Number(e.target.value));
  };

  const handleSpeedChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSpeed(Number(e.target.value));
  };

  return (
    <div className="replay-controls">
      <div className="replay-controls__timeline">
        <input
          type="range"
          min={0}
          max={totalFrames - 1}
          value={frameIndex}
          onChange={handleSliderChange}
          className="replay-controls__slider"
        />
      </div>
      <div className="replay-controls__bar">
        <div className="replay-controls__buttons">
          <button
            className="replay-controls__btn"
            onClick={stepBack}
            disabled={frameIndex === 0}
            title="Step back (Left arrow)"
          >
            &#9664;&#9664;
          </button>
          <button
            className="replay-controls__btn replay-controls__btn--play"
            onClick={togglePlay}
            title="Play/Pause (Space)"
          >
            {isPlaying ? "\u275A\u275A" : "\u25B6"}
          </button>
          <button
            className="replay-controls__btn"
            onClick={stepForward}
            disabled={frameIndex === totalFrames - 1}
            title="Step forward (Right arrow)"
          >
            &#9654;&#9654;
          </button>
        </div>
        <div className="replay-controls__info">
          <span className="replay-controls__frame-counter">
            {frameIndex + 1} / {totalFrames}
          </span>
          <select
            className="replay-controls__speed-select"
            value={speed}
            onChange={handleSpeedChange}
            title="Playback speed (Up/Down arrows)"
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
          <span className="replay-controls__seed" title="Seed">
            seed: {runMetadata.seed}
          </span>
          {artifactName && (
            <span className="replay-controls__artifact-name" title={artifactName}>
              {artifactName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
