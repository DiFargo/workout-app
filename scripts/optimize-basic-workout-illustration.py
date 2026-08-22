#!/usr/bin/env python3
"""Convert one approved generated exercise image into the catalog WebP format."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Approved generated source image")
    parser.add_argument("--output", required=True, help="New target WebP path")
    args = parser.parse_args()

    source = Path(args.input)
    output = Path(args.output)
    if not source.is_file():
        raise SystemExit(f"Input image does not exist: {source}")
    if output.exists():
        raise SystemExit(f"Refusing to overwrite existing asset: {output}")

    output.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        prepared = image.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
        prepared.save(output, "WEBP", quality=86, method=6)

    print(json.dumps({"output": str(output), "bytes": output.stat().st_size, "width": 512, "height": 512}))


if __name__ == "__main__":
    main()
