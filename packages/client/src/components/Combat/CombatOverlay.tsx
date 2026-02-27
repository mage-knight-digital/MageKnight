/**
 * CombatOverlay - Combat UI that floats over the dimmed game board
 *
 * Wired to Rust LegalActions — all combat actions are derived from the
 * legalActions[] array via useCombatActions().
 *
 * No modal - enemies appear as large tokens floating over the board,
 * player hand stays visible at bottom.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { ClientCombatState } from "@mage-knight/shared";
import {
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import type { BasicManaColor } from "@mage-knight/shared";
import { PixiEnemyCard } from "./PixiEnemyCard";
import { EnemyDetailPanel } from "./EnemyDetailPanel";
import { PixiPhaseRail } from "./PixiPhaseRail";
import { PixiEnemyTokens } from "./PixiEnemyTokens";
import { PixiScreenEffects } from "./PixiScreenEffects";
import { ManaSourceOverlay } from "../GameBoard/ManaSourceOverlay";
import { DamageAssignmentPanel } from "./DamageAssignmentPanel";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useCombatActions } from "../../hooks/useCombatActions";
import type { LegalAction } from "../../rust/types";
import "./CombatOverlay.css";

type EffectType = "damage" | "block" | "attack" | null;

interface CombatOverlayProps {
  combat: ClientCombatState;
}


// Element icons for display
const ELEMENT_ICONS: Record<string, string> = {
  fire: "\uD83D\uDD25",
  ice: "\u2744\uFE0F",
  coldFire: "\uD83D\uDC9C",
  physical: "\u2694\uFE0F",
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

  const { crystals, manaTokens } = player;
  const hasCrystals = crystals.red > 0 || crystals.blue > 0 || crystals.green > 0 || crystals.white > 0;
  const hasTokens = manaTokens.length > 0;

  if (!hasCrystals && !hasTokens) return null;

  // TODO: Wire crystal conversion via Rust legal actions
  const convertibleColors: readonly BasicManaColor[] = [];

  const handleCrystalClick = (_color: BasicManaColor) => {
    // Crystal conversion is handled inline via card play mana sourcing
  };

  const crystalEntries: { color: BasicManaColor; label: string }[] = [
    { color: MANA_RED, label: "Red Crystal" },
    { color: MANA_BLUE, label: "Blue Crystal" },
    { color: MANA_GREEN, label: "Green Crystal" },
    { color: MANA_WHITE, label: "White Crystal" },
  ];

  return (
    <div className="combat-mana">
      <div className="combat-mana__label">Mana</div>
      <div className="combat-mana__content">
        {/* Crystals */}
        {hasCrystals && (
          <div className="combat-mana__group">
            {crystalEntries.map(({ color, label }) => {
              if (crystals[color] <= 0) return null;
              const isClickable = convertibleColors.includes(color);
              return (
                <span
                  key={color}
                  className={`combat-mana__crystal combat-mana__crystal--${color}${isClickable ? " combat-mana__crystal--clickable" : ""}`}
                  title={isClickable ? `Convert ${label} to mana token` : label}
                  onClick={() => handleCrystalClick(color)}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") handleCrystalClick(color); } : undefined}
                >
                  {crystals[color]}
                </span>
              );
            })}
          </div>
        )}

        {/* Tokens */}
        {hasTokens && (
          <div className="combat-mana__group combat-mana__group--tokens">
            {manaTokens.map((token, i) => (
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
              <span className="combat-hud__siege-hint">needed for \uD83C\uDFF0</span>
            )}
          </div>

          {/* Elemental breakdown */}
          {showElementBreakdown && (
            <div className="combat-hud__elements">
              {elements.fire > 0 && (
                <span className={`combat-hud__element combat-hud__element--fire ${hasFireResistantEnemy ? "combat-hud__element--halved" : ""}`}>
                  {ELEMENT_ICONS["fire"]} {elements.fire}
                  {hasFireResistantEnemy && <span className="combat-hud__halved-note">\u2192{Math.floor(elements.fire / 2)}</span>}
                </span>
              )}
              {elements.ice > 0 && (
                <span className={`combat-hud__element combat-hud__element--ice ${hasIceResistantEnemy ? "combat-hud__element--halved" : ""}`}>
                  {ELEMENT_ICONS["ice"]} {elements.ice}
                  {hasIceResistantEnemy && <span className="combat-hud__halved-note">\u2192{Math.floor(elements.ice / 2)}</span>}
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
                {hasFireResistantEnemy && <span className="combat-hud__halved-note">\u2192{Math.floor(elements.fire / 2)}</span>}
              </span>
            )}
            {elements.ice > 0 && (
              <span className={`combat-hud__element combat-hud__element--ice ${hasIceResistantEnemy ? "combat-hud__element--halved" : ""}`}>
                {ELEMENT_ICONS["ice"]} {elements.ice}
                {hasIceResistantEnemy && <span className="combat-hud__halved-note">\u2192{Math.floor(elements.ice / 2)}</span>}
              </span>
            )}
            {elements.coldFire > 0 && (
              <span className={`combat-hud__element combat-hud__element--coldFire ${hasFireResistantEnemy && hasIceResistantEnemy ? "combat-hud__element--halved" : ""}`}>
                {ELEMENT_ICONS["coldFire"]} {elements.coldFire}
                {hasFireResistantEnemy && hasIceResistantEnemy && <span className="combat-hud__halved-note">\u2192{Math.floor(elements.coldFire / 2)}</span>}
              </span>
            )}
          </div>
        )}

        {/* Resistance warning */}
        {(hasFireResistantEnemy && elements.fire > 0) || (hasIceResistantEnemy && elements.ice > 0) ? (
          <div className="combat-hud__resistance-warning">
            \u26A0\uFE0F Some enemies resist elemental attacks
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

function CombatOverlayInner({ combat }: CombatOverlayProps) {
  const { phase, enemies } = combat;
  const { sendAction } = useGame();
  const combatActions = useCombatActions();

  // Visual effect state - use a counter to force animation restart
  const [activeEffect, setActiveEffect] = useState<EffectType>(null);
  const [effectKey, setEffectKey] = useState(0);

  // Enemy detail panel state
  const [detailPanelEnemy, setDetailPanelEnemy] = useState<string | null>(null);
  const selectedEnemy = detailPanelEnemy
    ? enemies.find((e) => e.instanceId === detailPanelEnemy)
    : null;

  // Damage assignment panel state — tracks which enemy's damage is being assigned
  // When set, shows the DamageAssignmentPanel with available unit options
  const [damageAssignmentEnemy, setDamageAssignmentEnemy] = useState<{
    enemyIndex: number;
    attackIndex: number;
    heroAction: LegalAction;
    unitActions: { unitInstanceId: string; action: LegalAction }[];
  } | null>(null);

  const triggerEffect = useCallback((effect: EffectType) => {
    setActiveEffect(effect);
    setEffectKey(k => k + 1);
    setTimeout(() => setActiveEffect(null), 400);
  }, []);

  // Track wounds to trigger strike animation
  const prevWoundsRef = useRef<number>(combat.woundsThisCombat);

  const player = useMyPlayer();

  useEffect(() => {
    const prevWounds = prevWoundsRef.current;
    const currentWounds = combat.woundsThisCombat;

    if (currentWounds > prevWounds) {
      const impactTime = 190;
      const animationDuration = 450;

      setTimeout(() => {
        setActiveEffect("damage");
        setEffectKey(k => k + 1);
      }, impactTime);

      setTimeout(() => setActiveEffect(null), animationDuration + 100);
    }

    prevWoundsRef.current = currentWounds;
  }, [combat.woundsThisCombat]);

  const isBlockPhase = phase === COMBAT_PHASE_BLOCK;
  const isDamagePhase = phase === COMBAT_PHASE_ASSIGN_DAMAGE;
  const isAttackPhase = phase === COMBAT_PHASE_ATTACK;
  const isRangedSiegePhase = phase === COMBAT_PHASE_RANGED_SIEGE;

  // Reset damage assignment panel when phase changes
  useEffect(() => {
    setDamageAssignmentEnemy(null);
  }, [phase]);

  // Calculate token positions for PixiEnemyCard (must match PixiEnemyTokens layout)
  const enemyCardData = useMemo(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tokenSize = Math.min(Math.max(100, Math.min(vw * 0.18, vh * 0.28)), 280);
    const tokenRadius = tokenSize / 2;

    const gap = 32;
    const totalWidth = enemies.length * tokenSize + (enemies.length - 1) * gap;
    const startX = (vw - totalWidth) / 2;
    const baseY = vh * 0.38;

    return enemies.map((enemy, index) => {
      // Block actions for this enemy
      const enemyBlockActions = combatActions.blockActions.filter(
        b => b.enemyInstanceId === enemy.instanceId
      );
      // Cumbersome actions for this enemy
      const enemyCumbersomeAction = combatActions.cumbersomeActions.find(
        c => c.enemyInstanceId === enemy.instanceId
      );
      // Banner fear actions for this enemy
      const enemyBannerFearActions = combatActions.bannerFearActions.filter(
        b => b.enemyInstanceId === enemy.instanceId
      );

      // Damage: find hero/unit actions for this enemy (by enemy index)
      const enemyIndex = index; // enemies array is in order
      const damageToHero = combatActions.damageToHeroOptions.find(
        d => d.enemyIndex === enemyIndex
      );
      const damageToUnits = combatActions.damageToUnitOptions.filter(
        d => d.enemyIndex === enemyIndex
      );

      // SubsetSelect: map index to enemy (non-defeated, in combat order)
      const subsetSelectAction = combatActions.subsetSelectOptions.find(
        s => {
          // Map subset index to eligible enemies (non-defeated, ordered)
          const eligible = enemies.filter(e => !e.isDefeated);
          const eligibleIndex = eligible.findIndex(e => e.instanceId === enemy.instanceId);
          return eligibleIndex === s.index;
        }
      );

      return {
        enemy,
        position: {
          x: startX + index * (tokenSize + gap) + tokenRadius,
          y: baseY,
        },
        tokenRadius,

        // Block phase
        isBlockPhase,
        blockActions: enemyBlockActions,
        cumbersomeAction: enemyCumbersomeAction,
        bannerFearActions: enemyBannerFearActions,

        // Damage phase
        isDamagePhase,
        damageToHeroAction: damageToHero,
        damageToUnitActions: damageToUnits,

        // Attack phase
        isAttackPhase: isAttackPhase || isRangedSiegePhase,
        isRangedSiegePhase,

        // Attack: initiate or target selection
        isSelectingTargets: combatActions.isSelectingTargets,
        subsetSelectAction,

        // canDefeat: no longer sent from TS options, use enemy.isDefeated as proxy
        canDefeat: false,
      };
    });
  }, [enemies, combatActions, isBlockPhase, isDamagePhase, isAttackPhase, isRangedSiegePhase]);

  // Handle "Take Damage" button on enemy card
  // If units are available, show the DamageAssignmentPanel. Otherwise, send hero damage directly.
  const handleAssignDamage = useCallback((enemyIndex: number) => {
    const heroOpt = combatActions.damageToHeroOptions.find(d => d.enemyIndex === enemyIndex);
    const unitOpts = combatActions.damageToUnitOptions.filter(d => d.enemyIndex === enemyIndex);

    if (!heroOpt) return;

    if (unitOpts.length > 0) {
      // Show DamageAssignmentPanel for unit selection
      setDamageAssignmentEnemy({
        enemyIndex,
        attackIndex: heroOpt.attackIndex,
        heroAction: heroOpt.action,
        unitActions: unitOpts.map(u => ({ unitInstanceId: u.unitInstanceId, action: u.action })),
      });
    } else {
      // No units — send damage directly to hero
      sendAction(heroOpt.action);
    }
  }, [combatActions.damageToHeroOptions, combatActions.damageToUnitOptions, sendAction]);

  return (
    <div className="combat-scene" data-testid="combat-overlay">
      {/* PixiJS Screen Effects - damage/block/attack flashes */}
      <PixiScreenEffects activeEffect={activeEffect} effectKey={effectKey} />

      {/* PixiJS Phase Rail - renders to canvas */}
      <PixiPhaseRail
        currentPhase={phase}
        canEndPhase={combatActions.canEndPhase}
        onEndPhase={() => combatActions.endPhaseAction && sendAction(combatActions.endPhaseAction)}
        allEnemiesDefeatable={false}
      />

      {/* PixiJS Enemy Tokens - renders token visuals to canvas */}
      <PixiEnemyTokens
        enemies={enemies.map((enemy) => ({
          enemy,
          canDefeat: false,
        }))}
      />

      {/* PixiJS Enemy Cards - renders allocation UI below tokens */}
      <PixiEnemyCard
        enemies={enemyCardData}
        onEnemyClick={setDetailPanelEnemy}
        onSendAction={sendAction}
        onAssignDamage={handleAssignDamage}
        onTriggerEffect={triggerEffect}
      />

      {/* Main layout: battle area */}
      <div className="combat-scene__layout">
        <div className="combat-scene__battlefield">
          {/* Undo button */}
          {combatActions.canUndo && combatActions.undoAction && (
            <button
              className="combat-scene__undo"
              onClick={() => sendAction(combatActions.undoAction!)}
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

          {/* Enemies - layout placeholder for positioning */}
          <div className="combat-scene__enemies" />

          {/* Initiate Attack buttons (pre-target-selection) */}
          {combatActions.initiateAttackOptions.length > 0 && !combatActions.isSelectingTargets && (
            <div className="combat-scene__initiate-attacks">
              {combatActions.initiateAttackOptions.map((opt) => (
                <button
                  key={opt.attackType}
                  className="combat-scene__initiate-attack-btn"
                  onClick={() => {
                    triggerEffect("attack");
                    sendAction(opt.action);
                  }}
                  type="button"
                >
                  {opt.attackType === "ranged" ? "Ranged Attack" :
                   opt.attackType === "siege" ? "Siege Attack" : "Attack"}
                </button>
              ))}
              {combatActions.convertMoveToAttack.map((opt, i) => (
                <button
                  key={`convert-move-${i}`}
                  className="combat-scene__initiate-attack-btn combat-scene__initiate-attack-btn--convert"
                  onClick={() => sendAction(opt.action)}
                  type="button"
                >
                  Convert {opt.movePoints} Move \u2192 {opt.attackType === "ranged" ? "Ranged" : opt.attackType === "siege" ? "Siege" : "Attack"}
                </button>
              ))}
            </div>
          )}

          {/* Subset Confirm button (target selection active) */}
          {combatActions.isSelectingTargets && combatActions.subsetConfirmAction && (
            <button
              className="combat-scene__declare-targets"
              onClick={() => {
                triggerEffect("attack");
                sendAction(combatActions.subsetConfirmAction!);
              }}
              type="button"
            >
              Confirm Attack
            </button>
          )}

          {/* Convert Influence to Block buttons */}
          {combatActions.convertInfluenceToBlock.length > 0 && (
            <div className="combat-scene__convert-influence">
              {combatActions.convertInfluenceToBlock.map((opt, i) => (
                <button
                  key={`convert-inf-${i}`}
                  className="combat-scene__convert-influence-btn"
                  onClick={() => sendAction(opt.action)}
                  type="button"
                >
                  Convert {opt.influencePoints} Influence \u2192 Block
                </button>
              ))}
            </div>
          )}

          {/* Heroes Assault action */}
          {combatActions.payHeroesAssaultAction && (
            <button
              className="combat-scene__heroes-assault-btn"
              onClick={() => sendAction(combatActions.payHeroesAssaultAction!)}
              type="button"
            >
              Pay Heroes Assault
            </button>
          )}

          {/* Accumulated power display */}
          <AccumulatorDisplay />
        </div>
      </div>

      {/* Enemy Detail Panel - full rulebook details */}
      {selectedEnemy && (
        <EnemyDetailPanel
          enemy={selectedEnemy}
          onClose={() => setDetailPanelEnemy(null)}
        />
      )}

      {/* Damage Assignment Panel - unit selection for damage absorption */}
      {damageAssignmentEnemy && player && (
        <DamageAssignmentPanel
          enemyIndex={damageAssignmentEnemy.enemyIndex}
          attackIndex={damageAssignmentEnemy.attackIndex}
          enemyName={enemies[damageAssignmentEnemy.enemyIndex]?.name ?? "Enemy"}
          heroAction={damageAssignmentEnemy.heroAction}
          unitActions={damageAssignmentEnemy.unitActions}
          onSendAction={(action) => {
            sendAction(action);
            setDamageAssignmentEnemy(null);
          }}
          onCancel={() => setDamageAssignmentEnemy(null)}
          combat={combat}
        />
      )}
    </div>
  );
}

// Export the component
export { CombatOverlayInner as CombatOverlay };
