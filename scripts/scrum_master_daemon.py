"""
Background poller: hits Paperclip health URL on an interval, writes status file for Control.app / panels.
Configurable via SCRUM_MASTER_* env vars.
"""
import datetime
import json
import os
import ssl
import time
import urllib.request


PAPERCLIP_HEALTH_URL = os.environ.get(
    "SCRUM_MASTER_PAPERCLIP_HEALTH_URL",
    "https://127.0.0.1:3443/dashboard/api/health",
)
LOCAL_TLS_CERT_PATH = os.environ.get("LOCAL_TLS_CERT_PATH", "")
CHECK_INTERVAL = int(os.environ.get("SCRUM_MASTER_INTERVAL_SEC", "30"))
STATUS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    ".mvp-factory-control",
    "scrum-master-status.json",
)


def build_ssl_context():
    if not PAPERCLIP_HEALTH_URL.startswith("https://"):
        return None
    if LOCAL_TLS_CERT_PATH and os.path.isfile(LOCAL_TLS_CERT_PATH):
        return ssl.create_default_context(cafile=LOCAL_TLS_CERT_PATH)
    raise RuntimeError("LOCAL_TLS_CERT_PATH missing for HTTPS Paperclip health checks")


def fetch_health():
    try:
        with urllib.request.urlopen(
            PAPERCLIP_HEALTH_URL,
            timeout=5,
            context=build_ssl_context(),
        ) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


def write_status(payload):
    os.makedirs(os.path.dirname(STATUS_PATH), exist_ok=True)
    with open(STATUS_PATH, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


if __name__ == "__main__":
    print("ScrumMaster compatibility daemon started")
    while True:
        snapshot = {
            "updatedAt": datetime.datetime.now().isoformat(),
            "paperclipHealth": fetch_health(),
        }
        write_status(snapshot)
        print(f"ScrumMaster heartbeat: {snapshot['paperclipHealth'].get('status', 'unknown')}")
        time.sleep(CHECK_INTERVAL)
