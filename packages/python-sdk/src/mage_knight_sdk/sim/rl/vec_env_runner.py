"""VecEnv collection loop — batched rollout collection for vectorized training.

Runs N parallel games via PyVecEnv, using batched network forward passes
for 10-50x throughput compared to serial per-step inference.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

from .policy_gradient import ReinforcePolicy, Transition
from .rewards import RewardConfig
from .features import EncodedStep, StateFeatures, ActionFeatures

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class VecTransition:
    """Lightweight transition for VecEnv collection.

    Stores numpy slices from the batch rather than full EncodedStep objects.
    """

    # State: numpy arrays (from batch slice)
    state_scalars: np.ndarray          # (148,) float32
    state_ids: np.ndarray              # (3,) int32
    hand_card_ids: np.ndarray          # (H,) int32 (trimmed to actual count)
    unit_ids: np.ndarray               # (U,) int32
    unit_scalars: np.ndarray           # (U, 5) float32
    combat_enemy_ids: np.ndarray       # (CE,) int32
    combat_enemy_scalars: np.ndarray   # (CE, COMBAT_ENEMY_SCALAR_DIM) float32
    skill_ids: np.ndarray              # (S,) int32
    skill_scalars: np.ndarray          # (S, 3) float32
    visible_site_ids: np.ndarray       # (VS,) int32
    visible_site_scalars: np.ndarray   # (VS, SITE_SCALAR_DIM) float32
    map_enemy_ids: np.ndarray          # (ME,) int32
    map_enemy_scalars: np.ndarray      # (ME, MAP_ENEMY_SCALAR_DIM) float32
    spell_offer_ids: np.ndarray        # (SO,) int32
    aa_offer_ids: np.ndarray           # (AO,) int32
    unit_offer_ids: np.ndarray         # (UO,) int32
    discard_card_ids: np.ndarray       # (D,) int32

    # Action: numpy arrays (trimmed to actual count)
    action_ids: np.ndarray             # (A, 6) int32
    action_scalars: np.ndarray         # (A, 34) float32

    # PPO scalars
    action_index: int
    log_prob: float
    value: float
    reward: float


def _extract_vec_transition(
    batch_dict: dict[str, np.ndarray],
    env_idx: int,
    action_index: int,
    log_prob: float,
    value: float,
    reward: float,
) -> VecTransition:
    """Extract a single env's state/action data from the batch dict."""
    i = env_idx
    hc = int(batch_dict["hand_counts"][i])
    uc = int(batch_dict["unit_counts"][i])
    cec = int(batch_dict["combat_enemy_counts"][i])
    sc = int(batch_dict["skill_counts"][i])
    vsc = int(batch_dict["visible_site_counts"][i])
    mec = int(batch_dict["map_enemy_counts"][i])
    soc = int(batch_dict["spell_offer_counts"][i])
    aoc = int(batch_dict["aa_offer_counts"][i])
    uoc = int(batch_dict["unit_offer_counts"][i])
    dc = int(batch_dict["discard_counts"][i])
    ac = int(batch_dict["action_counts"][i])

    n = batch_dict["state_scalars"].shape[0]
    max_u = batch_dict["unit_ids"].shape[1]
    max_ce = batch_dict["combat_enemy_ids"].shape[1]
    max_s = batch_dict["skill_ids"].shape[1]
    max_vs = batch_dict["visible_site_ids"].shape[1]
    max_me = batch_dict["map_enemy_ids"].shape[1]

    # Reshape 3D arrays that come as (N*max, dim) → index by env
    unit_scalars_raw = batch_dict["unit_scalars"]  # (N*max_U, UNIT_SCALAR_DIM)
    unit_scalars_3d = unit_scalars_raw.reshape(n, max_u, -1)

    ce_scalars_raw = batch_dict["combat_enemy_scalars"]
    ce_scalars_3d = ce_scalars_raw.reshape(n, max_ce, -1)

    skill_scalars_raw = batch_dict["skill_scalars"]  # (N*max_S, SKILL_SCALAR_DIM)
    skill_scalars_3d = skill_scalars_raw.reshape(n, max_s, -1)

    vs_scalars_raw = batch_dict["visible_site_scalars"]
    vs_scalars_3d = vs_scalars_raw.reshape(n, max_vs, -1)

    me_scalars_raw = batch_dict["map_enemy_scalars"]
    me_scalars_3d = me_scalars_raw.reshape(n, max_me, -1)

    # Action arrays come as (N*max_M, dim)
    max_m = batch_dict["action_ids"].shape[0] // n
    action_ids_3d = batch_dict["action_ids"].reshape(n, max_m, 6)
    action_scalars_3d = batch_dict["action_scalars"].reshape(n, max_m, -1)

    return VecTransition(
        state_scalars=batch_dict["state_scalars"][i].copy(),
        state_ids=batch_dict["state_ids"][i].copy(),
        hand_card_ids=batch_dict["hand_card_ids"][i, :hc].copy(),
        unit_ids=batch_dict["unit_ids"][i, :uc].copy(),
        unit_scalars=unit_scalars_3d[i, :uc].copy(),
        combat_enemy_ids=batch_dict["combat_enemy_ids"][i, :cec].copy(),
        combat_enemy_scalars=ce_scalars_3d[i, :cec].copy(),
        skill_ids=batch_dict["skill_ids"][i, :sc].copy(),
        skill_scalars=skill_scalars_3d[i, :sc].copy(),
        visible_site_ids=batch_dict["visible_site_ids"][i, :vsc].copy(),
        visible_site_scalars=vs_scalars_3d[i, :vsc].copy(),
        map_enemy_ids=batch_dict["map_enemy_ids"][i, :mec].copy(),
        map_enemy_scalars=me_scalars_3d[i, :mec].copy(),
        spell_offer_ids=batch_dict["spell_offer_ids"][i, :soc].copy(),
        aa_offer_ids=batch_dict["aa_offer_ids"][i, :aoc].copy(),
        unit_offer_ids=batch_dict["unit_offer_ids"][i, :uoc].copy(),
        discard_card_ids=batch_dict["discard_card_ids"][i, :dc].copy(),
        action_ids=action_ids_3d[i, :ac].copy(),
        action_scalars=action_scalars_3d[i, :ac].copy(),
        action_index=action_index,
        log_prob=log_prob,
        value=value,
        reward=reward,
    )


