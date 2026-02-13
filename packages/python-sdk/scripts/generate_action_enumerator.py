#!/usr/bin/env python3
"""Generate schema-driven valid action enumeration for Python simulation policy."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
SCHEMA_ROOT = ROOT / "packages" / "shared" / "schemas" / "network-protocol" / "v1"
SERVER_SCHEMA = SCHEMA_ROOT / "server-to-client.schema.json"
PLAYER_ACTION_SCHEMA = SCHEMA_ROOT / "player-action.schema.json"
OUTPUT = ROOT / "packages" / "python-sdk" / "src" / "mage_knight_sdk" / "sim" / "generated_action_enumerator.py"


def _load_enumerator_body_lines() -> list[str]:
    if not OUTPUT.exists():
        raise ValueError(
            f"Expected existing generated file at {OUTPUT} to source helper bodies."
        )
    source = OUTPUT.read_text()
    marker = "def _actions_pending_glade"
    index = source.find(marker)
    if index < 0:
        raise ValueError(f"Could not find helper marker '{marker}' in {OUTPUT}")
    return source[index:].splitlines()


def _const_name(prefix: str, value: str) -> str:
    normalized = "".join(ch if ch.isalnum() else "_" for ch in value).upper()
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    normalized = normalized.strip("_")
    return f"{prefix}_{normalized}"


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def _load_client_state_schema(server_schema: dict[str, Any]) -> dict[str, Any]:
    for variant in server_schema.get("oneOf", []):
        properties = variant.get("properties", {})
        if properties.get("type", {}).get("const") != "state_update":
            continue
        state_ref = properties.get("state", {}).get("$ref")
        if not isinstance(state_ref, str):
            break
        schema_name = state_ref.split("#", 1)[0]
        if not schema_name:
            raise ValueError("Unexpected in-file ref for state schema")
        return _load_json(SCHEMA_ROOT / schema_name)
    raise ValueError("Could not find state_update schema in server-to-client schema")


def _extract_valid_action_modes(client_state_schema: dict[str, Any]) -> list[str]:
    definitions = client_state_schema["definitions"]
    valid_actions = definitions["ValidActions"]
    modes: list[str] = []
    for ref_item in valid_actions.get("anyOf", []):
        ref = ref_item.get("$ref")
        if not isinstance(ref, str):
            continue
        def_name = ref.split("/")[-1]
        mode = definitions.get(def_name, {}).get("properties", {}).get("mode", {}).get("const")
        if isinstance(mode, str):
            modes.append(mode)
    return modes


def _extract_tactic_decision_types(client_state_schema: dict[str, Any]) -> list[str]:
    values = client_state_schema["definitions"]["TacticDecisionType"]["enum"]
    return [value for value in values if isinstance(value, str)]


def _extract_player_action_types(action_schema: dict[str, Any]) -> list[str]:
    definitions = action_schema["definitions"]
    types: list[str] = []
    for ref_item in action_schema.get("anyOf", []):
        ref = ref_item.get("$ref")
        if not isinstance(ref, str):
            continue
        def_name = ref.split("/")[-1]
        type_const = definitions.get(def_name, {}).get("properties", {}).get("type", {}).get("const")
        if isinstance(type_const, str):
            types.append(type_const)
    return sorted(set(types))


def _build_constants_block(action_types: list[str], modes: list[str]) -> str:
    lines = [f'{_const_name("ACTION", action_type)} = "{action_type}"' for action_type in action_types]
    lines.extend([f'{_const_name("MODE", mode)} = "{mode}"' for mode in sorted(set(modes))])
    return "\n".join(lines)


def _build_mode_checks(modes: list[str]) -> None:
    required = {
        "cannot_act",
        "tactics_selection",
        "pending_tactic_decision",
        "pending_choice",
        "combat",
        "normal_turn",
    }
    missing = sorted(required - set(modes))
    if missing:
        raise ValueError(f"Schema is missing expected ValidActions modes: {missing}")


def _build_tactic_checks(tactic_types: list[str]) -> None:
    required = {"mana_steal", "midnight_meditation", "preparation", "rethink", "sparing_power"}
    missing = sorted(required - set(tactic_types))
    if missing:
        raise ValueError(f"Schema is missing expected tactic decision types: {missing}")


def render() -> str:
    server_schema = _load_json(SERVER_SCHEMA)
    client_state_schema = _load_client_state_schema(server_schema)
    action_schema = _load_json(PLAYER_ACTION_SCHEMA)

    modes = _extract_valid_action_modes(client_state_schema)
    tactic_types = _extract_tactic_decision_types(client_state_schema)
    action_types = _extract_player_action_types(action_schema)

    _build_mode_checks(modes)
    _build_tactic_checks(tactic_types)

    pending_modes = sorted(mode for mode in modes if mode.startswith("pending_") and mode not in {"pending_choice", "pending_tactic_decision"})
    pending_dispatch = {
        "pending_glade_wound": "_actions_pending_glade",
        "pending_deep_mine": "_actions_pending_deep_mine",
        "pending_discard_cost": "_actions_pending_discard_cost",
        "pending_discard_for_attack": "_actions_pending_discard_for_attack",
        "pending_discard_for_bonus": "_actions_pending_discard_for_bonus",
        "pending_discard_for_crystal": "_actions_pending_discard_for_crystal",
        "pending_artifact_crystal_color": "_actions_pending_artifact_crystal_color",
        "pending_decompose": "_actions_pending_decompose",
        "pending_maximal_effect": "_actions_pending_maximal_effect",
        "pending_book_of_wisdom": "_actions_pending_book_of_wisdom",
        "pending_training": "_actions_pending_training",
        "pending_crystal_joy_reclaim": "_actions_pending_crystal_joy",
        "pending_steady_tempo": "_actions_pending_steady_tempo",
        "pending_meditation": "_actions_pending_meditation",
        "pending_banner_protection": "_actions_pending_banner_protection",
        "pending_source_opening_reroll": "_actions_pending_source_opening_reroll",
        "pending_level_up": "_actions_pending_level_up",
        "pending_unit_maintenance": "_actions_pending_unit_maintenance",
        "pending_hex_cost_reduction": "_actions_pending_hex_cost_reduction",
        "pending_terrain_cost_reduction": "_actions_pending_terrain_cost_reduction",
    }

    unknown_pending = sorted(set(pending_modes) - set(pending_dispatch))
    if unknown_pending:
        raise ValueError(
            "Generator does not yet handle pending mode(s): "
            f"{unknown_pending}. Update generate_action_enumerator.py."
        )

    constants_block = _build_constants_block(action_types=action_types, modes=modes)
    tactic_tuple = ", ".join(f'"{value}"' for value in tactic_types)
    mode_tuple = ", ".join(f'"{value}"' for value in sorted(set(modes)))
    pending_lines = "\n".join(
        f'        "{mode}": {pending_dispatch[mode]},' for mode in sorted(pending_dispatch)
    )

    return "\n".join(
        [
            '"""Auto-generated valid action enumeration from network protocol schemas. Do not edit by hand."""',
            "",
            "from __future__ import annotations",
            "",
            "from dataclasses import dataclass",
            "from itertools import combinations",
            "from typing import Any",
            "",
            constants_block,
            "",
            f"KNOWN_VALID_ACTION_MODES: tuple[str, ...] = ({mode_tuple},)",
            f"KNOWN_TACTIC_DECISION_TYPES: tuple[str, ...] = ({tactic_tuple},)",
            "",
            "@dataclass(frozen=True)",
            "class CandidateAction:",
            "    action: dict[str, Any]",
            "    source: str",
            "",
            "def enumerate_valid_actions_from_state(state: dict[str, Any], player_id: str) -> list[CandidateAction]:",
            "    \"\"\"Auto-generated from network protocol schemas to enumerate valid player actions.\"\"\"",
            "    valid_actions = _as_dict(state.get(\"validActions\"))",
            "    if valid_actions is None:",
            "        return []",
            "",
            "    mode = _as_str(valid_actions.get(\"mode\"))",
            "    if mode is None:",
            "        return []",
            "",
            "    actions: list[CandidateAction] = []",
            "",
            "    if mode == MODE_CANNOT_ACT:",
            "        return actions",
            "",
            "    if mode == MODE_TACTICS_SELECTION:",
            "        tactics = _as_dict(valid_actions.get(\"tactics\"))",
            "        available = _as_list(tactics.get(\"availableTactics\") if tactics else None)",
            "        for tactic_id in available:",
            "            if isinstance(tactic_id, str):",
            "                actions.append(CandidateAction({\"type\": ACTION_SELECT_TACTIC, \"tacticId\": tactic_id}, \"tactics.available\"))",
            "        return actions",
            "",
            "    if mode == MODE_PENDING_TACTIC_DECISION:",
            "        decision = _as_dict(valid_actions.get(\"tacticDecision\"))",
            "        if decision is None:",
            "            return actions",
            "        actions.extend(_actions_for_tactic_decision(decision, \"pending_tactic_decision\"))",
            "        return actions",
            "",
            "    if mode == MODE_PENDING_CHOICE:",
            "        player = _find_player(state, player_id)",
            "        pending_choice = _as_dict(player.get(\"pendingChoice\") if player else None)",
            "        options = _as_list(pending_choice.get(\"options\") if pending_choice else None)",
            "        for idx, _ in enumerate(options):",
            "            actions.append(CandidateAction({\"type\": ACTION_RESOLVE_CHOICE, \"choiceIndex\": idx}, \"pending_choice.index\"))",
            "        return actions",
            "",
            "    _append_common_blocking_actions(valid_actions, actions)",
            "",
            "    pending_dispatch = {",
            pending_lines,
            "    }",
            "",
            "    resolver = pending_dispatch.get(mode)",
            "    if resolver is not None:",
            "        actions.extend(resolver(valid_actions))",
            "        return actions",
            "",
            "    if mode == MODE_COMBAT:",
            "        actions.extend(_actions_combat(valid_actions))",
            "        return actions",
            "",
            "    if mode == MODE_NORMAL_TURN:",
            "        actions.extend(_actions_normal_turn(state, valid_actions, player_id))",
            "        return actions",
            "",
            "    return actions",
            "",
            *_load_enumerator_body_lines(),
            "",
        ]
    )


def main() -> None:
    OUTPUT.write_text(render())
    print(f"Generated {OUTPUT}")


if __name__ == "__main__":
    main()
