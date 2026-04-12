import unittest
from copy import deepcopy

from checklist_control_defaults import (
    CHECKLIST_CONTROL_DEFAULTS,
    CHECKLIST_HEALTH_LEGACY_SETTING_KEYS,
    aggregate_checklist_metrics,
    checklist_settings_drift_reason,
    expected_checklist_worker_contract,
    merge_checklist_panel_fields_from_raw,
    normalize_drift_scalar,
)


class TestNormalizeDriftScalar(unittest.TestCase):
    def test_int_from_float(self):
        self.assertTrue(normalize_drift_scalar(7200000, 7200000.0))

    def test_bool_from_string(self):
        self.assertTrue(normalize_drift_scalar(True, "true"))
        self.assertTrue(normalize_drift_scalar(False, "false"))
        self.assertFalse(normalize_drift_scalar(True, "false"))


class TestMergeChecklistPanelFields(unittest.TestCase):
    def test_merge_applies_bounded_ints(self):
        base = deepcopy(CHECKLIST_CONTROL_DEFAULTS)
        base["sharedRoot"] = "/tmp/x"
        merge_checklist_panel_fields_from_raw(
            {"checklistPollIntervalSeconds": 3600, "checklistTaskMinIce": 5000},
            base,
        )
        self.assertEqual(base["checklistPollIntervalSeconds"], 3600)
        self.assertNotEqual(base["checklistTaskMinIce"], 5000)

    def test_research_bool(self):
        base = deepcopy(CHECKLIST_CONTROL_DEFAULTS)
        merge_checklist_panel_fields_from_raw({"checklistResearchEnabled": False}, base)
        self.assertFalse(base["checklistResearchEnabled"])

    def test_research_from_string_json(self):
        base = deepcopy(CHECKLIST_CONTROL_DEFAULTS)
        merge_checklist_panel_fields_from_raw({"checklistResearchEnabled": "false"}, base)
        self.assertFalse(base["checklistResearchEnabled"])


class TestExpectedContract(unittest.TestCase):
    def test_research_reflects_setting(self):
        s = deepcopy(CHECKLIST_CONTROL_DEFAULTS)
        s["checklistResearchEnabled"] = False
        c = expected_checklist_worker_contract(s)
        self.assertFalse(c["researchEnabled"])


class TestDriftReason(unittest.TestCase):
    def test_legacy_worker_skips_extended_keys(self):
        control = deepcopy(CHECKLIST_CONTROL_DEFAULTS)
        exp = expected_checklist_worker_contract(control)
        health = {
            "researchEnabled": True,
            "settings": {
                k: exp["settings"][k]
                for k in exp["settings"]
                if k not in {"supervisorContractVersion", "flashcardRevisitIntervalMinutes"}
            },
        }
        self.assertIsNone(checklist_settings_drift_reason(health, control))

    def test_full_contract_requires_version_and_intervals(self):
        control = deepcopy(CHECKLIST_CONTROL_DEFAULTS)
        exp = expected_checklist_worker_contract(control)
        health = {
            "researchEnabled": True,
            "settings": dict(exp["settings"]),
        }
        health["settings"]["supervisorContractVersion"] = 1
        health["settings"]["flashcardRevisitIntervalMinutes"] = 999
        self.assertIsNotNone(checklist_settings_drift_reason(health, control))

    def test_partial_extended_falls_back_to_legacy(self):
        """Version bump without full /health mirror must not force drift on extended keys."""
        control = deepcopy(CHECKLIST_CONTROL_DEFAULTS)
        exp = expected_checklist_worker_contract(control)
        settings = {k: exp["settings"][k] for k in CHECKLIST_HEALTH_LEGACY_SETTING_KEYS}
        settings["supervisorContractVersion"] = 1
        settings["flashcardRevisitIntervalMinutes"] = 999
        health = {"researchEnabled": True, "settings": settings}
        self.assertIsNone(checklist_settings_drift_reason(health, control))


class TestAggregateMetrics(unittest.TestCase):
    def test_empty_rows(self):
        out = aggregate_checklist_metrics([], 6)
        self.assertEqual(out["hours"], 6)
        self.assertEqual(len(out["hourly"]), 6)
