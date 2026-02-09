/**
 * Wolf's Howl skill effect handler
 *
 * Wolfhawk's interactive skill (once per round, except during interaction):
 * - One sideways card gives +4 instead of +1
 * - For each command token without assigned unit, gives another +1
 * - Place skill token in center
 *
 * The sideways bonus is implemented as a base +4, plus a scaling bonus
 * based on empty command tokens. The empty command token bonus is calculated
 * at activation time and baked into the modifier's newValue.
 *
 * Part of the sideways bonus exclusion group: cannot stack with
 * Universal Power, I Don't Give a Damn, Who Needs Magic, or Power of Pain.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import { addModifier, getModifiersForPlayer } from "../../modifiers/index.js";
import { SKILL_WOLFHAWK_WOLFS_HOWL } from "../../../data/skills/wolfhawk/wolfsHowl.js";
import {
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_ARYTHEA_POWER_OF_PAIN,
  SKILL_GOLDYX_UNIVERSAL_POWER,
} from "../../../data/skills/index.js";
import {
  DURATION_TURN,
  EFFECT_SIDEWAYS_VALUE,
  SCOPE_SELF,
  SOURCE_SKILL,
} from "../../../types/modifierConstants.js";
import { EFFECT_PLACE_SKILL_IN_CENTER } from "../../../types/effectTypes.js";
import { handlePlaceSkillInCenter } from "../../effects/ritualOfPainEffects.js";

/**
 * Conflicting sideways-boosting skills that cannot be active simultaneously.
 * Wolf's Howl cannot stack with these skills (S2 ruling on Universal Power).
 */
const CONFLICTING_SKILLS = [
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_ARYTHEA_POWER_OF_PAIN,
  SKILL_GOLDYX_UNIVERSAL_POWER,
];

/**
 * Check if Wolf's Howl can be activated.
 * Requires:
 * 1. Not during interaction (handled by validator — same as "not in combat" since
 *    interaction blocks skill activation)
 * 2. No conflicting sideways-boosting skills are active
 */
export function canActivateWolfsHowl(
  state: GameState,
  player: Player
): boolean {
  // Cannot use during combat
  if (state.combat !== null) {
    return false;
  }

  // Check for conflicting active modifiers from other sideways skills
  const activeModifiers = getModifiersForPlayer(state, player.id);
  const hasConflict = activeModifiers.some(
    (m) =>
      m.source.type === SOURCE_SKILL &&
      CONFLICTING_SKILLS.includes(m.source.skillId)
  );
  return !hasConflict;
}

/**
 * Apply the Wolf's Howl skill effect.
 *
 * 1. Calculate sideways bonus: +4 base + 1 per empty command token
 * 2. Create SidewaysValueModifier with the calculated value
 * 3. Place skill token in center for other players
 */
export function applyWolfsHowlEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const player = state.players[playerIndex]!;

  // Calculate bonus from empty command tokens
  const emptyCommandTokens = Math.max(0, player.commandTokens - player.units.length);
  const sidewaysValue = 4 + emptyCommandTokens;

  // Place skill token in center first (this clears existing modifiers for the skill)
  const centerResult = handlePlaceSkillInCenter(state, playerId, {
    type: EFFECT_PLACE_SKILL_IN_CENTER,
    skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
  });
  state = centerResult.state;

  // Add sideways value modifier AFTER center placement, since handlePlaceSkillInCenter
  // removes all existing modifiers for the skill before adding center markers
  state = addModifier(state, {
    source: {
      type: SOURCE_SKILL,
      skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      playerId,
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_SIDEWAYS_VALUE,
      newValue: sidewaysValue,
      forWounds: false,
    },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  return state;
}

/**
 * Remove all modifiers created by Wolf's Howl skill for a player.
 * Used for undo functionality.
 */
export function removeWolfsHowlEffect(
  state: GameState,
  playerId: string
): GameState {
  return {
    ...state,
    activeModifiers: state.activeModifiers.filter(
      (m) =>
        !(
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_WOLFHAWK_WOLFS_HOWL &&
          m.source.playerId === playerId
        )
    ),
  };
}
