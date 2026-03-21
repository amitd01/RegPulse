#!/usr/bin/env bash
# ==============================================================================
# RegPulse — Jira CLI Helper
# Usage:
#   ./scripts/jira.sh status RP-2              # Get ticket status
#   ./scripts/jira.sh transitions RP-2         # List available transitions
#   ./scripts/jira.sh move RP-2 "Done"         # Move ticket to status
#   ./scripts/jira.sh comment RP-2 "message"   # Add comment
#   ./scripts/jira.sh update RP-2 "Done" "msg" # Move + comment in one step
#
# Requires: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN in .env or environment
# ==============================================================================
set -euo pipefail

# Load .env if present
if [ -f "$(dirname "$0")/../.env" ]; then
    set -a
    source "$(dirname "$0")/../.env"
    set +a
fi

: "${JIRA_BASE_URL:?Set JIRA_BASE_URL in .env or environment}"
: "${JIRA_EMAIL:?Set JIRA_EMAIL in .env or environment}"
: "${JIRA_API_TOKEN:?Set JIRA_API_TOKEN in .env or environment}"

AUTH="${JIRA_EMAIL}:${JIRA_API_TOKEN}"
API="${JIRA_BASE_URL}/rest/api/3"

_curl() {
    curl -s -u "${AUTH}" -H "Accept: application/json" -H "Content-Type: application/json" "$@"
}

cmd_status() {
    local issue="$1"
    _curl "${API}/issue/${issue}?fields=summary,status" | \
        python3 -c "
import sys, json
d = json.load(sys.stdin)
f = d['fields']
print(f\"[{f['status']['name']}] {f['summary']}\")
"
}

cmd_transitions() {
    local issue="$1"
    _curl "${API}/issue/${issue}/transitions" | \
        python3 -c "
import sys, json
d = json.load(sys.stdin)
for t in d['transitions']:
    print(f\"  {t['id']:>4}  {t['name']}\")
"
}

cmd_move() {
    local issue="$1"
    local target_status="$2"

    # Find the transition ID for the target status
    local tid
    tid=$(_curl "${API}/issue/${issue}/transitions" | \
        python3 -c "
import sys, json
d = json.load(sys.stdin)
target = '${target_status}'.lower()
for t in d['transitions']:
    if t['name'].lower() == target:
        print(t['id'])
        break
")

    if [ -z "$tid" ]; then
        echo "Error: No transition found to '${target_status}'"
        echo "Available transitions:"
        cmd_transitions "$issue"
        exit 1
    fi

    _curl -X POST "${API}/issue/${issue}/transitions" \
        -d "{\"transition\":{\"id\":\"${tid}\"}}" > /dev/null

    echo "Moved ${issue} → ${target_status}"
}

cmd_comment() {
    local issue="$1"
    local message="$2"

    _curl -X POST "${API}/issue/${issue}/comment" \
        -d "{\"body\":{\"type\":\"doc\",\"version\":1,\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"${message}\"}]}]}}" > /dev/null

    echo "Comment added to ${issue}"
}

cmd_update() {
    local issue="$1"
    local status="$2"
    local message="${3:-}"

    cmd_move "$issue" "$status"
    if [ -n "$message" ]; then
        cmd_comment "$issue" "$message"
    fi
}

# --- Main ---
case "${1:-help}" in
    status)      cmd_status "$2" ;;
    transitions) cmd_transitions "$2" ;;
    move)        cmd_move "$2" "$3" ;;
    comment)     cmd_comment "$2" "$3" ;;
    update)      cmd_update "$2" "$3" "${4:-}" ;;
    help|*)
        echo "Usage: $0 <command> <issue> [args...]"
        echo ""
        echo "Commands:"
        echo "  status <issue>                  Get ticket status"
        echo "  transitions <issue>             List available transitions"
        echo "  move <issue> <status>           Move ticket to status"
        echo "  comment <issue> <message>       Add comment to ticket"
        echo "  update <issue> <status> [msg]   Move + comment in one step"
        echo ""
        echo "Examples:"
        echo "  $0 status RP-2"
        echo "  $0 move RP-2 'Done'"
        echo "  $0 update RP-2 'Done' 'Prompt [02] complete: schema + models'"
        ;;
esac
