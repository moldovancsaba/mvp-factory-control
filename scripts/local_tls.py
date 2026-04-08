"""
Shared helper: ensure loopback TLS cert/key exist under .mvp-factory-control/tls (mkcert/openssl fallback).
Used by https-gateway and other local HTTPS services.
"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path


def ensure_loopback_certificate(repo_root: str) -> tuple[str, str]:
    cert_dir = Path(repo_root) / ".mvp-factory-control" / "tls"
    cert_dir.mkdir(parents=True, exist_ok=True)
    cert_path = cert_dir / "localhost-cert.pem"
    key_path = cert_dir / "localhost-key.pem"

    if cert_path.is_file() and key_path.is_file():
        return str(cert_path), str(key_path)

    cmd = [
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-sha256",
        "-days",
        "3650",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:localhost,IP:127.0.0.1",
        "-keyout",
        str(key_path),
        "-out",
        str(cert_path),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.chmod(key_path, 0o600)
    return str(cert_path), str(key_path)
