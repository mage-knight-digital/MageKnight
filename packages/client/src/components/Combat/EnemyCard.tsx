/**
 * EnemyCard - Displays a single enemy during combat
 */

import type { ClientCombatEnemy, BlockOption, DamageAssignmentOption, AttackOption } from "@mage-knight/shared";

const ELEMENT_ICONS: Record<string, string> = {
  physical: "",
  fire: "F",
  ice: "I",
  cold_fire: "CF",
};

const ABILITY_LABELS: Record<string, string> = {
  fortified: "Fort",
  swift: "Swift",
  brutal: "Brutal",
  poison: "Poison",
  paralyze: "Para",
  summon: "Summon",
  cumbersome: "Cumber",
  unfortified: "Unfort",
};

interface EnemyCardProps {
  enemy: ClientCombatEnemy;
  isTargetable?: boolean;
  onClick?: () => void;
  isBlockPhase?: boolean;
  blockOption?: BlockOption;
  accumulatedBlock?: number;
  onAssignBlock?: (enemyInstanceId: string) => void;
  isDamagePhase?: boolean;
  damageOption?: DamageAssignmentOption;
  onAssignDamage?: (enemyInstanceId: string) => void;
  isAttackPhase?: boolean;
  attackOption?: AttackOption;
  accumulatedAttack?: number;
  onAssignAttack?: (enemyInstanceId: string) => void;
  isRangedSiegePhase?: boolean;
}

export function EnemyCard({
  enemy,
  isTargetable,
  onClick,
  isBlockPhase,
  blockOption,
  accumulatedBlock = 0,
  onAssignBlock,
  isDamagePhase,
  damageOption,
  onAssignDamage,
  isAttackPhase,
  attackOption,
  accumulatedAttack = 0,
  onAssignAttack,
  isRangedSiegePhase = false,
}: EnemyCardProps) {
  const elementIcon = ELEMENT_ICONS[enemy.attackElement] || "";

  // Show assign block button when:
  // - In block phase
  // - Enemy is not defeated
  // - Enemy is not already blocked
  // - We have some accumulated block
  const showAssignBlock =
    isBlockPhase &&
    blockOption &&
    !enemy.isDefeated &&
    !enemy.isBlocked &&
    accumulatedBlock > 0;

  const canBlock = showAssignBlock && accumulatedBlock >= (blockOption?.requiredBlock ?? 0);

  const handleAssignBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAssignBlock) {
      onAssignBlock(enemy.instanceId);
    }
  };

  // Show assign damage button when:
  // - In damage phase
  // - Enemy has unassigned damage
  const showAssignDamage = isDamagePhase && damageOption && damageOption.unassignedDamage > 0;

  const handleAssignDamage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAssignDamage) {
      onAssignDamage(enemy.instanceId);
    }
  };

  // Show assign attack button when:
  // - In attack phase
  // - Enemy is not defeated
  // - We have some accumulated attack
  const showAssignAttack =
    isAttackPhase &&
    attackOption &&
    !enemy.isDefeated &&
    accumulatedAttack > 0;

  const canDefeat = showAssignAttack && accumulatedAttack >= (attackOption?.enemyArmor ?? 0);

  const handleAssignAttack = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAssignAttack) {
      onAssignAttack(enemy.instanceId);
    }
  };

  return (
    <div
      className={`enemy-card ${enemy.isDefeated ? "enemy-card--defeated" : ""} ${enemy.isBlocked ? "enemy-card--blocked" : ""} ${isTargetable ? "enemy-card--targetable" : ""}`}
      onClick={isTargetable ? onClick : undefined}
      data-testid={`enemy-card-${enemy.instanceId}`}
    >
      <div className="enemy-card__header">
        <span className="enemy-card__name">{enemy.name}</span>
        {enemy.isDefeated && <span className="enemy-card__status">Defeated</span>}
        {enemy.isBlocked && !enemy.isDefeated && (
          <span
            className="enemy-card__status enemy-card__status--blocked"
            data-testid={`enemy-${enemy.instanceId}-status`}
          >
            Blocked
          </span>
        )}
      </div>

      <div className="enemy-card__stats">
        <div className="enemy-card__stat">
          <span className="enemy-card__stat-icon">A</span>
          <span className="enemy-card__stat-value">
            {enemy.attack}
            {elementIcon && <span className="enemy-card__element">{elementIcon}</span>}
          </span>
        </div>
        <div className="enemy-card__stat">
          <span className="enemy-card__stat-icon">D</span>
          <span className="enemy-card__stat-value">{enemy.armor}</span>
        </div>
        <div className="enemy-card__stat">
          <span className="enemy-card__stat-icon">F</span>
          <span className="enemy-card__stat-value">{enemy.fame}</span>
        </div>
      </div>

      {enemy.abilities.length > 0 && (
        <div className="enemy-card__abilities">
          {enemy.abilities.map((ability) => (
            <span key={ability} className={`enemy-card__ability enemy-card__ability--${ability}`}>
              {ABILITY_LABELS[ability] || ability}
            </span>
          ))}
        </div>
      )}

      {/* Show resistances if any */}
      {(enemy.resistances.physical || enemy.resistances.fire || enemy.resistances.ice) && (
        <div className="enemy-card__resistances">
          {enemy.resistances.physical && <span className="enemy-card__resistance">Phys</span>}
          {enemy.resistances.fire && <span className="enemy-card__resistance enemy-card__resistance--fire">Fire</span>}
          {enemy.resistances.ice && <span className="enemy-card__resistance enemy-card__resistance--ice">Ice</span>}
        </div>
      )}

      {/* Assign Block button during block phase */}
      {showAssignBlock && blockOption && (
        <button
          className={`enemy-card__assign-block ${canBlock ? "enemy-card__assign-block--can-block" : "enemy-card__assign-block--insufficient"}`}
          data-testid={`assign-block-${enemy.instanceId}`}
          onClick={handleAssignBlock}
          disabled={!canBlock}
        >
          Assign Block ({accumulatedBlock} → {blockOption.requiredBlock})
        </button>
      )}

      {/* Assign Damage button during damage phase */}
      {showAssignDamage && damageOption && (
        <button
          className="enemy-card__assign-damage"
          data-testid={`assign-damage-${enemy.instanceId}`}
          onClick={handleAssignDamage}
        >
          Take {damageOption.unassignedDamage} Damage
        </button>
      )}

      {/* Assign Attack button during attack or ranged/siege phase */}
      {showAssignAttack && attackOption && (
        <button
          className={`enemy-card__assign-attack ${canDefeat ? "enemy-card__assign-attack--can-defeat" : "enemy-card__assign-attack--insufficient"}`}
          data-testid={`assign-attack-${enemy.instanceId}`}
          onClick={handleAssignAttack}
          disabled={!canDefeat}
        >
          {isRangedSiegePhase ? (
            attackOption.requiresSiege
              ? `Siege Attack (${accumulatedAttack} → ${attackOption.enemyArmor})`
              : `Ranged Attack (${accumulatedAttack} → ${attackOption.enemyArmor})`
          ) : (
            `Attack (${accumulatedAttack} → ${attackOption.enemyArmor})`
          )}
        </button>
      )}
      {/* Show warning if enemy requires siege but we don't have siege attacks */}
      {isRangedSiegePhase && attackOption?.requiresSiege && accumulatedAttack > 0 && !canDefeat && (
        <div className="enemy-card__siege-warning">
          Fortified - requires Siege attack
        </div>
      )}
    </div>
  );
}
