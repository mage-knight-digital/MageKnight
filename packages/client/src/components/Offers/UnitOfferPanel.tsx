/**
 * UnitOfferPanel - Displays the current unit offer
 *
 * Shows all units available for recruitment from the unit offer.
 * Uses UNITS from shared to look up full unit definitions.
 * Shows recruit buttons when player is at a valid recruitment site.
 */

import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import {
  UNITS,
  UNIT_TYPE_ELITE,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
  UNIT_ABILITY_MOVE,
  UNIT_ABILITY_INFLUENCE,
  UNIT_ABILITY_HEAL,
  RECRUIT_UNIT_ACTION,
  type UnitId,
  type UnitAbility,
  type RecruitableUnit,
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

interface UnitCardProps {
  unitId: UnitId;
  recruitInfo?: RecruitableUnit;
  onRecruit?: (unitId: string, cost: number) => void;
  playerInfluence: number;
  hasCommandSlots: boolean;
}

function UnitCard({ unitId, recruitInfo, onRecruit, playerInfluence: _playerInfluence, hasCommandSlots: _hasCommandSlots }: UnitCardProps) {
  const unit = UNITS[unitId];

  if (!unit) {
    return <div className="unit-card unit-card--error">Unknown: {unitId}</div>;
  }

  const isElite = unit.type === UNIT_TYPE_ELITE;
  const recruitSites = unit.recruitSites.map((s) => s.replace(/_/g, " ")).join(", ");
  const canRecruit = recruitInfo?.canAfford ?? false;

  const handleRecruit = () => {
    if (canRecruit && recruitInfo && onRecruit) {
      onRecruit(recruitInfo.unitId, recruitInfo.cost);
    }
  };

  return (
    <div
      className="unit-card"
      style={{
        background: isElite
          ? "linear-gradient(135deg, #2d1f4f 0%, #1a1a2e 100%)"
          : "linear-gradient(135deg, #1f2d4f 0%, #1a1a2e 100%)",
        border: isElite ? "2px solid #f39c12" : "2px solid #7f8c8d",
        borderRadius: "8px",
        padding: "0.75rem",
        marginBottom: "0.5rem",
      }}
    >
      {/* Header: Name and Cost */}
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
          {unit.name}
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
          {recruitInfo ? recruitInfo.cost : unit.influence}
        </span>
      </div>

      {/* Stats: Level and Armor */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          fontSize: "0.7rem",
          color: "#888",
          marginBottom: "0.5rem",
        }}
      >
        <span>Lvl {unit.level}</span>
        <span>Armor {unit.armor}</span>
        <span style={{ color: isElite ? "#f39c12" : "#7f8c8d" }}>
          {isElite ? "Elite" : "Regular"}
        </span>
      </div>

      {/* Abilities */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.25rem",
          marginBottom: "0.5rem",
        }}
      >
        {unit.abilities.length > 0 ? (
          unit.abilities.map((ability, i) => (
            <span
              key={i}
              style={{
                background: "#2c3e50",
                padding: "0.125rem 0.375rem",
                borderRadius: "4px",
                fontSize: "0.65rem",
                color: "#ecf0f1",
              }}
            >
              {formatAbility(ability)}
            </span>
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
      {(unit.resistances.physical ||
        unit.resistances.fire ||
        unit.resistances.ice) && (
        <div
          style={{
            fontSize: "0.65rem",
            color: "#9b59b6",
            marginBottom: "0.25rem",
          }}
        >
          Resists:{" "}
          {[
            unit.resistances.physical && "Physical",
            unit.resistances.fire && "Fire",
            unit.resistances.ice && "Ice",
          ]
            .filter(Boolean)
            .join(", ")}
        </div>
      )}

      {/* Recruit Sites */}
      <div style={{ fontSize: "0.6rem", color: "#666" }}>
        Recruit: {recruitSites}
      </div>

      {/* Recruit Button - only show when at valid site */}
      {recruitInfo && (
        <button
          onClick={handleRecruit}
          disabled={!canRecruit}
          style={{
            marginTop: "0.5rem",
            width: "100%",
            padding: "0.375rem 0.5rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            border: "none",
            borderRadius: "4px",
            cursor: canRecruit ? "pointer" : "not-allowed",
            background: canRecruit ? "#27ae60" : "#555",
            color: canRecruit ? "#fff" : "#888",
            transition: "background 0.2s",
          }}
        >
          {canRecruit
            ? `Recruit (${recruitInfo.cost} Influence)`
            : `Need ${recruitInfo.cost} Influence`}
        </button>
      )}
    </div>
  );
}

export function UnitOfferPanel() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  if (!state) return null;

  const unitOffer = state.offers.units;
  const recruitableUnits = state.validActions?.units?.recruitable ?? [];

  // Build a lookup map for recruitable units by unitId
  // Note: multiple copies of same unit in offer need to be handled
  const recruitableMap = new Map<string, RecruitableUnit>();
  for (const recruitInfo of recruitableUnits) {
    recruitableMap.set(recruitInfo.unitId, recruitInfo);
  }

  const handleRecruit = (unitId: string, cost: number) => {
    sendAction({
      type: RECRUIT_UNIT_ACTION,
      unitId: unitId as UnitId,
      influenceSpent: cost,
    });
  };

  // Get player's influence and command slot info
  const playerInfluence = player?.influencePoints ?? 0;
  const hasCommandSlots = player ? player.units.length < player.commandTokens : false;

  return (
    <div className="panel">
      <h3 className="panel__title">
        Unit Offer ({unitOffer.length})
      </h3>
      <div
        style={{
          maxHeight: "300px",
          overflowY: "auto",
        }}
      >
        {unitOffer.length === 0 ? (
          <div style={{ color: "#666", fontSize: "0.8rem" }}>
            No units available
          </div>
        ) : (
          unitOffer.map((unitId, index) => (
            <UnitCard
              key={`${unitId}-${index}`}
              unitId={unitId}
              recruitInfo={recruitableMap.get(unitId)}
              onRecruit={handleRecruit}
              playerInfluence={playerInfluence}
              hasCommandSlots={hasCommandSlots}
            />
          ))
        )}
      </div>
      <div
        style={{
          marginTop: "0.5rem",
          fontSize: "0.65rem",
          color: "#666",
        }}
      >
        Decks: {state.deckCounts.regularUnits} regular,{" "}
        {state.deckCounts.eliteUnits} elite
      </div>
    </div>
  );
}
