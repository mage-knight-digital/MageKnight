/**
 * CombatOverlay - Combat UI that floats over the dimmed game board
 *
 * No modal - enemies appear as large tokens floating over the board,
 * player hand stays visible at bottom.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type {
  ClientCombatState,
  CombatOptions,
  DamageAssignmentOption,
  DamageAssignment,
} from "@mage-knight/shared";
import {
  UNDO_ACTION,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  DECLARE_BLOCK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  END_COMBAT_PHASE_ACTION,
  ASSIGN_ATTACK_ACTION,
  UNASSIGN_ATTACK_ACTION,
  ASSIGN_BLOCK_ACTION,
  UNASSIGN_BLOCK_ACTION,
} from "@mage-knight/shared";
import type {
  AssignAttackOption,
  UnassignAttackOption,
  AssignBlockOption,
  UnassignBlockOption,
} from "@mage-knight/shared";
import { PixiEnemyCard } from "./PixiEnemyCard";
import { EnemyDetailPanel } from "./EnemyDetailPanel";
import { PixiPhaseRail } from "./PixiPhaseRail";
import { PixiEnemyTokens } from "./PixiEnemyTokens";
import { PixiScreenEffects } from "./PixiScreenEffects";
import { PixiAttackPool } from "./PixiAttackPool";
import { PixiBlockPool } from "./PixiBlockPool";
import { PixiPowerLine } from "./PixiPowerLine";
import { ManaSourceOverlay } from "../GameBoard/ManaSourceOverlay";
import {
  CombatDragProvider,
  type ChipData,
  type DamageChipData,
  type BlockChipData,
} from "../../contexts/CombatDragContext";
import { AmountPicker } from "./AmountPicker";
import { DamageAssignmentPanel } from "./DamageAssignmentPanel";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import "./CombatOverlay.css";

type EffectType = "damage" | "block" | "attack" | null;

interface CombatOverlayProps {
  combat: ClientCombatState;
  // combatOptions may be undefined during choice resolution - combat scene stays visible
  // but action buttons are disabled
  combatOptions?: CombatOptions;
}


// Element icons for display
const ELEMENT_ICONS: Record<string, string> = {
  fire: "🔥",
  ice: "❄️",
  coldFire: "💜",
  physical: "⚔️",
};

interface ElementBreakdown {
  fire: number;
  ice: number;
  coldFire: number;
  physical: number;
}

/**
 * CombatManaDisplay - Shows player's mana tokens and crystals during combat
 */
