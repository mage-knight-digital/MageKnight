#!/usr/bin/env python3
"""Replay a trained policy against combat drills, showing every action taken.

Usage:
    python scripts/replay_policy.py <checkpoint> [--seeds 1-20]
    python scripts/replay_policy.py <checkpoint> --seeds 1-50 -v
"""

import json
import sys
sys.path.insert(0, "src")

import numpy as np
from mk_python import PyVecEnv
from mage_knight_sdk.sim.rl.policy_gradient import PolicyGradientConfig, ReinforcePolicy
from mage_knight_sdk.sim.rl.vocabularies import ACTION_TYPE_VOCAB, SOURCE_VOCAB, CARD_VOCAB

# Reverse lookup tables
_AT_REV = {v: k for k, v in ACTION_TYPE_VOCAB._str_to_idx.items()}
_SRC_REV = {v: k for k, v in SOURCE_VOCAB._str_to_idx.items()}
_CARD_REV = {v: k for k, v in CARD_VOCAB._str_to_idx.items()}


def _action_str(ids_row):
    """Decode action IDs to human-readable string."""
    at = _AT_REV.get(int(ids_row[0]), f"?{ids_row[0]}")
    src = _SRC_REV.get(int(ids_row[1]), f"?{ids_row[1]}")
    card = _CARD_REV.get(int(ids_row[2]), "")
    parts = [at]
    if card:
        parts.append(f"card={card}")
    src_short = src.split(".")[-1] if "." in src else src
    parts.append(f"({src_short})")
    return " ".join(parts)


def load_policy(checkpoint_path: str) -> ReinforcePolicy:
    """Load a trained policy from checkpoint."""
    policy, _meta = ReinforcePolicy.load_checkpoint(checkpoint_path)
    return policy


def replay_seed(policy: ReinforcePolicy, seed: int, scenario_json: str, max_steps: int = 200):
    """Replay one episode with the trained policy. Returns dict with results."""
    env = PyVecEnv(1, seed, "arythea", max_steps, scenario_json)

    steps = []
    total_fame = 0
    total_wounds = 0

    for step_num in range(max_steps):
        batch = env.encode_batch()
        n = int(batch["action_counts"][0])
        if n == 0:
            break

        # Use policy to choose action
        actions, log_probs, values = policy.choose_actions_batch(batch)
        action_idx = int(actions[0])

        # Decode all actions for verbose output
        ids = batch["action_ids"].reshape(1, -1, 6)[0]  # (max_actions, 6)
        chosen_str = _action_str(ids[action_idx]) if action_idx < n else "?"
        alt_strs = []
        for j in range(min(n, 6)):
            if j != action_idx:
                alt_strs.append(_action_str(ids[j]))

        # Step
        result = env.step_batch(actions)
        fame_d = int(result["fame_deltas"][0])
        wound_d = int(result["wound_deltas"][0])
        total_fame += fame_d
        total_wounds += wound_d

        steps.append({
            "step": step_num,
            "n_actions": n,
            "chosen_idx": action_idx,
            "chosen": chosen_str,
            "alts": alt_strs,
            "fame_delta": fame_d,
            "wound_delta": wound_d,
        })

        if result["dones"][0]:
            break

    return {
        "seed": seed,
        "total_steps": len(steps),
        "total_fame": total_fame,
        "total_wounds": total_wounds,
        "killed": total_fame > 0,
        "steps": steps,
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Replay trained policy against combat drills")
    parser.add_argument("checkpoint", help="Path to policy checkpoint (.pt)")
    parser.add_argument("--seeds", default="1-20", help="Seed range (e.g. '1-20' or '42')")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show every action")
    parser.add_argument("--enemy", default="diggers_1", help="Enemy token (default: diggers_1)")
    parser.add_argument("--fortified", action="store_true", help="Fortified site")
    args = parser.parse_args()

    # Parse seeds
    if "-" in args.seeds:
        start, end = args.seeds.split("-")
        seeds = list(range(int(start), int(end) + 1))
    else:
        seeds = [int(s) for s in args.seeds.split(",")]

    scenario_json = json.dumps({
        "type": "CombatDrill",
        "enemy_tokens": [args.enemy],
        "is_fortified": args.fortified,
    })

    print(f"Loading policy from {args.checkpoint}...")
    policy = load_policy(args.checkpoint)
    print(f"Replaying {len(seeds)} seeds against {args.enemy}")
    print(f"{'='*70}\n")

    kills = 0
    total_steps_sum = 0
    total_wounds_sum = 0

    for seed in seeds:
        result = replay_seed(policy, seed, scenario_json)
        kills += 1 if result["killed"] else 0
        total_steps_sum += result["total_steps"]
        total_wounds_sum += result["total_wounds"]

        tag = "KILL" if result["killed"] else "----"
        wound_str = f"  wounds={result['total_wounds']}" if result["total_wounds"] else ""
        print(f"  seed={seed:3d}  {tag}  steps={result['total_steps']:2d}  fame={result['total_fame']}{wound_str}")

        if args.verbose:
            for s in result["steps"]:
                suffix = ""
                if s["fame_delta"]:
                    suffix += f"  ** FAME+{s['fame_delta']} **"
                if s["wound_delta"]:
                    suffix += f"  WOUND+{s['wound_delta']}"
                alt_str = f"  alt: {' | '.join(s['alts'][:3])}" if s["alts"] else ""
                print(f"      step {s['step']:2d} ({s['n_actions']:2d} act) a={s['chosen_idx']}: {s['chosen']}{suffix}{alt_str}")
            print()

    n = len(seeds)
    print(f"\n{'='*70}")
    print(f"Kill rate: {kills}/{n} ({100*kills/n:.0f}%)")
    print(f"Avg steps: {total_steps_sum/n:.1f}")
    print(f"Avg wounds: {total_wounds_sum/n:.2f}")


if __name__ == "__main__":
    main()
