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
import { SKILLS, SKILL_NOROWAS_PRAYER_OF_WEATHER } from "../../data/skills/index.js";
import type { SkillId } from "@mage-knight/shared";

/** Skills that support the return mechanic */
const RETURNABLE_SKILL_IDS = new Set<SkillId>([
  SKILL_NOROWAS_PRAYER_OF_WEATHER,
]);

/** Return benefit descriptions by skill */
const RETURN_BENEFITS: Record<string, string> = {
  [SKILL_NOROWAS_PRAYER_OF_WEATHER]: "All terrain costs -1 this turn (min 1)",
};

/**
 * Get returnable skill options for a player.
 *
 * Checks for interactive skills in the center placed by other players.
 * Returns undefined if no skills can be returned.
 */
export function getReturnableSkillOptions(
  state: GameState,
  player: Player
): ReturnableSkillOptions | undefined {
  const returnable: ReturnableSkillOptions["returnable"][number][] = [];

  // Find center modifiers from other players' interactive skills
  for (const skillId of RETURNABLE_SKILL_IDS) {
    const centerModifier = state.activeModifiers.find(
      (m) =>
        m.source.type === SOURCE_SKILL &&
        m.source.skillId === skillId &&
        m.source.playerId !== undefined &&
        m.source.playerId !== player.id
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

  if (returnable.length === 0) {
    return undefined;
  }

  return { returnable };
}
