/**
 * Valid actions for returning interactive skills from the center.
 *
 * Computes which interactive skills a non-owner player can return.
 * Currently supports Prayer of Weather (terrain cost reduction).
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { ReturnableSkillOptions } from "@mage-knight/shared";
import { SOURCE_SKILL } from "../../types/modifierConstants.js";
import {
  SKILLS,
  SKILL_NOROWAS_PRAYER_OF_WEATHER,
  SKILL_GOLDYX_SOURCE_OPENING,
  SKILL_BRAEVALAR_NATURES_VENGEANCE,
  SKILL_KRANG_SHAMANIC_RITUAL,
  SKILL_KRANG_ARCANE_DISGUISE,
  SKILL_WOLFHAWK_WOLFS_HOWL,
} from "../../data/skills/index.js";
import { MANA_GREEN, type SkillId } from "@mage-knight/shared";

/** Skills that support the return mechanic */
const RETURNABLE_SKILL_IDS = new Set<SkillId>([
  SKILL_NOROWAS_PRAYER_OF_WEATHER,
  SKILL_GOLDYX_SOURCE_OPENING,
  SKILL_BRAEVALAR_NATURES_VENGEANCE,
  SKILL_WOLFHAWK_WOLFS_HOWL,
]);

/** Return benefit descriptions by skill */
const RETURN_BENEFITS: Record<string, string> = {
  [SKILL_NOROWAS_PRAYER_OF_WEATHER]: "All terrain costs -1 this turn (min 1)",
  [SKILL_GOLDYX_SOURCE_OPENING]: "Use an extra basic-color die from Source, give Goldyx a crystal",
  [SKILL_BRAEVALAR_NATURES_VENGEANCE]: "Reduce one enemy's attack by 1, gains Cumbersome",
  [SKILL_WOLFHAWK_WOLFS_HOWL]: "Reduce one enemy's armor by 1 (min 1), and one enemy's attack by 1",
  [SKILL_KRANG_SHAMANIC_RITUAL]: "Flip back face-up (uses your action this turn)",
  [SKILL_KRANG_ARCANE_DISGUISE]: "Pay 1 green mana to flip back face-up",
};

/**
 * Get returnable skill options for a player.
 *
 * Checks for interactive skills in the center placed by other players.
 * In solo mode, Source Opening can be returned by the owner (FAQ S1).
 * Returns undefined if no skills can be returned.
 */
export function getReturnableSkillOptions(
  state: GameState,
  player: Player
): ReturnableSkillOptions | undefined {
  const returnable: ReturnableSkillOptions["returnable"][number][] = [];
  const isSolo = state.players.length === 1;

  // Find center modifiers from other players' interactive skills
  for (const skillId of RETURNABLE_SKILL_IDS) {
    const centerModifier = state.activeModifiers.find(
      (m) =>
        m.source.type === SOURCE_SKILL &&
        m.source.skillId === skillId &&
        m.source.playerId !== undefined &&
        // Solo mode exception: Source Opening owner can return their own (S1)
        (m.source.playerId !== player.id ||
          (isSolo && skillId === SKILL_GOLDYX_SOURCE_OPENING))
    );

    if (centerModifier) {
      const skill = SKILLS[skillId];
      if (skill) {
        returnable.push({
          skillId,
          name: skill.name,
          returnBenefit: RETURN_BENEFITS[skillId] ?? skill.description,
        });
      }
    }
  }

  // Shamanic Ritual special case: owner may spend their turn action to flip it back.
  if (
    player.skills.includes(SKILL_KRANG_SHAMANIC_RITUAL) &&
    player.skillFlipState.flippedSkills.includes(SKILL_KRANG_SHAMANIC_RITUAL) &&
    !player.hasTakenActionThisTurn &&
    !player.isResting
  ) {
    const skill = SKILLS[SKILL_KRANG_SHAMANIC_RITUAL];
    if (skill) {
      returnable.push({
        skillId: SKILL_KRANG_SHAMANIC_RITUAL,
        name: skill.name,
        returnBenefit:
          RETURN_BENEFITS[SKILL_KRANG_SHAMANIC_RITUAL] ?? skill.description,
      });
    }
  }

  // Arcane Disguise special case: owner may pay one green mana to flip it back.
  if (
    player.skills.includes(SKILL_KRANG_ARCANE_DISGUISE) &&
    player.skillFlipState.flippedSkills.includes(SKILL_KRANG_ARCANE_DISGUISE) &&
    player.pureMana.some((token) => token.color === MANA_GREEN)
  ) {
    const skill = SKILLS[SKILL_KRANG_ARCANE_DISGUISE];
    if (skill) {
      returnable.push({
        skillId: SKILL_KRANG_ARCANE_DISGUISE,
        name: skill.name,
        returnBenefit:
          RETURN_BENEFITS[SKILL_KRANG_ARCANE_DISGUISE] ?? skill.description,
      });
    }
  }

  if (returnable.length === 0) {
    return undefined;
  }

  return { returnable };
}
