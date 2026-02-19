#!/usr/bin/env python3
"""Server-free micro-benchmarks for individual RL pipeline components.

Replaces bench_policy.py and benchmarks/bench_rl_encoding.py with a single
tool that measures encode_step, encode_state, encode_actions, scoring_head,
categorical sampling, optimize_ppo, and compute_gae.

Usage:
    python3 scripts/bench_components.py                          # synthetic data
    python3 scripts/bench_components.py --capture                # real states (needs server)
    python3 scripts/bench_components.py --json /tmp/bench.json   # JSON output
    python3 scripts/bench_components.py --components encode_step,optimize_ppo
"""
from __future__ import annotations

import argparse
import json
import random
import statistics
import time
from pathlib import Path
from typing import Any

import torch

from mage_knight_sdk.sim.rl.features import (
    ACTION_SCALAR_DIM,
    COMBAT_ENEMY_SCALAR_DIM,
    MAP_ENEMY_SCALAR_DIM,
    SITE_SCALAR_DIM,
    STATE_SCALAR_DIM,
    ActionFeatures,
    EncodedStep,
    StateFeatures,
    encode_step,
)
from mage_knight_sdk.sim.rl.policy_gradient import (
    PolicyGradientConfig,
    ReinforcePolicy,
    Transition,
    compute_gae,
)


# ---------------------------------------------------------------------------
# Synthetic state builder (server-free)
# ---------------------------------------------------------------------------


def _make_hex(
    q: int, r: int, terrain: str,
    site: dict | None = None,
    enemies: list | None = None,
) -> dict:
    h: dict = {"coord": {"q": q, "r": r}, "terrain": terrain}
    if site is not None:
        h["site"] = site
    if enemies:
        h["enemies"] = enemies
    return h


def build_realistic_state(num_hexes: int = 50) -> dict:
    """Build a synthetic game state with realistic structure."""
    terrains = ["plains", "forest", "lake", "mountain", "swamp", "hills"]
    hexes = {}
    rng = random.Random(42)
    for i in range(num_hexes):
        q, r = i % 10, i // 10
        key = f"{q},{r}"
        site = None
        enemies = None
        if rng.random() < 0.15:
            site = {"type": "monastery", "isConquered": rng.random() < 0.3}
        if rng.random() < 0.2:
            enemies = [{"type": "orc", "armor": 3, "attack": 4}]
        hexes[key] = _make_hex(q, r, rng.choice(terrains), site, enemies)

    return {
        "currentPlayerId": "player-1",
        "round": 1,
        "timeOfDay": "day",
        "map": {
            "hexes": hexes,
            "tiles": [{"revealed": True} for _ in range(4)]
                     + [{"revealed": False} for _ in range(2)],
        },
        "players": [
            {
                "id": "player-1",
                "fame": 12,
                "level": 2,
                "reputation": 3,
                "position": {"q": 3, "r": 2},
                "hand": [
                    {"id": "march", "name": "March"},
                    {"id": "rage", "name": "Rage"},
                    {"id": "swiftness", "name": "Swiftness"},
                    {"id": "wound", "name": "Wound"},
                    {"id": "stamina", "name": "Stamina"},
                ],
                "deckCount": 11,
                "discardPile": [{"id": "concentration"}, {"id": "tranquility"}],
                "units": [
                    {"id": "peasants", "isExhausted": False},
                    {"id": "foresters", "isExhausted": True},
                ],
                "manaTokens": {"red": 1, "blue": 0, "green": 1, "white": 0, "gold": 0},
                "crystals": {"red": 1, "blue": 0, "green": 0, "white": 1},
            },
        ],
        "validActions": {
            "mode": "normal_turn",
            "turn": {
                "canEndTurn": True,
                "canAnnounceEndOfRound": False,
                "canUndo": True,
                "canDeclareRest": True,
            },
            "playCard": {
                "cards": [
                    {"cardId": "march", "canPlayBasic": True, "canPlayPowered": True},
                    {"cardId": "rage", "canPlayBasic": True, "canPlayPowered": False},
                    {"cardId": "swiftness", "canPlayBasic": True, "canPlayPowered": True},
                    {"cardId": "stamina", "canPlayBasic": True, "canPlayPowered": True},
                ],
            },
            "move": {"hexes": [{"q": 4, "r": 2}, {"q": 3, "r": 3}, {"q": 2, "r": 2}]},
        },
    }


