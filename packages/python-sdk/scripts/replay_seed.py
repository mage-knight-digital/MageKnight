#!/usr/bin/env python3
"""Replay combat drill seeds with action-0 policy to trace kill paths."""

import json
import sys
sys.path.insert(0, "src")

from mk_python import PyVecEnv
from mage_knight_sdk.sim.rl.vocabularies import ACTION_TYPE_VOCAB, SOURCE_VOCAB, CARD_VOCAB

# Build reverse lookup tables from vocabularies
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
    # Abbreviate source
    src_short = src.split(".")[-1] if "." in src else src
    parts.append(f"({src_short})")
    return " ".join(parts)


def replay_seed(seed: int, max_steps: int = 60):
    scenario_json = json.dumps({
        "type": "CombatDrill",
        "enemy_tokens": ["diggers_1"],
        "is_fortified": False,
        "hand_override": ["rage", "determination", "stamina", "stamina", "arythea_mana_pull"],
    })
    env = PyVecEnv(1, seed, "arythea", 200, scenario_json)

    print(f"\n{'=' * 70}")
    print(f"SEED {seed} REPLAY (action-0 policy)")
    print(f"{'=' * 70}")

    total_fame_delta = 0
    total_wound_delta = 0
    for step in range(max_steps):
        batch = env.encode_batch()
        n = int(batch["action_counts"][0])
        ids = batch["action_ids"]  # (total_actions, 6)

        # Show action 0 (the one taken) plus alternatives
        taken = _action_str(ids[0])
        alts = [_action_str(ids[i]) for i in range(1, min(n, 4))]

        result = env.step_batch([0])
        fame_d = int(result["fame_deltas"][0])
        wound_d = int(result["wound_deltas"][0])
        total_fame_delta += fame_d
        total_wound_delta += wound_d

        suffix = ""
        if fame_d != 0:
            suffix += f" FAME+{fame_d}"
        if wound_d != 0:
            suffix += f" WOUND+{wound_d}"

        alt_str = f"  alt: {' | '.join(alts)}" if alts else ""
        print(f"  step {step:2d} ({n:2d} act): >> {taken}{suffix}{alt_str}")

        if result["dones"][0]:
            print(f"  DONE. total_fame_delta={total_fame_delta} wounds={total_wound_delta}")
            return total_fame_delta
    return total_fame_delta


def find_kill_trace(env_seed: int, max_policy_seeds: int = 200):
    """Find a random policy seed that kills, then trace it."""
    scenario_json = json.dumps({
        "type": "CombatDrill",
        "enemy_tokens": ["diggers_1"],
        "is_fortified": False,
        "hand_override": ["rage", "determination", "stamina", "stamina", "arythea_mana_pull"],
    })

    import random
    for ps in range(max_policy_seeds):
        env = PyVecEnv(1, env_seed, "arythea", 200, scenario_json)
        rng = random.Random(env_seed * 7 + 13 + ps)
        total_fame = 0
        action_seq = []
        for step in range(60):
            batch = env.encode_batch()
            n = int(batch["action_counts"][0])
            a = rng.randint(0, n - 1)
            action_seq.append(a)
            result = env.step_batch([a])
            total_fame += int(result["fame_deltas"][0])
            if result["dones"][0]:
                break
        if total_fame > 0:
            # Replay with trace
            print(f"\n{'=' * 70}")
            print(f"KILL TRACE: env_seed={env_seed} policy_seed={ps} fame={total_fame}")
            print(f"{'=' * 70}")
            env2 = PyVecEnv(1, env_seed, "arythea", 200, scenario_json)
            for step, a in enumerate(action_seq):
                batch = env2.encode_batch()
                n = int(batch["action_counts"][0])
                ids = batch["action_ids"]
                scalars = batch["action_scalars"]

                chosen = _action_str(ids[a], scalars[a]) if a < n else "?"
                others = []
                for j in range(n):
                    if j == a:
                        continue
                    others.append(_action_str(ids[j], scalars[j]))
                    if len(others) >= 3:
                        break

                result = env2.step_batch([a])
                fame_d = int(result["fame_deltas"][0])
                wound_d = int(result["wound_deltas"][0])
                tags = ""
                if fame_d:
                    tags += f" *** FAME+{fame_d} ***"
                if wound_d:
                    tags += f" WOUND+{wound_d}"

                alt_str = f"  (other: {', '.join(others)})" if others else ""
                print(f"  step {step:2d} a={a}/{n}: {chosen}{tags}{alt_str}")
                if result["dones"][0]:
                    print(f"  DONE. total_fame={total_fame}")
                    break
            return True
    print(f"No kill found for seed={env_seed} in {max_policy_seeds} attempts")
    return False


def _action_str_with_mana(ids_row, scalars_row):
    """Like _action_str but also show mana color one-hot."""
    base = _action_str(ids_row)
    mana = [round(float(scalars_row[j]), 1) for j in range(12, 18)]
    if any(m > 0 for m in mana):
        colors = ["R", "B", "G", "W", "Go", "Bk"]
        c = [colors[i] for i, m in enumerate(mana) if m > 0]
        base += f" mana={'|'.join(c)}"
    return base


# Override _action_str to include mana info from scalars
_orig_action_str = _action_str
def _action_str(ids_row, scalars_row=None):
    base = _orig_action_str(ids_row)
    if scalars_row is not None:
        mana = [round(float(scalars_row[j]), 1) for j in range(12, 18)]
        if any(m > 0 for m in mana):
            colors = ["R", "B", "G", "W", "Go", "Bk"]
            c = [colors[i] for i, m in enumerate(mana) if m > 0]
            base += f" mana={'|'.join(c)}"
    return base


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "replay"
    if mode == "replay":
        seeds = [int(s) for s in sys.argv[2:]] if len(sys.argv) > 2 else [10, 42]
        for seed in seeds:
            replay_seed(seed)
    elif mode == "kill":
        seeds = [int(s) for s in sys.argv[2:]] if len(sys.argv) > 2 else [21]
        for seed in seeds:
            find_kill_trace(seed)
