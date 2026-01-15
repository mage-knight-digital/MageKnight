/**
 * Ambient music manager for background atmosphere.
 * Supports two simultaneous layers:
 * - Music layer: pads, strings, piano (crossfades between tracks)
 * - Nature layer: ambient sounds like birds, wind (crossfades between tracks)
 * Both layers can play together with independent volume controls.
 */

export interface AmbientTrack {
  id: string;
  label: string;
  category: "pad" | "strings" | "piano" | "guitar" | "mallets" | "nature";
  src: string;
}

// Available ambient tracks
export const AMBIENT_TRACKS: AmbientTrack[] = [
  // Pads - atmospheric drones
  { id: "pad_04", label: "Pad 04", category: "pad", src: "/assets/music/pad_04.wav" },
  // Strings - orchestral atmosphere
  { id: "strings_03", label: "Strings 03", category: "strings", src: "/assets/music/strings_03.wav" },
  { id: "strings_04", label: "Strings 04", category: "strings", src: "/assets/music/strings_04.wav" },
  // Piano - contemplative mood
  { id: "piano_01", label: "Piano 01", category: "piano", src: "/assets/music/piano_01.wav" },
  { id: "piano_02", label: "Piano 02", category: "piano", src: "/assets/music/piano_02.wav" },
  { id: "piano_03", label: "Piano 03", category: "piano", src: "/assets/music/piano_03.wav" },
  // Guitar - ambient guitar
  { id: "guitar_01", label: "Guitar 01", category: "guitar", src: "/assets/music/guitar_01.wav" },
  { id: "guitar_02", label: "Guitar 02", category: "guitar", src: "/assets/music/guitar_02.wav" },
  { id: "guitar_03", label: "Guitar 03", category: "guitar", src: "/assets/music/guitar_03.wav" },
  // Mallets - vibraphone/marimba atmosphere
  { id: "mallets_02", label: "Mallets 02", category: "mallets", src: "/assets/music/mallets_02.wav" },
  // Nature - countryside ambience (birds, wind, etc.)
  { id: "nature_fields_01", label: "Fields 01", category: "nature", src: "/assets/music/nature_fields_01.wav" },
  { id: "nature_fields_02", label: "Fields 02", category: "nature", src: "/assets/music/nature_fields_02.wav" },
  { id: "nature_fields_03", label: "Fields 03", category: "nature", src: "/assets/music/nature_fields_03.wav" },
  { id: "nature_fields_04", label: "Fields 04", category: "nature", src: "/assets/music/nature_fields_04.wav" },
  { id: "nature_fields_05", label: "Fields 05", category: "nature", src: "/assets/music/nature_fields_05.wav" },
  { id: "nature_fields_06", label: "Fields 06", category: "nature", src: "/assets/music/nature_fields_06.wav" },
  { id: "nature_fields_07", label: "Fields 07", category: "nature", src: "/assets/music/nature_fields_07.wav" },
  { id: "nature_fields_08", label: "Fields 08", category: "nature", src: "/assets/music/nature_fields_08.wav" },
  { id: "nature_fields_09", label: "Fields 09", category: "nature", src: "/assets/music/nature_fields_09.wav" },
  { id: "nature_fields_10", label: "Fields 10", category: "nature", src: "/assets/music/nature_fields_10.wav" },
  { id: "nature_fields_11", label: "Fields 11", category: "nature", src: "/assets/music/nature_fields_11.wav" },
  { id: "nature_morocco_01", label: "Morocco 01", category: "nature", src: "/assets/music/nature_morocco_01.wav" },
  { id: "nature_morocco_02", label: "Morocco 02", category: "nature", src: "/assets/music/nature_morocco_02.wav" },
  { id: "nature_morocco_03", label: "Morocco 03", category: "nature", src: "/assets/music/nature_morocco_03.wav" },
  { id: "nature_morocco_04", label: "Morocco 04", category: "nature", src: "/assets/music/nature_morocco_04.wav" },
  { id: "nature_morocco_05", label: "Morocco 05", category: "nature", src: "/assets/music/nature_morocco_05.wav" },
  { id: "nature_morocco_06", label: "Morocco 06", category: "nature", src: "/assets/music/nature_morocco_06.wav" },
  { id: "nature_morocco_07", label: "Morocco 07", category: "nature", src: "/assets/music/nature_morocco_07.wav" },
  { id: "nature_morocco_08", label: "Morocco 08", category: "nature", src: "/assets/music/nature_morocco_08.wav" },
  { id: "nature_morocco_09", label: "Morocco 09", category: "nature", src: "/assets/music/nature_morocco_09.wav" },
  { id: "nature_morocco_10", label: "Morocco 10", category: "nature", src: "/assets/music/nature_morocco_10.wav" },
];

