#!/bin/bash

# Configuration
COMPANY_ID="96fc6f38-b26a-446b-a174-bf36dfe86733"
PROJECT_ID="PVT_kwHOACGtF84BOtVF"
READY_COLUMN_NAME="Ready (NEXT)"
STATUS_FIELD_ID="PVTSSF_lAHOACGtF84BOtVFzg9VH2o"
IN_PROGRESS_OPTION_ID="47fc9ee4"
PAPERCLIP_URL="http://localhost:3100"

echo "MVP Factory Automation Bridge starting..."
echo "Polling column: $READY_COLUMN_NAME"

while true; do
  # 1. Get items in Ready (NEXT)
  ITEMS=$(gh project item-list 1 --owner moldovancsaba --format json | jq -c '.items[] | select(.status=="'"$READY_COLUMN_NAME"'")')

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
    curl -s -X POST "$PAPERCLIP_URL/api/companies/$COMPANY_ID/issues" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg t "$TITLE" --arg d "$BODY" '{title: $t, description: $d, status: "todo"}')" > /dev/null

    # 3. Mark as In Progress in GH Project
    echo "Updating project status to In Progress..."
    gh project item-edit --id "$ITEM_ID" --field-id "$STATUS_FIELD_ID" --project-id "$PROJECT_ID" --single-select-option-id "$IN_PROGRESS_OPTION_ID" > /dev/null

    echo "Task $TITLE dispatched successfully."
  done

  sleep 30
done
