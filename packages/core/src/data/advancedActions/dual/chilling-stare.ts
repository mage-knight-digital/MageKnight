import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import {
  ABILITY_ASSASSINATION,
  ABILITY_BRUTAL,
  ABILITY_CUMBERSOME,
  ABILITY_PARALYZE,
  ABILITY_POISON,
  ABILITY_SWIFT,
  ABILITY_VAMPIRIC,
  CARD_CHILLING_STARE,
  MANA_BLUE,
  MANA_WHITE,
  RESIST_ICE,
} from "@mage-knight/shared";
import { choice, influence } from "../helpers.js";
import { EFFECT_SELECT_COMBAT_ENEMY } from "../../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_ENEMY_SKIP_ATTACK,
} from "../../../types/modifierConstants.js";

export const CHILLING_STARE: DeedCard = {
  id: CARD_CHILLING_STARE,
  name: "Chilling Stare",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE, MANA_WHITE], // Can be powered by blue OR white
  categories: [CATEGORY_COMBAT],
  basicEffect: choice(
    influence(3),
    {
      type: EFFECT_SELECT_COMBAT_ENEMY,
      excludeResistance: RESIST_ICE,
      // For summoner stacks, this mode targets the summoned monster, not the summoner.
      excludeSummoners: true,
      template: {
        modifiers: [
          {
            modifier: {
              type: EFFECT_ABILITY_NULLIFIER,
              ability: ABILITY_SWIFT,
              ignoreArcaneImmunity: true,
            },
            duration: DURATION_COMBAT,
            description: "Target enemy attack loses Swiftness",
          },
          {
            modifier: {
              type: EFFECT_ABILITY_NULLIFIER,
              ability: ABILITY_BRUTAL,
              ignoreArcaneImmunity: true,
            },
            duration: DURATION_COMBAT,
            description: "Target enemy attack loses Brutal",
          },
          {
            modifier: {
              type: EFFECT_ABILITY_NULLIFIER,
              ability: ABILITY_POISON,
              ignoreArcaneImmunity: true,
            },
            duration: DURATION_COMBAT,
            description: "Target enemy attack loses Poison",
          },
          {
            modifier: {
              type: EFFECT_ABILITY_NULLIFIER,
              ability: ABILITY_PARALYZE,
              ignoreArcaneImmunity: true,
            },
            duration: DURATION_COMBAT,
            description: "Target enemy attack loses Paralyze",
          },
          {
            modifier: {
              type: EFFECT_ABILITY_NULLIFIER,
              ability: ABILITY_VAMPIRIC,
              ignoreArcaneImmunity: true,
            },
            duration: DURATION_COMBAT,
            description: "Target enemy attack loses Vampiric",
          },
          {
            modifier: {
              type: EFFECT_ABILITY_NULLIFIER,
              ability: ABILITY_ASSASSINATION,
              ignoreArcaneImmunity: true,
            },
            duration: DURATION_COMBAT,
            description: "Target enemy attack loses Assassination",
          },
          {
            modifier: {
              type: EFFECT_ABILITY_NULLIFIER,
              ability: ABILITY_CUMBERSOME,
              ignoreArcaneImmunity: true,
            },
            duration: DURATION_COMBAT,
            description: "Target enemy attack loses Cumbersome",
          },
        ],
      },
    }
  ),
  poweredEffect: choice(
    influence(5),
    {
      type: EFFECT_SELECT_COMBAT_ENEMY,
      excludeArcaneImmune: true,
      excludeResistance: RESIST_ICE,
      // For summoner stacks, this mode targets the summoner, not summoned monsters.
      excludeSummoned: true,
      template: {
        modifiers: [
          {
            modifier: { type: EFFECT_ENEMY_SKIP_ATTACK },
            duration: DURATION_COMBAT,
            description: "Target enemy does not attack",
          },
        ],
      },
    }
  ),
  sidewaysValue: 1,
};
