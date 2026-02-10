"""Extract state-after-step from artifact messageLog and serve by step."""

from __future__ import annotations

import json
from pathlib import Path

INDEX_STEP = 5_000  # record byte offset every N lines


def build_states_ndjson(
    json_path: Path,
    states_path: Path,
    states_index_path: Path,
    action_trace_total: int | None = None,
) -> int:
    """Stream-parse json_path, extract every state_update message from messageLog.
    Keeps both streams: one message per player per step (filtered view per player).
    Each line is a full message: { player_id, message_type, payload } so you can
    see whose view it is. Order: initial p1, initial p2, after step0 p1, after step0 p2, ...
    """
    import ijson

    messages: list[dict] = []
    with open(json_path, "rb") as f_in:
        for msg in ijson.items(f_in, "messageLog.item"):
            if msg.get("message_type") != "state_update":
                continue
            payload = msg.get("payload") or {}
            if payload.get("state") is None:
                continue
            # Store full message so we know which player received this (filtered) view
            messages.append({
                "player_id": msg.get("player_id"),
                "message_type": msg.get("message_type"),
                "payload": payload,
            })

    if not messages:
        with open(states_index_path, "w", encoding="utf-8") as f:
            f.write("total\t0\nplayer_count\t0\n")
        return 0

    # Infer player_count: (steps+1) * player_count = len(messages)
    player_count = 1
    if action_trace_total is not None and action_trace_total >= 0:
        steps_plus_one = action_trace_total + 1
        if steps_plus_one > 0 and len(messages) % steps_plus_one == 0:
            player_count = len(messages) // steps_plus_one

    count = 0
    index_entries: list[tuple[int, int]] = []
    with open(states_path, "w", encoding="utf-8") as f_out:
        for msg in messages:
            if count % INDEX_STEP == 0:
                index_entries.append((count, f_out.tell()))
            f_out.write(json.dumps(msg, sort_keys=True) + "\n")
            count += 1

    with open(states_index_path, "w", encoding="utf-8") as f:
        for line_no, offset in index_entries:
            f.write(f"{line_no}\t{offset}\n")
        f.write(f"total\t{count}\n")
        f.write(f"player_count\t{player_count}\n")

    return count


def _load_states_index(index_path: Path) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    with open(index_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("total\t") or line.startswith("player_count\t"):
                continue
            a, b = line.split("\t", 1)
            out.append((int(a), int(b)))
    return out


def _player_count_from_index(index_path: Path) -> int:
    if not index_path.exists():
        return 1
    with open(index_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("player_count\t"):
                return int(line.split("\t", 1)[1])
    return 1


def read_state_at_step(states_path: Path, index_path: Path, step: int) -> list[dict] | None:
    """Return all player views after the given action step (0-based).
    Each view is the full message: { player_id, message_type, payload }.
    So you get one entry per player, each with that player's filtered state.
    """
    if not states_path.exists():
        return None
    total = _states_total(index_path)
    if total is None or total == 0:
        return None
    player_count = _player_count_from_index(index_path)
    if player_count <= 0:
        return None
    # step N => messages at lines (N+1)*player_count .. (N+1)*player_count + player_count - 1
    start_line_idx = (step + 1) * player_count
    if start_line_idx + player_count > total:
        return None
    if step < 0:
        return None
    if index_path.exists():
        index = _load_states_index(index_path)
        start_line = 0
        start_byte = 0
        for line_no, byte_offset in index:
            if line_no <= start_line_idx:
                start_line = line_no
                start_byte = byte_offset
            else:
                break
        to_skip = start_line_idx - start_line
    else:
        start_byte = 0
        to_skip = start_line_idx

    updates: list[dict] = []
    with open(states_path, "r", encoding="utf-8") as f:
        f.seek(start_byte)
        for _ in range(to_skip):
            f.readline()
        for _ in range(player_count):
            line = f.readline()
            if not line:
                break
            line = line.strip()
            if not line:
                continue
            updates.append(json.loads(line))
    return updates if len(updates) == player_count else None


def _states_total(index_path: Path) -> int | None:
    if not index_path.exists():
        return None
    with open(index_path, encoding="utf-8") as f:
        for line in reversed(list(f)):
            line = line.strip()
            if line.startswith("total\t"):
                return int(line.split("\t", 1)[1])
    return None


def states_count(index_path: Path) -> int | None:
    """Return total number of state steps, or None if not built."""
    return _states_total(index_path)
