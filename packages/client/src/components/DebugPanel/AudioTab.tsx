/**
 * AudioTab - Debug controls for sound effects and ambient music
 *
 * Provides controls for:
 * - Master volume and mute
 * - Sound effect previews and event assignments
 * - Ambient music layers (music, nature)
 * - Track previews and ratings
 */

import { useState, useEffect } from "react";
import {
  AVAILABLE_SOUNDS,
  getSoundEvents,
  getSoundAssignment,
  setSoundAssignment,
  setSoundVolume,
  playSoundById,
  playSound,
  getIsMuted,
  toggleMute,
  getMasterVolume,
  setMasterVolume,
  type SoundId,
} from "../../utils/audioManager";
import {
  AMBIENT_TRACKS,
  getCategories,
  isCategoryEnabled,
  setCategoryEnabled,
  isAmbientPlaying,
  isAmbientMuted,
  startAmbientMusic,
  stopAmbientMusic,
  toggleAmbientMute,
  previewTrack,
  onStateChange,
  getTrackRating,
  setTrackRating,
  clearAllRatings,
  isLayerPlaying,
  getLayerCurrentTrackId,
  getLayerVolume,
  setLayerVolume,
  skipLayerTrack,
  toggleLayer,
  getMusicCategories,
  type LayerType,
} from "../../utils/ambientMusicManager";
import { SOUND_EVENT_LABELS, CATEGORY_LABELS, LAYER_LABELS } from "./debugPanelData";

