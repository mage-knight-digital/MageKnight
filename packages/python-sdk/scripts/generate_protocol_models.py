#!/usr/bin/env python3
"""Generate typed protocol dataclasses from shared JSON schemas."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
SCHEMA_ROOT = ROOT / "packages" / "shared" / "schemas" / "network-protocol" / "v1"
OUTPUT = ROOT / "packages" / "python-sdk" / "src" / "mage_knight_sdk" / "protocol_models.py"


def pascal_case(value: str) -> str:
    return "".join(part.capitalize() for part in value.replace("-", "_").split("_"))


def class_name_for_message(message_type: str) -> str:
    custom = {
        "action": "ClientActionMessage",
        "lobby_subscribe": "ClientLobbySubscribeMessage",
        "state_update": "StateUpdateMessage",
        "error": "ErrorMessage",
        "lobby_state": "LobbyStateMessage",
    }
    return custom.get(message_type, f"{pascal_case(message_type)}Message")


def field_type(schema: dict[str, Any], required: bool) -> str:
    if "const" in schema:
        return f'Literal["{schema["const"]}"]'

    if "enum" in schema:
        enum_values = ", ".join(f'"{value}"' for value in schema["enum"])
        return f"Literal[{enum_values}]"

    schema_type = schema.get("type")
    if schema_type == "string":
        base = "str"
    elif schema_type == "integer":
        base = "int"
    elif schema_type == "number":
        base = "float"
    elif schema_type == "boolean":
        base = "bool"
    elif schema_type == "array":
        items = schema.get("items")
        if isinstance(items, dict) and items.get("type") == "string":
            base = "list[str]"
        else:
            base = "list[Any]"
    elif schema_type == "object":
        base = "dict[str, Any]"
    else:
        base = "Any"

    if not required:
        return f"{base} | None"
    return base


def build_dataclass(schema: dict[str, Any]) -> tuple[str, str]:
    properties = schema["properties"]
    required = set(schema.get("required", []))
    message_type = properties["type"]["const"]
    class_name = class_name_for_message(message_type)

    lines: list[str] = ["@dataclass(frozen=True)", f"class {class_name}:"]
    for field_name, field_schema in properties.items():
        lines.append(f"    {field_name}: {field_type(field_schema, field_name in required)}")

    return class_name, "\n".join(lines)


def load_schemas() -> tuple[dict[str, Any], dict[str, Any]]:
    client_schema = json.loads((SCHEMA_ROOT / "client-to-server.schema.json").read_text())
    server_schema = json.loads((SCHEMA_ROOT / "server-to-client.schema.json").read_text())
    return client_schema, server_schema


def render() -> str:
    protocol_meta = json.loads((SCHEMA_ROOT / "protocol.json").read_text())
    protocol_version = protocol_meta["protocolVersion"]
    client_schema, server_schema = load_schemas()

    client_classes: list[str] = []
    client_names: list[str] = []
    for variant in client_schema["oneOf"]:
        class_name, body = build_dataclass(variant)
        client_names.append(class_name)
        client_classes.append(body)

    server_classes: list[str] = []
    server_names: list[str] = []
    for variant in server_schema["oneOf"]:
        class_name, body = build_dataclass(variant)
        server_names.append(class_name)
        server_classes.append(body)

    known_client_types = ", ".join(
        f'"{variant["properties"]["type"]["const"]}"' for variant in client_schema["oneOf"]
    )
    known_server_types = ", ".join(
        f'"{variant["properties"]["type"]["const"]}"' for variant in server_schema["oneOf"]
    )

    return "\n".join(
        [
            '"""Auto-generated protocol dataclasses. Do not edit by hand."""',
            "",
            "from __future__ import annotations",
            "",
            "from dataclasses import dataclass",
            "from typing import Any, Literal, TypeAlias",
            "",
            f'NETWORK_PROTOCOL_VERSION: Literal["{protocol_version}"] = "{protocol_version}"',
            "",
            *client_classes,
            "",
            *server_classes,
            "",
            f"ClientMessage: TypeAlias = {' | '.join(client_names)}",
            f"ServerMessage: TypeAlias = {' | '.join(server_names)}",
            f"KNOWN_CLIENT_MESSAGE_TYPES: tuple[str, ...] = ({known_client_types},)",
            f"KNOWN_SERVER_MESSAGE_TYPES: tuple[str, ...] = ({known_server_types},)",
            "",
        ]
    )


def main() -> None:
    OUTPUT.write_text(render())
    print(f"Generated {OUTPUT}")


if __name__ == "__main__":
    main()