def build_candidate_actions(n: int = 20) -> list:
    """Build synthetic CandidateAction list."""
    from mage_knight_sdk.sim.generated_action_enumerator import CandidateAction

    raw = [
        ({"type": "PLAY_CARD", "cardId": "march", "powered": False}, "normal.play_card.basic"),
        ({"type": "PLAY_CARD", "cardId": "march", "powered": True}, "normal.play_card.basic"),
        ({"type": "PLAY_CARD", "cardId": "rage", "powered": False}, "normal.play_card.basic"),
        ({"type": "PLAY_CARD", "cardId": "swiftness", "powered": False}, "normal.play_card.basic"),
        ({"type": "PLAY_CARD", "cardId": "swiftness", "powered": True}, "normal.play_card.basic"),
        ({"type": "PLAY_CARD", "cardId": "stamina", "powered": False}, "normal.play_card.basic"),
        ({"type": "PLAY_CARD", "cardId": "stamina", "powered": True}, "normal.play_card.basic"),
        ({"type": "MOVE", "target": {"q": 4, "r": 2}}, "normal.move"),
        ({"type": "MOVE", "target": {"q": 3, "r": 3}}, "normal.move"),
        ({"type": "MOVE", "target": {"q": 2, "r": 2}}, "normal.move"),
        ({"type": "PLAY_CARD_SIDEWAYS", "cardId": "march", "as": "influence"}, "normal.play_card.sideways"),
        ({"type": "PLAY_CARD_SIDEWAYS", "cardId": "rage", "as": "move"}, "normal.play_card.sideways"),
        ({"type": "END_TURN"}, "normal.turn.end_turn"),
        ({"type": "DECLARE_REST"}, "normal.turn.declare_rest"),
        ({"type": "RECRUIT_UNIT", "unitId": "peasants"}, "normal.units.recruit"),
        ({"type": "EXPLORE"}, "normal.explore"),
        ({"type": "UNDO"}, "turn.undo"),
        ({"type": "USE_SKILL", "skillId": "tovak_motivation"}, "normal.skills.activate"),
        ({"type": "ACTIVATE_UNIT", "unitId": "peasants"}, "normal.units.activate"),
        ({"type": "ENTER_SITE"}, "normal.site.enter"),
    ]
    return [CandidateAction(action=a, source=s) for a, s in raw[:n]]


# ---------------------------------------------------------------------------
# Capture real states from server
# ---------------------------------------------------------------------------


class CaptureHook:
    """Hook to capture diverse game states for benchmarking."""

    def __init__(self, n_states: int = 20) -> None:
        self._n_states = n_states
        self.captured: list[tuple[dict, str, list]] = []

    def on_step(self, sample: Any) -> None:
        if len(self.captured) < self._n_states:
            from mage_knight_sdk.sim.random_policy import enumerate_valid_actions

            candidates = enumerate_valid_actions(sample.state, sample.player_id)
            if len(candidates) >= 2:
                self.captured.append((sample.state, sample.player_id, candidates))

    def on_run_end(self, result: Any, messages: Any) -> None:
        pass


def capture_states(n_states: int = 20) -> list[tuple[dict, str, list]]:
    """Capture real game states from a running server."""
    from mage_knight_sdk.sim import RunnerConfig, run_simulations_sync

    config = RunnerConfig(
        bootstrap_api_base_url="http://127.0.0.1:3001",
        ws_server_url="ws://127.0.0.1:3001",
        player_count=2,
        runs=1,
        max_steps=200,
        base_seed=42,
        allow_undo=False,
    )
    hook = CaptureHook(n_states)
    run_simulations_sync(config, hooks=hook)
    return hook.captured


