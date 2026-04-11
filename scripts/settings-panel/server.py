#!/usr/bin/env python3
"""
Local Settings panel for MVP Factory Control.
Serves a browser UI on 127.0.0.1 for control settings and support links.
"""
from __future__ import annotations

import json
import os
import socket
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))
from local_gateway_client import gateway_https_ok

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
        f"https://127.0.0.1:{_GATEWAY_PORT}",
        f"https://localhost:{_GATEWAY_PORT}",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def default_solutions_flags() -> dict[str, bool]:
    return {
        "paperclip": True,
        "openCode": True,
        "ollama": True,
        "scrumMaster": True,
        "agentConnector": True,
        "checklistSync": True,
    }


class SettingsSaveRequest(BaseModel):
    localProjectFolder: str = Field(..., min_length=1)
    sharedRoot: str = Field(..., min_length=1)
    paperclipRoot: str = Field(..., min_length=1)
    checklistRoot: str = Field(..., min_length=1)
    checklistEnvPath: str = Field(..., min_length=1)
    checklistPollIntervalSeconds: int = Field(7200, ge=30, le=172800)
    checklistFlashcardRevisitMinutes: int = Field(0, ge=0, le=1440)
    checklistFlashcardRevisitBatchSize: int = Field(1, ge=1, le=100)
    checklistTaskRevisitMinutes: int = Field(0, ge=0, le=1440)
    checklistTaskRevisitBatchSize: int = Field(1, ge=1, le=100)
    checklistFeedbackReplayMinutes: int = Field(0, ge=0, le=1440)
    checklistFeedbackReplayBatchSize: int = Field(1, ge=1, le=100)
    checklistHashtagMaintenanceHours: int = Field(0, ge=0, le=720)
    checklistHashtagMaintenanceBatchSize: int = Field(1, ge=1, le=100)
    checklistCleanupHours: int = Field(0, ge=0, le=720)
    checklistCleanupBatchSize: int = Field(1, ge=1, le=250)
    checklistOllamaTimeoutMs: int = Field(120000, ge=5000, le=600000)
    checklistTaskMinIce: int = Field(100, ge=0, le=1000)
    checklistFlashcardMinConfidence: int = Field(60, ge=1, le=100)
    checklistFlashcardMinImpact: int = Field(40, ge=1, le=100)
    checklistFlashcardMinWeight: int = Field(40, ge=1, le=100)
    solutions: dict[str, bool] = Field(default_factory=dict)


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


