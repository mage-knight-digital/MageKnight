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

# ANSI colors
_BOLD = "\033[1m"
_DIM = "\033[2m"
_RED = "\033[31m"
_GREEN = "\033[32m"
_YELLOW = "\033[33m"
_CYAN = "\033[36m"
_RESET = "\033[0m"

# ── Combat phase names ──────────────────────────────────────────────────────

_PHASE_NAMES = {
    "ranged_siege": "Ranged & Siege",
    "block": "Block",
    "assign_damage": "Assign Damage",
    "attack": "Attack",
}

# ── Source → phase mapping ──────────────────────────────────────────────────

def _source_to_phase(source: str) -> str | None:
    """Map a source string to its combat phase, or None for non-phase sources."""
    if "declare_targets" in source:
        return "ranged_siege"
    if "sideways.block" in source or "basic" in source and "block" in source:
        return "block"
    if "assign_damage" in source:
        return "assign_damage"
    if "sideways.attack" in source or "resolve_attack" in source:
        return "attack"
    if ".powered" in source or ".basic" in source:
        # Card play during a phase — keep current phase
        return None
    if "end_phase" in source:
        return None
    return None


# ── Action formatting ───────────────────────────────────────────────────────

def _action_label(ids_row):
    """Decode action IDs to a concise, human-readable label."""
    at = _AT_REV.get(int(ids_row[0]), f"?{ids_row[0]}")
    src = _SRC_REV.get(int(ids_row[1]), f"?{ids_row[1]}")
    card = _CARD_REV.get(int(ids_row[2]), "")

    # Friendly action descriptions
    at_upper = at.upper()
    if at_upper == "PLAY_CARD" and card:
        return f"Play {_card_name(card)} (basic)"
    elif at_upper == "PLAY_CARD_POWERED" and card:
        return f"Play {_card_name(card)} (powered)"
    elif at_upper == "PLAY_CARD_SIDEWAYS" and card:
        mode = _sideways_mode(src)
        return f"Play {_card_name(card)} sideways → {mode}"
    elif at_upper == "DECLARE_ATTACK":
        return "Declare attack"
    elif at_upper == "DECLARE_ATTACK_TARGETS":
        return "Select target"
    elif at_upper == "RESOLVE_ATTACK":
        return f"{_GREEN}Resolve attack{_RESET}"
    elif at_upper == "END_COMBAT_PHASE":
        return f"{_DIM}End phase{_RESET}"
    elif at_upper == "RESOLVE_CHOICE":
        return "Resolve choice"
    elif at_upper == "TAKE_WOUND":
        return f"{_RED}Take wound{_RESET}"
    elif at_upper == "END_TURN":
        return f"{_DIM}End turn{_RESET}"
    else:
        label = at.replace("_", " ").capitalize()
        if card:
            label += f" ({_card_name(card)})"
        return label


def _card_name(card_id: str) -> str:
    """Convert card ID to readable name."""
    return card_id.replace("_", " ").replace("arythea ", "").title()


def _sideways_mode(source: str) -> str:
    """Determine what a sideways play provides based on source context."""
    if "attack" in source:
        return "attack 1"
    elif "block" in source:
        return "block 1"
    elif "move" in source:
        return "move 1"
    elif "influence" in source:
        return "influence 1"
    return "1"


def _action_str_raw(ids_row):
    """Raw action string for alt display."""
    at = _AT_REV.get(int(ids_row[0]), f"?{ids_row[0]}")
    card = _CARD_REV.get(int(ids_row[2]), "")
    src = _SRC_REV.get(int(ids_row[1]), "")
    src_short = src.split(".")[-1] if "." in src else src
    at_upper = at.upper()
    if "SIDEWAYS" in at_upper and card:
        mode = _sideways_mode(src_short)
        return f"{_card_name(card)} sideways→{mode}"
    elif ("PLAY_CARD" in at_upper) and card:
        pwr = "powered" if "POWERED" in at_upper else "basic"
        return f"{_card_name(card)} ({pwr})"
    elif at_upper == "END_COMBAT_PHASE":
        return "end phase"
    elif at_upper == "DECLARE_ATTACK":
        return "declare attack"
    elif at_upper == "RESOLVE_CHOICE":
        return "choose"
    else:
        return at.replace("_", " ").lower()


