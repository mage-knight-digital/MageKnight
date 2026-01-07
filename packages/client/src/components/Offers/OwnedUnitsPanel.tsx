/**
 * OwnedUnitsPanel - Displays the player's owned units with ability activation
 *
 * Shows all units the player has recruited.
 * Displays unit status (ready/wounded/exhausted).
 * Allows ability activation when valid.
 */

import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import {
  UNITS,
  UNIT_TYPE_ELITE,
  UNIT_STATE_READY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
  UNIT_ABILITY_MOVE,
  UNIT_ABILITY_INFLUENCE,
  UNIT_ABILITY_HEAL,
  ACTIVATE_UNIT_ACTION,
  type UnitId,
  type UnitAbility,
  type ClientPlayerUnit,
  type ActivatableUnit,
  type ActivatableAbility,
} from "@mage-knight/shared";

function formatAbility(ability: UnitAbility): string {
  const value = ability.value ?? "";
  const element = ability.element ? ` ${ability.element}` : "";

  switch (ability.type) {
    case UNIT_ABILITY_ATTACK:
      return `Attack ${value}${element}`;
    case UNIT_ABILITY_BLOCK:
      return `Block ${value}${element}`;
    case UNIT_ABILITY_RANGED_ATTACK:
      return `Ranged ${value}${element}`;
    case UNIT_ABILITY_SIEGE_ATTACK:
      return `Siege ${value}${element}`;
    case UNIT_ABILITY_MOVE:
      return `Move ${value}`;
    case UNIT_ABILITY_INFLUENCE:
      return `Influence ${value}`;
    case UNIT_ABILITY_HEAL:
      return `Heal ${value}`;
    default:
      return ability.type.replace(/_/g, " ");
  }
}

interface AbilityButtonProps {
  ability: UnitAbility;
  abilityIndex: number;
  activatableInfo?: ActivatableAbility;
  onActivate: () => void;
}

function AbilityButton({
  ability,
  abilityIndex,
  activatableInfo,
  onActivate,
}: AbilityButtonProps) {
  const canActivate = activatableInfo?.canActivate ?? false;
  const reason = activatableInfo?.reason;

  return (
    <button
      onClick={onActivate}
      disabled={!canActivate}
      title={reason ?? formatAbility(ability)}
      data-testid={`ability-${ability.type}-${abilityIndex}`}
      style={{
        background: canActivate ? "#27ae60" : "#2c3e50",
        border: canActivate ? "1px solid #2ecc71" : "1px solid #34495e",
        padding: "0.25rem 0.5rem",
        borderRadius: "4px",
        fontSize: "0.65rem",
        color: canActivate ? "#fff" : "#888",
        cursor: canActivate ? "pointer" : "not-allowed",
        transition: "all 0.2s",
      }}
    >
      {formatAbility(ability)}
      {activatableInfo?.manaCost && (
        <span
          style={{
            marginLeft: "0.25rem",
            color: "#f39c12",
          }}
        >
          ({activatableInfo.manaCost})
        </span>
      )}
    </button>
  );
}

interface OwnedUnitCardProps {
  unit: ClientPlayerUnit;
  unitIndex: number;
  activatableInfo?: ActivatableUnit;
  onActivate: (abilityIndex: number) => void;
}

