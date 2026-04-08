#!/usr/bin/env python3
"""Remove lines that are only whitespace + //> or //>> annotations."""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    roots = [
        REPO_ROOT / "apps" / "mvp-factory-control" / "src",
        REPO_ROOT / "apps" / "mvp-factory-control" / "scripts",
    ]
    pat = re.compile(r"^\s*//>.*$|^\s*//>>.*$")
    pat_jsx = re.compile(r"^\s*\{\/\*>.*\*\/\}\s*$")
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix not in {".ts", ".tsx", ".js", ".mjs"}:
                continue
            text = path.read_text(encoding="utf-8")
            lines = text.split("\n")
            out = [
                ln
                for ln in lines
                if not pat.match(ln) and not pat_jsx.match(ln)
            ]
            new_text = "\n".join(out)
            if not new_text.endswith("\n"):
                new_text += "\n"
            if new_text != text:
                path.write_text(new_text, encoding="utf-8")
                print(path.relative_to(REPO_ROOT))


if __name__ == "__main__":
    main()
