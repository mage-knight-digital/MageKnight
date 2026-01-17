/**
 * Mana Events
 *
 * Events related to mana resources: dice from the shared source, crystals,
 * and temporary mana tokens.
 *
 * @module events/mana
 *
 * @remarks Mana System Overview
 * - **Die Pool**: Shared dice (players + 2). Day: gold available, black depleted. Night: reversed.
 * - **Tokens**: Temporary mana from card effects. Returned at end of turn.
 * - **Crystals**: Permanent storage (max 3 per color). Can convert to/from tokens.
 *
 * @example Mana Flow
 * ```
 * From Source (Die Pool):
 *   MANA_DIE_TAKEN (player claims a die)
 *     └─► Die becomes token for player
 *   MANA_DIE_RETURNED (at round end)
 *     └─► Die goes back to source, gets new color
 *
 * Using Mana:
 *   MANA_DIE_USED (token from die spent)
 *   MANA_TOKEN_USED (temporary token spent)
 *   CRYSTAL_USED (crystal consumed for mana)
 *
 * Crystals:
 *   CRYSTAL_GAINED (from effects or sites)
 *   CRYSTAL_CONVERTED (token → crystal for storage)
 * ```
 */

import type { ManaColor } from "../ids.js";

// ============================================================================
// MANA_DIE_TAKEN
// ============================================================================

/**
 * Event type constant for taking a mana die.
 * @see ManaDieTakenEvent
 */
export const MANA_DIE_TAKEN = "MANA_DIE_TAKEN" as const;

/**
 * Emitted when a player takes a die from the mana source.
 *
 * The die's color becomes available as a mana token for the player.
 *
 * @remarks
 * - Die remains in source but marked as taken
 * - Player gains a token of the die's color
 * - Die returns to source at round end
 * - Triggers: Mana Draw tactic, certain card effects
 *
 * @example
 * ```typescript
 * if (event.type === MANA_DIE_TAKEN) {
 *   markDieAsTaken(event.dieId);
 *   addManaToken(event.playerId, event.color);
 * }
 * ```
 */
export interface ManaDieTakenEvent {
  readonly type: typeof MANA_DIE_TAKEN;
  /** ID of the player who took the die */
  readonly playerId: string;
  /** ID of the die taken */
  readonly dieId: string;
  /** Color of the die */
  readonly color: ManaColor;
}

/**
 * Creates a ManaDieTakenEvent.
 */
export function createManaDieTakenEvent(
  playerId: string,
  dieId: string,
  color: ManaColor
): ManaDieTakenEvent {
  return {
    type: MANA_DIE_TAKEN,
    playerId,
    dieId,
    color,
  };
}

// ============================================================================
// MANA_DIE_RETURNED
// ============================================================================

/**
 * Event type constant for returning a mana die.
 * @see ManaDieReturnedEvent
 */
export const MANA_DIE_RETURNED = "MANA_DIE_RETURNED" as const;

/**
 * Emitted when a mana die is returned to the source.
 *
 * The die is rerolled and gets a new color.
 *
 * @remarks
 * - Occurs at end of round typically
 * - newColor is the result of the reroll
 * - Die becomes available for next round
 *
 * @example
 * ```typescript
 * if (event.type === MANA_DIE_RETURNED) {
 *   returnDieToSource(event.dieId);
 *   setDieColor(event.dieId, event.newColor);
 * }
 * ```
 */
export interface ManaDieReturnedEvent {
  readonly type: typeof MANA_DIE_RETURNED;
  /** ID of the returned die */
  readonly dieId: string;
  /** New color after reroll */
  readonly newColor: ManaColor;
}

/**
 * Creates a ManaDieReturnedEvent.
 */
export function createManaDieReturnedEvent(
  dieId: string,
  newColor: ManaColor
): ManaDieReturnedEvent {
  return {
    type: MANA_DIE_RETURNED,
    dieId,
    newColor,
  };
}

// ============================================================================
// MANA_DIE_USED
// ============================================================================

/**
 * Event type constant for using mana from a die.
 * @see ManaDieUsedEvent
 */
export const MANA_DIE_USED = "MANA_DIE_USED" as const;

/**
 * Emitted when mana from a taken die is spent.
 *
 * The mana token from the die is consumed for powering a card.
 *
 * @remarks
 * - Token is consumed, die stays claimed
 * - Used to power card effects
 * - Triggers: PLAY_CARD_ACTION with powered: true
 *
 * @example
 * ```typescript
 * if (event.type === MANA_DIE_USED) {
 *   consumeManaToken(event.playerId, event.color);
 *   highlightPoweredCard();
 * }
 * ```
 */
export interface ManaDieUsedEvent {
  readonly type: typeof MANA_DIE_USED;
  /** ID of the player who used the mana */
  readonly playerId: string;
  /** ID of the die the mana came from */
  readonly dieId: string;
  /** Color of mana used */
  readonly color: ManaColor;
}

/**
 * Creates a ManaDieUsedEvent.
 */
export function createManaDieUsedEvent(
  playerId: string,
  dieId: string,
  color: ManaColor
): ManaDieUsedEvent {
  return {
    type: MANA_DIE_USED,
    playerId,
    dieId,
    color,
  };
}

// ============================================================================
// MANA_TOKEN_USED
// ============================================================================

/**
 * Event type constant for using a mana token.
 * @see ManaTokenUsedEvent
 */
export const MANA_TOKEN_USED = "MANA_TOKEN_USED" as const;