# ---------------------------------------------------------------------------
# Benchmark harness
# ---------------------------------------------------------------------------


def _bench(fn: Any, n_iters: int, warmup: int = 50) -> list[float]:
    """Run fn n_iters times, return list of times in nanoseconds."""
    for _ in range(min(warmup, n_iters)):
        fn()
    times: list[float] = []
    for _ in range(n_iters):
        t0 = time.perf_counter_ns()
        fn()
        times.append(time.perf_counter_ns() - t0)
    return times


def _stats(ns_times: list[float]) -> dict[str, float]:
    """Compute mean/median/P99 in ms from nanosecond measurements."""
    if not ns_times:
        return {"mean_ms": 0.0, "median_ms": 0.0, "p99_ms": 0.0}
    ms = [t / 1e6 for t in ns_times]
    return {
        "mean_ms": statistics.mean(ms),
        "median_ms": statistics.median(ms),
        "p99_ms": sorted(ms)[min(int(len(ms) * 0.99), len(ms) - 1)],
    }


def _make_fn(fn: Any, *args: Any) -> Any:
    """Factory to capture loop variables by value, fixing the lambda closure bug."""
    return lambda: fn(*args)


# ---------------------------------------------------------------------------
# Component benchmarks
# ---------------------------------------------------------------------------


def bench_encode_step(
    states: list[tuple[dict, str, list]], n_iters: int,
) -> dict[str, Any]:
    """Benchmark encode_step on each state."""
    all_times: list[float] = []
    for state, pid, cands in states:
        times = _bench(_make_fn(encode_step, state, pid, cands), n_iters)
        all_times.extend(times)
    return {"component": "encode_step", "samples": len(all_times), **_stats(all_times)}


def bench_encode_state(
    encoded_steps: list[EncodedStep], net: Any, device: torch.device, n_iters: int,
) -> dict[str, Any]:
    all_times: list[float] = []
    for step in encoded_steps:
        times = _bench(_make_fn(net.encode_state, step, device), n_iters)
        all_times.extend(times)
    return {"component": "encode_state", "samples": len(all_times), **_stats(all_times)}


def bench_encode_actions(
    encoded_steps: list[EncodedStep], net: Any, device: torch.device, n_iters: int,
) -> dict[str, Any]:
    all_times: list[float] = []
    for step in encoded_steps:
        times = _bench(_make_fn(net.encode_actions, step, device), n_iters)
        all_times.extend(times)
    return {"component": "encode_actions", "samples": len(all_times), **_stats(all_times)}


def bench_scoring_head(
    encoded_steps: list[EncodedStep], net: Any, device: torch.device, n_iters: int,
) -> dict[str, Any]:
    all_times: list[float] = []
    for step in encoded_steps:
        sr = net.encode_state(step, device)
        ar = net.encode_actions(step, device)

        def run_scoring(sr: Any = sr, ar: Any = ar) -> Any:
            n = ar.size(0)
            sb = sr.unsqueeze(0).expand(n, -1)
            combined = torch.cat([sb, ar], dim=-1)
            return net.scoring_head(combined).squeeze(-1)

        times = _bench(run_scoring, n_iters)
        all_times.extend(times)
    return {"component": "scoring_head", "samples": len(all_times), **_stats(all_times)}


def bench_categorical(
    encoded_steps: list[EncodedStep], net: Any, device: torch.device, n_iters: int,
) -> dict[str, Any]:
    all_times: list[float] = []
    for step in encoded_steps:
        logits, _ = net(step, device)

        def run_sampling(logits: Any = logits) -> None:
            lp = torch.log_softmax(logits, dim=0)
            torch.multinomial(lp.exp(), 1)

        times = _bench(run_sampling, n_iters)
        all_times.extend(times)
    return {"component": "categorical", "samples": len(all_times), **_stats(all_times)}


