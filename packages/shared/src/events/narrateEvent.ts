/**
 * Event Narration
 *
 * Pure function that converts GameEvent into player-facing activity messages.
 * Used by the client ActivityFeed, replays, and potentially server-side logging.
 *
 * Only ~30 of 109+ event types produce narration — internal bookkeeping
 * events (undo checkpoints, choice resolution, mana resets, etc.) return null.
 *
 * @module events/narrateEvent
 */

import type { GameEvent } from "./index.js";
import type { EventCategory } from "./categories.js";
import { EVENT_CATEGORY } from "./categories.js";
import {
  COMBAT_TRIGGER_FORTIFIED_ASSAULT,
  COMBAT_TRIGGER_PROVOKE_RAMPAGING,
  COMBAT_TRIGGER_CHALLENGE,
} from "../valueConstants.js";

// ============================================================================
// TYPES
// ============================================================================

export interface ActivityMessage {
  /** Human-readable narration text */
  readonly text: string;
  /** Event category for color-coding in the UI */
  readonly category: EventCategory;
  /** Player who caused the event (if applicable) */
  readonly playerId?: string;
  /** True for TURN_STARTED — rendered as a separator in the feed */
  readonly isTurnBoundary?: boolean;
}

/** Player info needed for narration (hero name lookup) */
export interface NarrationPlayer {
  readonly id: string;
  readonly heroId: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Capitalize first letter: "arythea" → "Arythea" */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Extract unit name from instance ID: "scouts_0" → "Scouts", "herbalists_1" → "Herbalists" */
function unitName(instanceId: string): string {
  // Strip trailing _N instance suffix
  const base = instanceId.replace(/_\d+$/, "");
  return formatId(base);
}

/** Format a unit ability for display */
function formatAbility(abilityType: string, value: number, element: string): string {
  switch (abilityType) {
    case "attack":
      return `Attack ${value}${element !== "physical" ? ` ${capitalize(element)}` : ""}`;
    case "block":
      return `Block ${value}${element !== "physical" ? ` ${capitalize(element)}` : ""}`;
    case "ranged_attack":
      return `Ranged Attack ${value}${element !== "physical" ? ` ${capitalize(element)}` : ""}`;
    case "siege_attack":
      return `Siege Attack ${value}${element !== "physical" ? ` ${capitalize(element)}` : ""}`;
    case "move":
      return `Move ${value}`;
    case "influence":
      return `Influence ${value}`;
    case "heal":
      return `Heal ${value}`;
    case "swift":
      return "Swift";
    case "brutal":
      return "Brutal";
    case "poison":
      return "Poison";
    case "paralyze":
      return "Paralyze";
    default:
      return formatId(abilityType);
  }
}

/** Turn a snake_case or camelCase id into Title Case: "orc_warriors" → "Orc Warriors" */
function formatId(id: string): string {
  return id
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase → spaces
    .replace(/[_-]/g, " ") // snake/kebab → spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()); // capitalize words
}

/** Look up hero display name from player list */
function heroName(
  players: readonly NarrationPlayer[],
  playerId: string,
): string {
  const player = players.find((p) => p.id === playerId);
  return player ? capitalize(player.heroId) : playerId;
}

/** Look up hero display name from player index */
function heroNameByIndex(
  players: readonly NarrationPlayer[],
  playerIndex: number,
): string {
  const player = players[playerIndex];
  return player ? capitalize(player.heroId) : `Player ${playerIndex + 1}`;
}

/** Format combat phase for display */
function formatPhase(phase: string): string {
  switch (phase) {
    case "ranged_siege":
      return "Ranged & Siege";
    case "block":
      return "Block";
    case "assign_damage":
      return "Assign Damage";
    case "attack":
      return "Attack";
    default:
      return formatId(phase);
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Convert a GameEvent into a player-facing activity message.
 *
 * Returns null for events that should not appear in the activity feed
 * (internal bookkeeping, choice mechanics, mana source resets, etc.).
 *
 * @param event - The game event to narrate
 * @param players - Array of {id, heroId} for hero name lookup
 * @returns An ActivityMessage, or null if the event should be suppressed
 */
export function narrateEvent(
  event: GameEvent,
  players: readonly NarrationPlayer[],
): ActivityMessage | null {
  switch (event.type) {
    // ---- Lifecycle ----

    case "TURN_STARTED": {
      const name = heroNameByIndex(players, event.playerIndex);
      return {
        text: `--- ${name}'s Turn ---`,
        category: EVENT_CATEGORY.LIFECYCLE,
        isTurnBoundary: true,
      };
    }

    case "TURN_ENDED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} ended their turn`,
        category: EVENT_CATEGORY.LIFECYCLE,
        playerId: event.playerId,
      };
    }

    case "ROUND_STARTED":
      return {
        text: `Round ${event.round} begins (${event.isDay ? "Day" : "Night"})`,
        category: EVENT_CATEGORY.LIFECYCLE,
      };

    case "TIME_OF_DAY_CHANGED":
      return {
        text: event.to === "night" ? "Night falls" : "Day breaks",
        category: EVENT_CATEGORY.LIFECYCLE,
      };

    case "END_OF_ROUND_ANNOUNCED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} announced end of round`,
        category: EVENT_CATEGORY.LIFECYCLE,
        playerId: event.playerId,
      };
    }

