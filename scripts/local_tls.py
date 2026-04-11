"""
Shared helper: ensure loopback TLS material exists under .mvp-factory-control/tls.

The HTTPS gateway needs a browser-trustable local certificate for both ``localhost`` and ``127.0.0.1``.
Modern browsers are much happier with a real local root CA plus a signed leaf certificate than with a
bare self-signed leaf, so this helper maintains:

- ``localhost-ca-cert.pem`` / ``localhost-ca-key.pem`` for the local CA
- ``localhost-cert.pem`` / ``localhost-key.pem`` for the gateway leaf certificate

Used by the HTTPS gateway and by Python/Node clients that verify ``https://127.0.0.1:<gateway>/...``.
Browser and automation traffic should use those HTTPS URLs—not plain HTTP to Paperclip/Ollama ports.
"""
from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path


def _run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _contains(path: Path, needle: str) -> bool:
    if not path.is_file():
        return False
    try:
        return needle in path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return False


def _looks_like_modern_ca(cert_path: Path) -> bool:
    return _contains(cert_path, "BEGIN CERTIFICATE")


def _looks_like_legacy_leaf(cert_path: Path) -> bool:
    try:
        output = subprocess.check_output(
            ["openssl", "x509", "-in", str(cert_path), "-noout", "-text"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return False

    return "CA:TRUE" not in output and "TLS Web Server Authentication" not in output


def ensure_loopback_certificate(repo_root: str) -> tuple[str, str]:
    cert_dir = Path(repo_root) / ".mvp-factory-control" / "tls"
    cert_dir.mkdir(parents=True, exist_ok=True)
    ca_cert_path = cert_dir / "localhost-ca-cert.pem"
    ca_key_path = cert_dir / "localhost-ca-key.pem"
    cert_path = cert_dir / "localhost-cert.pem"
    key_path = cert_dir / "localhost-key.pem"

    if _looks_like_legacy_leaf(cert_path):
      try:
        cert_path.unlink()
      except OSError:
        pass
      try:
        key_path.unlink()
      except OSError:
        pass

    if not (ca_cert_path.is_file() and ca_key_path.is_file() and _looks_like_modern_ca(ca_cert_path)):
        ca_config = """
[req]
distinguished_name = dn
x509_extensions = v3_ca
prompt = no

[dn]
CN = Checklist Local Root CA

[v3_ca]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
"""
        with tempfile.NamedTemporaryFile("w", delete=False) as config_file:
            config_file.write(ca_config)
            ca_config_path = config_file.name
        try:
            _run([
                "openssl",
                "req",
                "-x509",
                "-newkey",
                "rsa:2048",
                "-nodes",
                "-sha256",
                "-days",
                "3650",
                "-config",
                ca_config_path,
                "-keyout",
                str(ca_key_path),
                "-out",
                str(ca_cert_path),
            ])
        finally:
            try:
                os.unlink(ca_config_path)
            except OSError:
                pass

    if not (cert_path.is_file() and key_path.is_file()):
        leaf_config = """
[req]
distinguished_name = dn
req_extensions = v3_req
prompt = no

[dn]
CN = localhost

[v3_req]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
"""
        with tempfile.NamedTemporaryFile("w", delete=False) as leaf_config_file:
            leaf_config_file.write(leaf_config)
            leaf_config_path = leaf_config_file.name
        csr_path = cert_dir / "localhost.csr.pem"
        serial_path = cert_dir / "localhost-ca-cert.srl"
        try:
            _run([
                "openssl",
                "req",
                "-new",
                "-newkey",
                "rsa:2048",
                "-nodes",
                "-sha256",
                "-config",
                leaf_config_path,
                "-keyout",
                str(key_path),
                "-out",
                str(csr_path),
            ])
            _run([
                "openssl",
                "x509",
                "-req",
                "-in",
                str(csr_path),
                "-CA",
                str(ca_cert_path),
                "-CAkey",
                str(ca_key_path),
                "-CAcreateserial",
                "-out",
                str(cert_path),
                "-days",
                "825",
                "-sha256",
                "-extensions",
                "v3_req",
                "-extfile",
                leaf_config_path,
            ])
        finally:
            for temp_path in (leaf_config_path, csr_path, serial_path):
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass

    os.chmod(ca_key_path, 0o600)
    os.chmod(key_path, 0o600)
    return str(cert_path), str(key_path)