def bench_optimize_ppo(
    policy: ReinforcePolicy, n_transitions: int = 500, n_iters: int = 20,
) -> dict[str, Any]:
    """Benchmark optimize_ppo on synthetic transitions."""
    # Build synthetic transitions using the policy's actual network architecture
    # Access internal _network for sub-component benchmarks (this is a dev tool)
    net = policy._network
    device = policy._device

    # Create a synthetic encoded step with realistic dimensions
    sf = StateFeatures(
        scalars=[0.0] * STATE_SCALAR_DIM,
        mode_id=1,
        hand_card_ids=[1, 2, 3, 4, 5],
        unit_ids=[1, 2],
        current_terrain_id=1,
        current_site_type_id=0,
        combat_enemy_ids=[],
        combat_enemy_scalars=[],
        skill_ids=[1],
        visible_site_ids=[1, 2],
        visible_site_scalars=[[0.0] * SITE_SCALAR_DIM, [0.0] * SITE_SCALAR_DIM],
        map_enemy_ids=[1],
        map_enemy_scalars=[[0.0] * MAP_ENEMY_SCALAR_DIM],
    )
    actions = [
        ActionFeatures(
            action_type_id=i % 10 + 1,
            source_id=1,
            card_id=i % 5 + 1,
            unit_id=0,
            enemy_id=0,
            skill_id=0,
            target_enemy_ids=[],
            scalars=[0.0] * ACTION_SCALAR_DIM,
        )
        for i in range(10)
    ]
    step = EncodedStep(state=sf, actions=actions)

    transitions = [
        Transition(
            encoded_step=step,
            action_index=i % 10,
            log_prob=-1.5,
            value=0.5,
            reward=0.01,
        )
        for i in range(n_transitions)
    ]

    # Prepare GAE inputs
    episodes = [transitions]
    flat_t, advantages, returns = compute_gae(episodes, gamma=0.99, gae_lambda=0.95)

    def run_optimize() -> None:
        policy.optimize_ppo(
            flat_t, advantages, returns,
            clip_epsilon=0.2, ppo_epochs=4, max_grad_norm=0.5, mini_batch_size=64,
        )

    times = _bench(run_optimize, n_iters, warmup=2)
    return {"component": "optimize_ppo", "samples": len(times), "n_transitions": n_transitions, **_stats(times)}


def bench_compute_gae(n_transitions: int = 500, n_iters: int = 100) -> dict[str, Any]:
    """Benchmark compute_gae on synthetic episode data."""
    sf = StateFeatures(
        scalars=[0.0] * STATE_SCALAR_DIM,
        mode_id=1,
        hand_card_ids=[1, 2, 3],
        unit_ids=[],
        current_terrain_id=1,
        current_site_type_id=0,
        combat_enemy_ids=[],
        combat_enemy_scalars=[],
        skill_ids=[],
        visible_site_ids=[],
        visible_site_scalars=[],
        map_enemy_ids=[],
        map_enemy_scalars=[],
    )
    actions = [
        ActionFeatures(
            action_type_id=1, source_id=1, card_id=1, unit_id=0,
            enemy_id=0, skill_id=0, target_enemy_ids=[],
            scalars=[0.0] * ACTION_SCALAR_DIM,
        )
        for _ in range(5)
    ]
    step = EncodedStep(state=sf, actions=actions)

    transitions = [
        Transition(
            encoded_step=step,
            action_index=0,
            log_prob=-1.5,
            value=float(i) / n_transitions,
            reward=0.01,
        )
        for i in range(n_transitions)
    ]
    episodes = [transitions]

    times = _bench(_make_fn(compute_gae, episodes, 0.99, 0.95), n_iters)
    return {"component": "compute_gae", "samples": len(times), "n_transitions": n_transitions, **_stats(times)}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


