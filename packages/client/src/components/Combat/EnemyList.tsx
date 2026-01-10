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
} from "@mage-knight/shared";
import {
  DECLARE_BLOCK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  DECLARE_ATTACK_ACTION,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
  ELEMENT_PHYSICAL,
  COMBAT_TYPE_MELEE,
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
  const accumulatedBlock = player?.combatAccumulator.block ?? 0;

  // In attack phase, all attack types (melee, ranged, siege) count equally
  const attackAcc = player?.combatAccumulator.attack;
  const accumulatedAttack = attackAcc
    ? (attackAcc.normal + attackAcc.ranged + attackAcc.siege)
    : 0;

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

  const handleAssignAttack = (enemyInstanceId: string) => {
    // Build attack sources from all accumulated attack types
    // In attack phase, melee/ranged/siege are all treated the same
    const attacks: AttackSource[] = [];

    // Add melee attacks (normal)
    if (attackAcc && attackAcc.normal > 0) {
      attacks.push({
        element: ELEMENT_PHYSICAL,
        value: attackAcc.normal,
      });
    }

    // Add ranged attacks
    if (attackAcc && attackAcc.ranged > 0) {
      attacks.push({
        element: ELEMENT_PHYSICAL,
        value: attackAcc.ranged,
      });
    }

    // Add siege attacks
    if (attackAcc && attackAcc.siege > 0) {
      attacks.push({
        element: ELEMENT_PHYSICAL,
        value: attackAcc.siege,
      });
    }

    sendAction({
      type: DECLARE_ATTACK_ACTION,
      targetEnemyInstanceIds: [enemyInstanceId],
      attacks,
      attackType: COMBAT_TYPE_MELEE, // In attack phase, type doesn't matter
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
              isAttackPhase={isAttackPhase}
              attackOption={attackOption}
              accumulatedAttack={accumulatedAttack}
              onAssignAttack={handleAssignAttack}
            />
          );
        })}
      </div>
    </div>
  );
}
