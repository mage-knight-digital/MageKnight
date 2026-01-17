/**
 * Site Command Factories
 *
 * Factory functions that translate site-related PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/sites
 *
 * @remarks Factories in this module:
 * - createInteractCommandFromAction - Interact with a site (healing, recruiting)
 * - createEnterSiteCommandFromAction - Enter an adventure site
 * - createResolveGladeWoundCommandFromAction - Resolve Magical Glade wound choice
 * - createResolveDeepMineCommandFromAction - Resolve Deep Mine crystal color choice
 */

import type { CommandFactory } from "./types.js";
import type { PlayerAction, GladeWoundChoice, BasicManaColor } from "@mage-knight/shared";
import {
  INTERACT_ACTION,
  ENTER_SITE_ACTION,
  RESOLVE_GLADE_WOUND_ACTION,
  RESOLVE_DEEP_MINE_ACTION,
} from "@mage-knight/shared";
import { createInteractCommand } from "../interactCommand.js";
import { createEnterSiteCommand } from "../enterSiteCommand.js";
import { createResolveGladeWoundCommand } from "../resolveGladeWoundCommand.js";
import { createResolveDeepMineChoiceCommand } from "../resolveDeepMineChoiceCommand.js";

/**
 * Helper to get glade wound choice from action.
 */
function getGladeWoundChoiceFromAction(
  action: PlayerAction
): GladeWoundChoice | null {
  if (action.type === RESOLVE_GLADE_WOUND_ACTION && "choice" in action) {
    return action.choice;
  }
  return null;
}

/**
 * Helper to get deep mine color choice from action.
 */
function getDeepMineColorFromAction(
  action: PlayerAction
): BasicManaColor | null {
  if (action.type === RESOLVE_DEEP_MINE_ACTION && "color" in action) {
    return action.color;
  }
  return null;
}

/**
 * Interact command factory.
 * Creates a command to interact with a site (healing, recruiting, etc.).
 */
export const createInteractCommandFromAction: CommandFactory = (
  state,
  playerId,
  action
) => {
  if (action.type !== INTERACT_ACTION) return null;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  // For now, influence must be calculated from player's influencePoints
  // In a full implementation, we'd track influence from played cards
  const influenceAvailable = player.influencePoints;

  return createInteractCommand({
    playerId,
    healing: action.healing ?? 0,
    influenceAvailable,
    previousHand: [...player.hand],
  });
};

/**
 * Enter site command factory.
 * Creates a command to enter an adventure site.
 */
export const createEnterSiteCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== ENTER_SITE_ACTION) return null;
  return createEnterSiteCommand({ playerId });
};

/**
 * Resolve glade wound command factory.
 * Creates a command to resolve the Magical Glade wound discard choice.
 */
export const createResolveGladeWoundCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  const choice = getGladeWoundChoiceFromAction(action);
  if (!choice) return null;
  return createResolveGladeWoundCommand({
    playerId,
    choice,
  });
};

/**
 * Resolve deep mine command factory.
 * Creates a command to resolve the Deep Mine crystal color choice.
 */
export const createResolveDeepMineCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  const color = getDeepMineColorFromAction(action);
  if (!color) return null;
  return createResolveDeepMineChoiceCommand({
    playerId,
    color,
  });
};
