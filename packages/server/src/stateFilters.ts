/**
 * State Filtering Module
 *
 * Converts full GameState to filtered ClientGameState for specific players.
 * Filters sensitive information (other players' hands, deck contents, etc.)
 */

import type {
  GameState,
  Player,
  CombatState,
  HexEnemy,
  RuinsToken,
} from "@mage-knight/core";
import {
  getValidActions,
  describeEffect,
  mineColorToBasicManaColor,
} from "@mage-knight/core";
import type {
  ClientGameState,
  ClientPlayer,
  ClientPlayerUnit,
  ClientManaToken,
  ClientPendingChoice,
  ClientPendingDiscard,
  ClientCombatState,
  ClientCombatEnemy,
  ClientHexEnemy,
  ClientRuinsToken,
} from "@mage-knight/shared";

/**
 * Convert full GameState to ClientGameState for a specific player.
 * Filters sensitive information (other players' hands, deck contents, etc.)
 */
export function toClientState(
  state: GameState,
  forPlayerId: string
): ClientGameState {
  return {
    phase: state.phase,
    roundPhase: state.roundPhase,
    timeOfDay: state.timeOfDay,
    round: state.round,
    currentPlayerId: state.turnOrder[state.currentPlayerIndex] ?? "",
    turnOrder: state.turnOrder,
    endOfRoundAnnouncedBy: state.endOfRoundAnnouncedBy,

    players: state.players.map((player) =>
      toClientPlayer(player, forPlayerId)
    ),

    map: {
      hexes: Object.fromEntries(
        Object.entries(state.map.hexes).map(([key, hex]) => [
          key,
          {
            coord: hex.coord,
            terrain: hex.terrain,
            tileId: hex.tileId,
            site: hex.site
              ? {
                  type: hex.site.type,
                  owner: hex.site.owner,
                  isConquered: hex.site.isConquered,
                  isBurned: hex.site.isBurned,
                  ...(hex.site.cityColor && { cityColor: hex.site.cityColor }),
                  ...(hex.site.mineColor && { mineColor: hex.site.mineColor }),
                }
              : null,
            enemies: hex.enemies.map((enemy): ClientHexEnemy =>
              toClientHexEnemy(enemy)
            ),
            ruinsToken: hex.ruinsToken
              ? toClientRuinsToken(hex.ruinsToken)
              : null,
            shieldTokens: [...hex.shieldTokens],
            rampagingEnemies: hex.rampagingEnemies.map(String),
          },
        ])
      ),
      tiles: state.map.tiles.map((tile) => ({
        centerCoord: tile.centerCoord,
        revealed: tile.revealed,
        // Only include tileId for revealed tiles to prevent map hacking
        ...(tile.revealed && { tileId: tile.tileId }),
      })),
      tileSlots: state.map.tileSlots,
    },

    source: {
      dice: state.source.dice.map((die) => {
        // Check if this die is stolen by any player's Mana Steal tactic
        const isStolenByTactic = state.players.some(
          (p) => p.tacticState.storedManaDie?.dieId === die.id
        );
        return {
          ...die,
          isStolenByTactic,
        };
      }),
    },

    offers: {
      units: state.offers.units,
      advancedActions: state.offers.advancedActions,
      spells: state.offers.spells,
      commonSkills: state.offers.commonSkills,
      monasteryAdvancedActions: state.offers.monasteryAdvancedActions ?? [],
    },

    combat: toClientCombatState(state.combat, forPlayerId),

    // Only show deck counts, not contents
    deckCounts: {
      spells: state.decks.spells.length,
      advancedActions: state.decks.advancedActions.length,
      artifacts: state.decks.artifacts.length,
      regularUnits: state.decks.regularUnits.length,
      eliteUnits: state.decks.eliteUnits.length,
    },

    woundPileCount: state.woundPileCount,
    scenarioEndTriggered: state.scenarioEndTriggered,

    // Valid actions for this player
    validActions: getValidActions(state, forPlayerId),
  };
}

