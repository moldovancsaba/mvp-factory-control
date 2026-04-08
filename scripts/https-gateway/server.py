#!/usr/bin/env python3
"""
Local HTTPS reverse proxy/gateway: terminates TLS with certs from local_tls, forwards to upstream dev servers.
Started by control_mvp/bootstrap for secure localhost development.
"""
from __future__ import annotations

import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from local_tls import ensure_loopback_certificate

PORT = int(os.environ.get("MVP_HTTPS_GATEWAY_PORT", "3443"))
REPO_ROOT = str(Path(__file__).resolve().parents[2])

ROUTES = {
    "/dashboard/": "http://127.0.0.1:3100/",
    "/variables/": "http://127.0.0.1:3199/",
    "/settings/": "http://127.0.0.1:3200/",
    "/connectors/": "http://127.0.0.1:3198/",
    "/checklistsync/": "http://127.0.0.1:10005/",
    "/opencode/": "http://127.0.0.1:18788/",
    "/ollama/": "http://127.0.0.1:11434/",
}

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
}


class GatewayHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        self._proxy()

    def do_POST(self):
        self._proxy()

    def do_PUT(self):
        self._proxy()

    def do_PATCH(self):
        self._proxy()

    def do_DELETE(self):
        self._proxy()

    def do_OPTIONS(self):
        self._proxy()

    def log_message(self, format, *args):
        return

    def _split_path_and_query(self) -> tuple[str, str]:
        raw = self.path or "/"
        if "?" in raw:
            path_part, query = raw.split("?", 1)
        else:
            path_part, query = raw, ""
        path_part = path_part.strip() or "/"
        if path_part.startswith(("http://", "https://")):
            try:
                parsed = urllib.parse.urlparse(path_part)
                path_part = parsed.path or "/"
                if parsed.query and not query:
                    query = parsed.query
            except Exception:
                pass
        if not path_part.startswith("/"):
            path_part = "/" + path_part
        return path_part, query

    def _match_route(self, path_only: str) -> tuple[str | None, str | None]:
        for prefix, target in ROUTES.items():
            no_slash = prefix[:-1] if prefix.endswith("/") else prefix
            if path_only == no_slash:
                return prefix, target
            if path_only.startswith(prefix):
                return prefix, target
        return None, None

    def _proxy(self):
        path_only, query = self._split_path_and_query()
        prefix, target = self._match_route(path_only)
        if not prefix or not target:
            self.send_error(404, "Unknown HTTPS gateway route")
            return

        if path_only.startswith(prefix):
            suffix = path_only[len(prefix) :]
        else:
            suffix = ""
        target_url = urllib.parse.urljoin(target, suffix)
        if query:
            sep = "&" if "?" in target_url else "?"
            target_url = f"{target_url}{sep}{query}"

        body = b""
        length = self.headers.get("Content-Length")
        if length:
            body = self.rfile.read(int(length))

        headers = {}
        for key, value in self.headers.items():
            if key.lower() in HOP_BY_HOP_HEADERS:
                continue
            headers[key] = value
        headers["X-Forwarded-Proto"] = "https"
        headers["X-Forwarded-Host"] = self.headers.get("Host", f"127.0.0.1:{PORT}")

        request = urllib.request.Request(
            target_url,
            data=body if body else None,
            headers=headers,
            method=self.command,
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as upstream:
                payload = upstream.read()
                self.send_response(upstream.status)
                for key, value in upstream.headers.items():
                    if key.lower() in HOP_BY_HOP_HEADERS:
                        continue
                    self.send_header(key, value)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                if payload:
                    self.wfile.write(payload)
        except urllib.error.HTTPError as exc:
            payload = exc.read()
            self.send_response(exc.code)
            for key, value in exc.headers.items():
                if key.lower() in HOP_BY_HOP_HEADERS:
                    continue
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            if payload:
                self.wfile.write(payload)
        except Exception as exc:
            payload = str(exc).encode("utf-8", errors="replace")
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)


def main() -> None:
    cert_path, key_path = ensure_loopback_certificate(REPO_ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), GatewayHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=cert_path, keyfile=key_path)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    print(f"HTTPS gateway listening on https://127.0.0.1:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
