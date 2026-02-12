from __future__ import annotations

import hashlib
from typing import Any

STATE_SCALAR_DIM = 12
MAP_SCALAR_DIM = 12
MODE_BUCKETS = 16
ACTION_TYPE_BUCKETS = 64
SOURCE_BUCKETS = 16
ACTION_SCALAR_DIM = 6
FEATURE_DIM = (
    STATE_SCALAR_DIM
    + MAP_SCALAR_DIM
    + MODE_BUCKETS
    + ACTION_TYPE_BUCKETS
    + SOURCE_BUCKETS
    + ACTION_SCALAR_DIM
)


def encode_state_action(
    state: dict[str, Any],
    player_id: str,
    action: dict[str, Any],
    source: str,
) -> list[float]:
    """Encode state + candidate action into a fixed-size feature vector."""
    player = _find_player(state, player_id)
    valid_actions = state.get("validActions")
    valid_actions_dict = valid_actions if isinstance(valid_actions, dict) else {}

    mode = valid_actions_dict.get("mode")
    mode_value = mode if isinstance(mode, str) else "unknown"

    features: list[float] = []
    features.extend(_state_scalars(state, player, player_id, valid_actions_dict))
    features.extend(_map_scalars(state, player))
    features.extend(_one_hot_bucket(mode_value, MODE_BUCKETS))
    action_type = action.get("type")
    action_type_value = action_type if isinstance(action_type, str) else "unknown"
    features.extend(_one_hot_bucket(action_type_value, ACTION_TYPE_BUCKETS))
    features.extend(_one_hot_bucket(source, SOURCE_BUCKETS))
    features.extend(_action_scalars(action))
    return features


def _state_scalars(
    state: dict[str, Any],
    player: dict[str, Any] | None,
    player_id: str,
    valid_actions: dict[str, Any],
) -> list[float]:
    if player is None:
        return [0.0] * STATE_SCALAR_DIM

    valid_count = _estimate_valid_action_count(valid_actions)
    current_player = state.get("currentPlayerId")
    current_player_is_actor = 1.0 if current_player == player_id else 0.0

    return [
        _scale(_as_number(player.get("fame")), 30.0),
        _scale(_as_number(player.get("level")), 10.0),
        _scale(_as_number(player.get("reputation")), 10.0),
        _scale(_list_len(player.get("hand")), 20.0),
        _scale(_as_number(player.get("deckCount")), 30.0),
        _scale(_list_len(player.get("discardPile")), 30.0),
        _scale(_count_wounds_in_hand(player.get("hand")), 10.0),
        _scale(_count_ready_units(player.get("units")), 6.0),
        current_player_is_actor,
        _scale(valid_count, 40.0),
        _scale(_sum_pool(player.get("manaTokens")), 15.0),
        _scale(_sum_pool(player.get("crystals")), 12.0),
    ]


def _map_scalars(
    state: dict[str, Any],
    player: dict[str, Any] | None,
) -> list[float]:
    """Fixed-size map summary: hex counts, terrain, sites, enemies, distance to nearest site."""
    if player is None:
        return [0.0] * MAP_SCALAR_DIM

    map_data = state.get("map")
    if not isinstance(map_data, dict):
        return [0.0] * MAP_SCALAR_DIM

    hexes = map_data.get("hexes")
    if not isinstance(hexes, dict):
        return [0.0] * MAP_SCALAR_DIM

    # Player position (axial q, r)
    pos = player.get("position")
    if isinstance(pos, dict):
        pq = int(pos.get("q", 0)) if _is_int(pos.get("q")) else 0
        pr = int(pos.get("r", 0)) if _is_int(pos.get("r")) else 0
    else:
        pq, pr = 0, 0

    terrain_counts: dict[str, float] = {}
    unconquered_sites = 0
    hexes_with_enemies = 0
    hexes_with_rampaging = 0
    nearest_site_dist: float | None = None

    for _key, hex_obj in hexes.items():
        if not isinstance(hex_obj, dict):
            continue
        terrain = hex_obj.get("terrain")
        if isinstance(terrain, str):
            terrain_counts[terrain] = terrain_counts.get(terrain, 0.0) + 1.0

        site = hex_obj.get("site")
        if isinstance(site, dict):
            if not bool(site.get("isConquered")):
                unconquered_sites += 1
                coord = hex_obj.get("coord")
                if isinstance(coord, dict) and _is_int(coord.get("q")) and _is_int(coord.get("r")):
                    d = _hex_distance(pq, pr, int(coord["q"]), int(coord["r"]))
                    if nearest_site_dist is None or d < nearest_site_dist:
                        nearest_site_dist = d

        enemies = hex_obj.get("enemies")
        if isinstance(enemies, list) and len(enemies) > 0:
            hexes_with_enemies += 1
        rampaging = hex_obj.get("rampagingEnemies")
        if isinstance(rampaging, list) and len(rampaging) > 0:
            hexes_with_rampaging += 1

    tiles = map_data.get("tiles")
    revealed_tiles = 0
    if isinstance(tiles, list):
        for t in tiles:
            if isinstance(t, dict) and bool(t.get("revealed")):
                revealed_tiles += 1

    terrain_order = ("plains", "forest", "lake", "mountain", "swamp", "hills")
    terrain_vec = [_scale(terrain_counts.get(t, 0.0), 30.0) for t in terrain_order]

    return [
        _scale(float(len(hexes)), 100.0),
        _scale(float(revealed_tiles), 10.0),
        *terrain_vec,
        _scale(float(unconquered_sites), 20.0),
        _scale(float(hexes_with_enemies), 10.0),
        _scale(float(hexes_with_rampaging), 10.0),
        _scale(nearest_site_dist if nearest_site_dist is not None else 0.0, 15.0),
    ]


