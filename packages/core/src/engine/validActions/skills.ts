/**
 * Valid actions for skill activation.
 *
 * Computes which skills a player can activate based on:
 * - Skills they have learned
 * - Skill cooldowns (once per turn, once per round)
 * - Skill usage type (only activatable skills, not passive/interactive)
 * - Combat skills (CATEGORY_COMBAT) only available during combat
 * - Block skills only available during block phase
 * - Skill-specific requirements (e.g., not in combat, has wound in hand)
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { SkillOptions } from "@mage-knight/shared";
import {
  SKILLS,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_USAGE_INTERACTIVE,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_TOVAK_SHIELD_MASTERY,
  SKILL_TOVAK_I_FEEL_NO_PAIN,
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
  SKILL_ARYTHEA_POLARIZATION,
  SKILL_ARYTHEA_RITUAL_OF_PAIN,
  SKILL_ARYTHEA_POWER_OF_PAIN,
  SKILL_ARYTHEA_INVOCATION,
  SKILL_ARYTHEA_DARK_PATHS,
  SKILL_ARYTHEA_BURNING_POWER,
  SKILL_ARYTHEA_HOT_SWORDSMANSHIP,
  SKILL_ARYTHEA_DARK_FIRE_MAGIC,
  SKILL_ARYTHEA_MOTIVATION,
  SKILL_GOLDYX_FREEZING_POWER,
  SKILL_BRAEVALAR_THUNDERSTORM,
  SKILL_BRAEVALAR_LIGHTNING_STORM,
  SKILL_BRAEVALAR_SECRET_WAYS,
  SKILL_NOROWAS_DAY_SHARPSHOOTING,
  SKILL_NOROWAS_FORWARD_MARCH,
  SKILL_NOROWAS_INSPIRATION,
  SKILL_NOROWAS_LEAVES_IN_THE_WIND,
  SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
  SKILL_NOROWAS_LEADERSHIP,
  SKILL_NOROWAS_MOTIVATION,
  SKILL_NOROWAS_PRAYER_OF_WEATHER,
  SKILL_GOLDYX_POTION_MAKING,
  SKILL_GOLDYX_FLIGHT,
  SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
  SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT,
  SKILL_GOLDYX_RED_CRYSTAL_CRAFT,
  SKILL_TOVAK_NIGHT_SHARPSHOOTING,
  SKILL_TOVAK_COLD_SWORDSMANSHIP,
  SKILL_TOVAK_RESISTANCE_BREAK,
  SKILL_TOVAK_MOTIVATION,
  SKILL_TOVAK_MANA_OVERLOAD,
  SKILL_GOLDYX_GLITTERING_FORTUNE,
  SKILL_GOLDYX_UNIVERSAL_POWER,
  SKILL_GOLDYX_MOTIVATION,
  SKILL_GOLDYX_SOURCE_OPENING,
  SKILL_WOLFHAWK_REFRESHING_BATH,
  SKILL_WOLFHAWK_REFRESHING_BREEZE,
  SKILL_WOLFHAWK_HAWK_EYES,
  SKILL_WOLFHAWK_ON_HER_OWN,
  SKILL_WOLFHAWK_DEADLY_AIM,
  SKILL_WOLFHAWK_KNOW_YOUR_PREY,
  SKILL_WOLFHAWK_TAUNT,
  SKILL_WOLFHAWK_DUELING,
  SKILL_WOLFHAWK_MOTIVATION,
  SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE,
  SKILL_BRAEVALAR_BEGUILE,
  SKILL_BRAEVALAR_FORKED_LIGHTNING,
  SKILL_BRAEVALAR_SHAPESHIFT,
  SKILL_BRAEVALAR_REGENERATE,
  SKILL_KRANG_REGENERATE,
  SKILL_KRANG_SPIRIT_GUIDES,
  SKILL_KRANG_BATTLE_HARDENED,
  SKILL_KRANG_BATTLE_FRENZY,
  SKILL_KRANG_ARCANE_DISGUISE,
  SKILL_WOLFHAWK_WOLFS_HOWL,
  SKILL_KRANG_SHAMANIC_RITUAL,
} from "../../data/skills/index.js";
import { CATEGORY_COMBAT, CATEGORY_MOVEMENT } from "../../types/cards.js";
import {
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_RANGED_SIEGE,
} from "../../types/combat.js";
import { CARD_WOUND } from "@mage-knight/shared";
import { canActivatePolarization } from "../commands/skills/polarizationEffect.js";
import { canActivateInvocation } from "../commands/skills/invocationEffect.js";
import { canActivateShapeshift } from "../commands/skills/shapeshiftEffect.js";
import { canActivateRegenerate } from "../commands/skills/regenerateEffect.js";
import { canActivateKnowYourPrey } from "../commands/skills/knowYourPreyEffect.js";
import { canActivateDueling } from "../commands/skills/duelingEffect.js";
import { canUseMeleeAttackSkill, isMeleeAttackSkill, isSkillFaceUp } from "../rules/skillPhasing.js";
import { isPlayerAtInteractionSite } from "../rules/siteInteraction.js";
import { hexKey } from "@mage-knight/shared";
import { canActivateUniversalPower } from "../commands/skills/universalPowerEffect.js";
import { canActivateWolfsHowl } from "../commands/skills/wolfsHowlEffect.js";
import { isMotivationSkill, isMotivationCooldownActive } from "../rules/motivation.js";

/**
 * Skills that have effect implementations and can be activated.
 * As more skills are implemented, add them here.
 */
