/**
 * Return Interactive Skill command - handles returning an interactive skill from the center
 *
 * When an interactive skill (e.g., Prayer of Weather) is placed in the center,
 * other players can return it on their turn to gain a benefit.
 * Returning the skill:
 * - Applies the return benefit to the returning player (e.g., -1 terrain cost)
 * - Removes the center marker modifiers
 * - Flips the skill face-down on the owner
 *
 * Nature's Vengeance: return benefit triggers enemy selection (attack -1, Cumbersome)
 * via the effect resolution system, creating a pending choice if in combat.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player, PendingChoice } from "../../types/player.js";
import type { SkillId, GameEvent } from "@mage-knight/shared";
import type { ActiveModifier } from "../../types/modifiers.js";
import type { CardEffect } from "../../types/cards.js";
import { ABILITY_CUMBERSOME } from "@mage-knight/shared";
import { createSkillUsedEvent, createChoiceRequiredEvent } from "@mage-knight/shared";
import { RETURN_INTERACTIVE_SKILL_COMMAND } from "./commandTypes.js";
import {
  SKILL_NOROWAS_PRAYER_OF_WEATHER,
  SKILL_GOLDYX_SOURCE_OPENING,
  SKILL_BRAEVALAR_NATURES_VENGEANCE,
  SKILL_KRANG_SHAMANIC_RITUAL,
  SKILL_WOLFHAWK_WOLFS_HOWL,
} from "../../data/skills/index.js";
import { addModifier } from "../modifiers/index.js";
import { resolveEffect, describeEffect } from "../effects/index.js";
import {
  DURATION_COMBAT,
  DURATION_TURN,
  EFFECT_ENEMY_STAT,
  EFFECT_GRANT_ENEMY_ABILITY,
  EFFECT_RULE_OVERRIDE,
  EFFECT_TERRAIN_COST,
  ENEMY_STAT_ARMOR,
  ENEMY_STAT_ATTACK,
  RULE_EXTRA_SOURCE_DIE,
  SCOPE_SELF,
  SOURCE_SKILL,
  TERRAIN_ALL,
} from "../../types/modifierConstants.js";
import {
  EFFECT_SELECT_COMBAT_ENEMY,
} from "../../types/effectTypes.js";
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

function unflipSkillFaceUp(
  state: GameState,
  ownerId: string,
  skillId: SkillId
): GameState {
  const ownerIndex = state.players.findIndex((p) => p.id === ownerId);
  if (ownerIndex === -1) return state;

  const owner = state.players[ownerIndex]!;
  if (!owner.skillFlipState.flippedSkills.includes(skillId)) {
    return state;
  }

  const updatedOwner: Player = {
    ...owner,
    skillFlipState: {
      ...owner.skillFlipState,
      flippedSkills: owner.skillFlipState.flippedSkills.filter(
        (id) => id !== skillId
      ),
    },
  };

  const players = [...state.players];
  players[ownerIndex] = updatedOwner;

  return { ...state, players };
}

/**
 * Wolf's Howl return benefit: two sequential enemy selections.
 * Step 1: Reduce armor of chosen enemy by 1 (min 1) — excludes Arcane Immune (S5)
 * Step 2: Reduce attack of same or another enemy by 1 — does NOT exclude Arcane Immune (S5)
 * Can split between summoner and summoned monster (S2).
 */
const WOLFS_HOWL_ARMOR_EFFECT: CardEffect = {
  type: EFFECT_SELECT_COMBAT_ENEMY,
  excludeArcaneImmune: true,
  template: {
    modifiers: [
      {
        modifier: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -1,
          minimum: 1,
        },
        duration: DURATION_COMBAT,
        description: "Wolf's Howl: Armor -1",
      },
    ],
  },
};

const WOLFS_HOWL_ATTACK_EFFECT: CardEffect = {
  type: EFFECT_SELECT_COMBAT_ENEMY,
  template: {
    modifiers: [
      {
        modifier: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ATTACK,
          amount: -1,
          minimum: 0,
        },
        duration: DURATION_COMBAT,
        description: "Wolf's Howl: Attack -1",
      },
    ],
  },
};

/**
 * Nature's Vengeance return benefit: SELECT_COMBAT_ENEMY effect for attack -1 + Cumbersome.
 * Same as the owner's effect but without placing in center.
 */
const NATURES_VENGEANCE_RETURN_EFFECT: CardEffect = {
  type: EFFECT_SELECT_COMBAT_ENEMY,
  excludeSummoners: true,
  template: {
    modifiers: [
      {
        modifier: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ATTACK,
          amount: -1,
          minimum: 0,
        },
        duration: DURATION_COMBAT,
        description: "Nature's Vengeance: Attack -1",
      },
      {
        modifier: {
          type: EFFECT_GRANT_ENEMY_ABILITY,
          ability: ABILITY_CUMBERSOME,
        },
        duration: DURATION_COMBAT,
        description: "Nature's Vengeance: Gains Cumbersome",
      },
    ],
  },
};