def _hex_distance(q1: int, r1: int, q2: int, r2: int) -> float:
    """Axial hex distance."""
    return (abs(q1 - q2) + abs(r1 - r2) + abs((q1 + r1) - (q2 + r2))) / 2.0


def _is_int(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _estimate_valid_action_count(valid_actions: dict[str, Any]) -> float:
    count = 0
    for value in valid_actions.values():
        if isinstance(value, dict):
            count += len(value)
        elif isinstance(value, list):
            count += len(value)
        elif isinstance(value, bool) and value:
            count += 1
    return float(count)


def _action_scalars(action: dict[str, Any]) -> list[float]:
    key_count = len(action)
    list_item_count = 0
    bool_true_count = 0
    numeric_sum = 0.0
    string_value_count = 0

    for value in action.values():
        if isinstance(value, list):
            list_item_count += len(value)
        elif isinstance(value, bool):
            bool_true_count += 1 if value else 0
        elif isinstance(value, (int, float)):
            numeric_sum += float(value)
        elif isinstance(value, str):
            string_value_count += 1

    has_target = 1.0 if "targetId" in action or "target" in action else 0.0

    return [
        _scale(float(key_count), 12.0),
        _scale(float(list_item_count), 12.0),
        _scale(float(bool_true_count), 6.0),
        _scale(numeric_sum, 50.0),
        _scale(float(string_value_count), 8.0),
        has_target,
    ]


def _find_player(state: dict[str, Any], player_id: str) -> dict[str, Any] | None:
    players = state.get("players")
    if not isinstance(players, list):
        return None
    for player in players:
        if not isinstance(player, dict):
            continue
        if player.get("id") == player_id:
            return player
    return None


def _count_wounds_in_hand(hand: Any) -> float:
    if not isinstance(hand, list):
        return 0.0
    wounds = 0
    for entry in hand:
        if isinstance(entry, str):
            if entry.lower() == "wound":
                wounds += 1
        elif isinstance(entry, dict):
            card_id = entry.get("id")
            if isinstance(card_id, str) and card_id.lower() == "wound":
                wounds += 1
    return float(wounds)


def _count_ready_units(units: Any) -> float:
    if not isinstance(units, list):
        return 0.0
    ready = 0
    for unit in units:
        if isinstance(unit, dict) and not bool(unit.get("isExhausted")):
            ready += 1
    return float(ready)


def _sum_pool(pool: Any) -> float:
    if not isinstance(pool, dict):
        return 0.0
    total = 0.0
    for value in pool.values():
        if isinstance(value, (int, float)):
            total += float(value)
    return total


def _one_hot_bucket(value: str, buckets: int) -> list[float]:
    vec = [0.0] * buckets
    idx = _hash_bucket(value, buckets)
    vec[idx] = 1.0
    return vec


def _hash_bucket(value: str, buckets: int) -> int:
    digest = hashlib.sha1(value.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], byteorder="big", signed=False) % buckets


def _list_len(value: Any) -> float:
    return float(len(value)) if isinstance(value, list) else 0.0


def _as_number(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    return 0.0


def _scale(value: float, denom: float) -> float:
    if denom <= 0:
        return 0.0
    clamped = max(min(value / denom, 5.0), -5.0)
    return clamped
