"""
Single source of truth for Checklist control-plane defaults, bounds, and drift contract.

Used by the tray supervisor (`control_mvp.py`) and the settings panel server.
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# Bump when supervisor adds/removes health.settings keys workers must echo.
CHECKLIST_CONTRACT_VERSION = 1

# Keys compared when worker health omits supervisorContractVersion (older workers).
CHECKLIST_HEALTH_LEGACY_SETTING_KEYS: frozenset[str] = frozenset(
    {
        "schedulingMode",
        "companyCycleCooldownMs",
        "researchHarvestBatchSize",
        "ollamaTimeoutMs",
        "failsafeModel",
        "failsafeTimeoutMs",
        "failsafeMaxAttempts",
        "taskMinIceScore",
        "flashcardMinConfidence",
        "flashcardMinImpact",
        "flashcardMinWeight",
        "stuckRunningMs",
        "noProgressMs",
        "flashcardRevisitBatchSize",
        "taskRevisitBatchSize",
        "feedbackReplayBatchSize",
        "hashtagMaintenanceBatchSize",
        "cleanupBatchSize",
    }
)

# Full contract: legacy + version + cadence + fact-check gates mirrored in /health.
CHECKLIST_HEALTH_EXTENDED_SETTING_KEYS: frozenset[str] = frozenset(
    {
        "supervisorContractVersion",
        "flashcardRevisitIntervalMinutes",
        "taskRevisitIntervalMinutes",
        "feedbackReplayIntervalMinutes",
        "hashtagMaintenanceIntervalHours",
        "cleanupIntervalHours",
        "factcheckMinCitations",
        "factcheckMinDomains",
    }
)

CHECKLIST_HEALTH_FULL_SETTING_KEYS: frozenset[str] = (
    CHECKLIST_HEALTH_LEGACY_SETTING_KEYS | CHECKLIST_HEALTH_EXTENDED_SETTING_KEYS
)


def _checklist_health_extended_complete(observed: dict[str, Any]) -> bool:
    """True only when /health exposes every extended key (opt-in full drift checks)."""
    return all(k in observed for k in CHECKLIST_HEALTH_EXTENDED_SETTING_KEYS)

# All checklist-related keys stored in control-panel-settings.json (plus paths/solutions).
CHECKLIST_PANEL_NUMERIC_BOUNDS: dict[str, tuple[int, int]] = {
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
    "checklistFailsafeTimeoutMs": (5000, 600000),
    "checklistFailsafeMaxAttempts": (1, 10),
    "checklistTaskMinIce": (0, 1000),
    "checklistFlashcardMinConfidence": (1, 100),
    "checklistFlashcardMinImpact": (1, 100),
    "checklistFlashcardMinWeight": (1, 100),
    "checklistStuckRunningMinutes": (1, 1440),
    "checklistNoProgressMinutes": (1, 4320),
    "checklistFactcheckMinCitations": (1, 20),
    "checklistFactcheckMinDomains": (1, 20),
}

CHECKLIST_CONTROL_DEFAULTS: dict[str, Any] = {
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
    "checklistFailsafeModel": "gemma4:e4b",
    "checklistFailsafeTimeoutMs": 90000,
    "checklistFailsafeMaxAttempts": 2,
    "checklistTaskMinIce": 0,
    "checklistFlashcardMinConfidence": 1,
    "checklistFlashcardMinImpact": 1,
    "checklistFlashcardMinWeight": 1,
    "checklistStuckRunningMinutes": 15,
    "checklistNoProgressMinutes": 180,
    "checklistResearchEnabled": True,
    "checklistFactcheckMinCitations": 2,
    "checklistFactcheckMinDomains": 2,
}


def merge_checklist_panel_fields_from_raw(raw: dict[str, Any], target: dict[str, Any]) -> None:
    """Merge validated checklist keys from persisted JSON into target (mutates target)."""
    for key, (lo, hi) in CHECKLIST_PANEL_NUMERIC_BOUNDS.items():
        value = raw.get(key)
        if isinstance(value, int) and lo <= value <= hi:
            target[key] = value
        elif isinstance(value, float) and value.is_integer():
            iv = int(value)
            if lo <= iv <= hi:
                target[key] = iv
    model = str(raw.get("checklistFailsafeModel", "")).strip()
    if model:
        target["checklistFailsafeModel"] = model
    v = raw.get("checklistResearchEnabled")
    if isinstance(v, bool):
        target["checklistResearchEnabled"] = v
    elif isinstance(v, str) and v.strip().lower() in ("true", "false", "1", "0", "yes", "no", "on", "off"):
        target["checklistResearchEnabled"] = v.strip().lower() in ("true", "1", "yes", "on")


def normalize_drift_scalar(expected: Any, actual: Any) -> bool:
    """True if actual matches expected after tolerant numeric coercion."""
    if actual is None and expected is not None:
        return False
    if isinstance(expected, bool):
        if isinstance(actual, str):
            lowered = actual.strip().lower()
            if lowered in ("true", "1", "yes", "on"):
                return expected is True
            if lowered in ("false", "0", "no", "off", ""):
                return expected is False
        return bool(actual) == expected
    if isinstance(expected, int) and not isinstance(expected, bool):
        if isinstance(actual, bool):
            return False
        if isinstance(actual, (int, float)):
            try:
                return int(actual) == int(expected)
            except (TypeError, ValueError):
                return False
        if isinstance(actual, str):
            try:
                return int(float(actual)) == int(expected)
            except (TypeError, ValueError):
                return False
        return False
    if isinstance(expected, str):
        return str(actual) == expected
    return actual == expected


def expected_checklist_worker_contract(control_settings: dict[str, Any]) -> dict[str, Any]:
    s = control_settings
    research_on = bool(s.get("checklistResearchEnabled", CHECKLIST_CONTROL_DEFAULTS["checklistResearchEnabled"]))

    def _i(key: str, fallback_key: str | None = None) -> int:
        fk = fallback_key or key
        v = s.get(key, CHECKLIST_CONTROL_DEFAULTS.get(fk))
        return int(v) if v is not None else 0

    settings = {
        "supervisorContractVersion": CHECKLIST_CONTRACT_VERSION,
        "schedulingMode": "company-serial-cycle",
        "companyCycleCooldownMs": _i("checklistPollIntervalSeconds") * 1000,
        "researchHarvestBatchSize": 1,
        "ollamaTimeoutMs": _i("checklistOllamaTimeoutMs"),
        "failsafeModel": str(s.get("checklistFailsafeModel", CHECKLIST_CONTROL_DEFAULTS["checklistFailsafeModel"])),
        "failsafeTimeoutMs": _i("checklistFailsafeTimeoutMs"),
        "failsafeMaxAttempts": _i("checklistFailsafeMaxAttempts"),
        "taskMinIceScore": _i("checklistTaskMinIce"),
        "flashcardMinConfidence": _i("checklistFlashcardMinConfidence"),
        "flashcardMinImpact": _i("checklistFlashcardMinImpact"),
        "flashcardMinWeight": _i("checklistFlashcardMinWeight"),
        "stuckRunningMs": _i("checklistStuckRunningMinutes") * 60 * 1000,
        "noProgressMs": _i("checklistNoProgressMinutes") * 60 * 1000,
        "flashcardRevisitBatchSize": _i("checklistFlashcardRevisitBatchSize"),
        "taskRevisitBatchSize": _i("checklistTaskRevisitBatchSize"),
        "feedbackReplayBatchSize": _i("checklistFeedbackReplayBatchSize"),
        "hashtagMaintenanceBatchSize": _i("checklistHashtagMaintenanceBatchSize"),
        "cleanupBatchSize": _i("checklistCleanupBatchSize"),
        "flashcardRevisitIntervalMinutes": _i("checklistFlashcardRevisitMinutes"),
        "taskRevisitIntervalMinutes": _i("checklistTaskRevisitMinutes"),
        "feedbackReplayIntervalMinutes": _i("checklistFeedbackReplayMinutes"),
        "hashtagMaintenanceIntervalHours": _i("checklistHashtagMaintenanceHours"),
        "cleanupIntervalHours": _i("checklistCleanupHours"),
        "factcheckMinCitations": _i("checklistFactcheckMinCitations"),
        "factcheckMinDomains": _i("checklistFactcheckMinDomains"),
    }
    return {"researchEnabled": research_on, "settings": settings}


def checklist_settings_drift_reason(health: dict[str, Any], control_settings: dict[str, Any]) -> str | None:
    """
    Compare worker /health JSON to the supervisor contract (no behavioral stall).
    Returns None if aligned, else a short reason code.

    Full extended parity is enforced only when the worker includes **every** extended
    ``settings`` key (see ``CHECKLIST_HEALTH_EXTENDED_SETTING_KEYS``). Otherwise the
    supervisor uses the legacy key subset so partially-upgraded workers are not
    restarted in a tight loop.
    """
    expected = expected_checklist_worker_contract(control_settings)
    if not normalize_drift_scalar(expected["researchEnabled"], health.get("researchEnabled")):
        return "research-enabled-mismatch"

    observed = health.get("settings") or {}
    version = observed.get("supervisorContractVersion")
    try:
        version_int = int(version) if version is not None else 0
    except (TypeError, ValueError):
        version_int = 0

    use_full = version_int >= CHECKLIST_CONTRACT_VERSION and _checklist_health_extended_complete(observed)
    keys = CHECKLIST_HEALTH_FULL_SETTING_KEYS if use_full else CHECKLIST_HEALTH_LEGACY_SETTING_KEYS

    for key, expected_value in expected["settings"].items():
        if key not in keys:
            continue
        if key == "supervisorContractVersion" and not use_full:
            continue
        actual_value = observed.get(key)
        if not normalize_drift_scalar(expected_value, actual_value):
            return f"settings-mismatch:{key}"
    return None


def checklist_behavioral_stall_reason(health: dict[str, Any]) -> str | None:
    progress = health.get("progress") or {}
    state = progress.get("state")
    if state in {"stuck-running", "stalled-no-progress"}:
        return f"behavioral-stall:{state}"
    return None


def build_checklist_sync_env_overlay(control_settings: dict[str, Any]) -> dict[str, str]:
    """Environment variables passed to the Checklist worker process (string values)."""
    s = control_settings
    research_on = bool(s.get("checklistResearchEnabled", CHECKLIST_CONTROL_DEFAULTS["checklistResearchEnabled"]))

    def _i(key: str) -> int:
        v = s.get(key, CHECKLIST_CONTROL_DEFAULTS.get(key))
        return int(v) if v is not None else 0

    return {
        "PORT": "10005",
        "OLLAMA_MODEL": "gemma4:latest",
        "OLLAMA_HOST": "http://127.0.0.1:11434",
        "CHECKLIST_RESEARCH_ENABLED": "true" if research_on else "false",
        "CHECKLIST_RESEARCH_PROVIDER": "duckduckgo-html",
        "CHECKLIST_RESEARCH_REFRESH_HOURS": "24",
        "CHECKLIST_RESEARCH_MAX_QUERIES": "2",
        "CHECKLIST_RESEARCH_MAX_RESULTS": "3",
        "CHECKLIST_RESEARCH_MAX_FETCHES": "3",
        "CHECKLIST_POLL_INTERVAL_MS": str(_i("checklistPollIntervalSeconds") * 1000),
        "CHECKLIST_FLASHCARD_REVISIT_INTERVAL_MINUTES": str(_i("checklistFlashcardRevisitMinutes")),
        "CHECKLIST_FLASHCARD_REVISIT_BATCH_SIZE": str(_i("checklistFlashcardRevisitBatchSize")),
        "CHECKLIST_TASK_REVISIT_INTERVAL_MINUTES": str(_i("checklistTaskRevisitMinutes")),
        "CHECKLIST_TASK_REVISIT_BATCH_SIZE": str(_i("checklistTaskRevisitBatchSize")),
        "CHECKLIST_FEEDBACK_REPLAY_INTERVAL_MINUTES": str(_i("checklistFeedbackReplayMinutes")),
        "CHECKLIST_FEEDBACK_REPLAY_BATCH_SIZE": str(_i("checklistFeedbackReplayBatchSize")),
        "CHECKLIST_HASHTAG_MAINTENANCE_HOURS": str(_i("checklistHashtagMaintenanceHours")),
        "CHECKLIST_HASHTAG_MAINTENANCE_BATCH_SIZE": str(_i("checklistHashtagMaintenanceBatchSize")),
        "CHECKLIST_CLEANUP_INTERVAL_HOURS": str(_i("checklistCleanupHours")),
        "CHECKLIST_CLEANUP_BATCH_SIZE": str(_i("checklistCleanupBatchSize")),
        "CHECKLIST_OLLAMA_TIMEOUT_MS": str(_i("checklistOllamaTimeoutMs")),
        "CHECKLIST_FAILSAFE_MODEL": str(s.get("checklistFailsafeModel", CHECKLIST_CONTROL_DEFAULTS["checklistFailsafeModel"])),
        "CHECKLIST_FAILSAFE_TIMEOUT_MS": str(_i("checklistFailsafeTimeoutMs")),
        "CHECKLIST_FAILSAFE_MAX_ATTEMPTS": str(_i("checklistFailsafeMaxAttempts")),
        "CHECKLIST_TASK_MIN_ICE_SCORE": str(_i("checklistTaskMinIce")),
        "CHECKLIST_FLASHCARD_MIN_CONFIDENCE": str(_i("checklistFlashcardMinConfidence")),
        "CHECKLIST_FLASHCARD_MIN_IMPACT": str(_i("checklistFlashcardMinImpact")),
        "CHECKLIST_FLASHCARD_MIN_WEIGHT": str(_i("checklistFlashcardMinWeight")),
        "CHECKLIST_STUCK_RUNNING_MS": str(_i("checklistStuckRunningMinutes") * 60 * 1000),
        "CHECKLIST_NO_PROGRESS_MS": str(_i("checklistNoProgressMinutes") * 60 * 1000),
        "CHECKLIST_FACTCHECK_MIN_CITATIONS": str(_i("checklistFactcheckMinCitations")),
        "CHECKLIST_FACTCHECK_MIN_DOMAINS": str(_i("checklistFactcheckMinDomains")),
    }


# --- metrics (shared with settings panel) ---


def load_runtime_metrics_rows(checklist_root: str) -> list[dict[str, Any]]:
    metrics_path = Path(checklist_root) / "scripts" / "knowledge" / "runtime-metrics.ndjson"
    if not metrics_path.is_file():
        return []
    rows: list[dict[str, Any]] = []
    for line in metrics_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def aggregate_checklist_metrics(rows: list[dict[str, Any]], hours: int) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    hourly = []
    buckets: dict[str, dict[str, Any]] = {}
    per_company_keys: set[str] = set()
    cutoff_ts = now.timestamp() - (hours * 3600)

    for index in range(hours):
        bucket_start = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=hours - index - 1)
        key = bucket_start.isoformat().replace("+00:00", "Z")
        buckets[key] = {
            "hour": key,
            "companiesProcessedFully": 0,
            "cardsCreated": 0,
            "taskcardsCreated": 0,
            "flashcardsCreated": 0,
            "datacardsCreated": 0,
            "perCompany": defaultdict(
                lambda: {
                    "cardsCreated": 0,
                    "taskcardsCreated": 0,
                    "flashcardsCreated": 0,
                    "datacardsCreated": 0,
                }
            ),
        }

    for row in rows:
        recorded_at = row.get("recordedAt")
        if not recorded_at:
            continue
        try:
            dt = datetime.fromisoformat(str(recorded_at).replace("Z", "+00:00"))
        except ValueError:
            continue
        if dt.timestamp() < cutoff_ts:
            continue
        bucket_key = dt.replace(minute=0, second=0, microsecond=0).isoformat().replace("+00:00", "Z")
        bucket = buckets.get(bucket_key)
        if not bucket:
            continue
        if row.get("type") == "company-cycle-summary":
            bucket["companiesProcessedFully"] += int(row.get("companiesProcessedFully") or 0)
            bucket["cardsCreated"] += int(row.get("cardsCreated") or 0)
            bucket["taskcardsCreated"] += int(row.get("taskcardsCreated") or 0)
            bucket["flashcardsCreated"] += int(row.get("flashcardsCreated") or 0)
            bucket["datacardsCreated"] += int(row.get("datacardsCreated") or 0)
            company_id = row.get("companyId")
            if company_id:
                per_company_keys.add(str(company_id))
                bucket["perCompany"][company_id]["cardsCreated"] += int(row.get("cardsCreated") or 0)
                bucket["perCompany"][company_id]["taskcardsCreated"] += int(row.get("taskcardsCreated") or 0)
                bucket["perCompany"][company_id]["flashcardsCreated"] += int(row.get("flashcardsCreated") or 0)
                bucket["perCompany"][company_id]["datacardsCreated"] += int(row.get("datacardsCreated") or 0)
        elif row.get("type") == "company-lane-run" and row.get("lane") == "companyCycle":
            result = row.get("result") or {}
            flashcards = ((result.get("poll") or {}).get("result") or {}).get("flashcards") or {}
            recommendations = ((result.get("poll") or {}).get("result") or {}).get("recommendations") or {}
            research_harvest = result.get("researchHarvest") or {}
            company_id = row.get("companyId")
            cards_created = (
                int(flashcards.get("created") or 0)
                + int(recommendations.get("created") or 0)
                + int(research_harvest.get("createdSources") or 0)
            )
            bucket["companiesProcessedFully"] += 1 if result.get("processed") else 0
            bucket["cardsCreated"] += cards_created
            bucket["taskcardsCreated"] += int(recommendations.get("created") or 0)
            bucket["flashcardsCreated"] += int(flashcards.get("created") or 0)
            bucket["datacardsCreated"] += int(research_harvest.get("createdSources") or 0)
            if company_id:
                per_company_keys.add(str(company_id))
                bucket["perCompany"][company_id]["cardsCreated"] += cards_created
                bucket["perCompany"][company_id]["taskcardsCreated"] += int(recommendations.get("created") or 0)
                bucket["perCompany"][company_id]["flashcardsCreated"] += int(flashcards.get("created") or 0)
                bucket["perCompany"][company_id]["datacardsCreated"] += int(research_harvest.get("createdSources") or 0)

    for bucket in buckets.values():
        bucket["perCompany"] = dict(bucket["perCompany"])
        hourly.append(bucket)

    recent_events = [
        row
        for row in rows
        if row.get("recordedAt")
        and row.get("type") in {"company-cycle-summary", "company-lane-run", "failsafe-queue", "meaningful-progress"}
    ][-40:]

    return {
        "hours": hours,
        "hourly": hourly,
        "companies": sorted(per_company_keys),
        "recentEvents": recent_events,
    }
