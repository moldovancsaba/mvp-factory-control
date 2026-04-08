#!/usr/bin/env python3
"""
Insert //> above every annotatable physical line.

- .ts / .js / .mjs: all non-comment, non-blank lines.
- .tsx: annotates module scope and function body EXCEPT lines inside `return (...)` once that
  return contains JSX (`<Tag` / `</` / fragment). TS-only `return ( expr )` without JSX still
  gets per-line //> inside the parens.

TSX `return (...)` JSX trees cannot legally have a full-line // or arbitrary {/* */} between every
line without breaking the expression grammar; those regions are intentionally skipped.

Idempotent. Skips next-env.d.ts.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SKIP_NAMES = frozenset({"next-env.d.ts"})
MARKER = "//> "
REPO_ROOT = Path(__file__).resolve().parents[1]

JSX_START_RE = re.compile(r"^\s*(?:<[A-Za-z/!?]|\{/\*)")


def describe_line(line: str) -> str:
    s = line.strip()
    if not s:
        return "Blank line (vertical spacing)."
    if s.startswith("/*") or s.startswith("/**") or s.startswith("*/"):
        return "Block comment."
    if s.startswith("*"):
        return "Block comment continuation."
    if s.startswith("//") and not s.startswith(MARKER.strip()):
        return "Full-line comment."
    if re.match(r"^['\"`]", s):
        return "String literal line."
    if s in ("{", "}", "};", "},", "});"):
        return "Brace or statement terminator."
    if re.match(r"^[\}\]\)\>;,\.]+$", s):
        return "Delimiter or separator."
    if s.startswith("import "):
        return "Import bindings from a module."
    if s.startswith("export "):
        return "Export declaration."
    if s.startswith("export default"):
        return "Default export."
    if s.startswith("type ") or s.startswith("interface "):
        return "Type or interface definition."
    if s.startswith("enum "):
        return "Enum definition."
    if s.startswith("return "):
        return "Return a value."
    if s in ("return;", "return"):
        return "Return to caller."
    if s.startswith("if ("):
        return "Conditional branch."
    if s.startswith("else if ("):
        return "Else-if branch."
    if re.match(r"^else\s*\{?", s):
        return "Else branch."
    if s.startswith("for ("):
        return "For-loop header."
    if s.startswith("while ("):
        return "While-loop header."
    if s.startswith("switch ("):
        return "Switch statement."
    if s.startswith("case ") or s == "default:":
        return "Switch case."
    if s.startswith("try "):
        return "Try block start."
    if s.startswith("catch "):
        return "Catch handler."
    if s.startswith("finally"):
        return "Finally block."
    if s.startswith("throw "):
        return "Throw error."
    if s.startswith("async function") or re.match(r"^export\s+async\s+function", s):
        return "Async function declaration."
    if re.match(r"^function\s", s):
        return "Function declaration."
    if re.match(r"^const \w+\s*=\s*async\s*\(", s) or re.match(
        r"^const \w+\s*=\s*\(", s
    ):
        return "Const with function or expression."
    if s.startswith("const ") or s.startswith("let ") or s.startswith("var "):
        return "Variable declaration."
    if s.startswith("await "):
        return "Await async value."
    if re.match(r"^<\/?[A-Za-z!]", s) or re.match(r"^<[A-Za-z][A-Za-z0-9]*\s", s):
        return "JSX element."
    if "{/*" in s:
        return "JSX comment."
    if s.startswith('"use client"') or s.startswith("'use client'"):
        return "Next.js client directive."
    if s.startswith('"use server"') or s.startswith("'use server'"):
        return "Next.js server directive."
    if s.startswith("@"):
        return "Decorator."
    if s.startswith("#"):
        return "Private class field."
    return "Source statement or expression."


def strip_old_annotations(lines: list[str]) -> list[str]:
    jsx_re = re.compile(r"^\s*\{\/\*>.*\*\/\}\s*$")
    out: list[str] = []
    for line in lines:
        t = line.strip()
        if t.startswith("//>") or t.startswith("//>>"):
            continue
        if jsx_re.match(line):
            continue
        out.append(line.rstrip("\n"))
    return out


def should_skip_line(raw: str) -> bool:
    if not raw.strip():
        return True
    st = raw.strip()
    if st.startswith("///"):
        return True
    if st.startswith("//") and not st.startswith(MARKER.strip()):
        return True
    if st.startswith("/*") or st.startswith("/**") or st.startswith("*/"):
        return True
    if st.startswith("*"):
        return True
    return False


def update_return_state(
    line: str, in_ret: bool, depth: int, jsx_in_return: bool
) -> tuple[bool, int, bool]:
    o = line.count("(")
    c = line.count(")")
    if not in_ret:
        if re.search(r"\breturn\s*\(", line):
            in_ret = True
            depth = o - c
            jsx_in_return = bool(JSX_START_RE.search(line))
        return in_ret, depth, jsx_in_return
    if JSX_START_RE.search(line):
        jsx_in_return = True
    depth += o - c
    if depth <= 0:
        return False, 0, False
    return in_ret, depth, jsx_in_return


def skip_tsx_return_jsx_block(
    path: Path, in_ret: bool, depth: int, jsx_in_return: bool, raw: str
) -> bool:
    if path.suffix != ".tsx":
        return False
    if not (in_ret and depth > 0):
        return False
    # First JSX line must be skipped before jsx_in_return flips true; then skip rest of JSX region.
    return bool(JSX_START_RE.search(raw)) or jsx_in_return


def process_file(path: Path, dry_run: bool) -> tuple[int, int]:
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    body_lines = strip_old_annotations(lines)
    out: list[str] = []
    inserted = 0
    in_ret = False
    depth = 0
    jsx_in_return = False

    for line in body_lines:
        raw = line

        skip_tsx_jsx = skip_tsx_return_jsx_block(path, in_ret, depth, jsx_in_return, raw)

        if should_skip_line(raw):
            out.append(raw)
            in_ret, depth, jsx_in_return = update_return_state(raw, in_ret, depth, jsx_in_return)
            continue

        if skip_tsx_jsx:
            out.append(raw)
            in_ret, depth, jsx_in_return = update_return_state(raw, in_ret, depth, jsx_in_return)
            continue

        desc = describe_line(raw)
        indent = raw[: len(raw) - len(raw.lstrip())]
        out.append(f"{indent}{MARKER}{desc}")
        out.append(raw)
        inserted += 1
        in_ret, depth, jsx_in_return = update_return_state(raw, in_ret, depth, jsx_in_return)

    new_text = "\n".join(out)
    if not new_text.endswith("\n"):
        new_text += "\n"
    if new_text != text and not dry_run:
        path.write_text(new_text, encoding="utf-8")
    return inserted, len(body_lines)


def main() -> None:
    dry = "--dry-run" in sys.argv
    roots = [
        REPO_ROOT / "apps" / "mvp-factory-control" / "src",
        REPO_ROOT / "apps" / "mvp-factory-control" / "scripts",
    ]
    total_ins = 0
    files = 0
    for root in roots:
        if not root.exists():
            continue
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            if path.name in SKIP_NAMES:
                continue
            if path.suffix not in {".ts", ".tsx", ".js", ".mjs"}:
                continue
            ins, _ = process_file(path, dry)
            if ins:
                files += 1
                total_ins += ins
                print(f"{path.relative_to(REPO_ROOT)}: +{ins} annotations")
    print(f"Done. Files touched: {files}, annotations: {total_ins}, dry_run={dry}")


if __name__ == "__main__":
    main()
