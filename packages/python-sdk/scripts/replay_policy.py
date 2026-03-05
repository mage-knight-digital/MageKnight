#!/usr/bin/env python3
"""Replay a trained policy against combat drills, showing every action taken.

Usage:
    python scripts/replay_policy.py <checkpoint> [--seeds 1-20]
    python scripts/replay_policy.py <checkpoint> --seeds 1-50 -v
    python scripts/replay_policy.py <checkpoint> --enemy prowlers_1 --units peasants --crystals red=3
    python scripts/replay_policy.py <checkpoint> --curriculum progressive --phase 3
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

_PHASES = ["Ranged & Siege", "Block", "Assign Damage", "Attack"]


# ── Action formatting ───────────────────────────────────────────────────────

def _action_label(ids_row, scalars_row=None):
    """Decode action IDs to a concise, human-readable label."""
    at = _AT_REV.get(int(ids_row[0]), f"?{ids_row[0]}")
    src = _SRC_REV.get(int(ids_row[1]), f"?{ids_row[1]}")
    card = _CARD_REV.get(int(ids_row[2]), "")

    # Friendly action descriptions
    at_upper = at.upper()
    if at_upper in ("PLAY_CARD", "PLAY_CARD_POWERED") and card:
        mode = "powered" if "powered" in src else "basic"
        return f"Play {_card_name(card)} ({mode})"
    elif at_upper == "PLAY_CARD_SIDEWAYS" and card:
        mode = _sideways_mode(src)
        return f"Play {_card_name(card)} sideways → {mode}"
    elif at_upper == "DECLARE_ATTACK":
        return "Declare attack"
    elif at_upper == "DECLARE_ATTACK_TARGETS":
        # Distinguish SubsetConfirm (scalars[11]=1) from SubsetSelect (scalars[19]=index)
        if scalars_row is not None and scalars_row[11] > 0.5:
            return f"{_YELLOW}Confirm targets{_RESET}"
        target_idx = int(round(scalars_row[19] * 5)) if scalars_row is not None else "?"
        return f"Select target [{target_idx}]"
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


def _format_card_list(cards: list) -> str:
    """Format a card list grouping duplicates (e.g., '2x March, Stamina')."""
    from collections import Counter
    counts = Counter(cards)
    parts = []
    for card in sorted(counts):
        n = counts[card]
        name = _card_name(card)
        parts.append(f"{n}x {name}" if n > 1 else name)
    return ", ".join(parts)


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


def _action_str_raw(ids_row, scalars_row=None):
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
        pwr = "powered" if "powered" in src else "basic"
        return f"{_card_name(card)} ({pwr})"
    elif at_upper == "END_COMBAT_PHASE":
        return "end phase"
    elif at_upper == "DECLARE_ATTACK":
        return "declare attack"
    elif at_upper == "DECLARE_ATTACK_TARGETS":
        if scalars_row is not None and scalars_row[11] > 0.5:
            return "confirm targets"
        target_idx = int(round(scalars_row[19] * 5)) if scalars_row is not None else "?"
        return f"select [{target_idx}]"
    elif at_upper == "RESOLVE_CHOICE":
        return "choose"
    else:
        return at.replace("_", " ").lower()


# ── Hand extraction ────────────────────────────────────────────────────────

def _extract_hand_from_step(ids, n):
    """Extract unique card names from available actions in first step."""
    cards = set()
    for j in range(n):
        at = _AT_REV.get(int(ids[j][0]), "")
        card = _CARD_REV.get(int(ids[j][2]), "")
        if card and at.upper() in ("PLAY_CARD", "PLAY_CARD_POWERED", "PLAY_CARD_SIDEWAYS"):
            cards.add(card)
    return sorted(cards)


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
    hand_counts = {}  # card_id -> max count seen in any single step (handles duplicates)
    cards_played_counts = {}  # card_id -> number of times played

    for step_num in range(max_steps):
        batch = env.encode_batch()
        n = int(batch["action_counts"][0])
        if n == 0:
            break

        # Decode all actions for verbose output
        ids = batch["action_ids"].reshape(1, -1, 6)[0]  # (max_actions, 6)
        scalars = batch["action_scalars"].reshape(1, -1, 34)[0]  # (max_actions, 34)

        # Count card copies visible this step.
        # Each copy gets one sideways action per variant (attack/block/move/influence).
        # So total sideways for a card / number of sideways variants = number of copies.
        sideways_total = {}   # card -> total sideways action count
        sideways_variants = {}  # card -> set of source strings (unique variants)
        for j in range(n):
            at = _AT_REV.get(int(ids[j][0]), "")
            card = _CARD_REV.get(int(ids[j][2]), "")
            src = _SRC_REV.get(int(ids[j][1]), "")
            if card and at.upper() == "PLAY_CARD_SIDEWAYS":
                sideways_total[card] = sideways_total.get(card, 0) + 1
                if card not in sideways_variants:
                    sideways_variants[card] = set()
                sideways_variants[card].add(src)
            elif card and at.upper() in ("PLAY_CARD", "PLAY_CARD_POWERED"):
                hand_counts[card] = max(hand_counts.get(card, 0), 1)
        # Infer copy count: total sideways / unique variants = copies in hand
        for card, total in sideways_total.items():
            n_variants = len(sideways_variants.get(card, {card}))
            copies = total // n_variants if n_variants > 0 else total
            hand_counts[card] = max(hand_counts.get(card, 0), copies)

        # Use policy to choose action
        actions, log_probs, values = policy.choose_actions_batch(batch)
        action_idx = int(actions[0])

        chosen_ids = ids[action_idx] if action_idx < n else None
        chosen_scalars = scalars[action_idx] if action_idx < n else None
        chosen_str = _action_label(chosen_ids, chosen_scalars) if chosen_ids is not None else "?"
        chosen_src = _SRC_REV.get(int(chosen_ids[1]), "") if chosen_ids is not None else ""
        chosen_at = _AT_REV.get(int(chosen_ids[0]), "") if chosen_ids is not None else ""
        chosen_card = _CARD_REV.get(int(chosen_ids[2]), "") if chosen_ids is not None else ""

        # Track cards played (by count)
        if chosen_at.upper() in ("PLAY_CARD", "PLAY_CARD_POWERED", "PLAY_CARD_SIDEWAYS") and chosen_card:
            cards_played_counts[chosen_card] = cards_played_counts.get(chosen_card, 0) + 1

        alt_strs = []
        for j in range(min(n, 8)):
            if j != action_idx:
                alt_strs.append(_action_str_raw(ids[j], scalars[j]))

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
            "chosen_action_type": chosen_at,
            "alts": alt_strs,
            "fame_delta": fame_d,
            "wound_delta": wound_d,
        })

        if result["dones"][0]:
            break

    # Build hand list with duplicates (e.g. ["march", "march", "stamina", ...])
    hand = []
    for card in sorted(hand_counts):
        hand.extend([card] * hand_counts[card])
    # Build cards_played list with duplicates
    cards_played = []
    for card in sorted(cards_played_counts):
        cards_played.extend([card] * cards_played_counts[card])
    # Unused = hand minus played (count-aware)
    unused_counts = dict(hand_counts)
    for card, cnt in cards_played_counts.items():
        if card in unused_counts:
            unused_counts[card] = max(0, unused_counts[card] - cnt)
    cards_unused = []
    for card in sorted(unused_counts):
        cards_unused.extend([card] * unused_counts[card])

    return {
        "seed": seed,
        "total_steps": len(steps),
        "total_fame": total_fame,
        "total_wounds": total_wounds,
        "killed": total_fame > 0,
        "hand": hand,
        "cards_played": cards_played,
        "cards_unused": cards_unused,
        "steps": steps,
    }


# ── Pretty printing ─────────────────────────────────────────────────────────

def _print_episode_verbose(result):
    """Print a single episode with combat phase grouping and readable formatting.

    Phase tracking: combat always starts in Ranged & Siege (phase 0).
    Each END_COMBAT_PHASE advances to the next phase.

    Wound attribution: when END_COMBAT_PHASE ends the Block phase (idx 1)
    with wound deltas, those wounds represent unblocked damage assigned in
    the Assign Damage phase. We show them under an "Assign Damage" header
    and skip the subsequent empty Assign Damage END_COMBAT_PHASE.
    """
    steps = result["steps"]
    if not steps:
        return

    # Show hand (group duplicates as "2x March")
    hand_str = _format_card_list(result["hand"])
    print(f"    {_DIM}Hand: {hand_str}{_RESET}")

    phase_idx = 0       # 0=Ranged&Siege, 1=Block, 2=AssignDamage, 3=Attack
    header_shown = False
    skip_next_end_phase = False  # skip the empty Assign Damage end after we show wounds

    for s in steps:
        is_end_phase = s["chosen_action_type"].upper() == "END_COMBAT_PHASE"
        has_wounds = s["wound_delta"] != 0
        has_events = s["fame_delta"] != 0 or has_wounds

        if is_end_phase and skip_next_end_phase:
            # This is the empty Assign Damage END_COMBAT_PHASE — already shown wounds above.
            # phase_idx was already advanced past Assign Damage, so don't increment again.
            skip_next_end_phase = False
            continue

        if is_end_phase:
            # Special case: Block phase ends with wounds → attribute to Assign Damage
            if phase_idx == 1 and has_wounds:
                # Show Block header if actions preceded it
                if header_shown:
                    _print_step_line_action_only(s)  # "End phase" without wound annotation
                # Show Assign Damage header with wound info
                phase_idx += 1  # advance past Block to Assign Damage
                header_shown = False
                print(f"    {_BOLD}── {_PHASES[phase_idx]} ──{_RESET}")
                header_shown = True
                _print_wound_line(s)
                # The next END_COMBAT_PHASE will be the Assign Damage end — skip it
                skip_next_end_phase = True
                phase_idx += 1  # advance past Assign Damage
                header_shown = False
                continue

            if not header_shown and not has_events:
                # Pure skip — this phase had nothing. Don't print anything.
                pass
            else:
                # Meaningful end-of-phase (or actions preceded it)
                if not header_shown and phase_idx < len(_PHASES):
                    print(f"    {_BOLD}── {_PHASES[phase_idx]} ──{_RESET}")
                    header_shown = True
                _print_step_line(s)
            # Advance to next phase
            phase_idx += 1
            header_shown = False
        else:
            # Non-end action — show phase header if needed
            if not header_shown and phase_idx < len(_PHASES):
                print(f"    {_BOLD}── {_PHASES[phase_idx]} ──{_RESET}")
                header_shown = True
            _print_step_line(s)

    # Show cards unused
    if result["cards_unused"]:
        unused_str = _format_card_list(result["cards_unused"])
        print(f"    {_DIM}Unused: {unused_str}{_RESET}")

    print()


def _print_step_line(s):
    """Print a single step line with annotations and alternatives."""
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

    print(f"      {action_text}{anno_str}{alt_str}")


def _print_step_line_action_only(s):
    """Print a step line without wound/fame annotations (used when wounds are attributed elsewhere)."""
    print(f"      {s['chosen']}")


def _print_wound_line(s):
    """Print a wound-assignment summary line under the Assign Damage header."""
    w = s["wound_delta"]
    label = "wound" if w == 1 else "wounds"
    print(f"      {_RED}Take {w} {label}{_RESET}")


def _print_episode_summary(result):
    """Print a single-line episode summary."""
    tag = f"{_GREEN}KILL{_RESET}" if result["killed"] else f"{_RED}FAIL{_RESET}"
    wound_str = f"  {_RED}{result['total_wounds']}W{_RESET}" if result["total_wounds"] else ""
    used = len(result["cards_played"])
    total = len(result["hand"])
    print(f"  seed {result['seed']:3d}  {tag}  {result['total_steps']:2d} steps  fame={result['total_fame']}{wound_str}  cards={used}/{total}")


# ── Scenario building ──────────────────────────────────────────────────────

def _build_scenario(args) -> dict:
    """Build scenario dict from CLI args."""
    enemies = [e.strip() for e in args.enemy.split(",")]
    scenario = {
        "type": "CombatDrill",
        "enemy_tokens": enemies,
        "is_fortified": args.fortified,
    }
    if args.units:
        scenario["units"] = [u.strip() for u in args.units.split(",")]
    if args.crystals:
        crystal_map = {"red": 0, "blue": 0, "green": 0, "white": 0}
        for pair in args.crystals.split(","):
            color, count = pair.strip().split("=")
            crystal_map[color.strip()] = int(count.strip())
        scenario["crystals"] = crystal_map
    if args.hand:
        scenario["hand_override"] = [c.strip() for c in args.hand.split(",")]
    return scenario


def _scenario_from_curriculum(curriculum_name: str, phase_idx: int) -> dict:
    """Extract scenario dict from a curriculum phase."""
    from mage_knight_sdk.sim.rl.curriculum import CURRICULA
    if curriculum_name not in CURRICULA:
        print(f"Unknown curriculum: {curriculum_name}")
        print(f"Available: {', '.join(CURRICULA.keys())}")
        sys.exit(1)
    schedule = CURRICULA[curriculum_name]()
    if phase_idx < 1 or phase_idx > len(schedule.phases):
        print(f"Phase {phase_idx} out of range (1-{len(schedule.phases)})")
        sys.exit(1)
    phase = schedule.phases[phase_idx - 1]
    scenario_json = phase.scenario.to_rust_json()
    if scenario_json is None:
        print(f"Phase '{phase.name}' is full_game — not a combat drill")
        sys.exit(1)
    return json.loads(scenario_json), phase.name


def _print_scenario_header(scenario: dict):
    """Print a readable scenario description."""
    enemies = scenario.get("enemy_tokens", [])
    enemy_str = ", ".join(_card_name(e.rsplit("_", 1)[0]) for e in enemies)
    parts = [f"{_BOLD}{enemy_str}{_RESET}"]

    if scenario.get("is_fortified"):
        parts.append(f"{_YELLOW}fortified{_RESET}")

    units = scenario.get("units", [])
    if units:
        unit_str = ", ".join(_card_name(u) for u in units)
        parts.append(f"units: {_CYAN}{unit_str}{_RESET}")

    crystals = scenario.get("crystals", {})
    crystal_parts = []
    for color in ("red", "blue", "green", "white"):
        n = crystals.get(color, 0)
        if n > 0:
            crystal_parts.append(f"{n} {color}")
    if crystal_parts:
        parts.append(f"crystals: {_CYAN}{', '.join(crystal_parts)}{_RESET}")

    hand = scenario.get("hand_override")
    if hand:
        hand_str = ", ".join(_card_name(c) for c in hand)
        parts.append(f"hand: {_CYAN}{hand_str}{_RESET}")

    print(f"  Scenario: {' | '.join(parts)}")


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Replay trained policy against combat drills",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s checkpoint.pt                          # Default: diggers, random hand
  %(prog)s checkpoint.pt --enemy prowlers_1 -v    # Prowlers, verbose
  %(prog)s checkpoint.pt --enemy wolf_riders_1 --crystals red=3
  %(prog)s checkpoint.pt --units peasants          # With a unit
  %(prog)s checkpoint.pt --enemy prowlers_1,prowlers_2  # Multi-enemy
  %(prog)s checkpoint.pt --curriculum progressive --phase 3  # Replay exact training scenario
        """,
    )
    parser.add_argument("checkpoint", help="Path to policy checkpoint (.pt)")
    parser.add_argument("--seeds", default="1-20", help="Seed range (e.g. '1-20' or '42')")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show every action")
    parser.add_argument("--enemy", default="diggers_1", help="Enemy token(s), comma-separated")
    parser.add_argument("--fortified", action="store_true", help="Fortified site")
    parser.add_argument("--units", default=None, help="Unit(s), comma-separated (e.g. peasants)")
    parser.add_argument("--crystals", default=None, help="Crystals (e.g. red=3 or red=3,blue=1)")
    parser.add_argument("--hand", default=None, help="Fixed hand override, comma-separated card IDs")
    parser.add_argument("--curriculum", default=None, help="Use scenario from a curriculum (default, guardsmen, progressive)")
    parser.add_argument("--phase", type=int, default=None, help="Curriculum phase number (1-indexed)")
    args = parser.parse_args()

    # Build scenario
    phase_name = None
    if args.curriculum:
        if args.phase is None:
            print("--curriculum requires --phase")
            sys.exit(1)
        scenario, phase_name = _scenario_from_curriculum(args.curriculum, args.phase)
    else:
        scenario = _build_scenario(args)

    scenario_json = json.dumps(scenario)

    # Parse seeds
    if "-" in args.seeds:
        start, end = args.seeds.split("-")
        seeds = list(range(int(start), int(end) + 1))
    else:
        seeds = [int(s) for s in args.seeds.split(",")]

    print(f"Loading policy from {args.checkpoint}...")
    policy = load_policy(args.checkpoint)

    if phase_name:
        print(f"  Curriculum phase: {_BOLD}{phase_name}{_RESET}")
    _print_scenario_header(scenario)
    print(f"  Seeds: {len(seeds)} ({args.seeds})")
    print()

    kills = 0
    total_steps_sum = 0
    total_wounds_sum = 0
    total_cards_used = 0
    total_cards_available = 0

    for seed in seeds:
        result = replay_seed(policy, seed, scenario_json)
        kills += 1 if result["killed"] else 0
        total_steps_sum += result["total_steps"]
        total_wounds_sum += result["total_wounds"]
        total_cards_used += len(result["cards_played"])
        total_cards_available += len(result["hand"])

        if args.verbose:
            tag = f"{_GREEN}KILL{_RESET}" if result["killed"] else f"{_RED}FAIL{_RESET}"
            wound_str = f"  {_RED}{result['total_wounds']}W{_RESET}" if result["total_wounds"] else ""
            used = len(result["cards_played"])
            total = len(result["hand"])
            print(f"  {_BOLD}Seed {seed}{_RESET}  {tag}  {result['total_steps']} steps  fame={result['total_fame']}{wound_str}  cards={used}/{total}")
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
    if total_cards_available > 0:
        print(f"  Avg cards used: {total_cards_used/n:.1f}/{total_cards_available/n:.1f}")


if __name__ == "__main__":
    main()
