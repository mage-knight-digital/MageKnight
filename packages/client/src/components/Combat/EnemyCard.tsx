/**
 * EnemyCard - Displays a single enemy during combat
 */

import type { ClientCombatEnemy } from "@mage-knight/shared";

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
}

export function EnemyCard({ enemy, isTargetable, onClick }: EnemyCardProps) {
  const elementIcon = ELEMENT_ICONS[enemy.attackElement] || "";

  return (
    <div
      className={`enemy-card ${enemy.isDefeated ? "enemy-card--defeated" : ""} ${enemy.isBlocked ? "enemy-card--blocked" : ""} ${isTargetable ? "enemy-card--targetable" : ""}`}
      onClick={isTargetable ? onClick : undefined}
    >
      <div className="enemy-card__header">
        <span className="enemy-card__name">{enemy.name}</span>
        {enemy.isDefeated && <span className="enemy-card__status">Defeated</span>}
        {enemy.isBlocked && !enemy.isDefeated && <span className="enemy-card__status enemy-card__status--blocked">Blocked</span>}
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
    </div>
  );
}
