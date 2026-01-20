/**
 * EnemyDetailPanel - Full rulebook details for an enemy
 *
 * Shows when player clicks an enemy token during combat.
 * Displays actual rulebook text for abilities and resistances.
 */

import { createPortal } from "react-dom";
import type { ClientCombatEnemy, EnemyAbilityType } from "@mage-knight/shared";
import { ABILITY_DESCRIPTIONS, RESISTANCE_DESCRIPTIONS } from "@mage-knight/shared";
import type { ResistanceType } from "@mage-knight/shared";
import "./EnemyDetailPanel.css";

// Element display info
interface ElementInfoEntry {
  name: string;
  icon: string;
  blockTip: string;
}

const ELEMENT_INFO: Record<string, ElementInfoEntry> = {
  physical: {
    name: "Physical",
    icon: "⚔️",
    blockTip: "Any Block type is fully efficient.",
  },
  fire: {
    name: "Fire",
    icon: "🔥",
    blockTip: "Ice or ColdFire Block is fully efficient. Other Block types are halved.",
  },
  ice: {
    name: "Ice",
    icon: "❄️",
    blockTip: "Fire or ColdFire Block is fully efficient. Other Block types are halved.",
  },
  cold_fire: {
    name: "ColdFire",
    icon: "💜",
    blockTip: "Only ColdFire Block is fully efficient. All other Block types are halved.",
  },
};

const DEFAULT_ELEMENT_INFO: ElementInfoEntry = {
  name: "Physical",
  icon: "⚔️",
  blockTip: "Any Block type is fully efficient.",
};

interface EnemyDetailPanelProps {
  enemy: ClientCombatEnemy;
  onClose: () => void;
}

export function EnemyDetailPanel({ enemy, onClose }: EnemyDetailPanelProps) {
  const elementInfo = ELEMENT_INFO[enemy.attackElement] ?? DEFAULT_ELEMENT_INFO;
  const hasResistances = enemy.resistances.physical || enemy.resistances.fire || enemy.resistances.ice;

  // Get list of active resistances
  const activeResistances: ResistanceType[] = [];
  if (enemy.resistances.physical) activeResistances.push("physical");
  if (enemy.resistances.fire) activeResistances.push("fire");
  if (enemy.resistances.ice) activeResistances.push("ice");

  return createPortal(
    <div className="enemy-detail-backdrop" onClick={onClose}>
      <div className="enemy-detail-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="enemy-detail-header">
          <h2 className="enemy-detail-name">{enemy.name}</h2>
          <button className="enemy-detail-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {/* Stats */}
        <div className="enemy-detail-stats">
          <div className="enemy-detail-stat">
            <span className="enemy-detail-stat-label">Attack</span>
            <span className="enemy-detail-stat-value">
              {elementInfo.icon} {enemy.attack}
              {enemy.attackElement !== "physical" && (
                <span className="enemy-detail-stat-element">{elementInfo.name}</span>
              )}
            </span>
          </div>
          <div className="enemy-detail-stat">
            <span className="enemy-detail-stat-label">Armor</span>
            <span className="enemy-detail-stat-value">🛡️ {enemy.armor}</span>
          </div>
          <div className="enemy-detail-stat">
            <span className="enemy-detail-stat-label">Fame</span>
            <span className="enemy-detail-stat-value">⭐ {enemy.fame}</span>
          </div>
        </div>

        {/* Attack Element Info */}
        {enemy.attackElement !== "physical" && (
          <div className="enemy-detail-section">
            <h3 className="enemy-detail-section-title">
              {elementInfo.icon} {elementInfo.name} Attack
            </h3>
            <p className="enemy-detail-rule">{elementInfo.blockTip}</p>
          </div>
        )}

        {/* Abilities */}
        {enemy.abilities.length > 0 && (
          <div className="enemy-detail-section">
            <h3 className="enemy-detail-section-title">Special Abilities</h3>
            {enemy.abilities.map((ability) => {
              const desc = ABILITY_DESCRIPTIONS[ability as EnemyAbilityType];
              if (!desc) return null;
              return (
                <div key={ability} className="enemy-detail-ability">
                  <div className="enemy-detail-ability-header">
                    <span className="enemy-detail-ability-icon">{desc.icon}</span>
                    <span className="enemy-detail-ability-name">{desc.name}</span>
                  </div>
                  <p className="enemy-detail-rule">{desc.fullDesc}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Resistances */}
        {hasResistances && (
          <div className="enemy-detail-section">
            <h3 className="enemy-detail-section-title">Resistances</h3>
            {activeResistances.map((resistance) => {
              const desc = RESISTANCE_DESCRIPTIONS[resistance];
              return (
                <div key={resistance} className="enemy-detail-resistance">
                  <div className="enemy-detail-resistance-header">
                    <span className="enemy-detail-resistance-icon">{desc.icon}</span>
                    <span className="enemy-detail-resistance-name">{desc.name}</span>
                  </div>
                  <p className="enemy-detail-rule">{desc.fullDesc}</p>
                  <p className="enemy-detail-tip">💡 {desc.counter}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* No special traits */}
        {enemy.abilities.length === 0 && !hasResistances && enemy.attackElement === "physical" && (
          <div className="enemy-detail-section">
            <p className="enemy-detail-note">
              This enemy has no special abilities or resistances.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
