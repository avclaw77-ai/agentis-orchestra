#!/bin/bash
# =============================================================================
# AgentisOrchestra -- E2E API Test Suite
# Tests the full setup flow + core API functionality
#
# Usage:
#   ./tests/e2e-api.sh                          # Uses localhost:3000
#   ./tests/e2e-api.sh http://148.230.91.61:3000  # Custom base URL
#   BRIDGE_TOKEN=xxx ./tests/e2e-api.sh          # With bridge auth
#
# Prerequisites:
#   - App running at BASE_URL
#   - Bridge running and reachable from app
#   - Fresh database (no existing company/users)
#
# This test will create an admin user + company. Run against a fresh DB.
# =============================================================================

set -euo pipefail

B="${1:-http://localhost:3000}"
BT="${BRIDGE_TOKEN:-}"
CJ=$(mktemp)
trap "rm -f $CJ" EXIT

P=0; F=0
ok() { echo "  PASS: $1"; P=$((P+1)); }
no() { echo "  FAIL: $1"; F=$((F+1)); }

echo "=== AGENTIS ORCHESTRA E2E TEST SUITE ==="
echo "Base URL: $B"
echo ""

# ── Setup Flow ────────────────────────────────────────────────────────────────

echo "1. Fresh setup status"
R=$(curl -sf "$B/api/setup" || echo '{"error":"unreachable"}')
echo "$R" | grep -q "false" && ok "setupCompleted=false" || no "got: $R"

echo "2. CLI provider detection"
R=$(curl -sf -X POST "$B/api/setup/test-provider" -H "Content-Type: application/json" -d '{"provider":"claude-cli"}')
echo "$R" | grep -q '"valid":true' && ok "CLI detected" || no "$R"

echo "3. Register admin"
R=$(curl -sf -c "$CJ" -X POST "$B/api/auth" -H "Content-Type: application/json" \
  -d '{"action":"register","email":"admin@e2e.test","password":"E2ETestPass!","name":"E2E Admin"}')
echo "$R" | grep -q "admin" && ok "admin registered" || no "$R"

echo "4. Complete setup (CLI-only + displayName)"
R=$(curl -sf -b "$CJ" -c "$CJ" -X POST "$B/api/setup" -H "Content-Type: application/json" -d '{
  "company": {"name":"E2E Corp","mission":"Automated testing","locale":"en"},
  "departments": [{
    "id":"eng","name":"Engineering","description":"Software dev","color":"#3b82f6","template":"engineering",
    "agents": [
      {"id":"dev","name":"Dev","displayName":"Sophie","role":"Software development","model":"claude-cli:sonnet"},
      {"id":"qa","name":"QA","displayName":"","role":"Quality assurance","model":"claude-cli:haiku"}
    ]
  }],
  "providers": [{"provider":"claude-cli","apiKey":""}]
}')
echo "$R" | grep -q '"success":true' && ok "setup done" || no "$R"

echo "5. Setup completed status"
R=$(curl -sf -b "$CJ" "$B/api/setup")
echo "$R" | grep -q "true" && ok "setupCompleted=true" || no "$R"

# ── Core Data ─────────────────────────────────────────────────────────────────

echo "6. Agents list (expect 3: dev + qa + ceo)"
R=$(curl -sf -b "$CJ" "$B/api/agents")
N=$(echo "$R" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$N" = "3" ] && ok "3 agents" || no "expected 3, got $N"

echo "7. displayName=Sophie saved"
S=$(echo "$R" | python3 -c "import sys,json;a=json.load(sys.stdin);print(len([x for x in a if x.get('displayName')=='Sophie']))" 2>/dev/null)
[ "$S" = "1" ] && ok "Sophie found" || no "displayName not saved"

echo "8. CEO agent exists"
C=$(echo "$R" | python3 -c "import sys,json;a=json.load(sys.stdin);print(len([x for x in a if x.get('isCeo')]))" 2>/dev/null)
[ "$C" = "1" ] && ok "CEO agent" || no "missing"

echo "9. Departments"
R=$(curl -sf -b "$CJ" "$B/api/departments")
N=$(echo "$R" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$N" = "1" ] && ok "1 department" || no "got $N"

echo "10. Company record"
R=$(curl -sf -b "$CJ" "$B/api/company")
echo "$R" | grep -q "E2E Corp" && ok "company name correct" || no "$R"

# ── Health ────────────────────────────────────────────────────────────────────

echo "11. App health"
R=$(curl -sf "$B/api/health")
echo "$R" | grep -q '"bridge":"ok"' && ok "bridge connected" || no "$R"

echo "12. Bridge health"
if [ -n "$BT" ]; then
  R=$(curl -sf -H "Authorization: Bearer $BT" "http://localhost:3847/health" 2>/dev/null || echo '{}')
  echo "$R" | grep -q "heartbeat" && ok "bridge healthy" || no "$R"
else
  ok "skipped (no BRIDGE_TOKEN)"
fi

# ── Auth ──────────────────────────────────────────────────────────────────────

echo "13. User profile (/api/auth/me)"
R=$(curl -sf -b "$CJ" "$B/api/auth/me")
echo "$R" | grep -q "admin" && ok "profile returned" || no "$R"

echo "14. Auth guard (no cookie)"
R=$(curl -s "$B/api/company")
echo "$R" | grep -q "error\|not completed\|Not auth" && ok "blocked" || no "not blocked: $R"

# ── CRUD Operations ───────────────────────────────────────────────────────────

echo "15. PATCH agent displayName"
R=$(curl -sf -b "$CJ" -X PATCH "$B/api/agents/dev" -H "Content-Type: application/json" -d '{"displayName":"Sophie v2"}')
echo "$R" | grep -q "Sophie v2" && ok "displayName updated" || no "$R"

echo "16. Create task"
R=$(curl -sf -b "$CJ" -X POST "$B/api/tasks" -H "Content-Type: application/json" \
  -d '{"title":"E2E test task","departmentId":"eng","assignedTo":"dev","priority":"high"}')
echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);exit(0 if 'id' in d or 'created' in d or 'E2E' in str(d) else 1)" 2>/dev/null \
  && ok "task created" || no "$R"

echo "17. List tasks"
R=$(curl -sf -b "$CJ" "$B/api/tasks")
N=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)" 2>/dev/null)
[ "$N" -ge "1" ] 2>/dev/null && ok "$N task(s)" || no "$R"

echo "18. Models endpoint"
R=$(curl -sf -b "$CJ" "$B/api/models")
echo "$R" | grep -q "claude" && ok "models listed" || no "$R"

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "================================"
if [ "$F" -eq 0 ]; then
  echo "ALL $P TESTS PASSED"
else
  echo "RESULTS: $P passed, $F failed"
fi
echo "================================"

exit $F
