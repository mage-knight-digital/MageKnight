/**
 * Soul Harvester crystal tracking
 *
 * When the Soul Harvester artifact is played, a SoulHarvesterCrystalTracking
 * modifier is created. When enemies are defeated at phase resolution, the
 * player gains crystals based on the defeated enemies' resistances:
 *   - Fire Resistance → Red crystal option
 *   - Ice Resistance → Blue crystal option
 *   - Physical Resistance → Green crystal option
 *   - White is always available
 *
 * Basic mode (limit: 1): Crystal for one enemy defeated by this attack.
 * Powered mode (limit: 99): Crystal per enemy defeated in current phase.
 *
 * FAQ: Crystals gained IMMEDIATELY. No crystal for summoned monsters or Volkare.
 */

import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy } from "../../types/combat.js";
import type { SoulHarvesterCrystalTrackingModifier } from "../../types/modifiers.js";
import { EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING } from "../../types/modifierConstants.js";
import { gainCrystalWithOverflow } from "../helpers/crystalHelpers.js";
import type { BasicManaColor } from "@mage-knight/shared";
import { RESIST_FIRE, RESIST_ICE, RESIST_PHYSICAL } from "@mage-knight/shared";

export interface SoulHarvesterCrystalOption {
  readonly color: BasicManaColor;
  readonly reason: string;
}

export interface SoulHarvesterResolutionResult {
  readonly state: GameState;
  readonly crystalChoices: readonly SoulHarvesterCrystalOption[][];
}

/**
 * Get crystal color options for a defeated enemy based on its resistances.
 * White is always available. Additional colors based on resistances.
 */
export function getCrystalOptionsForEnemy(enemy: CombatEnemy): readonly SoulHarvesterCrystalOption[] {
  const options: SoulHarvesterCrystalOption[] = [];

  const resistances = enemy.definition.resistances;

  if (resistances.includes(RESIST_FIRE)) {
    options.push({ color: "red", reason: "Fire Resistance" });
  }
  if (resistances.includes(RESIST_ICE)) {
    options.push({ color: "blue", reason: "Ice Resistance" });
  }
  if (resistances.includes(RESIST_PHYSICAL)) {
    options.push({ color: "green", reason: "Physical Resistance" });
  }

  // White is always available
  options.push({ color: "white", reason: "Always available" });

  return options;
}

/**
 * Check if an enemy qualifies for Soul Harvester crystal reward.
 * Summoned enemies do not qualify (FAQ S1).
 */
function isEligibleForCrystal(enemy: CombatEnemy): boolean {
  // No crystal for summoned monsters
  if (enemy.summonedByInstanceId) {
    return false;
  }
  return true;
}

/**
 * Resolve Soul Harvester crystal tracking modifier after phase damage resolution.
 *
 * For each qualifying defeated enemy (up to the modifier's limit), if there's only
 * one crystal color option, it's gained immediately. If multiple options exist,
 * the first applicable color is auto-selected (white as fallback).
 *
 * Note: The current implementation auto-grants white crystal for simplicity.
 * A full implementation would queue a pending choice for the player to select
 * the crystal color when multiple options are available. For now, we grant
 * the "best" crystal (non-white if available, preferring the first resistance found).
 *
 * UPDATED: Grants the crystal immediately, choosing the first non-white option
 * if available (since the player almost always wants the colored crystal over white).
 * TODO: If player choice is needed, queue pendingChoice per the choice effect pattern.
 */
export function resolveSoulHarvesterCrystals(
  state: GameState,
  playerId: string,
  defeatedEnemies: readonly CombatEnemy[]
): SoulHarvesterResolutionResult {
  let didChange = false;
  let updatedState = state;

  // Find soul harvester modifiers for this player
  const updatedModifiers = state.activeModifiers.filter((mod) => {
    if (
      mod.effect.type !== EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING ||
      mod.createdByPlayerId !== playerId
    ) {
      return true; // Keep non-soul-harvester modifiers
    }

    const harvesterEffect = mod.effect as SoulHarvesterCrystalTrackingModifier;

    // Get eligible defeated enemies (non-summoned)
    const eligibleEnemies = defeatedEnemies.filter(isEligibleForCrystal);

    // Award crystals up to the limit
    const limit = harvesterEffect.limit;
    const enemiesToReward = eligibleEnemies.slice(0, limit);

    for (const enemy of enemiesToReward) {
      const options = getCrystalOptionsForEnemy(enemy);

      if (options.length > 0) {
        // Auto-select: prefer the first non-white option, fallback to white
        const nonWhite = options.find((o) => o.color !== "white");
        const chosen = nonWhite ?? options[0]!;

        const playerIndex = updatedState.players.findIndex((p) => p.id === playerId);
        if (playerIndex !== -1) {
          const player = updatedState.players[playerIndex]!;
          const { player: updatedPlayer } = gainCrystalWithOverflow(player, chosen.color);
          const updatedPlayers = [...updatedState.players];
          updatedPlayers[playerIndex] = updatedPlayer;
          updatedState = { ...updatedState, players: updatedPlayers };
        }
      }
    }

    // Always consume the modifier — it only applies to the current phase
    didChange = true;
    return false;
  });

  if (!didChange) {
    return { state, crystalChoices: [] };
  }

  return {
    state: { ...updatedState, activeModifiers: updatedModifiers },
    crystalChoices: [],
  };
}
