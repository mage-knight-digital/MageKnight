#!/usr/bin/env python3
"""Micro-benchmark for RL policy forward pass components.

Captures real game states, then measures each component in isolation.
Run after each optimization to compare.
"""
from __future__ import annotations

import time
import torch

from mage_knight_sdk.sim import RunnerConfig, run_simulations_sync
from mage_knight_sdk.sim.rl.policy_gradient import PolicyGradientConfig, ReinforcePolicy
from mage_knight_sdk.sim.rl.features import encode_step
from mage_knight_sdk.sim.random_policy import enumerate_valid_actions


def capture_states(n_states: int = 20) -> list[tuple[dict, str, list]]:
    """Run a quick game and capture diverse states with their candidates."""
    config = RunnerConfig(
        bootstrap_api_base_url="http://127.0.0.1:3001",
        ws_server_url="ws://127.0.0.1:3001",
        player_count=2,
        runs=1,
        max_steps=200,
        base_seed=42,
        allow_undo=False,
    )
    captured: list[tuple[dict, str, list]] = []

    class CaptureHook:
        def on_step(self, sample):
            if len(captured) < n_states:
                candidates = enumerate_valid_actions(sample.state, sample.player_id)
                if len(candidates) >= 2:
                    captured.append((sample.state, sample.player_id, candidates))

        def on_run_end(self, result, messages):
            pass

    run_simulations_sync(config, hooks=CaptureHook())
    return captured


def bench(label: str, fn, n_iters: int = 500) -> float:
    """Run fn n_iters times, return mean time in ms."""
    # Warmup
    for _ in range(min(50, n_iters)):
        fn()
    # Measure
    t0 = time.perf_counter_ns()
    for _ in range(n_iters):
        fn()
    elapsed_ns = time.perf_counter_ns() - t0
    mean_ms = elapsed_ns / n_iters / 1_000_000
    return mean_ms


def main():
    print("Capturing game states...")
    states = capture_states(20)
    print(f"Captured {len(states)} states")
    candidate_counts = [len(c) for _, _, c in states]
    print(f"Candidate counts: min={min(candidate_counts)} max={max(candidate_counts)} "
          f"median={sorted(candidate_counts)[len(candidate_counts)//2]} "
          f"mean={sum(candidate_counts)/len(candidate_counts):.1f}")
    print()

    policy_config = PolicyGradientConfig(hidden_size=128, embedding_dim=16, use_embeddings=True)
    policy = ReinforcePolicy(policy_config)
    net = policy._network
    device = policy._device

    # Pre-encode all states
    encoded_steps = [encode_step(s, pid, cands) for s, pid, cands in states]

    N = 500

    # --- Component benchmarks on each state, then average ---
    results = {
        "encode_step": [],
        "encode_state": [],
        "encode_actions": [],
        "scoring_head": [],
        "categorical": [],
        "full_forward": [],
        "full_choose": [],
    }

    for i, (state, pid, cands) in enumerate(states):
        step = encoded_steps[i]
        n_cands = len(cands)

        results["encode_step"].append(
            bench(f"encode_step[{i}]", lambda: encode_step(state, pid, cands), N)
        )
        results["encode_state"].append(
            bench(f"encode_state[{i}]", lambda: net.encode_state(step, device), N)
        )
        results["encode_actions"].append(
            bench(f"encode_actions[{i}]", lambda: net.encode_actions(step, device), N)
        )

        # scoring_head only (with pre-computed inputs)
        sr = net.encode_state(step, device)
        ar = net.encode_actions(step, device)

        def run_scoring():
            n = ar.size(0)
            sb = sr.unsqueeze(0).expand(n, -1)
            combined = torch.cat([sb, ar], dim=-1)
            return net.scoring_head(combined).squeeze(-1)

        results["scoring_head"].append(bench(f"scoring[{i}]", run_scoring, N))

        # Sampling + log_prob + entropy (with pre-computed logits)
        logits = run_scoring()

        def run_sampling():
            lp = torch.log_softmax(logits, dim=0)
            idx = int(torch.multinomial(lp.exp(), 1).item())
            _ = lp[idx]
            probs = lp.exp()
            _ = -(probs * lp).sum()

        results["categorical"].append(bench(f"sampling[{i}]", run_sampling, N))

        # Full forward (encode + score, no sampling)
        results["full_forward"].append(
            bench(f"forward[{i}]", lambda: net(step, device)[0], N)
        )

        # Full choose_action equivalent
        def run_full():
            logits, _ = net(step, device)
            lp = torch.log_softmax(logits, dim=0)
            idx = int(torch.multinomial(lp.exp(), 1).item())
            _ = lp[idx]
            probs = lp.exp()
            _ = -(probs * lp).sum()

        results["full_choose"].append(bench(f"choose[{i}]", run_full, N))

    # --- Print summary ---
    print(f"{'Component':<20} {'Mean':>8}  {'Min':>8}  {'Max':>8}  {'% of total':>10}")
    print("-" * 60)

    total_mean = sum(sum(v) / len(v) for v in results.values())
    # The meaningful total is encode_step + full_choose
    e2e_mean = (sum(results["encode_step"]) + sum(results["full_choose"])) / len(states)

    for name in ("encode_step", "encode_state", "encode_actions", "scoring_head",
                 "categorical", "full_forward", "full_choose"):
        vals = results[name]
        mean = sum(vals) / len(vals)
        pct = mean / e2e_mean * 100 if name in ("encode_step", "full_choose") else 0
        pct_str = f"{pct:.1f}%" if pct else ""
        print(f"{name:<20} {mean:>7.3f}ms  {min(vals):>7.3f}ms  {max(vals):>7.3f}ms  {pct_str:>10}")

    print("-" * 60)
    print(f"{'end-to-end':<20} {e2e_mean:>7.3f}ms")
    print()

    # Also run 3 full RL episodes for end-to-end validation
    print("Running 3 full RL episodes for end-to-end timing...")
    from mage_knight_sdk.sim.rl.rewards import RewardConfig
    from mage_knight_sdk.sim.rl.trainer import ReinforceTrainer

    policy2 = ReinforcePolicy(policy_config)
    reward_config = RewardConfig()
    trainer = ReinforceTrainer(policy=policy2, reward_config=reward_config)

    total_steps = 0
    t0 = time.perf_counter()
    for ep in range(3):
        config = RunnerConfig(
            bootstrap_api_base_url="http://127.0.0.1:3001",
            ws_server_url="ws://127.0.0.1:3001",
            player_count=2,
            runs=1,
            max_steps=10000,
            base_seed=100 + ep,
            allow_undo=False,
            collect_step_timings=True,
        )
        results, _ = run_simulations_sync(config, policy=policy2, hooks=trainer)
        result = results[0]
        total_steps += result.steps
        st = result.step_timings
        if st and st.step_count > 0:
            print(f"  ep={ep+1} steps={result.steps} "
                  f"policy={st.policy_ns/st.step_count/1e6:.1f}ms/step "
                  f"server={st.server_ns/st.step_count/1e6:.1f}ms/step "
                  f"total={st.total_ns()/st.step_count/1e6:.1f}ms/step")

    elapsed = time.perf_counter() - t0
    print(f"\n  3 episodes: {elapsed:.1f}s, {total_steps} steps, "
          f"{total_steps/elapsed:.0f} steps/s, {elapsed/3:.2f}s/game")


if __name__ == "__main__":
    main()
