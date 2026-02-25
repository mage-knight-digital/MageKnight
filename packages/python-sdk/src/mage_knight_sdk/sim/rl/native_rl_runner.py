"""Native RL runner — drives the Rust engine directly via PyO3.

Eliminates WebSocket round-trips, JSON serialization, and Python-side
feature encoding. The entire game loop runs in-process.
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from typing import Any

from .features import ActionFeatures, EncodedStep, StateFeatures
from .policy_gradient import OptimizationStats, ReinforcePolicy, StepInfo, Transition
from .rewards import RewardConfig

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EpisodeTrainingStats:
    outcome: str
    steps: int
    total_reward: float
    optimization: OptimizationStats
    scenario_triggered: bool = False
    achievement_bonus: float = 0.0


# Lazy-import mk_python to avoid import errors when Rust module isn't built.
_GameEngine: type | None = None


def _get_engine_class() -> type:
    global _GameEngine
    if _GameEngine is None:
        from mk_python import GameEngine
        _GameEngine = GameEngine
    return _GameEngine


@dataclass(frozen=True)
class NativeRunResult:
    """Result of a single native RL game."""

    seed: int
    outcome: str  # "ended" | "max_steps" | "engine_error"
    steps: int
    fame: int
    level: int
    round: int
    scenario_end_triggered: bool = False
    reason: str | None = None


def py_encoded_to_encoded_step(py_encoded: Any) -> EncodedStep:
    """Convert PyO3 PyEncodedStep → Python EncodedStep dataclass."""
    state = StateFeatures(
        scalars=py_encoded.state_scalars(),
        mode_id=py_encoded.mode_id(),
        hand_card_ids=py_encoded.hand_card_ids(),
        unit_ids=py_encoded.unit_ids(),
        current_terrain_id=py_encoded.current_terrain_id(),
        current_site_type_id=py_encoded.current_site_type_id(),
        combat_enemy_ids=py_encoded.combat_enemy_ids(),
        combat_enemy_scalars=py_encoded.combat_enemy_scalars(),
        skill_ids=py_encoded.skill_ids(),
        visible_site_ids=py_encoded.visible_site_ids(),
        visible_site_scalars=py_encoded.visible_site_scalars(),
        map_enemy_ids=py_encoded.map_enemy_ids(),
        map_enemy_scalars=py_encoded.map_enemy_scalars(),
    )
    type_ids = py_encoded.action_type_ids()
    source_ids = py_encoded.action_source_ids()
    card_ids = py_encoded.action_card_ids()
    unit_ids = py_encoded.action_unit_ids()
    enemy_ids = py_encoded.action_enemy_ids()
    skill_ids = py_encoded.action_skill_ids()
    all_scalars = py_encoded.action_scalars()
    n = py_encoded.action_count()

    actions = []
    for i in range(n):
        actions.append(ActionFeatures(
            action_type_id=type_ids[i],
            source_id=source_ids[i],
            card_id=card_ids[i],
            unit_id=unit_ids[i],
            enemy_id=enemy_ids[i],
            skill_id=skill_ids[i],
            target_enemy_ids=py_encoded.action_target_enemy_ids(i),
            scalars=all_scalars[i],
        ))
    return EncodedStep(state=state, actions=actions)


def run_native_rl_game(
    seed: int,
    hero: str,
    policy: ReinforcePolicy,
    reward_config: RewardConfig | None = None,
    max_steps: int = 10000,
    rng: random.Random | None = None,
) -> tuple[NativeRunResult, EpisodeTrainingStats | None]:
    """Run a single RL training game using the native Rust engine.

    Returns (result, training_stats). Training stats may be None on error.
    """
    if reward_config is None:
        reward_config = RewardConfig()
    if rng is None:
        rng = random.Random(seed)

    GameEngine = _get_engine_class()
    engine = GameEngine(seed=seed, hero=hero)

    step = 0
    outcome = "max_steps"
    reason = None
    stats: EpisodeTrainingStats | None = None
    episode_total_reward = 0.0

    try:
        while step < max_steps and not engine.is_game_ended():
            # Encode from Rust (no JSON, no Python dict-crawling)
            py_encoded = engine.encode_step()
            encoded_step = py_encoded_to_encoded_step(py_encoded)

            fame_before = engine.fame()

            # Policy forward pass (takes EncodedStep directly)
            action_index = policy.choose_action_from_encoded(encoded_step, rng)

            # Apply action in Rust engine
            game_ended = engine.apply_action(action_index)

            fame_after = engine.fame()

            # Compute reward
            fame_delta = float(fame_after - fame_before)
            reward = reward_config.fame_delta_scale * fame_delta + reward_config.step_penalty
            policy.record_step_reward(reward)
            episode_total_reward += reward

            step += 1

            if game_ended:
                outcome = "ended"
                break

        # Terminal reward
        if outcome == "ended":
            terminal = reward_config.terminal_end_bonus
        else:
            terminal = reward_config.terminal_max_steps_penalty
        policy.add_terminal_reward(terminal)
        episode_total_reward += terminal

        # Optimize episode
        optimization = policy.optimize_episode()
        stats = EpisodeTrainingStats(
            outcome=outcome,
            steps=step,
            total_reward=episode_total_reward,
            optimization=optimization,
            scenario_triggered=engine.scenario_end_triggered(),
        )

    except Exception as e:
        outcome = "engine_error"
        reason = str(e)
        logger.warning("Engine error in seed %d at step %d: %s", seed, step, e)
        policy._reset_episode_buffers()

    result = NativeRunResult(
        seed=seed,
        outcome=outcome,
        steps=step,
        fame=engine.fame(),
        level=engine.level(),
        round=engine.round(),
        scenario_end_triggered=engine.scenario_end_triggered(),
        reason=reason,
    )
    return result, stats


def run_native_rl_game_ppo(
    seed: int,
    hero: str,
    policy: ReinforcePolicy,
    reward_config: RewardConfig | None = None,
    max_steps: int = 10000,
    rng: random.Random | None = None,
) -> tuple[NativeRunResult, list[Transition]]:
    """Run a single game, collecting PPO transitions instead of optimizing.

    Returns (result, transitions). Transitions list may be empty on error.
    """
    if reward_config is None:
        reward_config = RewardConfig()
    if rng is None:
        rng = random.Random(seed)

    GameEngine = _get_engine_class()
    engine = GameEngine(seed=seed, hero=hero)

    step = 0
    outcome = "max_steps"
    reason = None
    transitions: list[Transition] = []

    try:
        while step < max_steps and not engine.is_game_ended():
            py_encoded = engine.encode_step()
            encoded_step = py_encoded_to_encoded_step(py_encoded)

            fame_before = engine.fame()

            action_index = policy.choose_action_from_encoded(encoded_step, rng)
            step_info = policy.last_step_info

            game_ended = engine.apply_action(action_index)

            fame_after = engine.fame()
            fame_delta = float(fame_after - fame_before)
            reward = reward_config.fame_delta_scale * fame_delta + reward_config.step_penalty

            if step_info is not None:
                transitions.append(Transition(
                    encoded_step=step_info.encoded_step,
                    action_index=step_info.action_index,
                    log_prob=step_info.log_prob,
                    value=step_info.value,
                    reward=reward,
                ))

            step += 1

            if game_ended:
                outcome = "ended"
                break

        # Terminal reward added to last transition
        if outcome == "ended":
            terminal = reward_config.terminal_end_bonus
        else:
            terminal = reward_config.terminal_max_steps_penalty
        if transitions:
            last = transitions[-1]
            transitions[-1] = Transition(
                encoded_step=last.encoded_step,
                action_index=last.action_index,
                log_prob=last.log_prob,
                value=last.value,
                reward=last.reward + terminal,
            )

    except Exception as e:
        outcome = "engine_error"
        reason = str(e)
        logger.warning("Engine error in seed %d at step %d: %s", seed, step, e)

    # Reset policy buffers (PPO doesn't optimize per-episode)
    policy._reset_episode_buffers()

    result = NativeRunResult(
        seed=seed,
        outcome=outcome,
        steps=step,
        fame=engine.fame(),
        level=engine.level(),
        round=engine.round(),
        scenario_end_triggered=engine.scenario_end_triggered(),
        reason=reason,
    )
    return result, transitions
