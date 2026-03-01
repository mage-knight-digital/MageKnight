"""Feature types and dimension constants for RL encoding.

The actual encoding is performed by the Rust engine (mk-features crate).
These dataclasses are the Python-side representation of the encoded features.
"""

from __future__ import annotations

from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Embedding-based encoding constants
# ---------------------------------------------------------------------------

STATE_SCALAR_DIM = 84
ACTION_SCALAR_DIM = 34
SITE_SCALAR_DIM = 6   # per-site scalars for map pool
MAP_ENEMY_SCALAR_DIM = 11  # per-enemy scalars for map enemy pool
COMBAT_ENEMY_SCALAR_DIM = 20  # per-enemy scalars for combat pool
UNIT_SCALAR_DIM = 2  # per-unit scalars [is_ready, is_wounded]


# ============================================================================
# Structured feature types for embedding-based network
# ============================================================================


@dataclass(frozen=True)
class StateFeatures:
    """State features computed once per step (shared across all candidates)."""

    scalars: list[float]                    # STATE_SCALAR_DIM floats (84)
    mode_id: int                            # MODE_VOCAB index
    hand_card_ids: list[int]                # variable-length CARD_VOCAB indices
    unit_ids: list[int]                     # variable-length UNIT_VOCAB indices
    unit_scalars: list[list[float]]         # UNIT_SCALAR_DIM per unit [is_ready, is_wounded]
    current_terrain_id: int                 # TERRAIN_VOCAB index
    current_site_type_id: int               # SITE_VOCAB index
    combat_enemy_ids: list[int]             # ENEMY_VOCAB indices
    combat_enemy_scalars: list[list[float]] # COMBAT_ENEMY_SCALAR_DIM per enemy
    skill_ids: list[int]                    # SKILL_VOCAB indices
    # Full map visibility (variable-length, mean-pooled in network)
    visible_site_ids: list[int]             # SITE_VOCAB index per visible site
    visible_site_scalars: list[list[float]] # SITE_SCALAR_DIM floats per site
    map_enemy_ids: list[int]                # ENEMY_VOCAB indices per map enemy
    map_enemy_scalars: list[list[float]]    # MAP_ENEMY_SCALAR_DIM floats per map enemy


@dataclass(frozen=True)
class ActionFeatures:
    """Per-candidate action features."""

    action_type_id: int        # ACTION_TYPE_VOCAB index
    source_id: int             # SOURCE_VOCAB index
    card_id: int               # CARD_VOCAB index (from cardId field, or 0)
    unit_id: int               # UNIT_VOCAB index (from unitId field, or 0)
    enemy_id: int              # ENEMY_VOCAB index (from enemyId/targetId, or 0)
    skill_id: int              # SKILL_VOCAB index (from skillId field, or 0)
    target_enemy_ids: list[int]  # ENEMY_VOCAB indices (from targetEnemyInstanceIds)
    scalars: list[float]       # ACTION_SCALAR_DIM floats (34)


@dataclass(frozen=True)
class EncodedStep:
    """Structured encoding for one decision step."""

    state: StateFeatures
    actions: list[ActionFeatures]
