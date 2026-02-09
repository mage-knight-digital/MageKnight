/**
 * Universal Power skill effect handler
 *
 * Goldyx's skill: Add 1 mana to a sideways card to increase bonus.
 * +3 instead of +1 for all cards, +4 if mana color matches Action/Spell card color.
 * Artifacts always receive +3 (no color to match).
 * Black mana (at night via special rules) grants only +3.
 *
 * Implementation:
 * - Consumes 1 mana of any basic color from the specified source
 * - Creates one SidewaysValueModifier with value 3 (baseline for all non-wounds)
 * - Creates one SidewaysValueModifier with value 4 (Action/Spell only, conditional on mana matching)
 * - The modifier system uses Math.max() to pick the best applicable value
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { ManaSourceInfo, BasicManaColor } from "@mage-knight/shared";
import { MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import { addModifier, getModifiersForPlayer } from "../../modifiers/index.js";
import {
  SKILL_GOLDYX_UNIVERSAL_POWER,
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_ARYTHEA_POWER_OF_PAIN,
  SKILL_WOLFHAWK_WOLFS_HOWL,
} from "../../../data/skills/index.js";
import {
  DURATION_TURN,
  EFFECT_SIDEWAYS_VALUE,
  SCOPE_SELF,
  SOURCE_SKILL,
  SIDEWAYS_CONDITION_WITH_MANA_MATCHING_COLOR,
} from "../../../types/modifierConstants.js";
import {
  DEED_CARD_TYPE_BASIC_ACTION,
  DEED_CARD_TYPE_ADVANCED_ACTION,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { getPlayerIndexByIdOrThrow } from "../../helpers/playerHelpers.js";
import { consumeMana } from "../helpers/manaConsumptionHelpers.js";

/**
 * Apply the Universal Power skill effect.
 *
 * 1. Consumes 1 mana from the specified source
 * 2. Creates a +3 sideways value modifier (all non-wound cards)
 * 3. Creates a +4 sideways value modifier (Action/Spell only, conditional on matching mana color)
 *
 * The +4 modifier stores the mana color spent so the sideways command
 * can check if the card's poweredBy includes that color.
 * Artifacts always get +3 since they have no poweredBy color to match.
 */
export function applyUniversalPowerEffect(
  state: GameState,
  playerId: string,
  manaSource?: ManaSourceInfo
): GameState {
  if (!manaSource) {
    throw new Error("Universal Power requires a mana source");
  }

  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Consume the mana
  const manaResult = consumeMana(player, state.source, manaSource, playerId);
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = manaResult.player;
  state = { ...state, players: updatedPlayers, source: manaResult.source };

  const manaColor = manaSource.color as BasicManaColor;

  // Add +3 modifier (baseline for all non-wound cards)
  state = addModifier(state, {
    source: {
      type: SOURCE_SKILL,
      skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
      playerId,
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_SIDEWAYS_VALUE,
      newValue: 3,
      forWounds: false,
    },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  // Add +4 modifier (Action/Spell cards only, conditional on mana color matching card color)
  // This modifier stores the mana color so the sideways command can check it
  state = addModifier(state, {
    source: {
      type: SOURCE_SKILL,
      skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
      playerId,
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_SIDEWAYS_VALUE,
      newValue: 4,
      forWounds: false,
      condition: SIDEWAYS_CONDITION_WITH_MANA_MATCHING_COLOR,
      forCardTypes: [
        DEED_CARD_TYPE_BASIC_ACTION,
        DEED_CARD_TYPE_ADVANCED_ACTION,
        DEED_CARD_TYPE_SPELL,
      ],
      manaColor,
    },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  return state;
}

/**
 * Remove all modifiers created by Universal Power skill for a player.
 * Used for undo functionality. Mana restoration is handled by useSkillCommand.
 */
export function removeUniversalPowerEffect(
  state: GameState,
  playerId: string
): GameState {
  return {
    ...state,
    activeModifiers: state.activeModifiers.filter(
      (m) =>
        !(
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_GOLDYX_UNIVERSAL_POWER &&
          m.source.playerId === playerId
        )
    ),
  };
}

/**
 * Conflicting sideways-boosting skills that cannot be active simultaneously.
 * Ruling S2: Cannot stack with I Don't Give a Damn, Who Needs Magic, Wolf's Howl.
 * Ruling S3: Cannot combine with Power of Pain.
 */
const CONFLICTING_SKILLS = [
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_ARYTHEA_POWER_OF_PAIN,
  SKILL_WOLFHAWK_WOLFS_HOWL,
];

/**
 * Check if Universal Power can be activated.
 * Requires:
 * 1. Player has at least 1 basic mana available (R/G/B/W)
 * 2. No conflicting sideways-boosting skills are active
 */
export function canActivateUniversalPower(
  state: GameState,
  player: Player
): boolean {
  // Check for conflicting active modifiers from other sideways skills
  const activeModifiers = getModifiersForPlayer(state, player.id);
  const hasConflict = activeModifiers.some(
    (m) =>
      m.source.type === SOURCE_SKILL &&
      CONFLICTING_SKILLS.includes(m.source.skillId)
  );
  if (hasConflict) {
    return false;
  }

  // Must have at least 1 basic mana available
  // Import is deferred to avoid circular dependency - use inline check
  const basicColors = [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE] as const;

  // Check pure mana tokens
  for (const token of player.pureMana) {
    if (basicColors.includes(token.color as BasicManaColor)) {
      return true;
    }
  }

  // Check crystals
  for (const color of basicColors) {
    if (player.crystals[color] > 0) {
      return true;
    }
  }

  // Check source dice (if not blocked and available)
  if (!player.usedManaFromSource) {
    for (const die of state.source.dice) {
      if (die.takenByPlayerId === null && !die.isDepleted) {
        if (basicColors.includes(die.color as BasicManaColor)) {
          return true;
        }
      }
    }
  }

  return false;
}
