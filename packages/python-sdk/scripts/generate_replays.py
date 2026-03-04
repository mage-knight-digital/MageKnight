#!/usr/bin/env python3
"""Generate replay files from a trained checkpoint.

Usage:
  python scripts/generate_replays.py <checkpoint_path> [--seeds 1-10] [--output-dir eval_replays/v16]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Add src to path so we can import mage_knight_sdk
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from mage_knight_sdk.sim.rl.policy_gradient import ReinforcePolicy
from mage_knight_sdk.sim.rl.native_rl_runner import _get_engine_class, py_encoded_to_encoded_step
from mage_knight_sdk.sim.hero_selection import resolve_hero


def run_game_for_replay(
    seed: int,
    hero: str,
    policy: ReinforcePolicy,
    max_steps: int = 10000,
) -> dict:
    """Run a single game with the policy and record action indices."""
    GameEngine = _get_engine_class()
    engine = GameEngine(seed=seed, hero=hero)

    action_indices: list[int] = []
    step = 0
    outcome = "max_steps"

    policy._network.eval()

    try:
        while step < max_steps and not engine.is_game_ended():
            py_encoded = engine.encode_step()
            encoded_step = py_encoded_to_encoded_step(py_encoded)

            action_index = policy.choose_action_from_encoded(encoded_step)
            action_indices.append(action_index)

            game_ended = engine.apply_action(action_index)
            step += 1

            if game_ended:
                outcome = "ended"
                break
    except Exception as e:
        outcome = f"error: {e}"

    return {
        "seed": seed,
        "hero": hero,
        "actions": action_indices,
        "steps": step,
        "fame": engine.fame(),
        "level": engine.level(),
        "round": engine.round(),
        "outcome": outcome,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate replay files from a trained checkpoint")
    parser.add_argument("checkpoint", help="Path to checkpoint .pt file")
    parser.add_argument("--seeds", default="1-10", help="Seed range (e.g. '1-10' or '1,5,42')")
    parser.add_argument("--output-dir", default=None, help="Output directory (default: eval_replays/<run_name>)")
    parser.add_argument("--hero", default="random", help="Hero name or 'random' for seeded rotation")
    parser.add_argument("--max-steps", type=int, default=10000, help="Max steps per game")
    args = parser.parse_args()

    # Parse seeds
    if "-" in args.seeds and "," not in args.seeds:
        start, end = args.seeds.split("-")
        seeds = list(range(int(start), int(end) + 1))
    elif "," in args.seeds:
        seeds = [int(s.strip()) for s in args.seeds.split(",")]
    else:
        seeds = [int(args.seeds)]

    # Resolve output dir
    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        checkpoint_path = Path(args.checkpoint)
        run_name = checkpoint_path.parent.parent.name
        output_dir = Path("eval_replays") / run_name

    output_dir.mkdir(parents=True, exist_ok=True)

    # Load checkpoint
    print(f"Loading checkpoint: {args.checkpoint}")
    policy, metadata = ReinforcePolicy.load_checkpoint(args.checkpoint, device_override="cpu")
    print(f"  Config: hidden={policy.config.hidden_size}, layers={policy.config.num_hidden_layers}, embed={policy.config.embedding_dim}")

    # Generate replays
    print(f"Generating {len(seeds)} replays → {output_dir}/")
    for seed in seeds:
        hero = resolve_hero(args.hero, seed)
        replay = run_game_for_replay(seed, hero, policy, max_steps=args.max_steps)

        out_path = output_dir / f"seed_{seed}.json"
        with open(out_path, "w") as f:
            json.dump(replay, f)

        print(f"  seed={seed:>4d}  hero={hero:<12s}  steps={replay['steps']:>4d}  fame={replay['fame']:>3d}  lv={replay['level']}  r={replay['round']}  {replay['outcome']}")

    print(f"\nDone! Step through with:")
    print(f"  cd packages/engine-rs")
    print(f"  cargo run --release -p mk-cli -- --replay ../../packages/python-sdk/{output_dir}/seed_1.json --step")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