def vec_transition_to_transition(vt: VecTransition) -> Transition:
    """Convert a VecTransition back to a standard Transition for optimize_ppo."""
    sf = StateFeatures(
        scalars=vt.state_scalars.tolist(),
        mode_id=int(vt.state_ids[0]),
        hand_card_ids=vt.hand_card_ids.tolist(),
        unit_ids=vt.unit_ids.tolist(),
        unit_scalars=vt.unit_scalars.tolist(),
        current_terrain_id=int(vt.state_ids[1]),
        current_site_type_id=int(vt.state_ids[2]),
        combat_enemy_ids=vt.combat_enemy_ids.tolist(),
        combat_enemy_scalars=vt.combat_enemy_scalars.tolist(),
        skill_ids=vt.skill_ids.tolist(),
        skill_scalars=vt.skill_scalars.tolist(),
        visible_site_ids=vt.visible_site_ids.tolist(),
        visible_site_scalars=vt.visible_site_scalars.tolist(),
        map_enemy_ids=vt.map_enemy_ids.tolist(),
        map_enemy_scalars=vt.map_enemy_scalars.tolist(),
        spell_offer_ids=vt.spell_offer_ids.tolist(),
        aa_offer_ids=vt.aa_offer_ids.tolist(),
        unit_offer_ids=vt.unit_offer_ids.tolist(),
        discard_card_ids=vt.discard_card_ids.tolist(),
    )
    n_actions = vt.action_ids.shape[0]
    actions = []
    for j in range(n_actions):
        ids = vt.action_ids[j]
        actions.append(ActionFeatures(
            action_type_id=int(ids[0]),
            source_id=int(ids[1]),
            card_id=int(ids[2]),
            unit_id=int(ids[3]),
            enemy_id=int(ids[4]),
            skill_id=int(ids[5]),
            target_enemy_ids=[],
            scalars=vt.action_scalars[j].tolist(),
        ))
    step = EncodedStep(state=sf, actions=actions)
    return Transition(
        encoded_step=step,
        action_index=vt.action_index,
        log_prob=vt.log_prob,
        value=vt.value,
        reward=vt.reward,
    )


