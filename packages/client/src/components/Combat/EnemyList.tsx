/**
 * EnemyList - Displays all enemies in combat
 */

import type { ClientCombatEnemy, CombatOptions } from "@mage-knight/shared";
import { EnemyCard } from "./EnemyCard";

interface EnemyListProps {
  enemies: readonly ClientCombatEnemy[];
  combatOptions: CombatOptions;
}

export function EnemyList({ enemies, combatOptions }: EnemyListProps) {
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

  return (
    <div className="enemy-list">
      <h3 className="enemy-list__title">Enemies</h3>
      <div className="enemy-list__grid">
        {enemies.map((enemy) => (
          <EnemyCard
            key={enemy.instanceId}
            enemy={enemy}
            isTargetable={targetableIds.has(enemy.instanceId)}
          />
        ))}
      </div>
    </div>
  );
}
