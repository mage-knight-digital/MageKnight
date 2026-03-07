#!/usr/bin/env python3
"""Generate replay files from a trained checkpoint.

Usage:
  python scripts/generate_replays.py <checkpoint_path> [--seeds 1-10] [--output-dir eval_replays/v16]

  # Generate UI-viewable artifacts:
  python scripts/generate_replays.py <checkpoint_path> --artifact [--combat-oracle]
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


def _record_frame(engine, player_id: str, message_log: list[dict]) -> None:
    """Record a state_update frame from the engine's current state."""
    events = json.loads(engine.events_json())
    state = json.loads(engine.client_state_json())
    message_log.append({
        "player_id": player_id,
        "message_type": "state_update",
        "payload": {"events": events, "state": state},
    })


def run_game_for_replay(
    seed: int,
    hero: str,
    policy: ReinforcePolicy,
    max_steps: int = 10000,
    combat_oracle: bool = False,
    artifact: bool = False,
) -> dict:
    """Run a single game with the policy and record action indices."""
    GameEngine = _get_engine_class()
    engine = GameEngine(seed=seed, hero=hero)
    engine.set_rl_mode(True)

    action_indices: list[int] = []
    message_log: list[dict] = []
    player_id = "player_0"
    step = 0
    outcome = "max_steps"

    policy._network.eval()

    # Record initial frame
    if artifact:
        _record_frame(engine, player_id, message_log)

    try:
        while step < max_steps and not engine.is_game_ended():
            # If in combat and oracle is enabled, auto-resolve
            if combat_oracle and engine.in_combat():
                if artifact:
                    # Apply oracle actions one at a time for per-step frames.
                    # combat_oracle_action() re-runs search each step but
                    # that's fine for offline replay generation.
                    while engine.in_combat() and not engine.is_game_ended():
                        oracle_idx = engine.combat_oracle_action()
                        if oracle_idx is None:
                            break
                        action_indices.append(oracle_idx)
                        engine.apply_action(oracle_idx)
                        step += 1
                        _record_frame(engine, player_id, message_log)
                else:
                    oracle_indices = engine.auto_resolve_combat()
                    action_indices.extend(oracle_indices)
                    step += len(oracle_indices)
                if engine.is_game_ended():
                    outcome = "ended"
                    break
                continue

            py_encoded = engine.encode_step()
            encoded_step = py_encoded_to_encoded_step(py_encoded)

            action_index = policy.choose_action_from_encoded(encoded_step)
            action_indices.append(action_index)

            game_ended = engine.apply_action(action_index)
            step += 1

            if artifact:
                _record_frame(engine, player_id, message_log)

            if game_ended:
                outcome = "ended"
                break
    except Exception as e:
        outcome = f"error: {e}"

    result = {
        "seed": seed,
        "hero": hero,
        "actions": action_indices,
        "steps": step,
        "fame": engine.fame(),
        "level": engine.level(),
        "round": engine.round(),
        "outcome": outcome,
        "combat_oracle": combat_oracle,
    }

    if artifact:
        result["messageLog"] = message_log
        result["run"] = {
            "seed": seed,
            "outcome": outcome,
            "steps": step,
        }

    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate replay files from a trained checkpoint")
    parser.add_argument("checkpoint", help="Path to checkpoint .pt file")
    parser.add_argument("--seeds", default="1-10", help="Seed range (e.g. '1-10' or '1,5,42')")
    parser.add_argument("--output-dir", default=None, help="Output directory (default: eval_replays/<run_name>)")
    parser.add_argument("--hero", default="random", help="Hero name or 'random' for seeded rotation")
    parser.add_argument("--max-steps", type=int, default=10000, help="Max steps per game")
    parser.add_argument("--combat-oracle", action="store_true", default=False, help="Auto-resolve combat via search oracle")
    parser.add_argument("--artifact", action="store_true", default=False, help="Generate UI-viewable artifact files (with full state snapshots)")
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
    suffix = "artifacts" if args.artifact else "replays"
    print(f"Generating {len(seeds)} {suffix} → {output_dir}/")
    for seed in seeds:
        hero = resolve_hero(args.hero, seed)
        replay = run_game_for_replay(
            seed, hero, policy,
            max_steps=args.max_steps,
            combat_oracle=args.combat_oracle,
            artifact=args.artifact,
        )

        out_path = output_dir / f"seed_{seed}.json"
        with open(out_path, "w") as f:
            json.dump(replay, f)

        print(f"  seed={seed:>4d}  hero={hero:<12s}  steps={replay['steps']:>4d}  fame={replay['fame']:>3d}  lv={replay['level']}  r={replay['round']}  {replay['outcome']}")

    print(f"\nDone!")
    if args.artifact:
        print(f"Load in UI: drag & drop {output_dir}/seed_1.json into the replay viewer")
    else:
        print(f"Step through with:")
        print(f"  cd packages/engine-rs")
        print(f"  cargo run --release -p mk-cli -- --replay ../../packages/python-sdk/{output_dir}/seed_1.json --step")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
