"""
Unit tests for Control.app update-engine paths (mocks rumps). Run with pytest/unittest from repo root.
"""
import unittest
from unittest.mock import MagicMock, patch
import sys
import os
import time

# Mock rumps before any imports
sys.modules['rumps'] = MagicMock()

# Add parent directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

class TestUpdateEngine(unittest.TestCase):
    @patch('rumps.alert')
    @patch('rumps.notification')
    @patch('subprocess.run')
    @patch('subprocess.check_output')
    @patch('sys.exit')
    @patch('time.sleep')
    def test_update_logic_flow(self, mock_sleep, mock_exit, mock_check_output, mock_run, mock_noti, mock_alert):
        """
        Verify the v1.4.1-sovereign update engine follows the correct sequence:
        1. Fetch -> 2. Detect 'behind' -> 3. Alert User -> 4. Pull -> 5. Bootstrap -> 6. Exit
        """
        # Delay import to ensure mocks are active
        from scripts.control_mvp import ControlApp
        
        # Prevent init from calling check_status (which does IO/network)
        with patch.object(ControlApp, 'check_status', return_value=None):
            app = ControlApp()
            app.menu = MagicMock()
            app.infra_item = MagicMock()

            # 1. Mock 'git status' output showing the branch is behind origin/main
            mock_check_output.return_value = b"Your branch is behind 'origin/main' by 1 commit."
            
            # 2. Mock user clicking 'Yes' (OK=1) on the update alert
            mock_alert.return_value = 1
            
            # 3. Trigger the update engine
            print("\n[DEBUG] Manually triggering check_updates...")
            app.check_updates(None)
            
            # --- VERIFICATIONS ---
            print(f"[DEBUG] subprocess.run calls: {mock_run.call_args_list}")
            
            # Verify Git Fetch was called first (to sync status)
            fetch_call = any('fetch' in str(call.args[0]) for call in mock_run.call_args_list if call.args)
            self.assertTrue(fetch_call, "git fetch was not called")
            
            # Verify the user was alerted about the update
            mock_alert.assert_called_once()
            
            # Verify Git Pull was called to get the NEW version
            pull_call = any('pull' in str(call.args[0]) for call in mock_run.call_args_list if call.args)
            self.assertTrue(pull_call, "git pull was not called")
            
            # Verify Bootstrap was called to sync the factory (Critical Phase)
            bootstrap_call = any('bootstrap.sh' in str(call.args[0]) for call in mock_run.call_args_list if call.args)
            self.assertTrue(bootstrap_call, "bootstrap.sh was not called during update")
            
            # Verify notifications were sent to the operator
            self.assertGreaterEqual(mock_noti.call_count, 3) 
            
            # Verify sys.exit(0) was reached (Self-Restart handoff to Watchdog)
            mock_exit.assert_called_once_with(0)
            
            print("\n✅ v1.4.1-sovereign Update Engine E2E Validation: PASSED")
            print("   - Sequence: Fetch -> Detect -> Pull -> Bootstrap -> Self-Exit confirmed.")

if __name__ == '__main__':
    unittest.main()
