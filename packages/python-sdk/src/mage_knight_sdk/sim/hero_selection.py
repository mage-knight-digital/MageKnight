"""Deterministic hero selection for RL training and game simulation."""

from __future__ import annotations

ALL_HEROES: list[str] = [
    "arythea",
    "braevalar",
    "goldyx",
    "krang",
    "norowas",
    "tovak",
    "wolfhawk",
]


def pick_hero(seed: int) -> str:
    """Deterministically pick a hero based on the seed."""
    return ALL_HEROES[seed % len(ALL_HEROES)]


def resolve_hero(hero_arg: str | None, seed: int) -> str:
    """Resolve a hero CLI argument to a concrete hero name.

    If hero_arg is None or "random", picks deterministically from seed.
    Otherwise returns the explicit hero name.
    """
    if hero_arg is None or hero_arg.lower() == "random":
        return pick_hero(seed)
    return hero_arg.lower()
