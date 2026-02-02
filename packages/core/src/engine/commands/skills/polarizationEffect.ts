/**
 * Polarization skill effect handler (Arythea)
 *
 * Once per turn: Convert one mana to its opposite color.
 * - Basic: Red↔Blue, Green↔White
 * - Day: Black → any basic color (cannot power spells)
 * - Night: Gold → Black (can power spells)
 *
 * Works on any mana form: token, crystal, or Source die.
 * Converted mana must be used immediately.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { CardEffect } from "../../../types/cards.js";
import type { ManaColor, BasicManaColor } from "@mage-knight/shared";
import { SKILL_ARYTHEA_POLARIZATION } from "../../../data/skills/index.js";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
  BASIC_MANA_COLORS,
  TIME_OF_DAY_DAY,
} from "@mage-knight/shared";
import { EFFECT_POLARIZE_MANA } from "../../../types/effectTypes.js";
import { getPlayerIndexByIdOrThrow } from "../../helpers/playerHelpers.js";

/**
 * Mana source types that can be converted by Polarization.
 */
export const POLARIZATION_SOURCE_TOKEN = "token" as const;
export const POLARIZATION_SOURCE_CRYSTAL = "crystal" as const;
export const POLARIZATION_SOURCE_DIE = "die" as const;

export type PolarizationSourceType =
  | typeof POLARIZATION_SOURCE_TOKEN
  | typeof POLARIZATION_SOURCE_CRYSTAL
  | typeof POLARIZATION_SOURCE_DIE;

/**
 * Describes a mana source that can be converted.
 */
export interface PolarizableManaSource {
  readonly sourceType: PolarizationSourceType;
  readonly color: ManaColor;
  /** Index in pureMana array (for tokens) */
  readonly tokenIndex?: number;
  /** Die ID (for source dice) */
  readonly dieId?: string;
}

/**
 * Describes a conversion option presented to the player.
 */
export interface PolarizationOption {
  readonly source: PolarizableManaSource;
  readonly targetColor: ManaColor;
  /** True if this conversion cannot be used to power spells (day black→basic) */
  readonly cannotPowerSpells: boolean;
  /** Human-readable description */
  readonly description: string;
}

/**
 * Color opposition chart for basic colors.
 */
const BASIC_OPPOSITES: Record<BasicManaColor, BasicManaColor> = {
  [MANA_RED]: MANA_BLUE,
  [MANA_BLUE]: MANA_RED,
  [MANA_GREEN]: MANA_WHITE,
  [MANA_WHITE]: MANA_GREEN,
};

/**
 * Get the opposite color for basic mana colors.
 */
export function getOppositeColor(color: BasicManaColor): BasicManaColor {
  return BASIC_OPPOSITES[color];
}

/**
 * Check if a color is a basic mana color.
 */
function isBasicColor(color: ManaColor): color is BasicManaColor {
  return BASIC_MANA_COLORS.includes(color as BasicManaColor);
}

/**
 * Get all available mana sources that can be polarized.
 */
function getAvailableManaSources(
  state: GameState,
  player: Player
): PolarizableManaSource[] {
  const sources: PolarizableManaSource[] = [];

  // 1. Tokens in pureMana
  player.pureMana.forEach((token, index) => {
    sources.push({
      sourceType: POLARIZATION_SOURCE_TOKEN,
      color: token.color,
      tokenIndex: index,
    });
  });

  // 2. Crystals (basic colors only)
  for (const color of BASIC_MANA_COLORS) {
    if (player.crystals[color] > 0) {
      sources.push({
        sourceType: POLARIZATION_SOURCE_CRYSTAL,
        color,
      });
    }
  }

  // 3. Source dice (not taken by other players, including depleted ones per FAQ)
  // Note: Depleted dice CAN be converted (FAQ S1)
  for (const die of state.source.dice) {
    // Die must not be taken by another player
    // But we allow the current player to convert a die they haven't taken yet
    if (die.takenByPlayerId === null || die.takenByPlayerId === player.id) {
      sources.push({
        sourceType: POLARIZATION_SOURCE_DIE,
        color: die.color,
        dieId: die.id,
      });
    }
  }

  return sources;
}

/**
 * Build conversion options based on time of day and available sources.
 */
