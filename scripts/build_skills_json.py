#!/usr/bin/env python3
"""Build assets/skills.json from HYDRA's skills/index.json.

Usage: python scripts/build_skills_json.py path/to/hydra/skills/index.json
"""

import json
import sys
from pathlib import Path

MAX_DESC = 220
SITE = Path(__file__).resolve().parent.parent


def short(text: str) -> str:
    text = " ".join((text or "").split()).strip().strip("'\"`")
    if len(text) <= MAX_DESC:
        return text
    return text[: MAX_DESC - 1].rsplit(" ", 1)[0] + "…"


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    index = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    skills = index["skills"]
    if index["total"] != len(skills):
        raise SystemExit(f"index total {index['total']} != {len(skills)} entries")
    out = {
        "total": len(skills),
        "skills": [
            {
                "name": s["name"],
                "category": s.get("category", "other"),
                "description": short(s.get("description", "")),
            }
            for s in skills
        ],
    }
    dest = SITE / "assets" / "skills.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {dest} ({len(skills)} skills, {dest.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
