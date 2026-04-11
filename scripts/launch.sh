#!/bin/bash
#
# Launches/refreshes the macOS Control tray app: ensures .venv, runs bootstrap if missing,
# reloads LaunchAgent plist (Sovereign Watchdog), opens Control.app / python control_mvp.py as needed.
#
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VIRTUAL_ENV="$REPO_ROOT/.venv"
CONTROL_SCRIPT="$REPO_ROOT/scripts/control_mvp.py"

echo "🚀 Launching MVP Factory Control..."

# 1. Check for virtual environment
if [ ! -d "$VIRTUAL_ENV" ]; then
  echo "⚠️  Virtual environment not found. Running bootstrap first..."
  bash "$REPO_ROOT/scripts/bootstrap.sh"
fi

# 2. Sync and Refresh the LaunchAgent (Sovereign Watchdog)
echo "ℹ️  Refreshing Sovereign Watchdog..."
PLIST_NAME="com.moldovancsaba.control-mvp.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

# Copy latest plist and pin every path to this checkout (works from any clone location).
cp "$REPO_ROOT/scripts/$PLIST_NAME" "$PLIST_DEST"
sed -i '' "s|/Users/moldovancsaba/Projects/mvp-factory-control|$REPO_ROOT|g" "$PLIST_DEST"
sed -i '' "s|/Users/Shared/Projects/mvp-factory-control|$REPO_ROOT|g" "$PLIST_DEST"
PY="$REPO_ROOT/.venv/bin/python3"
if [ -x "$PY" ]; then
  /usr/libexec/PlistBuddy -c "Set :ProgramArguments:0 $PY" "$PLIST_DEST"
  /usr/libexec/PlistBuddy -c "Set :ProgramArguments:1 $REPO_ROOT/scripts/control_mvp.py" "$PLIST_DEST"
  /usr/libexec/PlistBuddy -c "Set :WorkingDirectory $REPO_ROOT" "$PLIST_DEST"
fi

# Force a restart of the service via launchctl
# bootout might fail if not loaded, hence '|| true'
launchctl bootout gui/$(id -u)/com.moldovancsaba.control-mvp 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$PLIST_DEST"
launchctl kickstart -kp gui/$(id -u)/com.moldovancsaba.control-mvp

echo "✨ Control Tray App launched successfully via Sovereign Watchdog."
echo "Check your menu bar for the icon."
