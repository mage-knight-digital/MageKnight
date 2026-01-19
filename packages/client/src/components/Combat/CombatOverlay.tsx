/**
 * CombatOverlay - Combat UI that floats over the dimmed game board
 *
 * No modal - enemies appear as large tokens floating over the board,
 * player hand stays visible at bottom.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { ClientCombatState, CombatOptions } from "@mage-knight/shared";
import {
  UNDO_ACTION,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  DECLARE_BLOCK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  END_COMBAT_PHASE_ACTION,
} from "@mage-knight/shared";
import { EnemyCard } from "./EnemyCard";
import { VerticalPhaseRail } from "./VerticalPhaseRail";
import { ManaSourceOverlay } from "../GameBoard/ManaSourceOverlay";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { hexKey } from "@mage-knight/shared";
import { SpriteImage } from "../SpriteImage/SpriteImage";
import "./CombatOverlay.css";

type EffectType = "damage" | "block" | "attack" | null;

// Site sprite sheet configuration
const SITES_SHEET = {
  src: "/assets/sites/sites_sprite_sheet.png",
  width: 1280,
  height: 1024,
  spriteWidth: 256,
  spriteHeight: 256,
  cols: 5,
  rows: 4,
};

// Map site types to sprite positions in the sheet
const SITE_SPRITE_MAP: Record<string, { col: number; row: number }> = {
  ancient_ruins: { col: 0, row: 0 },
  city_blue: { col: 1, row: 0 },
  city_green: { col: 2, row: 0 },
  city_red: { col: 3, row: 0 },
  city_white: { col: 4, row: 0 },
  deep_mine: { col: 0, row: 1 },
  draconum: { col: 1, row: 1 },
  keep: { col: 2, row: 1 },
  labyrinth: { col: 3, row: 1 },
  monastery: { col: 0, row: 2 },
  necropolis: { col: 1, row: 2 },
  orc_marauder: { col: 4, row: 2 },
  refugee_camp: { col: 0, row: 3 },
  spawning_grounds: { col: 1, row: 3 },
  tomb: { col: 2, row: 3 },
  village: { col: 3, row: 3 },
  // Mage tower uses keep sprite as fallback
  mage_tower: { col: 2, row: 1 },
  // Monster den uses ancient ruins as fallback
  monster_den: { col: 0, row: 0 },
  // Dungeon uses labyrinth as fallback
  dungeon: { col: 3, row: 1 },
};

interface StrikingEnemy {
  instanceId: string;
  strikeKey: number;
}

interface CombatOverlayProps {
  combat: ClientCombatState;
  combatOptions: CombatOptions;
}


function AccumulatorDisplay() {
  const player = useMyPlayer();
  const { state } = useGame();

  if (!player || !state?.combat) return null;

  const phase = state.combat.phase;
  const acc = player.combatAccumulator;

  // Show attack accumulator in ranged/siege phase or attack phase
  if (phase === COMBAT_PHASE_RANGED_SIEGE || phase === COMBAT_PHASE_ATTACK) {
    const { attack } = acc;
    const totalRanged = attack.ranged + attack.rangedElements.fire + attack.rangedElements.ice;
    const totalSiege = attack.siege + attack.siegeElements.fire + attack.siegeElements.ice;
    const totalNormal = attack.normal + attack.normalElements.fire + attack.normalElements.ice + attack.normalElements.coldFire + attack.normalElements.physical;

    const isRangedSiege = phase === COMBAT_PHASE_RANGED_SIEGE;
    const relevantAttack = isRangedSiege
      ? totalRanged + totalSiege
      : totalNormal + totalRanged + totalSiege;

    if (relevantAttack === 0) return null;

    return (
      <div className="combat-hud__accumulator combat-hud__accumulator--attack">
        <span className="combat-hud__accumulator-value">{relevantAttack}</span>
        <span className="combat-hud__accumulator-label">
          {isRangedSiege ? "Ranged/Siege" : "Attack"}
        </span>
      </div>
    );
  }

  // Show block accumulator in block phase
  if (phase === COMBAT_PHASE_BLOCK) {
    if (acc.block === 0) return null;

    return (
      <div className="combat-hud__accumulator combat-hud__accumulator--block">
        <span className="combat-hud__accumulator-value">{acc.block}</span>
        <span className="combat-hud__accumulator-label">Block</span>
      </div>
    );
  }

  return null;
}

export function CombatOverlay({ combat, combatOptions }: CombatOverlayProps) {
  const { phase, enemies } = combat;
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const canUndo = state?.validActions.turn?.canUndo ?? false;

  // Get site type from player's current position
  const siteType = (() => {
    if (!player?.position || !state?.map.hexes) return null;
    const key = hexKey(player.position);
    const hex = state.map.hexes[key];
    return hex?.site?.type ?? null;
  })();

  // Get sprite position for the site (or null to hide backdrop)
  const siteSprite = siteType ? SITE_SPRITE_MAP[siteType] : null;

  // Visual effect state - use a counter to force animation restart
  const [activeEffect, setActiveEffect] = useState<EffectType>(null);
  const [effectKey, setEffectKey] = useState(0);
  const [strikingEnemy, setStrikingEnemy] = useState<StrikingEnemy | null>(null);
  const [attackedEnemies, setAttackedEnemies] = useState<Set<string>>(new Set());

  const triggerEffect = useCallback((effect: EffectType) => {
    setActiveEffect(effect);
    setEffectKey(k => k + 1); // Force animation restart
    // Clear effect after animation completes
    setTimeout(() => setActiveEffect(null), 400);
  }, []);

  // Track wounds and which enemy dealt them to trigger strike animation
  const prevWoundsRef = useRef<number>(combat.woundsThisCombat);
  const lastDamageEnemyRef = useRef<string | null>(null);

  // When player clicks "Take Damage", record which enemy is dealing it
  const handleAssignDamage = useCallback((enemyInstanceId: string) => {
    lastDamageEnemyRef.current = enemyInstanceId;
    sendAction({ type: ASSIGN_DAMAGE_ACTION, enemyInstanceId });
  }, [sendAction]);

  useEffect(() => {
    const prevWounds = prevWoundsRef.current;
    const currentWounds = combat.woundsThisCombat;

    if (currentWounds > prevWounds) {
      const attackingEnemyId = lastDamageEnemyRef.current;

      // One hit animation per enemy attack (not per wound)
      // CSS animation: 0.45s total, SNAP hits at 42% = ~190ms
      const impactTime = 190;
      const animationDuration = 450;

      // Start enemy strike animation (wind-up + slam)
      if (attackingEnemyId) {
        setStrikingEnemy({ instanceId: attackingEnemyId, strikeKey: Date.now() });
      }

      // Trigger screen effect at moment of impact
      setTimeout(() => {
        setActiveEffect("damage");
        setEffectKey(k => k + 1);
      }, impactTime);

      // Clear strike animation after it completes, mark as "has attacked"
      setTimeout(() => {
        setStrikingEnemy(null);
        if (attackingEnemyId) {
          setAttackedEnemies(prev => new Set(prev).add(attackingEnemyId));
        }
      }, animationDuration + 30);

      // Clear screen effect
      setTimeout(() => setActiveEffect(null), animationDuration + 100);
    }

    prevWoundsRef.current = currentWounds;
  }, [combat.woundsThisCombat]);

  // Get accumulated values for passing to enemy cards
  const accumulatedBlock = player?.combatAccumulator.block ?? 0;
  const attackAcc = player?.combatAccumulator.attack;
  const accumulatedAttack = attackAcc
    ? attackAcc.normal + attackAcc.ranged + attackAcc.siege +
      attackAcc.normalElements.fire + attackAcc.normalElements.ice + attackAcc.normalElements.coldFire + attackAcc.normalElements.physical +
      attackAcc.rangedElements.fire + attackAcc.rangedElements.ice +
      attackAcc.siegeElements.fire + attackAcc.siegeElements.ice
    : 0;

  const isBlockPhase = phase === COMBAT_PHASE_BLOCK;
  const isDamagePhase = phase === COMBAT_PHASE_ASSIGN_DAMAGE;
  const isAttackPhase = phase === COMBAT_PHASE_ATTACK;
  const isRangedSiegePhase = phase === COMBAT_PHASE_RANGED_SIEGE;

  return (
    <div className="combat-scene" data-testid="combat-overlay">
      {/* Effect overlay - separate element for damage/block/attack flashes */}
      {activeEffect && (
        <div
          key={effectKey}
          className={`combat-scene__effect combat-scene__effect--${activeEffect}`}
        />
      )}

      {/* Site backdrop - faded background behind enemies */}
      {siteSprite && (
        <div className="combat-scene__backdrop">
          <SpriteImage
            src={SITES_SHEET.src}
            spriteWidth={SITES_SHEET.spriteWidth}
            spriteHeight={SITES_SHEET.spriteHeight}
            col={siteSprite.col}
            row={siteSprite.row}
            sheetWidth={SITES_SHEET.width}
            sheetHeight={SITES_SHEET.height}
            displayWidth={512}
            displayHeight={512}
            alt={siteType ?? ""}
            className="combat-scene__backdrop-image"
          />
        </div>
      )}

      {/* Main layout: phase rail | battle area | info panel */}
      <div className="combat-scene__layout">
        {/* Left - Vertical phase rail */}
        <div className="combat-scene__phase-rail">
          <VerticalPhaseRail
            currentPhase={phase}
            canEndPhase={combatOptions.canEndPhase}
            onEndPhase={() => sendAction({ type: END_COMBAT_PHASE_ACTION })}
          />
        </div>

        {/* Center - Battle area with enemies */}
        <div className="combat-scene__battlefield">
          {/* Undo button */}
          {canUndo && (
            <button
              className="combat-scene__undo"
              onClick={() => sendAction({ type: UNDO_ACTION })}
              type="button"
            >
              Undo
            </button>
          )}

          {/* Mana Source */}
          <div className="combat-scene__mana-source">
            <ManaSourceOverlay />
          </div>

          {/* Enemies */}
          <div className="combat-scene__enemies">
            {enemies.map((enemy) => {
              const blockOption = combatOptions.blocks?.find(b => b.enemyInstanceId === enemy.instanceId);
              const damageOption = combatOptions.damageAssignments?.find(d => d.enemyInstanceId === enemy.instanceId);
              const attackOption = combatOptions.attacks?.find(a => a.enemyInstanceId === enemy.instanceId);

              const isStriking = strikingEnemy?.instanceId === enemy.instanceId;
              const strikeKey = isStriking ? strikingEnemy.strikeKey : undefined;
              const hasAttacked = attackedEnemies.has(enemy.instanceId);

              return (
                <EnemyCard
                  key={enemy.instanceId}
                  enemy={enemy}
                  isBlockPhase={isBlockPhase}
                  blockOption={blockOption}
                  accumulatedBlock={accumulatedBlock}
                  onAssignBlock={(id) => {
                    triggerEffect("block");
                    sendAction({ type: DECLARE_BLOCK_ACTION, targetEnemyInstanceId: id });
                  }}
                  isDamagePhase={isDamagePhase}
                  damageOption={damageOption}
                  onAssignDamage={handleAssignDamage}
                  isAttackPhase={isAttackPhase || isRangedSiegePhase}
                  attackOption={attackOption}
                  accumulatedAttack={accumulatedAttack}
                  onAssignAttack={(id) => {
                    triggerEffect("attack");
                    // TODO: This needs more info - attack sources and type
                    // For now this won't work correctly, need to wire up properly
                    console.log("Attack enemy", id);
                  }}
                  isRangedSiegePhase={isRangedSiegePhase}
                  isStriking={isStriking}
                  strikeKey={strikeKey}
                  hasAttacked={hasAttacked}
                />
              );
            })}
          </div>

          {/* Accumulated power display */}
          <AccumulatorDisplay />
        </div>

      </div>
    </div>
  );
}