const IMPLEMENTED_SKILLS = new Set([
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_TOVAK_SHIELD_MASTERY,
  SKILL_TOVAK_I_FEEL_NO_PAIN,
  SKILL_ARYTHEA_POLARIZATION,
  SKILL_ARYTHEA_RITUAL_OF_PAIN,
  SKILL_ARYTHEA_POWER_OF_PAIN,
  SKILL_ARYTHEA_INVOCATION,
  SKILL_ARYTHEA_DARK_PATHS,
  SKILL_ARYTHEA_BURNING_POWER,
  SKILL_ARYTHEA_HOT_SWORDSMANSHIP,
  SKILL_ARYTHEA_DARK_FIRE_MAGIC,
  SKILL_ARYTHEA_MOTIVATION,
  SKILL_GOLDYX_FREEZING_POWER,
  SKILL_GOLDYX_POTION_MAKING,
  SKILL_GOLDYX_FLIGHT,
  SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
  SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT,
  SKILL_GOLDYX_RED_CRYSTAL_CRAFT,
  SKILL_BRAEVALAR_THUNDERSTORM,
  SKILL_BRAEVALAR_LIGHTNING_STORM,
  SKILL_BRAEVALAR_SECRET_WAYS,
  SKILL_NOROWAS_DAY_SHARPSHOOTING,
  SKILL_NOROWAS_FORWARD_MARCH,
  SKILL_NOROWAS_INSPIRATION,
  SKILL_NOROWAS_LEAVES_IN_THE_WIND,
  SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
  SKILL_NOROWAS_LEADERSHIP,
  SKILL_NOROWAS_MOTIVATION,
  SKILL_NOROWAS_PRAYER_OF_WEATHER,
  SKILL_TOVAK_NIGHT_SHARPSHOOTING,
  SKILL_TOVAK_COLD_SWORDSMANSHIP,
  SKILL_TOVAK_RESISTANCE_BREAK,
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
  SKILL_TOVAK_MOTIVATION,
  SKILL_TOVAK_MANA_OVERLOAD,
  SKILL_GOLDYX_GLITTERING_FORTUNE,
  SKILL_GOLDYX_UNIVERSAL_POWER,
  SKILL_GOLDYX_MOTIVATION,
  SKILL_GOLDYX_SOURCE_OPENING,
  SKILL_WOLFHAWK_REFRESHING_BATH,
  SKILL_WOLFHAWK_REFRESHING_BREEZE,
  SKILL_WOLFHAWK_HAWK_EYES,
  SKILL_WOLFHAWK_ON_HER_OWN,
  SKILL_WOLFHAWK_DEADLY_AIM,
  SKILL_WOLFHAWK_KNOW_YOUR_PREY,
  SKILL_WOLFHAWK_TAUNT,
  SKILL_WOLFHAWK_DUELING,
  SKILL_WOLFHAWK_MOTIVATION,
  SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE,
  SKILL_BRAEVALAR_BEGUILE,
  SKILL_BRAEVALAR_FORKED_LIGHTNING,
  SKILL_BRAEVALAR_SHAPESHIFT,
  SKILL_BRAEVALAR_REGENERATE,
  SKILL_KRANG_REGENERATE,
  SKILL_KRANG_SPIRIT_GUIDES,
  SKILL_KRANG_BATTLE_HARDENED,
  SKILL_KRANG_BATTLE_FRENZY,
  SKILL_KRANG_ARCANE_DISGUISE,
  SKILL_WOLFHAWK_WOLFS_HOWL,
  SKILL_KRANG_SHAMANIC_RITUAL,
]);