function OwnedUnitCard({
  unit,
  unitIndex,
  activatableInfo,
  onActivate,
}: OwnedUnitCardProps) {
  const unitDef = UNITS[unit.unitId];

  if (!unitDef) {
    return (
      <div className="unit-card unit-card--error">Unknown: {unit.unitId}</div>
    );
  }

  const isElite = unitDef.type === UNIT_TYPE_ELITE;
  const isReady = unit.state === UNIT_STATE_READY;
  const isWounded = unit.wounded;

  // Build a map of activatable abilities by index
  const activatableAbilitiesMap = new Map<number, ActivatableAbility>();
  if (activatableInfo) {
    for (const ability of activatableInfo.abilities) {
      activatableAbilitiesMap.set(ability.index, ability);
    }
  }

  return (
    <div
      className="owned-unit-card"
      data-testid={`owned-unit-${unitIndex}`}
      style={{
        background: isElite
          ? "linear-gradient(135deg, #2d1f4f 0%, #1a1a2e 100%)"
          : "linear-gradient(135deg, #1f2d4f 0%, #1a1a2e 100%)",
        border: isWounded
          ? "2px solid #e74c3c"
          : isElite
            ? "2px solid #f39c12"
            : "2px solid #7f8c8d",
        borderRadius: "8px",
        padding: "0.75rem",
        marginBottom: "0.5rem",
        opacity: isReady ? 1 : 0.7,
      }}
    >
      {/* Header: Name and Level */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: "0.85rem",
            color: isElite ? "#f39c12" : "#ecf0f1",
          }}
        >
          {unitDef.name}
        </span>
        <span
          style={{
            background: "#3498db",
            color: "#fff",
            padding: "0.125rem 0.375rem",
            borderRadius: "4px",
            fontSize: "0.7rem",
            fontWeight: 600,
          }}
        >
          L{unitDef.level}
        </span>
      </div>

      {/* Stats and Status */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          fontSize: "0.7rem",
          color: "#888",
          marginBottom: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <span>Armor {unitDef.armor}</span>
        {isWounded && (
          <span
            style={{
              background: "#c0392b",
              color: "#fff",
              padding: "0.125rem 0.25rem",
              borderRadius: "3px",
              fontSize: "0.6rem",
            }}
          >
            Wounded
          </span>
        )}
        {!isReady && (
          <span
            style={{
              background: "#7f8c8d",
              color: "#fff",
              padding: "0.125rem 0.25rem",
              borderRadius: "3px",
              fontSize: "0.6rem",
            }}
          >
            Exhausted
          </span>
        )}
        {isReady && !isWounded && (
          <span
            style={{
              background: "#27ae60",
              color: "#fff",
              padding: "0.125rem 0.25rem",
              borderRadius: "3px",
              fontSize: "0.6rem",
            }}
          >
            Ready
          </span>
        )}
      </div>

      {/* Abilities */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.25rem",
        }}
      >
        {unitDef.abilities.length > 0 ? (
          unitDef.abilities.map((ability, index) => (
            <AbilityButton
              key={index}
              ability={ability}
              abilityIndex={index}
              activatableInfo={activatableAbilitiesMap.get(index)}
              onActivate={() => onActivate(index)}
            />
          ))
        ) : (
          <span
            style={{
              fontSize: "0.65rem",
              color: "#666",
              fontStyle: "italic",
            }}
          >
            Special ability
          </span>
        )}
      </div>

      {/* Resistances (if any) */}
      {(unitDef.resistances.physical ||
        unitDef.resistances.fire ||
        unitDef.resistances.ice) && (
        <div
          style={{
            fontSize: "0.6rem",
            color: "#9b59b6",
            marginTop: "0.25rem",
          }}
        >
          Resists:{" "}
          {[
            unitDef.resistances.physical && "Physical",
            unitDef.resistances.fire && "Fire",
            unitDef.resistances.ice && "Ice",
          ]
            .filter(Boolean)
            .join(", ")}
        </div>
      )}
    </div>
  );
}

export function OwnedUnitsPanel() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  if (!state || !player) return null;

  const activatableUnits = state.validActions?.units?.activatable ?? [];

  // Build a map of activatable units by unitId
  // Note: We don't have instanceId in ClientPlayerUnit, so we match by unitId and index
  const activatableMap = new Map<string, ActivatableUnit>();
  for (const activatable of activatableUnits) {
    activatableMap.set(activatable.unitInstanceId, activatable);
  }

  const handleActivate = (unitId: UnitId, unitIndex: number, abilityIndex: number) => {
    // Find the matching activatable unit
    // Since ClientPlayerUnit doesn't have instanceId, we need to match by position/unitId
    const activatable = activatableUnits.find(
      (a) => a.unitId === unitId
    );

    if (activatable) {
      sendAction({
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: activatable.unitInstanceId,
        abilityIndex,
      });
    }
  };

  const units = player.units;

  return (
    <div className="panel">
      <h3 className="panel__title">
        Your Units ({units.length}/{player.commandTokens})
      </h3>
      <div
        style={{
          maxHeight: "250px",
          overflowY: "auto",
        }}
      >
        {units.length === 0 ? (
          <div style={{ color: "#666", fontSize: "0.8rem" }}>
            No units recruited
          </div>
        ) : (
          units.map((unit, index) => {
            // Try to find the activatable info for this unit
            const activatable = activatableUnits.find(
              (a) => a.unitId === unit.unitId
            );

            return (
              <OwnedUnitCard
                key={`${unit.unitId}-${index}`}
                unit={unit}
                unitIndex={index}
                activatableInfo={activatable}
                onActivate={(abilityIndex) =>
                  handleActivate(unit.unitId, index, abilityIndex)
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
}
