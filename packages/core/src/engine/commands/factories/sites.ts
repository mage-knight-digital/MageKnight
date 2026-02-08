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
 * - createBurnMonasteryCommandFromAction - Burn a monastery (initiate combat)
 * - createPlunderVillageCommandFromAction - Plunder a village (lose reputation, draw cards)
 * - createResolveCrystalJoyReclaimCommandFromAction - Resolve Crystal Joy end-of-turn reclaim
 */

import type { CommandFactory } from "./types.js";
import type { PlayerAction, GladeWoundChoice, BasicManaColor, CardId } from "@mage-knight/shared";
import {
  INTERACT_ACTION,
  ENTER_SITE_ACTION,
  RESOLVE_GLADE_WOUND_ACTION,
  RESOLVE_DEEP_MINE_ACTION,
  BURN_MONASTERY_ACTION,
  PLUNDER_VILLAGE_ACTION,
  RESOLVE_CRYSTAL_JOY_RECLAIM_ACTION,
  RESOLVE_STEADY_TEMPO_ACTION,
  RESOLVE_BANNER_PROTECTION_ACTION,
  RESOLVE_SOURCE_OPENING_REROLL_ACTION,
} from "@mage-knight/shared";
import { createInteractCommand } from "../interactCommand.js";
import { createEnterSiteCommand } from "../enterSiteCommand.js";
import { createResolveGladeWoundCommand } from "../resolveGladeWoundCommand.js";
import { createResolveDeepMineChoiceCommand } from "../resolveDeepMineChoiceCommand.js";
import { createBurnMonasteryCommand } from "../burnMonasteryCommand.js";
import { createPlunderVillageCommand } from "../plunderVillageCommand.js";
import { createResolveCrystalJoyReclaimCommand } from "../resolveCrystalJoyReclaimCommand.js";
import { createResolveSteadyTempoCommand } from "../resolveSteadyTempoCommand.js";
import { createResolveBannerProtectionCommand } from "../resolveBannerProtectionCommand.js";
import { createResolveSourceOpeningRerollCommand } from "../resolveSourceOpeningRerollCommand.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";

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

  const player = getPlayerById(state, playerId);
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

/**
 * Burn monastery command factory.
 * Creates a command to burn a monastery (initiates combat).
 */
export const createBurnMonasteryCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== BURN_MONASTERY_ACTION) return null;
  return createBurnMonasteryCommand({ playerId });
};

/**
 * Plunder village command factory.
 * Creates a command to plunder a village (lose reputation, draw cards).
 */
export const createPlunderVillageCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== PLUNDER_VILLAGE_ACTION) return null;
  return createPlunderVillageCommand({ playerId });
};

/**
 * Helper to get crystal joy reclaim card ID from action.
 */
function getCrystalJoyReclaimCardFromAction(
  action: PlayerAction
): CardId | undefined {
  if (action.type === RESOLVE_CRYSTAL_JOY_RECLAIM_ACTION && "cardId" in action) {
    return action.cardId;
  }
  return undefined;
}

/**
 * Resolve crystal joy reclaim command factory.
 * Creates a command to resolve the Crystal Joy end-of-turn reclaim ability.
 */
export const createResolveCrystalJoyReclaimCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== RESOLVE_CRYSTAL_JOY_RECLAIM_ACTION) return null;

  const cardId = getCrystalJoyReclaimCardFromAction(action);
  return createResolveCrystalJoyReclaimCommand({
    playerId,
    cardId,
  });
};

/**
 * Resolve steady tempo deck placement command factory.
 * Creates a command to resolve the Steady Tempo end-of-turn deck placement.
 */
export const createResolveSteadyTempoCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== RESOLVE_STEADY_TEMPO_ACTION) return null;

  return createResolveSteadyTempoCommand({
    playerId,
    place: action.place,
  });
};

/**
 * Resolve Banner of Protection wound removal command factory.
 * Creates a command to resolve the Banner of Protection end-of-turn wound removal.
 */
export const createResolveBannerProtectionCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== RESOLVE_BANNER_PROTECTION_ACTION) return null;

  return createResolveBannerProtectionCommand({
    playerId,
    removeAll: action.removeAll,
  });
};

/**
 * Resolve Source Opening reroll command factory.
 * Creates a command to resolve the Source Opening end-of-turn reroll choice (FAQ S3).
 */
export const createResolveSourceOpeningRerollCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== RESOLVE_SOURCE_OPENING_REROLL_ACTION) return null;

  return createResolveSourceOpeningRerollCommand({
    playerId,
    reroll: action.reroll,
  });
};
