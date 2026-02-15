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
    SITE_VOCAB,
    SKILL_VOCAB,
    SOURCE_VOCAB,
    TERRAIN_VOCAB,
    UNIT_VOCAB,
)

# ---------------------------------------------------------------------------
# Legacy flat-encoding constants (kept for backward compatibility)
# ---------------------------------------------------------------------------

_LEGACY_STATE_SCALAR_DIM = 12
_LEGACY_MAP_SCALAR_DIM = 12
MODE_BUCKETS = 16
ACTION_TYPE_BUCKETS = 64
SOURCE_BUCKETS = 16
_LEGACY_ACTION_SCALAR_DIM = 6
FEATURE_DIM = (
    _LEGACY_STATE_SCALAR_DIM
    + _LEGACY_MAP_SCALAR_DIM
    + MODE_BUCKETS
    + ACTION_TYPE_BUCKETS
    + SOURCE_BUCKETS
    + _LEGACY_ACTION_SCALAR_DIM
)

# ---------------------------------------------------------------------------
# Embedding-based encoding constants
# ---------------------------------------------------------------------------

STATE_SCALAR_DIM = 76
ACTION_SCALAR_DIM = 12
SITE_SCALAR_DIM = 6   # per-site scalars for map pool
ENEMY_HEX_SCALAR_DIM = 5  # per-hex scalars for enemy pool

# Canonical neighbor direction offsets in axial coords (E, NE, NW, W, SW, SE)
_NEIGHBOR_OFFSETS: tuple[tuple[int, int], ...] = (
    (1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1),
)

# Combat phase names for one-hot encoding
_COMBAT_PHASES: tuple[str, ...] = (
    "ranged_siege", "block", "assign_damage", "attack",
)

# Mana color order for per-color features
_MANA_COLORS: tuple[str, ...] = ("red", "blue", "green", "white", "gold", "black")
_CRYSTAL_COLORS: tuple[str, ...] = ("red", "blue", "green", "white")


# ============================================================================
# Structured feature types for embedding-based network
# ============================================================================


@dataclass(frozen=True)
class StateFeatures:
    """State features computed once per step (shared across all candidates)."""

    scalars: list[float]                    # STATE_SCALAR_DIM floats (76)
    mode_id: int                            # MODE_VOCAB index
    hand_card_ids: list[int]                # variable-length CARD_VOCAB indices
    unit_ids: list[int]                     # variable-length UNIT_VOCAB indices
    current_terrain_id: int                 # TERRAIN_VOCAB index
    current_site_type_id: int               # SITE_VOCAB index
    combat_enemy_ids: list[int]             # ENEMY_VOCAB indices
    skill_ids: list[int]                    # SKILL_VOCAB indices
    # Full map visibility (variable-length, mean-pooled in network)
    visible_site_ids: list[int]             # SITE_VOCAB index per visible site
    visible_site_scalars: list[list[float]] # SITE_SCALAR_DIM floats per site
    enemy_hex_scalars: list[list[float]]    # ENEMY_HEX_SCALAR_DIM floats per hex


@dataclass(frozen=True)
class ActionFeatures:
    """Per-candidate action features."""

    action_type_id: int        # ACTION_TYPE_VOCAB index
    source_id: int             # SOURCE_VOCAB index
    card_id: int               # CARD_VOCAB index (from cardId field, or 0)
    unit_id: int               # UNIT_VOCAB index (from unitId field, or 0)
    enemy_id: int              # ENEMY_VOCAB index (from enemyId/targetId, or 0)
    scalars: list[float]       # ACTION_SCALAR_DIM floats (12)


@dataclass(frozen=True)
class EncodedStep:
    """Structured encoding for one decision step."""

    state: StateFeatures
    actions: list[ActionFeatures]


# ============================================================================
# Main encoding entry point
# ============================================================================


