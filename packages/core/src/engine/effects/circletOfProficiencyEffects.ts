/**
 * Circlet of Proficiency effect handlers.
 *
 * Basic: Use one non-interactive skill from common offer or your own skills.
 * - Once-per-turn skills are used twice.
 * - Once-per-round skills are used once.
 *
 * Powered: Select a skill from common offer or your own skills and keep it
 * permanently (as if acquired through level up).
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  CardEffect,
  ResolveCircletBasicSkillEffect,
  ResolveCircletPoweredSkillEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { SkillId } from "@mage-knight/shared";
import {
  SKILLS,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_KRANG_MASTER_OF_CHAOS,
} from "../../data/skills/index.js";
import { SKILL_NOROWAS_BONDS_OF_LOYALTY } from "../../data/skills/norowas/bondsOfLoyalty.js";
import {
  createMasterOfChaosState,
  rollMasterOfChaosInitialPosition,
} from "../rules/masterOfChaos.js";
import { getSkillOptions } from "../validActions/skills.js";
import { createUseSkillCommand } from "../commands/useSkillCommand.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { updatePlayer } from "./atomicHelpers.js";
import { shuffleWithRng } from "../../utils/rng.js";
import {
  EFFECT_CIRCLET_OF_PROFICIENCY_BASIC,
  EFFECT_RESOLVE_CIRCLET_BASIC_SKILL,
  EFFECT_CIRCLET_OF_PROFICIENCY_POWERED,
  EFFECT_RESOLVE_CIRCLET_POWERED_SKILL,
  EFFECT_COMPOUND,
} from "../../types/effectTypes.js";

function getCombinedSkills(state: GameState, player: Player): SkillId[] {
  const combined = [...state.offers.commonSkills, ...player.skills];
  return Array.from(new Set(combined));
}

function buildCircletBasicOptions(state: GameState, player: Player): CardEffect[] {
  const combinedSkills = getCombinedSkills(state, player);
  if (combinedSkills.length === 0) {
    return [];
  }

  const virtualPlayer: Player = {
    ...player,
    skills: combinedSkills,
  };

  const activatableSkills = getSkillOptions(state, virtualPlayer)?.activatable ?? [];
  const activatableSkillIds = new Set(activatableSkills.map((skill) => skill.skillId));

  const options: CardEffect[] = [];

  for (const skillId of combinedSkills) {
    const skill = SKILLS[skillId];
    if (!skill) {
      continue;
    }

    if (
      skill.usageType !== SKILL_USAGE_ONCE_PER_TURN &&
      skill.usageType !== SKILL_USAGE_ONCE_PER_ROUND
    ) {
      continue;
    }

    if (!activatableSkillIds.has(skillId)) {
      continue;
    }

    const resolveOne: ResolveCircletBasicSkillEffect = {
      type: EFFECT_RESOLVE_CIRCLET_BASIC_SKILL,
      skillId,
      skillName: skill.name,
    };

    if (skill.usageType === SKILL_USAGE_ONCE_PER_TURN) {
      options.push({
        type: EFFECT_COMPOUND,
        effects: [resolveOne, resolveOne],
      });
    } else {
      options.push(resolveOne);
    }
  }

  return options;
}

function handleCircletBasic(
  state: GameState,
  player: Player
): EffectResolutionResult {
  const options = buildCircletBasicOptions(state, player);
  if (options.length === 0) {
    return {
      state,
      description: "Circlet of Proficiency: no eligible non-interactive skills",
    };
  }

  return {
    state,
    description: "Circlet of Proficiency: choose a non-interactive skill",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

function wrapPendingChoiceOptionsWithRemainingEffects(
  options: readonly CardEffect[],
  remainingEffects: readonly CardEffect[] | undefined
): readonly CardEffect[] {
  if (!remainingEffects || remainingEffects.length === 0) {
    return options;
  }

  return options.map((option) => ({
    type: EFFECT_COMPOUND,
    effects: [option, ...remainingEffects],
  }));
}

function resolveCircletBasicSkill(
  state: GameState,
  playerId: string,
  effect: ResolveCircletBasicSkillEffect
): EffectResolutionResult {
  const skill = SKILLS[effect.skillId];
  if (!skill) {
    return {
      state,
      description: `Circlet of Proficiency: unknown skill ${effect.skillId}`,
    };
  }

  const result = createUseSkillCommand({
    playerId,
    skillId: effect.skillId,
  }).execute(state);

  const { playerIndex, player } = getPlayerContext(result.state, playerId);
  const pendingChoice = player.pendingChoice;

  if (!pendingChoice) {
    return {
      state: result.state,
      description: `Circlet of Proficiency: used ${skill.name}`,
    };
  }

  const wrappedOptions = wrapPendingChoiceOptionsWithRemainingEffects(
    pendingChoice.options,
    pendingChoice.remainingEffects
  );

  const clearedPlayer: Player = {
    ...player,
    pendingChoice: null,
  };

  const clearedState = updatePlayer(result.state, playerIndex, clearedPlayer);

  return {
    state: clearedState,
    description: `Circlet of Proficiency: choose ${skill.name} effect`,
    requiresChoice: true,
    dynamicChoiceOptions: wrappedOptions,
  };
}

function buildCircletPoweredOptions(state: GameState, player: Player): ResolveCircletPoweredSkillEffect[] {
  return getCombinedSkills(state, player)
    .map((skillId) => {
      const skill = SKILLS[skillId];
      if (!skill) {
        return null;
      }

      return {
        type: EFFECT_RESOLVE_CIRCLET_POWERED_SKILL,
        skillId,
        skillName: skill.name,
      } as ResolveCircletPoweredSkillEffect;
    })
    .filter((option): option is ResolveCircletPoweredSkillEffect => option !== null);
}

function handleCircletPowered(
  state: GameState,
  player: Player
): EffectResolutionResult {
  const options = buildCircletPoweredOptions(state, player);
  if (options.length === 0) {
    return {
      state,
      description: "Circlet of Proficiency: no skills available to acquire",
    };
  }

  return {
    state,
    description: "Circlet of Proficiency: choose a skill to acquire",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

function removeOneSkillFromCommonOffer(
  commonSkills: readonly SkillId[],
  skillId: SkillId
): SkillId[] {
  const updated = [...commonSkills];
  const index = updated.indexOf(skillId);
  if (index >= 0) {
    updated.splice(index, 1);
  }
  return updated;
}

function resolveCircletPoweredSkill(
  state: GameState,
  playerId: string,
  effect: ResolveCircletPoweredSkillEffect
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);
  const alreadyHasSkill = player.skills.includes(effect.skillId);

  let updatedRng = state.rng;
  let updatedRegularUnitsDeck = [...state.decks.regularUnits];
  let updatedUnitOffer = [...state.offers.units];
  let updatedBondsBonusUnits = [...state.offers.bondsOfLoyaltyBonusUnits];

  let updatedPlayer: Player = {
    ...player,
    skills: alreadyHasSkill ? player.skills : [...player.skills, effect.skillId],
  };

  if (!alreadyHasSkill && effect.skillId === SKILL_KRANG_MASTER_OF_CHAOS) {
    const { position, rng } = rollMasterOfChaosInitialPosition(updatedRng);
    updatedRng = rng;
    updatedPlayer = {
      ...updatedPlayer,
      masterOfChaosState: createMasterOfChaosState(position, false),
    };
  }

  if (!alreadyHasSkill && effect.skillId === SKILL_NOROWAS_BONDS_OF_LOYALTY) {
    const { result: shuffled, rng } = shuffleWithRng(updatedRegularUnitsDeck, updatedRng);
    updatedRng = rng;

    const bonusCount = Math.min(2, shuffled.length);
    const bonusUnits = shuffled.slice(0, bonusCount);

    updatedRegularUnitsDeck = shuffled.slice(bonusCount);
    updatedUnitOffer = [...updatedUnitOffer, ...bonusUnits];
    updatedBondsBonusUnits = [...updatedBondsBonusUnits, ...bonusUnits];
  }

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = updatedPlayer;

  const updatedState: GameState = {
    ...state,
    players: updatedPlayers,
    offers: {
      ...state.offers,
      commonSkills: removeOneSkillFromCommonOffer(state.offers.commonSkills, effect.skillId),
      units: updatedUnitOffer,
      bondsOfLoyaltyBonusUnits: updatedBondsBonusUnits,
    },
    decks: {
      ...state.decks,
      regularUnits: updatedRegularUnitsDeck,
    },
    rng: updatedRng,
  };

  return {
    state: updatedState,
    description: `Circlet of Proficiency: acquired ${effect.skillName}`,
  };
}

export function registerCircletOfProficiencyEffects(): void {
  registerEffect(EFFECT_CIRCLET_OF_PROFICIENCY_BASIC, (state, playerId) => {
    const { player } = getPlayerContext(state, playerId);
    return handleCircletBasic(state, player);
  });

  registerEffect(EFFECT_RESOLVE_CIRCLET_BASIC_SKILL, (state, playerId, effect) => {
    return resolveCircletBasicSkill(
      state,
      playerId,
      effect as ResolveCircletBasicSkillEffect
    );
  });

  registerEffect(EFFECT_CIRCLET_OF_PROFICIENCY_POWERED, (state, playerId) => {
    const { player } = getPlayerContext(state, playerId);
    return handleCircletPowered(state, player);
  });

  registerEffect(EFFECT_RESOLVE_CIRCLET_POWERED_SKILL, (state, playerId, effect) => {
    return resolveCircletPoweredSkill(
      state,
      playerId,
      effect as ResolveCircletPoweredSkillEffect
    );
  });
}
