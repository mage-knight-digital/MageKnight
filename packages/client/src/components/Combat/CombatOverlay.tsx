/**
 * CombatOverlay - Combat UI that floats over the dimmed game board
 *
 * No modal - enemies appear as large tokens floating over the board,
 * player hand stays visible at bottom.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
import { EnemyCard } from "./EnemyCard";
import { VerticalPhaseRail } from "./VerticalPhaseRail";
import { ManaSourceOverlay } from "../GameBoard/ManaSourceOverlay";
import { CombatDnDProvider, type ChipData, type DamageChipData, type BlockChipData } from "./DnDContext";
import { AttackPool } from "./AttackPool";
import { DamageChipPreview } from "./AttackPool/DamageChip";
import { BlockPool } from "./BlockPool";
import { BlockChipPreview } from "./BlockPool/BlockChip";
import { AmountPicker } from "./AmountPicker";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { hexKey } from "@mage-knight/shared";
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
  // Adventure sites
  ancient_ruins: { col: 0, row: 0 },
  tomb: { col: 2, row: 3 },
  spawning_grounds: { col: 1, row: 3 },
  dungeon: { col: 3, row: 1 },  // labyrinth sprite
  monster_den: { col: 0, row: 0 },  // ancient ruins sprite

  // Fortified sites
  keep: { col: 2, row: 1 },
  mage_tower: { col: 2, row: 1 },  // keep sprite as fallback

  // Cities
  city: { col: 1, row: 0 },  // default to blue city
  city_blue: { col: 1, row: 0 },
  city_green: { col: 2, row: 0 },
  city_red: { col: 3, row: 0 },
  city_white: { col: 4, row: 0 },

  // Safe sites
  village: { col: 3, row: 3 },
  monastery: { col: 0, row: 2 },
  magical_glade: { col: 1, row: 2 },  // necropolis sprite (green/mystical) - TODO: need proper glade sprite

  // Resource sites
  deep_mine: { col: 0, row: 1 },
  mine: { col: 0, row: 1 },  // same as deep_mine

  // Rampaging enemies
  orc_marauder: { col: 4, row: 2 },
  draconum: { col: 1, row: 1 },

  // Other
  refugee_camp: { col: 0, row: 3 },
  labyrinth: { col: 3, row: 1 },
  necropolis: { col: 1, row: 2 },
};

interface StrikingEnemy {
  instanceId: string;
  strikeKey: number;
}

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
    const hasFireResistantEnemy = state.combat.enemies.some(e => e.resistances.fire && !e.isDefeated);
    const hasIceResistantEnemy = state.combat.enemies.some(e => e.resistances.ice && !e.isDefeated);

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
  const player = useMyPlayer();
  const canUndo = state?.validActions.turn?.canUndo ?? false;

  // Get site type or rampaging enemy type from player's current position
  const backdropType = (() => {
    if (!player?.position || !state?.map.hexes) return null;
    const key = hexKey(player.position);
    const hex = state.map.hexes[key];

    // Check for site first
    if (hex?.site?.type) {
      // For cities, use the specific city color sprite
      if (hex.site.type === 'city' && hex.site.cityColor) {
        return `city_${hex.site.cityColor}`;
      }
      return hex.site.type;
    }

    // Check for rampaging enemies (use first one as backdrop)
    if (hex?.rampagingEnemies && hex.rampagingEnemies.length > 0) {
      return hex.rampagingEnemies[0];
    }

    // Fallback: check combat enemies for green tokens (orc marauders)
    // Green enemies = orc marauder territory
    if (combat.enemies.length > 0) {
      const greenEnemyIds = ['diggers', 'prowlers', 'cursed_hags', 'wolf_riders', 'ironclads', 'orc_summoners'];
      const enemyIds = combat.enemies.map(e => e.enemyId);
      if (enemyIds.some(id => greenEnemyIds.includes(id))) {
        return 'orc_marauder';
      }
      // Note: Draconum uses red enemies (not implemented yet)
    }

    return null;
  })();

  // Get sprite position for the backdrop (or null to hide)
  const siteSprite = backdropType ? SITE_SPRITE_MAP[backdropType] : null;

  // Visual effect state - use a counter to force animation restart
  const [activeEffect, setActiveEffect] = useState<EffectType>(null);
  const [effectKey, setEffectKey] = useState(0);
  const [strikingEnemy, setStrikingEnemy] = useState<StrikingEnemy | null>(null);
  const [attackedEnemies, setAttackedEnemies] = useState<Set<string>>(new Set());

  // Amount picker state for drag-drop overkill handling
  const [pendingDrop, setPendingDrop] = useState<{
    chip: ChipData;
    enemyInstanceId: string;
    enemyName: string;
    position: { x: number; y: number };
  } | null>(null);

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
  // Drag & Drop Handlers
  // ========================================

  // Handle drag-drop completion - may show amount picker for overkill
  const handleDragEnd = useCallback((chip: ChipData, enemyInstanceId: string) => {
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

  // Render drag overlay preview
  const renderDragOverlay = useCallback((chip: ChipData) => {
    if (chip.poolType === "attack" && "attackType" in chip) {
      const damageChip = chip as DamageChipData;
      return (
        <DamageChipPreview
          attackType={damageChip.attackType}
          element={damageChip.element}
          amount={damageChip.amount}
        />
      );
    } else {
      const blockChip = chip as BlockChipData;
      return (
        <BlockChipPreview
          element={blockChip.element}
          amount={blockChip.amount}
        />
      );
    }
  }, []);

  // Calculate if all enemies can be defeated (for continue button pulse)
  // Note: combatOptions may be undefined during choice resolution
  const allEnemiesDefeatable = combatOptions?.enemies?.every(
    e => e.isDefeated || e.canDefeat
  ) ?? false;

  return (
    <CombatDnDProvider onDragEnd={handleDragEnd} renderDragOverlay={renderDragOverlay}>
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
        <div
          className="combat-scene__backdrop"
          style={{
            backgroundImage: `url(${SITES_SHEET.src})`,
            // Position as percentage of sprite sheet (col/totalCols, row/totalRows)
            backgroundPosition: `${(siteSprite.col / (SITES_SHEET.cols - 1)) * 100}% ${(siteSprite.row / (SITES_SHEET.rows - 1)) * 100}%`,
            // Size so each sprite fills the container (totalCols * 100%, totalRows * 100%)
            backgroundSize: `${SITES_SHEET.cols * 100}% ${SITES_SHEET.rows * 100}%`,
          }}
          role="presentation"
        />
      )}

      {/* Main layout: phase rail | battle area | info panel */}
      <div className="combat-scene__layout">
        {/* Left - Vertical phase rail */}
        <div className="combat-scene__phase-rail">
          <VerticalPhaseRail
            currentPhase={phase}
            canEndPhase={combatOptions?.canEndPhase ?? false}
            onEndPhase={() => sendAction({ type: END_COMBAT_PHASE_ACTION })}
            allEnemiesDefeatable={allEnemiesDefeatable && (isAttackPhase || isRangedSiegePhase)}
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

          {/* Player's mana tokens/crystals */}
          <div className="combat-scene__mana-resources">
            <CombatManaDisplay />
          </div>

          {/* Enemies */}
          <div className="combat-scene__enemies">
            {enemies.map((enemy) => {
              // Note: combatOptions may be undefined during choice resolution
              const blockOption = combatOptions?.blocks?.find(b => b.enemyInstanceId === enemy.instanceId);
              const damageOption = combatOptions?.damageAssignments?.find(d => d.enemyInstanceId === enemy.instanceId);

              // Phase 5: Use incremental attack allocation from server
              const enemyAttackState = combatOptions?.enemies?.find(e => e.enemyInstanceId === enemy.instanceId);
              const assignableAttacks = combatOptions?.assignableAttacks?.filter(a => a.enemyInstanceId === enemy.instanceId) ?? [];
              const unassignableAttacks = combatOptions?.unassignableAttacks?.filter(u => u.enemyInstanceId === enemy.instanceId) ?? [];

              // Phase 6: Use incremental block allocation from server
              const enemyBlockState = combatOptions?.enemyBlockStates?.find(e => e.enemyInstanceId === enemy.instanceId);
              const assignableBlocks = combatOptions?.assignableBlocks?.filter(b => b.enemyInstanceId === enemy.instanceId) ?? [];
              const unassignableBlocks = combatOptions?.unassignableBlocks?.filter(u => u.enemyInstanceId === enemy.instanceId) ?? [];

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
                  enemyBlockState={enemyBlockState}
                  assignableBlocks={assignableBlocks}
                  unassignableBlocks={unassignableBlocks}
                  onAssignBlockIncremental={handleAssignBlock}
                  onUnassignBlock={handleUnassignBlock}
                  onCommitBlock={handleCommitBlock}
                  isDamagePhase={isDamagePhase}
                  damageOption={damageOption}
                  onAssignDamage={handleAssignDamage}
                  isAttackPhase={isAttackPhase || isRangedSiegePhase}
                  enemyAttackState={enemyAttackState}
                  assignableAttacks={assignableAttacks}
                  unassignableAttacks={unassignableAttacks}
                  onAssignAttack={(option) => {
                    triggerEffect("attack");
                    handleAssignAttack(option);
                  }}
                  onUnassignAttack={handleUnassignAttack}
                  isRangedSiegePhase={isRangedSiegePhase}
                  isStriking={isStriking}
                  strikeKey={strikeKey}
                  hasAttacked={hasAttacked}
                  isAtFortifiedSite={combat.isAtFortifiedSite}
                  useDragDrop={useDragDrop}
                />
              );
            })}
          </div>

          {/* Drag-drop pool display (desktop only) */}
          {useDragDrop && (isAttackPhase || isRangedSiegePhase) && combatOptions?.availableAttack && (
            <div className="combat-scene__pool">
              <AttackPool
                availableAttack={combatOptions.availableAttack}
                showSiegeWarning={combat.isAtFortifiedSite}
                isRangedSiegePhase={isRangedSiegePhase}
              />
            </div>
          )}
          {useDragDrop && isBlockPhase && combatOptions?.availableBlock && (
            <div className="combat-scene__pool">
              <BlockPool availableBlock={combatOptions.availableBlock} />
            </div>
          )}

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
    </div>
    </CombatDnDProvider>
  );
}

// Export the component with provider
export { CombatOverlayInner as CombatOverlay };
