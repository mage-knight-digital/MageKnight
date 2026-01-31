/**
 * Validator registry - merges all action-specific registries
 *
 * This module combines all the domain-specific validator registries into
 * a single unified registry that maps action types to their validators.
 */

import type { Validator } from "../types.js";

// Import all domain registries
import { movementRegistry } from "./movementRegistry.js";
import { cardRegistry } from "./cardRegistry.js";
import { turnRegistry } from "./turnRegistry.js";
import { restRegistry } from "./restRegistry.js";
import { combatRegistry } from "./combatRegistry.js";
import { unitRegistry } from "./unitRegistry.js";
import { interactionRegistry } from "./interactionRegistry.js";
import { choiceRegistry } from "./choiceRegistry.js";
import { offerRegistry } from "./offerRegistry.js";
import { levelUpRegistry } from "./levelUpRegistry.js";
import { roundRegistry } from "./roundRegistry.js";
import { hostileRegistry } from "./hostileRegistry.js";
import { cooperativeRegistry } from "./cooperativeRegistry.js";
import { skillRegistry } from "./skillRegistry.js";
import { debugRegistry } from "./debugRegistry.js";

/**
 * Combined validator registry - maps action types to their validator arrays.
 *
 * Each action type has a list of validators that run in sequence. If any
 * validator fails, the action is rejected with that validator's error.
 */
export const validatorRegistry: Record<string, Validator[]> = {
  // Movement actions (MOVE, EXPLORE)
  ...movementRegistry,

  // Card actions (PLAY_CARD, PLAY_CARD_SIDEWAYS)
  ...cardRegistry,

  // Turn actions (END_TURN, UNDO)
  ...turnRegistry,

  // Rest actions (REST, DECLARE_REST, COMPLETE_REST)
  ...restRegistry,

  // Combat actions (ENTER_COMBAT, CHALLENGE_RAMPAGING, END_COMBAT_PHASE,
  // DECLARE_BLOCK, DECLARE_ATTACK, ASSIGN_DAMAGE,
  // ASSIGN_ATTACK, UNASSIGN_ATTACK, ASSIGN_BLOCK, UNASSIGN_BLOCK)
  ...combatRegistry,

  // Unit actions (RECRUIT_UNIT, ACTIVATE_UNIT)
  ...unitRegistry,

  // Interaction actions (INTERACT, ENTER_SITE)
  ...interactionRegistry,

  // Choice/resolution actions (RESOLVE_CHOICE, SELECT_REWARD, RESOLVE_GLADE_WOUND, RESOLVE_DEEP_MINE)
  ...choiceRegistry,

  // Offer actions (BUY_SPELL, LEARN_ADVANCED_ACTION)
  ...offerRegistry,

  // Level up actions (CHOOSE_LEVEL_UP_REWARDS)
  ...levelUpRegistry,

  // Round actions (ANNOUNCE_END_OF_ROUND)
  ...roundRegistry,

  // Hostile actions (BURN_MONASTERY, PLUNDER_VILLAGE)
  ...hostileRegistry,

  // Cooperative actions (PROPOSE_COOPERATIVE_ASSAULT, RESPOND_TO_COOPERATIVE_PROPOSAL, CANCEL_COOPERATIVE_PROPOSAL)
  ...cooperativeRegistry,

  // Skill actions (USE_SKILL)
  ...skillRegistry,

  // Debug actions (DEBUG_ADD_FAME, DEBUG_TRIGGER_LEVEL_UP)
  ...debugRegistry,
};
