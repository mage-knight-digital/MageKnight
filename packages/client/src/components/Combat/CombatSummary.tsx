/**
 * CombatSummary - Shows combat summary based on the current phase
 */

import type { ClientCombatEnemy, CombatOptions } from "@mage-knight/shared";
import { useMyPlayer } from "../../hooks/useMyPlayer";

interface CombatSummaryProps {
  phase: string;
  enemies: readonly ClientCombatEnemy[];
  combatOptions: CombatOptions;
  woundsThisCombat: number;
  fameGained: number;
}

export function CombatSummary({
  phase,
  enemies,
  combatOptions,
  woundsThisCombat,
  fameGained,
}: CombatSummaryProps) {
  const player = useMyPlayer();
  const aliveEnemies = enemies.filter((e) => !e.isDefeated);
  const defeatedCount = enemies.length - aliveEnemies.length;

  // Calculate total enemy attack for block phase
  const totalEnemyAttack = aliveEnemies
    .filter((e) => !e.isBlocked)
    .reduce((sum, e) => sum + e.attack, 0);

  // Calculate blocked amount
  const blockedEnemies = aliveEnemies.filter((e) => e.isBlocked);

  // Get accumulated block from player (for block phase display)
  const accumulatedBlock = player?.combatAccumulator.block ?? 0;

  return (
    <div className="combat-summary">
      {phase === "block" && (
        <div className="combat-summary__block">
          <div className="combat-summary__stat">
            <span className="combat-summary__label">Enemy Attack</span>
            <span className="combat-summary__value combat-summary__value--danger">
              {totalEnemyAttack}
            </span>
          </div>
          <div className="combat-summary__stat">
            <span className="combat-summary__label">Your Block</span>
            <span
              className={`combat-summary__value ${accumulatedBlock > 0 ? "combat-summary__value--success" : ""}`}
              data-testid="accumulated-block"
            >
              {accumulatedBlock}
            </span>
          </div>
          <div className="combat-summary__stat">
            <span className="combat-summary__label">Blocked</span>
            <span className="combat-summary__value combat-summary__value--success">
              {blockedEnemies.length} of {aliveEnemies.length}
            </span>
          </div>
        </div>
      )}

      {phase === "assign_damage" && combatOptions.damageAssignments && (
        <div className="combat-summary__damage">
          <div className="combat-summary__stat">
            <span className="combat-summary__label">Damage to Assign</span>
            <span className="combat-summary__value combat-summary__value--danger">
              {combatOptions.damageAssignments.reduce(
                (sum, d) => sum + d.unassignedDamage,
                0
              )}
            </span>
          </div>
        </div>
      )}

      {(phase === "ranged_siege" || phase === "attack") && (
        <div className="combat-summary__attack">
          <div className="combat-summary__stat">
            <span className="combat-summary__label">Enemies Remaining</span>
            <span className="combat-summary__value">{aliveEnemies.length}</span>
          </div>
          <div className="combat-summary__stat">
            <span className="combat-summary__label">Total Armor</span>
            <span className="combat-summary__value">
              {aliveEnemies.reduce((sum, e) => sum + e.armor, 0)}
            </span>
          </div>
        </div>
      )}

      <div className="combat-summary__totals">
        <div className="combat-summary__stat">
          <span className="combat-summary__label">Fame Gained</span>
          <span className="combat-summary__value combat-summary__value--fame">
            +{fameGained}
          </span>
        </div>
        <div className="combat-summary__stat">
          <span className="combat-summary__label">Wounds</span>
          <span
            className={`combat-summary__value ${woundsThisCombat > 0 ? "combat-summary__value--danger" : ""}`}
          >
            {woundsThisCombat}
          </span>
        </div>
        <div className="combat-summary__stat">
          <span className="combat-summary__label">Defeated</span>
          <span className="combat-summary__value combat-summary__value--success">
            {defeatedCount}
          </span>
        </div>
      </div>
    </div>
  );
}
