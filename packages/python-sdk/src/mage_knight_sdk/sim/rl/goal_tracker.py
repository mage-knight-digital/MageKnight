"""HRL goal tracking: goal types, completion detection, legality masking, target selection."""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum
from typing import Protocol

import numpy as np

# ============================================================================
# Goal type definitions
# ============================================================================

class GoalType(IntEnum):
    MOVE_TO = 0
    EXPLORE = 1
    CHALLENGE_RAMPAGING = 2
    CONQUER_ADVENTURE_SITE = 3
    CONQUER_FORTIFIED_SITE = 4
    RECRUIT_UNIT = 5
    BUY_SPELL = 6
    LEARN_ADVANCED_ACTION = 7
    HEAL_AT_SITE = 8
    REST = 9

NUM_GOAL_TYPES = len(GoalType)

# Goal encoding dimension: NUM_GOAL_TYPES one-hot + 2 relative target coords
GOAL_ENCODING_DIM = NUM_GOAL_TYPES + 2


class GoalStatus(IntEnum):
    ACTIVE = 0
    COMPLETED = 1
    FAILED = 2
    TIMEOUT = 3


# ============================================================================
# Target selection protocol (swappable strategy)
# ============================================================================

class TargetSelector(Protocol):
    """Protocol for selecting target hexes for parameterized goals."""

    def select(
        self,
        goal_type: GoalType,
        candidates: list[tuple[int, int]],
        player_pos: tuple[int, int],
        rng: np.random.Generator,
    ) -> tuple[int, int] | None:
        """Select a target hex from candidates. Returns None if no valid target."""
        ...


class RandomTargetSelector:
    """Pick a random valid target hex."""

    def select(
        self,
        goal_type: GoalType,
        candidates: list[tuple[int, int]],
        player_pos: tuple[int, int],
        rng: np.random.Generator,
    ) -> tuple[int, int] | None:
        if not candidates:
            return None
        idx = rng.integers(0, len(candidates))
        return candidates[idx]


class NearestTargetSelector:
    """Pick the nearest valid target hex (hex distance)."""

    def select(
        self,
        goal_type: GoalType,
        candidates: list[tuple[int, int]],
        player_pos: tuple[int, int],
        rng: np.random.Generator,
    ) -> tuple[int, int] | None:
        if not candidates:
            return None
        pq, pr = player_pos
        best = min(candidates, key=lambda c: _hex_distance(pq, pr, c[0], c[1]))
        return best


def _hex_distance(q1: int, r1: int, q2: int, r2: int) -> int:
    """Hex distance (cube coordinates)."""
    dq = abs(q1 - q2)
    dr = abs(r1 - r2)
    ds = abs((-q1 - r1) - (-q2 - r2))
    return max(dq, dr, ds)


# ============================================================================
# GoalTracker — one instance per VecEnv environment
# ============================================================================

@dataclass
class GoalState:
    """Active goal state for one environment."""
    goal_type: GoalType
    target_hex: tuple[int, int] | None
    start_step: int
    cumulative_game_reward: float  # accumulated for CEO transition


