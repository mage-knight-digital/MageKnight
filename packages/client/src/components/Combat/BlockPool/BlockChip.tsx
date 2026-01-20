/**
 * BlockChip - Draggable chip representing block in the pool.
 * Shows element icon + amount, can be dragged to enemy drop targets.
 */

import { useDraggable } from "@dnd-kit/core";
import type { AttackElement } from "@mage-knight/shared";
import type { BlockChipData } from "../DnDContext";
import "../AttackPool/AttackPool.css";

// Element icon paths (use block icon for physical, attack icons for elemental)
const ELEMENT_ICONS: Record<AttackElement, string> = {
  physical: "/assets/icons/block.png",
  fire: "/assets/icons/fire_attack.png",
  ice: "/assets/icons/ice_attack.png",
  coldFire: "/assets/icons/cold_fire_attack.png",
};

// Element display names
const ELEMENT_NAMES: Record<AttackElement, string> = {
  physical: "Physical",
  fire: "Fire",
  ice: "Ice",
  coldFire: "Cold Fire",
};

interface BlockChipProps {
  element: AttackElement;
  amount: number;
  disabled?: boolean;
}

export function BlockChip({ element, amount, disabled }: BlockChipProps) {
  const chipId = `block-${element}`;
  const chipData: BlockChipData = {
    id: chipId,
    element,
    amount,
    poolType: "block",
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: chipId,
    data: chipData,
    disabled: disabled || amount === 0,
  });

  if (amount === 0) return null;

  const iconSrc = ELEMENT_ICONS[element];
  const elementName = ELEMENT_NAMES[element];

  return (
    <div
      ref={setNodeRef}
      className={`block-chip block-chip--${element} ${isDragging ? "block-chip--dragging" : ""}`}
      title={`${amount} ${elementName} block`}
      {...listeners}
      {...attributes}
    >
      <img
        src={iconSrc}
        alt={element}
        className="block-chip__icon"
        draggable={false}
      />
      <span className="block-chip__amount">{amount}</span>
    </div>
  );
}

/**
 * BlockChipPreview - Render-only version for DragOverlay
 */
export function BlockChipPreview({ element, amount }: BlockChipProps) {
  const iconSrc = ELEMENT_ICONS[element];

  return (
    <div className={`block-chip block-chip--${element} block-chip--preview`}>
      <img
        src={iconSrc}
        alt={element}
        className="block-chip__icon"
        draggable={false}
      />
      <span className="block-chip__amount">{amount}</span>
    </div>
  );
}