    // ---- Movement ----

    case "PLAYER_MOVED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} moved to (${event.to.q},${event.to.r})`,
        category: EVENT_CATEGORY.MOVEMENT,
        playerId: event.playerId,
      };
    }

    case "TILE_EXPLORED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} explored new territory`,
        category: EVENT_CATEGORY.MOVEMENT,
        playerId: event.playerId,
      };
    }

    // ---- Cards ----

    case "CARD_PLAYED": {
      const name = heroName(players, event.playerId);
      const cardName = formatId(event.cardId);
      if (event.sideways) {
        return {
          text: `${name} played ${cardName} — ${event.effect}`,
          category: EVENT_CATEGORY.CARDS,
          playerId: event.playerId,
        };
      }
      return {
        text: `${name} played ${cardName}${event.powered ? " (powered)" : ""}`,
        category: EVENT_CATEGORY.CARDS,
        playerId: event.playerId,
      };
    }

    case "CARD_GAINED": {
      const name = heroName(players, event.playerId);
      const cardName = formatId(event.cardId);
      return {
        text: `${name} gained ${cardName}`,
        category: EVENT_CATEGORY.CARDS,
        playerId: event.playerId,
      };
    }

    case "CARD_DRAWN": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} drew ${event.count} card${event.count !== 1 ? "s" : ""}`,
        category: EVENT_CATEGORY.CARDS,
        playerId: event.playerId,
      };
    }

    case "CARD_DISCARDED": {
      const name = heroName(players, event.playerId);
      const cardName = formatId(event.cardId);
      return {
        text: `${name} discarded ${cardName}`,
        category: EVENT_CATEGORY.CARDS,
        playerId: event.playerId,
      };
    }

    case "CARD_DESTROYED": {
      const name = heroName(players, event.playerId);
      const cardName = formatId(event.cardId);
      return {
        text: `${name}'s ${cardName} was destroyed`,
        category: EVENT_CATEGORY.CARDS,
        playerId: event.playerId,
      };
    }

    // ---- Combat ----

    case "COMBAT_TRIGGERED": {
      const name = heroName(players, event.playerId);
      let triggerText: string;
      switch (event.triggerType) {
        case COMBAT_TRIGGER_FORTIFIED_ASSAULT:
          triggerText = `${name} assaults a fortified site!`;
          break;
        case COMBAT_TRIGGER_PROVOKE_RAMPAGING:
          triggerText = `${name} provoked rampaging enemies!`;
          break;
        case COMBAT_TRIGGER_CHALLENGE:
          triggerText = `${name} challenges the site guardians!`;
          break;
        default:
          triggerText = `${name} enters combat!`;
          break;
      }
      return {
        text: triggerText,
        category: EVENT_CATEGORY.COMBAT,
        playerId: event.playerId,
      };
    }

    case "COMBAT_STARTED": {
      const enemyNames = event.enemies.map((e) => e.name).join(", ");
      return {
        text: `Combat begins: ${enemyNames}`,
        category: EVENT_CATEGORY.COMBAT,
        playerId: event.playerId,
      };
    }

    case "COMBAT_PHASE_CHANGED":
      return {
        text: `${formatPhase(event.newPhase)} phase`,
        category: EVENT_CATEGORY.COMBAT,
      };

    case "ENEMY_DEFEATED":
      return {
        text: `${event.enemyName} defeated (+${event.fameGained} fame)`,
        category: EVENT_CATEGORY.COMBAT,
      };

    case "COMBAT_ENDED": {
      if (event.victory) {
        return {
          text: `Combat victory! +${event.totalFameGained} fame`,
          category: EVENT_CATEGORY.COMBAT,
        };
      }
      return {
        text: `Combat ended, ${event.enemiesSurvived} enemy survived`,
        category: EVENT_CATEGORY.COMBAT,
      };
    }

    case "PLAYER_KNOCKED_OUT": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} was knocked out!`,
        category: EVENT_CATEGORY.COMBAT,
        playerId: event.playerId,
      };
    }

    case "PLAYER_WITHDREW": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} withdrew from combat`,
        category: EVENT_CATEGORY.COMBAT,
        playerId: event.playerId,
      };
    }

    case "DAMAGE_ASSIGNED":
      return {
        text: `Took ${event.damage} damage (${event.woundsTaken} wound${event.woundsTaken !== 1 ? "s" : ""})`,
        category: EVENT_CATEGORY.COMBAT,
      };

    // ---- Skills ----

    case "SKILL_USED": {
      const name = heroName(players, event.playerId);
      const skillName = formatId(event.skillId);
      return {
        text: `${name} used ${skillName}`,
        category: EVENT_CATEGORY.PROGRESSION,
        playerId: event.playerId,
      };
    }

    // ---- Health ----

    case "WOUND_RECEIVED": {
      const name = heroName(players, event.playerId);
      if (event.target === "hero") {
        return {
          text: `${name} took a wound`,
          category: EVENT_CATEGORY.HEALTH,
          playerId: event.playerId,
        };
      }
      return null; // unit wounds handled by UNIT_WOUNDED
    }

    case "WOUND_HEALED": {
      const name = heroName(players, event.playerId);
      if (event.target === "hero") {
        return {
          text: `${name} healed a wound`,
          category: EVENT_CATEGORY.HEALTH,
          playerId: event.playerId,
        };
      }
      return null; // unit heals handled by UNIT_HEALED
    }

    // ---- Progression ----

    case "FAME_GAINED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} +${event.amount} fame (total: ${event.newTotal})`,
        category: EVENT_CATEGORY.PROGRESSION,
        playerId: event.playerId,
      };
    }

    case "REPUTATION_CHANGED": {
      const name = heroName(players, event.playerId);
      const sign = event.delta > 0 ? "+" : "";
      return {
        text: `${name} reputation ${sign}${event.delta}`,
        category: EVENT_CATEGORY.PROGRESSION,
        playerId: event.playerId,
      };
    }

    case "LEVEL_UP": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} reached level ${event.newLevel}!`,
        category: EVENT_CATEGORY.PROGRESSION,
        playerId: event.playerId,
      };
    }

    case "SKILL_GAINED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} learned a new skill`,
        category: EVENT_CATEGORY.PROGRESSION,
        playerId: event.playerId,
      };
    }

    case "FAME_LOST": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} -${event.amount} fame (total: ${event.newTotal})`,
        category: EVENT_CATEGORY.PROGRESSION,
        playerId: event.playerId,
      };
    }

    case "ADVANCED_ACTION_GAINED": {
      const name = heroName(players, event.playerId);
      const cardName = formatId(event.cardId);
      return {
        text: `${name} gained ${cardName}`,
        category: EVENT_CATEGORY.PROGRESSION,
        playerId: event.playerId,
      };
    }

    // ---- Mana ----

    case "CRYSTAL_GAINED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} gained ${event.color} crystal`,
        category: EVENT_CATEGORY.CARDS,
        playerId: event.playerId,
      };
    }

    // ---- Units ----

    case "UNIT_RECRUITED": {
      const name = heroName(players, event.playerId);
      const unitName = formatId(event.unitId);
      return {
        text: `${name} recruited ${unitName}`,
        category: EVENT_CATEGORY.UNITS,
        playerId: event.playerId,
      };
    }

    case "UNIT_WOUNDED": {
      const name = heroName(players, event.playerId);
      const unit = unitName(event.unitInstanceId);
      return {
        text: `${name}'s ${unit} took a wound`,
        category: EVENT_CATEGORY.UNITS,
        playerId: event.playerId,
      };
    }

    case "UNIT_DESTROYED": {
      const name = heroName(players, event.playerId);
      const unit = unitName(event.unitInstanceId);
      return {
        text: `${name}'s ${unit} was destroyed`,
        category: EVENT_CATEGORY.UNITS,
        playerId: event.playerId,
      };
    }

    case "UNIT_ACTIVATED": {
      const name = heroName(players, event.playerId);
      const unit = unitName(event.unitInstanceId);
      const ability = event.abilityDisplayName ?? formatAbility(event.abilityUsed, event.abilityValue, event.element);
      return {
        text: `${name} activated ${unit} — ${ability}`,
        category: EVENT_CATEGORY.UNITS,
        playerId: event.playerId,
      };
    }

    case "UNIT_DISBANDED": {
      const name = heroName(players, event.playerId);
      const unit = unitName(event.unitInstanceId);
      return {
        text: `${name} disbanded ${unit}`,
        category: EVENT_CATEGORY.UNITS,
        playerId: event.playerId,
      };
    }

    // ---- Sites ----

    case "SITE_CONQUERED": {
      const name = heroName(players, event.playerId);
      const siteName = formatId(event.siteType);
      return {
        text: `${name} conquered the ${siteName}!`,
        category: EVENT_CATEGORY.SITES,
        playerId: event.playerId,
      };
    }

    case "MONASTERY_BURNED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} burned the monastery!`,
        category: EVENT_CATEGORY.SITES,
        playerId: event.playerId,
      };
    }

    case "VILLAGE_PLUNDERED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} plundered the village!`,
        category: EVENT_CATEGORY.SITES,
        playerId: event.playerId,
      };
    }

    case "SITE_ENTERED": {
      const name = heroName(players, event.playerId);
      const siteName = formatId(event.siteType);
      return {
        text: `${name} entered the ${siteName}`,
        category: EVENT_CATEGORY.SITES,
        playerId: event.playerId,
      };
    }

    case "HEALING_PURCHASED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} purchased ${event.healingPoints} healing`,
        category: EVENT_CATEGORY.SITES,
        playerId: event.playerId,
      };
    }

    case "ALTAR_TRIBUTE_PAID": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} paid tribute at the altar (+${event.fameGained} fame)`,
        category: EVENT_CATEGORY.SITES,
        playerId: event.playerId,
      };
    }

    // ---- Tactics ----

    case "TACTIC_SELECTED": {
      const name = heroName(players, event.playerId);
      const tacticName = formatId(event.tacticId);
      return {
        text: `${name} selected ${tacticName}`,
        category: EVENT_CATEGORY.TACTICS,
        playerId: event.playerId,
      };
    }

    case "TACTICS_PHASE_ENDED":
      return {
        text: "Tactics phase ended — turn order set",
        category: EVENT_CATEGORY.TACTICS,
      };

    case "TACTIC_ACTIVATED": {
      const name = heroName(players, event.playerId);
      const tacticName = formatId(event.tacticId);
      return {
        text: `${name} activated ${tacticName} tactic`,
        category: EVENT_CATEGORY.TACTICS,
        playerId: event.playerId,
      };
    }

    case "TACTIC_DECISION_RESOLVED": {
      const name = heroName(players, event.playerId);
      const decisionName = formatId(event.decisionType);
      return {
        text: `${name} resolved ${decisionName}`,
        category: EVENT_CATEGORY.TACTICS,
        playerId: event.playerId,
      };
    }

    case "SOURCE_DICE_REROLLED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} rerolled ${event.dieIds.length} mana die${event.dieIds.length !== 1 ? "s" : ""}`,
        category: EVENT_CATEGORY.TACTICS,
        playerId: event.playerId,
      };
    }

    case "PLAYER_RESTED": {
      const name = heroName(players, event.playerId);
      const restLabel = event.restType === "slow_recovery" ? "Slow Recovery" : "Regular Rest";
      return {
        text: `${name} — ${restLabel} (${event.cardsDiscarded} discarded, ${event.woundsDiscarded} wounds)`,
        category: EVENT_CATEGORY.TACTICS,
        playerId: event.playerId,
      };
    }

    // ---- Mana ----

    case "MANA_DIE_TAKEN": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} took a ${event.color} mana die`,
        category: EVENT_CATEGORY.CARDS,
        playerId: event.playerId,
      };
    }

    case "CRYSTAL_USED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} used a ${event.color} crystal`,
        category: EVENT_CATEGORY.CARDS,
        playerId: event.playerId,
      };
    }

    case "CRYSTAL_CONVERTED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} stored ${event.color} mana as crystal`,
        category: EVENT_CATEGORY.CARDS,
        playerId: event.playerId,
      };
    }

    // ---- Choices ----

    case "CHOICE_RESOLVED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name}: ${event.effect}`,
        category: EVENT_CATEGORY.CARDS,
        playerId: event.playerId,
      };
    }

    // ---- Rewards ----

    case "REWARD_SELECTED": {
      const name = heroName(players, event.playerId);
      const cardName = formatId(event.cardId);
      const rewardLabel = formatId(event.rewardType);
      return {
        text: `${name} chose ${cardName} (${rewardLabel} reward)`,
        category: EVENT_CATEGORY.PROGRESSION,
        playerId: event.playerId,
      };
    }

    // ---- Special Sites ----

    case "GLADE_WOUND_DISCARDED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} healed a wound at the glade`,
        category: EVENT_CATEGORY.HEALTH,
        playerId: event.playerId,
      };
    }

    case "GLADE_MANA_GAINED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} gained ${event.manaColor} mana at the glade`,
        category: EVENT_CATEGORY.CARDS,
        playerId: event.playerId,
      };
    }

    case "DEEP_MINE_CRYSTAL_GAINED": {
      const name = heroName(players, event.playerId);
      return {
        text: `${name} mined a ${event.color} crystal`,
        category: EVENT_CATEGORY.CARDS,
        playerId: event.playerId,
      };
    }

    // ---- Combat extras ----

    case "ENEMY_SUMMONED":
      return {
        text: `${event.summonerName} summoned ${event.summonedName}!`,
        category: EVENT_CATEGORY.COMBAT,
      };

    case "BANNER_FEAR_CANCEL_ATTACK":
      return {
        text: `Banner of Fear cancelled an enemy attack! (+${event.fameGained} fame)`,
        category: EVENT_CATEGORY.COMBAT,
      };

    case "BANNER_FORTITUDE_PREVENTED_WOUND":
      return {
        text: "Banner of Fortitude prevented a wound",
        category: EVENT_CATEGORY.COMBAT,
      };

    // ---- Everything else → null (not narrated) ----
    default:
      return null;
  }
}
