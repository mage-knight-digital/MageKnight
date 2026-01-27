/**
 * DamageAssignmentPanel - Modal for assigning enemy damage to units/hero
 *
 * Displays during ASSIGN_DAMAGE phase to let players:
 * 1. See enemy attack details (damage, element, Brutal)
 * 2. Select units to absorb damage first
 * 3. Preview damage absorption math (including resistance)
 * 4. See remaining damage going to hero (wound count)
 * 5. Confirm the assignment
 *
 * Rules reference:
 * - Units can absorb damage based on armor value
 * - Resistant units can absorb damage without being wounded if damage <= armor
 * - Once a unit absorbs damage (wounded or not), it can't absorb again this combat
 * - Remaining damage after all unit assignments goes to hero
 */

import { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import type {
  DamageAssignmentOption,
  UnitDamageTarget,
  DamageAssignment,
  Element,
} from "@mage-knight/shared";
import {
  DAMAGE_TARGET_HERO,
  DAMAGE_TARGET_UNIT,
} from "@mage-knight/shared";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import "./DamageAssignmentPanel.css";

// Element display info
const ELEMENT_DISPLAY: Record<Element, { icon: string; name: string; color: string }> = {
  physical: { icon: "\u2694\uFE0F", name: "Physical", color: "#a0a5aa" },
  fire: { icon: "\uD83D\uDD25", name: "Fire", color: "#c06040" },
  ice: { icon: "\u2744\uFE0F", name: "Ice", color: "#6090b0" },
  cold_fire: { icon: "\uD83D\uDC9C", name: "Cold Fire", color: "#8a6aaa" },
};

interface UnitAssignment {
  unitInstanceId: string;
  damageAssigned: number;
}

interface DamageAssignmentPanelProps {
  /** Damage assignment info from validActions */
  damageOption: DamageAssignmentOption;
  /** Callback when assignment is confirmed */
  onAssign: (enemyInstanceId: string, assignments: readonly DamageAssignment[]) => void;
  /** Callback to close panel without assigning */
  onCancel: () => void;
  /** Player's hand limit for knockout warning */
  handLimit: number;
  /** Wounds already taken this combat */
  woundsThisCombat: number;
}

/**
 * Calculate damage absorption for a unit
 * Returns: { damageAbsorbed, wouldWound, remainingDamage }
 */
function calculateUnitAbsorption(
  unit: UnitDamageTarget,
  damageToAssign: number
): { damageAbsorbed: number; wouldWound: boolean; remainingDamage: number } {
  const { armor, isResistantToAttack } = unit;

  if (isResistantToAttack) {
    // Resistant unit: first reduce by armor without wounding
    const firstReduction = Math.min(damageToAssign, armor);
    const afterFirstReduction = damageToAssign - firstReduction;

    if (afterFirstReduction <= 0) {
      // All damage absorbed via resistance (no wound)
      return {
        damageAbsorbed: damageToAssign,
        wouldWound: false,
        remainingDamage: 0,
      };
    } else {
      // Damage remains: wound and apply armor again
      const secondReduction = Math.min(afterFirstReduction, armor);
      const remaining = afterFirstReduction - secondReduction;
      return {
        damageAbsorbed: firstReduction + secondReduction,
        wouldWound: true,
        remainingDamage: remaining,
      };
    }
  } else {
    // Non-resistant: absorb up to armor, always wound
    const absorbed = Math.min(damageToAssign, armor);
    return {
      damageAbsorbed: absorbed,
      wouldWound: true,
      remainingDamage: damageToAssign - absorbed,
    };
  }
}

export function DamageAssignmentPanel({
  damageOption,
  onAssign,
  onCancel,
  handLimit,
  woundsThisCombat,
}: DamageAssignmentPanelProps) {
  const player = useMyPlayer();

  // Track which units have been assigned damage (in order)
  const [unitAssignments, setUnitAssignments] = useState<UnitAssignment[]>([]);

  const { attackElement, totalDamage, isBrutal, rawAttackValue, availableUnits } = damageOption;

  // Get element display info
  const elementInfo = ELEMENT_DISPLAY[attackElement];

  // Calculate running damage after unit assignments
  const damageBreakdown = useMemo(() => {
    let remainingDamage = totalDamage;
    const breakdown: {
      unitInstanceId: string;
      unitName: string;
      armor: number;
      isResistant: boolean;
      damageAbsorbed: number;
      wouldWound: boolean;
    }[] = [];

    for (const assignment of unitAssignments) {
      const unit = availableUnits.find((u) => u.unitInstanceId === assignment.unitInstanceId);
      if (!unit) continue;

      const result = calculateUnitAbsorption(unit, remainingDamage);
      breakdown.push({
        unitInstanceId: unit.unitInstanceId,
        unitName: unit.unitName,
        armor: unit.armor,
        isResistant: unit.isResistantToAttack,
        damageAbsorbed: result.damageAbsorbed,
        wouldWound: result.wouldWound,
      });
      remainingDamage = result.remainingDamage;
    }

    // Calculate hero wounds from remaining damage
    const heroArmor = player?.armor ?? 2;
    const heroWounds = remainingDamage > 0 ? Math.ceil(remainingDamage / heroArmor) : 0;

    // Check for knockout
    const totalWoundsAfter = woundsThisCombat + heroWounds;
    const wouldKnockout = totalWoundsAfter >= handLimit;

    return {
      unitBreakdown: breakdown,
      remainingToHero: remainingDamage,
      heroWounds,
      totalWoundsAfter,
      wouldKnockout,
    };
  }, [unitAssignments, totalDamage, availableUnits, player?.armor, woundsThisCombat, handLimit]);

  // Get available units (not already assigned, can be assigned)
  const selectableUnits = useMemo(() => {
    const assignedIds = new Set(unitAssignments.map((a) => a.unitInstanceId));
    return availableUnits.filter(
      (u) => u.canBeAssigned && !assignedIds.has(u.unitInstanceId)
    );
  }, [availableUnits, unitAssignments]);

  // Add unit to assignment queue
  const addUnit = useCallback((unitInstanceId: string) => {
    setUnitAssignments((prev) => [...prev, { unitInstanceId, damageAssigned: 0 }]);
  }, []);

  // Remove unit from assignment queue
  const removeUnit = useCallback((unitInstanceId: string) => {
    setUnitAssignments((prev) => prev.filter((a) => a.unitInstanceId !== unitInstanceId));
  }, []);

  // Confirm assignment
  const handleConfirm = useCallback(() => {
    const assignments: DamageAssignment[] = [];

    // Build unit assignments based on actual damage each would absorb
    let remainingDamage = totalDamage;
    for (const assignment of unitAssignments) {
      const unit = availableUnits.find((u) => u.unitInstanceId === assignment.unitInstanceId);
      if (!unit || remainingDamage <= 0) continue;

      const result = calculateUnitAbsorption(unit, remainingDamage);
      if (result.damageAbsorbed > 0) {
        assignments.push({
          target: DAMAGE_TARGET_UNIT,
          unitInstanceId: unit.unitInstanceId,
          amount: remainingDamage, // Send full remaining - engine calculates absorption
        });
        remainingDamage = result.remainingDamage;
      }
    }

    // Remaining damage goes to hero
    if (remainingDamage > 0) {
      assignments.push({
        target: DAMAGE_TARGET_HERO,
        amount: remainingDamage,
      });
    }

    onAssign(damageOption.enemyInstanceId, assignments);
  }, [unitAssignments, totalDamage, availableUnits, damageOption.enemyInstanceId, onAssign]);

  // Take all damage to hero (skip unit selection)
  const handleTakeAllDamage = useCallback(() => {
    onAssign(damageOption.enemyInstanceId, [
      { target: DAMAGE_TARGET_HERO, amount: totalDamage },
    ]);
  }, [damageOption.enemyInstanceId, totalDamage, onAssign]);

  // Use portal to escape combat-scene stacking context (z-index: 100)
  // so panel appears above the PixiJS canvas (z-index: 150)
  return createPortal(
    <div className="damage-assignment-panel" data-testid="damage-assignment-panel">
      <div className="damage-assignment-panel__backdrop" onClick={onCancel} />

      <div className="damage-assignment-panel__content">
        {/* Header - Enemy info */}
        <div className="damage-assignment-panel__header">
          <h3 className="damage-assignment-panel__title">Assign Damage</h3>
          <div className="damage-assignment-panel__enemy-info">
            <span className="damage-assignment-panel__enemy-name">
              {damageOption.enemyName}
            </span>
            <span
              className="damage-assignment-panel__element"
              style={{ color: elementInfo.color }}
            >
              {elementInfo.icon} {elementInfo.name}
            </span>
          </div>
          <div className="damage-assignment-panel__damage-total">
            <span className="damage-assignment-panel__damage-value">{totalDamage}</span>
            <span className="damage-assignment-panel__damage-label">
              Damage
              {isBrutal && (
                <span className="damage-assignment-panel__brutal">
                  ({rawAttackValue} \u00D7 2 Brutal)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Unit selection area */}
        {availableUnits.length > 0 && (
          <div className="damage-assignment-panel__units-section">
            <div className="damage-assignment-panel__section-header">
              <span className="damage-assignment-panel__section-title">
                Assign to Units First
              </span>
              <span className="damage-assignment-panel__section-hint">
                Units absorb damage before your hero
              </span>
            </div>

            {/* Assigned units */}
            {unitAssignments.length > 0 && (
              <div className="damage-assignment-panel__assigned-units">
                {damageBreakdown.unitBreakdown.map((unit, index) => (
                  <div
                    key={unit.unitInstanceId}
                    className="damage-assignment-panel__assigned-unit"
                  >
                    <div className="damage-assignment-panel__unit-order">
                      {index + 1}
                    </div>
                    <div className="damage-assignment-panel__unit-info">
                      <span className="damage-assignment-panel__unit-name">
                        {unit.unitName}
                      </span>
                      <span className="damage-assignment-panel__unit-armor">
                        Armor {unit.armor}
                        {unit.isResistant && (
                          <span className="damage-assignment-panel__resistant">
                            {elementInfo.icon} Resistant
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="damage-assignment-panel__absorption">
                      <span className="damage-assignment-panel__absorbed">
                        Absorbs {unit.damageAbsorbed}
                      </span>
                      {unit.wouldWound ? (
                        <span className="damage-assignment-panel__wound-badge">
                          Wounded
                        </span>
                      ) : (
                        <span className="damage-assignment-panel__no-wound-badge">
                          No Wound
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="damage-assignment-panel__remove-btn"
                      onClick={() => removeUnit(unit.unitInstanceId)}
                      aria-label={`Remove ${unit.unitName}`}
                    >
                      \u00D7
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Available units to add */}
            {selectableUnits.length > 0 && (
              <div className="damage-assignment-panel__available-units">
                <span className="damage-assignment-panel__available-label">
                  Available units:
                </span>
                <div className="damage-assignment-panel__unit-buttons">
                  {selectableUnits.map((unit) => (
                      <button
                        key={unit.unitInstanceId}
                        type="button"
                        className="damage-assignment-panel__add-unit-btn"
                        onClick={() => addUnit(unit.unitInstanceId)}
                        data-testid={`add-unit-${unit.unitId}`}
                      >
                        <span className="damage-assignment-panel__add-unit-name">
                          {unit.unitName}
                        </span>
                        <span className="damage-assignment-panel__add-unit-stats">
                          Armor {unit.armor}
                          {unit.isResistantToAttack && (
                            <span className="damage-assignment-panel__add-unit-resistant">
                              {elementInfo.icon}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Unavailable units */}
            {availableUnits.filter((u) => !u.canBeAssigned).length > 0 && (
              <div className="damage-assignment-panel__unavailable-units">
                <span className="damage-assignment-panel__unavailable-label">
                  Unavailable:
                </span>
                {availableUnits
                  .filter((u) => !u.canBeAssigned)
                  .map((unit) => (
                    <span
                      key={unit.unitInstanceId}
                      className="damage-assignment-panel__unavailable-unit"
                    >
                      {unit.unitName}
                      {unit.isWounded && " (Wounded)"}
                      {unit.alreadyAssignedThisCombat && " (Already assigned)"}
                    </span>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Hero damage preview */}
        <div className="damage-assignment-panel__hero-section">
          <div className="damage-assignment-panel__hero-header">
            <span className="damage-assignment-panel__hero-title">Hero Damage</span>
          </div>
          <div className="damage-assignment-panel__hero-breakdown">
            <div className="damage-assignment-panel__hero-stat">
              <span className="damage-assignment-panel__hero-label">
                Remaining damage:
              </span>
              <span className="damage-assignment-panel__hero-value">
                {damageBreakdown.remainingToHero}
              </span>
            </div>
            <div className="damage-assignment-panel__hero-stat">
              <span className="damage-assignment-panel__hero-label">
                Hero armor:
              </span>
              <span className="damage-assignment-panel__hero-value">
                {player?.armor ?? 2}
              </span>
            </div>
            <div className="damage-assignment-panel__hero-wounds">
              <span className="damage-assignment-panel__wounds-label">
                Wounds to take:
              </span>
              <span
                className={`damage-assignment-panel__wounds-value ${
                  damageBreakdown.heroWounds > 0
                    ? "damage-assignment-panel__wounds-value--taking"
                    : ""
                }`}
              >
                {damageBreakdown.heroWounds}
              </span>
            </div>
          </div>

          {/* Knockout warning */}
          {damageBreakdown.wouldKnockout && (
            <div className="damage-assignment-panel__knockout-warning">
              <span className="damage-assignment-panel__knockout-icon">
                \u26A0\uFE0F
              </span>
              <span className="damage-assignment-panel__knockout-text">
                This will knock you out! ({damageBreakdown.totalWoundsAfter} wounds
                \u2265 {handLimit} hand limit)
              </span>
            </div>
          )}
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
          {availableUnits.some((u) => u.canBeAssigned) && (
            <button
              type="button"
              className="damage-assignment-panel__take-all-btn"
              onClick={handleTakeAllDamage}
              data-testid="damage-take-all-btn"
            >
              Take All to Hero
            </button>
          )}
          <button
            type="button"
            className="damage-assignment-panel__confirm-btn"
            onClick={handleConfirm}
            data-testid="damage-confirm-btn"
          >
            Confirm Assignment
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
