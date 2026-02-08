/**
 * Return Interactive Skill command - handles returning an interactive skill from the center
 *
 * When an interactive skill (e.g., Prayer of Weather) is placed in the center,
 * other players can return it on their turn to gain a benefit.
 * Returning the skill:
 * - Applies the return benefit to the returning player (e.g., -1 terrain cost)
 * - Removes the center marker modifiers
 * - Flips the skill face-down on the owner
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { SkillId } from "@mage-knight/shared";
import type { ActiveModifier } from "../../types/modifiers.js";
import { createSkillUsedEvent } from "@mage-knight/shared";
import { RETURN_INTERACTIVE_SKILL_COMMAND } from "./commandTypes.js";
import { SKILL_NOROWAS_PRAYER_OF_WEATHER, SKILL_GOLDYX_SOURCE_OPENING } from "../../data/skills/index.js";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_TURN,
  EFFECT_RULE_OVERRIDE,
  EFFECT_TERRAIN_COST,
  RULE_EXTRA_SOURCE_DIE,
  SCOPE_SELF,
  SOURCE_SKILL,
  TERRAIN_ALL,
} from "../../types/modifierConstants.js";
import type { SourceOpeningCenter } from "../../state/GameState.js";
export { RETURN_INTERACTIVE_SKILL_COMMAND };

export interface ReturnInteractiveSkillCommandParams {
  readonly playerId: string;
  readonly skillId: SkillId;
}

/**
 * Find the owner of a center skill by checking active modifiers.
 */
function findCenterSkillOwner(
  state: GameState,
  skillId: SkillId
): string | null {
  const centerModifier = state.activeModifiers.find(
    (m) =>
      m.source.type === SOURCE_SKILL &&
      m.source.skillId === skillId &&
      m.source.playerId !== undefined
  );
  if (
    centerModifier &&
    centerModifier.source.type === SOURCE_SKILL
  ) {
    return centerModifier.source.playerId;
  }
  return null;
}

/**
 * Remove center modifiers for a skill from a specific owner.
 */
function removeCenterModifiers(
  state: GameState,
  skillId: SkillId,
  ownerId: string
): GameState {
  const filteredModifiers = state.activeModifiers.filter(
    (modifier) =>
      !(
        modifier.source.type === SOURCE_SKILL &&
        modifier.source.skillId === skillId &&
        modifier.source.playerId === ownerId
      )
  );
  return { ...state, activeModifiers: filteredModifiers };
}

/**
 * Flip the skill face-down on the owner.
 */
function flipSkillFaceDown(
  state: GameState,
  ownerId: string,
  skillId: SkillId
): GameState {
  const ownerIndex = state.players.findIndex((p) => p.id === ownerId);
  if (ownerIndex === -1) return state;

  const owner = state.players[ownerIndex]!;
  const flippedSkills = owner.skillFlipState.flippedSkills.includes(skillId)
    ? owner.skillFlipState.flippedSkills
    : [...owner.skillFlipState.flippedSkills, skillId];

  const updatedOwner: Player = {
    ...owner,
    skillFlipState: {
      ...owner.skillFlipState,
      flippedSkills,
    },
  };

  const players = [...state.players];
  players[ownerIndex] = updatedOwner;

  return { ...state, players };
}

/**
 * Apply the return benefit based on the skill being returned.
 */
