/**
 * Attack-based fame tracking helpers
 *
 * Tracks attack contributions for effects like Axe Throw that grant fame
 * if at least one enemy is defeated by the tracked attack.
 */

import type { TrackAttackDefeatFameEffect } from "../../types/cards.js";
import type { AttackDefeatFameTracker } from "../../types/player.js";
import type { AttackElement, AttackType, CardId, CombatType, Element } from "@mage-knight/shared";
import {
  ATTACK_ELEMENT_COLD_FIRE,
  ATTACK_ELEMENT_FIRE,
  ATTACK_ELEMENT_ICE,
  ATTACK_ELEMENT_PHYSICAL,
  ATTACK_TYPE_MELEE,
  ATTACK_TYPE_RANGED,
  ATTACK_TYPE_SIEGE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  ELEMENT_COLD_FIRE,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_PHYSICAL,
} from "@mage-knight/shared";

export interface AttackFameAssignmentParams {
  readonly enemyInstanceId: string;
  readonly attackType: AttackType;
  readonly element: AttackElement;
  readonly amount: number;
}

export function toAttackType(combatType: CombatType): AttackType {
  switch (combatType) {
    case COMBAT_TYPE_RANGED:
      return ATTACK_TYPE_RANGED;
    case COMBAT_TYPE_SIEGE:
      return ATTACK_TYPE_SIEGE;
    default:
      return ATTACK_TYPE_MELEE;
  }
}

export function toAttackElement(element: Element | undefined): AttackElement {
  switch (element) {
    case ELEMENT_FIRE:
      return ATTACK_ELEMENT_FIRE;
    case ELEMENT_ICE:
      return ATTACK_ELEMENT_ICE;
    case ELEMENT_COLD_FIRE:
      return ATTACK_ELEMENT_COLD_FIRE;
    case ELEMENT_PHYSICAL:
    default:
      return ATTACK_ELEMENT_PHYSICAL;
  }
}

export function createAttackDefeatFameTracker(
  effect: TrackAttackDefeatFameEffect,
  sourceCardId: CardId | null
): AttackDefeatFameTracker {
  return {
    sourceCardId,
    attackType: toAttackType(effect.combatType),
    element: toAttackElement(effect.element),
    amount: effect.amount,
    remaining: effect.amount,
    assignedByEnemy: {},
    fame: effect.fame,
  };
}

function matchesTracker(
  tracker: AttackDefeatFameTracker,
  attackType: AttackType,
  element: AttackElement
): boolean {
  return tracker.attackType === attackType && tracker.element === element;
}

export function assignAttackToFameTrackers(
  trackers: readonly AttackDefeatFameTracker[],
  params: AttackFameAssignmentParams
): readonly AttackDefeatFameTracker[] {
  if (trackers.length === 0 || params.amount <= 0) {
    return trackers;
  }

  let remaining = params.amount;
  let didChange = false;

  const updated = trackers.map((tracker) => {
    if (remaining <= 0) {
      return tracker;
    }
    if (!matchesTracker(tracker, params.attackType, params.element)) {
      return tracker;
    }
    if (tracker.remaining <= 0) {
      return tracker;
    }

    const assigned = Math.min(tracker.remaining, remaining);
    if (assigned <= 0) {
      return tracker;
    }

    remaining -= assigned;
    didChange = true;

    const currentAssigned = tracker.assignedByEnemy[params.enemyInstanceId] ?? 0;
    return {
      ...tracker,
      remaining: tracker.remaining - assigned,
      assignedByEnemy: {
        ...tracker.assignedByEnemy,
        [params.enemyInstanceId]: currentAssigned + assigned,
      },
    };
  });

  return didChange ? updated : trackers;
}