export type TrackCategory = AmbientTrack["category"];
export type LayerType = "music" | "nature";

// Music categories (for music layer)
const MUSIC_CATEGORIES: TrackCategory[] = ["pad", "strings", "piano", "guitar", "mallets"];

// Configuration
const DEFAULT_MUSIC_VOLUME = 0.3;
const DEFAULT_NATURE_VOLUME = 0.4;
const CROSSFADE_DURATION_MS = 3000; // 3 second crossfade
const MIN_LOOPS_BEFORE_SWITCH = 4;
const MAX_LOOPS_BEFORE_SWITCH = 8;

// Layer state interface
interface LayerState {
  currentSource: AudioBufferSourceNode | null;
  currentGain: GainNode | null;
  nextSource: AudioBufferSourceNode | null;
  nextGain: GainNode | null;
  currentTrackId: string | null;
  isPlaying: boolean;
  volume: number;
  loopCount: number;
  loopsUntilSwitch: number;
  loopIntervalId: number | null;
  enabledCategories: Set<TrackCategory>;
}

// Global state
let audioContext: AudioContext | null = null;
let isMuted = false;

// Layer states
const musicLayer: LayerState = {
  currentSource: null,
  currentGain: null,
  nextSource: null,
  nextGain: null,
  currentTrackId: null,
  isPlaying: false,
  volume: DEFAULT_MUSIC_VOLUME,
  loopCount: 0,
  loopsUntilSwitch: 0,
  loopIntervalId: null,
  enabledCategories: new Set(["pad", "strings", "piano", "guitar", "mallets"]),
};

const natureLayer: LayerState = {
  currentSource: null,
  currentGain: null,
  nextSource: null,
  nextGain: null,
  currentTrackId: null,
  isPlaying: false,
  volume: DEFAULT_NATURE_VOLUME,
  loopCount: 0,
  loopsUntilSwitch: 0,
  loopIntervalId: null,
  enabledCategories: new Set(["nature"]),
};

// Audio buffer cache
const bufferCache = new Map<string, AudioBuffer>();

// Track ratings (persisted to localStorage)
export type TrackRating = "up" | "down" | null;
const RATINGS_STORAGE_KEY = "mageKnight_ambientTrackRatings";