function applyReturnBenefit(
  state: GameState,
  playerId: string,
  skillId: SkillId
): GameState {
  if (skillId === SKILL_NOROWAS_PRAYER_OF_WEATHER) {
    // Prayer of Weather: returning player gets -1 terrain cost (min 1) this turn
    return addModifier(state, {
      source: { type: SOURCE_SKILL, skillId, playerId },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: { type: EFFECT_TERRAIN_COST, terrain: TERRAIN_ALL, amount: -1, minimum: 1 },
      createdAtRound: state.round,
      createdByPlayerId: playerId,
    });
  }
  if (skillId === SKILL_GOLDYX_SOURCE_OPENING) {
    // Source Opening: returning player gets an extra Source die (basic colors only).
    // Goldyx (owner) gets a crystal of the color die used — tracked via sourceOpeningCenter
    // and resolved at end of turn.
    const player = state.players.find((p) => p.id === playerId);
    const usedDieCount = player ? player.usedDieIds.length : 0;

    let updatedState = addModifier(state, {
      source: { type: SOURCE_SKILL, skillId, playerId },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_EXTRA_SOURCE_DIE },
      createdAtRound: state.round,
      createdByPlayerId: playerId,
    });

    // Track the returning player for crystal grant at end of turn
    const ownerId = state.sourceOpeningCenter?.ownerId ?? playerId;
    updatedState = {
      ...updatedState,
      sourceOpeningCenter: {
        ownerId,
        skillId,
        returningPlayerId: playerId,
        usedDieCountAtReturn: usedDieCount,
      },
    };

    return updatedState;
  }
  return state;
}

/**
 * Create a return interactive skill command.
 */
export function createReturnInteractiveSkillCommand(
  params: ReturnInteractiveSkillCommandParams
): Command {
  const { playerId, skillId } = params;

  // Store the owner ID and removed modifiers for undo
  let savedOwnerId: string | null = null;
  let savedCenterModifiers: ActiveModifier[] = [];
  let savedSourceOpeningCenter: SourceOpeningCenter | null = null;

  return {
    type: RETURN_INTERACTIVE_SKILL_COMMAND,
    playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      savedOwnerId = findCenterSkillOwner(state, skillId);
      if (!savedOwnerId) {
        throw new Error(`No center skill found for ${skillId}`);
      }

      // Save Source Opening center state for undo
      savedSourceOpeningCenter = state.sourceOpeningCenter;

      // Save center modifiers for undo
      savedCenterModifiers = state.activeModifiers.filter(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === skillId &&
          m.source.playerId === savedOwnerId
      );

      // 1. Remove center modifiers (must happen before applying benefit
      //    to avoid the benefit modifier being accidentally filtered)
      let updatedState = removeCenterModifiers(state, skillId, savedOwnerId);

      // 2. Apply the return benefit to the returning player
      updatedState = applyReturnBenefit(updatedState, playerId, skillId);

      // 3. Flip skill face-down on owner
      updatedState = flipSkillFaceDown(updatedState, savedOwnerId, skillId);

      return {
        state: updatedState,
        events: [createSkillUsedEvent(playerId, skillId)],
      };
    },

    undo(state: GameState): CommandResult {
      if (!savedOwnerId) {
        throw new Error("Cannot undo: no saved owner ID");
      }

      // 1. Remove the return benefit modifier(s) created by the returning player
      const filteredModifiers = state.activeModifiers.filter(
        (m) =>
          !(
            m.source.type === SOURCE_SKILL &&
            m.source.skillId === skillId &&
            m.source.playerId === playerId &&
            m.createdByPlayerId === playerId
          )
      );

      // 2. Restore center modifiers
      let updatedState: GameState = {
        ...state,
        activeModifiers: [...filteredModifiers, ...savedCenterModifiers],
      };

      // 3. Unflip skill on owner
      const ownerIndex = updatedState.players.findIndex(
        (p) => p.id === savedOwnerId
      );
      if (ownerIndex !== -1) {
        const owner = updatedState.players[ownerIndex]!;
        const updatedOwner: Player = {
          ...owner,
          skillFlipState: {
            ...owner.skillFlipState,
            flippedSkills: owner.skillFlipState.flippedSkills.filter(
              (id) => id !== skillId
            ),
          },
        };
        const players = [...updatedState.players];
        players[ownerIndex] = updatedOwner;
        updatedState = { ...updatedState, players };
      }

      // 4. Restore Source Opening center state if applicable
      if (skillId === SKILL_GOLDYX_SOURCE_OPENING) {
        updatedState = {
          ...updatedState,
          sourceOpeningCenter: savedSourceOpeningCenter,
        };
      }

      return {
        state: updatedState,
        events: [],
      };
    },
  };
}