export function unassignAttackFromFameTrackers(
  trackers: readonly AttackDefeatFameTracker[],
  params: AttackFameAssignmentParams
): readonly AttackDefeatFameTracker[] {
  if (trackers.length === 0 || params.amount <= 0) {
    return trackers;
  }

  let remaining = params.amount;
  let didChange = false;

  const updated = [...trackers];

  for (let i = updated.length - 1; i >= 0 && remaining > 0; i--) {
    const tracker = updated[i];
    if (!tracker) continue;
    if (!matchesTracker(tracker, params.attackType, params.element)) {
      continue;
    }

    const assigned = tracker.assignedByEnemy[params.enemyInstanceId] ?? 0;
    if (assigned <= 0) {
      continue;
    }

    const toRemove = Math.min(assigned, remaining);
    remaining -= toRemove;
    didChange = true;

    const newAssignedByEnemy = { ...tracker.assignedByEnemy };
    const remainingAssigned = assigned - toRemove;
    const trimmedAssignedByEnemy =
      remainingAssigned > 0
        ? { ...newAssignedByEnemy, [params.enemyInstanceId]: remainingAssigned }
        : (() => {
            const { [params.enemyInstanceId]: _removed, ...rest } = newAssignedByEnemy;
            void _removed;
            return rest;
          })();

    updated[i] = {
      ...tracker,
      remaining: tracker.remaining + toRemove,
      assignedByEnemy: trimmedAssignedByEnemy,
    };
  }

  return didChange ? updated : trackers;
}

export interface ResolveAttackDefeatFameResult {
  readonly updatedTrackers: readonly AttackDefeatFameTracker[];
  readonly fameToGain: number;
  readonly reputationToGain: number;
  /**
   * Number of armor reductions to apply to surviving enemies (Explosive Bolt).
   * Each unit represents -1 armor to apply to one enemy (player distributes).
   */
  readonly armorReductionsToApply: number;
}

export function resolveAttackDefeatFameTrackers(
  trackers: readonly AttackDefeatFameTracker[],
  defeatedEnemyIds: readonly string[]
): ResolveAttackDefeatFameResult {
  if (trackers.length === 0) {
    return { updatedTrackers: trackers, fameToGain: 0, reputationToGain: 0, armorReductionsToApply: 0 };
  }

  const defeated = new Set(defeatedEnemyIds);
  let fameToGain = 0;
  let reputationToGain = 0;
  let armorReductionsToApply = 0;
  let didChange = false;
  const updatedTrackers: AttackDefeatFameTracker[] = [];

  for (const tracker of trackers) {
    const assignedEnemies = Object.keys(tracker.assignedByEnemy);
    const defeatedByTrackerIds = assignedEnemies.filter(
      (enemyId) => defeated.has(enemyId) && (tracker.assignedByEnemy[enemyId] ?? 0) > 0
    );

    if (defeatedByTrackerIds.length > 0) {
      // Flat fame bonus (Axe Throw style: fame if ANY enemy defeated)
      fameToGain += tracker.fame;

      // Per-enemy bonuses (Chivalry style: bonuses per enemy defeated)
      if (tracker.reputationPerDefeat) {
        reputationToGain += tracker.reputationPerDefeat * defeatedByTrackerIds.length;
      }
      if (tracker.famePerDefeat) {
        fameToGain += tracker.famePerDefeat * defeatedByTrackerIds.length;
      }

      // Armor reduction per defeated enemy (Explosive Bolt)
      if (tracker.armorReductionPerDefeat) {
        armorReductionsToApply += tracker.armorReductionPerDefeat * defeatedByTrackerIds.length;
      }

      didChange = true;
      continue; // Tracker consumed after triggering
    }

    if (tracker.remaining <= 0) {
      didChange = true;
      continue; // No remaining attack to track
    }

    const clearedAssigned = assignedEnemies.length > 0
      ? { ...tracker, assignedByEnemy: {} }
      : tracker;
    if (assignedEnemies.length > 0) {
      didChange = true;
    }

    updatedTrackers.push(clearedAssigned);
  }

  return {
    updatedTrackers: didChange ? updatedTrackers : trackers,
    fameToGain,
    reputationToGain,
    armorReductionsToApply,
  };
}
