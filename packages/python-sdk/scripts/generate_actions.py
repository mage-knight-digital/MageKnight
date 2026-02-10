#!/usr/bin/env python3
"""
Generate action constants from player-action.schema.json
Ensures fuzzer has all actions defined in the schema.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # Go up to MageKnight root
SCHEMA_PATH = ROOT / "packages" / "shared" / "schemas" / "network-protocol" / "v1" / "player-action.schema.json"
OUTPUT_PATH = ROOT / "packages" / "python-sdk" / "src" / "mage_knight_sdk" / "action_constants.py"

def camel_to_snake(name: str) -> str:
    """Convert CamelCase to UPPER_SNAKE_CASE"""
    result = ""
    for i, c in enumerate(name):
        if c.isupper() and i > 0:
            result += "_" + c.upper()
        else:
            result += c.upper()
    return result

def main():
    # Load schema
    with open(SCHEMA_PATH) as f:
        schema = json.load(f)

    # Extract action types
    action_refs = schema.get("anyOf", [])
    actions = []

    for ref in action_refs:
        ref_path = ref.get("$ref", "")
        if ref_path.startswith("#/definitions/"):
            action_class = ref_path.replace("#/definitions/", "").replace("Action", "")
            action_name = camel_to_snake(action_class)
            actions.append((action_class, action_name))

    # Generate Python file
    output = """\"\"\"
Auto-generated action constants from player-action.schema.json

DO NOT EDIT MANUALLY - Run: python3 scripts/generate_actions.py
\"\"\"

"""

    # Add action constants
    for class_name, snake_name in sorted(actions, key=lambda x: x[1]):
        output += f"ACTION_{snake_name} = \"{snake_name}\"\n"

    # Add list of all actions for easy lookup
    output += "\n\nALL_ACTIONS = [\n"
    for class_name, snake_name in sorted(actions, key=lambda x: x[1]):
        output += f"    ACTION_{snake_name},\n"
    output += "]\n"

    # Write output
    OUTPUT_PATH.write_text(output)
    print(f"✅ Generated {len(actions)} action constants to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
