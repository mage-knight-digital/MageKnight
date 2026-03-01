"""Build NDJSON + line index from a large actionTrace JSON for fast slice access."""

from __future__ import annotations

import json
from pathlib import Path

INDEX_STEP = 10_000  # record byte offset every N lines


def build_ndjson_and_index(json_path: Path, ndjson_path: Path, index_path: Path) -> int:
    """Stream-parse json_path's actionTrace, write NDJSON and index. Returns total count."""
    import ijson

    count = 0
    index_entries: list[tuple[int, int]] = []

    with open(json_path, "rb") as f_in, open(ndjson_path, "w", encoding="utf-8") as f_out:
        for item in ijson.items(f_in, "actionTrace.item"):
            if count % INDEX_STEP == 0:
                index_entries.append((count, f_out.tell()))
            f_out.write(json.dumps(item, sort_keys=True) + "\n")
            count += 1

    with open(index_path, "w", encoding="utf-8") as f:
        for line_no, offset in index_entries:
            f.write(f"{line_no}\t{offset}\n")
        f.write(f"total\t{count}\n")

    return count


def load_index(index_path: Path) -> list[tuple[int, int]]:
    """Load (line_no, byte_offset) pairs from index file (excludes 'total' line)."""
    out: list[tuple[int, int]] = []
    with open(index_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            a, b = line.split("\t", 1)
            if a == "total":
                continue
            out.append((int(a), int(b)))
    return out


def read_slice(
    ndjson_path: Path, index_path: Path, offset: int, limit: int
) -> list[dict]:
    """Read entries [offset, offset+limit) from NDJSON using the index."""
    index = load_index(index_path)
    if not index:
        return _read_slice_no_index(ndjson_path, offset, limit)

    # Find largest index entry <= offset
    start_line = 0
    start_byte = 0
    for line_no, byte_offset in index:
        if line_no <= offset:
            start_line = line_no
            start_byte = byte_offset
        else:
            break

    result: list[dict] = []
    to_skip = offset - start_line
    to_take = limit

    with open(ndjson_path, "r", encoding="utf-8") as f:
        f.seek(start_byte)
        for line in f:
            if to_skip > 0:
                to_skip -= 1
                continue
            if to_take <= 0:
                break
            line = line.strip()
            if not line:
                continue
            result.append(json.loads(line))
            to_take -= 1

    return result


def _read_slice_no_index(ndjson_path: Path, offset: int, limit: int) -> list[dict]:
    """Fallback when no index: read from start and skip."""
    result: list[dict] = []
    with open(ndjson_path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i < offset:
                continue
            if len(result) >= limit:
                break
            line = line.strip()
            if not line:
                continue
            result.append(json.loads(line))
    return result


def build_ndjson_from_message_log(
    json_path: Path, ndjson_path: Path, index_path: Path,
) -> int:
    """Build NDJSON index from an artifact's messageLog (no actionTrace).

    Streams messageLog, skips the initial frame (first state_update), and
    summarises each subsequent message's events into one NDJSON line per step.
    Returns total step count.
    """
    import ijson

    count = 0
    index_entries: list[tuple[int, int]] = []
    first_skipped = False

    with open(json_path, "rb") as f_in, open(ndjson_path, "w", encoding="utf-8") as f_out:
        for msg in ijson.items(f_in, "messageLog.item"):
            if msg.get("message_type") != "state_update":
                continue
            # Skip the initial frame (first state_update is the starting state)
            if not first_skipped:
                first_skipped = True
                continue

            payload = msg.get("payload") or {}
            events = payload.get("events") or []
            summary = _summarize_events(events)

            entry = {
                "step": count,
                "player_id": msg.get("player_id", "player_0"),
                "action": summary,
                "source": "replay",
            }

            if count % INDEX_STEP == 0:
                index_entries.append((count, f_out.tell()))
            f_out.write(json.dumps(entry, sort_keys=True) + "\n")
            count += 1

    with open(index_path, "w", encoding="utf-8") as f:
        for line_no, offset in index_entries:
            f.write(f"{line_no}\t{offset}\n")
        f.write(f"total\t{count}\n")

    return count


# Priority order for picking the most informative event from a step's event list.
_EVENT_PRIORITY: dict[str, int] = {
    "cardPlayed": 1,
    "playerMoved": 2,
    "tacticSelected": 3,
    "tileExplored": 4,
    "siteEntered": 5,
    "combatStarted": 6,
    "enemyDefeated": 7,
    "levelUp": 8,
    "fameGained": 9,
    "crystalGained": 10,
    "woundTaken": 11,
    "combatEnded": 12,
    "turnStarted": 13,
    "turnEnded": 14,
    "roundEnded": 15,
    "choiceResolved": 16,
    "undone": 17,
    "gameStarted": 18,
    "gameEnded": 19,
}


def _summarize_events(events: list[dict]) -> dict:
    """Pick the most informative event and map it to the shape formatAction() expects.

    Note: event type tags are camelCase (serde rename_all), but struct field names
    are snake_case (Rust default serde).
    """
    if not events:
        return {"type": "unknown"}

    # Sort by priority (lowest = most informative), pick first
    best = min(events, key=lambda e: _EVENT_PRIORITY.get(e.get("type", ""), 99))
    etype = best.get("type", "unknown")

    summary: dict = {"type": etype}

    if etype == "cardPlayed":
        if best.get("card_id"):
            summary["cardId"] = best["card_id"]
        if best.get("mode"):
            summary["as"] = best["mode"]
    elif etype == "tacticSelected":
        if best.get("tactic_id"):
            summary["tacticId"] = best["tactic_id"]
    elif etype == "playerMoved":
        if best.get("to"):
            summary["target"] = best["to"]
    elif etype == "enemyDefeated":
        if best.get("enemy_id"):
            summary["target"] = best["enemy_id"]
    elif etype == "tileExplored":
        if best.get("direction"):
            summary["target"] = best["direction"]
    elif etype == "fameGained":
        if best.get("amount"):
            summary["target"] = f"+{best['amount']}"
    elif etype == "levelUp":
        if best.get("new_level"):
            summary["target"] = f"level {best['new_level']}"
    elif etype == "choiceResolved":
        if best.get("choice_index") is not None:
            summary["decision"] = best["choice_index"]

    return summary


def count_entries(index_path: Path) -> int | None:
    """Return total entry count from index file if available; else None (need to build)."""
    if not index_path.exists():
        return None
    with open(index_path, encoding="utf-8") as f:
        for line in reversed(list(f)):
            line = line.strip()
            if line.startswith("total\t"):
                return int(line.split("\t", 1)[1])
    return None