export function AudioTab() {
  // Use a counter to force re-render when audio state changes
  const [, setUpdateCounter] = useState(0);
  const forceUpdate = () => setUpdateCounter(c => c + 1);

  // Subscribe to ambient music state changes
  useEffect(() => {
    return onStateChange(forceUpdate);
  }, []);

  return (
    <>
      {/* Sound Effects Section */}
      <section className="debug-panel__section">
        <h4>Sound Effects</h4>

        {/* Master controls */}
        <div className="debug-panel__row debug-panel__sound-master">
          <button
            type="button"
            onClick={() => { toggleMute(); forceUpdate(); }}
            className={getIsMuted() ? "debug-panel__mute-btn--muted" : ""}
          >
            {getIsMuted() ? "Unmute" : "Mute"}
          </button>
          <label className="debug-panel__volume-label">
            Vol:
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(getMasterVolume() * 100)}
              onChange={(e) => { setMasterVolume(Number(e.target.value) / 100); forceUpdate(); }}
              className="debug-panel__volume-slider"
            />
            <span>{Math.round(getMasterVolume() * 100)}%</span>
          </label>
        </div>

        {/* Available sounds preview */}
        <div className="debug-panel__subsection">
          <h5>Preview Sounds</h5>
          <div className="debug-panel__sound-grid">
            {AVAILABLE_SOUNDS.map((sound) => (
              <button
                key={sound.id}
                type="button"
                onClick={() => playSoundById(sound.id)}
                className="debug-panel__sound-preview-btn"
                title={sound.src}
              >
                {sound.label}
              </button>
            ))}
          </div>
        </div>

        {/* Event assignments */}
        <div className="debug-panel__subsection">
          <h5>Event Assignments</h5>
          {getSoundEvents().map((event) => {
            const assignment = getSoundAssignment(event);
            return (
              <div key={event} className="debug-panel__sound-event">
                <div className="debug-panel__sound-event-header">
                  <span className="debug-panel__sound-event-name">
                    {SOUND_EVENT_LABELS[event]}
                  </span>
                  <button
                    type="button"
                    onClick={() => playSound(event)}
                    className="debug-panel__sound-test-btn"
                    title="Test this event"
                  >
                    Test
                  </button>
                </div>
                <div className="debug-panel__sound-event-controls">
                  <select
                    multiple
                    value={assignment.soundIds}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, opt => opt.value as SoundId);
                      setSoundAssignment(event, selected);
                      forceUpdate();
                    }}
                    className="debug-panel__sound-select"
                  >
                    {AVAILABLE_SOUNDS.map((sound) => (
                      <option key={sound.id} value={sound.id}>
                        {sound.label}
                      </option>
                    ))}
                  </select>
                  <label className="debug-panel__volume-label debug-panel__volume-label--small">
                    Vol:
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(assignment.volume * 100)}
                      onChange={(e) => {
                        setSoundVolume(event, Number(e.target.value) / 100);
                        forceUpdate();
                      }}
                      className="debug-panel__volume-slider"
                    />
                    <span>{Math.round(assignment.volume * 100)}%</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ambient Music Section */}
      <section className="debug-panel__section">
        <h4>Ambient Music</h4>

        {/* Master controls */}
        <div className="debug-panel__row debug-panel__ambient-controls">
          <button
            type="button"
            onClick={() => {
              if (isAmbientPlaying()) {
                stopAmbientMusic();
              } else {
                startAmbientMusic();
              }
            }}
            className={isAmbientPlaying() ? "debug-panel__playing" : ""}
          >
            {isAmbientPlaying() ? "Stop All" : "Play All"}
          </button>
          <button
            type="button"
            onClick={toggleAmbientMute}
            className={isAmbientMuted() ? "debug-panel__mute-btn--muted" : ""}
          >
            {isAmbientMuted() ? "Unmute" : "Mute"}
          </button>
        </div>

        {/* Layer controls */}
        {(["music", "nature"] as LayerType[]).map((layerType) => {
          const currentTrackId = getLayerCurrentTrackId(layerType);
          const currentTrack = currentTrackId ? AMBIENT_TRACKS.find(t => t.id === currentTrackId) : null;
          return (
            <div key={layerType} className="debug-panel__layer-section">
              <div className="debug-panel__layer-header">
                <h5>{LAYER_LABELS[layerType]} Layer</h5>
                <div className="debug-panel__layer-controls">
                  <button
                    type="button"
                    onClick={() => toggleLayer(layerType)}
                    className={isLayerPlaying(layerType) ? "debug-panel__playing" : ""}
                  >
                    {isLayerPlaying(layerType) ? "Stop" : "Play"}
                  </button>
                  <button
                    type="button"
                    onClick={() => skipLayerTrack(layerType)}
                    disabled={!isLayerPlaying(layerType)}
                    title="Skip to next track"
                  >
                    Skip
                  </button>
                </div>
              </div>
              <div className="debug-panel__row">
                <label className="debug-panel__volume-label">
                  Vol:
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(getLayerVolume(layerType) * 100)}
                    onChange={(e) => setLayerVolume(layerType, Number(e.target.value) / 100)}
                    className="debug-panel__volume-slider"
                  />
                  <span>{Math.round(getLayerVolume(layerType) * 100)}%</span>
                </label>
              </div>
              {currentTrack && (
                <div className="debug-panel__row">
                  <span className="debug-panel__current-track">
                    Now: {currentTrack.label}
                  </span>
                </div>
              )}
              {/* Category toggles for music layer only */}
              {layerType === "music" && (
                <div className="debug-panel__row">
                  {getMusicCategories().map((category) => (
                    <label key={category} className="debug-panel__checkbox-label">
                      <input
                        type="checkbox"
                        checked={isCategoryEnabled(category)}
                        onChange={(e) => setCategoryEnabled(category, e.target.checked)}
                      />
                      {CATEGORY_LABELS[category]}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Preview tracks with ratings */}
        <div className="debug-panel__subsection">
          <h5>
            Preview & Rate Tracks
            <button
              type="button"
              onClick={clearAllRatings}
              className="debug-panel__clear-ratings-btn"
              title="Clear all ratings"
            >
              Clear
            </button>
          </h5>
          <div className="debug-panel__ambient-list">
            {getCategories().map((category) => (
              <div key={category} className="debug-panel__track-category">
                <div className="debug-panel__track-category-label">{CATEGORY_LABELS[category]}</div>
                {AMBIENT_TRACKS.filter(t => t.category === category).map((track) => {
                  const rating = getTrackRating(track.id);
                  const musicTrackId = getLayerCurrentTrackId("music");
                  const natureTrackId = getLayerCurrentTrackId("nature");
                  const isCurrentlyPlaying = track.id === musicTrackId || track.id === natureTrackId;
                  return (
                    <div key={track.id} className="debug-panel__ambient-track">
                      <button
                        type="button"
                        onClick={() => previewTrack(track.id)}
                        className={`debug-panel__ambient-preview-btn ${
                          isCurrentlyPlaying ? "debug-panel__ambient-preview-btn--playing" : ""
                        } ${rating === "down" ? "debug-panel__ambient-preview-btn--disliked" : ""}`}
                        title={track.src}
                      >
                        {isCurrentlyPlaying ? "> " : ""}{track.label}
                      </button>
                      <div className="debug-panel__rating-btns">
                        <button
                          type="button"
                          onClick={() => setTrackRating(track.id, rating === "up" ? null : "up")}
                          className={`debug-panel__rating-btn ${rating === "up" ? "debug-panel__rating-btn--active-up" : ""}`}
                          title="Thumbs up"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => setTrackRating(track.id, rating === "down" ? null : "down")}
                          className={`debug-panel__rating-btn ${rating === "down" ? "debug-panel__rating-btn--active-down" : ""}`}
                          title="Thumbs down"
                        >
                          -
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