class GoalTracker:
    """Tracks goal state, detects completion/failure, enumerates legal goals.

    One GoalTracker per environment in the VecEnv.
    """

    def __init__(self, max_goal_steps: int = 30) -> None:
        self.max_goal_steps = max_goal_steps
        self.current: GoalState | None = None
        self._step_count = 0
        # Track previous step's signals for transition detection
        self._prev_unit_count: int = 0
        self._prev_in_combat: bool = False

    @property
    def needs_goal(self) -> bool:
        """Whether the CEO needs to select a new goal."""
        return self.current is None

    def set_goal(
        self, goal_type: GoalType, target_hex: tuple[int, int] | None, step: int,
    ) -> None:
        self.current = GoalState(
            goal_type=goal_type,
            target_hex=target_hex,
            start_step=step,
            cumulative_game_reward=0.0,
        )

    def accumulate_reward(self, game_reward: float) -> None:
        """Add game reward to the CEO's cumulative reward for this goal."""
        if self.current is not None:
            self.current.cumulative_game_reward += game_reward

    def check_completion(
        self, step_result: dict, env_idx: int, step: int,
    ) -> GoalStatus:
        """Check if the current goal is completed, failed, or timed out.

        Args:
            step_result: dict from PyVecEnv.step_batch()
            env_idx: index of this env in the batch
            step: current global step count

        Returns:
            GoalStatus indicating the goal's state.
        """
        if self.current is None:
            return GoalStatus.ACTIVE

        goal = self.current
        gt = goal.goal_type

        # Timeout check
        steps_elapsed = step - goal.start_step
        if steps_elapsed >= self.max_goal_steps:
            self._clear_goal()
            return GoalStatus.TIMEOUT

        # Extract signals for this env
        player_pos = tuple(step_result["player_positions"][env_idx])
        in_combat = bool(step_result["in_combat"][env_idx])
        combat_ended = bool(step_result["combat_just_ended"][env_idx])
        fame_delta = int(step_result["fame_deltas"][env_idx])
        new_tile = int(step_result["new_tiles"][env_idx])
        rested = int(step_result["rested_turns"][env_idx])
        wound_delta = int(step_result["wound_deltas"][env_idx])
        unit_count = int(step_result["unit_counts"][env_idx])
        achievement_delta = int(step_result["achievement_deltas"][env_idx])

        completed = False

        if gt == GoalType.MOVE_TO:
            if goal.target_hex is not None and player_pos == goal.target_hex:
                completed = True

        elif gt == GoalType.EXPLORE:
            if new_tile > 0:
                completed = True

        elif gt == GoalType.CHALLENGE_RAMPAGING:
            if combat_ended and fame_delta > 0:
                completed = True

        elif gt == GoalType.CONQUER_ADVENTURE_SITE:
            if combat_ended and fame_delta > 0:
                completed = True

        elif gt == GoalType.CONQUER_FORTIFIED_SITE:
            if combat_ended and fame_delta > 0:
                completed = True

        elif gt == GoalType.RECRUIT_UNIT:
            if unit_count > self._prev_unit_count:
                completed = True

        elif gt == GoalType.BUY_SPELL:
            if achievement_delta > 0:
                completed = True

        elif gt == GoalType.LEARN_ADVANCED_ACTION:
            if achievement_delta > 0:
                completed = True

        elif gt == GoalType.HEAL_AT_SITE:
            if wound_delta < 0:
                completed = True

        elif gt == GoalType.REST:
            if rested > 0:
                completed = True

        # Update tracking state
        self._prev_unit_count = unit_count
        self._prev_in_combat = in_combat

        if completed:
            self._clear_goal()
            return GoalStatus.COMPLETED

        return GoalStatus.ACTIVE

    def _clear_goal(self) -> None:
        self.current = None

    def reset(self) -> None:
        """Reset on episode end."""
        self.current = None
        self._prev_unit_count = 0
        self._prev_in_combat = False

    def get_goal_encoding(self, player_pos: tuple[int, int]) -> np.ndarray:
        """Encode the current goal as a fixed-size vector for the Worker.

        Returns:
            (GOAL_ENCODING_DIM,) float32 array:
              [0:NUM_GOAL_TYPES] = one-hot goal type
              [NUM_GOAL_TYPES:NUM_GOAL_TYPES+2] = relative target (dq, dr), normalized
        """
        enc = np.zeros(GOAL_ENCODING_DIM, dtype=np.float32)
        if self.current is not None:
            enc[self.current.goal_type] = 1.0
            if self.current.target_hex is not None:
                pq, pr = player_pos
                tq, tr = self.current.target_hex
                # Normalize relative coords (typical range -5..5)
                enc[NUM_GOAL_TYPES] = (tq - pq) / 5.0
                enc[NUM_GOAL_TYPES + 1] = (tr - pr) / 5.0
        return enc

    @staticmethod
    def enumerate_legal_goals(
        batch_dict: dict, env_idx: int,
    ) -> np.ndarray:
        """Compute a boolean mask over goal types indicating which are legal.

        Args:
            batch_dict: dict from PyVecEnv.encode_batch()
            env_idx: index of this env in the batch

        Returns:
            (NUM_GOAL_TYPES,) bool array.
        """
        mask = np.zeros(NUM_GOAL_TYPES, dtype=bool)

        # Rest and Explore are always legal
        mask[GoalType.REST] = True
        mask[GoalType.EXPLORE] = True

        # MoveTo: legal if there are revealed hexes (always true in practice)
        hex_count = int(batch_dict["revealed_hex_counts"][env_idx])
        if hex_count > 0:
            mask[GoalType.MOVE_TO] = True

        # Check visible sites for site-based goals
        # visible_site_ids shape: (N, max_VS), visible_site_counts: (N,)
        site_count = int(batch_dict["visible_site_counts"][env_idx])
        if site_count > 0:
            site_ids = batch_dict["visible_site_ids"][env_idx, :site_count]
            # For simplicity, if ANY non-trivial site is visible, enable all site goals.
            # A more refined check would decode SITE_VOCAB IDs to site types.
            has_sites = any(int(sid) > 0 for sid in site_ids)
            if has_sites:
                mask[GoalType.CONQUER_ADVENTURE_SITE] = True
                mask[GoalType.CONQUER_FORTIFIED_SITE] = True
                mask[GoalType.RECRUIT_UNIT] = True
                mask[GoalType.BUY_SPELL] = True
                mask[GoalType.LEARN_ADVANCED_ACTION] = True
                mask[GoalType.HEAL_AT_SITE] = True

        # ChallengeRampaging: legal if map enemies visible
        enemy_count = int(batch_dict["map_enemy_counts"][env_idx])
        if enemy_count > 0:
            mask[GoalType.CHALLENGE_RAMPAGING] = True

        return mask

    @staticmethod
    def get_target_candidates(
        goal_type: GoalType,
        batch_dict: dict,
        env_idx: int,
    ) -> list[tuple[int, int]]:
        """Get valid target hexes for a parameterized goal.

        Returns a list of (q, r) hex coordinates that are valid targets.
        For goals without targets (Rest, Explore), returns empty list.
        """
        if goal_type in (GoalType.REST, GoalType.EXPLORE):
            return []

        # For hex-parameterized goals, extract candidate hexes from visible sites/enemies.
        # Scalars come as (N*max, dim) — use n_envs and max to compute flat index.
        candidates: list[tuple[int, int]] = []

        def _get_pool_scalars(scalars_key: str, counts_key: str, ids_key: str) -> list[tuple[int, int]]:
            """Extract (rel_q, rel_r) from a pool's scalars at indices 0, 1."""
            count = int(batch_dict[counts_key][env_idx])
            if count == 0:
                return []
            # IDs shape: (N, max_K) → max_K = ids.shape[1]
            max_k = batch_dict[ids_key].shape[1]
            scalars = batch_dict[scalars_key]
            start = env_idx * max_k
            result = []
            for j in range(count):
                row = scalars[start + j]
                result.append((int(round(float(row[0]))), int(round(float(row[1])))))
            return result

        if goal_type == GoalType.CHALLENGE_RAMPAGING:
            candidates = _get_pool_scalars("map_enemy_scalars", "map_enemy_counts", "map_enemy_ids")

        elif goal_type == GoalType.MOVE_TO:
            candidates = _get_pool_scalars("revealed_hex_scalars", "revealed_hex_counts", "revealed_hex_terrain_ids")

        else:
            # Site-based goals: use visible site scalars
            # visible_site_scalars layout depends on mk-features encoding
            # We use indices 2, 3 for rel_q, rel_r (after is_conquered, is_fortified)
            site_count = int(batch_dict["visible_site_counts"][env_idx])
            if site_count > 0:
                max_sites = batch_dict["visible_site_ids"].shape[1]
                scalars = batch_dict["visible_site_scalars"]
                start = env_idx * max_sites
                for j in range(site_count):
                    row = scalars[start + j]
                    # site_scalars: [is_conquered, is_fortified, rel_q, rel_r, ...]
                    rel_q = float(row[2])
                    rel_r = float(row[3])
                    candidates.append((int(round(rel_q)), int(round(rel_r))))

        return candidates
