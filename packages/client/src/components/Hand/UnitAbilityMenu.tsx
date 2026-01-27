/**
 * UnitAbilityMenu - Popup menu for selecting unit abilities
 *
 * Displays available abilities for a unit, showing which can be activated
 * in the current game phase and providing reasons for disabled abilities.
 */

import { useCallback, useEffect, useRef } from "react";
import {
  UNITS,
  ACTIVATE_UNIT_ACTION,
  type ActivatableUnit,
  type UnitId,
  type Element,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { playSound } from "../../utils/audioManager";
import "./UnitAbilityMenu.css";

export interface UnitAbilityMenuProps {
  /** The unit being acted on */
  unitInstanceId: string;
  /** Unit ID for definition lookup */
  unitId: UnitId;
  /** Activatable abilities info from validActions */
  activatableInfo: ActivatableUnit;
  /** Position for menu placement (unit's bounding rect) */
  sourceRect: DOMRect;
  /** Callback when menu should close */
  onClose: () => void;
}

/**
 * Format element for display
 */
function formatElement(element: Element | undefined): string | null {
  if (!element) return null;
  switch (element) {
    case ELEMENT_FIRE:
      return "🔥";
    case ELEMENT_ICE:
      return "❄️";
    case ELEMENT_COLD_FIRE:
      return "🔥❄️";
    default:
      return null;
  }
}

export function UnitAbilityMenu({
  unitInstanceId,
  unitId,
  activatableInfo,
  sourceRect,
  onClose,
}: UnitAbilityMenuProps) {
  const { sendAction } = useGame();
  const menuRef = useRef<HTMLDivElement>(null);

  // Get unit definition for ability details
  const unitDef = UNITS[unitId];

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Use capture phase so we get the event before it bubbles
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [onClose]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleAbilityClick = useCallback(
    (abilityIndex: number, canActivate: boolean) => {
      if (!canActivate) return;

      playSound("cardPlay");

      // Dispatch the ACTIVATE_UNIT action
      sendAction({
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId,
        abilityIndex,
      });

      onClose();
    },
    [sendAction, unitInstanceId, onClose]
  );

  // Calculate menu position - center above the unit
  const menuStyle: React.CSSProperties = {
    position: "fixed",
    left: sourceRect.left + sourceRect.width / 2,
    top: sourceRect.top - 10, // Position above the unit
    transform: "translate(-50%, -100%)",
    zIndex: 10000,
  };

  if (!unitDef) {
    return null;
  }

  return (
    <div ref={menuRef} className="unit-ability-menu" style={menuStyle}>
      <div className="unit-ability-menu__header">
        <span className="unit-ability-menu__title">{unitDef.name}</span>
        <button
          className="unit-ability-menu__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="unit-ability-menu__abilities">
        {activatableInfo.abilities.map((ability) => {
          const abilityDef = unitDef.abilities[ability.index];
          if (!abilityDef) return null;

          const elementIcon = formatElement(abilityDef.element);
          const valueText = abilityDef.value !== undefined ? ` ${abilityDef.value}` : "";

          return (
            <button
              key={ability.index}
              className={`unit-ability-menu__ability ${
                ability.canActivate
                  ? "unit-ability-menu__ability--activatable"
                  : "unit-ability-menu__ability--disabled"
              }`}
              onClick={() => handleAbilityClick(ability.index, ability.canActivate)}
              disabled={!ability.canActivate}
              title={ability.reason}
            >
              <span className="unit-ability-menu__ability-name">
                {ability.name}
                {valueText}
                {elementIcon && (
                  <span className="unit-ability-menu__ability-element">
                    {elementIcon}
                  </span>
                )}
              </span>
              {!ability.canActivate && ability.reason && (
                <span className="unit-ability-menu__ability-reason">
                  {ability.reason}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