/**
 * Emitted when a temporary mana token is spent.
 *
 * Temporary tokens come from card effects (not from dice).
 *
 * @remarks
 * - Token is consumed
 * - Distinct from die-based mana
 * - Triggers: Powering cards with effect-generated mana
 *
 * @example
 * ```typescript
 * if (event.type === MANA_TOKEN_USED) {
 *   removeManaToken(event.playerId, event.color);
 * }
 * ```
 */
export interface ManaTokenUsedEvent {
  readonly type: typeof MANA_TOKEN_USED;
  /** ID of the player who used the token */
  readonly playerId: string;
  /** Color of mana used */
  readonly color: ManaColor;
}

/**
 * Creates a ManaTokenUsedEvent.
 */
export function createManaTokenUsedEvent(
  playerId: string,
  color: ManaColor
): ManaTokenUsedEvent {
  return {
    type: MANA_TOKEN_USED,
    playerId,
    color,
  };
}

// ============================================================================
// CRYSTAL_GAINED
// ============================================================================

/**
 * Event type constant for gaining a crystal.
 * @see CrystalGainedEvent
 */
export const CRYSTAL_GAINED = "CRYSTAL_GAINED" as const;

/**
 * Emitted when a player gains a mana crystal.
 *
 * Crystals are permanent mana storage (max 3 per color).
 *
 * @remarks
 * - Crystals persist across turns
 * - Max 3 crystals per color
 * - Can be converted to tokens when needed
 * - source indicates where crystal came from
 *
 * @example
 * ```typescript
 * if (event.type === CRYSTAL_GAINED) {
 *   addCrystal(event.playerId, event.color);
 *   showCrystalGainedAnimation(event.source);
 * }
 * ```
 */
export interface CrystalGainedEvent {
  readonly type: typeof CRYSTAL_GAINED;
  /** ID of the player who gained the crystal */
  readonly playerId: string;
  /** Color of the crystal */
  readonly color: ManaColor;
  /** Source of the crystal (e.g., "mine", "card_effect") */
  readonly source: string;
}

/**
 * Creates a CrystalGainedEvent.
 */
export function createCrystalGainedEvent(
  playerId: string,
  color: ManaColor,
  source: string
): CrystalGainedEvent {
  return {
    type: CRYSTAL_GAINED,
    playerId,
    color,
    source,
  };
}

// ============================================================================
// CRYSTAL_USED
// ============================================================================

/**
 * Event type constant for using a crystal.
 * @see CrystalUsedEvent
 */
export const CRYSTAL_USED = "CRYSTAL_USED" as const;

/**
 * Emitted when a mana crystal is consumed.
 *
 * The crystal is permanently consumed for its mana.
 *
 * @remarks
 * - Crystal is removed from player's inventory
 * - Provides one mana of the crystal's color
 * - Irreversible action
 *
 * @example
 * ```typescript
 * if (event.type === CRYSTAL_USED) {
 *   removeCrystal(event.playerId, event.color);
 * }
 * ```
 */
export interface CrystalUsedEvent {
  readonly type: typeof CRYSTAL_USED;
  /** ID of the player who used the crystal */
  readonly playerId: string;
  /** Color of the crystal used */
  readonly color: ManaColor;
}

/**
 * Creates a CrystalUsedEvent.
 */
export function createCrystalUsedEvent(
  playerId: string,
  color: ManaColor
): CrystalUsedEvent {
  return {
    type: CRYSTAL_USED,
    playerId,
    color,
  };
}

// ============================================================================
// CRYSTAL_CONVERTED
// ============================================================================

/**
 * Event type constant for crystal conversion.
 * @see CrystalConvertedEvent
 */
export const CRYSTAL_CONVERTED = "CRYSTAL_CONVERTED" as const;

/**
 * Emitted when a mana token is converted to a crystal for storage.
 *
 * Allows saving mana for later turns.
 *
 * @remarks
 * - Token is consumed, crystal is gained
 * - Subject to 3 crystal per color limit
 * - Can be done at any time during turn
 *
 * @example
 * ```typescript
 * if (event.type === CRYSTAL_CONVERTED) {
 *   removeManaToken(event.playerId, event.color);
 *   addCrystal(event.playerId, event.color);
 * }
 * ```
 */
export interface CrystalConvertedEvent {
  readonly type: typeof CRYSTAL_CONVERTED;
  /** ID of the player who converted */
  readonly playerId: string;
  /** Color of the mana/crystal */
  readonly color: ManaColor;
}

/**
 * Creates a CrystalConvertedEvent.
 */
export function createCrystalConvertedEvent(
  playerId: string,
  color: ManaColor
): CrystalConvertedEvent {
  return {
    type: CRYSTAL_CONVERTED,
    playerId,
    color,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for ManaDieTakenEvent.
 */
export function isManaDieTakenEvent(event: {
  type: string;
}): event is ManaDieTakenEvent {
  return event.type === MANA_DIE_TAKEN;
}

/**
 * Type guard for CrystalGainedEvent.
 */
export function isCrystalGainedEvent(event: {
  type: string;
}): event is CrystalGainedEvent {
  return event.type === CRYSTAL_GAINED;
}

/**
 * Type guard for CrystalUsedEvent.
 */
export function isCrystalUsedEvent(event: {
  type: string;
}): event is CrystalUsedEvent {
  return event.type === CRYSTAL_USED;
}

/**
 * Check if an event is any mana-related event.
 */
export function isManaEvent(event: { type: string }): boolean {
  return [
    MANA_DIE_TAKEN,
    MANA_DIE_RETURNED,
    CRYSTAL_CONVERTED,
    MANA_DIE_USED,
    CRYSTAL_USED,
    CRYSTAL_GAINED,
    MANA_TOKEN_USED,
  ].includes(event.type as typeof MANA_DIE_TAKEN);
}
