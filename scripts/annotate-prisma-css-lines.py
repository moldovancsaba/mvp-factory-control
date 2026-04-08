#!/usr/bin/env python3
"""
Insert a full-line comment above every physical non-blank line in schema.prisma and globals.css.
Idempotent: strips lines matching ^//> P: or ^/*> C: prefixes then re-applies.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PRISMA = REPO / "apps" / "mvp-factory-control" / "prisma" / "schema.prisma"
CSS = REPO / "apps" / "mvp-factory-control" / "src" / "app" / "globals.css"
PRISMA_PREFIX = "//> P: "
CSS_PREFIX = "/*> C: "


def strip_prisma(lines: list[str]) -> list[str]:
    out = []
    for ln in lines:
        if ln.strip().startswith(PRISMA_PREFIX.strip()):
            continue
        out.append(ln.rstrip("\n"))
    return out


def strip_css(lines: list[str]) -> list[str]:
    out = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.strip().startswith("/*> C:"):
            i += 1
            continue
        out.append(ln.rstrip("\n"))
        i += 1
    return out


def describe_prisma(line: str) -> str:
    s = line.strip()
    if not s:
        return "Blank."
    if s.startswith("//"):
        return "Prisma comment."
    if s.startswith("model "):
        return "Data model definition."
    if s.startswith("enum "):
        return "Enum definition."
    if s.startswith("generator ") or s.startswith("datasource "):
        return "Prisma config block header."
    if s in ("{", "}"):
        return "Block delimiter."
    if s.startswith("@@") or s.startswith("@"):
        return "Prisma attribute."
    return "Schema field or clause."


def describe_css(line: str) -> str:
    s = line.strip()
    if not s:
        return "Blank."
    if s.startswith("/*") or s.startswith("*") or s.startswith("*/"):
        return "CSS comment."
    if s.startswith("@import"):
        return "Import directive."
    if s.startswith("@") and not s.startswith("@apply"):
        return "At-rule."
    if s.startswith(":") or s.startswith("::"):
        return "Pseudo selector."
    if "{" in s:
        return "Rule set opening."
    if s == "}":
        return "Rule set end."
    if ":" in s and not s.startswith("//"):
        return "Declaration or selector fragment."
    return "CSS source line."


def process_prisma() -> None:
    text = PRISMA.read_text(encoding="utf-8")
    lines = text.split("\n")
    body = strip_prisma(lines)
    out: list[str] = []
    for ln in body:
        if not ln.strip() or ln.strip().startswith("//"):
            out.append(ln)
            continue
        indent = ln[: len(ln) - len(ln.lstrip())]
        out.append(f"{indent}{PRISMA_PREFIX}{describe_prisma(ln)}")
        out.append(ln)
    PRISMA.write_text("\n".join(out) + "\n", encoding="utf-8")


def process_css() -> None:
    text = CSS.read_text(encoding="utf-8")
    lines = text.split("\n")
    body = strip_css(lines)
    out: list[str] = []
    for ln in body:
        st = ln.strip()
        if not st:
            out.append(ln)
            continue
        if st.startswith("/*") and not st.startswith("/*> C:"):
            out.append(ln)
            continue
        if st.startswith("*") or st.startswith("*/"):
            out.append(ln)
            continue
        indent = ln[: len(ln) - len(ln.lstrip())]
        out.append(f"{indent}{CSS_PREFIX}{describe_css(ln)} */")
        out.append(ln)
    CSS.write_text("\n".join(out) + "\n", encoding="utf-8")


def main() -> None:
    process_prisma()
    process_css()
    print("Annotated schema.prisma and globals.css")


if __name__ == "__main__":
    main()
