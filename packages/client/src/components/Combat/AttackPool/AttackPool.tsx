/**
 * AttackPool - Displays accumulated attack damage in grouped sections.
 *
 * Sections: RANGED | SIEGE | MELEE
 * Each section shows draggable chips by element (physical, fire, ice, coldFire).
 */

import type { AvailableAttackPool } from "@mage-knight/shared";
import type { AttackType, AttackElement } from "@mage-knight/shared";
import { DamageChip } from "./DamageChip";
import "./AttackPool.css";

interface AttackPoolProps {
  availableAttack: AvailableAttackPool;
  /** Whether enemies require siege (fortified site/enemies in ranged phase) */
  showSiegeWarning?: boolean;
  /** Current phase - affects which attack types are relevant */
  isRangedSiegePhase?: boolean;
}

// Helper to get chip amount for a type/element combo
function getAmount(pool: AvailableAttackPool, type: AttackType, element: AttackElement): number {
  if (type === "ranged") {
    if (element === "physical") return pool.ranged;
    if (element === "fire") return pool.fireRanged;
    if (element === "ice") return pool.iceRanged;
    return 0;
  }
  if (type === "siege") {
    if (element === "physical") return pool.siege;
    if (element === "fire") return pool.fireSiege;
    if (element === "ice") return pool.iceSiege;
    return 0;
  }
  if (type === "melee") {
    if (element === "physical") return pool.melee;
    if (element === "fire") return pool.fireMelee;
    if (element === "ice") return pool.iceMelee;
    if (element === "coldFire") return pool.coldFireMelee;
    return 0;
  }
  return 0;
}

// Calculate total for a type
function getTypeTotal(pool: AvailableAttackPool, type: AttackType): number {
  if (type === "ranged") {
    return pool.ranged + pool.fireRanged + pool.iceRanged;
  }
  if (type === "siege") {
    return pool.siege + pool.fireSiege + pool.iceSiege;
  }
  if (type === "melee") {
    return pool.melee + pool.fireMelee + pool.iceMelee + pool.coldFireMelee;
  }
  return 0;
}

interface AttackPoolSectionProps {
  title: string;
  type: AttackType;
  pool: AvailableAttackPool;
  showWarning?: boolean;
  disabled?: boolean;
}

function AttackPoolSection({ title, type, pool, showWarning, disabled }: AttackPoolSectionProps) {
  const total = getTypeTotal(pool, type);
  const elements: AttackElement[] = type === "melee"
    ? ["physical", "fire", "ice", "coldFire"]
    : ["physical", "fire", "ice"];

  // Filter to only elements with amounts
  const activeElements = elements.filter(el => getAmount(pool, type, el) > 0);

  if (total === 0 && !showWarning) return null;

  return (
    <div className={`attack-pool__section ${showWarning && total === 0 ? "attack-pool__section--warning" : ""}`}>
      <div className="attack-pool__section-header">
        <span className="attack-pool__section-title">{title}</span>
        <span className="attack-pool__section-total">{total}</span>
      </div>
      <div className="attack-pool__chips">
        {activeElements.map((element) => (
          <DamageChip
            key={`${type}-${element}`}
            attackType={type}
            element={element}
            amount={getAmount(pool, type, element)}
            disabled={disabled}
          />
        ))}
        {total === 0 && showWarning && (
          <span className="attack-pool__warning">Needed</span>
        )}
      </div>
    </div>
  );
}

export function AttackPool({ availableAttack, showSiegeWarning, isRangedSiegePhase }: AttackPoolProps) {
  const rangedTotal = getTypeTotal(availableAttack, "ranged");
  const siegeTotal = getTypeTotal(availableAttack, "siege");
  const meleeTotal = getTypeTotal(availableAttack, "melee");
  const totalAttack = rangedTotal + siegeTotal + meleeTotal;

  if (totalAttack === 0 && !showSiegeWarning) {
    return null;
  }

  // In ranged/siege phase, show ranged and siege
  // In attack phase, show melee only
  const showRangedSiege = isRangedSiegePhase;
  const showMelee = !isRangedSiegePhase;

  return (
    <div className="attack-pool">
      {showRangedSiege && (
        <>
          <AttackPoolSection
            title="Ranged"
            type="ranged"
            pool={availableAttack}
            disabled={false}
          />
          <AttackPoolSection
            title="Siege"
            type="siege"
            pool={availableAttack}
            showWarning={showSiegeWarning}
            disabled={false}
          />
        </>
      )}
      {showMelee && (
        <AttackPoolSection
          title="Melee"
          type="melee"
          pool={availableAttack}
          disabled={false}
        />
      )}
    </div>
  );
}