function CombatManaDisplay() {
  const player = useMyPlayer();
  if (!player) return null;

  const { crystals, pureMana } = player;
  const hasCrystals = crystals.red > 0 || crystals.blue > 0 || crystals.green > 0 || crystals.white > 0;
  const hasTokens = pureMana.length > 0;

  if (!hasCrystals && !hasTokens) return null;

  return (
    <div className="combat-mana">
      <div className="combat-mana__label">Mana</div>
      <div className="combat-mana__content">
        {/* Crystals */}
        {hasCrystals && (
          <div className="combat-mana__group">
            {crystals.red > 0 && (
              <span className="combat-mana__crystal combat-mana__crystal--red" title="Red Crystal">
                {crystals.red}
              </span>
            )}
            {crystals.blue > 0 && (
              <span className="combat-mana__crystal combat-mana__crystal--blue" title="Blue Crystal">
                {crystals.blue}
              </span>
            )}
            {crystals.green > 0 && (
              <span className="combat-mana__crystal combat-mana__crystal--green" title="Green Crystal">
                {crystals.green}
              </span>
            )}
            {crystals.white > 0 && (
              <span className="combat-mana__crystal combat-mana__crystal--white" title="White Crystal">
                {crystals.white}
              </span>
            )}
          </div>
        )}

        {/* Tokens */}
        {hasTokens && (
          <div className="combat-mana__group combat-mana__group--tokens">
            {pureMana.map((token, i) => (
              <span
                key={i}
                className={`combat-mana__token combat-mana__token--${token.color}`}
                title={`${token.color} mana token`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
    const isRangedSiege = phase === COMBAT_PHASE_RANGED_SIEGE;

    const totalRanged = attack.ranged + attack.rangedElements.fire + attack.rangedElements.ice;
    const totalSiege = attack.siege + attack.siegeElements.fire + attack.siegeElements.ice;
    const totalNormal = attack.normal + attack.normalElements.fire + attack.normalElements.ice + attack.normalElements.coldFire + attack.normalElements.physical;

    const relevantAttack = isRangedSiege
      ? totalRanged + totalSiege
      : totalNormal + totalRanged + totalSiege;

    if (relevantAttack === 0) return null;

    // Check if any living enemies are fortified (need siege to hit in ranged phase)
    const combat = state.combat;
    const hasFortifiedEnemy = combat.enemies.some(e =>
      !e.isDefeated && (e.abilities.includes("fortified") || combat.isAtFortifiedSite)
    );

    // In ranged/siege phase, show Ranged and Siege separately when:
    // - There are fortified enemies (so player knows they need siege)
    // - Or player has both types (so they understand what they have)
    const showSeparateRangedSiege = isRangedSiege && (hasFortifiedEnemy || (totalRanged > 0 && totalSiege > 0));

    // Check if any enemies have resistances that would halve some of our attack
    const hasFireResistantEnemy = state.combat.enemies.some(e => e.resistances.includes("fire") && !e.isDefeated);
    const hasIceResistantEnemy = state.combat.enemies.some(e => e.resistances.includes("ice") && !e.isDefeated);

    // Calculate elemental breakdown for display
    const elements: ElementBreakdown = {
      fire: attack.normalElements.fire + attack.rangedElements.fire + attack.siegeElements.fire,
      ice: attack.normalElements.ice + attack.rangedElements.ice + attack.siegeElements.ice,
      coldFire: attack.normalElements.coldFire,
      physical: attack.normal + attack.ranged + attack.siege + attack.normalElements.physical,
    };
    const showElementBreakdown = elements.fire > 0 || elements.ice > 0 || elements.coldFire > 0;

    // Ranged/Siege phase with separate display
    if (showSeparateRangedSiege) {
      return (
        <div className="combat-hud__accumulator combat-hud__accumulator--attack combat-hud__accumulator--split">
          {/* Ranged section */}
          <div className="combat-hud__attack-type">
            <span className="combat-hud__accumulator-value">{totalRanged}</span>
            <span className="combat-hud__accumulator-label">Ranged</span>
          </div>

          <div className="combat-hud__attack-divider" />

          {/* Siege section - highlight if fortified enemies present */}
          <div className={`combat-hud__attack-type ${hasFortifiedEnemy && totalSiege === 0 ? "combat-hud__attack-type--warning" : ""}`}>
            <span className="combat-hud__accumulator-value">{totalSiege}</span>
            <span className="combat-hud__accumulator-label">Siege</span>
            {hasFortifiedEnemy && totalSiege === 0 && (
              <span className="combat-hud__siege-hint">needed for 🏰</span>
            )}
          </div>

          {/* Elemental breakdown */}
          {showElementBreakdown && (
            <div className="combat-hud__elements">
              {elements.fire > 0 && (
                <span className={`combat-hud__element combat-hud__element--fire ${hasFireResistantEnemy ? "combat-hud__element--halved" : ""}`}>
                  {ELEMENT_ICONS["fire"]} {elements.fire}
                  {hasFireResistantEnemy && <span className="combat-hud__halved-note">→{Math.floor(elements.fire / 2)}</span>}
                </span>
              )}
              {elements.ice > 0 && (
                <span className={`combat-hud__element combat-hud__element--ice ${hasIceResistantEnemy ? "combat-hud__element--halved" : ""}`}>
                  {ELEMENT_ICONS["ice"]} {elements.ice}
                  {hasIceResistantEnemy && <span className="combat-hud__halved-note">→{Math.floor(elements.ice / 2)}</span>}
                </span>
              )}
            </div>
          )}
        </div>
      );
    }

    // Standard single-value display (attack phase or no fortified enemies)
    return (
      <div className="combat-hud__accumulator combat-hud__accumulator--attack">
        <span className="combat-hud__accumulator-value">{relevantAttack}</span>
        <span className="combat-hud__accumulator-label">
          {isRangedSiege ? "Ranged" : "Attack"}
        </span>

        {/* Elemental breakdown */}
        {showElementBreakdown && (
          <div className="combat-hud__elements">
            {elements.physical > 0 && (
              <span className="combat-hud__element combat-hud__element--physical">
                {ELEMENT_ICONS["physical"]} {elements.physical}
              </span>
            )}
            {elements.fire > 0 && (
              <span className={`combat-hud__element combat-hud__element--fire ${hasFireResistantEnemy ? "combat-hud__element--halved" : ""}`}>
                {ELEMENT_ICONS["fire"]} {elements.fire}
                {hasFireResistantEnemy && <span className="combat-hud__halved-note">→{Math.floor(elements.fire / 2)}</span>}
              </span>
            )}
            {elements.ice > 0 && (
              <span className={`combat-hud__element combat-hud__element--ice ${hasIceResistantEnemy ? "combat-hud__element--halved" : ""}`}>
                {ELEMENT_ICONS["ice"]} {elements.ice}
                {hasIceResistantEnemy && <span className="combat-hud__halved-note">→{Math.floor(elements.ice / 2)}</span>}
              </span>
            )}
            {elements.coldFire > 0 && (
              <span className={`combat-hud__element combat-hud__element--coldFire ${hasFireResistantEnemy && hasIceResistantEnemy ? "combat-hud__element--halved" : ""}`}>
                {ELEMENT_ICONS["coldFire"]} {elements.coldFire}
                {hasFireResistantEnemy && hasIceResistantEnemy && <span className="combat-hud__halved-note">→{Math.floor(elements.coldFire / 2)}</span>}
              </span>
            )}
          </div>
        )}

        {/* Resistance warning */}
        {(hasFireResistantEnemy && elements.fire > 0) || (hasIceResistantEnemy && elements.ice > 0) ? (
          <div className="combat-hud__resistance-warning">
            ⚠️ Some enemies resist elemental attacks
          </div>
        ) : null}
      </div>
    );
  }

  // Show block accumulator in block phase
  if (phase === COMBAT_PHASE_BLOCK) {
    if (acc.block === 0) return null;

    // Get elemental block breakdown
    const blockElements = acc.blockElements;
    const hasElementalBlock = blockElements.fire > 0 || blockElements.ice > 0 || blockElements.coldFire > 0;

    return (
      <div className="combat-hud__accumulator combat-hud__accumulator--block">
        <span className="combat-hud__accumulator-value">{acc.block}</span>
        <span className="combat-hud__accumulator-label">Block</span>

        {/* Elemental block breakdown */}
        {hasElementalBlock && (
          <div className="combat-hud__elements">
            {blockElements.physical > 0 && (
              <span className="combat-hud__element combat-hud__element--physical">
                {ELEMENT_ICONS["physical"]} {blockElements.physical}
              </span>
            )}
            {blockElements.fire > 0 && (
              <span className="combat-hud__element combat-hud__element--fire">
                {ELEMENT_ICONS["fire"]} {blockElements.fire}
              </span>
            )}
            {blockElements.ice > 0 && (
              <span className="combat-hud__element combat-hud__element--ice">
                {ELEMENT_ICONS["ice"]} {blockElements.ice}
              </span>
            )}
            {blockElements.coldFire > 0 && (
              <span className="combat-hud__element combat-hud__element--coldFire">
                {ELEMENT_ICONS["coldFire"]} {blockElements.coldFire}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}

function CombatOverlayInner({ combat, combatOptions }: CombatOverlayProps) {
  const { phase, enemies } = combat;
  const { state, sendAction } = useGame();
  const canUndo = state?.validActions.turn?.canUndo ?? false;

  // Visual effect state - use a counter to force animation restart
  const [activeEffect, setActiveEffect] = useState<EffectType>(null);
  const [effectKey, setEffectKey] = useState(0);

  // Enemy detail panel state
  const [detailPanelEnemy, setDetailPanelEnemy] = useState<string | null>(null);
  const selectedEnemy = detailPanelEnemy
    ? enemies.find((e) => e.instanceId === detailPanelEnemy)
    : null;

  // Amount picker state for drag-drop overkill handling
  const [pendingDrop, setPendingDrop] = useState<{
    chip: ChipData;
    enemyInstanceId: string;
    enemyName: string;
    position: { x: number; y: number };
  } | null>(null);

  // Damage assignment panel state
  const [selectedDamageOption, setSelectedDamageOption] = useState<DamageAssignmentOption | null>(null);

  const triggerEffect = useCallback((effect: EffectType) => {
    setActiveEffect(effect);
    setEffectKey(k => k + 1); // Force animation restart
    // Clear effect after animation completes
    setTimeout(() => setActiveEffect(null), 400);
  }, []);

  // Track wounds and which enemy dealt them to trigger strike animation
  const prevWoundsRef = useRef<number>(combat.woundsThisCombat);
  const lastDamageEnemyRef = useRef<string | null>(null);

  const player = useMyPlayer();

  // When player clicks "Take Damage", check if units are available
  // If so, show the DamageAssignmentPanel. Otherwise, send damage directly to hero.
  const handleAssignDamage = useCallback((enemyInstanceId: string) => {
    lastDamageEnemyRef.current = enemyInstanceId;

    // Find the damage option for this enemy
    const damageOption = combatOptions?.damageAssignments?.find(
      (d) => d.enemyInstanceId === enemyInstanceId
    );

    // If player has units that can be assigned, show the panel
    const hasAvailableUnits = damageOption?.availableUnits?.some((u) => u.canBeAssigned) ?? false;

    if (hasAvailableUnits && damageOption) {
      setSelectedDamageOption(damageOption);
    } else {
      // No units available - assign all damage to hero
      sendAction({ type: ASSIGN_DAMAGE_ACTION, enemyInstanceId });
    }
  }, [sendAction, combatOptions?.damageAssignments]);

  // Handle damage assignment confirmation from panel
  const handleDamageAssignmentConfirm = useCallback(
    (enemyInstanceId: string, assignments: readonly DamageAssignment[]) => {
      lastDamageEnemyRef.current = enemyInstanceId;
      sendAction({
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId,
        assignments,
      });
      setSelectedDamageOption(null);
    },
    [sendAction]
  );

  // Handle damage assignment panel cancel
  const handleDamageAssignmentCancel = useCallback(() => {
    setSelectedDamageOption(null);
  }, []);

  useEffect(() => {
    const prevWounds = prevWoundsRef.current;
    const currentWounds = combat.woundsThisCombat;

    if (currentWounds > prevWounds) {
      // One hit animation per enemy attack (not per wound)
      // Impact effect at ~190ms into the animation
      const impactTime = 190;
      const animationDuration = 450;

      // Trigger screen effect at moment of impact
      setTimeout(() => {
        setActiveEffect("damage");
        setEffectKey(k => k + 1);
      }, impactTime);

      // Clear screen effect
      setTimeout(() => setActiveEffect(null), animationDuration + 100);
    }

    prevWoundsRef.current = currentWounds;
  }, [combat.woundsThisCombat]);

  const isBlockPhase = phase === COMBAT_PHASE_BLOCK;
  const isDamagePhase = phase === COMBAT_PHASE_ASSIGN_DAMAGE;
  const isAttackPhase = phase === COMBAT_PHASE_ATTACK;
  const isRangedSiegePhase = phase === COMBAT_PHASE_RANGED_SIEGE;

  // Detect touch device to use +/- buttons instead of drag-drop
  const isTouchDevice = useMemo(() => {
    // Check for touch capability
    if (typeof window === "undefined") return false;
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }, []);

  // Use drag-drop on desktop, +/- buttons on touch devices
  const useDragDrop = !isTouchDevice;

  // ========================================
  // Incremental Attack Handlers (Phase 5)
  // ========================================

  const handleAssignAttack = useCallback((option: AssignAttackOption) => {
    sendAction({
      type: ASSIGN_ATTACK_ACTION,
      enemyInstanceId: option.enemyInstanceId,
      attackType: option.attackType,
      element: option.element,
      amount: option.amount,
    });
  }, [sendAction]);

  const handleUnassignAttack = useCallback((option: UnassignAttackOption) => {
    sendAction({
      type: UNASSIGN_ATTACK_ACTION,
      enemyInstanceId: option.enemyInstanceId,
      attackType: option.attackType,
      element: option.element,
      amount: option.amount,
    });
  }, [sendAction]);

  // ========================================
  // Incremental Block Handlers (Phase 6)
  // ========================================

  const handleAssignBlock = useCallback((option: AssignBlockOption) => {
    sendAction({
      type: ASSIGN_BLOCK_ACTION,
      enemyInstanceId: option.enemyInstanceId,
      element: option.element,
      amount: option.amount,
    });
  }, [sendAction]);

  const handleUnassignBlock = useCallback((option: UnassignBlockOption) => {
    sendAction({
      type: UNASSIGN_BLOCK_ACTION,
      enemyInstanceId: option.enemyInstanceId,
      element: option.element,
      amount: option.amount,
    });
  }, [sendAction]);

  const handleCommitBlock = useCallback((enemyInstanceId: string) => {
    triggerEffect("block");
    sendAction({ type: DECLARE_BLOCK_ACTION, targetEnemyInstanceId: enemyInstanceId });
  }, [sendAction, triggerEffect]);

  // ========================================
  // Drag & Drop Handlers (PixiJS)
  // ========================================

  // Handle drag-drop completion from CombatDragContext
  const handleDragAssign = useCallback((chip: ChipData, enemyInstanceId: string) => {
    // Find enemy name for the picker
    const enemy = enemies.find(e => e.instanceId === enemyInstanceId);
    if (!enemy) return;

    // For now, always assign the full amount (no overkill detection yet)
    // TODO: Add overkill detection and show amount picker
    if (chip.poolType === "attack" && "attackType" in chip) {
      const damageChip = chip as DamageChipData;
      triggerEffect("attack");
      sendAction({
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId,
        attackType: damageChip.attackType,
        element: damageChip.element,
        amount: damageChip.amount,
      });
    } else if (chip.poolType === "block") {
      const blockChip = chip as BlockChipData;
      sendAction({
        type: ASSIGN_BLOCK_ACTION,
        enemyInstanceId,
        element: blockChip.element,
        amount: blockChip.amount,
      });
    }
  }, [enemies, sendAction, triggerEffect]);

  // Handle amount picker confirmation
  const handleAmountConfirm = useCallback((amount: number) => {
    if (!pendingDrop) return;

    const { chip, enemyInstanceId } = pendingDrop;
    if (chip.poolType === "attack" && "attackType" in chip) {
      const damageChip = chip as DamageChipData;
      triggerEffect("attack");
      sendAction({
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId,
        attackType: damageChip.attackType,
        element: damageChip.element,
        amount,
      });
    } else if (chip.poolType === "block") {
      const blockChip = chip as BlockChipData;
      sendAction({
        type: ASSIGN_BLOCK_ACTION,
        enemyInstanceId,
        element: blockChip.element,
        amount,
      });
    }
    setPendingDrop(null);
  }, [pendingDrop, sendAction, triggerEffect]);

  const handleAmountCancel = useCallback(() => {
    setPendingDrop(null);
  }, []);

  // Calculate if all enemies can be defeated (for continue button pulse)
  // Note: combatOptions may be undefined during choice resolution
  const allEnemiesDefeatable = combatOptions?.enemies?.every(
    e => e.isDefeated || e.canDefeat
  ) ?? false;

  // Calculate token positions for PixiEnemyCard (must match PixiEnemyTokens layout)
  const enemyCardData = useMemo(() => {
    // Match CSS clamp: clamp(100px, min(18vw, 28vh), 280px)
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tokenSize = Math.min(Math.max(100, Math.min(vw * 0.18, vh * 0.28)), 280);
    const tokenRadius = tokenSize / 2;

    const gap = 32;
    const totalWidth = enemies.length * tokenSize + (enemies.length - 1) * gap;
    const startX = (vw - totalWidth) / 2;
    const baseY = vh * 0.38;

    return enemies.map((enemy, index) => {
      const damageOption = combatOptions?.damageAssignments?.find(d => d.enemyInstanceId === enemy.instanceId);
      const enemyAttackState = combatOptions?.enemies?.find(e => e.enemyInstanceId === enemy.instanceId);
      const assignableAttacks = combatOptions?.assignableAttacks?.filter(a => a.enemyInstanceId === enemy.instanceId) ?? [];
      const unassignableAttacks = combatOptions?.unassignableAttacks?.filter(u => u.enemyInstanceId === enemy.instanceId) ?? [];
      const enemyBlockState = combatOptions?.enemyBlockStates?.find(e => e.enemyInstanceId === enemy.instanceId);
      const assignableBlocks = combatOptions?.assignableBlocks?.filter(b => b.enemyInstanceId === enemy.instanceId) ?? [];
      const unassignableBlocks = combatOptions?.unassignableBlocks?.filter(u => u.enemyInstanceId === enemy.instanceId) ?? [];

      return {
        enemy,
        position: {
          x: startX + index * (tokenSize + gap) + tokenRadius,
          y: baseY,
        },
        tokenRadius,
        isBlockPhase,
        enemyBlockState,
        assignableBlocks,
        unassignableBlocks,
        isDamagePhase,
        damageOption,
        isAttackPhase: isAttackPhase || isRangedSiegePhase,
        isRangedSiegePhase,
        enemyAttackState,
        assignableAttacks,
        unassignableAttacks,
        canDefeat: enemyAttackState?.canDefeat ?? false,
        useDragDrop,
      };
    });
  }, [enemies, combatOptions, isBlockPhase, isDamagePhase, isAttackPhase, isRangedSiegePhase, useDragDrop]);

  return (
    <CombatDragProvider onAssign={handleDragAssign}>
    <div className="combat-scene" data-testid="combat-overlay">
      {/* PixiJS Screen Effects - damage/block/attack flashes */}
      <PixiScreenEffects activeEffect={activeEffect} effectKey={effectKey} />

      {/* PixiJS Phase Rail - renders to canvas */}
      <PixiPhaseRail
        currentPhase={phase}
        canEndPhase={combatOptions?.canEndPhase ?? false}
        onEndPhase={() => sendAction({ type: END_COMBAT_PHASE_ACTION })}
        allEnemiesDefeatable={allEnemiesDefeatable && (isAttackPhase || isRangedSiegePhase)}
      />

      {/* PixiJS Enemy Tokens - renders token visuals to canvas */}
      <PixiEnemyTokens
        enemies={enemies.map((enemy) => ({
          enemy,
          canDefeat: combatOptions?.enemies?.find(e => e.enemyInstanceId === enemy.instanceId)?.canDefeat ?? false,
        }))}
      />

      {/* PixiJS Enemy Cards - renders allocation UI below tokens */}
      <PixiEnemyCard
        enemies={enemyCardData}
        onEnemyClick={setDetailPanelEnemy}
        onAssignBlockIncremental={handleAssignBlock}
        onUnassignBlock={handleUnassignBlock}
        onCommitBlock={handleCommitBlock}
        onAssignDamage={handleAssignDamage}
        onAssignAttack={(option) => {
          triggerEffect("attack");
          handleAssignAttack(option);
        }}
        onUnassignAttack={handleUnassignAttack}
      />

      {/* PixiJS Attack/Block pools and power line - render to canvas */}
      {useDragDrop && (isAttackPhase || isRangedSiegePhase) && combatOptions?.availableAttack && (
        <PixiAttackPool
          availableAttack={combatOptions.availableAttack}
          isRangedSiegePhase={isRangedSiegePhase}
          showSiegeWarning={combat.isAtFortifiedSite}
        />
      )}
      {useDragDrop && isBlockPhase && combatOptions?.availableBlock && (
        <PixiBlockPool availableBlock={combatOptions.availableBlock} />
      )}
      <PixiPowerLine />

      {/* Main layout: battle area (phase rail now rendered by PixiPhaseRail) */}
      <div className="combat-scene__layout">
        {/* Battle area with enemies */}
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

          {/* Player's mana tokens/crystals */}
          <div className="combat-scene__mana-resources">
            <CombatManaDisplay />
          </div>

          {/* Enemies - layout placeholder for positioning, actual tokens rendered by PixiEnemyTokens */}
          <div className="combat-scene__enemies" />

          {/* Legacy accumulated power display (mobile fallback or when pool data unavailable) */}
          {(!useDragDrop || (!combatOptions?.availableAttack && !combatOptions?.availableBlock)) && (
            <AccumulatorDisplay />
          )}
        </div>

      </div>

      {/* Amount picker modal for overkill handling */}
      {pendingDrop && (
        <AmountPicker
          maxAmount={pendingDrop.chip.amount}
          attackType={"attackType" in pendingDrop.chip ? pendingDrop.chip.attackType : undefined}
          element={pendingDrop.chip.element}
          enemyName={pendingDrop.enemyName}
          position={pendingDrop.position}
          mode={pendingDrop.chip.poolType === "block" ? "block" : "attack"}
          onConfirm={handleAmountConfirm}
          onCancel={handleAmountCancel}
        />
      )}

      {/* Enemy Detail Panel - full rulebook details (stays HTML for complex layout) */}
      {selectedEnemy && (
        <EnemyDetailPanel
          enemy={selectedEnemy}
          onClose={() => setDetailPanelEnemy(null)}
        />
      )}

      {/* Damage Assignment Panel - unit selection for damage absorption */}
      {selectedDamageOption && player && (
        <DamageAssignmentPanel
          damageOption={selectedDamageOption}
          onAssign={handleDamageAssignmentConfirm}
          onCancel={handleDamageAssignmentCancel}
          handLimit={player.handLimit}
          woundsThisCombat={combat.woundsThisCombat}
        />
      )}
    </div>
    </CombatDragProvider>
  );
}

// Export the component with provider
export { CombatOverlayInner as CombatOverlay };
