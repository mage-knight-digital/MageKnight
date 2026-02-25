/**
 * Rust Event Narration
 *
 * Handles Rust engine events in their native camelCase format.
 * Separate from `narrateEvent()` which handles TS engine events (UPPER_CASE).
 *
 * Rust events come from serde with `#[serde(tag = "type", rename_all = "camelCase")]`
 * so types are like `"cardPlayed"` and fields are like `playerId`.
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
  return typeof t === "string" && t.length > 0 && t[0] === t[0].toLowerCase() && !t.includes("_");
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Convert a Rust engine event into a player-facing activity message.
 *
 * Returns null for events that should not appear in the activity feed.
 *
 * @param event - The Rust event with camelCase type and fields
 * @param players - Array of {id, hero} for hero name lookup
 * @returns An ActivityMessage, or null if the event should be suppressed
 */
export function narrateRustEvent(
  event: RustEvent,
  players: readonly NarrationPlayer[],
): ActivityMessage | null {
  const playerId = event.playerId as string | undefined;

  switch (event.type) {
    // ---- Lifecycle ----

    case "gameStarted": {
      const hero = event.hero as string | undefined;
      const seed = event.seed as number | undefined;
      const heroLabel = hero ? capitalize(hero) : "Hero";
      return {
        text: `Game started — ${heroLabel}${seed != null ? ` (seed ${seed})` : ""}`,
        category: EVENT_CATEGORY.LIFECYCLE,
      };
    }

    case "turnStarted": {
      const name = playerId ? heroName(players, playerId) : "Hero";
      const round = event.round as number | undefined;
      const tod = event.timeOfDay as string | undefined;
      const todLabel = tod ? formatTimeOfDay(tod) : "";
      return {
        text: `--- ${name}'s Turn${round != null ? ` (Round ${round}${todLabel ? `, ${todLabel}` : ""})` : ""} ---`,
        category: EVENT_CATEGORY.LIFECYCLE,
        playerId,
        isTurnBoundary: true,
      };
    }

    case "turnEnded": {
      const name = playerId ? heroName(players, playerId) : "Hero";
      return {
        text: `${name} ended their turn`,
        category: EVENT_CATEGORY.LIFECYCLE,
        playerId,
      };
    }

    case "roundEnded": {
      const round = event.round as number | undefined;
      return {
        text: round != null ? `Round ${round} ended` : "Round ended",
        category: EVENT_CATEGORY.LIFECYCLE,
      };
    }

    case "gameEnded": {
      const reason = event.reason as string | undefined;
      return {
        text: reason ? `Game ended — ${formatId(reason)}` : "Game ended",
        category: EVENT_CATEGORY.LIFECYCLE,
      };
    }

    // ---- Tactics ----

    case "tacticSelected": {
      const name = playerId ? heroName(players, playerId) : "Hero";
      const tacticId = event.tacticId as string | undefined;
      const tacticLabel = tacticId ? formatId(tacticId) : "a tactic";
      return {
        text: `${name} selected ${tacticLabel}`,
        category: EVENT_CATEGORY.TACTICS,
        playerId,
      };
    }

    // ---- Cards ----

    case "cardPlayed": {
      const name = playerId ? heroName(players, playerId) : "Hero";
      const cardId = event.cardId as string | undefined;
      const mode = event.mode as string | { sideways: string } | undefined;
      const cardLabel = cardId ? formatId(cardId) : "a card";
      let modeLabel = "";
      if (mode === "powered") {
        modeLabel = " (powered)";
      } else if (typeof mode === "object" && mode !== null && "sideways" in mode) {
        const sidewaysAs = (mode as { sideways: string }).sideways;
        modeLabel = ` — ${formatId(sidewaysAs)}`;
      }
      return {
        text: `${name} played ${cardLabel}${modeLabel}`,
        category: EVENT_CATEGORY.CARDS,
        playerId,
      };
    }

    // ---- Movement ----

    case "playerMoved": {
      const name = playerId ? heroName(players, playerId) : "Hero";
      const to = event.to as { q: number; r: number } | undefined;
      const toLabel = to ? `(${to.q},${to.r})` : "a new hex";
      return {
        text: `${name} moved to ${toLabel}`,
        category: EVENT_CATEGORY.MOVEMENT,
        playerId,
      };
    }

    case "tileExplored": {
      const name = playerId ? heroName(players, playerId) : "Hero";
      return {
        text: `${name} explored new territory`,
        category: EVENT_CATEGORY.MOVEMENT,
        playerId,
      };
    }

    // ---- Combat ----

    case "combatStarted": {
      const name = playerId ? heroName(players, playerId) : "Hero";
      const hex = event.hex as { q: number; r: number } | undefined;
      const hexLabel = hex ? ` at (${hex.q},${hex.r})` : "";
      return {
        text: `${name} enters combat${hexLabel}!`,
        category: EVENT_CATEGORY.COMBAT,
        playerId,
      };
    }

    case "combatEnded": {
      return {
        text: "Combat ended",
        category: EVENT_CATEGORY.COMBAT,
        playerId,
      };
    }

    case "enemyDefeated": {
      const enemyId = event.enemyId as string | undefined;
      const enemyLabel = enemyId ? formatId(enemyId) : "Enemy";
      return {
        text: `${enemyLabel} defeated`,
        category: EVENT_CATEGORY.COMBAT,
        playerId,
      };
    }

    // ---- Sites ----

    case "siteEntered": {
      const name = playerId ? heroName(players, playerId) : "Hero";
      return {
        text: `${name} entered a site`,
        category: EVENT_CATEGORY.SITES,
        playerId,
      };
    }

    // ---- Choices ----

    case "choiceResolved":
      // Internal bookkeeping — suppress
      return null;

    // ---- Progression ----

    case "fameGained": {
      const name = playerId ? heroName(players, playerId) : "Hero";
      const amount = event.amount as number | undefined;
      return {
        text: `${name} +${amount ?? "?"} fame`,
        category: EVENT_CATEGORY.PROGRESSION,
        playerId,
      };
    }

    case "levelUp": {
      const name = playerId ? heroName(players, playerId) : "Hero";
      const newLevel = event.newLevel as number | undefined;
      return {
        text: newLevel != null ? `${name} reached level ${newLevel}!` : `${name} leveled up!`,
        category: EVENT_CATEGORY.PROGRESSION,
        playerId,
      };
    }

    // ---- Health ----

    case "woundTaken": {
      const name = playerId ? heroName(players, playerId) : "Hero";
      return {
        text: `${name} took a wound`,
        category: EVENT_CATEGORY.HEALTH,
        playerId,
      };
    }

    // ---- Mana ----

    case "crystalGained": {
      const name = playerId ? heroName(players, playerId) : "Hero";
      const color = event.color as string | undefined;
      return {
        text: `${name} gained ${color ? `a ${color}` : "a"} crystal`,
        category: EVENT_CATEGORY.CARDS,
        playerId,
      };
    }

    // ---- Undo ----

    case "undone": {
      const name = playerId ? heroName(players, playerId) : "Hero";
      return {
        text: `${name} undid last action`,
        category: EVENT_CATEGORY.UNDO,
        playerId,
      };
    }

    // ---- Everything else → null (not narrated) ----
    default:
      return null;
  }
}