/**
 * Apply the return benefit based on the skill being returned.
 * Returns { state, pendingChoice } if the benefit requires a choice (Nature's Vengeance).
 */
function applyReturnBenefit(
  state: GameState,
  playerId: string,
  skillId: SkillId
): { state: GameState; pendingChoice?: boolean; events?: GameEvent[] } {
  if (skillId === SKILL_NOROWAS_PRAYER_OF_WEATHER) {
    // Prayer of Weather: returning player gets -1 terrain cost (min 1) this turn
    return {
      state: addModifier(state, {
        source: { type: SOURCE_SKILL, skillId, playerId },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_TERRAIN_COST, terrain: TERRAIN_ALL, amount: -1, minimum: 1 },
        createdAtRound: state.round,
        createdByPlayerId: playerId,
      }),
    };
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

    return { state: updatedState };
  }
  if (skillId === SKILL_BRAEVALAR_NATURES_VENGEANCE) {
    // Nature's Vengeance: reduce one enemy's attack by 1, grant Cumbersome.
    // Requires enemy selection via the effect system.
    if (!state.combat) {
      // Not in combat — no benefit
      return { state };
    }

    const effectResult = resolveEffect(state, playerId, NATURES_VENGEANCE_RETURN_EFFECT);

    if (effectResult.requiresChoice && effectResult.dynamicChoiceOptions) {
      // Multiple enemies — create pending choice
      const playerIndex = state.players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) {
        return { state };
      }

      const pendingChoice: PendingChoice = {
        cardId: null,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
        unitInstanceId: null,
        options: effectResult.dynamicChoiceOptions,
      };

      const player = state.players[playerIndex]!;
      const updatedPlayer: Player = {
        ...player,
        pendingChoice,
      };
      const players = [...effectResult.state.players];
      players[playerIndex] = updatedPlayer;

      const choiceEvent = createChoiceRequiredEvent(
        playerId,
        null,
        SKILL_BRAEVALAR_NATURES_VENGEANCE,
        effectResult.dynamicChoiceOptions.map((opt) => describeEffect(opt))
      );

      return {
        state: { ...effectResult.state, players },
        pendingChoice: true,
        events: [choiceEvent],
      };
    }

    // Single or no enemies — auto-resolved
    return { state: effectResult.state };
  }
  if (skillId === SKILL_WOLFHAWK_WOLFS_HOWL) {
    // Wolf's Howl: two sequential enemy selections.
    // Step 1: Reduce armor of chosen enemy by 1 (min 1) — excludes Arcane Immune (S5)
    // Step 2: Reduce attack of same or another enemy by 1 — NO Arcane Immune exclusion (S5)
    // Can split between summoner and summoned monster (S2).
    if (!state.combat) {
      // Not in combat — no benefit
      return { state };
    }

    // Try resolving armor step first to determine if it has valid targets.
    // This lets us correctly set remainingEffects for the pending choice.
    const armorResult = resolveEffect(state, playerId, WOLFS_HOWL_ARMOR_EFFECT);

    if (armorResult.requiresChoice && armorResult.dynamicChoiceOptions) {
      // Armor step has valid targets — create pending choice with attack as remaining
      const playerIndex = state.players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) {
        return { state };
      }

      const pendingChoice: PendingChoice = {
        cardId: null,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
        unitInstanceId: null,
        options: armorResult.dynamicChoiceOptions,
        remainingEffects: [WOLFS_HOWL_ATTACK_EFFECT],
      };

      const player = state.players[playerIndex]!;
      const updatedPlayer: Player = {
        ...player,
        pendingChoice,
      };
      const players = [...armorResult.state.players];
      players[playerIndex] = updatedPlayer;

      const choiceEvent = createChoiceRequiredEvent(
        playerId,
        null,
        SKILL_WOLFHAWK_WOLFS_HOWL,
        armorResult.dynamicChoiceOptions.map((opt) => describeEffect(opt))
      );

      return {
        state: { ...armorResult.state, players },
        pendingChoice: true,
        events: [choiceEvent],
      };
    }

    // Armor step had no valid targets (e.g., all enemies Arcane Immune).
    // Continue to attack step directly.
    const attackResult = resolveEffect(armorResult.state, playerId, WOLFS_HOWL_ATTACK_EFFECT);

    if (attackResult.requiresChoice && attackResult.dynamicChoiceOptions) {
      const playerIndex = state.players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) {
        return { state };
      }

      const pendingChoice: PendingChoice = {
        cardId: null,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
        unitInstanceId: null,
        options: attackResult.dynamicChoiceOptions,
      };

      const player = state.players[playerIndex]!;
      const updatedPlayer: Player = {
        ...player,
        pendingChoice,
      };
      const players = [...attackResult.state.players];
      players[playerIndex] = updatedPlayer;

      const choiceEvent = createChoiceRequiredEvent(
        playerId,
        null,
        SKILL_WOLFHAWK_WOLFS_HOWL,
        attackResult.dynamicChoiceOptions.map((opt) => describeEffect(opt))
      );

      return {
        state: { ...attackResult.state, players },
        pendingChoice: true,
        events: [choiceEvent],
      };
    }

    // Both steps auto-resolved (0 enemies for each)
    return { state: attackResult.state };
  }
  return { state };
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
  let savedHasTakenActionThisTurn: boolean | null = null;
  let savedUsedThisRoundHadSkill: boolean = false;

  return {
    type: RETURN_INTERACTIVE_SKILL_COMMAND,
    playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      if (skillId === SKILL_KRANG_SHAMANIC_RITUAL) {
        const ownerIndex = state.players.findIndex((p) => p.id === playerId);
        if (ownerIndex === -1) {
          throw new Error(`Player not found: ${playerId}`);
        }

        savedOwnerId = playerId;
        const owner = state.players[ownerIndex]!;
        savedHasTakenActionThisTurn = owner.hasTakenActionThisTurn;
        savedUsedThisRoundHadSkill = owner.skillCooldowns.usedThisRound.includes(
          SKILL_KRANG_SHAMANIC_RITUAL
        );

        let updatedState = unflipSkillFaceUp(
          state,
          playerId,
          SKILL_KRANG_SHAMANIC_RITUAL
        );

        const refreshedOwner = updatedState.players[ownerIndex]!;
        const updatedOwner: Player = {
          ...refreshedOwner,
          hasTakenActionThisTurn: true,
          skillCooldowns: {
            ...refreshedOwner.skillCooldowns,
            usedThisRound: refreshedOwner.skillCooldowns.usedThisRound.filter(
              (id) => id !== SKILL_KRANG_SHAMANIC_RITUAL
            ),
          },
        };
        const players = [...updatedState.players];
        players[ownerIndex] = updatedOwner;
        updatedState = { ...updatedState, players };

        return {
          state: updatedState,
          events: [createSkillUsedEvent(playerId, skillId)],
        };
      }

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
      const benefitResult = applyReturnBenefit(updatedState, playerId, skillId);
      updatedState = benefitResult.state;

      // 3. Flip skill face-down on owner
      updatedState = flipSkillFaceDown(updatedState, savedOwnerId, skillId);

      const events: GameEvent[] = [createSkillUsedEvent(playerId, skillId)];
      if (benefitResult.events) {
        events.push(...benefitResult.events);
      }

      return {
        state: updatedState,
        events,
      };
    },

    undo(state: GameState): CommandResult {
      if (!savedOwnerId) {
        throw new Error("Cannot undo: no saved owner ID");
      }

      if (skillId === SKILL_KRANG_SHAMANIC_RITUAL) {
        const ownerIndex = state.players.findIndex((p) => p.id === savedOwnerId);
        if (ownerIndex === -1) {
          throw new Error(`Player not found: ${savedOwnerId}`);
        }

        let updatedState = flipSkillFaceDown(
          state,
          savedOwnerId,
          SKILL_KRANG_SHAMANIC_RITUAL
        );
        const owner = updatedState.players[ownerIndex]!;
        const usedThisRound = savedUsedThisRoundHadSkill
          ? owner.skillCooldowns.usedThisRound.includes(SKILL_KRANG_SHAMANIC_RITUAL)
            ? owner.skillCooldowns.usedThisRound
            : [...owner.skillCooldowns.usedThisRound, SKILL_KRANG_SHAMANIC_RITUAL]
          : owner.skillCooldowns.usedThisRound.filter(
              (id) => id !== SKILL_KRANG_SHAMANIC_RITUAL
            );

        const restoredOwner: Player = {
          ...owner,
          hasTakenActionThisTurn:
            savedHasTakenActionThisTurn ?? owner.hasTakenActionThisTurn,
          skillCooldowns: {
            ...owner.skillCooldowns,
            usedThisRound,
          },
        };
        const players = [...updatedState.players];
        players[ownerIndex] = restoredOwner;
        updatedState = { ...updatedState, players };

        return {
          state: updatedState,
          events: [],
        };
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
          // Clear pending choice on undo
          pendingChoice: null,
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