function loadRatings(): Record<string, TrackRating> {
  try {
    const stored = localStorage.getItem(RATINGS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Ignore parse errors
  }
  return {};
}

function saveRatings(ratings: Record<string, TrackRating>): void {
  try {
    localStorage.setItem(RATINGS_STORAGE_KEY, JSON.stringify(ratings));
  } catch {
    // Ignore storage errors
  }
}

let trackRatings: Record<string, TrackRating> = loadRatings();

/**
 * Get the rating for a track
 */
export function getTrackRating(trackId: string): TrackRating {
  return trackRatings[trackId] ?? null;
}

/**
 * Set the rating for a track (persists to localStorage)
 */
export function setTrackRating(trackId: string, rating: TrackRating): void {
  if (rating === null) {
    const newRatings: Record<string, TrackRating> = {};
    for (const [key, value] of Object.entries(trackRatings)) {
      if (key !== trackId) {
        newRatings[key] = value;
      }
    }
    trackRatings = newRatings;
  } else {
    trackRatings[trackId] = rating;
  }
  saveRatings(trackRatings);
  notifyStateChange();
}

/**
 * Toggle rating: null -> up -> down -> null
 */
export function cycleTrackRating(trackId: string): TrackRating {
  const current = getTrackRating(trackId);
  let next: TrackRating;
  if (current === null) next = "up";
  else if (current === "up") next = "down";
  else next = null;
  setTrackRating(trackId, next);
  return next;
}

/**
 * Get all ratings
 */
export function getAllRatings(): Record<string, TrackRating> {
  return { ...trackRatings };
}

/**
 * Clear all ratings
 */
export function clearAllRatings(): void {
  trackRatings = {};
  saveRatings(trackRatings);
  notifyStateChange();
}

// Callbacks for UI updates
type StateChangeCallback = () => void;
const stateChangeCallbacks: StateChangeCallback[] = [];

export function onStateChange(callback: StateChangeCallback): () => void {
  stateChangeCallbacks.push(callback);
  return () => {
    const index = stateChangeCallbacks.indexOf(callback);
    if (index >= 0) stateChangeCallbacks.splice(index, 1);
  };
}

function notifyStateChange(): void {
  stateChangeCallbacks.forEach(cb => cb());
}

/**
 * Initialize the audio context (must be called after user interaction)
 */
function ensureContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Load an audio buffer for a track
 */
async function loadBuffer(src: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(src);
  if (cached) return cached;

  const context = ensureContext();
  const response = await fetch(src);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await context.decodeAudioData(arrayBuffer);
  bufferCache.set(src, audioBuffer);
  return audioBuffer;
}

/**
 * Get layer by type
 */
function getLayer(layerType: LayerType): LayerState {
  return layerType === "music" ? musicLayer : natureLayer;
}

/**
 * Get available tracks for a layer
 */
function getAvailableTracksForLayer(layer: LayerState): AmbientTrack[] {
  return AMBIENT_TRACKS.filter(t => layer.enabledCategories.has(t.category));
}

/**
 * Pick a random track for a layer, avoiding current
 */
function pickRandomTrackForLayer(layer: LayerState): AmbientTrack | null {
  const available = getAvailableTracksForLayer(layer);
  if (available.length === 0) return null;
  if (available.length === 1) return available[0] ?? null;

  const candidates = available.filter(t => t.id !== layer.currentTrackId);
  if (candidates.length === 0) return available[0] ?? null;

  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

/**
 * Calculate random loops until next switch
 */
function calculateLoopsUntilSwitch(): number {
  return MIN_LOOPS_BEFORE_SWITCH + Math.floor(Math.random() * (MAX_LOOPS_BEFORE_SWITCH - MIN_LOOPS_BEFORE_SWITCH + 1));
}

/**
 * Play a track on a specific layer
 */
async function playTrackOnLayer(layer: LayerState, track: AmbientTrack, fadeIn = false): Promise<void> {
  const context = ensureContext();
  const buffer = await loadBuffer(track.src);

  const source = context.createBufferSource();
  const gain = context.createGain();

  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  gain.connect(context.destination);

  const targetVolume = isMuted ? 0 : layer.volume;
  if (fadeIn) {
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(targetVolume, context.currentTime + CROSSFADE_DURATION_MS / 1000);
  } else {
    gain.gain.setValueAtTime(targetVolume, context.currentTime);
  }

  source.start();

  layer.currentSource = source;
  layer.currentGain = gain;
  layer.currentTrackId = track.id;
  layer.loopCount = 0;
  layer.loopsUntilSwitch = calculateLoopsUntilSwitch();

  setupLoopCounterForLayer(layer, buffer.duration);
  notifyStateChange();
}

/**
 * Set up loop counter for a layer
 */
function setupLoopCounterForLayer(layer: LayerState, loopDuration: number): void {
  if (layer.loopIntervalId !== null) {
    clearInterval(layer.loopIntervalId);
  }

  layer.loopIntervalId = window.setInterval(() => {
    if (!layer.isPlaying) return;

    layer.loopCount++;

    if (layer.loopCount >= layer.loopsUntilSwitch) {
      crossfadeToNextOnLayer(layer);
    }
  }, loopDuration * 1000);
}

/**
 * Crossfade to next track on a layer
 */
async function crossfadeToNextOnLayer(layer: LayerState): Promise<void> {
  const nextTrack = pickRandomTrackForLayer(layer);
  if (!nextTrack || !audioContext || !layer.currentGain) return;

  const context = audioContext;
  const buffer = await loadBuffer(nextTrack.src);

  const source = context.createBufferSource();
  const gain = context.createGain();

  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  gain.connect(context.destination);

  const targetVolume = isMuted ? 0 : layer.volume;
  gain.gain.setValueAtTime(0, context.currentTime);
  gain.gain.linearRampToValueAtTime(targetVolume, context.currentTime + CROSSFADE_DURATION_MS / 1000);

  layer.currentGain.gain.linearRampToValueAtTime(0, context.currentTime + CROSSFADE_DURATION_MS / 1000);

  source.start();

  layer.nextSource = source;
  layer.nextGain = gain;

  setTimeout(() => {
    if (layer.currentSource) {
      layer.currentSource.stop();
      layer.currentSource.disconnect();
    }

    layer.currentSource = layer.nextSource;
    layer.currentGain = layer.nextGain;
    layer.currentTrackId = nextTrack.id;
    layer.nextSource = null;
    layer.nextGain = null;
    layer.loopCount = 0;
    layer.loopsUntilSwitch = calculateLoopsUntilSwitch();

    setupLoopCounterForLayer(layer, buffer.duration);
    notifyStateChange();
  }, CROSSFADE_DURATION_MS);
}

/**
 * Start a specific layer
 */
async function startLayer(layerType: LayerType): Promise<void> {
  const layer = getLayer(layerType);
  if (layer.isPlaying) return;

  const track = pickRandomTrackForLayer(layer);
  if (!track) return;

  layer.isPlaying = true;
  await playTrackOnLayer(layer, track, true);
  notifyStateChange();
}

/**
 * Stop a specific layer
 */
function stopLayer(layerType: LayerType): void {
  const layer = getLayer(layerType);
  if (!layer.isPlaying) return;

  if (layer.loopIntervalId !== null) {
    clearInterval(layer.loopIntervalId);
    layer.loopIntervalId = null;
  }

  if (layer.currentSource) {
    if (layer.currentGain && audioContext) {
      layer.currentGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
      const source = layer.currentSource;
      setTimeout(() => {
        source.stop();
        source.disconnect();
      }, 500);
    } else {
      layer.currentSource.stop();
      layer.currentSource.disconnect();
    }
    layer.currentSource = null;
    layer.currentGain = null;
  }

  if (layer.nextSource) {
    layer.nextSource.stop();
    layer.nextSource.disconnect();
    layer.nextSource = null;
    layer.nextGain = null;
  }

  layer.isPlaying = false;
  layer.currentTrackId = null;
  notifyStateChange();
}

// ============ PUBLIC API ============

/**
 * Start music layer (pads, strings, piano)
 */
export async function startMusicLayer(): Promise<void> {
  await startLayer("music");
}

/**
 * Stop music layer
 */
export function stopMusicLayer(): void {
  stopLayer("music");
}

/**
 * Start nature layer (ambient sounds)
 */
export async function startNatureLayer(): Promise<void> {
  await startLayer("nature");
}

/**
 * Stop nature layer
 */
export function stopNatureLayer(): void {
  stopLayer("nature");
}

/**
 * Start ambient music playback (both layers if enabled)
 */
export async function startAmbientMusic(): Promise<void> {
  // Start both layers
  await Promise.all([
    startLayer("music"),
    startLayer("nature"),
  ]);
}

/**
 * Stop ambient music playback (all layers)
 */
export function stopAmbientMusic(): void {
  stopLayer("music");
  stopLayer("nature");
}

/**
 * Toggle playback of both layers
 */
export function toggleAmbientMusic(): boolean {
  const anyPlaying = musicLayer.isPlaying || natureLayer.isPlaying;
  if (anyPlaying) {
    stopAmbientMusic();
  } else {
    startAmbientMusic();
  }
  return musicLayer.isPlaying || natureLayer.isPlaying;
}

/**
 * Toggle a specific layer
 */
export function toggleLayer(layerType: LayerType): boolean {
  const layer = getLayer(layerType);
  if (layer.isPlaying) {
    stopLayer(layerType);
  } else {
    startLayer(layerType);
  }
  return layer.isPlaying;
}

/**
 * Check if a layer is playing
 */
export function isLayerPlaying(layerType: LayerType): boolean {
  return getLayer(layerType).isPlaying;
}

/**
 * Get current track ID for a layer
 */
export function getLayerCurrentTrackId(layerType: LayerType): string | null {
  return getLayer(layerType).currentTrackId;
}

/**
 * Set volume for a specific layer (0-1)
 */
export function setLayerVolume(layerType: LayerType, volume: number): void {
  const layer = getLayer(layerType);
  layer.volume = Math.max(0, Math.min(1, volume));

  if (layer.currentGain && audioContext && !isMuted) {
    layer.currentGain.gain.linearRampToValueAtTime(layer.volume, audioContext.currentTime + 0.1);
  }
  if (layer.nextGain && audioContext && !isMuted) {
    layer.nextGain.gain.linearRampToValueAtTime(layer.volume, audioContext.currentTime + 0.1);
  }

  notifyStateChange();
}

/**
 * Get volume for a specific layer
 */
export function getLayerVolume(layerType: LayerType): number {
  return getLayer(layerType).volume;
}

/**
 * Skip to next track on a layer
 */
export function skipLayerTrack(layerType: LayerType): void {
  const layer = getLayer(layerType);
  if (!layer.isPlaying) return;
  crossfadeToNextOnLayer(layer);
}

/**
 * Preview a specific track (stops all playback, plays once without loop)
 */
export async function previewTrack(trackId: string): Promise<void> {
  const track = AMBIENT_TRACKS.find(t => t.id === trackId);
  if (!track) return;

  // Stop all playback
  stopAmbientMusic();

  const context = ensureContext();
  const buffer = await loadBuffer(track.src);

  const source = context.createBufferSource();
  const gain = context.createGain();

  source.buffer = buffer;
  source.loop = false;
  source.connect(gain);
  gain.connect(context.destination);

  // Use layer volume based on track category
  const layerType: LayerType = track.category === "nature" ? "nature" : "music";
  const volume = getLayer(layerType).volume;
  gain.gain.setValueAtTime(isMuted ? 0 : volume, context.currentTime);

  source.start();

  // Store in music layer for cleanup (preview uses music layer state)
  musicLayer.currentSource = source;
  musicLayer.currentGain = gain;
  musicLayer.currentTrackId = trackId;
  musicLayer.isPlaying = true;

  source.addEventListener("ended", () => {
    musicLayer.currentSource = null;
    musicLayer.currentGain = null;
    musicLayer.currentTrackId = null;
    musicLayer.isPlaying = false;
    notifyStateChange();
  });

  notifyStateChange();
}

/**
 * Toggle mute for all layers
 */
export function toggleAmbientMute(): boolean {
  isMuted = !isMuted;

  const updateGain = (layer: LayerState) => {
    const targetVolume = isMuted ? 0 : layer.volume;
    if (layer.currentGain && audioContext) {
      layer.currentGain.gain.linearRampToValueAtTime(targetVolume, audioContext.currentTime + 0.1);
    }
    if (layer.nextGain && audioContext) {
      layer.nextGain.gain.linearRampToValueAtTime(targetVolume, audioContext.currentTime + 0.1);
    }
  };

  updateGain(musicLayer);
  updateGain(natureLayer);

  notifyStateChange();
  return isMuted;
}

/**
 * Check if muted
 */
export function isAmbientMuted(): boolean {
  return isMuted;
}

/**
 * Check if any layer is playing
 */
export function isAmbientPlaying(): boolean {
  return musicLayer.isPlaying || natureLayer.isPlaying;
}

/**
 * Get current track ID (returns music layer track for backwards compatibility)
 */
export function getCurrentTrackId(): string | null {
  return musicLayer.currentTrackId;
}

/**
 * Enable/disable a category for appropriate layer
 */
export function setCategoryEnabled(category: TrackCategory, enabled: boolean): void {
  // Determine which layer this category belongs to
  const layer = MUSIC_CATEGORIES.includes(category) ? musicLayer : natureLayer;

  if (enabled) {
    layer.enabledCategories.add(category);
  } else {
    layer.enabledCategories.delete(category);
  }
  notifyStateChange();
}

/**
 * Check if a category is enabled
 */
export function isCategoryEnabled(category: TrackCategory): boolean {
  const layer = MUSIC_CATEGORIES.includes(category) ? musicLayer : natureLayer;
  return layer.enabledCategories.has(category);
}

/**
 * Get all categories
 */
export function getCategories(): TrackCategory[] {
  return ["pad", "strings", "piano", "guitar", "mallets", "nature"];
}

/**
 * Get music categories only
 */
export function getMusicCategories(): TrackCategory[] {
  return ["pad", "strings", "piano", "guitar", "mallets"];
}

/**
 * Get nature categories only
 */
export function getNatureCategories(): TrackCategory[] {
  return ["nature"];
}

// Legacy compatibility
export function setAmbientVolume(volume: number): void {
  setLayerVolume("music", volume);
}

export function getAmbientVolume(): number {
  return getLayerVolume("music");
}

export function skipToNextTrack(): void {
  skipLayerTrack("music");
}
