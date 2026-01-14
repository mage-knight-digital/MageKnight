#!/usr/bin/env python3
"""
Batch upscale all enemy tokens using gpt-image-1.5
Usage: python scripts/batch_upscale_enemies.py
"""

import base64
import os
import sys
import time
from pathlib import Path

from openai import OpenAI

PROMPT = """Edit the provided image.

Goal:
Upscale and clean the existing circular game token.

Hard constraints (must follow exactly):
- Preserve the original artwork exactly.
- Same creature pose, symbols, numbers, layout, colors, and textures.
- No redesign, no reinterpretation, no new elements.

Image processing:
- Increase resolution and clarity only.
- Improve sharpness and texture fidelity without changing content.
- Keep the black circular border perfectly round and unchanged.

Transparency:
- Remove everything outside the circular token.
- Background outside the circle must be fully transparent (alpha channel).
- No glow, shadow, gradient, or vignette outside the circle.

Style:
- Maintain original hand-painted fantasy board game style.
- Gritty, textured look with dark defined outlines.
- High contrast, not soft or washed out.

Output:
- PNG
- Transparent background
- High resolution

Do not:
- add new symbols
- alter numbers
- change color palette
- change lighting
- add background
- crop the token"""


def upscale_enemy(client: OpenAI, input_path: Path, output_path: Path) -> bool:
    """Upscale a single enemy token. Returns True on success."""
    try:
        result = client.images.edit(
            model="gpt-image-1.5",
            image=open(input_path, "rb"),
            prompt=PROMPT,
            size="1024x1024",
            quality="high",
            input_fidelity="high",
        )

        image_base64 = result.data[0].b64_json
        image_bytes = base64.b64decode(image_base64)

        with open(output_path, "wb") as f:
            f.write(image_bytes)

        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def main():
    api_key = os.environ.get("OPENAI_APIKEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("No OpenAI API key found")
        sys.exit(1)

    client = OpenAI(api_key=api_key)

    input_dir = Path("packages/client/public/assets/enemies")
    output_dir = Path("docs/sprites/enemies_upscaled")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Get all jpg files (exclude backups)
    enemies = sorted([f for f in input_dir.glob("*.jpg") if not f.name.endswith(".bak")])

    print(f"Found {len(enemies)} enemy tokens to upscale")
    print(f"Output directory: {output_dir}")
    print(f"Estimated cost: ~${len(enemies) * 0.05:.2f}")
    print()

    # Check for already processed
    already_done = set(f.stem for f in output_dir.glob("*.png"))
    to_process = [e for e in enemies if e.stem not in already_done]

    if already_done:
        print(f"Skipping {len(already_done)} already processed")

    print(f"Processing {len(to_process)} enemies...")
    print()

    success = 0
    failed = []

    for i, enemy_path in enumerate(to_process, 1):
        output_path = output_dir / f"{enemy_path.stem}.png"
        print(f"[{i}/{len(to_process)}] {enemy_path.name}...", end=" ", flush=True)

        if upscale_enemy(client, enemy_path, output_path):
            print("✓")
            success += 1
        else:
            print("✗")
            failed.append(enemy_path.name)

        # Small delay to avoid rate limits
        time.sleep(0.5)

    print()
    print(f"Done! {success}/{len(to_process)} successful")
    if failed:
        print(f"Failed: {', '.join(failed)}")


if __name__ == "__main__":
    main()
