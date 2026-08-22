#!/usr/bin/env python3
"""Split a generated 2×2 exercise-illustration sheet into four WebP assets.

This is build tooling only. It deliberately refuses to overwrite a completed
asset, so a failed or regenerated sheet cannot silently replace approved work.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from PIL import Image


SAFE_SOURCE_ID = re.compile(r"^[A-Za-z0-9_-]+$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Generated 2×2 sheet image")
    parser.add_argument(
        "--output-dir",
        default="public/basic-workout/exercises/catalogue/v1",
        help="Destination asset directory",
    )
    parser.add_argument(
        "source_ids",
        nargs=4,
        metavar="SOURCE_ID",
        help="Four source IDs in row-major order: top-left, top-right, bottom-left, bottom-right",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_ids = args.source_ids
    if len(set(source_ids)) != 4:
        raise SystemExit("All four source IDs must be unique.")
    for source_id in source_ids:
        if not SAFE_SOURCE_ID.fullmatch(source_id):
            raise SystemExit(f"Unsafe source ID: {source_id}")

    output_dir = Path(args.output_dir)
    targets = [output_dir / f"{source_id}.webp" for source_id in source_ids]
    existing = [str(target) for target in targets if target.exists()]
    if existing:
        raise SystemExit(f"Refusing to overwrite existing asset(s): {', '.join(existing)}")

    with Image.open(args.input) as source:
        image = source.convert("RGB")
        half_width = image.width // 2
        half_height = image.height // 2
        if half_width < 256 or half_height < 256:
            raise SystemExit("Sheet is too small to contain four useful exercise illustrations.")

        output_dir.mkdir(parents=True, exist_ok=True)
        generated = []
        for index, target in enumerate(targets):
            column = index % 2
            row = index // 2
            tile = image.crop((
                column * half_width,
                row * half_height,
                (column + 1) * half_width,
                (row + 1) * half_height,
            ))
            tile = tile.resize((512, 512), Image.Resampling.LANCZOS)
            tile.save(target, "WEBP", quality=86, method=6)
            generated.append({"sourceId": source_ids[index], "file": str(target), "bytes": target.stat().st_size})

    print(json.dumps({"generated": generated}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
