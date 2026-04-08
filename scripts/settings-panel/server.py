#!/usr/bin/env python3
"""
Local Settings panel for MVP Factory Control.
Serves a browser UI on 127.0.0.1 for control settings and support links.
"""
from __future__ import annotations

import json
import os
import socket
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

PORT = int(os.environ.get("MVP_SETTINGS_PANEL_PORT", "3200"))
_GATEWAY_PORT = os.environ.get("MVP_HTTPS_GATEWAY_PORT", "3443")
REPO_ROOT = Path(__file__).resolve().parents[2]
STATE_DIR = REPO_ROOT / ".mvp-factory-control"
APP_SETTINGS_PATH = STATE_DIR / "settings.json"
CONTROL_SETTINGS_PATH = STATE_DIR / "control-panel-settings.json"
STATIC_DIR = Path(__file__).resolve().parent / "static"
DEFAULT_LOCAL_PROJECT_FOLDER = os.environ.get(
    "MVP_FACTORY_CONTROL_LOCAL_PROJECT_ROOT", "/Users/moldovancsaba/Projects"
)
DEFAULT_SHARED_ROOT = os.environ.get(
    "MVP_FACTORY_SHARED_ROOT", str(REPO_ROOT.parent)
)

app = FastAPI(title="MVP Factory Settings Panel")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1",
        f"http://127.0.0.1:{PORT}",
        "http://localhost",
        f"http://localhost:{PORT}",
        f"https://127.0.0.1:{_GATEWAY_PORT}",
        f"https://localhost:{_GATEWAY_PORT}",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SettingsSaveRequest(BaseModel):
    localProjectFolder: str = Field(..., min_length=1)
    sharedRoot: str = Field(..., min_length=1)
    paperclipRoot: str = Field(..., min_length=1)
    checklistRoot: str = Field(..., min_length=1)
    checklistEnvPath: str = Field(..., min_length=1)


def ensure_state_dir() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)


def read_json(path: Path, default: dict[str, Any]) -> dict[str, Any]:
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def write_json(path: Path, payload: dict[str, Any]) -> None:
    ensure_state_dir()
    path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def normalize_path(value: str) -> str:
    return str(Path(value).expanduser().resolve())


def default_app_settings() -> dict[str, Any]:
    return {
        "localProjectFolder": DEFAULT_LOCAL_PROJECT_FOLDER,
        "agents": [],
        "projects": [],
        "tasteRubric": None,
        "updatedAt": datetime.fromtimestamp(0, timezone.utc).isoformat(),
    }


def default_control_settings() -> dict[str, str]:
    shared_root = normalize_path(DEFAULT_SHARED_ROOT)
    return {
        "sharedRoot": shared_root,
        "paperclipRoot": normalize_path(os.path.join(shared_root, "paperclip")),
        "checklistRoot": normalize_path(os.path.join(shared_root, "checklist")),
        "checklistEnvPath": normalize_path(os.path.join(shared_root, "checklist", ".env")),
    }


def load_app_settings() -> dict[str, Any]:
    settings = default_app_settings()
    settings.update(read_json(APP_SETTINGS_PATH, {}))
    local_project_folder = str(settings.get("localProjectFolder", "")).strip()
    settings["localProjectFolder"] = (
        normalize_path(local_project_folder)
        if local_project_folder
        else DEFAULT_LOCAL_PROJECT_FOLDER
    )
    return settings


def load_control_settings() -> dict[str, str]:
    settings = default_control_settings()
    raw = read_json(CONTROL_SETTINGS_PATH, {})
    for key in settings:
        value = str(raw.get(key, "")).strip()
        if value:
            settings[key] = normalize_path(value)
    return settings


def build_repo_status(name: str, root_path: str, env_path: str | None = None) -> dict[str, Any]:
    root = Path(root_path)
    env_file = Path(env_path).expanduser() if env_path else None
    return {
        "name": name,
        "rootPath": str(root),
        "exists": root.exists(),
        "envPath": str(env_file) if env_file else None,
        "envExists": env_file.is_file() if env_file else False,
    }


def port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.75)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def http_ok(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=1.5) as response:
            return 200 <= response.status < 400
    except (urllib.error.URLError, TimeoutError, ValueError):
        return False


def build_support_tools() -> list[dict[str, Any]]:
    gw = f"https://127.0.0.1:{_GATEWAY_PORT}"
    tools = [
        {
            "name": "Dashboard",
            "url": "http://127.0.0.1:3100/",
            "description": "Paperclip UI (HTTP — root /api/*; daemons use TLS via gateway /dashboard/api/*)",
            "healthy": http_ok("http://127.0.0.1:3100/api/health"),
        },
        {
            "name": "Environment Variables",
            "url": f"{gw}/variables/",
            "description": "Local env editor (HTTPS gateway; resolves /variables/api/* correctly)",
            "healthy": http_ok("http://127.0.0.1:3199/api/health"),
        },
        {
            "name": "Agent Connector",
            "url": f"{gw}/connectors/",
            "description": "Agent connector status and local endpoints",
            "healthy": http_ok("http://127.0.0.1:3198/health"),
        },
        {
            "name": "ChecklistSync",
            "url": f"{gw}/checklistsync/",
            "description": "Checklist local AI sync health",
            "healthy": http_ok("http://127.0.0.1:10005/health"),
        },
        {
            "name": "OpenCode",
            "url": f"{gw}/opencode/",
            "description": "Local coding service endpoint",
            "healthy": port_open(18788),
        },
    ]
    return tools


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/settings")
def get_settings() -> dict[str, Any]:
    app_settings = load_app_settings()
    control_settings = load_control_settings()
    repos = [
        build_repo_status("mvp-factory-control", str(REPO_ROOT)),
        build_repo_status("paperclip", control_settings["paperclipRoot"]),
        build_repo_status(
            "checklist",
            control_settings["checklistRoot"],
            control_settings["checklistEnvPath"],
        ),
    ]
    return {
        "general": {
            "localProjectFolder": app_settings["localProjectFolder"],
            "updatedAt": app_settings.get("updatedAt"),
        },
        "control": control_settings,
        "repos": repos,
        "supportTools": build_support_tools(),
    }


@app.put("/api/settings")
def save_settings(body: SettingsSaveRequest) -> dict[str, Any]:
    ensure_state_dir()

    app_settings = load_app_settings()
    app_settings["localProjectFolder"] = normalize_path(body.localProjectFolder)
    app_settings["updatedAt"] = datetime.now(timezone.utc).isoformat()
    write_json(APP_SETTINGS_PATH, app_settings)

    control_settings = {
        "sharedRoot": normalize_path(body.sharedRoot),
        "paperclipRoot": normalize_path(body.paperclipRoot),
        "checklistRoot": normalize_path(body.checklistRoot),
        "checklistEnvPath": normalize_path(body.checklistEnvPath),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    write_json(CONTROL_SETTINGS_PATH, control_settings)

    return {"status": "ok", "requiresRestart": True}


@app.get("/")
def index() -> FileResponse:
    html = STATIC_DIR / "index.html"
    if not html.is_file():
        raise HTTPException(status_code=500, detail="Missing static/index.html")
    return FileResponse(html)


def main() -> None:
    import uvicorn

    ensure_state_dir()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")


if __name__ == "__main__":
    main()
