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
from checklist_control_defaults import (
    CHECKLIST_CONTROL_DEFAULTS,
    aggregate_checklist_metrics,
    load_failsafe_queue_rows,
    load_runtime_metrics_rows,
    merge_checklist_panel_fields_from_raw,
)
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
    checklistPollIntervalSeconds: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistPollIntervalSeconds"], ge=30, le=172800
    )
    checklistFlashcardRevisitMinutes: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistFlashcardRevisitMinutes"], ge=0, le=1440
    )
    checklistFlashcardRevisitBatchSize: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistFlashcardRevisitBatchSize"], ge=1, le=100
    )
    checklistTaskRevisitMinutes: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistTaskRevisitMinutes"], ge=0, le=1440
    )
    checklistTaskRevisitBatchSize: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistTaskRevisitBatchSize"], ge=1, le=100
    )
    checklistFeedbackReplayMinutes: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistFeedbackReplayMinutes"], ge=0, le=1440
    )
    checklistFeedbackReplayBatchSize: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistFeedbackReplayBatchSize"], ge=1, le=100
    )
    checklistHashtagMaintenanceHours: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistHashtagMaintenanceHours"], ge=0, le=720
    )
    checklistHashtagMaintenanceBatchSize: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistHashtagMaintenanceBatchSize"], ge=1, le=100
    )
    checklistCleanupHours: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistCleanupHours"], ge=0, le=720
    )
    checklistCleanupBatchSize: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistCleanupBatchSize"], ge=1, le=250
    )
    checklistOllamaTimeoutMs: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistOllamaTimeoutMs"], ge=5000, le=600000
    )
    checklistFailsafeModel: str = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistFailsafeModel"], min_length=1
    )
    checklistFailsafeTimeoutMs: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistFailsafeTimeoutMs"], ge=5000, le=600000
    )
    checklistFailsafeMaxAttempts: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistFailsafeMaxAttempts"], ge=1, le=10
    )
    checklistTaskMinIce: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistTaskMinIce"], ge=0, le=1000
    )
    checklistFlashcardMinConfidence: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistFlashcardMinConfidence"], ge=1, le=100
    )
    checklistFlashcardMinImpact: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistFlashcardMinImpact"], ge=1, le=100
    )
    checklistFlashcardMinWeight: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistFlashcardMinWeight"], ge=1, le=100
    )
    checklistStuckRunningMinutes: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistStuckRunningMinutes"], ge=1, le=1440
    )
    checklistNoProgressMinutes: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistNoProgressMinutes"], ge=1, le=4320
    )
    checklistResearchEnabled: bool = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistResearchEnabled"]
    )
    checklistFactcheckMinCitations: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistFactcheckMinCitations"], ge=1, le=20
    )
    checklistFactcheckMinDomains: int = Field(
        default=CHECKLIST_CONTROL_DEFAULTS["checklistFactcheckMinDomains"], ge=1, le=20
    )
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
    out: dict[str, Any] = {
        "sharedRoot": shared_root,
        "paperclipRoot": normalize_path(os.path.join(shared_root, "paperclip")),
        "checklistRoot": normalize_path(os.path.join(shared_root, "checklist")),
        "checklistEnvPath": normalize_path(os.path.join(shared_root, "checklist", ".env")),
        "solutions": default_solutions_flags(),
    }
    out.update(CHECKLIST_CONTROL_DEFAULTS)
    return out


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
    merge_checklist_panel_fields_from_raw(raw, settings)
    failsafe_model = str(raw.get("checklistFailsafeModel", "")).strip()
    if failsafe_model:
        settings["checklistFailsafeModel"] = failsafe_model
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


@app.get("/api/checklist-metrics")
def get_checklist_metrics(hours: int = 24) -> dict[str, Any]:
    control_settings = load_control_settings()
    bounded_hours = max(6, min(hours, 168))
    rows = load_runtime_metrics_rows(control_settings["checklistRoot"])
    queue_rows = load_failsafe_queue_rows(control_settings["checklistRoot"])
    return aggregate_checklist_metrics(rows, bounded_hours, queue_rows)


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
            "checklistFailsafeModel",
            "checklistFailsafeTimeoutMs",
            "checklistFailsafeMaxAttempts",
            "checklistTaskMinIce",
            "checklistFlashcardMinConfidence",
            "checklistFlashcardMinImpact",
            "checklistFlashcardMinWeight",
            "checklistStuckRunningMinutes",
            "checklistNoProgressMinutes",
            "checklistResearchEnabled",
            "checklistFactcheckMinCitations",
            "checklistFactcheckMinDomains",
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
        "checklistFailsafeModel": body.checklistFailsafeModel.strip(),
        "checklistFailsafeTimeoutMs": body.checklistFailsafeTimeoutMs,
        "checklistFailsafeMaxAttempts": body.checklistFailsafeMaxAttempts,
        "checklistTaskMinIce": body.checklistTaskMinIce,
        "checklistFlashcardMinConfidence": body.checklistFlashcardMinConfidence,
        "checklistFlashcardMinImpact": body.checklistFlashcardMinImpact,
        "checklistFlashcardMinWeight": body.checklistFlashcardMinWeight,
        "checklistStuckRunningMinutes": body.checklistStuckRunningMinutes,
        "checklistNoProgressMinutes": body.checklistNoProgressMinutes,
        "checklistResearchEnabled": body.checklistResearchEnabled,
        "checklistFactcheckMinCitations": body.checklistFactcheckMinCitations,
        "checklistFactcheckMinDomains": body.checklistFactcheckMinDomains,
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