/**
 * Convert a Player to ClientPlayer.
 * Shows full hand to self, only count to others.
 */
export function toClientPlayer(player: Player, forPlayerId: string): ClientPlayer {
  const isCurrentPlayer = player.id === forPlayerId;

  return {
    id: player.id,
    heroId: player.hero,
    position: player.position,
    fame: player.fame,
    level: player.level,
    reputation: player.reputation,
    armor: player.armor,
    handLimit: player.handLimit,
    commandTokens: player.commandTokens,

    // Show full hand to self, only count to others
    hand: isCurrentPlayer ? player.hand : player.hand.length,
    deckCount: player.deck.length,
    discardCount: player.discard.length,
    playArea: player.playArea,

    units: player.units.map(
      (unit): ClientPlayerUnit => {
        const attachment = player.attachedBanners.find(
          (b) => b.unitInstanceId === unit.instanceId
        );
        const bondsUnit = player.bondsOfLoyaltyUnitInstanceId === unit.instanceId;
        return {
          instanceId: unit.instanceId,
          unitId: unit.unitId,
          state: unit.state,
          wounded: unit.wounded,
          ...(attachment && { attachedBannerId: attachment.bannerId }),
          ...(bondsUnit && { isBondsUnit: true }),
        };
      }
    ),

    attachedBanners: player.attachedBanners.map((b) => ({
      bannerId: b.bannerId,
      unitInstanceId: b.unitInstanceId,
      isUsedThisRound: b.isUsedThisRound,
    })),

    skills: player.skills,
    crystals: player.crystals,

    movePoints: player.movePoints,
    influencePoints: player.influencePoints,
    pureMana: player.pureMana.map(
      (token): ClientManaToken => ({
        color: token.color,
        source: token.source,
      })
    ),
    hasMovedThisTurn: player.hasMovedThisTurn,
    hasTakenActionThisTurn: player.hasTakenActionThisTurn,
    usedManaFromSource: player.usedManaFromSource,
    playedCardFromHandThisTurn: player.playedCardFromHandThisTurn,
    isResting: player.isResting,

    knockedOut: player.knockedOut,
    selectedTacticId: player.selectedTactic,
    tacticFlipped: player.tacticFlipped,

    pendingChoice: player.pendingChoice
      ? toClientPendingChoice(player.pendingChoice)
      : null,

    // Combat accumulator (attack/block values from played cards)
    combatAccumulator: {
      attack: {
        normal: player.combatAccumulator.attack.normal,
        ranged: player.combatAccumulator.attack.ranged,
        siege: player.combatAccumulator.attack.siege,
        normalElements: { ...player.combatAccumulator.attack.normalElements },
        rangedElements: { ...player.combatAccumulator.attack.rangedElements },
        siegeElements: { ...player.combatAccumulator.attack.siegeElements },
      },
      block: player.combatAccumulator.block,
      blockElements: { ...player.combatAccumulator.blockElements },
    },

    // Pending rewards from site conquest
    pendingRewards: player.pendingRewards,

    // Glade wound choice
    pendingGladeWoundChoice: player.pendingGladeWoundChoice,

    // Deep mine crystal choice (convert MineColor[] to BasicManaColor[])
    pendingDeepMineChoice: player.pendingDeepMineChoice
      ? player.pendingDeepMineChoice.map(mineColorToBasicManaColor)
      : null,

    // Healing points accumulated this turn
    healingPoints: player.healingPoints,

    // Stolen mana die from Mana Steal tactic
    stolenManaDie: player.tacticState.storedManaDie
      ? {
          dieId: player.tacticState.storedManaDie.dieId,
          color: player.tacticState.storedManaDie.color,
        }
      : null,

    // Pending level up rewards (skill + AA selection)
    pendingLevelUpRewards: player.pendingLevelUpRewards,

    // Pending level ups (levels crossed, processed at end of turn)
    pendingLevelUps: player.pendingLevelUps,

    // Pending discard cost (filters out thenEffect which is internal state)
    pendingDiscard: player.pendingDiscard
      ? toClientPendingDiscard(player.pendingDiscard)
      : null,
  };
}

