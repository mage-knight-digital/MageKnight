#!/usr/bin/env python3
"""Sanity check: can PPO learn a trivial 2-action bandit?

Uses a real game state from the Rust engine for correct dimensions,
but overrides reward: action 0 = +1, action 1 = 0.
If this doesn't converge to ~100% action 0, the RL infra is broken.
"""

import sys
sys.path.insert(0, "src")

from mage_knight_sdk.sim.rl.policy_gradient import (
    PolicyGradientConfig,
    ReinforcePolicy,
    Transition,
    compute_gae,
)
from mage_knight_sdk.sim.rl.native_rl_runner import py_encoded_to_encoded_step
from mage_knight_sdk.sim.rl.features import EncodedStep

import random


def get_tactic_step() -> EncodedStep:
    """Get initial tactic-selection state — tests whether tactic vocab fix works."""
    from mk_python import GameEngine
    engine = GameEngine(seed=42, hero="arythea")
    engine.set_rl_mode(True)

    py_enc = engine.encode_step()
    step = py_encoded_to_encoded_step(py_enc)

    print(f"Tactic selection: {len(step.actions)} actions")
    for i, a in enumerate(step.actions):
        print(f"  Action {i}: type={a.action_type_id} src={a.source_id} card={a.card_id}")

    # Verify distinct encodings
    sigs = set()
    for a in step.actions:
        sigs.add((a.action_type_id, a.source_id, a.card_id))
    assert len(sigs) == len(step.actions), (
        f"Only {len(sigs)} unique sigs for {len(step.actions)} actions — "
        f"tactic vocab fix didn't work!"
    )

    # Use first 2 for the bandit test
    step = EncodedStep(state=step.state, actions=step.actions[:2])
    return step


def get_gameplay_step() -> EncodedStep:
    """Step past tactic selection into gameplay for a state with distinct actions."""
    from mk_python import GameEngine
    engine = GameEngine(seed=42, hero="arythea")
    engine.set_rl_mode(True)

    for _ in range(20):
        engine.apply_action(0)
        if engine.is_game_ended():
            break

    py_enc = engine.encode_step()
    step = py_encoded_to_encoded_step(py_enc)

    assert len(step.actions) >= 2, f"Need >=2 actions, got {len(step.actions)}"
    a0, a1 = step.actions[0], step.actions[1]
    sig0 = (a0.action_type_id, a0.source_id, a0.card_id)
    sig1 = (a1.action_type_id, a1.source_id, a1.card_id)
    print(f"Action 0: type={a0.action_type_id} src={a0.source_id} card={a0.card_id}")
    print(f"Action 1: type={a1.action_type_id} src={a1.source_id} card={a1.card_id}")
    assert sig0 != sig1, "Actions have identical encodings — can't test learning"

    step = EncodedStep(state=step.state, actions=step.actions[:2])
    return step


def run_sanity_check(mode: str = "tactic"):
    config = PolicyGradientConfig(
        gamma=0.99,
        learning_rate=3e-4,
        entropy_coefficient=0.01,
        critic_coefficient=0.5,
        hidden_size=128,
        device="auto",
        embedding_dim=16,
        num_hidden_layers=1,
        d_model=64,
    )
    policy = ReinforcePolicy(config)
    rng = random.Random(42)

    if mode == "tactic":
        print("=== Testing TACTIC SELECTION actions ===")
        template_step = get_tactic_step()
    else:
        print("=== Testing GAMEPLAY actions ===")
        template_step = get_gameplay_step()

    batch_size = 16
    episode_length = 10
    num_updates = 200

    print(f"Sanity check: {num_updates} PPO updates, {batch_size} episodes/batch, {episode_length} steps/ep")
    print(f"Action 0 = +1 reward, Action 1 = 0 reward (2 actions from real game state)")
    print("-" * 70)

    for update in range(num_updates):
        episodes_data = []
        terminated_flags = []
        action_0_count = 0
        total_actions = 0

        for _ in range(batch_size):
            transitions = []
            for _ in range(episode_length):
                action_idx = policy.choose_action_from_encoded(template_step, rng)
                info = policy.last_step_info

                reward = 1.0 if action_idx == 0 else 0.0
                action_0_count += (1 if action_idx == 0 else 0)
                total_actions += 1

                if info is not None:
                    transitions.append(Transition(
                        encoded_step=info.encoded_step,
                        action_index=info.action_index,
                        log_prob=info.log_prob,
                        value=info.value,
                        reward=reward,
                    ))

            episodes_data.append(transitions)
            terminated_flags.append(True)
            policy._reset_episode_buffers()

        # PPO update
        transitions_flat, advantages, returns = compute_gae(
            episodes_data, gamma=0.99, gae_lambda=0.95, terminated=terminated_flags,
        )
        opt_stats = policy.optimize_ppo(
            transitions_flat, advantages, returns,
            clip_epsilon=0.2, ppo_epochs=4, max_grad_norm=0.5, mini_batch_size=64,
        )

        action_0_pct = 100 * action_0_count / total_actions
        if (update + 1) % 20 == 0 or update == 0:
            print(
                f"update={update+1:3d}  action_0={action_0_pct:5.1f}%  "
                f"loss={opt_stats.loss:>8.4f}  entropy={opt_stats.entropy:>6.4f}  "
                f"critic_loss={opt_stats.critic_loss:>8.4f}"
            )

    print("-" * 70)
    final_pct = action_0_pct
    if final_pct > 90:
        print(f"PASS: action_0 at {final_pct:.1f}% — PPO is learning")
    elif final_pct > 70:
        print(f"SLOW: action_0 at {final_pct:.1f}% — learning but slow")
    else:
        print(f"FAIL: action_0 at {final_pct:.1f}% — PPO is NOT learning")

    return 0 if final_pct > 90 else 1


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "tactic"
    raise SystemExit(run_sanity_check(mode))