function buildConversionOptions(
  state: GameState,
  player: Player
): PolarizationOption[] {
  const sources = getAvailableManaSources(state, player);
  const options: PolarizationOption[] = [];
  const isDay = state.timeOfDay === TIME_OF_DAY_DAY;

  for (const source of sources) {
    const sourceColor = source.color;

    // Basic color conversion: opposite basic color (any time)
    if (isBasicColor(sourceColor)) {
      const targetColor = getOppositeColor(sourceColor);
      options.push({
        source,
        targetColor,
        cannotPowerSpells: false,
        description: `Convert ${sourceColor} ${source.sourceType} to ${targetColor}`,
      });
    }

    // Day-specific: Black → Gold → any basic color (cannot power spells)
    if (isDay && sourceColor === MANA_BLACK) {
      // Black converts through gold to any basic color
      for (const basicColor of BASIC_MANA_COLORS) {
        options.push({
          source,
          targetColor: basicColor,
          cannotPowerSpells: true, // Per rulebook: "not to power stronger effect of spells"
          description: `Convert black ${source.sourceType} to ${basicColor} (cannot power spells)`,
        });
      }
    }

    // Night-specific: Gold → Black (can power spells)
    if (!isDay && sourceColor === MANA_GOLD) {
      options.push({
        source,
        targetColor: MANA_BLACK,
        cannotPowerSpells: false, // Per rulebook: explicitly allowed to power spells
        description: `Convert gold ${source.sourceType} to black (can power spells)`,
      });
    }
  }

  return options;
}

/**
 * Create a PolarizeManaEffect for the conversion.
 * This effect atomically removes the source and adds the converted token.
 */
function createConversionEffect(option: PolarizationOption): CardEffect {
  // Build the effect object conditionally to satisfy exactOptionalPropertyTypes
  const baseEffect = {
    type: EFFECT_POLARIZE_MANA as typeof EFFECT_POLARIZE_MANA,
    sourceType: option.source.sourceType,
    sourceColor: option.source.color,
    targetColor: option.targetColor,
    cannotPowerSpells: option.cannotPowerSpells,
  };

  // Only add tokenIndex if it's defined
  if (option.source.tokenIndex !== undefined) {
    return {
      ...baseEffect,
      tokenIndex: option.source.tokenIndex,
    };
  }

  // Only add dieId if it's defined
  if (option.source.dieId !== undefined) {
    return {
      ...baseEffect,
      dieId: option.source.dieId,
    };
  }

  // Crystal conversion - no additional fields needed
  return baseEffect;
}

/**
 * Apply the Polarization skill effect.
 *
 * Creates a pending choice with all valid conversion options.
 * The player must select one to complete the polarization.
 *
 * Each option is a PolarizeManaEffect that encodes:
 * - Source type (token, crystal, or die)
 * - Source color and identifier (index/dieId)
 * - Target color
 * - Whether the converted mana can power spells
 */
export function applyPolarizationEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Build conversion options
  const options = buildConversionOptions(state, player);

  if (options.length === 0) {
    // No valid conversions available - this shouldn't happen if validators work correctly
    // but handle gracefully by returning state unchanged
    return state;
  }

  // Create pending choice with PolarizeManaEffect options
  // Each effect contains all info needed to perform the conversion
  const choiceOptions = options.map((opt) => createConversionEffect(opt));

  const updatedPlayer: Player = {
    ...player,
    pendingChoice: {
      cardId: null,
      skillId: SKILL_ARYTHEA_POLARIZATION,
      unitInstanceId: null,
      options: choiceOptions,
    },
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}

/**
 * Remove Polarization effect for undo.
 *
 * Clears the pending choice if it's from Polarization.
 * Note: If the choice has already been resolved, the mana effect
 * will be undone by the effect system through resolveChoiceCommand.
 */
export function removePolarizationEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Clear pending choice if it's from Polarization
  const updatedPlayer: Player = {
    ...player,
    pendingChoice:
      player.pendingChoice?.skillId === SKILL_ARYTHEA_POLARIZATION
        ? null
        : player.pendingChoice,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}

/**
 * Check if Polarization skill can be activated.
 * Used by validActions to determine if the skill should be shown.
 *
 * Requirements:
 * - Player must have at least one convertible mana source
 * - Day: any basic color token/crystal/die, OR black token/crystal/die
 * - Night: any basic color token/crystal/die, OR gold token/crystal/die
 */
export function canActivatePolarization(
  state: GameState,
  player: Player
): boolean {
  const options = buildConversionOptions(state, player);
  return options.length > 0;
}

/**
 * Get human-readable descriptions for UI display.
 */
export function getPolarizationOptionDescriptions(
  state: GameState,
  player: Player
): string[] {
  const options = buildConversionOptions(state, player);
  return options.map((opt) => opt.description);
}
