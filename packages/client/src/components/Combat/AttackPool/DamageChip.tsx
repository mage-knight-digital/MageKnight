/**
 * DamageChip - Draggable chip representing attack damage in the pool.
 * Shows element icon + amount, can be dragged to enemy drop targets.
 */

import { useDraggable } from "@dnd-kit/core";
import type { AttackType, AttackElement } from "@mage-knight/shared";
import type { DamageChipData } from "../DnDContext";
import "./AttackPool.css";

// Element icon paths
const ELEMENT_ICONS: Record<AttackElement, string> = {
  physical: "/assets/icons/attack.png",
  fire: "/assets/icons/fire_attack.png",
  ice: "/assets/icons/ice_attack.png",
  coldFire: "/assets/icons/cold_fire_attack.png",
};

// Attack type labels (short form for display)
const TYPE_LABELS: Record<AttackType, string> = {
  ranged: "R",
  siege: "S",
  melee: "M",
};

// Type display names for tooltip
const TYPE_NAMES: Record<AttackType, string> = {
  ranged: "Ranged",
  siege: "Siege",
  melee: "Melee",
};

interface DamageChipProps {
  attackType: AttackType;
  element: AttackElement;
  amount: number;
  disabled?: boolean;
}

export function DamageChip({ attackType, element, amount, disabled }: DamageChipProps) {
  const chipId = `damage-${attackType}-${element}`;
  const chipData: DamageChipData = {
    id: chipId,
    attackType,
    element,
    amount,
    poolType: "attack",
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: chipId,
    data: chipData,
    disabled: disabled || amount === 0,
  });

  if (amount === 0) return null;

  const iconSrc = ELEMENT_ICONS[element];
  const typeLabel = TYPE_LABELS[attackType];
  const typeName = TYPE_NAMES[attackType];

  return (
    <div
      ref={setNodeRef}
      className={`damage-chip damage-chip--${element} ${isDragging ? "damage-chip--dragging" : ""}`}
      title={`${amount} ${typeName} ${element} attack`}
      {...listeners}
      {...attributes}
    >
      <img
        src={iconSrc}
        alt={element}
        className="damage-chip__icon"
        draggable={false}
      />
      <span className="damage-chip__amount">{amount}</span>
      <span className="damage-chip__type">{typeLabel}</span>
    </div>
  );
}

/**
 * DamageChipPreview - Render-only version for DragOverlay
 */
export function DamageChipPreview({ attackType, element, amount }: DamageChipProps) {
  const iconSrc = ELEMENT_ICONS[element];
  const typeLabel = TYPE_LABELS[attackType];

  return (
    <div className={`damage-chip damage-chip--${element} damage-chip--preview`}>
      <img
        src={iconSrc}
        alt={element}
        className="damage-chip__icon"
        draggable={false}
      />
      <span className="damage-chip__amount">{amount}</span>
      <span className="damage-chip__type">{typeLabel}</span>
    </div>
  );
}
