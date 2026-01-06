/**
 * EnemyList - Displays all enemies in combat
 */

import type {
  ClientCombatEnemy,
  CombatOptions,
  BlockOption,
} from "@mage-knight/shared";
import { DECLARE_BLOCK_ACTION } from "@mage-knight/shared";
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

  const isBlockPhase = combatOptions.phase === "block";
  const accumulatedBlock = player?.combatAccumulator.block ?? 0;

  const handleAssignBlock = (enemyInstanceId: string) => {
    // Server reads block sources from player.combatAccumulator.blockSources
    sendAction({
      type: DECLARE_BLOCK_ACTION,
      targetEnemyInstanceId: enemyInstanceId,
    });
  };

  return (
    <div className="enemy-list">
      <h3 className="enemy-list__title">Enemies</h3>
      <div className="enemy-list__grid">
        {enemies.map((enemy) => {
          const blockOption = blockOptionsMap.get(enemy.instanceId);
          return (
            <EnemyCard
              key={enemy.instanceId}
              enemy={enemy}
              isTargetable={targetableIds.has(enemy.instanceId)}
              isBlockPhase={isBlockPhase}
              blockOption={blockOption}
              accumulatedBlock={accumulatedBlock}
              onAssignBlock={handleAssignBlock}
            />
          );
        })}
      </div>
    </div>
  );
}
