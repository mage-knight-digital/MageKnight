/**
 * AmountPicker - Modal dialog for selecting how much damage to assign.
 *
 * Appears when dropping a damage chip on an enemy that could be overkilled.
 * Lets user choose how much of the chip to apply (1 to max).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { AttackType, AttackElement } from "@mage-knight/shared";
import "./AmountPicker.css";

// Element icon paths
const ELEMENT_ICONS: Record<AttackElement, string> = {
  physical: "/assets/icons/attack.png",
  fire: "/assets/icons/fire_attack.png",
  ice: "/assets/icons/ice_attack.png",
  coldFire: "/assets/icons/cold_fire_attack.png",
};

const TYPE_NAMES: Record<AttackType, string> = {
  ranged: "Ranged",
  siege: "Siege",
  melee: "Melee",
};

// Block element icons (use block icon for physical)
const BLOCK_ICONS: Record<AttackElement, string> = {
  physical: "/assets/icons/block.png",
  fire: "/assets/icons/fire_attack.png",
  ice: "/assets/icons/ice_attack.png",
  coldFire: "/assets/icons/cold_fire_attack.png",
};

interface AmountPickerProps {
  /** Maximum amount available to assign */
  maxAmount: number;
  /** Attack type (ranged/siege/melee) - optional for block mode */
  attackType?: AttackType;
  /** Element type (physical/fire/ice/coldFire) */
  element: AttackElement;
  /** Enemy name for display */
  enemyName: string;
  /** Position to display at (near drop point) */
  position: { x: number; y: number };
  /** Mode: "attack" (default) or "block" */
  mode?: "attack" | "block";
  /** Callback when amount is confirmed */
  onConfirm: (amount: number) => void;
  /** Callback when picker is cancelled */
  onCancel: () => void;
}

export function AmountPicker({
  maxAmount,
  attackType,
  element,
  enemyName,
  position,
  mode = "attack",
  onConfirm,
  onCancel,
}: AmountPickerProps) {
  const [amount, setAmount] = useState(maxAmount);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    // Delay adding listener to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onCancel]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter") {
        onConfirm(amount);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, onConfirm, amount]);

  const handleDecrease = useCallback(() => {
    setAmount((a) => Math.max(1, a - 1));
  }, []);

  const handleIncrease = useCallback(() => {
    setAmount((a) => Math.min(maxAmount, a + 1));
  }, [maxAmount]);

  const handleConfirm = useCallback(() => {
    onConfirm(amount);
  }, [onConfirm, amount]);

  return (
    <div
      ref={containerRef}
      className="amount-picker"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="amount-picker__header">
        Assign to {enemyName}
      </div>

      <div className="amount-picker__type">
        <img
          src={mode === "block" ? BLOCK_ICONS[element] : ELEMENT_ICONS[element]}
          alt={element}
          className="amount-picker__icon"
        />
        <span>
          {mode === "block" ? "Block" : attackType ? TYPE_NAMES[attackType] : "Attack"}
        </span>
      </div>

      <div className="amount-picker__controls">
        <button
          className="amount-picker__btn amount-picker__btn--minus"
          onClick={handleDecrease}
          disabled={amount <= 1}
          type="button"
        >
          −
        </button>
        <span className="amount-picker__amount">{amount}</span>
        <button
          className="amount-picker__btn amount-picker__btn--plus"
          onClick={handleIncrease}
          disabled={amount >= maxAmount}
          type="button"
        >
          +
        </button>
      </div>

      <div className="amount-picker__info">
        of {maxAmount} available
      </div>

      <div className="amount-picker__actions">
        <button
          className="amount-picker__confirm"
          onClick={handleConfirm}
          type="button"
        >
          Assign {amount}
        </button>
        <button
          className="amount-picker__cancel"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