const INTERACTIVE_ONCE_PER_ROUND = new Set([SKILL_ARYTHEA_RITUAL_OF_PAIN, SKILL_TOVAK_MANA_OVERLOAD, SKILL_NOROWAS_PRAYER_OF_WEATHER, SKILL_GOLDYX_SOURCE_OPENING, SKILL_WOLFHAWK_WOLFS_HOWL]);

/**
 * Check skill-specific requirements beyond cooldowns.
 * Returns true if the skill can be activated, false otherwise.
 */
function canActivateSkill(
  state: GameState,
  player: Player,
  skillId: string
): boolean {
  switch (skillId) {
    case SKILL_TOVAK_I_FEEL_NO_PAIN:
      // Cannot use during combat
      if (state.combat !== null) {
        return false;
      }
      // Must have a wound in hand
      if (!player.hand.some((c) => c === CARD_WOUND)) {
        return false;
      }
      return true;

    case SKILL_ARYTHEA_POLARIZATION:
      // Must have at least one convertible mana source
      return canActivatePolarization(state, player);

    case SKILL_ARYTHEA_RITUAL_OF_PAIN:
    case SKILL_NOROWAS_INSPIRATION:
    case SKILL_NOROWAS_PRAYER_OF_WEATHER:
    case SKILL_GOLDYX_POTION_MAKING:
    case SKILL_GOLDYX_SOURCE_OPENING:
    case SKILL_WOLFHAWK_REFRESHING_BATH:
    case SKILL_WOLFHAWK_REFRESHING_BREEZE:
      // Cannot use during combat
      return state.combat === null;

    case SKILL_ARYTHEA_INVOCATION:
      // Must have at least one card in hand to discard
      return canActivateInvocation(player);

    case SKILL_GOLDYX_GLITTERING_FORTUNE: {
      // Only usable during interaction at an inhabited site
      if (!player.position) return false;
      const hex = state.map.hexes[hexKey(player.position)];
      if (!hex?.site) return false;
      return isPlayerAtInteractionSite(hex.site, player.id);
    }

    case SKILL_GOLDYX_UNIVERSAL_POWER:
      return canActivateUniversalPower(state, player);

    case SKILL_WOLFHAWK_WOLFS_HOWL:
      return canActivateWolfsHowl(state, player);

    case SKILL_BRAEVALAR_SHAPESHIFT:
      // Must have at least one Basic Action card with a shapeshiftable effect in hand
      return canActivateShapeshift(state, player);

    case SKILL_BRAEVALAR_REGENERATE:
    case SKILL_KRANG_REGENERATE:
      // Must have wound in hand, not in combat, and mana available
      return canActivateRegenerate(state, player);

    case SKILL_WOLFHAWK_KNOW_YOUR_PREY:
      // Must be in combat with targetable enemies
      return canActivateKnowYourPrey(state);

    case SKILL_WOLFHAWK_DUELING:
      // Must be in combat with eligible enemies that are alive and still attacking
      return canActivateDueling(state);

    default:
      // No special requirements
      return true;
  }
}

