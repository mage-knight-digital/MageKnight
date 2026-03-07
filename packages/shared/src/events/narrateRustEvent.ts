/**
 * Rust Event Narration
 *
 * Handles Rust engine events in their native format.
 * Rust events come from serde with `#[serde(tag = "type", rename_all = "camelCase")]`
 * so the **type tag** is camelCase (e.g. "cardPlayed") but **fields** remain snake_case
 * (e.g. `player_id`, `card_id`).
 *
 * @module events/narrateRustEvent
 */

import type { ActivityMessage, NarrationPlayer } from "./narrateEvent.js";
import { EVENT_CATEGORY } from "./categories.js";

// ============================================================================
// RUST EVENT INTERFACE
// ============================================================================

/** A Rust engine event in its native serde-serialized shape. */
export interface RustEvent {
  readonly type: string;
  readonly [key: string]: unknown;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Read a field from a RustEvent, trying snake_case first then camelCase. */
function field(event: RustEvent, snakeCase: string, camelCase: string): unknown {
  return event[snakeCase] ?? event[camelCase];
}

/** Capitalize first letter: "arythea" → "Arythea" */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Turn a snake_case id into Title Case: "orc_warriors" → "Orc Warriors" */
function formatId(id: string): string {
  return id
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Look up hero display name from player list */
function heroName(
  players: readonly NarrationPlayer[],
  playerId: string,
): string {
  const player = players.find((p) => p.id === playerId);
  return player ? capitalize(player.hero) : playerId;
}

/** Format time of day for display */
function formatTimeOfDay(tod: string): string {
  switch (tod) {
    case "day":
      return "Day";
    case "night":
      return "Night";
    default:
      return formatId(tod);
  }
}

/** Format combat phase for display */
function formatCombatPhase(phase: string): string {
  switch (phase) {
    case "RangedSiege":
      return "Ranged & Siege";
    case "Block":
      return "Block";
    case "AssignDamage":
      return "Assign Damage";
    case "Attack":
      return "Attack";
    default:
      return formatId(phase);
  }
}

/** Build an ActivityMessage, only including playerId when defined. */
function msg(
  text: string,
  category: ActivityMessage["category"],
  pid?: string,
  isTurnBoundary?: true,
): ActivityMessage {
  return {
    text,
    category,
    ...(pid != null ? { playerId: pid } : {}),
    ...(isTurnBoundary ? { isTurnBoundary } : {}),
  };
}

// ============================================================================
// DETECTION
// ============================================================================

/**
 * Check if an event is a Rust engine event (camelCase type).
 *
 * Rust events have camelCase types like "cardPlayed", "turnStarted".
 * TS events have UPPER_CASE types like "CARD_PLAYED", "TURN_STARTED".
 */
export function isRustEvent(event: { type: string }): boolean {
  const t = event.type;
  return typeof t === "string" && t.length > 0 && t.charAt(0) === t.charAt(0).toLowerCase() && !t.includes("_");
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Convert a Rust engine event into a player-facing activity message.
 *
 * Returns null for events that should not appear in the activity feed.
 *
 * Note: Rust serde serializes field names as snake_case (e.g. player_id, card_id)
 * even though the type tag is camelCase.
 */
export function narrateRustEvent(
  event: RustEvent,
  players: readonly NarrationPlayer[],
): ActivityMessage | null {
  const pid = field(event, "player_id", "playerId") as string | undefined;

  switch (event.type) {
    // ---- Lifecycle ----

    case "gameStarted": {
      const hero = event["hero"] as string | undefined;
      const seed = event["seed"] as number | undefined;
      const heroLabel = hero ? capitalize(hero) : "Hero";
      return msg(
        `Game started — ${heroLabel}${seed != null ? ` (seed ${seed})` : ""}`,
        EVENT_CATEGORY.LIFECYCLE,
      );
    }

    case "turnStarted": {
      const name = pid ? heroName(players, pid) : "Hero";
      const round = event["round"] as number | undefined;
      const tod = field(event, "time_of_day", "timeOfDay") as string | undefined;
      const todLabel = tod ? formatTimeOfDay(tod) : "";
      return msg(
        `--- ${name}'s Turn${round != null ? ` (Round ${round}${todLabel ? `, ${todLabel}` : ""})` : ""} ---`,
        EVENT_CATEGORY.LIFECYCLE,
        pid,
        true,
      );
    }

    case "turnEnded": {
      const name = pid ? heroName(players, pid) : "Hero";
      return msg(`${name} ended their turn`, EVENT_CATEGORY.LIFECYCLE, pid);
    }

    case "roundEnded": {
      const round = event["round"] as number | undefined;
      return msg(
        round != null ? `Round ${round} ended` : "Round ended",
        EVENT_CATEGORY.LIFECYCLE,
      );
    }

    case "gameEnded": {
      const reason = event["reason"] as string | undefined;
      return msg(
        reason ? `Game ended — ${formatId(reason)}` : "Game ended",
        EVENT_CATEGORY.LIFECYCLE,
      );
    }

    // ---- Tactics ----

    case "tacticSelected": {
      const name = pid ? heroName(players, pid) : "Hero";
      const tacticId = field(event, "tactic_id", "tacticId") as string | undefined;
      const tacticLabel = tacticId ? formatId(tacticId) : "a tactic";
      return msg(`${name} selected tactic: ${tacticLabel}`, EVENT_CATEGORY.TACTICS, pid);
    }

    // ---- Cards ----

    case "cardPlayed": {
      const name = pid ? heroName(players, pid) : "Hero";
      const cardId = field(event, "card_id", "cardId") as string | undefined;
      const mode = event["mode"] as string | { sideways: string } | undefined;
      const cardLabel = cardId ? formatId(cardId) : "a card";
      let modeLabel = "";
      if (mode === "basic") {
        // no label for basic
      } else if (mode === "powered") {
        modeLabel = " (powered)";
      } else if (typeof mode === "object" && mode !== null && "sideways" in mode) {
        const sidewaysAs = (mode as { sideways: string }).sideways;
        modeLabel = ` → ${formatId(sidewaysAs)} 1`;
      }
      return msg(`${name} played ${cardLabel}${modeLabel}`, EVENT_CATEGORY.CARDS, pid);
    }

    case "cardGained": {
      const name = pid ? heroName(players, pid) : "Hero";
      const cardId = field(event, "card_id", "cardId") as string | undefined;
      const cardLabel = cardId ? formatId(cardId) : "a card";
      return msg(`${name} gained ${cardLabel}`, EVENT_CATEGORY.CARDS, pid);
    }

    // ---- Movement ----

    case "playerMoved": {
      const name = pid ? heroName(players, pid) : "Hero";
      const to = event["to"] as { q: number; r: number } | undefined;
      const toLabel = to ? `(${to.q}, ${to.r})` : "a new hex";
      return msg(`${name} moved to ${toLabel}`, EVENT_CATEGORY.MOVEMENT, pid);
    }

    case "tileExplored": {
      const name = pid ? heroName(players, pid) : "Hero";
      const direction = event["direction"] as string | undefined;
      const tileId = field(event, "tile_id", "tileId") as string | undefined;
      const tileLabel = tileId ? formatId(tileId) : "new territory";
      const dirLabel = direction ? ` (${direction})` : "";
      return msg(`${name} explored ${tileLabel}${dirLabel}`, EVENT_CATEGORY.MOVEMENT, pid);
    }

    // ---- Combat ----

    case "combatStarted": {
      const name = pid ? heroName(players, pid) : "Hero";
      const hex = event["hex"] as { q: number; r: number } | undefined;
      const hexLabel = hex ? ` at (${hex.q}, ${hex.r})` : "";
      return msg(`${name} enters combat${hexLabel}!`, EVENT_CATEGORY.COMBAT, pid);
    }

    case "combatEnded":
      return msg("Combat ended", EVENT_CATEGORY.COMBAT, pid);

    case "combatPhaseChanged": {
      const phase = event["phase"] as string | undefined;
      const phaseLabel = phase ? formatCombatPhase(phase) : "next phase";
      return msg(`— ${phaseLabel} Phase —`, EVENT_CATEGORY.COMBAT);
    }

    case "enemyDefeated": {
      const enemyId = field(event, "enemy_id", "enemyId") as string | undefined;
      const enemyLabel = enemyId ? formatId(enemyId) : "Enemy";
      return msg(`${enemyLabel} defeated!`, EVENT_CATEGORY.COMBAT, pid);
    }

    // ---- Sites ----

    case "siteEntered": {
      const name = pid ? heroName(players, pid) : "Hero";
      const hex = event["hex"] as { q: number; r: number } | undefined;
      const hexLabel = hex ? ` at (${hex.q}, ${hex.r})` : "";
      return msg(`${name} entered a site${hexLabel}`, EVENT_CATEGORY.SITES, pid);
    }

    case "siteConquered": {
      const name = pid ? heroName(players, pid) : "Hero";
      const siteType = field(event, "site_type", "siteType") as string | undefined;
      const siteLabel = siteType ? formatId(siteType) : "a site";
      return msg(`${name} conquered ${siteLabel}!`, EVENT_CATEGORY.SITES, pid);
    }

    case "rewardSelected": {
      const name = pid ? heroName(players, pid) : "Hero";
      const cardId = field(event, "card_id", "cardId") as string | undefined;
      const cardLabel = cardId ? formatId(cardId) : "a reward";
      return msg(`${name} selected reward: ${cardLabel}`, EVENT_CATEGORY.SITES, pid);
    }

    // ---- Choices ----

    case "choiceResolved": {
      const name = pid ? heroName(players, pid) : "Hero";
      return msg(`${name} resolved a choice`, EVENT_CATEGORY.LIFECYCLE, pid);
    }

    // ---- Progression ----

    case "fameGained": {
      const name = pid ? heroName(players, pid) : "Hero";
      const amount = event["amount"] as number | undefined;
      return msg(`${name} +${amount ?? "?"} fame`, EVENT_CATEGORY.PROGRESSION, pid);
    }

    case "levelUp": {
      const name = pid ? heroName(players, pid) : "Hero";
      const newLevel = field(event, "new_level", "newLevel") as number | undefined;
      return msg(
        newLevel != null ? `${name} reached level ${newLevel}!` : `${name} leveled up!`,
        EVENT_CATEGORY.PROGRESSION,
        pid,
      );
    }

    case "skillGained": {
      const name = pid ? heroName(players, pid) : "Hero";
      const skillId = field(event, "skill_id", "skillId") as string | undefined;
      const skillLabel = skillId ? formatId(skillId) : "a skill";
      return msg(`${name} learned ${skillLabel}`, EVENT_CATEGORY.PROGRESSION, pid);
    }

    case "reputationChanged": {
      const name = pid ? heroName(players, pid) : "Hero";
      const oldVal = field(event, "old_value", "oldValue") as number | undefined;
      const newVal = field(event, "new_value", "newValue") as number | undefined;
      if (oldVal != null && newVal != null) {
        const delta = newVal - oldVal;
        const arrow = delta > 0 ? "+" : "";
        return msg(
          `${name} reputation ${arrow}${delta} (now ${newVal})`,
          EVENT_CATEGORY.PROGRESSION,
          pid,
        );
      }
      return msg(`${name} reputation changed`, EVENT_CATEGORY.PROGRESSION, pid);
    }

    // ---- Health ----

    case "woundTaken": {
      const name = pid ? heroName(players, pid) : "Hero";
      return msg(`${name} took a wound`, EVENT_CATEGORY.HEALTH, pid);
    }

    // ---- Units ----

    case "unitRecruited": {
      const name = pid ? heroName(players, pid) : "Hero";
      const unitId = field(event, "unit_id", "unitId") as string | undefined;
      const unitLabel = unitId ? formatId(unitId) : "a unit";
      return msg(`${name} recruited ${unitLabel}`, EVENT_CATEGORY.UNITS, pid);
    }

    case "unitActivated": {
      const name = pid ? heroName(players, pid) : "Hero";
      const unitId = field(event, "unit_id", "unitId") as string | undefined;
      const unitLabel = unitId ? formatId(unitId) : "a unit";
      return msg(`${name} activated ${unitLabel}`, EVENT_CATEGORY.UNITS, pid);
    }

    case "unitWounded": {
      const unitId = field(event, "unit_id", "unitId") as string | undefined;
      const unitLabel = unitId ? formatId(unitId) : "Unit";
      return msg(`${unitLabel} was wounded`, EVENT_CATEGORY.UNITS, pid);
    }

    case "unitDestroyed": {
      const unitId = field(event, "unit_id", "unitId") as string | undefined;
      const unitLabel = unitId ? formatId(unitId) : "Unit";
      return msg(`${unitLabel} was destroyed`, EVENT_CATEGORY.UNITS, pid);
    }

    // ---- Mana ----

    case "crystalGained": {
      const name = pid ? heroName(players, pid) : "Hero";
      const color = event["color"] as string | undefined;
      return msg(
        `${name} gained ${color ? `a ${color}` : "a"} crystal`,
        EVENT_CATEGORY.CARDS,
        pid,
      );
    }

    // ---- Rest ----

    case "rested": {
      const name = pid ? heroName(players, pid) : "Hero";
      return msg(`${name} declared rest`, EVENT_CATEGORY.LIFECYCLE, pid);
    }

    // ---- Generic fallback ----

    case "actionTaken": {
      const name = pid ? heroName(players, pid) : "Hero";
      const actionType = field(event, "action_type", "actionType") as string | undefined;
      const label = actionType ? formatId(actionType) : "action";
      return msg(`${name}: ${label}`, EVENT_CATEGORY.LIFECYCLE, pid);
    }

    // ---- Undo ----

    case "undone": {
      const name = pid ? heroName(players, pid) : "Hero";
      return msg(`${name} undid last action`, EVENT_CATEGORY.UNDO, pid);
    }

    // ---- Everything else — show raw type so nothing is silently dropped ----
    default: {
      const name = pid ? heroName(players, pid) : "Hero";
      return msg(`${name}: ${formatId(event.type)}`, EVENT_CATEGORY.LIFECYCLE, pid);
    }
  }
}
