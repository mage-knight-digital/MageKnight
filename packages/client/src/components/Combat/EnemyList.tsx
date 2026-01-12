/**
 * EnemyList - Displays all enemies in combat
 */

import type {
  ClientCombatEnemy,
  CombatOptions,
  BlockOption,
  DamageAssignmentOption,
  AttackOption,
  AttackSource,
  CombatType,
} from "@mage-knight/shared";
import {
  DECLARE_BLOCK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  DECLARE_ATTACK_ACTION,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_RANGED_SIEGE,
  ELEMENT_PHYSICAL,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "@mage-knight/shared";
import { EnemyCard } from "./EnemyCard";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";

interface EnemyListProps {
  enemies: readonly ClientCombatEnemy[];
  combatOptions: CombatOptions;
}

export function EnemyList({ enemies, combatOptions }: EnemyListProps) {
  const { sendAction } = useGame();
  const player = useMyPlayer();

  // Determine which enemies are targetable based on the current phase
  const targetableIds = new Set<string>();

  if (combatOptions.attacks) {
    combatOptions.attacks
      .filter((a) => !a.isDefeated)
      .forEach((a) => targetableIds.add(a.enemyInstanceId));
  }

  if (combatOptions.blocks) {
    combatOptions.blocks
      .filter((b) => !b.isBlocked)
      .forEach((b) => targetableIds.add(b.enemyInstanceId));
  }

  if (combatOptions.damageAssignments) {
    combatOptions.damageAssignments.forEach((d) =>
      targetableIds.add(d.enemyInstanceId)
    );
  }

  // Create a map for block options lookup
  const blockOptionsMap = new Map<string, BlockOption>();
  if (combatOptions.blocks) {
    combatOptions.blocks.forEach((b) => blockOptionsMap.set(b.enemyInstanceId, b));
  }

  // Create a map for damage assignment options lookup
  const damageOptionsMap = new Map<string, DamageAssignmentOption>();
  if (combatOptions.damageAssignments) {
    combatOptions.damageAssignments.forEach((d) => damageOptionsMap.set(d.enemyInstanceId, d));
  }

  // Create a map for attack options lookup
  const attackOptionsMap = new Map<string, AttackOption>();
  if (combatOptions.attacks) {
    combatOptions.attacks.forEach((a) => attackOptionsMap.set(a.enemyInstanceId, a));
  }

  const isBlockPhase = combatOptions.phase === "block";
  const isDamagePhase = combatOptions.phase === COMBAT_PHASE_ASSIGN_DAMAGE;
  const isAttackPhase = combatOptions.phase === COMBAT_PHASE_ATTACK;
  const isRangedSiegePhase = combatOptions.phase === COMBAT_PHASE_RANGED_SIEGE;
  const accumulatedBlock = player?.combatAccumulator.block ?? 0;

  // Calculate accumulated attack based on phase
  const attackAcc = player?.combatAccumulator.attack;
  // Include elemental values in totals (elemental attacks are tracked separately)
  const totalRanged = attackAcc
    ? attackAcc.ranged + attackAcc.rangedElements.fire + attackAcc.rangedElements.ice
    : 0;
  const totalSiege = attackAcc
    ? attackAcc.siege + attackAcc.siegeElements.fire + attackAcc.siegeElements.ice
    : 0;
  const totalNormal = attackAcc
    ? attackAcc.normal + attackAcc.normalElements.fire + attackAcc.normalElements.ice + attackAcc.normalElements.coldFire + attackAcc.normalElements.physical
    : 0;
  // In ranged/siege phase, only ranged and siege attacks count
  // In attack phase (melee), all attack types count
  const accumulatedAttack = isRangedSiegePhase
    ? totalRanged + totalSiege
    : totalNormal + totalRanged + totalSiege;

  const handleAssignBlock = (enemyInstanceId: string) => {
    // Server reads block sources from player.combatAccumulator.blockSources
    sendAction({
      type: DECLARE_BLOCK_ACTION,
      targetEnemyInstanceId: enemyInstanceId,
    });
  };

  const handleAssignDamage = (enemyInstanceId: string) => {
    // Assign all damage to hero (no unit selection for now)
    sendAction({
      type: ASSIGN_DAMAGE_ACTION,
      enemyInstanceId,
    });
  };

  const handleAssignAttack = (enemyInstanceId: string, attackOption?: AttackOption) => {
    // Build attack sources from accumulated attack types
    const attacks: AttackSource[] = [];

    // In ranged/siege phase, only use ranged and siege attacks
    // In attack phase (melee), use all attack types
    if (isRangedSiegePhase) {
      // Add ranged attacks - elemental values are stored separately from physical
      if (attackAcc) {
        if (attackAcc.rangedElements.fire > 0) {
          attacks.push({ element: "fire", value: attackAcc.rangedElements.fire });
        }
        if (attackAcc.rangedElements.ice > 0) {
          attacks.push({ element: "ice", value: attackAcc.rangedElements.ice });
        }
        // Physical ranged is in attackAcc.ranged (not in rangedElements)
        if (attackAcc.ranged > 0) {
          attacks.push({ element: ELEMENT_PHYSICAL, value: attackAcc.ranged });
        }
      }

      // Add siege attacks - elemental values are stored separately from physical
      if (attackAcc) {
        if (attackAcc.siegeElements.fire > 0) {
          attacks.push({ element: "fire", value: attackAcc.siegeElements.fire });
        }
        if (attackAcc.siegeElements.ice > 0) {
          attacks.push({ element: "ice", value: attackAcc.siegeElements.ice });
        }
        // Physical siege is in attackAcc.siege (not in siegeElements)
        if (attackAcc.siege > 0) {
          attacks.push({ element: ELEMENT_PHYSICAL, value: attackAcc.siege });
        }
      }
    } else {
      // Attack phase (melee) - use all attack types with their elements
      if (attackAcc) {
        // Normal attacks
        if (attackAcc.normalElements.fire > 0) {
          attacks.push({ element: "fire", value: attackAcc.normalElements.fire });
        }
        if (attackAcc.normalElements.ice > 0) {
          attacks.push({ element: "ice", value: attackAcc.normalElements.ice });
        }
        if (attackAcc.normalElements.coldFire > 0) {
          attacks.push({ element: "cold_fire", value: attackAcc.normalElements.coldFire });
        }
        if (attackAcc.normalElements.physical > 0) {
          attacks.push({ element: ELEMENT_PHYSICAL, value: attackAcc.normalElements.physical });
        }
        if (attackAcc.normal > 0) {
          attacks.push({ element: ELEMENT_PHYSICAL, value: attackAcc.normal });
        }
        // Ranged attacks (also usable in melee phase)
        if (attackAcc.rangedElements.fire > 0) {
          attacks.push({ element: "fire", value: attackAcc.rangedElements.fire });
        }
        if (attackAcc.rangedElements.ice > 0) {
          attacks.push({ element: "ice", value: attackAcc.rangedElements.ice });
        }
        if (attackAcc.ranged > 0) {
          attacks.push({ element: ELEMENT_PHYSICAL, value: attackAcc.ranged });
        }
        // Siege attacks (also usable in melee phase)
        if (attackAcc.siegeElements.fire > 0) {
          attacks.push({ element: "fire", value: attackAcc.siegeElements.fire });
        }
        if (attackAcc.siegeElements.ice > 0) {
          attacks.push({ element: "ice", value: attackAcc.siegeElements.ice });
        }
        if (attackAcc.siege > 0) {
          attacks.push({ element: ELEMENT_PHYSICAL, value: attackAcc.siege });
        }
      }
    }

    // Determine attack type based on phase and whether enemy requires siege
    let attackType: CombatType = COMBAT_TYPE_MELEE;
    if (isRangedSiegePhase) {
      // If enemy requires siege (fortified), use siege. Otherwise use ranged.
      if (attackOption?.requiresSiege) {
        attackType = COMBAT_TYPE_SIEGE;
      } else {
        attackType = COMBAT_TYPE_RANGED;
      }
    }

    sendAction({
      type: DECLARE_ATTACK_ACTION,
      targetEnemyInstanceIds: [enemyInstanceId],
      attacks,
      attackType,
    });
  };

  return (
    <div className="enemy-list">
      <h3 className="enemy-list__title">Enemies</h3>
      <div className="enemy-list__grid">
        {enemies.map((enemy) => {
          const blockOption = blockOptionsMap.get(enemy.instanceId);
          const damageOption = damageOptionsMap.get(enemy.instanceId);
          const attackOption = attackOptionsMap.get(enemy.instanceId);
          return (
            <EnemyCard
              key={enemy.instanceId}
              enemy={enemy}
              isTargetable={targetableIds.has(enemy.instanceId)}
              isBlockPhase={isBlockPhase}
              blockOption={blockOption}
              accumulatedBlock={accumulatedBlock}
              onAssignBlock={handleAssignBlock}
              isDamagePhase={isDamagePhase}
              damageOption={damageOption}
              onAssignDamage={handleAssignDamage}
              isAttackPhase={isAttackPhase || isRangedSiegePhase}
              attackOption={attackOption}
              accumulatedAttack={accumulatedAttack}
              onAssignAttack={(enemyId) => handleAssignAttack(enemyId, attackOption)}
              isRangedSiegePhase={isRangedSiegePhase}
            />
          );
        })}
      </div>
    </div>
  );
}
