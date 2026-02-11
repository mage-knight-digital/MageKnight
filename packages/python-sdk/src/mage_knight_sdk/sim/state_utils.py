from __future__ import annotations

import json
from typing import Any


def mode(state: dict[str, Any]) -> str:
    valid_actions = state.get("validActions")
    if not isinstance(valid_actions, dict):
        return "unknown"
    m = valid_actions.get("mode")
    if isinstance(m, str):
        return m
    return "unknown"


def action_key(action: dict[str, Any]) -> str:
    return json.dumps(action, sort_keys=True, separators=(",", ":"))


def draw_pile_count_for_player(state: dict[str, Any], player_id: str) -> int | None:
    players = state.get("players")
    if not isinstance(players, list):
        return None
    for player in players:
        if not isinstance(player, dict):
            continue
        if player.get("id") != player_id:
            continue
        deck_count = player.get("deckCount")
        return int(deck_count) if isinstance(deck_count, int) else None
    return None


def player_ids_from_state(state: dict[str, Any]) -> list[str]:
    """Return player ids from state, for stall detection across all players."""
    players = state.get("players")
    if not isinstance(players, list):
        return []
    ids: list[str] = []
    for player in players:
        if isinstance(player, dict):
            pid = player.get("id")
            if isinstance(pid, str):
                ids.append(pid)
    return ids
