/**
 * DamageAssignmentPanel - Modal for assigning enemy damage to units/hero
 *
 * Accepts Rust LegalActions directly:
 * - heroAction: AssignDamageToHero action
 * - unitActions: AssignDamageToUnit actions (one per eligible unit)
 *
 * The player picks "Take to Hero" or selects a unit. Each sends the
 * corresponding legal action directly — the Rust engine handles all
 * absorption math.
 */

import { createPortal } from "react-dom";
import type { ClientCombatState } from "@mage-knight/shared";
import type { LegalAction } from "../../rust/types";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import "./DamageAssignmentPanel.css";

interface DamageAssignmentPanelProps {
  enemyIndex: number;
  attackIndex: number;
  enemyName: string;
  heroAction: LegalAction;
  unitActions: { unitInstanceId: string; action: LegalAction }[];
  onSendAction: (action: LegalAction) => void;
  onCancel: () => void;
  combat: ClientCombatState;
}

export function DamageAssignmentPanel({
  enemyName,
  heroAction,
  unitActions,
  onSendAction,
  onCancel,
  combat,
}: DamageAssignmentPanelProps) {
  const player = useMyPlayer();

  // Look up unit info from player state
  const unitInfo = unitActions.map(({ unitInstanceId, action }) => {
    const unit = player?.units.find(u => u.instanceId === unitInstanceId);
    return {
      unitInstanceId,
      unitName: unit?.unitId ?? unitInstanceId,
      isWounded: unit?.wounded ?? false,
      action,
    };
  });

  return createPortal(
    <div className="damage-assignment-panel" data-testid="damage-assignment-panel">
      <div className="damage-assignment-panel__backdrop" onClick={onCancel} />

      <div className="damage-assignment-panel__content">
        {/* Header */}
        <div className="damage-assignment-panel__header">
          <h3 className="damage-assignment-panel__title">Assign Damage</h3>
          <div className="damage-assignment-panel__enemy-info">
            <span className="damage-assignment-panel__enemy-name">
              {enemyName}
            </span>
          </div>
          <div className="damage-assignment-panel__damage-total">
            <span className="damage-assignment-panel__damage-label">
              Wounds this combat: {combat.woundsThisCombat}
            </span>
          </div>
        </div>

        {/* Unit selection */}
        {unitInfo.length > 0 && (
          <div className="damage-assignment-panel__units-section">
            <div className="damage-assignment-panel__section-header">
              <span className="damage-assignment-panel__section-title">
                Assign to Unit
              </span>
              <span className="damage-assignment-panel__section-hint">
                Units absorb damage before your hero
              </span>
            </div>

            <div className="damage-assignment-panel__unit-buttons">
              {unitInfo.map((unit) => (
                <button
                  key={unit.unitInstanceId}
                  type="button"
                  className="damage-assignment-panel__add-unit-btn"
                  onClick={() => onSendAction(unit.action)}
                  data-testid={`assign-unit-${unit.unitInstanceId}`}
                >
                  <span className="damage-assignment-panel__add-unit-name">
                    {unit.unitName}
                  </span>
                  {unit.isWounded && (
                    <span className="damage-assignment-panel__add-unit-stats">
                      (Wounded)
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hero damage */}
        <div className="damage-assignment-panel__hero-section">
          <div className="damage-assignment-panel__hero-header">
            <span className="damage-assignment-panel__hero-title">Hero Damage</span>
          </div>
          <div className="damage-assignment-panel__hero-breakdown">
            <div className="damage-assignment-panel__hero-stat">
              <span className="damage-assignment-panel__hero-label">
                Hero armor:
              </span>
              <span className="damage-assignment-panel__hero-value">
                {player?.armor ?? 2}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="damage-assignment-panel__actions">
          <button
            type="button"
            className="damage-assignment-panel__cancel-btn"
            onClick={onCancel}
            data-testid="damage-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            className="damage-assignment-panel__take-all-btn"
            onClick={() => onSendAction(heroAction)}
            data-testid="damage-take-all-btn"
          >
            Take Damage to Hero
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