@dataclass(frozen=True)
class CompletedEpisodeMeta:
    """Metadata for a completed episode: seed and action indices for replay."""
    seed: int
    action_indices: list[int]
    truncated: bool = False  # True if episode hit max_steps (not natural game end)
    scenario_end_triggered: bool = False  # True if scenario end condition was met (e.g. city revealed)


@dataclass
class EpisodeBuffers:
    """Persistent per-env episode buffers that survive across batch boundaries."""
    buffers: list[list[VecTransition]] = field(default_factory=list)
    seeds: list[int] = field(default_factory=list)
    action_indices: list[list[int]] = field(default_factory=list)
    scenario_end_triggered: list[bool] = field(default_factory=list)

    def ensure_size(self, num_envs: int) -> None:
        while len(self.buffers) < num_envs:
            self.buffers.append([])
        while len(self.seeds) < num_envs:
            self.seeds.append(0)
        while len(self.action_indices) < num_envs:
            self.action_indices.append([])
        while len(self.scenario_end_triggered) < num_envs:
            self.scenario_end_triggered.append(False)


@dataclass
class CollectionResult:
    """Result from collect_vecenv_rollout."""
    episodes: list[list[VecTransition]]
    total_steps: int
    total_episodes: int
    panicked_episodes: int
    episode_metas: list[CompletedEpisodeMeta] = field(default_factory=list)


