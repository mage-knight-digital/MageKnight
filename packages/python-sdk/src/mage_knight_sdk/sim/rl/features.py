from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

from ..generated_action_enumerator import CandidateAction
from .vocabularies import (
    ACTION_TYPE_VOCAB,
    CARD_VOCAB,
    ENEMY_VOCAB,
    MODE_VOCAB,
    SOURCE_VOCAB,
    UNIT_VOCAB,
)

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


# ============================================================================
# Structured feature types for embedding-based network
# ============================================================================


@dataclass(frozen=True)
class StateFeatures:
    """State features computed once per step (shared across all candidates)."""

    scalars: list[float]       # STATE_SCALAR_DIM + MAP_SCALAR_DIM floats
    mode_id: int               # MODE_VOCAB index
    hand_card_ids: list[int]   # variable-length CARD_VOCAB indices
    unit_ids: list[int]        # variable-length UNIT_VOCAB indices


@dataclass(frozen=True)
class ActionFeatures:
    """Per-candidate action features."""

    action_type_id: int        # ACTION_TYPE_VOCAB index
    source_id: int             # SOURCE_VOCAB index
    card_id: int               # CARD_VOCAB index (from cardId field, or 0)
    unit_id: int               # UNIT_VOCAB index (from unitId field, or 0)
    enemy_id: int              # ENEMY_VOCAB index (from enemyId/targetId, or 0)
    scalars: list[float]       # ACTION_SCALAR_DIM floats


@dataclass(frozen=True)
class EncodedStep:
    """Structured encoding for one decision step."""

    state: StateFeatures
    actions: list[ActionFeatures]


def encode_step(
    state: dict[str, Any],
    player_id: str,
    candidates: list[CandidateAction],
) -> EncodedStep:
    """Encode state once, then each candidate's action-specific features.

    This is the new structured encoding path for the embedding network.
    State features are computed once per step (not per candidate).
    """
    player = _find_player(state, player_id)
    valid_actions = state.get("validActions")
    valid_actions_dict = valid_actions if isinstance(valid_actions, dict) else {}

    # --- State features (computed once) ---
    state_scalars = _state_scalars(state, player, player_id, valid_actions_dict)
    map_scalars = _map_scalars(state, player)
    scalars = state_scalars + map_scalars

    mode = valid_actions_dict.get("mode")
    mode_value = mode if isinstance(mode, str) else "unknown"
    mode_id = MODE_VOCAB.encode(mode_value)

    hand_card_ids = _extract_hand_card_ids(player)
    unit_ids = _extract_unit_ids(player)

    state_features = StateFeatures(
        scalars=scalars,
        mode_id=mode_id,
        hand_card_ids=hand_card_ids,
        unit_ids=unit_ids,
    )

    # --- Per-candidate action features ---
    action_features_list: list[ActionFeatures] = []
    for candidate in candidates:
        action = candidate.action
        action_type = action.get("type")
        action_type_value = action_type if isinstance(action_type, str) else "unknown"

        card_id_str = action.get("cardId")
        unit_id_str = action.get("unitId")
        enemy_id_str = action.get("enemyId") or action.get("targetId")

        action_features_list.append(ActionFeatures(
            action_type_id=ACTION_TYPE_VOCAB.encode(action_type_value),
            source_id=SOURCE_VOCAB.encode(candidate.source),
            card_id=CARD_VOCAB.encode(card_id_str) if isinstance(card_id_str, str) else 0,
            unit_id=UNIT_VOCAB.encode(unit_id_str) if isinstance(unit_id_str, str) else 0,
            enemy_id=ENEMY_VOCAB.encode(enemy_id_str) if isinstance(enemy_id_str, str) else 0,
            scalars=_action_scalars(action),
        ))

    return EncodedStep(state=state_features, actions=action_features_list)


def _extract_hand_card_ids(player: dict[str, Any] | None) -> list[int]:
    """Extract card IDs from player hand as vocabulary indices."""
    if player is None:
        return []
    hand = player.get("hand")
    if not isinstance(hand, list):
        return []
    ids: list[int] = []
    for entry in hand:
        if isinstance(entry, str):
            ids.append(CARD_VOCAB.encode(entry))
        elif isinstance(entry, dict):
            card_id = entry.get("id")
            if isinstance(card_id, str):
                ids.append(CARD_VOCAB.encode(card_id))
    return ids


def _extract_unit_ids(player: dict[str, Any] | None) -> list[int]:
    """Extract unit IDs from player units as vocabulary indices."""
    if player is None:
        return []
    units = player.get("units")
    if not isinstance(units, list):
        return []
    ids: list[int] = []
    for unit in units:
        if isinstance(unit, dict):
            unit_id = unit.get("id")
            if isinstance(unit_id, str):
                ids.append(UNIT_VOCAB.encode(unit_id))
    return ids
