#!/usr/bin/env bash
# List Status column options (board "columns") for the MVP Factory GitHub Project, or list items in one status.
# Requires: gh with read:project + project scopes, jq. See docs/SETUP.md.
# Usage:
#   ./scripts/list-project-column.sh                    # print Status option names (one per line)
#   ./scripts/list-project-column.sh 'Todo (NEXT)'     # list project items with that Status
#   ./scripts/list-project-column.sh --limit 200 'Done'
# Env: MVP_PROJECT_OWNER (default moldovancsaba), MVP_PROJECT_NUMBER (default 1)

set -euo pipefail

PROJECT_OWNER="${MVP_PROJECT_OWNER:-moldovancsaba}"
PROJECT_NUM="${MVP_PROJECT_NUMBER:-1}"
STATUS_FIELD="Status"
LIMIT=100

usage() {
  echo "Usage: $0 [--limit N] [STATUS]" >&2
  echo "  No args: print ${STATUS_FIELD} option names for project ${PROJECT_NUM} (${PROJECT_OWNER})." >&2
  echo "  STATUS: run gh project item-list with status filter (quote values with spaces)." >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --limit|-L)
      LIMIT="${2:-}"
      if ! [ "${LIMIT}" -eq "${LIMIT}" ] 2>/dev/null; then
        echo "Invalid --limit: ${2:-}" >&2
        exit 1
      fi
      shift 2
      ;;
    -h|--help) usage ;;
    *)
      break
      ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "gh (GitHub CLI) not found" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found" >&2
  exit 1
fi

if [ -z "${GH_TOKEN:-}" ] && [ -z "${GITHUB_TOKEN:-}" ] && [ -z "${MVP_PROJECT_TOKEN:-}" ]; then
  if ! gh auth status 2>/dev/null | grep -qE 'project|read:project'; then
    echo "GitHub CLI needs read:project and project scopes." >&2
    echo "Switch to the account you use for this repo, then run:" >&2
    echo "  gh auth refresh -h github.com -s read:project,project" >&2
    echo "See docs/SETUP.md (gh auth refresh has no -u flag; use gh auth switch first)." >&2
    exit 1
  fi
fi

if [ $# -eq 0 ]; then
  gh project field-list "$PROJECT_NUM" --owner "$PROJECT_OWNER" --format json \
    | jq -r --arg name "$STATUS_FIELD" '
        .fields[]
        | select(.name == $name and (.options | type) == "array")
        | .options[]
        | .name
      '
  exit 0
fi

STATUS="$*"
# Pass exact status string to Projects filter syntax: status:"Label"
QUERY="status:\"${STATUS//\"/\\\"}\""
exec gh project item-list "$PROJECT_NUM" --owner "$PROJECT_OWNER" --limit "$LIMIT" --query "$QUERY"