def encode_step(
    state: dict[str, Any],
    player_id: str,
    candidates: list[CandidateAction],
) -> EncodedStep:
    """Encode state once, then each candidate's action-specific features."""
    player = _find_player(state, player_id)
    valid_actions = state.get("validActions")
    valid_actions_dict = valid_actions if isinstance(valid_actions, dict) else {}

    # --- State features (computed once) ---
    if player is None:
        scalars = [0.0] * STATE_SCALAR_DIM
        mode_id = 0
        hand_card_ids: list[int] = []
        unit_ids: list[int] = []
        current_terrain_id = 0
        current_site_type_id = 0
        combat_enemy_ids: list[int] = []
        skill_ids: list[int] = []
        visible_site_ids: list[int] = []
        visible_site_scalars: list[list[float]] = []
        enemy_hex_scalars: list[list[float]] = []
    else:
        pq, pr = _player_position(player)
        hexes = _get_hexes(state)

        # Scalar groups
        player_core = _extract_player_core(state, player, player_id)     # 10
        resources = _extract_player_resources(player)                     # 13
        tempo = _extract_tempo_features(state, player)                   # 5
        combat_scalars, combat_enemy_ids = _extract_combat_features(state, player)  # 10
        hex_scalars, current_terrain_id, current_site_type_id = _extract_current_hex_features(hexes, pq, pr)  # 3
        neighbor_scalars = _extract_neighbor_features(hexes, pq, pr)     # 24
        global_spatial = _extract_global_spatial(hexes, pq, pr)          # 5
        mana_source = _extract_mana_source_features(state)               # 6

        scalars = (
            player_core + resources + tempo + combat_scalars
            + hex_scalars + neighbor_scalars + global_spatial + mana_source
        )

        mode = valid_actions_dict.get("mode")
        mode_value = mode if isinstance(mode, str) else "unknown"
        mode_id = MODE_VOCAB.encode(mode_value)

        hand_card_ids = _extract_hand_card_ids(player)
        unit_ids = _extract_unit_ids(player)
        skill_ids = _extract_skill_ids(player)

        # Full map pools
        visible_site_ids, visible_site_scalars = _extract_visible_sites(hexes, pq, pr)
        enemy_hex_scalars = _extract_enemy_hexes(hexes, pq, pr)

    state_features = StateFeatures(
        scalars=scalars,
        mode_id=mode_id,
        hand_card_ids=hand_card_ids,
        unit_ids=unit_ids,
        current_terrain_id=current_terrain_id,
        current_site_type_id=current_site_type_id,
        combat_enemy_ids=combat_enemy_ids,
        skill_ids=skill_ids,
        visible_site_ids=visible_site_ids,
        visible_site_scalars=visible_site_scalars,
        enemy_hex_scalars=enemy_hex_scalars,
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


# ============================================================================
# State scalar extraction helpers
# ============================================================================


def _extract_player_core(
    state: dict[str, Any],
    player: dict[str, Any],
    player_id: str,
) -> list[float]:
    """Player Core (10): fame, level, reputation, hand_size, deck_count,
    discard_count, wounds_in_hand, ready_units, is_current_player, armor."""
    current_player = state.get("currentPlayerId")
    return [
        _scale(_as_number(player.get("fame")), 30.0),
        _scale(_as_number(player.get("level")), 10.0),
        _scale(_as_number(player.get("reputation")), 10.0),
        _scale(_list_len(player.get("hand")), 20.0),
        _scale(_as_number(player.get("deckCount")), 30.0),
        _scale(_list_len(player.get("discardPile")), 30.0),
        _scale(_count_wounds_in_hand(player.get("hand")), 10.0),
        _scale(_count_ready_units(player.get("units")), 6.0),
        1.0 if current_player == player_id else 0.0,
        _scale(_as_number(player.get("armor")), 10.0),
    ]


def _extract_player_resources(player: dict[str, Any]) -> list[float]:
    """Player Resources (13): move_points, influence_points, healing_points,
    mana per-color ×6, crystals per-color ×4."""
    tokens = player.get("manaTokens")
    if not isinstance(tokens, dict):
        tokens = {}
    crystals = player.get("crystals")
    if not isinstance(crystals, dict):
        crystals = {}

    return [
        _scale(_as_number(player.get("movePoints")), 10.0),
        _scale(_as_number(player.get("influencePoints")), 10.0),
        _scale(_as_number(player.get("healingPoints")), 10.0),
        # Mana per-color (6)
        *[_scale(_as_number(tokens.get(c)), 5.0) for c in _MANA_COLORS],
        # Crystals per-color (4)
        *[_scale(_as_number(crystals.get(c)), 3.0) for c in _CRYSTAL_COLORS],
    ]


def _extract_tempo_features(
    state: dict[str, Any],
    player: dict[str, Any],
) -> list[float]:
    """Tempo (5): round, time_of_day, has_moved, has_taken_action, end_of_round."""
    time_of_day = state.get("timeOfDay")
    return [
        _scale(_as_number(state.get("round")), 6.0),
        1.0 if time_of_day == "day" else 0.0,
        1.0 if bool(player.get("hasMovedThisTurn")) else 0.0,
        1.0 if bool(player.get("hasTakenActionThisTurn")) else 0.0,
        1.0 if bool(state.get("endOfRoundAnnounced")) else 0.0,
    ]


def _extract_combat_features(
    state: dict[str, Any],
    player: dict[str, Any],
) -> tuple[list[float], list[int]]:
    """Combat (10 scalars + enemy IDs): in_combat, phase one-hot ×4,
    num_enemies, total_enemy_armor, total_enemy_attack, is_fortified, wounds_this_combat."""
    combat = state.get("combat")
    if not isinstance(combat, dict):
        return [0.0] * 10, []

    in_combat = 1.0
    phase = combat.get("phase")
    phase_str = phase if isinstance(phase, str) else ""
    phase_one_hot = [1.0 if phase_str == p else 0.0 for p in _COMBAT_PHASES]

    enemies = combat.get("enemies")
    enemy_ids: list[int] = []
    num_enemies = 0
    total_armor = 0.0
    total_attack = 0.0
    if isinstance(enemies, list):
        num_enemies = len(enemies)
        for enemy in enemies:
            if isinstance(enemy, dict):
                eid = enemy.get("id")
                if isinstance(eid, str):
                    enemy_ids.append(ENEMY_VOCAB.encode(eid))
                total_armor += _as_number(enemy.get("armor"))
                total_attack += _as_number(enemy.get("attack"))

    is_fortified = 1.0 if bool(combat.get("isFortified")) else 0.0
    wounds_this_combat = _as_number(combat.get("woundsThisCombat"))

    scalars = [
        in_combat,
        *phase_one_hot,
        _scale(float(num_enemies), 5.0),
        _scale(total_armor, 20.0),
        _scale(total_attack, 20.0),
        is_fortified,
        _scale(wounds_this_combat, 5.0),
    ]
    return scalars, enemy_ids


def _extract_current_hex_features(
    hexes: dict[str, Any],
    pq: int,
    pr: int,
) -> tuple[list[float], int, int]:
    """Current Hex (3 scalars + terrain_id + site_type_id)."""
    hex_obj = _hex_at(hexes, pq, pr)
    if hex_obj is None:
        return [0.0, 0.0, 0.0], 0, 0

    terrain = hex_obj.get("terrain")
    terrain_str = terrain if isinstance(terrain, str) else ""
    terrain_id = TERRAIN_VOCAB.encode(terrain_str)
    terrain_difficulty = _get_terrain_difficulty(terrain_str)

    site = hex_obj.get("site")
    has_site = 0.0
    site_conquered = 0.0
    site_type_id = 0
    if isinstance(site, dict):
        has_site = 1.0
        site_conquered = 1.0 if bool(site.get("isConquered")) else 0.0
        site_type = site.get("type")
        if isinstance(site_type, str):
            site_type_id = SITE_VOCAB.encode(site_type)

    return [terrain_difficulty, has_site, site_conquered], terrain_id, site_type_id


def _extract_neighbor_features(
    hexes: dict[str, Any],
    pq: int,
    pr: int,
) -> list[float]:
    """6 Neighbors × 4 features = 24 floats.
    Per direction: terrain_difficulty, has_site, has_enemies, hex_exists."""
    features: list[float] = []
    for dq, dr in _NEIGHBOR_OFFSETS:
        nq, nr = pq + dq, pr + dr
        hex_obj = _hex_at(hexes, nq, nr)
        if hex_obj is None:
            features.extend([0.0, 0.0, 0.0, 0.0])
        else:
            terrain = hex_obj.get("terrain")
            terrain_str = terrain if isinstance(terrain, str) else ""
            td = _get_terrain_difficulty(terrain_str)

            site = hex_obj.get("site")
            has_site = 1.0 if isinstance(site, dict) else 0.0

            enemies = hex_obj.get("enemies")
            rampaging = hex_obj.get("rampagingEnemies")
            has_enemies = 1.0 if (
                (isinstance(enemies, list) and len(enemies) > 0)
                or (isinstance(rampaging, list) and len(rampaging) > 0)
            ) else 0.0

            features.extend([td, has_site, has_enemies, 1.0])
    return features


def _extract_global_spatial(
    hexes: dict[str, Any],
    pq: int,
    pr: int,
) -> list[float]:
    """Global Spatial (5): distance_to_nearest_site, direction_dq, direction_dr,
    unconquered_sites, revealed_tiles."""
    nearest_dist: float | None = None
    nearest_dq = 0.0
    nearest_dr = 0.0
    unconquered = 0
    revealed_tiles = 0

    for _key, hex_obj in hexes.items():
        if not isinstance(hex_obj, dict):
            continue
        site = hex_obj.get("site")
        if isinstance(site, dict) and not bool(site.get("isConquered")):
            unconquered += 1
            coord = hex_obj.get("coord")
            if isinstance(coord, dict) and _is_int(coord.get("q")) and _is_int(coord.get("r")):
                hq, hr = int(coord["q"]), int(coord["r"])
                d = _hex_distance(pq, pr, hq, hr)
                if nearest_dist is None or d < nearest_dist:
                    nearest_dist = d
                    nearest_dq = float(hq - pq)
                    nearest_dr = float(hr - pr)

    # Count revealed tiles from parent map — we'll pass this through from the caller
    # For now we count hexes as a proxy (each revealed tile has hexes)
    # The hexes dict only contains revealed hexes, so len(hexes) ~ revealed area

    return [
        _scale(nearest_dist if nearest_dist is not None else 0.0, 15.0),
        _scale(nearest_dq, 10.0),
        _scale(nearest_dr, 10.0),
        _scale(float(unconquered), 20.0),
        _scale(float(len(hexes)), 100.0),
    ]


def _extract_mana_source_features(state: dict[str, Any]) -> list[float]:
    """Mana Source (6): available_dice_count, dice_has_red/blue/green/white/gold."""
    source = state.get("manaSource")
    if not isinstance(source, dict):
        return [0.0] * 6

    dice = source.get("dice")
    if not isinstance(dice, list):
        return [0.0] * 6

    available_count = 0
    colors_present: set[str] = set()
    for die in dice:
        if isinstance(die, dict):
            color = die.get("color")
            if isinstance(color, str):
                available_count += 1
                colors_present.add(color)
        elif isinstance(die, str):
            available_count += 1
            colors_present.add(die)

    return [
        _scale(float(available_count), 10.0),
        1.0 if "red" in colors_present else 0.0,
        1.0 if "blue" in colors_present else 0.0,
        1.0 if "green" in colors_present else 0.0,
        1.0 if "white" in colors_present else 0.0,
        1.0 if "gold" in colors_present else 0.0,
    ]


# ============================================================================
# Entity ID extraction helpers
# ============================================================================


def _extract_hand_card_ids(player: dict[str, Any]) -> list[int]:
    """Extract card IDs from player hand as vocabulary indices."""
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


def _extract_unit_ids(player: dict[str, Any]) -> list[int]:
    """Extract unit IDs from player units as vocabulary indices."""
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


def _extract_skill_ids(player: dict[str, Any]) -> list[int]:
    """Extract skill IDs from player skills as vocabulary indices."""
    skills = player.get("skills")
    if not isinstance(skills, list):
        return []
    ids: list[int] = []
    for skill in skills:
        if isinstance(skill, str):
            ids.append(SKILL_VOCAB.encode(skill))
        elif isinstance(skill, dict):
            skill_id = skill.get("id")
            if isinstance(skill_id, str):
                ids.append(SKILL_VOCAB.encode(skill_id))
    return ids


# ============================================================================
# Full map pool extraction
# ============================================================================


def _extract_visible_sites(
    hexes: dict[str, Any],
    pq: int,
    pr: int,
) -> tuple[list[int], list[list[float]]]:
    """Extract all visible sites on the map.

    Returns (site_ids, site_scalars) where each site has:
    - site_id: SITE_VOCAB index
    - scalars: [distance, dq, dr, enemy_count, is_conquered, is_rampaging]
    """
    site_ids: list[int] = []
    site_scalars: list[list[float]] = []

    for _key, hex_obj in hexes.items():
        if not isinstance(hex_obj, dict):
            continue
        site = hex_obj.get("site")
        if not isinstance(site, dict):
            continue

        site_type = site.get("type")
        if not isinstance(site_type, str):
            continue

        coord = hex_obj.get("coord")
        if not isinstance(coord, dict):
            continue
        hq = int(coord.get("q", 0)) if _is_int(coord.get("q")) else 0
        hr = int(coord.get("r", 0)) if _is_int(coord.get("r")) else 0

        dist = _hex_distance(pq, pr, hq, hr)
        dq = float(hq - pq)
        dr = float(hr - pr)

        enemies = hex_obj.get("enemies")
        enemy_count = float(len(enemies)) if isinstance(enemies, list) else 0.0

        rampaging = hex_obj.get("rampagingEnemies")
        ramp_count = float(len(rampaging)) if isinstance(rampaging, list) else 0.0
        # Total enemies includes both stationary and rampaging
        total_enemies = enemy_count + ramp_count

        is_conquered = 1.0 if bool(site.get("isConquered")) else 0.0
        is_rampaging = 1.0 if ramp_count > 0 else 0.0

        site_ids.append(SITE_VOCAB.encode(site_type))
        site_scalars.append([
            _scale(dist, 15.0),
            _scale(dq, 10.0),
            _scale(dr, 10.0),
            _scale(total_enemies, 5.0),
            is_conquered,
            is_rampaging,
        ])

    return site_ids, site_scalars


def _extract_enemy_hexes(
    hexes: dict[str, Any],
    pq: int,
    pr: int,
) -> list[list[float]]:
    """Extract all hexes with enemies (not in active combat).

    Returns list of [distance, dq, dr, enemy_count, is_rampaging] per hex.
    """
    result: list[list[float]] = []

    for _key, hex_obj in hexes.items():
        if not isinstance(hex_obj, dict):
            continue

        enemies = hex_obj.get("enemies")
        rampaging = hex_obj.get("rampagingEnemies")
        enemy_count = len(enemies) if isinstance(enemies, list) else 0
        ramp_count = len(rampaging) if isinstance(rampaging, list) else 0
        total = enemy_count + ramp_count

        if total == 0:
            continue

        coord = hex_obj.get("coord")
        if not isinstance(coord, dict):
            continue
        hq = int(coord.get("q", 0)) if _is_int(coord.get("q")) else 0
        hr = int(coord.get("r", 0)) if _is_int(coord.get("r")) else 0

        dist = _hex_distance(pq, pr, hq, hr)
        dq = float(hq - pq)
        dr = float(hr - pr)

        result.append([
            _scale(dist, 15.0),
            _scale(dq, 10.0),
            _scale(dr, 10.0),
            _scale(float(total), 5.0),
            1.0 if ramp_count > 0 else 0.0,
        ])

    return result


# ============================================================================
# Action scalars
# ============================================================================


def _action_scalars(action: dict[str, Any]) -> list[float]:
    """Extract meaningful action features (12 floats)."""
    amount = _as_number(action.get("amount"))
    is_powered = 1.0 if bool(action.get("powered")) else 0.0
    is_basic = 1.0 if action.get("playMode") == "basic" or (not action.get("powered") and action.get("type") == "PLAY_CARD") else 0.0
    is_sideways = 1.0 if action.get("type") == "PLAY_CARD_SIDEWAYS" else 0.0

    # Target coordinates (for MOVE actions)
    target = action.get("target")
    target_dq = 0.0
    target_dr = 0.0
    if isinstance(target, dict):
        target_dq = _as_number(target.get("q"))
        target_dr = _as_number(target.get("r"))

    # Count mana sources involved
    mana_sources = action.get("manaSources")
    num_mana = float(len(mana_sources)) if isinstance(mana_sources, list) else 0.0

    has_enemy_target = 1.0 if action.get("enemyId") or action.get("targetId") else 0.0
    has_card = 1.0 if action.get("cardId") else 0.0
    has_unit = 1.0 if action.get("unitId") else 0.0

    cost = _as_number(action.get("cost"))

    is_end = 1.0 if action.get("type") in ("END_TURN", "END_COMBAT_PHASE", "ANNOUNCE_END_OF_ROUND") else 0.0

    return [
        _scale(amount, 10.0),
        is_powered,
        is_basic,
        is_sideways,
        _scale(target_dq, 10.0),
        _scale(target_dr, 10.0),
        _scale(num_mana, 5.0),
        has_enemy_target,
        has_card,
        has_unit,
        _scale(cost, 10.0),
        is_end,
    ]


# ============================================================================
# Utility helpers
# ============================================================================


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


def _player_position(player: dict[str, Any]) -> tuple[int, int]:
    pos = player.get("position")
    if isinstance(pos, dict):
        pq = int(pos.get("q", 0)) if _is_int(pos.get("q")) else 0
        pr = int(pos.get("r", 0)) if _is_int(pos.get("r")) else 0
        return pq, pr
    return 0, 0


def _get_hexes(state: dict[str, Any]) -> dict[str, Any]:
    map_data = state.get("map")
    if not isinstance(map_data, dict):
        return {}
    hexes = map_data.get("hexes")
    if not isinstance(hexes, dict):
        return {}
    return hexes


def _hex_at(hexes: dict[str, Any], q: int, r: int) -> dict[str, Any] | None:
    """Look up a hex by axial coordinates."""
    key = f"{q},{r}"
    obj = hexes.get(key)
    return obj if isinstance(obj, dict) else None


def _hex_distance(q1: int, r1: int, q2: int, r2: int) -> float:
    """Axial hex distance."""
    return (abs(q1 - q2) + abs(r1 - r2) + abs((q1 + r1) - (q2 + r2))) / 2.0


def _get_terrain_difficulty(terrain: str) -> float:
    """Return a normalized terrain difficulty value."""
    difficulties: dict[str, float] = {
        "plains": 0.1,
        "hills": 0.3,
        "forest": 0.4,
        "desert": 0.5,
        "wasteland": 0.5,
        "swamp": 0.6,
        "lake": 1.0,
        "mountain": 1.0,
        "ocean": 1.0,
    }
    return difficulties.get(terrain, 0.0)


def _is_int(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


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


def _list_len(value: Any) -> float:
    return float(len(value)) if isinstance(value, list) else 0.0


def _as_number(value: Any) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return 0.0


def _scale(value: float, denom: float) -> float:
    if denom <= 0:
        return 0.0
    clamped = max(min(value / denom, 5.0), -5.0)
    return clamped


# ============================================================================
# Legacy flat encoding (kept for backward compatibility with use_embeddings=False)
# ============================================================================


def encode_state_action(
    state: dict[str, Any],
    player_id: str,
    action: dict[str, Any],
    source: str,
) -> list[float]:
    """Encode state + candidate action into a fixed-size feature vector (legacy)."""
    player = _find_player(state, player_id)
    valid_actions = state.get("validActions")
    valid_actions_dict = valid_actions if isinstance(valid_actions, dict) else {}

    mode = valid_actions_dict.get("mode")
    mode_value = mode if isinstance(mode, str) else "unknown"

    features: list[float] = []
    features.extend(_legacy_state_scalars(state, player, player_id, valid_actions_dict))
    features.extend(_legacy_map_scalars(state, player))
    features.extend(_one_hot_bucket(mode_value, MODE_BUCKETS))
    action_type = action.get("type")
    action_type_value = action_type if isinstance(action_type, str) else "unknown"
    features.extend(_one_hot_bucket(action_type_value, ACTION_TYPE_BUCKETS))
    features.extend(_one_hot_bucket(source, SOURCE_BUCKETS))
    features.extend(_legacy_action_scalars(action))
    return features


def _legacy_state_scalars(
    state: dict[str, Any],
    player: dict[str, Any] | None,
    player_id: str,
    valid_actions: dict[str, Any],
) -> list[float]:
    if player is None:
        return [0.0] * _LEGACY_STATE_SCALAR_DIM

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


def _legacy_map_scalars(
    state: dict[str, Any],
    player: dict[str, Any] | None,
) -> list[float]:
    if player is None:
        return [0.0] * _LEGACY_MAP_SCALAR_DIM

    map_data = state.get("map")
    if not isinstance(map_data, dict):
        return [0.0] * _LEGACY_MAP_SCALAR_DIM

    hexes = map_data.get("hexes")
    if not isinstance(hexes, dict):
        return [0.0] * _LEGACY_MAP_SCALAR_DIM

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


def _legacy_action_scalars(action: dict[str, Any]) -> list[float]:
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
