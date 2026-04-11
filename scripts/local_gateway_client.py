"""
HTTPS client helpers for the local MVP Factory gateway (https://127.0.0.1:<port>/...).

Uses the loopback certificate from ``LOCAL_TLS_CERT_PATH`` or
``.mvp-factory-control/tls/localhost-cert.pem`` under ``repo_root``.
Browser-facing traffic should use these URLs; the gateway still speaks plain HTTP to upstreams on 127.0.0.1.
"""
from __future__ import annotations

import os
import ssl
import urllib.error
import urllib.request
from pathlib import Path


def resolve_ca_cert_file(*, repo_root: str | Path | None = None) -> str | None:
    env = os.environ.get("LOCAL_TLS_CERT_PATH", "").strip()
    if env and os.path.isfile(env):
        return env
    if repo_root is not None:
        candidate = Path(repo_root) / ".mvp-factory-control" / "tls" / "localhost-cert.pem"
        if candidate.is_file():
            return str(candidate)
    return None


def ssl_context_for_gateway(*, repo_root: str | Path | None = None) -> ssl.SSLContext:
    ca = resolve_ca_cert_file(repo_root=repo_root)
    if not ca:
        raise FileNotFoundError(
            "Missing TLS CA file: set LOCAL_TLS_CERT_PATH or ensure .mvp-factory-control/tls/localhost-cert.pem exists "
            "(start the HTTPS gateway or run openssl/local_tls once)."
        )
    return ssl.create_default_context(cafile=ca)


def gateway_https_ok(
    url: str,
    timeout: float = 1.5,
    *,
    repo_root: str | Path | None = None,
) -> bool:
    if not url.startswith("https://"):
        return False
    try:
        ctx = ssl_context_for_gateway(repo_root=repo_root)
        with urllib.request.urlopen(url, timeout=timeout, context=ctx) as response:
            return 200 <= response.status < 400
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, FileNotFoundError):
        return False


def gateway_urlopen(
    url: str,
    timeout: float = 5.0,
    *,
    repo_root: str | Path | None = None,
):
    if not url.startswith("https://"):
        raise ValueError("gateway_urlopen expects an https:// URL")
    ctx = ssl_context_for_gateway(repo_root=repo_root)
    return urllib.request.urlopen(url, timeout=timeout, context=ctx)