def default_control_settings() -> dict[str, Any]:
    shared_root = normalize_path(DEFAULT_SHARED_ROOT)
    return {
        "sharedRoot": shared_root,
        "paperclipRoot": normalize_path(os.path.join(shared_root, "paperclip")),
        "checklistRoot": normalize_path(os.path.join(shared_root, "checklist")),
        "checklistEnvPath": normalize_path(os.path.join(shared_root, "checklist", ".env")),
        "checklistPollIntervalSeconds": 7200,
        "checklistFlashcardRevisitMinutes": 0,
        "checklistFlashcardRevisitBatchSize": 1,
        "checklistTaskRevisitMinutes": 0,
        "checklistTaskRevisitBatchSize": 1,
        "checklistFeedbackReplayMinutes": 0,
        "checklistFeedbackReplayBatchSize": 1,
        "checklistHashtagMaintenanceHours": 0,
        "checklistHashtagMaintenanceBatchSize": 1,
        "checklistCleanupHours": 0,
        "checklistCleanupBatchSize": 1,
        "checklistOllamaTimeoutMs": 120000,
        "checklistTaskMinIce": 100,
        "checklistFlashcardMinConfidence": 60,
        "checklistFlashcardMinImpact": 40,
        "checklistFlashcardMinWeight": 40,
        "solutions": default_solutions_flags(),
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


_PATH_KEYS = frozenset(
    {"sharedRoot", "paperclipRoot", "checklistRoot", "checklistEnvPath"}
)


def load_control_settings() -> dict[str, Any]:
    settings = default_control_settings()
    raw = read_json(CONTROL_SETTINGS_PATH, {})
    for key in _PATH_KEYS:
        value = str(raw.get(key, "")).strip()
        if value:
            settings[key] = normalize_path(value)
    numeric_settings = {
        "checklistPollIntervalSeconds": (30, 172800),
        "checklistFlashcardRevisitMinutes": (0, 1440),
        "checklistFlashcardRevisitBatchSize": (1, 100),
        "checklistTaskRevisitMinutes": (0, 1440),
        "checklistTaskRevisitBatchSize": (1, 100),
        "checklistFeedbackReplayMinutes": (0, 1440),
        "checklistFeedbackReplayBatchSize": (1, 100),
        "checklistHashtagMaintenanceHours": (0, 720),
        "checklistHashtagMaintenanceBatchSize": (1, 100),
        "checklistCleanupHours": (0, 720),
        "checklistCleanupBatchSize": (1, 250),
        "checklistOllamaTimeoutMs": (5000, 600000),
        "checklistTaskMinIce": (0, 1000),
        "checklistFlashcardMinConfidence": (1, 100),
        "checklistFlashcardMinImpact": (1, 100),
        "checklistFlashcardMinWeight": (1, 100),
    }
    for key, (min_value, max_value) in numeric_settings.items():
        value = raw.get(key)
        if isinstance(value, int) and min_value <= value <= max_value:
            settings[key] = value
    solutions = default_solutions_flags()
    sol_raw = raw.get("solutions")
    if isinstance(sol_raw, dict):
        for k in solutions:
            if k in sol_raw and isinstance(sol_raw[k], bool):
                solutions[k] = sol_raw[k]
    settings["solutions"] = solutions
    return settings


def merge_solutions_from_request(
    body: SettingsSaveRequest, current: dict[str, bool]
) -> dict[str, bool]:
    merged = dict(current)
    allowed = frozenset(default_solutions_flags().keys())
    for key, value in body.solutions.items():
        if key in allowed and isinstance(value, bool):
            merged[key] = value
    return merged


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


def build_support_tools(solutions: dict[str, bool] | None = None) -> list[dict[str, Any]]:
    gw = f"https://127.0.0.1:{_GATEWAY_PORT}"
    repo = str(REPO_ROOT)
    sol = solutions if solutions is not None else default_solutions_flags()
    tools = [
        {
            "name": "Dashboard",
            "url": f"{gw}/dashboard/",
            "description": "Paperclip UI (HTTPS gateway; dev server uses PAPERCLIP_PUBLIC_BASE_PATH=/dashboard)",
            "healthy": gateway_https_ok(f"{gw}/dashboard/api/health", repo_root=repo),
            "solutionKey": "paperclip",
            "enabled": sol.get("paperclip", True),
        },
        {
            "name": "Environment Variables",
            "url": f"{gw}/variables/",
            "description": "Local env editor (HTTPS gateway; resolves /variables/api/* correctly)",
            "healthy": gateway_https_ok(f"{gw}/variables/api/health", repo_root=repo),
            "solutionKey": None,
            "enabled": True,
        },
        {
            "name": "Agent Connector",
            "url": f"{gw}/connectors/",
            "description": "Agent connector status and local endpoints",
            "healthy": gateway_https_ok(f"{gw}/connectors/health", repo_root=repo),
            "solutionKey": "agentConnector",
            "enabled": sol.get("agentConnector", True),
        },
        {
            "name": "ChecklistSync",
            "url": f"{gw}/checklistsync/",
            "description": "Checklist local AI sync health",
            "healthy": gateway_https_ok(f"{gw}/checklistsync/health", repo_root=repo),
            "solutionKey": "checklistSync",
            "enabled": sol.get("checklistSync", True),
        },
        {
            "name": "OpenCode",
            "url": f"{gw}/opencode/",
            "description": "Local coding service endpoint",
            "healthy": gateway_https_ok(f"{gw}/opencode/", repo_root=repo),
            "solutionKey": "openCode",
            "enabled": sol.get("openCode", True),
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
        "supportTools": build_support_tools(control_settings.get("solutions")),
    }


@app.put("/api/settings")
def save_settings(body: SettingsSaveRequest) -> dict[str, Any]:
    ensure_state_dir()

    prev_app = load_app_settings()
    prev_control = load_control_settings()
    control_paths_changed = any(
        normalize_path(getattr(body, k)) != prev_control[k]
        for k in _PATH_KEYS
    )
    checklist_settings_changed = any(
        getattr(body, key) != prev_control.get(key)
        for key in (
            "checklistPollIntervalSeconds",
            "checklistFlashcardRevisitMinutes",
            "checklistFlashcardRevisitBatchSize",
            "checklistTaskRevisitMinutes",
            "checklistTaskRevisitBatchSize",
            "checklistFeedbackReplayMinutes",
            "checklistFeedbackReplayBatchSize",
            "checklistHashtagMaintenanceHours",
            "checklistHashtagMaintenanceBatchSize",
            "checklistCleanupHours",
            "checklistCleanupBatchSize",
            "checklistOllamaTimeoutMs",
            "checklistTaskMinIce",
            "checklistFlashcardMinConfidence",
            "checklistFlashcardMinImpact",
            "checklistFlashcardMinWeight",
        )
    )
    folder_changed = normalize_path(body.localProjectFolder) != normalize_path(
        str(prev_app.get("localProjectFolder", DEFAULT_LOCAL_PROJECT_FOLDER))
    )
    needs_restart = control_paths_changed or folder_changed or checklist_settings_changed

    app_settings = load_app_settings()
    app_settings["localProjectFolder"] = normalize_path(body.localProjectFolder)
    app_settings["updatedAt"] = datetime.now(timezone.utc).isoformat()
    write_json(APP_SETTINGS_PATH, app_settings)

    solutions = merge_solutions_from_request(body, prev_control["solutions"])
    control_settings = {
        "sharedRoot": normalize_path(body.sharedRoot),
        "paperclipRoot": normalize_path(body.paperclipRoot),
        "checklistRoot": normalize_path(body.checklistRoot),
        "checklistEnvPath": normalize_path(body.checklistEnvPath),
        "checklistPollIntervalSeconds": body.checklistPollIntervalSeconds,
        "checklistFlashcardRevisitMinutes": body.checklistFlashcardRevisitMinutes,
        "checklistFlashcardRevisitBatchSize": body.checklistFlashcardRevisitBatchSize,
        "checklistTaskRevisitMinutes": body.checklistTaskRevisitMinutes,
        "checklistTaskRevisitBatchSize": body.checklistTaskRevisitBatchSize,
        "checklistFeedbackReplayMinutes": body.checklistFeedbackReplayMinutes,
        "checklistFeedbackReplayBatchSize": body.checklistFeedbackReplayBatchSize,
        "checklistHashtagMaintenanceHours": body.checklistHashtagMaintenanceHours,
        "checklistHashtagMaintenanceBatchSize": body.checklistHashtagMaintenanceBatchSize,
        "checklistCleanupHours": body.checklistCleanupHours,
        "checklistCleanupBatchSize": body.checklistCleanupBatchSize,
        "checklistOllamaTimeoutMs": body.checklistOllamaTimeoutMs,
        "checklistTaskMinIce": body.checklistTaskMinIce,
        "checklistFlashcardMinConfidence": body.checklistFlashcardMinConfidence,
        "checklistFlashcardMinImpact": body.checklistFlashcardMinImpact,
        "checklistFlashcardMinWeight": body.checklistFlashcardMinWeight,
        "solutions": solutions,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    write_json(CONTROL_SETTINGS_PATH, control_settings)

    return {
        "status": "ok",
        "requiresRestart": needs_restart,
        "solutionsAppliedLive": not needs_restart,
    }


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