def collect_vecenv_rollout(
    vec_env: object,
    policy: ReinforcePolicy,
    reward_config: RewardConfig,
    total_steps: int,
    episode_buffers: EpisodeBuffers | None = None,
) -> CollectionResult:
    """Collect transitions using vectorized environments.

    Runs vec_env in a loop, collecting transitions until total_steps are reached.
    Episodes complete when the engine signals done or max_steps is hit.

    Args:
        vec_env: PyVecEnv instance from mk_python
        policy: ReinforcePolicy with choose_actions_batch
        reward_config: reward shaping config
        total_steps: target number of total steps to collect
        episode_buffers: persistent per-env buffers from previous batch.
            Pass the same EpisodeBuffers object across calls so episodes that
            straddle batch boundaries are collected correctly.

    Returns:
        CollectionResult with completed episodes and step count
    """
    num_envs = vec_env.num_envs()

    if episode_buffers is None:
        episode_buffers = EpisodeBuffers()
    episode_buffers.ensure_size(num_envs)
    bufs = episode_buffers.buffers

    completed_episodes: list[list[VecTransition]] = []
    completed_metas: list[CompletedEpisodeMeta] = []
    panicked_count = 0
    steps_collected = 0

    # Snapshot seeds for any env whose episode buffer is empty (new episode)
    current_seeds = vec_env.seeds()
    for i in range(num_envs):
        if not bufs[i]:
            episode_buffers.seeds[i] = int(current_seeds[i])
            episode_buffers.action_indices[i] = []
            episode_buffers.scenario_end_triggered[i] = False

    while steps_collected < total_steps:
        # 1. Encode all envs → batched numpy dict
        batch_dict = vec_env.encode_batch()

        # 2. Batched forward pass
        actions, log_probs, values = policy.choose_actions_batch(batch_dict)

        # 3. Step all envs
        step_result = vec_env.step_batch(actions)
        fame_deltas = step_result["fame_deltas"]
        dones = step_result["dones"]
        panicked = step_result["panicked"]
        truncated_flags = step_result["truncated"]
        scenario_flags = step_result["scenario_end_triggered"]

        # 4. Process each env
        for i in range(num_envs):
            fame_delta = float(fame_deltas[i])
            reward = reward_config.fame_delta_scale * fame_delta + reward_config.step_penalty

            action_idx = int(actions[i])
            episode_buffers.action_indices[i].append(action_idx)

            # One-time scenario trigger bonus (on first detection)
            if scenario_flags[i] and not episode_buffers.scenario_end_triggered[i]:
                reward += reward_config.scenario_trigger_bonus
                episode_buffers.scenario_end_triggered[i] = True

            vt = _extract_vec_transition(
                batch_dict, i,
                action_index=action_idx,
                log_prob=float(log_probs[i]),
                value=float(values[i]),
                reward=reward,
            )
            bufs[i].append(vt)
            steps_collected += 1

            if dones[i]:
                if panicked[i]:
                    # Engine crashed — discard this episode entirely
                    panicked_count += 1
                    bufs[i] = []
                    episode_buffers.buffers[i] = bufs[i]
                    episode_buffers.action_indices[i] = []
                    episode_buffers.scenario_end_triggered[i] = False
                    # Snapshot seed for the new (reset) episode
                    new_seeds = vec_env.seeds()
                    episode_buffers.seeds[i] = int(new_seeds[i])
                    continue

                # Normal completion — add terminal reward
                episode = bufs[i]
                terminal = reward_config.terminal_end_bonus
                last = episode[-1]
                episode[-1] = VecTransition(
                    state_scalars=last.state_scalars,
                    state_ids=last.state_ids,
                    hand_card_ids=last.hand_card_ids,
                    unit_ids=last.unit_ids,
                    unit_scalars=last.unit_scalars,
                    combat_enemy_ids=last.combat_enemy_ids,
                    combat_enemy_scalars=last.combat_enemy_scalars,
                    skill_ids=last.skill_ids,
                    skill_scalars=last.skill_scalars,
                    visible_site_ids=last.visible_site_ids,
                    visible_site_scalars=last.visible_site_scalars,
                    map_enemy_ids=last.map_enemy_ids,
                    map_enemy_scalars=last.map_enemy_scalars,
                    spell_offer_ids=last.spell_offer_ids,
                    aa_offer_ids=last.aa_offer_ids,
                    unit_offer_ids=last.unit_offer_ids,
                    discard_card_ids=last.discard_card_ids,
                    action_ids=last.action_ids,
                    action_scalars=last.action_scalars,
                    action_index=last.action_index,
                    log_prob=last.log_prob,
                    value=last.value,
                    reward=last.reward + terminal,
                )
                completed_episodes.append(episode)
                completed_metas.append(CompletedEpisodeMeta(
                    seed=episode_buffers.seeds[i],
                    action_indices=list(episode_buffers.action_indices[i]),
                    truncated=bool(truncated_flags[i]),
                    scenario_end_triggered=episode_buffers.scenario_end_triggered[i],
                ))
                bufs[i] = []
                episode_buffers.buffers[i] = bufs[i]
                episode_buffers.action_indices[i] = []
                episode_buffers.scenario_end_triggered[i] = False
                # Snapshot seed for the new (reset) episode
                new_seeds = vec_env.seeds()
                episode_buffers.seeds[i] = int(new_seeds[i])

    return CollectionResult(
        episodes=completed_episodes,
        total_steps=steps_collected,
        total_episodes=len(completed_episodes),
        panicked_episodes=panicked_count,
        episode_metas=completed_metas,
    )