/**
 * Get skill activation options for a player.
 *
 * Returns undefined if no skills can be activated.
 */
export function getSkillOptions(
  state: GameState,
  player: Player
): SkillOptions | undefined {
  const activatable = [];
  const inCombat = state.combat !== null;

  for (const skillId of player.skills) {
    const skill = SKILLS[skillId];
    if (!skill) continue;

    // Only include skills that have been implemented
    if (!IMPLEMENTED_SKILLS.has(skillId)) continue;

    // Skip skills that are flipped face-down (e.g., Battle Frenzy after using Attack 4)
    if (!isSkillFaceUp(player, skillId)) continue;

    // Combat skills (CATEGORY_COMBAT) are only available during combat,
    // unless they also have CATEGORY_MOVEMENT (e.g., Spirit Guides grants
    // Move 1 outside combat and +1 Block modifier usable in Block phase)
    if (skill.categories.includes(CATEGORY_COMBAT) && !inCombat) {
      if (!skill.categories.includes(CATEGORY_MOVEMENT)) {
        continue;
      }
    }

    // Block skills are only available during block phase
    const blockSkills = [SKILL_TOVAK_SHIELD_MASTERY, SKILL_WOLFHAWK_TAUNT, SKILL_WOLFHAWK_DUELING];
    if (blockSkills.includes(skillId)) {
      if (!state.combat || state.combat.phase !== COMBAT_PHASE_BLOCK) {
        continue;
      }
    }

    // Ranged/siege attack skills are only available during ranged/siege or attack phase
    const rangedSkills = [SKILL_NOROWAS_DAY_SHARPSHOOTING, SKILL_TOVAK_NIGHT_SHARPSHOOTING, SKILL_ARYTHEA_BURNING_POWER, SKILL_GOLDYX_FREEZING_POWER, SKILL_BRAEVALAR_FORKED_LIGHTNING, SKILL_WOLFHAWK_DEADLY_AIM];
    if (rangedSkills.includes(skillId)) {
      if (
        !state.combat ||
        (state.combat.phase !== COMBAT_PHASE_RANGED_SIEGE &&
          state.combat.phase !== COMBAT_PHASE_ATTACK)
      ) {
        continue;
      }
    }

    // Melee attack skills are only available during attack phase
    // Uses shared rule from rules/skillPhasing.ts to stay aligned with validators
    if (isMeleeAttackSkill(skillId)) {
      if (!canUseMeleeAttackSkill(state)) {
        continue;
      }
    }

    // Check if skill can be activated based on usage type
    if (skill.usageType === SKILL_USAGE_ONCE_PER_TURN) {
      // Check turn cooldown
      if (player.skillCooldowns.usedThisTurn.includes(skillId)) {
        continue;
      }
    } else if (
      skill.usageType === SKILL_USAGE_ONCE_PER_ROUND ||
      (skill.usageType === SKILL_USAGE_INTERACTIVE &&
        INTERACTIVE_ONCE_PER_ROUND.has(skillId))
    ) {
      // Check round cooldown
      if (player.skillCooldowns.usedThisRound.includes(skillId)) {
        continue;
      }
    } else {
      // Passive and interactive skills are not directly activatable via USE_SKILL
      continue;
    }

    // Motivation cross-hero cooldown check
    if (isMotivationSkill(skillId) && isMotivationCooldownActive(player)) {
      continue;
    }

    // Check skill-specific requirements
    if (!canActivateSkill(state, player, skillId)) {
      continue;
    }

    activatable.push({
      skillId,
      name: skill.name,
      description: skill.description,
    });
  }

  if (activatable.length === 0) {
    return undefined;
  }

  return { activatable };
}
