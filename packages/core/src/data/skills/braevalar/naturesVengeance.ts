/**
 * Nature's Vengeance - Braevalar Skill
 *
 * Active (interactive, once per round): Reduce one enemy's attack by 1 and
 * grant that enemy Cumbersome. Put skill token in center.
 *
 * While in center: Other players' enemies get +1 attack during Block phase only (S1).
 * Owner is exempt from this penalty (S1).
 *
 * Other players may return the token to owner (face-down) to reduce one enemy's
 * attack by 1 and give that enemy Cumbersome.
 *
 * Key rules:
 * - Cannot target Summoner tokens, but CAN target summoned Monsters (S3)
 * - Arcane Immune enemies CAN gain Cumbersome (O4)
 * - +1 attack penalty only during Block phase (S1)
 * - Owner is exempt from +1 penalty (S1)
 * - Multi-attack enemies: each attack gets +1 (S1)
 *
 * @module data/skills/braevalar/naturesVengeance
 */

import type { SkillId } from "@mage-knight/shared";
import { ABILITY_CUMBERSOME } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_PLACE_SKILL_IN_CENTER,
} from "../../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_STAT,
  EFFECT_GRANT_ENEMY_ABILITY,
  ENEMY_STAT_ATTACK,
} from "../../../types/modifierConstants.js";
import { type SkillDefinition, SKILL_USAGE_INTERACTIVE } from "../types.js";

export const SKILL_BRAEVALAR_NATURES_VENGEANCE = "braevalar_natures_vengeance" as SkillId;

export const naturesVengeance: SkillDefinition = {
  id: SKILL_BRAEVALAR_NATURES_VENGEANCE,
  name: "Nature's Vengeance",
  heroId: "braevalar",
  description: "Reduce enemy attack by 1, gains Cumbersome. Others' enemies +1 attack",
  usageType: SKILL_USAGE_INTERACTIVE,
  effect: {
    type: EFFECT_COMPOUND,
    effects: [
      // Step 1: Select an enemy - reduce attack by 1, grant Cumbersome
      {
        type: EFFECT_SELECT_COMBAT_ENEMY,
        // Cannot target Summoners (S3), but CAN target Arcane Immune (O4)
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
      },
      // Step 2: Place skill token in center for other players
      {
        type: EFFECT_PLACE_SKILL_IN_CENTER,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      },
    ],
  },
  categories: [CATEGORY_COMBAT],
};
