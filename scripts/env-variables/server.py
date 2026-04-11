#!/usr/bin/env python3
"""
Local Environment Variables UI for MVP Factory Control.
Serves a Vercel-style manager on 127.0.0.1 — bind loopback only.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

PORT = int(os.environ.get("MVP_ENV_UI_PORT", "3199"))
_GATEWAY_PORT = os.environ.get("MVP_HTTPS_GATEWAY_PORT", "3443")
REGISTRY_DIR = Path.home() / ".mvp-factory-control"
REGISTRY_PATH = REGISTRY_DIR / "env-registry.json"
META_DIR = REGISTRY_DIR / "env-variables-meta"

ENV_CANDIDATES = (".env", ".env.local", ".env.development", ".env.development.local")

_ENV_CORS_ORIGINS = [
    f"https://127.0.0.1:{_GATEWAY_PORT}",
    f"https://localhost:{_GATEWAY_PORT}",
]

app = FastAPI(title="MVP Factory Env Variables")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ENV_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _ensure_dirs() -> None:
    REGISTRY_DIR.mkdir(parents=True, exist_ok=True)
    META_DIR.mkdir(parents=True, exist_ok=True)


def _load_registry() -> dict[str, Any]:
    _ensure_dirs()
    if not REGISTRY_PATH.is_file():
        return {"projects": []}
    try:
        return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"projects": []}


def _save_registry(data: dict[str, Any]) -> None:
    _ensure_dirs()
    REGISTRY_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _meta_path(project_id: str) -> Path:
    return META_DIR / f"{project_id}.json"


def _load_meta(project_id: str) -> dict[str, Any]:
    p = _meta_path(project_id)
    if not p.is_file():
        return {"vars": {}}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"vars": {}}


def _save_meta(project_id: str, meta: dict[str, Any]) -> None:
    _ensure_dirs()
    _meta_path(project_id).write_text(json.dumps(meta, indent=2), encoding="utf-8")


def resolve_env_file(root: Path) -> Optional[Path]:
    for name in ENV_CANDIDATES:
        candidate = root / name
        if candidate.is_file():
            return candidate
    return None


def _parse_value(raw: str) -> str:
    val = raw.strip()
    if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
        return val[1:-1]
    return val


def parse_env_file(path: Path) -> list[dict[str, Any]]:
    """Return ordered segments: raw line, or key/value pair."""
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines(keepends=True)
    segments: list[dict[str, Any]] = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            segments.append({"kind": "raw", "text": line})
            continue
        work = line.rstrip("\n\r")
        if work.lstrip().startswith("export "):
            work = work.lstrip()[7:].lstrip()
        if "=" not in work:
            segments.append({"kind": "raw", "text": line})
            continue
        key_part, _, val_part = work.partition("=")
        key = key_part.strip()
        if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", key):
            segments.append({"kind": "raw", "text": line})
            continue
        val = _parse_value(val_part)
        segments.append({"kind": "pair", "key": key, "value": val, "original_line": line})
    return segments


def segments_to_map(segments: list[dict[str, Any]]) -> dict[str, str]:
    out: dict[str, str] = {}
    for s in segments:
        if s.get("kind") == "pair":
            out[s["key"]] = s["value"]
    return out


def write_env_file(path: Path, segments: list[dict[str, Any]]) -> None:
    parts: list[str] = []
    for s in segments:
        if s["kind"] == "raw":
            parts.append(s["text"] if s["text"].endswith("\n") else s["text"] + "\n")
        else:
            v = s["value"]
            if re.search(r'[\s#"\'\\]', v):
                esc = v.replace("\\", "\\\\").replace('"', '\\"')
                line = f'{s["key"]}="{esc}"\n'
            else:
                line = f'{s["key"]}={v}\n'
            parts.append(line)
    path.write_text("".join(parts), encoding="utf-8")


def upsert_pair(segments: list[dict[str, Any]], key: str, value: str) -> list[dict[str, Any]]:
    found = False
    new_segments: list[dict[str, Any]] = []
    for s in segments:
        if s.get("kind") == "pair" and s.get("key") == key:
            new_segments.append({"kind": "pair", "key": key, "value": value, "original_line": ""})
            found = True
        else:
            new_segments.append(s)
    if not found:
        new_segments.append({"kind": "pair", "key": key, "value": value, "original_line": ""})
    return new_segments


def delete_pair(segments: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    return [s for s in segments if not (s.get("kind") == "pair" and s.get("key") == key)]


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    path: str = Field(..., min_length=1)


class VariableUpsert(BaseModel):
    key: str = Field(..., min_length=1, pattern=r"^[A-Za-z_][A-Za-z0-9_]*$")
    value: str = ""
    scope: str = Field("all", pattern=r"^(all|production)$")


class VariablePatch(BaseModel):
    value: Optional[str] = None
    scope: Optional[str] = None


def _project_by_id(registry: dict[str, Any], pid: str) -> Optional[dict[str, Any]]:
    for p in registry.get("projects", []):
        if p.get("id") == pid:
            return p
    return None


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/pick-folder")
def pick_folder() -> dict[str, str]:
    if sys.platform != "darwin":
        raise HTTPException(status_code=400, detail="Native folder picker is only available on macOS.")
    script = (
        'tell application "System Events"\n'
        '  activate\n'
        '  set f to choose folder with prompt "Select project root (folder containing .env)"\n'
        '  return POSIX path of f\n'
        "end tell"
    )
    try:
        out = subprocess.check_output(["/usr/bin/osascript", "-e", script], stderr=subprocess.STDOUT, timeout=120)
        path = out.decode("utf-8").strip()
        if not path:
            raise HTTPException(status_code=400, detail="No folder selected.")
        return {"path": path.rstrip("/") + "/"}
    except subprocess.CalledProcessError as e:
        msg = e.output.decode("utf-8", errors="replace") if e.output else str(e)
        if "User canceled" in msg or "-128" in msg:
            raise HTTPException(status_code=400, detail="Canceled.")
        raise HTTPException(status_code=500, detail=msg[:200])


@app.get("/api/projects")
def list_projects() -> dict[str, Any]:
    reg = _load_registry()
    return {"projects": reg.get("projects", [])}


@app.post("/api/projects")
def create_project(body: ProjectCreate) -> dict[str, Any]:
    root = Path(body.path).expanduser().resolve()
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory.")
    env_path = resolve_env_file(root)
    if not env_path:
        tried = ", ".join(ENV_CANDIDATES)
        raise HTTPException(
            status_code=400,
            detail=f"No env file found in folder. Tried: {tried}",
        )
    reg = _load_registry()
    projects = reg.setdefault("projects", [])
    pid = str(uuid.uuid4())
    projects.append(
        {
            "id": pid,
            "name": body.name.strip(),
            "rootPath": str(root),
            "envFileName": env_path.name,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
    )
    _save_registry(reg)
    return {"project": projects[-1]}


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str) -> dict[str, str]:
    reg = _load_registry()
    projects = reg.get("projects", [])
    reg["projects"] = [p for p in projects if p.get("id") != project_id]
    _save_registry(reg)
    mp = _meta_path(project_id)
    if mp.is_file():
        mp.unlink()
    return {"status": "deleted"}


@app.get("/api/projects/{project_id}/variables")
def list_variables(project_id: str) -> dict[str, Any]:
    reg = _load_registry()
    p = _project_by_id(reg, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
    root = Path(p["rootPath"])
    env_path = root / p.get("envFileName", ".env")
    if not env_path.is_file():
        raise HTTPException(status_code=404, detail="Env file missing on disk.")
    segments = parse_env_file(env_path)
    meta = _load_meta(project_id)
    var_meta = meta.get("vars", {})
    items = []
    for s in segments:
        if s.get("kind") != "pair":
            continue
        key = s["key"]
        vm = var_meta.get(key, {})
        scope = vm.get("scope", "all")
        updated = vm.get("updatedAt")
        items.append(
            {
                "key": key,
                "value": s["value"],
                "scope": scope,
                "updatedAt": updated,
            }
        )
    return {
        "project": p,
        "variables": items,
    }


@app.post("/api/projects/{project_id}/variables")
def add_variable(project_id: str, body: VariableUpsert) -> dict[str, Any]:
    if body.scope not in ("all", "production"):
        raise HTTPException(status_code=400, detail="scope must be 'all' or 'production'.")
    reg = _load_registry()
    p = _project_by_id(reg, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
    root = Path(p["rootPath"])
    env_path = root / p.get("envFileName", ".env")
    if not env_path.is_file():
        env_path.write_text("", encoding="utf-8")
    segments = parse_env_file(env_path)
    if any(s.get("kind") == "pair" and s.get("key") == body.key for s in segments):
        raise HTTPException(status_code=409, detail="Variable already exists.")
    segments = upsert_pair(segments, body.key, body.value)
    write_env_file(env_path, segments)
    meta = _load_meta(project_id)
    meta.setdefault("vars", {})[body.key] = {
        "scope": body.scope,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    _save_meta(project_id, meta)
    return {"ok": True, "key": body.key}


@app.patch("/api/projects/{project_id}/variables/{key}")
def patch_variable(project_id: str, key: str, body: VariablePatch) -> dict[str, str]:
    if body.scope is not None and body.scope not in ("all", "production"):
        raise HTTPException(status_code=400, detail="scope must be 'all' or 'production'.")
    reg = _load_registry()
    p = _project_by_id(reg, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
    env_path = Path(p["rootPath"]) / p.get("envFileName", ".env")
    if not env_path.is_file():
        raise HTTPException(status_code=404, detail="Env file missing.")
    segments = parse_env_file(env_path)
    if not any(s.get("kind") == "pair" and s.get("key") == key for s in segments):
        raise HTTPException(status_code=404, detail="Variable not found.")
    if body.value is not None:
        segments = upsert_pair(segments, key, body.value)
        write_env_file(env_path, segments)
    meta = _load_meta(project_id)
    meta.setdefault("vars", {}).setdefault(key, {})
    entry = meta["vars"][key]
    if body.scope is not None:
        entry["scope"] = body.scope
    entry["updatedAt"] = datetime.now(timezone.utc).isoformat()
    _save_meta(project_id, meta)
    return {"status": "ok"}


@app.delete("/api/projects/{project_id}/variables/{key}")
def delete_variable(project_id: str, key: str) -> dict[str, str]:
    reg = _load_registry()
    p = _project_by_id(reg, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
    env_path = Path(p["rootPath"]) / p.get("envFileName", ".env")
    segments = parse_env_file(env_path)
    segments = delete_pair(segments, key)
    write_env_file(env_path, segments)
    meta = _load_meta(project_id)
    if key in meta.get("vars", {}):
        del meta["vars"][key]
    _save_meta(project_id, meta)
    return {"status": "deleted"}


STATIC_DIR = Path(__file__).resolve().parent / "static"


@app.get("/")
def index() -> FileResponse:
    html = STATIC_DIR / "index.html"
    if not html.is_file():
        raise HTTPException(status_code=500, detail="Missing static/index.html")
    return FileResponse(html)


def main() -> None:
    import uvicorn

    _ensure_dirs()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")


if __name__ == "__main__":
    main()
