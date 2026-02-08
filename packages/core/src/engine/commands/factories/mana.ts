/**
 * Mana Command Factories
 *
 * Factory functions for USE_MANA_DIE and CONVERT_CRYSTAL actions.
 *
 * @module commands/factories/mana
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import {
  USE_MANA_DIE_ACTION,
  CONVERT_CRYSTAL_ACTION,
} from "@mage-knight/shared";
import type { Command } from "../types.js";
import { createUseManaDieCommand } from "../useManaDieCommand.js";
import { createConvertCrystalCommand } from "../convertCrystalCommand.js";

export function createUseManaDieCommandFromAction(
  _state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== USE_MANA_DIE_ACTION) return null;
  return createUseManaDieCommand({
    playerId,
    dieId: action.dieId,
    color: action.color,
  });
}

export function createConvertCrystalCommandFromAction(
  _state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== CONVERT_CRYSTAL_ACTION) return null;
  return createConvertCrystalCommand({
    playerId,
    color: action.color,
  });
}