ALL_COMPONENTS = [
    "encode_step", "encode_state", "encode_actions",
    "scoring_head", "categorical", "optimize_ppo", "compute_gae",
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Micro-benchmark RL pipeline components")
    parser.add_argument("--capture", action="store_true",
                        help="Capture real states from server (default: synthetic)")
    parser.add_argument("--json", metavar="PATH", help="Write results as JSON to PATH")
    parser.add_argument("--components", metavar="LIST",
                        help=f"Comma-separated components to benchmark (default: all). "
                             f"Available: {','.join(ALL_COMPONENTS)}")
    parser.add_argument("--iters", type=int, default=500,
                        help="Iterations per measurement (default: 500)")
    parser.add_argument("--device", default="cpu", help="Torch device (cpu, mps, cuda)")
    parser.add_argument("--n-states", type=int, default=10,
                        help="Number of states to benchmark across (default: 10)")
    args = parser.parse_args()

    selected = set(ALL_COMPONENTS)
    if args.components:
        selected = set(args.components.split(","))
        invalid = selected - set(ALL_COMPONENTS)
        if invalid:
            parser.error(f"Unknown components: {','.join(invalid)}")

    # Prepare states
    if args.capture:
        print("Capturing game states from server...")
        raw_states = capture_states(args.n_states)
        if not raw_states:
            print("Failed to capture any states. Is the server running?")
            return
        print(f"Captured {len(raw_states)} states")
    else:
        print("Using synthetic states (pass --capture for real states)")
        state = build_realistic_state()
        cands = build_candidate_actions(20)
        raw_states = [(state, "player-1", cands)] * args.n_states

    # Build policy and network for sub-component benchmarks
    policy_config = PolicyGradientConfig(hidden_size=128, embedding_dim=16, use_embeddings=True, device=args.device)
    policy = ReinforcePolicy(policy_config)
    # Access _network for sub-component benchmarks (dev tool, not production code)
    net = policy._network
    device = policy._device

    # Pre-encode states
    encoded_steps = [encode_step(s, pid, cands) for s, pid, cands in raw_states]

    results: list[dict[str, Any]] = []
    n = args.iters

    # Run selected benchmarks
    if "encode_step" in selected:
        print("Benchmarking encode_step...")
        results.append(bench_encode_step(raw_states, n))

    if "encode_state" in selected:
        print("Benchmarking encode_state...")
        results.append(bench_encode_state(encoded_steps, net, device, n))

    if "encode_actions" in selected:
        print("Benchmarking encode_actions...")
        results.append(bench_encode_actions(encoded_steps, net, device, n))

    if "scoring_head" in selected:
        print("Benchmarking scoring_head...")
        results.append(bench_scoring_head(encoded_steps, net, device, n))

    if "categorical" in selected:
        print("Benchmarking categorical...")
        results.append(bench_categorical(encoded_steps, net, device, n))

    if "optimize_ppo" in selected:
        print("Benchmarking optimize_ppo...")
        results.append(bench_optimize_ppo(policy, n_transitions=500, n_iters=min(n, 20)))

    if "compute_gae" in selected:
        print("Benchmarking compute_gae...")
        results.append(bench_compute_gae(n_transitions=500, n_iters=min(n, 100)))

    # Print table
    print()
    print(f"{'Component':<20} {'Mean':>10} {'Median':>10} {'P99':>10}")
    print("-" * 55)
    for r in results:
        print(f"{r['component']:<20} {r['mean_ms']:>8.3f}ms {r['median_ms']:>8.3f}ms {r['p99_ms']:>8.3f}ms")

    # JSON output
    if args.json:
        output = {
            "tool": "bench_components",
            "mode": "capture" if args.capture else "synthetic",
            "iters": n,
            "n_states": len(raw_states),
            "results": results,
        }
        path = Path(args.json)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(output, indent=2), encoding="utf-8")
        print(f"\nJSON output: {path}")


if __name__ == "__main__":
    main()
