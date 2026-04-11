#!/bin/bash
#
# Legacy/automation bridge: polls GitHub Project Todo (NEXT) queue via gh CLI, triggers Paperclip URL.
# IDs below are org/project-specific; treat as deployment configuration, not library code.
#
COMPANY_ID="96fc6f38-b26a-446b-a174-bf36dfe86733"
PROJECT_ID="PVT_kwHOACGtF84BOtVF"
# Board Status single-select (see scripts/list-project-column.sh); was formerly named "Ready (NEXT)".
PULL_QUEUE_STATUS="Todo (NEXT)"
STATUS_FIELD_ID="PVTSSF_lAHOACGtF84BOtVFzg9VH2o"
IN_PROGRESS_OPTION_ID="47fc9ee4"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GW_PORT="${MVP_HTTPS_GATEWAY_PORT:-3443}"
CA_CERT="${REPO_ROOT}/.mvp-factory-control/tls/localhost-cert.pem"
PAPERCLIP_URL="https://127.0.0.1:${GW_PORT}/dashboard"

if [ ! -f "$CA_CERT" ]; then
  echo "Missing TLS CA at $CA_CERT (run Control.app once or bootstrap) — cannot call Paperclip over HTTPS." >&2
  exit 1
fi

echo "MVP Factory Automation Bridge starting..."
echo "Polling Status: $PULL_QUEUE_STATUS"

while true; do
  # 1. Get items in Todo (NEXT)
  ITEMS=$(gh project item-list 1 --owner moldovancsaba --format json | jq -c '.items[] | select(.status=="'"$PULL_QUEUE_STATUS"'")')

  if [ -z "$ITEMS" ]; then
    # echo "No ready tasks. Waiting..."
    sleep 30
    continue
  fi

  echo "$ITEMS" | while read -r item; do
    TITLE=$(echo "$item" | jq -r '.title')
    ITEM_ID=$(echo "$item" | jq -r '.id')
    
    # We assume it's an issue and get the body
    REPO=$(echo "$item" | jq -r '.repository')
    NUMBER=$(echo "$item" | jq -r '.number')

    echo "Dispatched task found: $TITLE (#$NUMBER in $REPO)"

    # Get issue body
    BODY=$(gh issue view "$NUMBER" --repo "$REPO" --json body -q .body)

    # 2. Dispatch to Paperclip
    echo "Sending to Paperclip..."
    curl --cacert "$CA_CERT" -s -X POST "$PAPERCLIP_URL/api/companies/$COMPANY_ID/issues" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg t "$TITLE" --arg d "$BODY" '{title: $t, description: $d, status: "todo"}')" > /dev/null

    # 3. Mark as In Progress (NOW) on the project board
    echo "Updating project status to In Progress (NOW)..."
    gh project item-edit --id "$ITEM_ID" --field-id "$STATUS_FIELD_ID" --project-id "$PROJECT_ID" --single-select-option-id "$IN_PROGRESS_OPTION_ID" > /dev/null

    echo "Task $TITLE dispatched successfully."
  done

  sleep 30
done
