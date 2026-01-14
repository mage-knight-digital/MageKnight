#!/usr/bin/env python3
"""
AI Upscale images using OpenAI's gpt-image-1 model.
Usage: python scripts/upscale_image.py <input_image> [output_image]
"""

import base64
import os
import sys
from pathlib import Path

from openai import OpenAI


def upscale_image(input_path: str, output_path: str | None = None) -> str:
    """Upscale an image using OpenAI's image generation."""

    # Use OPENAI_APIKEY env var (your naming)
    api_key = os.environ.get("OPENAI_APIKEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("No OpenAI API key found in OPENAI_APIKEY or OPENAI_API_KEY")

    client = OpenAI(api_key=api_key)

    input_file = Path(input_path)
    if not input_file.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # Default output path
    if output_path is None:
        output_path = str(input_file.parent / f"{input_file.stem}_upscaled.png")

    print(f"Upscaling: {input_path}")
    print(f"Output: {output_path}")

    # Read the input image
    with open(input_path, "rb") as f:
        image_data = f.read()

    # Use gpt-image-1 for true AI upscaling/enhancement
    # input_fidelity="high" preserves symbols, logos, text
    # quality="high" for dense layouts and in-image text
    result = client.images.edit(
        model="gpt-image-1.5",
        image=open(input_path, "rb"),
        prompt="""Edit the provided image.

Goal:
Upscale and clean the existing circular game token.

Hard constraints (must follow exactly):
- Preserve the original artwork exactly.
- Same demon pose, symbols, numbers, layout, colors, and textures.
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
- crop the token""",
        size="1024x1024",
        quality="high",
        input_fidelity="high",
    )

    # Decode and save
    image_base64 = result.data[0].b64_json
    image_bytes = base64.b64decode(image_base64)

    with open(output_path, "wb") as f:
        f.write(image_bytes)

    print(f"Done! Saved to: {output_path}")
    return output_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/upscale_image.py <input_image> [output_image]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        upscale_image(input_path, output_path)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
