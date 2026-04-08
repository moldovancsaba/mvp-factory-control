#!/usr/bin/env python3
"""Remove machine line annotations: //> / //>>, JSX {/*> */}, Prisma //> P:, CSS /*> C: ... */."""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
PRISMA_PATH = REPO_ROOT / "apps" / "mvp-factory-control" / "prisma" / "schema.prisma"
CSS_PATH = REPO_ROOT / "apps" / "mvp-factory-control" / "src" / "app" / "globals.css"
PRISMA_PREFIX = "//> P:"


def strip_ts_js() -> None:
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
            out = [ln for ln in lines if not pat.match(ln) and not pat_jsx.match(ln)]
            new_text = "\n".join(out)
            if not new_text.endswith("\n"):
                new_text += "\n"
            if new_text != text:
                path.write_text(new_text, encoding="utf-8")
                print(path.relative_to(REPO_ROOT))


def strip_prisma() -> None:
    if not PRISMA_PATH.is_file():
        return
    text = PRISMA_PATH.read_text(encoding="utf-8")
    lines = text.split("\n")
    out = [ln for ln in lines if not ln.strip().startswith(PRISMA_PREFIX)]
    new_text = "\n".join(out)
    if not new_text.endswith("\n"):
        new_text += "\n"
    if new_text != text:
        PRISMA_PATH.write_text(new_text, encoding="utf-8")
        print(PRISMA_PATH.relative_to(REPO_ROOT))


def strip_css() -> None:
    if not CSS_PATH.is_file():
        return
    text = CSS_PATH.read_text(encoding="utf-8")
    lines = text.split("\n")
    out = [ln for ln in lines if not ln.strip().startswith("/*> C:")]
    new_text = "\n".join(out)
    if not new_text.endswith("\n"):
        new_text += "\n"
    if new_text != text:
        CSS_PATH.write_text(new_text, encoding="utf-8")
        print(CSS_PATH.relative_to(REPO_ROOT))


def main() -> None:
    strip_ts_js()
    strip_prisma()
    strip_css()


if __name__ == "__main__":
    main()
