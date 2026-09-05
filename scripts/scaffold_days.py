#!/usr/bin/env python3
"""Scaffold empty day files 001–100 without overwriting reviewed fichas."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DAYS = ROOT / "catalog" / "days"

TEMPLATE = """\
id: "{sid}"
day: {day}
variant: null
slug: "{sid}"
source_review: empty
copy_policy: link_only
date_utc: null
style:
  name: null
  prompt_published: null
logline: null
creator_notes: null
tools: []
inspiration: []
thread: []
curator:
  style_family: null
  notes: null
"""


def main() -> None:
    DAYS.mkdir(parents=True, exist_ok=True)
    created = 0
    skipped = 0
    for day in range(1, 101):
        sid = f"{day:03d}"
        path = DAYS / f"{sid}.yml"
        variants = list(DAYS.glob(f"{sid}*.yml"))
        if path.exists() or variants:
            skipped += 1
            continue
        path.write_text(TEMPLATE.format(sid=sid, day=day), encoding="utf-8")
        created += 1
    print(f"created={created} skipped={skipped}")


if __name__ == "__main__":
    main()