/**
 * Convert a PendingDiscard to ClientPendingDiscard.
 * Filters out the thenEffect (internal implementation detail).
 */
export function toClientPendingDiscard(
  pendingDiscard: NonNullable<Player["pendingDiscard"]>
): ClientPendingDiscard {
  return {
    sourceCardId: pendingDiscard.sourceCardId,
    count: pendingDiscard.count,
    optional: pendingDiscard.optional,
    filterWounds: pendingDiscard.filterWounds,
  };
}

/**
 * Convert a PendingChoice to ClientPendingChoice.
 * Describes each effect option for display.
 */
export function toClientPendingChoice(
  choice: NonNullable<Player["pendingChoice"]>
): ClientPendingChoice {
  return {
    cardId: choice.cardId,
    skillId: choice.skillId,
    options: choice.options.map((effect) => ({
      type: effect.type,
      description: describeEffect(effect),
    })),
  };
}

/**
 * Convert a HexEnemy to ClientHexEnemy.
 * Masks the token ID when the enemy is unrevealed, only showing the color (token back).
 */
export function toClientHexEnemy(enemy: HexEnemy): ClientHexEnemy {
  if (enemy.isRevealed) {
    // Revealed: include the token ID so client can display the enemy face
    return {
      color: enemy.color,
      isRevealed: true,
      tokenId: String(enemy.tokenId),
    };
  } else {
    // Unrevealed: only show the color (token back), no token ID
    return {
      color: enemy.color,
      isRevealed: false,
    };
  }
}

/**
 * Convert a RuinsToken to ClientRuinsToken.
 * Masks the token ID when unrevealed to prevent cheating - player shouldn't
 * know what's on the token until it's flipped. All unrevealed tokens show
 * the same yellow back.
 */
export function toClientRuinsToken(token: RuinsToken): ClientRuinsToken {
  if (token.isRevealed) {
    return {
      isRevealed: true,
      tokenId: token.tokenId,
    };
  } else {
    return {
      isRevealed: false,
    };
  }
}

/**
 * Convert core CombatState to ClientCombatState.
 * Extracts enemy details from definitions for client display.
 *
 * For cooperative assaults, filters enemies to show only those assigned to the
 * requesting player. Each player can only see/target their assigned enemies.
 *
 * @param combat - The full combat state
 * @param forPlayerId - The player requesting the state (used for enemy filtering)
 */
export function toClientCombatState(
  combat: CombatState | null,
  forPlayerId: string
): ClientCombatState | null {
  if (!combat) return null;

  // Filter enemies for cooperative assaults
  // If no enemy assignments exist (standard combat), show all enemies
  const visibleEnemies = combat.enemyAssignments
    ? combat.enemies.filter((enemy) => {
        const assignedEnemies = combat.enemyAssignments?.[forPlayerId];
        return assignedEnemies?.includes(enemy.instanceId) ?? false;
      })
    : combat.enemies;

  return {
    phase: combat.phase,
    enemies: visibleEnemies.map(
      (enemy): ClientCombatEnemy => ({
        instanceId: enemy.instanceId,
        enemyId: enemy.enemyId,
        name: enemy.definition.name,
        attack: enemy.definition.attack,
        attackElement: enemy.definition.attackElement,
        armor: enemy.definition.armor,
        fame: enemy.definition.fame,
        abilities: enemy.definition.abilities,
        resistances: enemy.definition.resistances,
        isBlocked: enemy.isBlocked,
        isDefeated: enemy.isDefeated,
        damageAssigned: enemy.damageAssigned,
      })
    ),
    woundsThisCombat: combat.woundsThisCombat,
    fameGained: combat.fameGained,
    isAtFortifiedSite: combat.isAtFortifiedSite,
  };
}