# ── Policy loader ───────────────────────────────────────────────────────────

def load_policy(checkpoint_path: str) -> ReinforcePolicy:
    """Load a trained policy from checkpoint."""
    policy, _meta = ReinforcePolicy.load_checkpoint(checkpoint_path)
    return policy


# ── Episode replay ──────────────────────────────────────────────────────────

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
        chosen_ids = ids[action_idx] if action_idx < n else None
        chosen_str = _action_label(chosen_ids) if chosen_ids is not None else "?"
        chosen_src = _SRC_REV.get(int(chosen_ids[1]), "") if chosen_ids is not None else ""

        alt_strs = []
        for j in range(min(n, 8)):
            if j != action_idx:
                alt_strs.append(_action_str_raw(ids[j]))

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
            "chosen_source": chosen_src,
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


# ── Pretty printing ─────────────────────────────────────────────────────────

def _print_episode_verbose(result):
    """Print a single episode with combat phase grouping and readable formatting."""
    steps = result["steps"]
    if not steps:
        return

    current_phase = None
    phase_counter = 0

    for s in steps:
        # Detect phase from source
        src = s["chosen_source"]
        src_short = src.split(".")[-1] if "." in src else src
        new_phase = _source_to_phase(src_short)

        # Print phase header on transitions
        if new_phase and new_phase != current_phase:
            current_phase = new_phase
            phase_counter += 1
            phase_name = _PHASE_NAMES.get(current_phase, current_phase)
            print(f"    {_BOLD}── {phase_name} ──{_RESET}")

        # Build the action line
        prefix = f"      "
        action_text = s["chosen"]

        # Annotations
        annotations = []
        if s["fame_delta"]:
            annotations.append(f"{_GREEN}+{s['fame_delta']} fame{_RESET}")
        if s["wound_delta"]:
            annotations.append(f"{_RED}+{s['wound_delta']} wound{'s' if s['wound_delta'] > 1 else ''}{_RESET}")

        anno_str = f"  {'  '.join(annotations)}" if annotations else ""

        # Alternatives (only show if > 1 action and not auto-resolved)
        alt_str = ""
        if s["n_actions"] > 1 and s["alts"]:
            others = s["alts"][:3]
            alt_str = f"  {_DIM}(or: {', '.join(others)}){_RESET}"

        print(f"{prefix}{action_text}{anno_str}{alt_str}")

    print()


def _print_episode_summary(result):
    """Print a single-line episode summary."""
    tag = f"{_GREEN}KILL{_RESET}" if result["killed"] else f"{_RED}FAIL{_RESET}"
    wound_str = f"  {_RED}{result['total_wounds']}W{_RESET}" if result["total_wounds"] else ""
    print(f"  seed {result['seed']:3d}  {tag}  {result['total_steps']:2d} steps  fame={result['total_fame']}{wound_str}")


# ── Main ────────────────────────────────────────────────────────────────────

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
    print(f"Replaying {len(seeds)} seeds against {_BOLD}{args.enemy}{_RESET}")
    print()

    kills = 0
    total_steps_sum = 0
    total_wounds_sum = 0

    for seed in seeds:
        result = replay_seed(policy, seed, scenario_json)
        kills += 1 if result["killed"] else 0
        total_steps_sum += result["total_steps"]
        total_wounds_sum += result["total_wounds"]

        if args.verbose:
            tag = f"{_GREEN}KILL{_RESET}" if result["killed"] else f"{_RED}FAIL{_RESET}"
            wound_str = f"  {_RED}{result['total_wounds']}W{_RESET}" if result["total_wounds"] else ""
            print(f"  {_BOLD}Seed {seed}{_RESET}  {tag}  {result['total_steps']} steps  fame={result['total_fame']}{wound_str}")
            _print_episode_verbose(result)
        else:
            _print_episode_summary(result)

    n = len(seeds)
    print(f"{'─'*50}")
    rate = 100 * kills / n
    rate_color = _GREEN if rate >= 80 else _YELLOW if rate >= 50 else _RED
    print(f"  Kill rate: {rate_color}{kills}/{n} ({rate:.0f}%){_RESET}")
    print(f"  Avg steps: {total_steps_sum/n:.1f}")
    print(f"  Avg wounds: {total_wounds_sum/n:.1f}")


if __name__ == "__main__":
    main()
