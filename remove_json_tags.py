#!/usr/bin/env python3
"""Remove selected keys from a JSON file (in place).

Configure the keys to remove in TAGS_TO_REMOVE.

Example:
  python3 scripts/remove_json_tags.py data/spells/spells-xphb.json
  python3 scripts/remove_json_tags.py data/spells/spells.json --sources "XPHB,DMG"
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

TAGS_TO_REMOVE = [
    "source",
    "ruleType",
    "repeatableHidden",
    "page",
    "srd52",
    "basicRules2024",
    "miscTags",
    "referenceSources",
]


def _remove_keys(
    node: Any,
    tags: set[str],
    allowed_sources: set[str] | None = None,
) -> tuple[Any, int, int]:
    removed_keys = 0
    removed_objects = 0

    if isinstance(node, dict):
        cleaned: dict[str, Any] = {}
        for key, value in node.items():
            if key in tags:
                removed_keys += 1
                continue

            cleaned_value, child_removed_keys, child_removed_objects = _remove_keys(
                value,
                tags,
                allowed_sources=allowed_sources,
            )
            cleaned[key] = cleaned_value
            removed_keys += child_removed_keys
            removed_objects += child_removed_objects

        return cleaned, removed_keys, removed_objects

    if isinstance(node, list):
        cleaned_items: list[Any] = []
        for item in node:
            if (
                allowed_sources is not None
                and isinstance(item, dict)
                and isinstance(item.get("source"), str)
                and item["source"] not in allowed_sources
            ):
                removed_objects += 1
                continue

            cleaned_item, child_removed_keys, child_removed_objects = _remove_keys(
                item,
                tags,
                allowed_sources=allowed_sources,
            )
            cleaned_items.append(cleaned_item)
            removed_keys += child_removed_keys
            removed_objects += child_removed_objects

        return cleaned_items, removed_keys, removed_objects

    return node, removed_keys, removed_objects


def _parse_sources(raw_sources: str | None) -> set[str] | None:
    if raw_sources is None:
        return None

    parsed = {source.strip() for source in raw_sources.split(",") if source.strip()}
    if not parsed:
        raise ValueError("`--sources` no tiene valores validos.")
    return parsed


def main() -> int:
    parser = argparse.ArgumentParser(description="Remove configured keys from JSON objects.")
    parser.add_argument("json_file", type=Path, help="Path to the JSON file")
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="JSON indentation spaces (default: 2)",
    )
    parser.add_argument(
        "--sources",
        "--source",
        dest="sources",
        help=(
            "Lista separada por comas de sources permitidos. "
            "Si se pasa, los objetos en arrays con `source` fuera de esta lista se eliminan."
        ),
    )

    args = parser.parse_args()

    input_path = args.json_file
    data = json.loads(input_path.read_text(encoding="utf-8"))

    tags = {tag.strip() for tag in TAGS_TO_REMOVE if tag.strip()}
    if not tags:
        parser.error("TAGS_TO_REMOVE is empty. Add at least one key to remove.")
    try:
        allowed_sources = _parse_sources(args.sources)
    except ValueError as error:
        parser.error(str(error))

    data, removed_keys_count, removed_objects_count = _remove_keys(
        data,
        tags,
        allowed_sources=allowed_sources,
    )

    output_path = input_path

    output_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=args.indent) + "\n",
        encoding="utf-8",
    )

    print(f"input: {input_path}")
    print(f"output: {output_path}")
    print(f"tags removed: {', '.join(sorted(tags))}")
    print(f"total keys removed: {removed_keys_count}")
    if allowed_sources is None:
        print("source filter: disabled")
    else:
        print(f"source filter: {', '.join(sorted(allowed_sources))}")
        print(f"objects removed by source filter: {removed_objects_count}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
