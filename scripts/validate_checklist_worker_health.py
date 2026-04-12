#!/usr/bin/env python3
"""
Fetch or load a Checklist worker /health payload and validate minimum JSON shape.

Examples::

  python3 scripts/validate_checklist_worker_health.py --fixture scripts/fixtures/checklist_health_legacy_ok.json
  python3 scripts/validate_checklist_worker_health.py --fixture scripts/fixtures/checklist_health_full_ok.json --strict-extended

  CHECKLIST_HEALTH_URL=https://127.0.0.1:3443/checklistsync/health \\
    CHECKLIST_TLS_CA=.mvp-factory-control/tls/localhost-cert.pem \\
    python3 scripts/validate_checklist_worker_health.py --url "$CHECKLIST_HEALTH_URL" --cacert "$CHECKLIST_TLS_CA"

  python3 scripts/validate_checklist_worker_health.py --url http://127.0.0.1:10005/health
"""
from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from checklist_control_defaults import checklist_health_shape_errors


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _fetch(url: str, cacert: str | None, timeout: float) -> Any:
    if url.startswith("https://"):
        if not cacert:
            print("error: --cacert is required for https URLs (use .mvp-factory-control/tls/localhost-cert.pem)", file=sys.stderr)
            sys.exit(2)
        ca = Path(cacert).expanduser().resolve()
        if not ca.is_file():
            print(f"error: CA file not found: {ca}", file=sys.stderr)
            sys.exit(2)
        ctx = ssl.create_default_context(cafile=str(ca))
        with urllib.request.urlopen(url, context=ctx, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate Checklist worker /health JSON shape.")
    parser.add_argument("--fixture", type=Path, help="Path to JSON file instead of HTTP fetch")
    parser.add_argument("--url", help="Health URL (default: env CHECKLIST_HEALTH_URL)")
    parser.add_argument("--cacert", help="CA bundle for https (default: env CHECKLIST_TLS_CA or repo tls path)")
    parser.add_argument("--strict-extended", action="store_true", help="Require full extended settings keys")
    parser.add_argument("--timeout", type=float, default=15.0)
    args = parser.parse_args()

    if args.fixture:
        data = _load_json(args.fixture)
    else:
        url = args.url or os.environ.get("CHECKLIST_HEALTH_URL", "").strip()
        if not url:
            print("error: pass --url or CHECKLIST_HEALTH_URL, or --fixture", file=sys.stderr)
            sys.exit(2)
        cacert = args.cacert or os.environ.get("CHECKLIST_TLS_CA", "").strip()
        if not cacert and url.startswith("https://"):
            repo_root = _SCRIPTS.parent
            default_ca = repo_root / ".mvp-factory-control" / "tls" / "localhost-cert.pem"
            if default_ca.is_file():
                cacert = str(default_ca)
        try:
            data = _fetch(url, cacert or None, args.timeout)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError, json.JSONDecodeError) as exc:
            print(f"error: fetch failed: {exc}", file=sys.stderr)
            sys.exit(1)

    errors = checklist_health_shape_errors(data, strict_extended=args.strict_extended)
    if errors:
        for line in errors:
            print(line, file=sys.stderr)
        sys.exit(1)
    mode = "strict extended" if args.strict_extended else "legacy"
    print(f"OK ({mode} shape)")


if __name__ == "__main__":
    main()
