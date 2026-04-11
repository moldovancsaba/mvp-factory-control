"""
Local health dashboard HTTP server: probes Paperclip/OpenCode (and related) HTTPS endpoints on localhost,
returns JSON/HTML status. Used by Control.app / operator visibility (port PORT).

All service checks go through the MVP HTTPS gateway (TLS to 127.0.0.1); the gateway forwards to plain HTTP upstreams.
"""
import datetime
import http.server
import json
import os
import socket
import socketserver
import sys
from pathlib import Path
from urllib.parse import urlparse

_SCRIPTS_ROOT = Path(__file__).resolve().parent
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))
from local_gateway_client import gateway_https_ok

PORT = 3198
_GW_PORT = os.environ.get("MVP_HTTPS_GATEWAY_PORT", "3443")
REPO_ROOT = str(Path(__file__).resolve().parents[1])
_GW = f"https://127.0.0.1:{_GW_PORT}"
SERVICES = [
    ("Paperclip", f"{_GW}/dashboard/api/health"),
    ("OpenCode", f"{_GW}/opencode/"),
    ("ChecklistSync", f"{_GW}/checklistsync/health"),
    ("Ollama", f"{_GW}/ollama/api/tags"),
]


def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def fetch_url_ok(url):
    if url.startswith("https://"):
        return gateway_https_ok(url, timeout=1.5, repo_root=REPO_ROOT)
    if url.startswith("http://"):
        return False
    return is_port_open(int(urlparse(url).port or 80))


def build_status():
    return {
        "generatedAt": datetime.datetime.now().isoformat(),
        "services": [
            {
                "name": name,
                "url": url,
                "up": fetch_url_ok(url),
            }
            for name, url in SERVICES
        ],
    }


def render_html(status):
    rows = []
    for service in status["services"]:
        emoji = "🟢" if service["up"] else "🔴"
        rows.append(
            f"<li><strong>{emoji} {service['name']}</strong> "
            f"<a href=\"{service['url']}\">{service['url']}</a></li>"
        )
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Agent Connectors</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 24px; background: #111827; color: #f3f4f6; }}
    a {{ color: #93c5fd; }}
    code {{ background: #1f2937; padding: 2px 6px; border-radius: 6px; }}
    .card {{ max-width: 780px; background: #0f172a; border: 1px solid #334155; border-radius: 16px; padding: 20px; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>Agent Connectors</h1>
    <p>Local service status (all checks use <strong>HTTPS</strong> via the gateway at <code>127.0.0.1:{_GW_PORT}</code>).</p>
    <ul>
      {''.join(rows)}
    </ul>
  </div>
</body>
</html>"""


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        status = build_status()
        if self.path in ("/health", "/status.json"):
            payload = json.dumps({"status": "ok", **status}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        body = render_html(status).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] agent-connector: {format % args}")


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    with ReusableTCPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"AgentConnector compatibility server listening on http://127.0.0.1:{PORT} (status UI; probes use HTTPS gateway)")
        httpd.serve_forever()
