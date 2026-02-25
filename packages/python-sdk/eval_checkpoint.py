#!/usr/bin/env python3
"""Evaluate a trained checkpoint: run games and save replays for mk-cli."""

from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, UTC
from pathlib import Path

import torch


def run_eval_game(
    seed: int,
    hero: str,
    policy,
    max_steps: int = 10000,
) -> dict:
    """Run a single game with the policy, capturing action indices."""
    from mk_python import GameEngine
    from mage_knight_sdk.sim.rl.native_rl_runner import py_encoded_to_encoded_step

    engine = GameEngine(seed=seed, hero=hero)
    actions: list[int] = []
    step = 0
    outcome = "max_steps"

    while step < max_steps and not engine.is_game_ended():
        py_encoded = engine.encode_step()
        encoded_step = py_encoded_to_encoded_step(py_encoded)

        with torch.no_grad():
            action_index = policy.choose_action_from_encoded(encoded_step)

        actions.append(action_index)
        game_ended = engine.apply_action(action_index)
        step += 1

        if game_ended:
            outcome = "ended"
            break

    return {
        "seed": seed,
        "hero": hero,
        "actions": actions,
        "steps": step,
        "fame": engine.fame(),
        "level": engine.level(),
        "round": engine.round(),
        "outcome": outcome,
    }


def main():
    parser = argparse.ArgumentParser(description="Evaluate a trained checkpoint")
    parser.add_argument("checkpoint", help="Path to policy_final.pt")
    parser.add_argument("--episodes", type=int, default=10, help="Number of games")
    parser.add_argument("--start-seed", type=int, default=1, help="Starting seed")
    parser.add_argument("--hero", default="arythea", help="Hero name")
    parser.add_argument("--max-steps", type=int, default=10000)
    parser.add_argument("--torch-seed", type=int, default=0, help="Torch RNG seed for deterministic policy sampling")
    parser.add_argument(
        "--output-dir",
        default="eval_replays",
        help="Directory for replay JSONs",
    )
    parser.add_argument(
        "--save-all",
        action="store_true",
        help="Save replays for ALL games (default: only completed games)",
    )
    args = parser.parse_args()

    from mage_knight_sdk.sim.rl.policy_gradient import ReinforcePolicy

    print(f"Loading checkpoint: {args.checkpoint}")
    policy, metadata = ReinforcePolicy.load_checkpoint(
        args.checkpoint, device_override="cpu"
    )
    policy._network.eval()
    print(f"  Loaded (episode {metadata.get('episode', '?')})")

    torch.manual_seed(args.torch_seed)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for i in range(args.episodes):
        seed = args.start_seed + i
        result = run_eval_game(seed, args.hero, policy, args.max_steps)
        results.append(result)

        status = "OK" if result["outcome"] == "ended" else result["outcome"]
        print(
            f"  [{i+1}/{args.episodes}] seed={seed} "
            f"steps={result['steps']} fame={result['fame']} "
            f"level={result['level']} round={result['round']} "
            f"[{status}]"
        )

        if args.save_all or result["outcome"] == "ended":
            replay_path = out_dir / f"seed_{seed}.json"
            replay_path.write_text(json.dumps(result), encoding="utf-8")

    # Summary
    ended = [r for r in results if r["outcome"] == "ended"]
    print(f"\n--- Summary ({len(ended)}/{len(results)} completed) ---")
    if ended:
        fames = [r["fame"] for r in ended]
        steps = [r["steps"] for r in ended]
        print(f"  Fame:  min={min(fames)} avg={sum(fames)/len(fames):.1f} max={max(fames)}")
        print(f"  Steps: min={min(steps)} avg={sum(steps)/len(steps):.1f} max={max(steps)}")
    print(f"\nReplays saved to: {out_dir}/")
    print(f"Replay with:  cargo run --release -p mk-cli -- --replay {out_dir}/seed_X.json")
    print(f"Step through:  cargo run --release -p mk-cli -- --replay {out_dir}/seed_X.json --step")


if __name__ == "__main__":
    main()
