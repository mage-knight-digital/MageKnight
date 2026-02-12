"""Benchmark RL feature encoding to identify per-game bottlenecks.

Compares legacy encode_state_action (per-candidate) vs encode_step (per-step).
"""

from __future__ import annotations

import random
import sys
import time
from pathlib import Path

SDK_SRC = Path(__file__).resolve().parents[1] / "src"
if str(SDK_SRC) not in sys.path:
    sys.path.insert(0, str(SDK_SRC))

from mage_knight_sdk.sim.generated_action_enumerator import CandidateAction
from mage_knight_sdk.sim.rl.features import FEATURE_DIM, encode_state_action, encode_step


# ---------------------------------------------------------------------------
# Build a realistic game state
# ---------------------------------------------------------------------------

def _make_hex(q: int, r: int, terrain: str, site: dict | None = None,
              enemies: list | None = None) -> dict:
    h: dict = {"coord": {"q": q, "r": r}, "terrain": terrain}
    if site is not None:
        h["site"] = site
    if enemies:
        h["enemies"] = enemies
    return h


def build_realistic_state(num_hexes: int = 50) -> dict:
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
    """Return CandidateAction instances mimicking typical valid actions."""
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
# Benchmarks
# ---------------------------------------------------------------------------

def bench(label: str, fn, iterations: int) -> float:
    start = time.perf_counter()
    for _ in range(iterations):
        fn()
    return time.perf_counter() - start


def main() -> None:
    state = build_realistic_state(num_hexes=50)
    player_id = "player-1"
    candidates = build_candidate_actions(20)

    steps_per_game = 200
    candidates_per_step = 20
    total_encodes = steps_per_game * candidates_per_step

    print("=" * 70)
    print("RL Feature Encoding Benchmark")
    print(f"  Simulated game: {steps_per_game} steps x {candidates_per_step} candidates")
    print(f"  Map size: {len(state['map']['hexes'])} hexes")
    print(f"  Feature dim: {FEATURE_DIM}")
    print("=" * 70)

    # --- 1. Legacy: encode_state_action per candidate ---
    action_dict, source = candidates[0].action, candidates[0].source
    t_legacy = bench(
        "encode_state_action",
        lambda: encode_state_action(state, player_id, action_dict, source),
        total_encodes,
    )
    print(f"\n1. Legacy encode_state_action x {total_encodes:,}:  {t_legacy:.3f}s")
    print(f"   Per call: {t_legacy / total_encodes * 1e6:.1f} us")
    print(f"   Per game: {t_legacy:.3f}s")

    # --- 2. New: encode_step (state once + all candidates) ---
    t_step = bench(
        "encode_step",
        lambda: encode_step(state, player_id, candidates),
        steps_per_game,
    )
    print(f"\n2. encode_step x {steps_per_game:,}:  {t_step:.3f}s")
    print(f"   Per call: {t_step / steps_per_game * 1e3:.2f} ms")
    print(f"   Per game: {t_step:.3f}s")

    speedup = t_legacy / t_step if t_step > 0 else float("inf")
    print(f"\n   Speedup: {speedup:.1f}x (encode_step vs legacy)")

    # --- 3. PyTorch overhead comparison ---
    print(f"\n--- PyTorch overhead (x {steps_per_game} steps) ---")
    try:
        import torch
        from torch.distributions import Categorical

        # Legacy network
        legacy_net = torch.nn.Sequential(
            torch.nn.Linear(FEATURE_DIM, 128),
            torch.nn.Tanh(),
            torch.nn.Linear(128, 128),
            torch.nn.Tanh(),
            torch.nn.Linear(128, 1),
        )
        legacy_net.train()

        rows = [encode_state_action(state, player_id, c.action, c.source) for c in candidates]
        inputs = torch.tensor(rows, dtype=torch.float32)

        t_legacy_fwd = bench("legacy forward", lambda: legacy_net(inputs).squeeze(-1), steps_per_game)
        print(f"   Legacy forward:     {t_legacy_fwd:.3f}s ({t_legacy_fwd / steps_per_game * 1e3:.2f} ms/step)")

        # Embedding network
        from mage_knight_sdk.sim.rl.policy_gradient import _EmbeddingActionScoringNetwork

        emb_net = _EmbeddingActionScoringNetwork(hidden_size=128, emb_dim=16)
        emb_net.train()
        step_data = encode_step(state, player_id, candidates)
        device = torch.device("cpu")

        t_emb_fwd = bench("embedding forward", lambda: emb_net(step_data, device), steps_per_game)
        print(f"   Embedding forward:  {t_emb_fwd:.3f}s ({t_emb_fwd / steps_per_game * 1e3:.2f} ms/step)")

    except ImportError:
        print("   (torch not installed, skipping)")

    # --- 4. Summary ---
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print(f"{'=' * 70}")
    print(f"  Legacy encoding per game:  {t_legacy:.3f}s")
    print(f"  encode_step per game:      {t_step:.3f}s")
    print(f"  Speedup:                   {speedup:.1f}x")
    try:
        print(f"  Legacy net per game:       {t_legacy_fwd:.3f}s")
        print(f"  Embedding net per game:    {t_emb_fwd:.3f}s")
        total_legacy = t_legacy + t_legacy_fwd
        total_emb = t_step + t_emb_fwd
        print(f"  Total legacy:              {total_legacy:.3f}s")
        print(f"  Total embedding:           {total_emb:.3f}s")
        print(f"  Overall speedup:           {total_legacy / total_emb:.1f}x")
    except NameError:
        pass
    print()


if __name__ == "__main__":
    main()
