#!/usr/bin/env python3
"""
Local HTTPS reverse proxy/gateway: terminates TLS with certs from local_tls, forwards to upstream dev servers.
Started by control_mvp/bootstrap for secure localhost development.

**Edge (browsers, scripts, daemons)** MUST use ``https://127.0.0.1:<MVP_HTTPS_GATEWAY_PORT>/...`` and verify
the loopback certificate. **Hop to upstreams** on ``127.0.0.1`` remains plain HTTP because those dev
servers (Paperclip, Ollama, etc.) do not expose TLS; only this gateway terminates TLS on localhost.

HTTP(S) non-upgrade requests use urllib. WebSocket upgrades on ``/dashboard/`` use a raw TCP tunnel to
Paperclip (``127.0.0.1:10006``) so live events work at ``wss://127.0.0.1:<port>/dashboard/...``.
"""
from __future__ import annotations

import errno
import os
import select
import socket
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

# Paperclip is mounted at `/dashboard` upstream; forward the full path (do not strip the prefix).
DASHBOARD_GATEWAY_PREFIX = "/dashboard/"

ROUTES = {
    DASHBOARD_GATEWAY_PREFIX: "http://127.0.0.1:10006",
    "/variables/": "http://127.0.0.1:3199/",
    "/settings/": "http://127.0.0.1:3200/",
    "/connectors/": "http://127.0.0.1:3198/",
    "/checklistsync/": "http://127.0.0.1:10005/",
    "/opencode/": "http://127.0.0.1:18788/",
    "/ollama/": "http://127.0.0.1:11434/",
}

# Vite dev and index.html use root-absolute paths; Paperclip is mounted at /dashboard upstream.
_PAPERCLIP_ROOT_EXACT = frozenset({"/favicon.ico", "/sw.js", "/site.webmanifest"})


def _under_dashboard(path_only: str) -> bool:
    return path_only == "/dashboard" or path_only.startswith("/dashboard/")


def _paperclip_path_with_public_base(path_only: str) -> str:
    if _under_dashboard(path_only):
        return path_only
    if path_only in _PAPERCLIP_ROOT_EXACT:
        return f"/dashboard{path_only}"
    if path_only.startswith("/favicon") or path_only.startswith("/apple-touch-icon"):
        return f"/dashboard{path_only}"
    # Vite dev: HTML under /dashboard/ still references /@…, /src/, etc. at origin root.
    if (
        path_only.startswith("/@")
        or path_only.startswith("/src/")
        or path_only.startswith("/node_modules/")
        or path_only.startswith("/_plugins/")
    ):
        return f"/dashboard{path_only}"
    return path_only

def _is_upstream_connection_refused(exc: BaseException) -> bool:
    if isinstance(exc, urllib.error.URLError) and isinstance(exc.reason, OSError):
        return exc.reason.errno in (errno.ECONNREFUSED, errno.ECONNRESET)
    if isinstance(exc, OSError):
        return exc.errno in (errno.ECONNREFUSED, errno.ECONNRESET)
    return False


def _upstream_unavailable_body(target_url: str, exc: BaseException) -> bytes:
    hint = (
        "Nothing is listening on the upstream port. Start the matching service from the Control menu "
        "(e.g. Paperclip for /dashboard/* on port 10006)."
    )
    text = (
        "502 Bad Gateway — upstream connection refused\n\n"
        f"Attempted: {target_url}\n"
        f"Detail: {exc}\n\n"
        f"{hint}\n"
    )
    return text.encode("utf-8", errors="replace")


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


def _parse_upstream_host_port(target_base: str) -> tuple[str, int]:
    raw = target_base if target_base.startswith("http") else f"http://{target_base}"
    parsed = urllib.parse.urlparse(raw)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    return host, port


def _read_until_header_end(sock: socket.socket, max_size: int = 1_048_576) -> bytes:
    buf = b""
    while b"\r\n\r\n" not in buf:
        chunk = sock.recv(8192)
        if not chunk:
            break
        buf += chunk
        if len(buf) > max_size:
            raise OSError("upstream response headers too large")
    return buf


def _bridge_sockets(client: socket.socket, upstream: socket.socket, pending_upstream: bytes) -> None:
    if pending_upstream:
        try:
            client.sendall(pending_upstream)
        except OSError:
            return
    pairs = (client, upstream)
    while True:
        try:
            readable, _, exceptional = select.select(pairs, [], pairs, 300.0)
        except (ValueError, OSError):
            break
        if exceptional:
            break
        if not readable:
            break
        for src in readable:
            try:
                data = src.recv(65536)
            except OSError:
                return
            if not data:
                return
            dst = upstream if src is client else client
            try:
                dst.sendall(data)
            except OSError:
                return


class GatewayHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _is_websocket_upgrade(self) -> bool:
        upgrade = (self.headers.get("Upgrade") or "").strip().lower()
        if upgrade != "websocket":
            return False
        conn = (self.headers.get("Connection") or "").lower()
        return "upgrade" in conn

    def do_GET(self):
        if self._is_websocket_upgrade():
            path_only, query = self._split_path_and_query()
            path_only = _paperclip_path_with_public_base(path_only)
            prefix, target = self._match_route(path_only)
            if prefix == DASHBOARD_GATEWAY_PREFIX and target:
                if self._proxy_websocket_to_upstream(target, path_only, query):
                    return
            self.send_error(502, "WebSocket is only proxied for /dashboard/ on this gateway")
            return
        self._proxy()

    def do_HEAD(self):
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

    def _build_upstream_ws_request(
        self, upstream_host: str, upstream_port: int, request_target: str
    ) -> bytes:
        # Request line: full path + optional query (e.g. /dashboard/api/.../ws?x=y)
        if not request_target.startswith("/"):
            request_target = "/" + request_target
        lines = [f"GET {request_target} HTTP/1.1", f"Host: {upstream_host}:{upstream_port}"]
        skip = {
            "host",
            "content-length",
            "x-forwarded-proto",
            "x-forwarded-host",
        }
        for key, value in self.headers.items():
            lk = key.lower()
            if lk in skip:
                continue
            if lk in HOP_BY_HOP_HEADERS:
                continue
            lines.append(f"{key}: {value}")
        lines.append("X-Forwarded-Proto: https")
        lines.append(f"X-Forwarded-Host: {self.headers.get('Host', f'127.0.0.1:{PORT}')}")
        lines.append("Connection: Upgrade")
        lines.append("Upgrade: websocket")
        return ("\r\n".join(lines) + "\r\n\r\n").encode("iso-8859-1", errors="replace")

    def _proxy_websocket_to_upstream(self, target: str, path_only: str, query: str) -> bool:
        """
        Complete the WebSocket handshake with upstream and tunnel frames. Returns True if the
        connection was fully handled (caller should not fall back to HTTP proxy).
        """
        self.close_connection = True
        try:
            self.wfile.flush()
        except Exception:
            pass

        upstream_host, upstream_port = _parse_upstream_host_port(target)
        request_target = f"{path_only}?{query}" if query else path_only
        payload = self._build_upstream_ws_request(upstream_host, upstream_port, request_target)
        upstream = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            upstream.settimeout(30)
            upstream.connect((upstream_host, upstream_port))
            upstream.sendall(payload)
            raw = _read_until_header_end(upstream)
            if b"\r\n\r\n" not in raw:
                self.send_error(502, "Upstream closed before WebSocket handshake completed")
                return True
            sep = raw.index(b"\r\n\r\n")
            header_blob = raw[: sep + 4]
            pending = raw[sep + 4 :]
            first_line = header_blob.split(b"\r\n", 1)[0].decode("iso-8859-1", errors="replace")
            parts = first_line.split()
            if len(parts) < 2 or not parts[0].upper().startswith("HTTP/") or parts[1] != "101":
                self.send_error(502, f"Expected 101 Switching Protocols from upstream; got: {first_line[:200]}")
                return True
            client_sock = self.connection
            try:
                client_sock.sendall(header_blob)
            except OSError:
                return True
            _bridge_sockets(client_sock, upstream, pending)
            return True
        except OSError as exc:
            if exc.errno == errno.ECONNREFUSED:
                self.send_error(
                    502,
                    "WebSocket upstream refused (start Paperclip on port 10006 for /dashboard)",
                )
            else:
                msg = str(exc).encode("utf-8", errors="replace")[:500]
                self.send_error(502, f"WebSocket upstream error: {msg.decode()}")
            return True
        finally:
            try:
                upstream.close()
            except Exception:
                pass

    def _proxy(self):
        path_only, query = self._split_path_and_query()
        if path_only == "/" and self.command in ("GET", "HEAD"):
            self.send_response(302)
            self.send_header("Location", "/dashboard/")
            self.end_headers()
            return
        path_only = _paperclip_path_with_public_base(path_only)
        prefix, target = self._match_route(path_only)
        if not prefix or not target:
            self.send_error(404, "Unknown HTTPS gateway route")
            return

        if path_only.startswith(prefix):
            suffix = path_only[len(prefix) :]
        else:
            suffix = ""
        if prefix == DASHBOARD_GATEWAY_PREFIX:
            target_url = urllib.parse.urljoin(f"{target.rstrip('/')}/", path_only)
        else:
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
        except urllib.error.URLError as exc:
            if _is_upstream_connection_refused(exc):
                payload = _upstream_unavailable_body(target_url, exc)
            else:
                payload = str(exc).encode("utf-8", errors="replace")
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
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
