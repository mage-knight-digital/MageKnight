#!/usr/bin/env python3
"""Audit action encodings: find actions that encode identically.

Runs a game and at each step checks if any pair of legal actions has the
same encoding. Prints duplicate groups with their action JSON.
"""

import json
import sys
sys.path.insert(0, "src")

from collections import defaultdict
from mk_python import GameEngine
from mage_knight_sdk.sim.rl.native_rl_runner import py_encoded_to_encoded_step


def audit_step(engine: GameEngine, step_num: int):
    """Check one game state for duplicate action encodings. Returns count of duplicate groups."""
    py_enc = engine.encode_step()
    step = py_encoded_to_encoded_step(py_enc)
    actions = step.actions
    n_actions = engine.legal_action_count()

    # Get action JSON descriptions
    action_jsons = []
    for i in range(n_actions):
        try:
            j = json.loads(engine.legal_action_json(i))
            # Compact representation
            if isinstance(j, dict):
                # PlayerAction enum — get the variant name
                action_jsons.append(list(j.keys())[0] if len(j) == 1 else str(j))
            else:
                action_jsons.append(str(j))
        except Exception:
            action_jsons.append(f"action_{i}")

    # Group by full encoding signature
    sig_to_indices: dict[tuple, list[int]] = defaultdict(list)
    for i, a in enumerate(actions):
        sig = (
            a.action_type_id, a.source_id, a.card_id,
            a.unit_id, a.enemy_id, a.skill_id,
            tuple(round(x, 4) for x in a.scalars),
        )
        sig_to_indices[sig].append(i)

    dup_groups = 0
    for sig, indices in sig_to_indices.items():
        if len(indices) > 1:
            # Check if this is a "benign" duplicate (same card_id means same card type)
            # For CompleteRest with same card_id, these are truly equivalent actions
            all_same_type = len(set(action_jsons[i].split("{")[0] if i < len(action_jsons) else "" for i in indices)) == 1
            card_ids = set(actions[i].card_id for i in indices)
            benign = all_same_type and len(card_ids) == 1 and list(card_ids)[0] > 0
            tag = "BENIGN (same card type)" if benign else "BUG"

            dup_groups += 1
            vocab_ids = sig[:6]
            print(f"  Step {step_num} ({n_actions} actions): {len(indices)} IDENTICAL [{tag}] "
                  f"(type={vocab_ids[0]} src={vocab_ids[1]} card={vocab_ids[2]} "
                  f"unit={vocab_ids[3]} enemy={vocab_ids[4]} skill={vocab_ids[5]})")
            if not benign:
                for idx in indices:
                    try:
                        full_json = json.loads(engine.legal_action_json(idx))
                    except Exception:
                        full_json = "?"
                    print(f"    [{idx}] {json.dumps(full_json, separators=(',', ':'))}")

    return dup_groups


def run_audit(max_steps: int = 100):
    """Run a full game with action-0 policy, audit every step."""
    print("=" * 70)
    print(f"ACTION ENCODING AUDIT (first {max_steps} steps, Arythea seed=42)")
    print("=" * 70)

    engine = GameEngine(seed=42, hero="arythea")
    engine.set_rl_mode(True)

    total_steps = 0
    total_dup_groups = 0
    steps_with_dups = 0

    while not engine.is_game_ended() and total_steps < max_steps:
        dups = audit_step(engine, total_steps)
        total_dup_groups += dups
        if dups > 0:
            steps_with_dups += 1
        total_steps += 1

        engine.apply_action(0)

    print()
    print("=" * 70)
    print(f"Summary: {total_steps} steps checked")
    print(f"  {total_dup_groups} groups of identical encodings")
    print(f"  {steps_with_dups}/{total_steps} steps had at least one duplicate group")
    print("=" * 70)
    return total_dup_groups


def run_multi_seed_audit(seeds: list[int], max_steps: int = 100):
    """Run audit across multiple seeds to find encoding bugs."""
    print("=" * 70)
    print(f"MULTI-SEED AUDIT ({len(seeds)} seeds, {max_steps} steps each)")
    print("=" * 70)

    total_bugs = 0
    total_benign = 0

    for seed in seeds:
        engine = GameEngine(seed=seed, hero="arythea")
        engine.set_rl_mode(True)

        step = 0
        while not engine.is_game_ended() and step < max_steps:
            py_enc = engine.encode_step()
            es = py_encoded_to_encoded_step(py_enc)
            actions = es.actions
            n = engine.legal_action_count()

            sig_to_indices: dict[tuple, list[int]] = defaultdict(list)
            for i, a in enumerate(actions):
                sig = (
                    a.action_type_id, a.source_id, a.card_id,
                    a.unit_id, a.enemy_id, a.skill_id,
                    tuple(round(x, 4) for x in a.scalars),
                )
                sig_to_indices[sig].append(i)

            for sig, indices in sig_to_indices.items():
                if len(indices) > 1:
                    card_ids = set(actions[i].card_id for i in indices)
                    if len(card_ids) == 1 and list(card_ids)[0] > 0:
                        total_benign += 1
                    else:
                        total_bugs += 1
                        vocab_ids = sig[:6]
                        action_jsons = []
                        for i in range(n):
                            try:
                                j = json.loads(engine.legal_action_json(i))
                                action_jsons.append(list(j.keys())[0] if isinstance(j, dict) and len(j) == 1 else str(j))
                            except Exception:
                                action_jsons.append(f"action_{i}")
                        print(f"  BUG seed={seed} step={step} ({n} actions): {len(indices)} identical "
                              f"(type={vocab_ids[0]} src={vocab_ids[1]} card={vocab_ids[2]})")
                        for idx in indices:
                            try:
                                full_json = json.loads(engine.legal_action_json(idx))
                            except Exception:
                                full_json = "?"
                            print(f"    [{idx}] {json.dumps(full_json, separators=(',', ':'))}")

            step += 1
            engine.apply_action(0)

    print(f"\n{total_bugs} BUG groups, {total_benign} benign groups across {len(seeds)} seeds")
    return total_bugs


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "single"
    if mode == "single":
        max_steps = int(sys.argv[2]) if len(sys.argv) > 2 else 50
        run_audit(max_steps)
    elif mode == "sweep":
        max_steps = int(sys.argv[2]) if len(sys.argv) > 2 else 200
        run_multi_seed_audit(list(range(1, 21)), max_steps)
    else:
        print(f"Usage: {sys.argv[0]} [single|sweep] [max_steps]")
