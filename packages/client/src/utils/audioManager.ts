/**
 * Audio manager for game sound effects.
 * Lazy-loads sounds on first use and provides simple playback controls.
 * Supports dynamic sound assignment via debug panel.
 */

export type SoundEvent = "cardHover" | "cardDeal" | "cardPlay";

// All available sound files (for debug panel)
export const AVAILABLE_SOUNDS = [
  { id: "card_hover", label: "Card Slide 1", src: "/assets/audio/sounds/card_hover.wav" },
  { id: "card_slide_2", label: "Card Slide 2", src: "/assets/audio/sounds/card_slide_2.wav" },
  { id: "card_playing_0", label: "Card Playing 0", src: "/assets/audio/sounds/card_playing_0.wav" },
  { id: "card_playing_1", label: "Card Playing 1", src: "/assets/audio/sounds/card_playing_1.wav" },
  { id: "card_playing_2", label: "Card Playing 2", src: "/assets/audio/sounds/card_playing_2.wav" },
  { id: "card_playing_3", label: "Card Playing 3", src: "/assets/audio/sounds/card_playing_3.wav" },
  { id: "card_playing_4", label: "Card Playing 4", src: "/assets/audio/sounds/card_playing_4.wav" },
  { id: "card_deal_1", label: "Card Deal 1", src: "/assets/audio/sounds/card_deal_1.wav" },
  { id: "card_deal_2", label: "Card Deal 2", src: "/assets/audio/sounds/card_deal_2.wav" },
  { id: "card_deal_3", label: "Card Deal 3", src: "/assets/audio/sounds/card_deal_3.wav" },
  { id: "card_deal_4", label: "Card Deal 4", src: "/assets/audio/sounds/card_deal_4.wav" },
  { id: "card_deal_5", label: "Card Deal 5", src: "/assets/audio/sounds/card_deal_5.wav" },
  { id: "card_play", label: "Card Slap 1", src: "/assets/audio/sounds/card_play.wav" },
  { id: "card_slap_2", label: "Card Slap 2", src: "/assets/audio/sounds/card_slap_2.wav" },
] as const;

export type SoundId = typeof AVAILABLE_SOUNDS[number]["id"];

interface SoundAssignment {
  soundIds: SoundId[];  // Array for random variation
  volume: number;
}

// Default sound assignments (can be changed via debug panel)
// Note: volumes are lower since there's no ambient music to blend with
const defaultAssignments: Record<SoundEvent, SoundAssignment> = {
  cardHover: {
    soundIds: ["card_hover", "card_slide_2"],
    volume: 0.15,
  },
  cardDeal: {
    soundIds: ["card_deal_1", "card_deal_2", "card_deal_3"],
    volume: 0.4,
  },
  cardPlay: {
    soundIds: ["card_play"],
    volume: 0.5,
  },
};

// Current assignments (mutable, changed via setSoundAssignment)
const currentAssignments: Record<SoundEvent, SoundAssignment> = { ...defaultAssignments };

// Cache for loaded audio elements
const audioCache = new Map<string, HTMLAudioElement>();

// Master volume (0-1)
let masterVolume = 1.0;

// Mute state
let isMuted = false;

/**
 * Get the src path for a sound ID
 */
function getSoundSrc(soundId: SoundId): string | undefined {
  return AVAILABLE_SOUNDS.find(s => s.id === soundId)?.src;
}

/**
 * Get or create an audio element for a given source
 */
function getAudio(src: string): HTMLAudioElement {
  let audio = audioCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    audioCache.set(src, audio);
  }
  return audio;
}

/**
 * Play a sound effect by event name
 */
export function playSound(event: SoundEvent): void {
  if (isMuted) return;

  const assignment = currentAssignments[event];
  if (!assignment || assignment.soundIds.length === 0) return;

  // Pick a random sound from the assigned sounds
  const randomIndex = Math.floor(Math.random() * assignment.soundIds.length);
  const soundId = assignment.soundIds[randomIndex];
  if (!soundId) return;

  const src = getSoundSrc(soundId);
  if (!src) return;

  const audio = getAudio(src);
  audio.volume = assignment.volume * masterVolume;
  audio.currentTime = 0; // Allow rapid replay
  audio.play().catch(() => {
    // Ignore play errors (e.g., user hasn't interacted with page yet)
  });
}

/**
 * Play a specific sound by ID (for preview in debug panel)
 */
export function playSoundById(soundId: SoundId, volume: number = 0.5): void {
  if (isMuted) return;

  const src = getSoundSrc(soundId);
  if (!src) return;

  const audio = getAudio(src);
  audio.volume = volume * masterVolume;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

/**
 * Get current sound assignment for an event
 */
export function getSoundAssignment(event: SoundEvent): SoundAssignment {
  return { ...currentAssignments[event] };
}

/**
 * Set sound assignment for an event
 */
export function setSoundAssignment(event: SoundEvent, soundIds: SoundId[], volume?: number): void {
  currentAssignments[event] = {
    soundIds,
    volume: volume ?? currentAssignments[event].volume,
  };
}

/**
 * Set volume for an event
 */
export function setSoundVolume(event: SoundEvent, volume: number): void {
  currentAssignments[event].volume = Math.max(0, Math.min(1, volume));
}

/**
 * Reset an event to default sounds
 */
export function resetSoundAssignment(event: SoundEvent): void {
  currentAssignments[event] = { ...defaultAssignments[event] };
}

/**
 * Reset all events to defaults
 */
export function resetAllSoundAssignments(): void {
  for (const event of Object.keys(defaultAssignments) as SoundEvent[]) {
    currentAssignments[event] = { ...defaultAssignments[event] };
  }
}

/**
 * Set master volume (0-1)
 */
export function setMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
}

/**
 * Get current master volume
 */
export function getMasterVolume(): number {
  return masterVolume;
}

/**
 * Toggle mute state
 */
export function toggleMute(): boolean {
  isMuted = !isMuted;
  return isMuted;
}

/**
 * Set mute state directly
 */
export function setMuted(muted: boolean): void {
  isMuted = muted;
}

/**
 * Check if audio is muted
 */
export function getIsMuted(): boolean {
  return isMuted;
}

/**
 * Preload all sounds (call early to avoid delay on first play)
 */
export function preloadSounds(): void {
  for (const sound of AVAILABLE_SOUNDS) {
    getAudio(sound.src);
  }
}

/**
 * Get all sound events (for debug panel)
 */
export function getSoundEvents(): SoundEvent[] {
  return Object.keys(defaultAssignments) as SoundEvent[];
}
